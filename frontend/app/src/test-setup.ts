/**
 * The two browser globals the unit tests genuinely need, and nothing else.
 *
 * Braillix runs its unit tests under Node rather than a DOM, deliberately: jsdom took fifty seconds
 * to load on this machine and linkedom fifteen, which is why `core/xml.ts` exists at all. But a
 * teacher's worksheets live in `localStorage`, and testing that they survive a reload is the whole
 * point of that code — so here is a `localStorage` that behaves like the real one, in about twenty
 * lines, with no environment to boot.
 *
 * It is a *storage* shim, not a DOM. Anything that needs a document still belongs in the Playwright
 * suite, where there is a real browser.
 */

class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string): string | null {
    return this.#entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#entries.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), writable: false });
}
