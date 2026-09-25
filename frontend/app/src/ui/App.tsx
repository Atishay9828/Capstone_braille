/**
 * The hall — one blackboard, edge to edge.
 *
 * v4 lesson: capability that has to be found is the same as capability that isn't there. So
 * there are no sections. The screen is the board (the lesson, as chalk), the cells (the
 * child's eyes), and the tray (the chalk). Everything a teacher does in a class happens on
 * this one surface; the device workshop and the help sit behind the two small doors in the
 * top rail, because they are visited once, not taught from.
 */

import { useEffect } from 'react';
import { useBraillix } from '../store';
import { useDraft } from '../draft';
import { APP_NAME } from '../config';
import { StatusStrip } from './StatusStrip';
import { UpdateNotice } from './UpdateNotice';
import { Blackboard } from './Blackboard';
import { ChalkTray } from './ChalkTray';
import { CellsStrip } from './CellsStrip';
import { Drawer } from './Drawer';
import { LanguageSwitch } from './LanguageSwitch';
import { useT } from './i18n';
import './ReadScreen.css'; /* shared field/notice/heading styles used by the drawer screens */

export function App() {
  const t = useT();
  const view = useBraillix((s) => s.view);
  const setView = useBraillix((s) => s.setView);
  const writing = useDraft((s) => s.writing);
  const bootstrap = useBraillix((s) => s.bootstrap);
  const announcement = useBraillix((s) => s.announcement);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /*
   * PageUp/PageDown read the board from anywhere — the keyboard twin of the pod's Prev/Next
   * buttons. Deliberately NOT the arrow keys, which belong to the caret and the reader.
   */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
      event.preventDefault();
      useBraillix.getState().page(event.key === 'PageUp' ? -1 : 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="hall">
      <a className="skip-link" href="#main">
        {t('app.skip')}
      </a>

      {/* Above everything: a stale app is a wrong app. */}
      <UpdateNotice />

      <header className="rail-top">
        <div className="rail-top__brand">
          {/* The mark is a braille cell showing ⠭ — the letter x. A two-column grid fills
              row-wise, so the order here is dot 1, 4, 2, 5, 3, 6, not 1..6. */}
          <span className="rail-top__mark" aria-hidden="true">
            <span className="rail-top__dot is-on" />
            <span className="rail-top__dot is-on" />
            <span className="rail-top__dot" />
            <span className="rail-top__dot" />
            <span className="rail-top__dot is-on" />
            <span className="rail-top__dot is-on" />
          </span>
          <strong className="rail-top__name">{APP_NAME}</strong>
        </div>

        <nav className="rail-top__doors" aria-label={t('app.sections')}>
          <button
            type="button"
            className={`door${view === 'device' ? ' is-open' : ''}`}
            data-testid="nav-device"
            aria-pressed={view === 'device'}
            onClick={() => setView('device')}
          >
            {t('nav.device')}
          </button>
          <button
            type="button"
            className={`door${view === 'help' ? ' is-open' : ''}`}
            data-testid="nav-help"
            aria-pressed={view === 'help'}
            onClick={() => setView('help')}
          >
            {t('nav.help')}
          </button>
          <LanguageSwitch />
        </nav>
      </header>

      {view === 'board' ? (
        <main id="main" className="hall__board">
          {/* The board needs no visible title — it looks like what it is. The heading exists
              for the document outline a screen reader navigates by. */}
          <h1 className="visually-hidden">{t('board.h1')}</h1>
          {/* Writing mode restructures this region by LAYOUT, not by content: the recent lines
              become a slim scrolling band and the ink surface takes everything else, so opening
              the pencil moves nothing below it and nothing after it (v5.1: "unstable na hon"). */}
          <div className={`hall__lines${writing ? ' is-writing' : ''}`}>
            <Blackboard />
          </div>
          <CellsStrip />
          <ChalkTray />
        </main>
      ) : (
        <Drawer view={view} onClose={() => setView('board')} />
      )}

      <StatusStrip />

      <p className="visually-hidden" aria-live="polite" data-testid="live-region">
        {announcement}
      </p>
    </div>
  );
}
