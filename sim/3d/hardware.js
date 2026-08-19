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
    await this.port.open({ baudRate: BAUD });
    this.writer = this.port.writable.getWriter();
    this._readLoop();
    this.onState('connected');
    this.onLog('connected at ' + BAUD + ' baud');
    // the sketch prints its banner on boot; give it a moment before driving it
    await new Promise(r => setTimeout(r, 400));
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

  goToState(state) { return this.send('!s ' + state); }
  home()           { return this.send('!home'); }
  setSpeed(v, a)   { return this.send(`!speed ${v} ${a}`); }
}
