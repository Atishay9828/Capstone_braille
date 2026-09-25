/**
 * The simulated display.
 *
 * This is not a stub and not a mock. It is the transport the product runs on when nothing is
 * plugged in — which the brief names as the primary requirement, not a fallback. It obeys the same
 * interface and the same rules as the real hardware, including refusing a frame of the wrong
 * length, so code that works here works on a pod.
 *
 * It also models the one thing that makes the real display interesting: motors take time. Each cam
 * position is 64 half-steps of a 28BYJ-48, so a move is not instant, and the simulator says how
 * long the real thing would have taken.
 */

import { PATTERN_COUNT } from '../core/braille';
import type { RefreshPlan } from '../core/scheduler';
import { TransportBase, TransportError, podFromReport, type ChainInfo, type ShowResult, type Transport } from './types';

/** A 28BYJ-48 driven by AccelStepper runs comfortably around this rate. Used for timing estimates only. */
const SIM_HALF_STEPS_PER_SECOND = 900;

export class SimTransport extends TransportBase implements Transport {
  readonly kind = 'sim' as const;

  #cellCount: number;
  #positions: number[];

  constructor(cellCount: number) {
    super();
    if (!Number.isInteger(cellCount) || cellCount < 1) {
      throw new TransportError(`a simulated display needs at least one cell, got ${String(cellCount)}`);
    }
    this.#cellCount = cellCount;
    this.#positions = new Array<number>(cellCount).fill(0);
  }

  get label(): string {
    return 'simulated';
  }

  /** What the cells are showing. The UI reads this to draw the dock. */
  get positions(): readonly number[] {
    return this.#positions;
  }

  /** The simulator is the one transport whose size the user chooses, so it can be resized. */
  resize(cellCount: number): ChainInfo {
    if (!Number.isInteger(cellCount) || cellCount < 1) {
      throw new TransportError(`a simulated display needs at least one cell, got ${String(cellCount)}`);
    }
    this.#cellCount = cellCount;
    this.#positions = new Array<number>(cellCount).fill(0);
    return this.#chain();
  }

  #chain(): ChainInfo {
    // Simulated cells are given the same I2C addresses a real chain would use, so the Hardware
    // screen shows the same shape of information whether or not anything is plugged in.
    const addrs = Array.from({ length: this.#cellCount }, (_, i) => 0x20 + (i % 8));
    return {
      pods: [podFromReport(0, 'simulated pod', addrs)],
      cellCount: this.#cellCount,
      firmware: 'braillix-sim/1.0',
    };
  }

  async connect(): Promise<ChainInfo> {
    this.setStatus('connected');
    return this.#chain();
  }

  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
  }

  async apply(plan: RefreshPlan): Promise<ShowResult> {
    if (plan.target.length !== this.#cellCount) {
      throw new TransportError(
        `frame has ${plan.target.length} cells but the display has ${this.#cellCount}`,
      );
    }
    for (const position of plan.target) {
      if (!Number.isInteger(position) || position < 0 || position >= PATTERN_COUNT) {
        throw new TransportError(`cam position ${String(position)} is outside 0..${PATTERN_COUNT - 1}`);
      }
    }

    this.#positions = [...plan.target];
    return { moved: plan.cellsMoved, skipped: this.#cellCount - plan.cellsMoved };
  }

  async home(): Promise<void> {
    this.#positions = new Array<number>(this.#cellCount).fill(0);
  }
}

/** How long a plan would take on real motors, in milliseconds. Cells move in parallel. */
export function estimateMoveMs(plan: RefreshPlan): number {
  const slowest = plan.moves.reduce((max, move) => Math.max(max, move.halfSteps), 0);
  return Math.round((slowest / SIM_HALF_STEPS_PER_SECOND) * 1000);
}

