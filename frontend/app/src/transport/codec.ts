/**
 * The wire format, on its own.
 *
 * Encoding and decoding live here rather than inside a transport so that the *format* can be
 * tested without a serial port, an ESP32, or a network — and so that the USB and Wi-Fi transports
 * cannot quietly drift apart. docs/PROTOCOL.md is the specification; this file is its
 * implementation, and `codec.test.ts` is the proof they agree.
 */

import { PATTERN_COUNT } from '../core/braille';
import type { RefreshPlan } from '../core/scheduler';
import { TransportError, type ButtonEvent, type PodButton } from './types';

export const SERIAL_BAUD_RATE = 115_200;

export type Command =
  | { cmd: 'chain' }
  | { cmd: 'ping' }
  | { cmd: 'home' }
  | { cmd: 'show'; positions: number[] }
  | { cmd: 'show'; updates: { cell: number; position: number }[] }
  | {
      cmd: 'layout';
      total_pods: number;
      this_pod_index: number;
      cells_on_this_pod: number;
      full_text: string;
      my_slice: number[];
    };

/**
 * Turn a refresh plan into a `show` command.
 *
 * Sparse when it is genuinely cheaper — a display of forty cells where one changed should not send
 * forty numbers — and full whenever the display's state is not trustworthy, because a diff against
 * an unknown baseline is a guess.
 */
export function encodeShow(plan: RefreshPlan): Command {
  const sparseIsWorthIt = !plan.fullRefresh && plan.moves.length > 0 && plan.moves.length * 3 < plan.target.length;

  if (sparseIsWorthIt) {
    return { cmd: 'show', updates: plan.moves.map((move) => ({ cell: move.cell, position: move.to })) };
  }
  return { cmd: 'show', positions: [...plan.target] };
}

export function encodeLine(command: Command): string {
  return `${JSON.stringify(command)}\n`;
}

/** Validate a frame the way a pod must: wrong length or out-of-range is refused, never truncated. */
export function assertValidFrame(positions: readonly number[], cellCount: number): void {
  if (positions.length !== cellCount) {
    throw new TransportError(`expected ${cellCount} positions, got ${positions.length}`);
  }
  for (const position of positions) {
    if (!Number.isInteger(position) || position < 0 || position >= PATTERN_COUNT) {
      throw new TransportError(`cam position ${String(position)} is outside 0..${PATTERN_COUNT - 1}`);
    }
  }
}

export interface Reply {
  readonly ok: boolean;
  readonly cmd?: string;
  readonly error?: string;
  readonly [key: string]: unknown;
}

export interface Notification {
  readonly event: string;
  readonly [key: string]: unknown;
}

export type Incoming = { kind: 'reply'; reply: Reply } | { kind: 'event'; event: Notification };

const BUTTONS: readonly PodButton[] = ['prev', 'select', 'next'];

function isButton(value: unknown): value is PodButton {
  return typeof value === 'string' && (BUTTONS as readonly string[]).includes(value);
}

/**
 * Classify one line from the pod.
 *
 * Replies carry `ok`; notifications carry `event`. Keeping those disjoint is what lets a client
 * tell "the answer to my question" from "something just happened" without tracking state — which
 * matters because buttons can be pressed at any moment, including mid-command.
 */
export function decodeLine(line: string): Incoming | null {
  const text = line.trim();
  if (!text || text.startsWith('#')) return null; // blank lines and firmware boot chatter

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null; // not ours — ESP32s print all sorts of things at boot
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const message = parsed as Record<string, unknown>;
  if (typeof message.event === 'string') {
    return { kind: 'event', event: message as unknown as Notification };
  }
  if (typeof message.ok === 'boolean') {
    return { kind: 'reply', reply: message as unknown as Reply };
  }
  return null;
}

/** Extract a button press from a notification, or null if it is some other event. */
export function decodeButtonEvent(event: Notification): ButtonEvent | null {
  if (event.event !== 'button') return null;
  if (!isButton(event.button)) return null;
  return {
    button: event.button,
    long: event.long === true,
    seq: typeof event.seq === 'number' ? event.seq : 0,
  };
}

/**
 * Split a byte stream into whole lines.
 *
 * Serial data arrives in whatever chunks the OS felt like; a JSON message is regularly cut in
 * half. Buffering until a newline is the difference between a reliable link and one that "works
 * on my machine".
 */
export class LineBuffer {
  #buffer = '';

  push(chunk: string): string[] {
    this.#buffer += chunk;
    const lines = this.#buffer.split('\n');
    this.#buffer = lines.pop() ?? '';
    return lines;
  }

  /** Anything left over — used on disconnect so a final line is not lost. */
  flush(): string[] {
    const rest = this.#buffer;
    this.#buffer = '';
    return rest.trim() ? [rest] : [];
  }
}
