#!/usr/bin/env node
/**
 * The virtual pod — a brain pod that isn't there.
 *
 * It speaks the real wire protocol (docs/PROTOCOL.md): the same endpoints, the same replies, the
 * same refusals. Point Braillix at it and the Wi-Fi path is exercised end to end with no ESP32, no
 * router and no soldering.
 *
 * This exists because of the owner's second-biggest fear — an integration that half-works. An
 * emulator turns "will it work on Saturday?" into a test that runs today, and it is also the thing
 * the hardware team can check their firmware against.
 *
 *   node tools/virtual-pod/virtual-pod.mjs                # 4 cells on :8080
 *   node tools/virtual-pod/virtual-pod.mjs --cells 1      # the hardware that exists today
 *   node tools/virtual-pod/virtual-pod.mjs --cells 3 --port 8081 --pod 1
 *   node tools/virtual-pod/virtual-pod.mjs --flaky        # drops 1 request in 5, for testing nerve
 *
 * Zero dependencies: node:http only.
 */

import { createServer } from 'node:http';

const FIRMWARE = 'braillix-virtual-pod/1.0';
const CAM_POSITIONS = 64;
const HALF_STEPS_PER_POSITION = 4096 / CAM_POSITIONS; // 64, per the hardware handoff §5
const HALF_STEPS_PER_SECOND = 900;

/* ------------------------------------------------------------------ arguments */

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value === undefined || value.startsWith('--') ? true : value;
}

const CELL_COUNT = Number(arg('cells', 4));
const PORT = Number(arg('port', 8080));
const POD_INDEX = Number(arg('pod', 0));
const FLAKY = arg('flaky', false) === true;
const QUIET = arg('quiet', false) === true;

if (!Number.isInteger(CELL_COUNT) || CELL_COUNT < 1 || CELL_COUNT > 8) {
  console.error('--cells must be 1..8 (a brain pod addresses 0x20..0x27)');
  process.exit(1);
}

/* ------------------------------------------------------------------ pod state */

/** Muscle cells, as they would actually behave: they know where they are, and moving costs time. */
const cells = Array.from({ length: CELL_COUNT }, (_, i) => ({
  addr: 0x20 + i,
  position: 0,
  homed: false,
}));

const buttons = { prev: 0, select: 0, next: 0, seq: 0 };

const log = (...args) => {
  if (!QUIET) console.log(...args);
};

/** Shortest way round the cam circle — the same arithmetic the cell firmware does. */
function shortestArc(from, to) {
  const forward = ((to - from) % CAM_POSITIONS + CAM_POSITIONS) % CAM_POSITIONS;
  const backward = forward - CAM_POSITIONS;
  return forward <= -backward ? forward : backward;
}

function moveCell(index, position) {
  const cell = cells[index];
  if (cell.position === position) return { moved: false, halfSteps: 0 };
  const delta = shortestArc(cell.position, position);
  cell.position = position;
  return { moved: true, halfSteps: Math.abs(delta) * HALF_STEPS_PER_POSITION };
}

function applyPositions(positions) {
  if (!Array.isArray(positions) || positions.length !== CELL_COUNT) {
    return { error: `expected ${CELL_COUNT} positions, got ${Array.isArray(positions) ? positions.length : 'none'}` };
  }
  for (const position of positions) {
    if (!Number.isInteger(position) || position < 0 || position >= CAM_POSITIONS) {
      return { error: `cam position ${position} is outside 0..${CAM_POSITIONS - 1}` };
    }
  }

  let moved = 0;
  let worstHalfSteps = 0;
  positions.forEach((position, index) => {
    const result = moveCell(index, position);
    if (result.moved) moved += 1;
    worstHalfSteps = Math.max(worstHalfSteps, result.halfSteps);
  });

  return { moved, skipped: CELL_COUNT - moved, ms: Math.round((worstHalfSteps / HALF_STEPS_PER_SECOND) * 1000) };
}

function applyUpdates(updates) {
  if (!Array.isArray(updates)) return { error: 'updates must be an array' };

  for (const update of updates) {
    if (typeof update !== 'object' || update === null) return { error: 'each update must be an object' };
    const { cell, position } = update;
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) {
      return { error: `cell ${cell} does not exist on this pod (0..${CELL_COUNT - 1})` };
    }
    if (!Number.isInteger(position) || position < 0 || position >= CAM_POSITIONS) {
      return { error: `cam position ${position} is outside 0..${CAM_POSITIONS - 1}` };
    }
  }

  let moved = 0;
  let worstHalfSteps = 0;
  for (const { cell, position } of updates) {
    const result = moveCell(cell, position);
    if (result.moved) moved += 1;
    worstHalfSteps = Math.max(worstHalfSteps, result.halfSteps);
  }
  return { moved, skipped: CELL_COUNT - moved, ms: Math.round((worstHalfSteps / HALF_STEPS_PER_SECOND) * 1000) };
}

/** A crude but honest picture of the dock, so you can watch the emulator like a real display. */
function render() {
  const glyphs = cells.map((cell) => String.fromCodePoint(0x2800 + cell.position)).join(' ');
  const nums = cells.map((cell) => String(cell.position).padStart(2, '0')).join(' ');
  log(`   ${glyphs}\n   ${nums}`);
}

/* ------------------------------------------------------------------ the commands */

