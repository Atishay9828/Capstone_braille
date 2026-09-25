/**
 * The Reader — Braillix's answer to "a whole equation through one cell is very difficult".
 *
 * Instead of streaming characters, you walk the expression's structure: left and right between
 * siblings, down into a sub-expression, up to its parent. Whatever you are standing on has its
 * children folded into single ⠿ cells, so a nineteen-cell quadratic formula becomes five cells
 * that say "something, over, something" — and you drill into the part you care about.
 *
 * The three keys map exactly onto the pod's three physical buttons (Prev / Select / Next), so
 * the same navigation works with the laptop closed.
 */

import { useEffect } from 'react';
import { useBraillix } from '../store';
import { useLang, useT } from './i18n';
import './ReaderPanel.css';

export function ReaderPanel() {
  const t = useT();
  const mode = useBraillix((s) => s.mode);
  const setMode = useBraillix((s) => s.setMode);
  const tree = useBraillix((s) => s.tree);
  const crumbs = useBraillix((s) => s.breadcrumb);
  const nodeLabel = useBraillix((s) => s.nodeLabel);
  const canGo = useBraillix((s) => s.canGo);
  const expanded = useBraillix((s) => s.expanded);
  const foldReason = useBraillix((s) => s.foldReason);
  const toggleExpanded = useBraillix((s) => s.toggleExpanded);
  const goSibling = useBraillix((s) => s.goSibling);
  const goChild = useBraillix((s) => s.goChild);
  const goParent = useBraillix((s) => s.goParent);
  const sayCurrent = useBraillix((s) => s.sayCurrent);
  const settings = useBraillix((s) => s.settings);
  const language = useLang();
  const updateSettings = useBraillix((s) => s.updateSettings);
  const speechCap = useBraillix((s) => s.capabilities.speech);
  const activeCells = useBraillix((s) => s.activeCells);
  const spokenText = useBraillix((s) => s.spokenText);
  const mixedLine = useBraillix((s) => s.mixedLine);

  // Keyboard navigation. Bound at the document so the reader never has to hunt for focus —
  // suppressed while typing, because the expression field needs its own arrow keys.
  useEffect(() => {
    if (mode !== 'explore') return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goSibling(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          goSibling(1);
          break;
        case 'ArrowDown':
        case 'Enter':
          event.preventDefault();
          goChild();
          break;
        case 'ArrowUp':
        case 'Escape':
          event.preventDefault();
          goParent();
          break;
        case ' ':
          event.preventDefault();
          sayCurrent();
          break;
        case 'e':
        case 'E':
          event.preventDefault();
          toggleExpanded();
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, goSibling, goChild, goParent, sayCurrent, toggleExpanded]);

  const structureUnavailable = tree === null;

  return (
    <section className="reader" aria-labelledby="reader-heading">
      <div className="reader__head">
        <h2 id="reader-heading" className="read__h2">
          {t('reader.title')}
        </h2>
        <div className="segmented" role="group" aria-label={t('reader.mode')}>
          <button
            type="button"
            className={`segmented__btn${mode === 'whole' ? ' is-current' : ''}`}
            aria-pressed={mode === 'whole'}
            onClick={() => setMode('whole')}
          >
            {t('reader.whole')}
          </button>
          <button
            type="button"
            className={`segmented__btn${mode === 'explore' ? ' is-current' : ''}`}
            aria-pressed={mode === 'explore'}
            disabled={structureUnavailable}
            data-testid="mode-explore"
            onClick={() => setMode('explore')}
          >
            {t('reader.explore')}
          </button>
        </div>
      </div>

      {mode === 'whole' ? (
        <p className="reader__blurb">{t('reader.wholeBlurb', { count: activeCells.length })}</p>
      ) : (
        <>
          <p className="reader__crumbs" data-testid="breadcrumb">
            {crumbs || '—'}
          </p>

          <p className="reader__blurb" data-testid="fold-state">
            {t('reader.youAreOn', { label: nodeLabel || t('reader.nothing') })}{' '}
            {expanded
              ? t('reader.showingFull')
              : foldReason
                ? t('reader.shownBecause', { reason: foldReason })
                : t('reader.folded')}
          </p>

          <div className="dpad" role="group" aria-label={t('reader.move')}>
            <button
              type="button"
              className="dpad__btn dpad__btn--up"
              disabled={!canGo.out}
              data-testid="go-out"
              onClick={goParent}
            >
              <span aria-hidden="true">↑</span>
              <span className="dpad__label">{t('reader.out')}</span>
            </button>
            <button
              type="button"
              className="dpad__btn dpad__btn--left"
              disabled={!canGo.left}
              data-testid="go-prev"
              onClick={() => goSibling(-1)}
            >
              <span aria-hidden="true">←</span>
              <span className="dpad__label">{t('reader.prev')}</span>
            </button>
            <button
              type="button"
              className="dpad__btn dpad__btn--mid"
              data-testid="say"
              onClick={sayCurrent}
              disabled={!settings.speechOn || speechCap.state === 'unavailable'}
            >
              <span aria-hidden="true">♪</span>
              <span className="dpad__label">{t('reader.say')}</span>
            </button>
            <button
              type="button"
              className="dpad__btn dpad__btn--right"
              disabled={!canGo.right}
              data-testid="go-next"
              onClick={() => goSibling(1)}
            >
              <span aria-hidden="true">→</span>
              <span className="dpad__label">{t('reader.next')}</span>
            </button>
            <button
              type="button"
              className="dpad__btn dpad__btn--down"
              disabled={!canGo.in}
              data-testid="go-in"
              onClick={goChild}
            >
              <span aria-hidden="true">↓</span>
              <span className="dpad__label">{t('reader.in')}</span>
            </button>
          </div>

          <div className="reader__row">
            <button type="button" className="btn" onClick={toggleExpanded} data-testid="toggle-expanded">
              {expanded ? t('reader.foldUp') : t('reader.showFull')}
            </button>
            <p className="reader__keys">
              <kbd>←</kbd> <kbd>→</kbd> {t('reader.keysMove')} · <kbd>↓</kbd> {t('reader.in')} ·{' '}
              <kbd>↑</kbd> {t('reader.out')} · <kbd>space</kbd> {t('reader.say')} · <kbd>E</kbd>{' '}
              {t('reader.keysExpand')}
            </p>
          </div>

          {spokenText && (
            <p className="reader__spoken" data-testid="spoken-text">
              <span className="reader__spokenlabel">{t('reader.spoken')}</span>
              <span lang={language}>{spokenText}</span>
            </p>
          )}

          <p className="reader__pod">{t('reader.pod')}</p>
        </>
      )}

      <div className="reader__speech">
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.speechOn}
            onChange={(event) => updateSettings({ speechOn: event.target.checked })}
          />
          <span>{t('reader.speakAsIRead')}</span>
        </label>


        <label className="switch">
          <span className="switch__label">{t('reader.rate')}</span>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={settings.speechRate}
            className="switch__range"
            onChange={(event) => updateSettings({ speechRate: Number(event.target.value) })}
          />
        </label>
      </div>

      {structureUnavailable && (
        <p className="notice notice--warn">{t(mixedLine ? 'reader.noStructureQuestion' : 'reader.noStructure')}</p>
      )}
    </section>
  );
}
