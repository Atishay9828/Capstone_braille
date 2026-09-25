/**
 * Protocol conformance.
 *
 * This is the test that answers the owner's second-biggest fear — "an integration that half-works
 * and creates problems for the product later". It runs the REAL Wi-Fi transport against a pod that
 * speaks the REAL wire protocol, with nothing plugged in and no ESP32 in the building.
 *
 * If this passes, the seam is proven today. What is left for demo day is a cable, not a design.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { HttpPodTransport } from './httppod';
import { SimTransport, estimateMoveMs } from './sim';
import { TransportError } from './types';
import { planRefresh } from '../core/scheduler';
import {
  assertValidFrame,
  decodeButtonEvent,
  decodeLine,
  encodeShow,
  LineBuffer,
  type Notification,
} from './codec';

const POD_SCRIPT = join(import.meta.dirname, '..', '..', '..', 'tools', 'virtual-pod', 'virtual-pod.mjs');

/** Start a virtual pod and wait until it is actually answering. */
async function startPod(port: number, cells: number, podIndex = 0): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    [POD_SCRIPT, '--cells', String(cells), '--port', String(port), '--pod', String(podIndex), '--quiet'],
    { stdio: 'ignore' },
  );

  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/chain`);
      if (response.ok) return child;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`virtual pod on :${port} did not start`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

const PORT_A = 8231;
const PORT_B = 8232;
let podA: ChildProcess;
let podB: ChildProcess;

beforeAll(async () => {
  podA = await startPod(PORT_A, 4, 0);
  podB = await startPod(PORT_B, 3, 1);
}, 40_000);

afterAll(() => {
  podA?.kill();
  podB?.kill();
});

describe('the wire format', () => {
  it('sends a full frame when the display state is unknown', () => {
    const command = encodeShow(planRefresh(null, [1, 2, 3, 4]));
    expect(command).toHaveProperty('positions');
  });

  it('sends only what changed on a wide display', () => {
    const previous = new Array(40).fill(0);
    const target = [...previous];
    target[7] = 19;
    const command = encodeShow(planRefresh(previous, target));
    expect(command).toHaveProperty('updates');
    expect((command as { updates: unknown[] }).updates).toEqual([{ cell: 7, position: 19 }]);
  });

  it('does not bother being sparse when the display is small', () => {
    // Two cells: an "updates" list is bigger than just sending both positions.
    const command = encodeShow(planRefresh([0, 0], [0, 19]));
    expect(command).toHaveProperty('positions');
  });

  it('refuses a frame of the wrong length rather than truncating it', () => {
    expect(() => assertValidFrame([1, 2], 4)).toThrow(/expected 4 positions/);
    expect(() => assertValidFrame([1, 2, 3, 99], 4)).toThrow(/outside 0\.\.63/);
  });

  it('tells a reply apart from a notification', () => {
    expect(decodeLine('{"ok":true,"cmd":"chain"}')?.kind).toBe('reply');
    expect(decodeLine('{"event":"button","button":"next","seq":3}')?.kind).toBe('event');
    expect(decodeLine('rst:0x1 (POWERON_RESET),boot:0x13')).toBeNull(); // ESP32 boot chatter
    expect(decodeLine('')).toBeNull();
  });

  it('reads a button press, including a long one', () => {
    const incoming = decodeLine('{"event":"button","button":"select","long":true,"seq":7}');
    expect(incoming?.kind).toBe('event');
    const event = decodeButtonEvent((incoming as unknown as { event: Notification }).event);
    expect(event).toEqual({ button: 'select', long: true, seq: 7 });
  });

  it('ignores an event that is not a button', () => {
    const incoming = decodeLine('{"event":"ready","firmware":"braillix-pod/1.0"}');
    expect(decodeButtonEvent((incoming as unknown as { event: Notification }).event)).toBeNull();
  });

  it('reassembles JSON that arrives split across serial chunks', () => {
    // Serial data arrives in whatever chunks the OS felt like; a message cut in half is normal.
    const buffer = new LineBuffer();
    expect(buffer.push('{"ok":true,"cmd":')).toEqual([]);
    expect(buffer.push('"chain"}\n{"ok":true}')).toEqual(['{"ok":true,"cmd":"chain"}']);
    expect(buffer.flush()).toEqual(['{"ok":true}']);
  });
});

describe('a real pod over Wi-Fi', () => {
  it('discovers the chain instead of assuming it', async () => {
    const transport = new HttpPodTransport({ hosts: [`127.0.0.1:${PORT_A}`], pollButtons: false });
    const chain = await transport.connect();

    expect(chain.cellCount).toBe(4);
    expect(chain.pods[0].cellAddrs).toEqual([0x20, 0x21, 0x22, 0x23]);
    expect(chain.firmware).toContain('braillix');
    expect(transport.status).toBe('connected');
    await transport.disconnect();
  });

  it('shows a frame and reports what actually moved', async () => {
    const transport = new HttpPodTransport({ hosts: [`127.0.0.1:${PORT_A}`], pollButtons: false });
    await transport.connect();
    await transport.home();

    const first = await transport.apply(planRefresh(null, [19, 5, 12, 60]));
    expect(first.moved).toBe(4);

    // Only one cell differs — the pod should move one motor, not four.
    const second = await transport.apply(planRefresh([19, 5, 12, 60], [19, 5, 63, 60]));
    expect(second.moved).toBe(1);
    expect(second.skipped).toBe(3);

    await transport.disconnect();
  });

  it('is refused when it sends the wrong number of cells', async () => {
    const transport = new HttpPodTransport({ hosts: [`127.0.0.1:${PORT_A}`], pollButtons: false });
    await transport.connect();
    await expect(transport.apply(planRefresh(null, [1, 2]))).rejects.toThrow(TransportError);
    await transport.disconnect();
  });

  it('homes every cell', async () => {
    const transport = new HttpPodTransport({ hosts: [`127.0.0.1:${PORT_A}`], pollButtons: false });
    await transport.connect();
    await transport.apply(planRefresh(null, [19, 5, 12, 60]));
    await transport.home();
    // After homing the display is at 0, so a frame of zeros should move nothing.
    const result = await transport.apply(planRefresh([0, 0, 0, 0], [0, 0, 0, 0]));
    expect(result.moved).toBe(0);
    await transport.disconnect();
  });

  it('reports a pod that is not there, with something the user can do about it', async () => {
    const transport = new HttpPodTransport({ hosts: ['127.0.0.1:8999'], pollButtons: false });
    await expect(transport.connect()).rejects.toThrow(TransportError);
    expect(transport.status).toBe('error');
    try {
      await transport.connect();
    } catch (err) {
      expect((err as TransportError).fix).toBeTruthy();
    }
  });

  it('refuses to do anything before it is connected', async () => {
    const transport = new HttpPodTransport({ hosts: [`127.0.0.1:${PORT_A}`], pollButtons: false });
    await expect(transport.apply(planRefresh(null, [1, 2, 3, 4]))).rejects.toThrow(/not connected/);
  });

  it('picks up a button press through the seq counter', async () => {
    const transport = new HttpPodTransport({ hosts: [`127.0.0.1:${PORT_A}`], pollButtons: true });
    await transport.connect();

    const seen: string[] = [];
    const stop = transport.onButton((event) => seen.push(event.button));

    await new Promise((r) => setTimeout(r, 250)); // let one poll establish the baseline
    await fetch(`http://127.0.0.1:${PORT_A}/press?button=next`);
    await new Promise((r) => setTimeout(r, 500));

    stop();
    await transport.disconnect();
    expect(seen).toContain('next');
  });
});

