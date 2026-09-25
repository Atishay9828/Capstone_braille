/**
 * Braille cell primitives.
 *
 * A cell is six dots. We store them as a 6-bit mask in the STANDARD order —
 * dot1 -> bit0, dot2 -> bit1, ... dot6 -> bit5 — which is exactly the Unicode
 * Braille Patterns block layout (U+2800 + mask).
 *
 *      dot1 o o dot4
 *      dot2 o o dot5
 *      dot3 o o dot6
 *
 * This module knows nothing about cams, motors, bit order or hardware. That is
 * deliberate: `Cell.dots` is defined by the braille standard and can be tested
 * against published tables, while anything physical lives in DisplayProfile.
 * (CLAUDE.md Law 2 — standards above, configuration below.)
 */

/** A 6-bit dot mask, 0..63. 0 is a blank cell. */
export type DotMask = number;

/** Dot numbers as a human writes them: 1..6. */
export type DotNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const DOT_COUNT = 6;
/** Number of distinct 6-dot patterns — and therefore of cam positions. */
export const PATTERN_COUNT = 1 << DOT_COUNT; // 64
export const BLANK: DotMask = 0;
/** All six dots raised. Braillix uses this as the "folded sub-expression" marker. */
export const FULL_CELL: DotMask = PATTERN_COUNT - 1; // 63 -> ⠿

const UNICODE_BRAILLE_BASE = 0x2800;

export class BrailleError extends Error {}

/** True when `value` is a usable 6-bit dot mask. */
export function isDotMask(value: unknown): value is DotMask {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < PATTERN_COUNT;
}

function assertDotMask(value: number, label = 'dot mask'): asserts value is DotMask {
  if (!isDotMask(value)) {
    throw new BrailleError(`${label} must be an integer in 0..${PATTERN_COUNT - 1}, got ${String(value)}`);
  }
}

/** `[1, 2, 5]` -> `0b010011` (19). Order and duplicates do not matter. */
export function dotsToMask(dots: readonly number[]): DotMask {
  let mask = 0;
  for (const dot of dots) {
    if (!Number.isInteger(dot) || dot < 1 || dot > DOT_COUNT) {
      throw new BrailleError(`dot numbers must be 1..${DOT_COUNT}, got ${String(dot)}`);
    }
    mask |= 1 << (dot - 1);
  }
  return mask;
}

/** `19` -> `[1, 2, 5]`, always ascending. */
export function maskToDots(mask: DotMask): DotNumber[] {
  assertDotMask(mask);
  const dots: DotNumber[] = [];
  for (let i = 0; i < DOT_COUNT; i += 1) {
    if (mask & (1 << i)) dots.push((i + 1) as DotNumber);
  }
  return dots;
}

/** Is a given dot raised in this mask? */
export function hasDot(mask: DotMask, dot: DotNumber): boolean {
  return (mask & (1 << (dot - 1))) !== 0;
}

/** `19` -> `"⠓"`. The Unicode braille block is laid out in exactly our bit order. */
export function maskToUnicode(mask: DotMask): string {
  assertDotMask(mask);
  return String.fromCodePoint(UNICODE_BRAILLE_BASE + mask);
}

/** `"⠓"` -> `19`. Returns `null` for anything outside the 6-dot braille block. */
export function unicodeToMask(char: string): DotMask | null {
  const code = char.codePointAt(0);
  if (code === undefined) return null;
  const offset = code - UNICODE_BRAILLE_BASE;
  return offset >= 0 && offset < PATTERN_COUNT ? offset : null;
}

/**
 * Turn a Unicode braille string (what speech-rule-engine emits) into dot masks.
 *
 * Non-braille characters are mapped rather than dropped: an ASCII space becomes a
 * blank cell, because in Nemeth a space is a meaningful separator and silently
 * deleting it would shift every following cell. Anything else unrecognised is
 * reported so the caller can surface it (Law 3 — nothing degrades silently).
 */
export function unicodeStringToMasks(text: string): { cells: DotMask[]; unknown: string[] } {
  const cells: DotMask[] = [];
  const unknown: string[] = [];
  for (const char of text) {
    const mask = unicodeToMask(char);
    if (mask !== null) {
      cells.push(mask);
    } else if (char === ' ' || char === ' ') {
      cells.push(BLANK);
    } else if (char === '\n' || char === '\r' || char === '\t') {
      // Layout whitespace from the translator, not content. Skip.
    } else {
      unknown.push(char);
    }
  }
  return { cells, unknown };
}

/** How many dots differ between two cells — used to describe refresh cost. */
export function dotDistance(a: DotMask, b: DotMask): number {
  assertDotMask(a, 'mask a');
  assertDotMask(b, 'mask b');
  let diff = a ^ b;
  let count = 0;
  while (diff) {
    count += diff & 1;
    diff >>= 1;
  }
  return count;
}

/** `19` -> `"⠓ (1-2-5)"`. For tooltips, the cell atlas and test failure messages. */
export function describeMask(mask: DotMask): string {
  const dots = maskToDots(mask);
  return `${maskToUnicode(mask)} (${dots.length ? dots.join('-') : 'blank'})`;
}
