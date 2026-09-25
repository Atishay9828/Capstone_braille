/**
 * DisplayProfile — the one place that knows anything physical about the display.
 *
 * Two rules from CLAUDE.md live here:
 *
 *   Law 1  The cell count is DISCOVERED, never known. Nothing in Braillix may write a cell count
 *          as a literal; it arrives from a transport (an I2C scan) or from an explicit, clearly
 *          labelled simulation setting.
 *
 *   Law 2  Standards above, configuration below. `DotMask` follows the braille standard. The cam
 *          number that actually goes on the wire is a *permutation* of those bits, because the
 *          handoff (§3 Step 2) flags the dot->cam-track order as UNCONFIRMED against the physical
 *          cam. If the hardware team wired the tracks in another order, that is a setting change
 *          and a re-export — not a code change, not a re-flash, and not a debugging session in
 *          front of a panel.
 */

import { DOT_COUNT, PATTERN_COUNT, type DotMask, isDotMask } from './braille';

/** Where a profile's cell count came from. Shown in the UI so a simulated count is never mistaken for a real one. */
export type ProfileSource = 'simulated' | 'serial' | 'http';

/**
 * `bitOrder[i]` = which physical cam-track bit is driven by dot (i+1).
 * The handoff's stated default is the identity mapping: dot1 -> bit0 … dot6 -> bit5.
 */
export type BitOrder = readonly [number, number, number, number, number, number];

export const DEFAULT_BIT_ORDER: BitOrder = [0, 1, 2, 3, 4, 5];

export interface DisplayProfile {
  /** How many braille cells the display physically has. Never assumed; always from `source`. */
  readonly cellCount: number;
  readonly source: ProfileSource;
  /** Human label for the status strip, e.g. "simulated" or "pod at 192.168.1.42". */
  readonly label: string;
  readonly bitOrder: BitOrder;
  /** True when cell 0 is on the right rather than the left (mirrored dock assembly). */
  readonly reversed: boolean;
  /** Cam index that the homing routine parks at. Almost always 0 (blank). */
  readonly homeIndex: number;
  /** Per-pod breakdown, when the display is made of more than one brain pod. */
  readonly pods: readonly PodInfo[];
  /** True when every pod shows the same cells (a class reading together); width = smallest pod. */
  readonly mirrored: boolean;
}

export interface PodInfo {
  readonly index: number;
  readonly label: string;
  /** I2C addresses of this pod's muscle cells, in physical left-to-right order. */
  readonly cellAddrs: readonly number[];
}

export class ProfileError extends Error {}

/** The profile used when nothing is plugged in. `cellCount` is a caller decision, not a default hidden in code. */
export function simulatedProfile(cellCount: number, overrides: Partial<DisplayProfile> = {}): DisplayProfile {
  return makeProfile({
    cellCount,
    source: 'simulated',
    label: 'simulated',
    ...overrides,
  });
}

/** Build a profile, validating everything that could otherwise fail silently later. */
export function makeProfile(input: {
  cellCount: number;
  source: ProfileSource;
  label: string;
  bitOrder?: BitOrder;
  reversed?: boolean;
  homeIndex?: number;
  pods?: readonly PodInfo[];
  mirrored?: boolean;
}): DisplayProfile {
  const { cellCount, source, label } = input;

  if (!Number.isInteger(cellCount) || cellCount < 1) {
    throw new ProfileError(`cellCount must be a positive integer, got ${String(cellCount)}`);
  }

  const bitOrder = input.bitOrder ?? DEFAULT_BIT_ORDER;
  assertValidBitOrder(bitOrder);

  const homeIndex = input.homeIndex ?? 0;
  if (!isDotMask(homeIndex)) {
    throw new ProfileError(`homeIndex must be a cam position 0..${PATTERN_COUNT - 1}, got ${String(homeIndex)}`);
  }

  const pods = input.pods ?? [{ index: 0, label, cellAddrs: [] }];
  const mirrored = input.mirrored ?? false;
  const podTotal = pods.reduce((sum, pod) => sum + pod.cellAddrs.length, 0);
  if (podTotal > 0) {
    if (mirrored) {
      // Mirrored, the display is exactly as wide as the SMALLEST pod (D8.6) — a frame the
      // small display cannot show would leave one child reading a truncated line. Different
      // arithmetic, same duty: fail loudly rather than slice wrongly (v5 Arc D: a real
      // 4+2-cell mirror was being rejected by the chain-shaped check below).
      const smallest = Math.min(...pods.map((pod) => pod.cellAddrs.length).filter((width) => width > 0));
      if (cellCount !== smallest) {
        throw new ProfileError(
          `mirrored pods must show the width of the smallest (${smallest} cells) but cellCount is ${cellCount}`,
        );
      }
    } else if (podTotal !== cellCount) {
      throw new ProfileError(
        `pods declare ${podTotal} cells but cellCount is ${cellCount} — the display would be sliced wrongly`,
      );
    }
  }

  return {
    cellCount,
    source,
    label,
    bitOrder,
    reversed: input.reversed ?? false,
    homeIndex,
    pods,
    mirrored,
  };
}

