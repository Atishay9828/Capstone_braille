import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { useBraillix } from './store';
import { registerServiceWorker } from './ui/install';
import './ui/fonts.css';
import './ui/tokens.css';
import './ui/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Braillix could not find its mount point (#root).');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * A deliberate diagnostics handle.
 *
 * Braillix has a class of bug that is invisible in unit tests and only appears in a real browser —
 * speech-rule-engine returns different shapes under Node and the DOM, and the whole Reader depends
 * on what it returns. So the store is reachable from the console and from the e2e suite:
 *
 *   __braillix.getState().translation.enriched
 *
 * It exposes no secrets (there are none) and writes nothing. It is here because being able to see
 * the engine's real output on the machine that is misbehaving is worth more than the tidiness of
 * an empty global namespace.
 */
(window as unknown as Record<string, unknown>).__braillix = useBraillix;

/**
 * Keep a copy of Braillix on this machine, so it opens with the network off.
 *
 * A school's Wi-Fi is not a dependency this product is allowed to have. Once the page has been
 * opened once, the service worker holds the app and the Nemeth tables, and the browser offers to
 * install it like any other program.
 */
void registerServiceWorker().then((result) => {
  if (result.state === 'failed' || result.state === 'unsupported') {
    useBraillix.getState().setCapability('offline', {
      state: 'degraded',
      reason: result.reason ?? 'no offline copy',
      fix: 'Braillix still works. It will need these files again each time it is opened.',
    });
  } else if (result.state === 'ready') {
    useBraillix.getState().setCapability('offline', { state: 'ready', reason: 'a copy is kept on this machine' });
  }
});
