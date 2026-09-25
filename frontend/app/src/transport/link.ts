/**
 * DisplayLink — the one thing that pushes frames at hardware.
 *
 * It owns two facts that must never be duplicated:
 *   · which transport is currently attached
 *   · what that display is believed to be showing (`DisplayState`)
 *
 * The second is the subtle one. The motion-minimising scheduler only sends the cells that changed,
 * which is only correct if we are certain what is on the display now. Connecting, disconnecting,
 * homing, resizing, an error — all of them destroy that certainty, and every one of them
 * invalidates the belief here so the next frame goes out in full. Uncertainty costs a resend; it
 * never costs correctness. (ARCHITECTURE.md contradiction #4.)
 */

import { DisplayState, describePlan, type RefreshPlan } from '../core/scheduler';
import { makeProfile, type DisplayProfile, type ProfileSource } from '../core/profile';
import { SimTransport } from './sim';
import { TransportError, type ButtonEvent, type ChainInfo, type Transport, type TransportStatus } from './types';

export interface LinkReport {
  readonly plan: RefreshPlan;
  readonly summary: string;
  /** Set when the transport refused or failed. The display keeps its previous frame. */
  readonly error?: string;
  readonly fix?: string;
}

export class DisplayLink {
  #transport: Transport;
  #state = new DisplayState();
  #chain: ChainInfo;
  #unsubscribes: (() => void)[] = [];

  #buttonListeners = new Set<(event: ButtonEvent) => void>();
  #statusListeners = new Set<(status: TransportStatus, reason?: string) => void>();

  constructor(transport: Transport, chain: ChainInfo) {
    this.#transport = transport;
    this.#chain = chain;
    this.#wire();
  }

  /** The always-available starting point: a simulated display of the given size. */
  static async simulated(cellCount: number): Promise<DisplayLink> {
    const transport = new SimTransport(cellCount);
    const chain = await transport.connect();
    return new DisplayLink(transport, chain);
  }

  get transport(): Transport {
    return this.#transport;
  }

  get chain(): ChainInfo {
    return this.#chain;
  }

  get status(): TransportStatus {
    return this.#transport.status;
  }

  #wire(): void {
    this.#unsubscribes.push(
      this.#transport.onButton((event) => {
        for (const listener of this.#buttonListeners) listener(event);
      }),
      this.#transport.onStatus((status, reason) => {
        // Any status change means we can no longer be sure what the cells are showing.
        this.#state.invalidate();
        for (const listener of this.#statusListeners) listener(status, reason);
      }),
    );
  }

  onButton(listener: (event: ButtonEvent) => void): () => void {
    this.#buttonListeners.add(listener);
    return () => this.#buttonListeners.delete(listener);
  }

  onStatus(listener: (status: TransportStatus, reason?: string) => void): () => void {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  }

  /**
   * Build the display profile from what the transport actually reported.
   *
   * This is where CLAUDE.md Law 1 is kept: the cell count comes from a real `/chain` reply, or from
   * an explicitly-labelled simulation. It is never a literal and never a guess.
   */
  profile(existing?: Pick<DisplayProfile, 'bitOrder' | 'reversed' | 'homeIndex'>): DisplayProfile {
    const source: ProfileSource = this.#transport.kind === 'sim' ? 'simulated' : this.#transport.kind;
    return makeProfile({
      cellCount: this.#chain.cellCount,
      source,
      label: this.#transport.label,
      bitOrder: existing?.bitOrder,
      reversed: existing?.reversed,
      homeIndex: existing?.homeIndex,
      pods: this.#chain.pods,
      mirrored: this.#chain.mirrored,
    });
  }

  /** Resize a simulated display. Real hardware is whatever it is; only the simulator can change. */
  resize(cellCount: number): ChainInfo {
    if (!(this.#transport instanceof SimTransport)) {
      throw new TransportError(
        'the number of cells is set by the hardware, not by this control',
        'Disconnect the pod to go back to the simulated display.',
      );
    }
    this.#chain = this.#transport.resize(cellCount);
    this.#state.invalidate();
    return this.#chain;
  }

  /**
   * Push a frame. Never throws: a transport failure is reported so the interface can show it, and
   * the belief about the display is dropped so the next attempt sends everything.
   */
  async push(cam: readonly number[]): Promise<LinkReport> {
    const plan = this.#state.plan(cam);
    try {
      await this.#transport.apply(plan);
      this.#state.commit(plan);
      return { plan, summary: describePlan(plan) };
    } catch (err) {
      this.#state.invalidate();
      const error = err instanceof Error ? err.message : String(err);
      const fix = err instanceof TransportError ? err.fix : undefined;
      return { plan, summary: describePlan(plan), error, fix };
    }
  }

  async home(): Promise<void> {
    await this.#transport.home();
    this.#state.invalidate(); // after homing every cell is at 0, but say so by resending
  }

  /** Drop the belief about the display without touching it — used when the profile changes. */
  invalidate(): void {
    this.#state.invalidate();
  }

  async close(): Promise<void> {
    for (const unsubscribe of this.#unsubscribes) unsubscribe();
    this.#unsubscribes = [];
    this.#buttonListeners.clear();
    this.#statusListeners.clear();
    await this.#transport.disconnect();
  }
}