function assertValidBitOrder(order: BitOrder): void {
  if (order.length !== DOT_COUNT) {
    throw new ProfileError(`bitOrder must have ${DOT_COUNT} entries, got ${order.length}`);
  }
  const seen = new Set<number>();
  for (const bit of order) {
    if (!Number.isInteger(bit) || bit < 0 || bit >= DOT_COUNT) {
      throw new ProfileError(`bitOrder entries must be 0..${DOT_COUNT - 1}, got ${String(bit)}`);
    }
    if (seen.has(bit)) throw new ProfileError(`bitOrder must be a permutation; bit ${bit} appears twice`);
    seen.add(bit);
  }
}

/**
 * Standard dot mask -> the cam position number (0..63) that goes on the wire.
 *
 * This is the ONLY function in Braillix permitted to do bit arithmetic for the hardware.
 * Everything else passes `DotMask` around.
 */
export function toCam(profile: DisplayProfile, dots: DotMask): number {
  if (!isDotMask(dots)) throw new ProfileError(`not a dot mask: ${String(dots)}`);
  let cam = 0;
  for (let dot = 0; dot < DOT_COUNT; dot += 1) {
    if (dots & (1 << dot)) cam |= 1 << profile.bitOrder[dot];
  }
  return cam;
}

/** The inverse of `toCam` — used by the calibration screen and by back-translation from hardware. */
export function fromCam(profile: DisplayProfile, cam: number): DotMask {
  if (!isDotMask(cam)) throw new ProfileError(`not a cam position: ${String(cam)}`);
  let dots = 0;
  for (let dot = 0; dot < DOT_COUNT; dot += 1) {
    if (cam & (1 << profile.bitOrder[dot])) dots |= 1 << dot;
  }
  return dots;
}

/**
 * Physical ordering of cells. `reversed` covers a dock assembled right-to-left, which is a real
 * possibility with pogo-pin daisy chains and is far cheaper to fix here than in solder.
 */
export function orderCells<T>(profile: DisplayProfile, cells: readonly T[]): T[] {
  return profile.reversed ? [...cells].reverse() : [...cells];
}

/**
 * Split a run of cell values across the pods that make up this display (handoff §4B).
 * Each pod receives only its own slice; the laptop stays the single brain that computes them.
 */
export function sliceByPod(profile: DisplayProfile, values: readonly number[]): { pod: PodInfo; slice: number[] }[] {
  const out: { pod: PodInfo; slice: number[] }[] = [];
  let cursor = 0;
  for (const pod of profile.pods) {
    const width = pod.cellAddrs.length || (profile.pods.length === 1 ? profile.cellCount : 0);
    out.push({ pod, slice: values.slice(cursor, cursor + width) });
    cursor += width;
  }
  return out;
}

/** A short, honest description for the status strip. */
export function describeProfile(profile: DisplayProfile): string {
  const cells = `${profile.cellCount} cell${profile.cellCount === 1 ? '' : 's'}`;
  const pods = profile.pods.length > 1 ? ` across ${profile.pods.length} pods` : '';
  return `${cells}${pods} · ${profile.label}`;
}

/** Serialisable calibration settings — what the calibration screen exports for the hardware team. */
export interface CalibrationConfig {
  bitOrder: number[];
  reversed: boolean;
  homeIndex: number;
  note: string;
}

export function exportCalibration(profile: DisplayProfile): CalibrationConfig {
  return {
    bitOrder: [...profile.bitOrder],
    reversed: profile.reversed,
    homeIndex: profile.homeIndex,
    note:
      'bitOrder[i] is the physical cam-track bit driven by dot i+1. Verified against the cam by raising ' +
      'one dot at a time in the Braillix calibration screen.',
  };
}
