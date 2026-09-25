/**
 * Every symbol a school maths line needs — one flat rail, always on screen.
 *
 * v4 lesson, learned the hard way: the founder looked at a screenshot containing every one of
 * these symbols and asked where they were. A palette below the fold is hidden, whatever the
 * DOM says. So the keys live in one horizontal rail that is always visible above the input,
 * ordered everyday-first, senior-class last — reachable by scrolling the rail, never the page.
 *
 * Faces say what the button makes (a/b), never the code it emits (\frac). Insertion happens
 * at the caret; `back` walks the caret into the brackets just written.
 */

import type { useT } from './i18n';

export interface ChalkKey {
  /** What the button says. */
  readonly face: string;
  /** What gets inserted at the caret. */
  readonly insert: string;
  /** Characters to step the caret back — puts it inside the brackets. */
  readonly back?: number;
  /** Spoken/announced name, and the tooltip. */
  readonly name: string;
  /** Rendered in the maths face rather than the interface face. */
  readonly math?: boolean;
}

export function chalkKeys(t: ReturnType<typeof useT>): readonly ChalkKey[] {
  return [
    { face: '+', insert: ' + ', name: t('keypad.plus') },
    { face: '−', insert: ' - ', name: t('keypad.minus') },
    { face: '×', insert: ' x ', name: t('keypad.times') },
    { face: '÷', insert: ' div ', name: t('keypad.dividedBy') },
    { face: '=', insert: ' = ', name: t('keypad.equals') },
    { face: 'a/b', insert: '/', name: t('keypad.fraction'), math: true },
    { face: 'x²', insert: '^2', name: t('keypad.squared'), math: true },
    { face: 'xⁿ', insert: '^', name: t('keypad.power'), math: true },
    { face: '√', insert: 'sqrt()', back: 1, name: t('keypad.root'), math: true },
    { face: '( )', insert: '()', back: 1, name: t('keypad.brackets') },
    { face: 'π', insert: 'pi', name: t('keypad.pi'), math: true },
    { face: 'θ', insert: 'theta', name: t('keypad.theta'), math: true },
    { face: '°', insert: '°', name: t('keypad.degrees') },
    { face: '%', insert: '%', name: t('keypad.percent') },
    { face: '₹', insert: '₹', name: t('keypad.rupees') },
    { face: '<', insert: ' < ', name: t('keypad.lessThan') },
    { face: '>', insert: ' > ', name: t('keypad.greaterThan') },
    { face: '≤', insert: ' <= ', name: t('keypad.atMost') },
    { face: '≥', insert: ' >= ', name: t('keypad.atLeast') },
    { face: '≠', insert: ' != ', name: t('keypad.notEqual') },
    { face: '≈', insert: ' ~= ', name: t('keypad.about') },
    { face: 'x₁', insert: '_', name: t('keypad.index'), math: true },
    { face: '∛', insert: 'cbrt()', back: 1, name: t('keypad.cubeRoot'), math: true },
    { face: 'sin', insert: 'sin ', name: 'sine', math: true },
    { face: 'cos', insert: 'cos ', name: 'cosine', math: true },
    { face: 'tan', insert: 'tan ', name: 'tangent', math: true },
    { face: 'log', insert: 'log ', name: 'logarithm', math: true },
    { face: 'ln', insert: 'ln ', name: 'natural logarithm', math: true },
    { face: '|x|', insert: 'abs()', back: 1, name: t('keypad.absolute'), math: true },
    { face: 'Σ', insert: 'sum_{i=1}^{n} ', name: t('keypad.sum'), math: true },
    { face: '∫', insert: 'int_{0}^{1} ', name: t('keypad.integral'), math: true },
    { face: 'lim', insert: 'lim_{x -> 0} ', name: t('keypad.limit'), math: true },
    { face: '∞', insert: 'infinity', name: t('keypad.infinity'), math: true },
    { face: '∠', insert: 'angle ', name: t('keypad.angle'), math: true },
    { face: '{ }', insert: '{}', back: 1, name: t('keypad.set') },
    { face: '[ ]', insert: '[]', back: 1, name: t('keypad.squareBrackets') },
    /* The class 11-12 vocabulary (D-V5.1): every senior chapter reachable from the rail. */
    { face: '∪', insert: ' union ', name: t('keypad.union'), math: true },
    { face: '∩', insert: ' intersect ', name: t('keypad.intersect'), math: true },
    { face: '∈', insert: ' in ', name: t('keypad.member'), math: true },
    { face: '→', insert: ' -> ', name: t('keypad.arrow'), math: true },
    { face: 'f′', insert: "'", name: t('keypad.prime'), math: true },
    { face: 'sin⁻¹', insert: 'sin^(-1) ', name: t('keypad.inverseSine'), math: true },
    { face: 'ⁿCᵣ', insert: 'nCr', name: t('keypad.ncr'), math: true },
    { face: 'd/dx', insert: 'd/dx ', name: t('keypad.ddx'), math: true },
    { face: 'a⃗', insert: 'vec()', back: 1, name: t('keypad.vector'), math: true },
    { face: '|A|', insert: '|A|', name: t('keypad.determinant'), math: true },
    { face: 'Aᵀ', insert: '^T', name: t('keypad.transpose'), math: true },
    { face: '⎡⎣⎤⎦', insert: '[[a, b], [c, d]]', name: t('keypad.matrix'), math: true },
  ];
}

/**
 * Insert at the caret of a text field and leave the caret where the next keystroke belongs.
 * Appending to the end instead makes the rail useless the moment someone corrects the middle
 * of a line — and that is the moment they lose trust in it.
 */
export function insertAtCaret(
  field: HTMLTextAreaElement | HTMLInputElement,
  text: string,
  back: number,
): string {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const next = field.value.slice(0, start) + text + field.value.slice(end);
  const caret = start + text.length - back;

  // The value is owned by React; setting it here only keeps the caret from jumping to the end
  // before the re-render lands.
  field.value = next;
  field.setSelectionRange(caret, caret);
  field.focus();
  return next;
}
