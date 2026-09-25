/**
 * A brain pod over USB, using the Web Serial API.
 *
 * This is the transport to demo on. It needs no network, no IP address, no router that happens to
 * be in a good mood — you plug the pod in and the browser asks which port. In a room where the
 * Wi-Fi may not cooperate, that difference is the whole ballgame.
 *
 * Chrome and Edge on desktop only. Where it is unavailable we say so plainly and the simulator and
 * Wi-Fi paths are unaffected (CLAUDE.md Law 3).
 */

import {
  LineBuffer,
  SERIAL_BAUD_RATE,
  decodeButtonEvent,
  decodeLine,
  encodeLine,
  encodeShow,
  type Command,
  type Reply,
} from './codec';
import type { RefreshPlan } from '../core/scheduler';
import {
  TransportBase,
  TransportError,
  parseChainReply,
  type ChainInfo,
  type ShowResult,
  type Transport,
} from './types';

const REPLY_TIMEOUT_MS = 4000;

/** Minimal shape of the Web Serial API — typed here so the app compiles where it does not exist. */
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}

interface SerialLike {
  requestPort(options?: unknown): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

function serialApi(): SerialLike | null {
  if (typeof navigator === 'undefined') return null;
  const candidate = (navigator as unknown as { serial?: SerialLike }).serial;
  return candidate ?? null;
}

export function webSerialSupported(): boolean {
  return serialApi() !== null;
}

export class WebSerialTransport extends TransportBase implements Transport {
  readonly kind = 'serial' as const;

  #port: SerialPortLike | null = null;
  #writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  #readerAbort: AbortController | null = null;
  #chain: ChainInfo | null = null;
  #pending: { resolve: (reply: Reply) => void; reject: (error: Error) => void; timer: number } | null = null;
  #portLabel = 'USB';

  get label(): string {
    return this.#portLabel;
  }

  async connect(): Promise<ChainInfo> {
    const serial = serialApi();
    if (!serial) {
      throw new TransportError(
        'this browser does not support Web Serial',
        'Use Chrome or Edge on a desktop, or connect the pod over Wi-Fi instead.',
      );
    }

    this.setStatus('connecting');
    try {
      // Must be triggered by a user gesture; the browser shows its own port picker.
      const port = await serial.requestPort();
      await port.open({ baudRate: SERIAL_BAUD_RATE });
      this.#port = port;

      const info = port.getInfo?.();
      this.#portLabel = info?.usbVendorId
        ? `USB device ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)}`
        : 'USB pod';

      if (!port.writable || !port.readable) {
        throw new TransportError('the serial port opened but has no data streams');
      }
      this.#writer = port.writable.getWriter();
      this.#startReading(port);

      const reply = await this.#send({ cmd: 'chain' });
      const { pod, firmware } = parseChainReply(reply, 0, this.#portLabel);
      this.#chain = { pods: [pod], cellCount: pod.cellAddrs.length, firmware };

      this.setStatus('connected');
      return this.#chain;
    } catch (err) {
      await this.#teardown();
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus('error', message);
      if (err instanceof TransportError) throw err;
      // The user closing the port picker is a choice, not a fault.
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new TransportError('no port was selected');
      }
      throw new TransportError(
        `could not open the serial port: ${message}`,
        'Close any other program using the port (Arduino Serial Monitor is the usual culprit) and try again.',
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.#teardown();
    this.setStatus('disconnected');
  }

  async apply(plan: RefreshPlan): Promise<ShowResult> {
    const chain = this.#requireChain();
    if (plan.target.length !== chain.cellCount) {
      throw new TransportError(`frame has ${plan.target.length} cells but the pod reports ${chain.cellCount}`);
    }
    const reply = await this.#send(encodeShow(plan));
    return {
      moved: typeof reply.moved === 'number' ? reply.moved : plan.cellsMoved,
      skipped: typeof reply.skipped === 'number' ? reply.skipped : 0,
    };
  }

  async home(): Promise<void> {
    this.#requireChain();
    await this.#send({ cmd: 'home' });
  }

  #requireChain(): ChainInfo {
    if (!this.#chain) throw new TransportError('not connected to a pod', 'Connect from the Hardware screen.');
    return this.#chain;
  }

  /** One command, one reply. Notifications (button presses) never satisfy a pending command. */
  #send(command: Command): Promise<Reply> {
    const writer = this.#writer;
    if (!writer) return Promise.reject(new TransportError('the serial port is not open'));
    if (this.#pending) return Promise.reject(new TransportError('a command is already in flight'));

    return new Promise<Reply>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.#pending = null;
        reject(
          new TransportError(
            `the pod did not answer "${command.cmd}" within ${REPLY_TIMEOUT_MS / 1000} s`,
            'Check that the pod is powered and running Braillix firmware, then reconnect.',
          ),
        );
      }, REPLY_TIMEOUT_MS);

      this.#pending = { resolve, reject, timer };
      void writer.write(new TextEncoder().encode(encodeLine(command))).catch((err: unknown) => {
        window.clearTimeout(timer);
        this.#pending = null;
        reject(new TransportError(`could not write to the pod: ${String(err)}`));
      });
    });
  }

  #startReading(port: SerialPortLike): void {
    const abort = new AbortController();
    this.#readerAbort = abort;

    void (async () => {
      const buffer = new LineBuffer();
      const decoder = new TextDecoder();
      const reader = port.readable!.getReader();

      abort.signal.addEventListener('abort', () => void reader.cancel().catch(() => {}));

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          for (const line of buffer.push(decoder.decode(value, { stream: true }))) {
            this.#handleLine(line);
          }
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          this.setStatus('error', err instanceof Error ? err.message : String(err));
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }

  #handleLine(line: string): void {
    const incoming = decodeLine(line);
    if (!incoming) return;

    if (incoming.kind === 'event') {
      const button = decodeButtonEvent(incoming.event);
      if (button) this.emitButton(button);
      return;
    }

    const pending = this.#pending;
    if (!pending) return; // an unsolicited reply; nothing is waiting for it
    window.clearTimeout(pending.timer);
    this.#pending = null;

    if (incoming.reply.ok) pending.resolve(incoming.reply);
    else pending.reject(new TransportError(incoming.reply.error ?? 'the pod rejected the command'));
  }

  async #teardown(): Promise<void> {
    if (this.#pending) {
      window.clearTimeout(this.#pending.timer);
      this.#pending.reject(new TransportError('the connection closed'));
      this.#pending = null;
    }
    this.#readerAbort?.abort();
    this.#readerAbort = null;

    try {
      await this.#writer?.close();
    } catch {
      /* the port may already be gone — nothing useful to do */
    }
    this.#writer = null;

    try {
      await this.#port?.close();
    } catch {
      /* likewise */
    }
    this.#port = null;
    this.#chain = null;
  }
}
