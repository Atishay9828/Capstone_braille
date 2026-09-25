/**
 * The seam between software and hardware.
 *
 * The owner's second-biggest fear is "an integration that half-works and creates problems for the
 * product later". The answer is one narrow interface with three implementations that are tested
 * against the same conformance suite — a simulator, a pod over USB, and a pod over Wi-Fi — plus an
 * emulator that speaks the real wire protocol so integration can be proven today, with nothing
 * plugged in.
 *
 * Everything crossing this boundary is a cam position, 0–63. No braille, no maths, no language.
 * That is what lets the braille logic change without anyone reflashing a board.
 *
 * See docs/PROTOCOL.md.
 */

import type { PodInfo } from '../core/profile';
import type { RefreshPlan } from '../core/scheduler';

export type TransportKind = 'sim' | 'serial' | 'http';

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** What the pod reported when we asked what it is made of. Never assumed — always discovered. */
export interface ChainInfo {
  readonly pods: readonly PodInfo[];
  /** Chained: total cells across every pod. Mirrored: the width of the smallest pod. */
  readonly cellCount: number;
  readonly firmware?: string;
  /**
   * True when several pods all show the same cells (a class reading together, D8.6). Stated
   * explicitly because the profile's pod arithmetic is different in each mode, and deriving
   * the mode from the numbers would be a guess (v5 Arc D found the chain-shaped check
   * rejecting a real 4+2-cell mirror).
   */
  readonly mirrored?: boolean;
}

export type PodButton = 'prev' | 'select' | 'next';

export interface ButtonEvent {
  readonly button: PodButton;
  /** True for a press held long enough to mean "go back out". */
  readonly long: boolean;
  readonly seq: number;
}

export interface ShowResult {
  readonly moved: number;
  readonly skipped: number;
}

export class TransportError extends Error {
  constructor(
    message: string,
    /** Something the user can actually do. Shown in the status strip. */
    readonly fix?: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface Transport {
  readonly kind: TransportKind;
  /** Human label for the status strip: "simulated", "USB /dev/ttyUSB0", "pod at 192.168.1.42". */
  readonly label: string;

  /** Connect and report what is actually there. Throws `TransportError` with a fix on failure. */
  connect(): Promise<ChainInfo>;
  disconnect(): Promise<void>;

  /**
   * Apply a refresh plan.
   *
   * Implementations may send the full frame or only the changed cells; either is protocol-legal.
   * What they must NOT do is report success for a frame they did not manage to send — the caller
   * uses that to decide whether its belief about the display is still trustworthy.
   */
  apply(plan: RefreshPlan): Promise<ShowResult>;

  /** Re-home every cell. Afterwards the display's state is unknown by definition. */
  home(): Promise<void>;

  /** Subscribe to button presses. Returns an unsubscribe function. */
  onButton(listener: (event: ButtonEvent) => void): () => void;

  /** Subscribe to connection-state changes. Returns an unsubscribe function. */
  onStatus(listener: (status: TransportStatus, reason?: string) => void): () => void;

  readonly status: TransportStatus;
}

/** Shared listener bookkeeping, so each transport doesn't reinvent it slightly differently. */
export class TransportBase {
  #buttonListeners = new Set<(event: ButtonEvent) => void>();
  #statusListeners = new Set<(status: TransportStatus, reason?: string) => void>();
  #status: TransportStatus = 'disconnected';

  get status(): TransportStatus {
    return this.#status;
  }

  protected setStatus(status: TransportStatus, reason?: string): void {
    this.#status = status;
    for (const listener of this.#statusListeners) listener(status, reason);
  }

  protected emitButton(event: ButtonEvent): void {
    for (const listener of this.#buttonListeners) listener(event);
  }

  onButton(listener: (event: ButtonEvent) => void): () => void {
    this.#buttonListeners.add(listener);
    return () => this.#buttonListeners.delete(listener);
  }

  onStatus(listener: (status: TransportStatus, reason?: string) => void): () => void {
    this.#statusListeners.add(listener);
    return () => this.#statusListeners.delete(listener);
  }
}

/** Build a `PodInfo` from what a pod reported about itself. */
export function podFromReport(index: number, label: string, cellAddrs: readonly number[]): PodInfo {
  return { index, label, cellAddrs: [...cellAddrs] };
}

/**
 * Validate a `/chain` reply before trusting it.
 *
 * A pod that reports `count: 4` but lists three addresses has a real fault, and quietly using
 * whichever number happens to be read first would produce a display that is wrong in a way nobody
 * could explain later.
 */
export function parseChainReply(
  body: unknown,
  podIndex: number,
  label: string,
): { pod: PodInfo; firmware?: string } {
  if (typeof body !== 'object' || body === null) {
    throw new TransportError('the pod did not reply with a chain description');
  }
  const reply = body as { cells?: unknown; count?: unknown; firmware?: unknown };

  if (!Array.isArray(reply.cells) || !reply.cells.every((c) => Number.isInteger(c))) {
    throw new TransportError('the pod did not report its cell addresses');
  }
  const cells = reply.cells as number[];

  if (typeof reply.count === 'number' && reply.count !== cells.length) {
    throw new TransportError(
      `the pod reported ${reply.count} cells but listed ${cells.length} addresses`,
      'Check the I2C wiring and the address jumpers, then reconnect.',
    );
  }
  if (cells.length === 0) {
    throw new TransportError(
      'the pod found no muscle cells on its I2C bus',
      'Check 5V, GND, SDA and SCL on the pogo chain, and the address jumpers (0x20–0x27).',
    );
  }

  return {
    pod: podFromReport(podIndex, label, cells),
    firmware: typeof reply.firmware === 'string' ? reply.firmware : undefined,
  };
}
