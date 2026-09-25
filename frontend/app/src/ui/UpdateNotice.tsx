/**
 * "There is a newer Braillix, and you are not using it."
 *
 * The offline copy is the reason this app survives a school's Wi-Fi, and it is also the reason a
 * fix can fail to arrive. A service worker serves the page it already has; a new one installs
 * quietly in the background and takes over — but the page on screen was already built from the old
 * files. So the visit *after* a release still shows the old app, and nothing on screen says so.
 *
 * That was true here until it was found by deploying and looking: the live site served yesterday's
 * build to a returning browser, and every one of that day's fixes was invisible. A teacher would
 * have had no way to know, and no words for it if they suspected.
 *
 * So the update announces itself. Not by reloading — somebody may be half way through typing a
 * question, and a page that reloads itself under a teacher's hands is worse than a stale one. A
 * line at the top of the screen, and a button. Their choice, their moment.
 */

import { useEffect, useState } from 'react';
import { useT } from './i18n';
import './UpdateNotice.css';

export function UpdateNotice() {
  const t = useT();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    const watch = (registration: ServiceWorkerRegistration) => {
      const check = (worker: ServiceWorker | null) => {
        if (!worker) return;
        const announce = () => {
          // `controller` is null on the very first visit, when there is nothing to be newer than —
          // an install is not an update, and saying so would be nonsense on a first run.
          if (!cancelled && worker.state === 'installed' && navigator.serviceWorker.controller) setReady(true);
        };
        announce();
        worker.addEventListener('statechange', announce);
      };
      check(registration.waiting);
      check(registration.installing);
      registration.addEventListener('updatefound', () => check(registration.installing));
    };

    // `ready`, not `getRegistration()`. On a first visit this component mounts before the worker
    // has finished registering, and `getRegistration()` resolves with nothing — so the watcher was
    // never attached and the first update of that session went unannounced. `ready` waits for a
    // worker to be active, which is exactly the moment there is a version to be newer than.
    void navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;
      watch(registration);
      // Ask now rather than waiting for the browser's own schedule, which can be a day.
      void registration.update().catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="update" role="status">
      <p className="update__text">{t('update.ready')}</p>
      <button type="button" className="update__btn" data-testid="update-reload" onClick={() => window.location.reload()}>
        {t('update.reload')}
      </button>
    </div>
  );
}
