// =====================================================================
// Braillix — drive the real cell from the simulator, over Web Serial.
//
// The USB cable is already there for flashing, so we use it. No WiFi, no IP
// address to find, no router that the lab might not let us onto — which is
// exactly what you want five minutes before a demo.
//
// The browser stays the single source of truth for encoding. It sends a cam
// STATE (0-63) with "!s N"; the firmware just moves there. That matters because
// the simulator knows about capital and number indicator cells and the firmware's
// a-z table does not — sending letters would silently drop them.
//
// Chrome and Edge only, and only from https:// or localhost. Both true for us.
// =====================================================================

const BAUD = 115200;           // matches Serial.begin() in braille_cell.ino
const PROMPT = '>';            // the firmware prints "> " when it is ready again
const MOVE_TIMEOUT = 6000;     // a full 360deg at vmax 1000 is about 4s
const BOOT_TIMEOUT = 12000;    // open() resets the ESP32; setup() homes first

export const supported = () => 'serial' in navigator;

export class Cell {
  constructor(onLog, onState) {
    this.port = null;
    this.writer = null;
    this.onLog = onLog || (() => {});
    this.onState = onState || (() => {});
    this.queue = Promise.resolve();
    this.waiters = [];
    this.rxBuffer = '';
  }

  get connected() { return !!this.port; }

  async connect() {
    if (!supported())
      throw new Error('This browser has no Web Serial. Use Chrome or Edge.');
    // must be called from a user gesture — the click handler, not a timer
    this.port = await navigator.serial.requestPort();
    try {
      await this.port.open({ baudRate: BAUD });
    } catch (e) {
      this.port = null;
      // By far the most common failure: the Arduino Serial Monitor still has the
      // port. Windows hands a COM port to exactly one process.
      if (/open|access|busy|failed/i.test(e.message))
        throw new Error('Port is busy — close the Arduino Serial Monitor, then retry.');
      throw e;
    }
    this.writer = this.port.writable.getWriter();
    this._readLoop();
    this.onState('connected');
    this.onLog('connected at ' + BAUD + ' baud');
    // Opening the port toggles DTR/RTS, which RESETS the ESP32. It then runs
    // tryHome() — up to a full revolution, several seconds — before printing its
    // first prompt. Sending during that window looks like a dead connection, so
    // wait for the prompt rather than guessing with a fixed delay.
    await this.waitForPrompt(BOOT_TIMEOUT);
    return true;
  }

  async disconnect() {
    try {
      this.reading = false;
      if (this.writer) { this.writer.releaseLock(); this.writer = null; }
      if (this.reader) { await this.reader.cancel().catch(() => {}); }
      if (this.port) await this.port.close();
    } finally {
      this.port = null;
      this.onState('disconnected');
      this.onLog('disconnected');
    }
  }

  async _readLoop() {
    this.reading = true;
    const dec = new TextDecoder();
    while (this.port && this.port.readable && this.reading) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          const text = dec.decode(value, { stream: true });
          this.rxBuffer += text;
          // surface complete lines, keep the tail (the bare "> " prompt has no \n)
          const lines = this.rxBuffer.split('\n');
          this.rxBuffer = lines.pop();
          lines.forEach(l => l.trim() && this.onLog(l.trim()));
          if (this.rxBuffer.includes(PROMPT)) {
            this.rxBuffer = '';
            const w = this.waiters.shift();
            if (w) w.resolve();
          }
        }
      } catch (e) {
        this.onLog('read error: ' + e.message);
      } finally {
        this.reader.releaseLock();
      }
    }
  }

  // Serialised: each command waits for the firmware's prompt before the next is
  // sent. showState() blocks while the motor runs, so the prompt IS the "arrived"
  // signal — which is what keeps the animation and the real cam in step.
  send(line) {
    if (!this.connected) return Promise.resolve();
    this.queue = this.queue.then(() => new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w.resolve !== done);
        this.onLog('timeout waiting for the cell — carrying on');
        resolve();
      }, MOVE_TIMEOUT);
      this.waiters.push({ resolve: done });
      this.writer.write(new TextEncoder().encode(line + '\n'))
        .catch(e => { this.onLog('write failed: ' + e.message); done(); });
    }));
    return this.queue;
  }

  // Resolves on the firmware's next prompt, or after `ms` — used to sit out the
  // reset-and-home that follows opening the port.
  waitForPrompt(ms) {
    return new Promise(resolve => {
      const done = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w.resolve !== done);
        this.onLog('no prompt after ' + ms + 'ms — is the sketch flashed?');
        resolve();
      }, ms);
      this.waiters.push({ resolve: done });
    });
  }

  goToState(state) { return this.send('!s ' + state); }
  home()           { return this.send('!home'); }
  setSpeed(v, a)   { return this.send(`!speed ${v} ${a}`); }
}

// =====================================================================
// Same interface as Cell, over WiFi instead of USB.
//
// The ESP32 runs its own access point, so there is no router and no lab network
// to be let onto. Each handler on the board blocks until the motor has arrived,
// so the HTTP response IS the "done" signal — exactly what the serial prompt
// gave us. app.js never has to know which transport it is holding.
//
// One hard limit: a page served over https CANNOT call a plain-http board
// (mixed content). So this works from localhost, not from GitHub Pages.
// =====================================================================
export const AP_DEFAULT = '192.168.4.1';

export class WifiCell {
  constructor(onLog, onState, host) {
    this.host = (host || AP_DEFAULT).replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.onLog = onLog || (() => {});
    this.onState = onState || (() => {});
    this.queue = Promise.resolve();
    this.ok = false;
  }

  get connected() { return this.ok; }
  url(path) { return `http://${this.host}${path}`; }

  async connect() {
    if (isSecureContext && location.protocol === 'https:')
      throw new Error('An https page cannot reach a plain-http board. Run from localhost.');
    const r = await this._fetch('/ping', 4000);
    this.ok = true;
    this.onState('connected');
    this.onLog('wifi cell at ' + this.host + ' — ' + r);
    return true;
  }

  async disconnect() {
    this.ok = false;
    this.onState('disconnected');
  }

  async _fetch(path, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms || MOVE_TIMEOUT);
    try {
      const res = await fetch(this.url(path), { signal: ac.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('board replied ' + res.status);
      return (await res.text()).trim();
    } catch (e) {
      if (e.name === 'AbortError')
        throw new Error('no reply from ' + this.host + ' — joined the Braillix-Cell network?');
      throw new Error('cannot reach ' + this.host + ' — joined the Braillix-Cell network?');
    } finally {
      clearTimeout(t);
    }
  }

  // serialised like the serial transport: one move in flight at a time
  send(path) {
    if (!this.ok) return Promise.resolve();
    this.queue = this.queue
      .then(() => this._fetch(path))
      .catch(e => { this.onLog(e.message); });
    return this.queue;
  }

  goToState(state) { return this.send('/s?v=' + state); }
  home()           { return this.send('/home'); }
  setSpeed(v, a)   { return this.send(`/speed?v=${v}&a=${a}`); }
}
