/**
 * Frames: what the physical display should show right now.
 *
 * A translation produces an arbitrarily long run of braille cells. A display has however many
 * cells it happens to have — one, four, or forty. A Frame is the window onto the run, plus the
 * cam numbers for this particular DisplayProfile.
 *
 * There is exactly one function that produces a Frame (`renderFrame`). Nothing else in Braillix
 * may work out what a cell should show. (CLAUDE.md Law 5.)
 */

import { BLANK, type DotMask } from './braille';
import { orderCells, toCam, type DisplayProfile } from './profile';

export interface Frame {
  /** Dot masks, exactly `profile.cellCount` long, already in physical order. */
  readonly cells: readonly DotMask[];
  /** Cam positions for those cells, same length, same order. This is what goes on the wire. */
  readonly cam: readonly number[];
  /** Index into the full run that cell 0 is showing. */
  readonly windowStart: number;
  /** Total length of the run this window is cut from. */
  readonly total: number;
  /** Which display cell (if any) holds the reader's cursor. */
  readonly cursorCell: number | null;
  /**
   * How wide the window is. The *words* for this ("cells 4–7 of 19") are built in the interface,
   * where the language is known — core deals in numbers only.
   */
  readonly width: number;
}

export interface RenderOptions {
  /** The full braille run being read. */
  readonly cells: readonly DotMask[];
  /** First cell of the run to show. Clamped into range. */
  readonly windowStart?: number;
  /** Position of the reading cursor within the run, if there is one. */
  readonly cursor?: number | null;
}

/**
 * Build the frame for a display.
 *
 * `profile.cellCount` is read here and nowhere else in the render path — which is how Braillix
 * keeps its promise that the cell count is never hardcoded at any layer.
 */
export function renderFrame(profile: DisplayProfile, options: RenderOptions): Frame {
  const { cells } = options;
  const width = profile.cellCount;
  const total = cells.length;

  const maxStart = Math.max(0, total - width);
  const windowStart = clamp(options.windowStart ?? 0, 0, maxStart);

  const visible: DotMask[] = [];
  for (let i = 0; i < width; i += 1) {
    visible.push(cells[windowStart + i] ?? BLANK);
  }

  const cursor = options.cursor ?? null;
  const cursorInWindow =
    cursor !== null && cursor >= windowStart && cursor < windowStart + width ? cursor - windowStart : null;

  const ordered = orderCells(profile, visible);
  const orderedCursor =
    cursorInWindow === null ? null : profile.reversed ? width - 1 - cursorInWindow : cursorInWindow;

  return {
    cells: ordered,
    cam: ordered.map((mask) => toCam(profile, mask)),
    windowStart,
    total,
    cursorCell: orderedCursor,
    width,
  };
}


function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Move the window so that `cursor` is visible, moving as little as possible.
 * Keeps a cell of context on either side when the display is wide enough to afford it.
 */
export function windowFollowingCursor(
  current: number,
  cursor: number,
  width: number,
  total: number,
): number {
  const maxStart = Math.max(0, total - width);
  const margin = width >= 3 ? 1 : 0;

  if (cursor < current + margin) return clamp(cursor - margin, 0, maxStart);
  if (cursor > current + width - 1 - margin) return clamp(cursor - width + 1 + margin, 0, maxStart);
  return clamp(current, 0, maxStart);
}

/** Page forward/back by a whole display width — what the pod's Prev/Next buttons do in page mode. */
export function pageWindow(current: number, direction: -1 | 1, width: number, total: number): number {
  const maxStart = Math.max(0, total - width);
  return clamp(current + direction * width, 0, maxStart);
}

/** How many pages of `width` cells the run occupies. */
export function pageCount(total: number, width: number): number {
  return total === 0 ? 1 : Math.ceil(total / width);
}