describe('several pods', () => {
  it('sums the cells across pods and gives each one its own slice', async () => {
    const transport = new HttpPodTransport({
      hosts: [`127.0.0.1:${PORT_A}`, `127.0.0.1:${PORT_B}`],
      pollButtons: false,
    });
    const chain = await transport.connect();

    expect(chain.pods).toHaveLength(2);
    expect(chain.cellCount).toBe(7); // 4 + 3, discovered, not assumed

    // Seven cells across two pods: pod 0 gets the first four, pod 1 the last three.
    const result = await transport.apply(planRefresh(null, [1, 2, 3, 4, 5, 6, 7]));
    expect(result.moved).toBe(7);
    await transport.disconnect();
  });

  /*
   * Mirror mode is the classroom: one expression, a display in front of every child.
   *
   * The number that matters is the width. Chained, two pods of 4 and 3 make a 7-cell display.
   * Mirrored they make a THREE-cell one — the smallest pod — because a frame the small display
   * cannot show would leave one child reading a truncated equation and no way to know.
   */
  it('mirrors one frame onto every pod, at the width of the smallest', async () => {
    const transport = new HttpPodTransport({
      hosts: [`127.0.0.1:${PORT_A}`, `127.0.0.1:${PORT_B}`],
      pollButtons: false,
      mode: 'mirror',
    });
    const chain = await transport.connect();

    expect(chain.pods).toHaveLength(2);
    expect(chain.cellCount, 'the smallest pod decides the width').toBe(3);
    expect(transport.label).toContain('showing the same');

    const result = await transport.apply(planRefresh(null, [11, 22, 33]));
    // At least the three mirrored cells on each pod. Not an exact count: the wider pod may also
    // have had to blank a cell left over from whatever it was showing before.
    expect(result.moved).toBeGreaterThanOrEqual(6);

    // What the PODS say they are showing — not what we believe we sent. A pod that agreed with us
    // by construction would prove nothing.
    for (const port of [PORT_A, PORT_B]) {
      const state = (await (await fetch(`http://127.0.0.1:${port}/state`)).json()) as { positions: number[] };
      expect(state.positions.slice(0, 3), `pod on :${port}`).toEqual([11, 22, 33]);
    }
    // The wider pod's spare cell is blank, not a leftover from the last frame.
    const wide = (await (await fetch(`http://127.0.0.1:${PORT_A}/state`)).json()) as { positions: number[] };
    expect(wide.positions[3], 'a spare cell must be blanked, never left showing yesterday').toBe(0);
    await transport.disconnect();
  });

  it('refuses a frame that is the wrong width for a mirrored display', async () => {
    const transport = new HttpPodTransport({
      hosts: [`127.0.0.1:${PORT_A}`, `127.0.0.1:${PORT_B}`],
      pollButtons: false,
      mode: 'mirror',
    });
    await transport.connect();
    // Seven cells is right for the chain and wrong for the mirror: it must be refused, not truncated.
    await expect(transport.apply(planRefresh(null, [1, 2, 3, 4, 5, 6, 7]))).rejects.toThrow(TransportError);
    await transport.disconnect();
  });
});

