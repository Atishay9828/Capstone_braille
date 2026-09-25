/**
 * Registering the service worker — the one line that makes Braillix survive a school's Wi-Fi.
 *
 * Only in a production build: in development a service worker caches the very files you are trying
 * to change, and the hour you lose finding that out is an hour nobody should lose twice.
 *
 * Registration failing is not an error worth stopping for. It means this browser will not keep a
 * copy — the app still works exactly as it does now, it just needs the files each time. That is a
 * degradation, so it is reported through the same channel as every other one rather than swallowed.
 */

export type InstallState = 'ready' | 'unsupported' | 'failed' | 'dev';

export async function registerServiceWorker(): Promise<{ state: InstallState; reason?: string }> {
  if (import.meta.env.DEV) return { state: 'dev', reason: 'not used while developing' };
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { state: 'unsupported', reason: 'this browser cannot keep an offline copy' };
  }
  try {
    // Relative, because Braillix is built with a relative base and may live in a subfolder.
    const url = new URL('sw.js', document.baseURI).href;
    await navigator.serviceWorker.register(url, { scope: './' });
    return { state: 'ready' };
  } catch (error) {
    return { state: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}