export function handleCommand(command) {
  switch (command?.cmd) {
    case 'ping':
      return { ok: true, cmd: 'ping', firmware: FIRMWARE };

    case 'chain':
      return {
        ok: true,
        cmd: 'chain',
        cells: cells.map((cell) => cell.addr),
        count: cells.length,
        pod: POD_INDEX,
        firmware: FIRMWARE,
      };

    case 'home':
      for (const cell of cells) {
        cell.position = 0;
        cell.homed = true;
      }
      log('-> home');
      render();
      return { ok: true, cmd: 'home', homed: cells.length };

    case 'show': {
      const result =
        command.positions !== undefined ? applyPositions(command.positions) : applyUpdates(command.updates);
      if (result.error) return { ok: false, cmd: 'show', error: result.error };
      log(`-> show (${result.moved} moved, ${result.skipped} already correct, ~${result.ms} ms of motor time)`);
      render();
      return { ok: true, cmd: 'show', moved: result.moved, skipped: result.skipped, ms: result.ms };
    }

    case 'layout': {
      if (command.this_pod_index !== POD_INDEX) {
        // Every pod gets the same layout packet; each acts only on its own slice (handoff §4B).
        return { ok: true, cmd: 'layout', ignored: true, pod: POD_INDEX };
      }
      const result = applyPositions(command.my_slice);
      if (result.error) return { ok: false, cmd: 'layout', error: result.error };
      log(`-> layout (pod ${POD_INDEX} of ${command.total_pods}, ${result.moved} moved)`);
      render();
      return { ok: true, cmd: 'layout', moved: result.moved, skipped: result.skipped };
    }

    case 'buttons':
      return { ok: true, cmd: 'buttons', ...buttons };

    default:
      return { ok: false, error: `unknown command ${JSON.stringify(command?.cmd ?? null)}` };
  }
}

/* ------------------------------------------------------------------ HTTP */

function readBody(request) {
  return new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });
}

function send(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    // The app is a page on localhost talking to a device on the LAN, so the pod must say yes.
    // The real firmware sends exactly these headers — see firmware/pod/pod.ino.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  response.end(payload);
}

let flakyCounter = 0;

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});

  if (FLAKY && ++flakyCounter % 5 === 0) {
    log('-> (flaky mode) dropping this request on purpose');
    response.destroy();
    return;
  }

  const url = new URL(request.url ?? '/', 'http://pod');
  const body = request.method === 'POST' ? await readBody(request) : {};
  if (body === null) return send(response, 400, { ok: false, error: 'body was not valid JSON' });

  switch (url.pathname) {
    case '/chain':
      return send(response, 200, handleCommand({ cmd: 'chain' }));
    case '/show': {
      const result = handleCommand({ cmd: 'show', ...body });
      return send(response, result.ok ? 200 : 400, result);
    }
    case '/layout': {
      const result = handleCommand({ cmd: 'layout', ...body });
      return send(response, result.ok ? 200 : 400, result);
    }
    case '/home':
      return send(response, 200, handleCommand({ cmd: 'home' }));
    case '/state':
      // Not part of the pod protocol either: it lets a test ask the POD what it is showing rather
      // than trusting the laptop's belief about it. A pod that agreed with us by construction would
      // prove nothing.
      return send(response, 200, {
        ok: true,
        pod: POD_INDEX,
        positions: cells.map((cell) => cell.position),
        homed: cells.every((cell) => cell.homed),
      });
    case '/buttons':
      return send(response, 200, { prev: buttons.prev, select: buttons.select, next: buttons.next, seq: buttons.seq });
    case '/press': {
      // Not part of the pod protocol — a convenience so a human (or a test) can press the pod's
      // buttons without owning a pod.
      const name = url.searchParams.get('button');
      if (!['prev', 'select', 'next'].includes(name)) {
        return send(response, 400, { ok: false, error: 'button must be prev, select or next' });
      }
      buttons.prev = buttons.select = buttons.next = 0;
      buttons[name] = 1;
      buttons.seq += 1;
      log(`-> button ${name} (seq ${buttons.seq})`);
      return send(response, 200, { ok: true, ...buttons });
    }
    case '/':
      return send(response, 200, {
        firmware: FIRMWARE,
        pod: POD_INDEX,
        cells: cells.length,
        endpoints: ['/chain', '/show', '/layout', '/home', '/buttons', '/state', '/press?button=next'],
      });
    default:
      return send(response, 404, { ok: false, error: `no endpoint ${url.pathname}` });
  }
});

/* ------------------------------------------------------------------ start */

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isMain) {
  server.listen(PORT, '127.0.0.1', () => {
    log(`Braillix virtual pod ${FIRMWARE}`);
    log(`  pod index   ${POD_INDEX}`);
    log(`  muscle cells ${CELL_COUNT} at I2C 0x${(0x20).toString(16)}..0x${(0x20 + CELL_COUNT - 1).toString(16)}`);
    log(`  listening   http://127.0.0.1:${PORT}`);
    if (FLAKY) log('  flaky mode  ON — one request in five is dropped on purpose');
    log('');
    log('  In Braillix: Hardware -> Wi-Fi pod -> ' + `127.0.0.1:${PORT}`);
    log(`  Press a button:  curl "http://127.0.0.1:${PORT}/press?button=next"`);
    log('');
    render();
  });

  const stop = () => {
    log('\nvirtual pod stopped');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

export { server, cells, CELL_COUNT, CAM_POSITIONS };