describe('the simulator obeys the same contract', () => {
  it('discovers a chain like a real pod does', async () => {
    const transport = new SimTransport(4);
    const chain = await transport.connect();
    expect(chain.cellCount).toBe(4);
    expect(chain.pods[0].cellAddrs).toEqual([0x20, 0x21, 0x22, 0x23]);
  });

  it('refuses a frame of the wrong size, exactly as hardware would', async () => {
    const transport = new SimTransport(4);
    await transport.connect();
    await expect(transport.apply(planRefresh(null, [1, 2]))).rejects.toThrow(TransportError);
    await expect(transport.apply(planRefresh(null, [1, 2, 3, 99]))).rejects.toThrow(/outside/);
  });

  it('remembers what it is showing, and homes back to blank', async () => {
    const transport = new SimTransport(3);
    await transport.connect();
    await transport.apply(planRefresh(null, [19, 5, 12]));
    expect(transport.positions).toEqual([19, 5, 12]);
    await transport.home();
    expect(transport.positions).toEqual([0, 0, 0]);
  });

  it('resizes when the user changes the simulated cell count', async () => {
    const transport = new SimTransport(1);
    await transport.connect();
    expect(transport.resize(6).cellCount).toBe(6);
    await transport.apply(planRefresh(null, [1, 2, 3, 4, 5, 6]));
    expect(transport.positions).toHaveLength(6);
  });

  it('estimates real motor time, so the simulation is not silently instant', () => {
    // 30 cam positions x 64 half-steps at ~900 half-steps/s is well over a second of real motion.
    const plan = planRefresh([0], [30]);
    expect(estimateMoveMs(plan)).toBeGreaterThan(1000);
    expect(estimateMoveMs(planRefresh([5], [5]))).toBe(0);
  });
});
