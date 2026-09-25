/**
 * The workshop door — Device and Help, off the board.
 *
 * These are visited once (setting up the hardware) or rarely (help, the syllabus proof), so
 * they open over the hall as a full sheet with one obvious way back to the board. The board
 * unmounts underneath — its state lives entirely in the stores, so closing the drawer puts
 * the class back exactly where it was.
 */

import { useEffect, useRef } from 'react';
import type { ViewId } from '../store';
import { DeviceScreen } from './DeviceScreen';
import { HelpScreen } from './HelpScreen';
import { useT } from './i18n';
import './Drawer.css';

export function Drawer({ view, onClose }: { view: Exclude<ViewId, 'board'>; onClose: () => void }) {
  const t = useT();
  const closeButton = useRef<HTMLButtonElement>(null);

  // The way in focuses the way out: keyboard users land on "back to the board" and Escape
  // means what it always means.
  useEffect(() => {
    closeButton.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <main id="main" className="drawer" aria-label={view === 'device' ? t('nav.device') : t('nav.help')}>
      <div className="drawer__bar">
        <button type="button" ref={closeButton} className="drawer__back" data-testid="nav-board" onClick={onClose}>
          ← {t('drawer.back')}
        </button>
        <span className="drawer__title">{view === 'device' ? t('nav.device') : t('nav.help')}</span>
      </div>
      <div className="drawer__body">{view === 'device' ? <DeviceScreen /> : <HelpScreen />}</div>
    </main>
  );
}
