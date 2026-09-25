/**
 * The motion-minimising refresh scheduler.
 *
 * Each muscle cell is a 28BYJ-48 stepper turning a 64-position cam: 4096 half-steps per
 * revolution, so 64 half-steps per cam position (handoff §5). Moving a cell is therefore
 * expensive in a way that pixels never are, and two naive habits cost real seconds:
 *
 *   1. Re-sending every cell when only one changed.
 *   2. Rotating the long way round a circle. Going from position 60 to position 2 is 6 steps
 *      forward, not 58 backward — but only if somebody works that out.
 *
 * Borrowed from split-flap departure boards and e-ink partial refresh (see DECISIONS.md,
 * "THE INNOVATION"): diff the frame, move only what changed, and always take the shorter arc.
 *
 * Correctness rule (ARCHITECTURE.md contradiction #4): a diff is only valid against a frame we
 * are certain the hardware is actually showing. Any reconnect, re-home, error or profile change
 * invalidates that certainty, and uncertainty always costs a full resend — never correctness.
 */

import { PATTERN_COUNT } from './braille';

/** Half-steps the real motor takes to advance one cam position. From the handoff: 4096 / 64. */
export const HALF_STEPS_PER_POSITION = 4096 / PATTERN_COUNT; // 64

export interface CellMove {
  /** Index of the cell within the display, left to right in physical order. */
  readonly cell: number;
  readonly from: number;
  readonly to: number;
  /** Signed cam positions to rotate: positive = forward, negative = backward. Always the shorter arc. */
  readonly delta: number;
  /** Absolute half-steps this move costs the motor. */
  readonly halfSteps: number;
}

export interface RefreshPlan {
  readonly moves: readonly CellMove[];
  /** Cam positions for every cell, whether or not it moves — what a full resend would contain. */
  readonly target: readonly number[];
  /** True when we could not trust the previous state and had to command every cell. */
  readonly fullRefresh: boolean;
  readonly cellsMoved: number;
  readonly halfStepsPlanned: number;
  /** What a naive "resend everything, always rotate forward" strategy would have cost. */
  readonly halfStepsNaive: number;
}

/**
 * Shortest signed distance from `from` to `to` around a 64-position circle.
 * Ties (exactly half a turn) resolve forward, so behaviour is deterministic and testable.
 */
export function shortestArc(from: number, to: number, positions = PATTERN_COUNT): number {
  const forward = (((to - from) % positions) + positions) % positions;
  const backward = forward - positions;
  return forward <= -backward ? forward : backward;
}

/**
 * Work out the cheapest set of motor commands that turns `previous` into `target`.
 *
 * `previous` is `null` whenever the display's state is unknown — first frame, after a reconnect,
 * after homing, after an error, or after the profile changed. That always produces a full refresh.
 */
export function planRefresh(previous: readonly number[] | null, target: readonly number[]): RefreshPlan {
  const trustworthy = previous !== null && previous.length === target.length;
  const moves: CellMove[] = [];

  let halfStepsPlanned = 0;
  let halfStepsNaive = 0;

  for (let cell = 0; cell < target.length; cell += 1) {
    const to = target[cell];
    const from = trustworthy ? previous[cell] : null;

    // Naive baseline: command every cell, always rotating forward.
    const naiveFrom = from ?? 0;
    halfStepsNaive += forwardOnly(naiveFrom, to) * HALF_STEPS_PER_POSITION;

    if (from !== null && from === to) continue; // already correct — don't touch the motor

    const delta = from === null ? forwardOnly(0, to) : shortestArc(from, to);
    const halfSteps = Math.abs(delta) * HALF_STEPS_PER_POSITION;
    halfStepsPlanned += halfSteps;
    moves.push({ cell, from: from ?? 0, to, delta, halfSteps });
  }

  return {
    moves,
    target: [...target],
    fullRefresh: !trustworthy,
    cellsMoved: moves.length,
    halfStepsPlanned,
    halfStepsNaive,
  };
}

function forwardOnly(from: number, to: number, positions = PATTERN_COUNT): number {
  return (((to - from) % positions) + positions) % positions;
}

/** A one-line summary for the UI readout — the scheduler's work made visible, per CLAUDE.md Law 3. */
export function describePlan(plan: RefreshPlan): string {
  if (plan.moves.length === 0) return 'no motion needed — every cell already correct';
  const saved = plan.halfStepsNaive - plan.halfStepsPlanned;
  const cells = `${plan.cellsMoved} of ${plan.target.length} cell${plan.target.length === 1 ? '' : 's'}`;
  const base = `${cells} moving · ${plan.halfStepsPlanned.toLocaleString()} half-steps`;
  if (plan.fullRefresh) return `${base} · full refresh (display state unknown)`;
  if (saved <= 0) return base;
  const pct = Math.round((saved / plan.halfStepsNaive) * 100);
  return `${base} · ${saved.toLocaleString()} saved (${pct}% less motor travel)`;
}

/**
 * Tracks what the hardware is believed to be showing, and refuses to guess.
 *
 * Every transport owns one of these. `invalidate()` is called on connect, disconnect, home, error
 * and profile change — after which the next plan is a full refresh.
 */
export class DisplayState {
  #known: number[] | null = null;

  get known(): readonly number[] | null {
    return this.#known;
  }

  plan(target: readonly number[]): RefreshPlan {
    return planRefresh(this.#known, target);
  }

  /** Call only after the transport has confirmed the moves were accepted. */
  commit(plan: RefreshPlan): void {
    this.#known = [...plan.target];
  }

  invalidate(): void {
    this.#known = null;
  }
}
