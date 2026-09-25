/**
 * The child's eyes — the cells, never off the screen.
 *
 * Whatever the hardware situation, this strip is the truth about what a blind student is
 * receiving right now: the dots, which window of the line they are, and the way to walk the
 * line (the same walk the pod's own Prev/Select/Next buttons take). The primary mode of this
 * product is no hardware attached (D4.4) — so the strip is not a status readout, it IS the
 * display most classrooms will use.
 *
 * The structure reader (fold/unfold, the ⠿ doors) folds out of the strip on demand; the strip
 * itself stays one glance tall.
 */

import { useState } from 'react';
import { useBraillix } from '../store';
import { useLesson } from '../lesson';
import { SIMULATOR_MAX_CELLS, SIMULATOR_MIN_CELLS } from '../config';
import { FULL_CELL } from '../core/braille';
import { cellsToUnicode } from '../core/translate';
import { BrailleCell } from './BrailleCell';
import { ReaderPanel } from './ReaderPanel';
import { DisplayStrip } from './DisplayStrip';
import { useT } from './i18n';
import { describeWindow } from './window-label';
import './CellsStrip.css';

export function CellsStrip() {
  const t = useT();
  const profile = useBraillix((s) => s.profile);
  const frame = useBraillix((s) => s.frame);
  const windowStart = useBraillix((s) => s.windowStart);
  const page = useBraillix((s) => s.page);
  const activeCells = useBraillix((s) => s.activeCells);
  const foldedChildCells = useBraillix((s) => s.foldedChildCells);
  const enterFoldAt = useBraillix((s) => s.enterFoldAt);
  const mode = useBraillix((s) => s.mode);
  const settings = useBraillix((s) => s.settings);
  const updateSettings = useBraillix((s) => s.updateSettings);
  const sayCurrent = useBraillix((s) => s.sayCurrent);
  const lessonLines = useLesson((s) => s.lines);
  const lessonIndex = useLesson((s) => s.currentIndex);
  const [exploring, setExploring] = useState(false);
  const [showingEvidence, setShowingEvidence] = useState(false);

  const setCellCount = useBraillix((s) => s.setCellCount);
  const total = activeCells.length;
  const simulated = profile.source === 'simulated';

  // The arrows read the whole lesson: past a line's edge they continue into the neighbouring
  // line of the board — the same walk the pod's own buttons take.
  const canPrev = windowStart > 0 || (lessonIndex !== null && lessonIndex > 0);
  const canNext =
    windowStart + profile.cellCount < total ||
    (lessonIndex !== null && lessonIndex < lessonLines.length - 1);

  return (
    <section className="cells" aria-label={t('display.title')}>
      {/* The whole run in braille characters — the display's truth, for tests and tooling
          (the visual form of window.__braillix, D3.5). Hidden from eyes and screen readers:
          the spoken maths and the dots themselves are both better for a person. */}
      <span className="visually-hidden" aria-hidden="true" data-testid="braille-unicode">
        {cellsToUnicode(activeCells)}
      </span>
      <div className="cells__row">
        <button
          type="button"
          className="cells__page"
          data-testid="page-prev"
          aria-label={t('display.previous')}
          disabled={!canPrev}
          onClick={() => page(-1)}
        >
          ←
        </button>

        <div className="cells__dots" data-testid="cell-row">
          {frame.cells.map((dots, index) => {
            const runIndex = windowStart + index;
            const isFold = mode === 'explore' && dots === FULL_CELL && foldedChildCells.includes(runIndex);
            return (
              <span key={index} className={isFold ? 'cellwrap is-fold' : 'cellwrap'}>
                <BrailleCell
                  dots={dots}
                  cam={frame.cam[index]}
                  index={runIndex}
                  active={frame.cursorCell === index}
                  onClick={isFold ? () => enterFoldAt(runIndex) : undefined}
                />
                {isFold && (
                  <span className="cellwrap__tag" aria-hidden="true">
                    {t('display.stepIn')}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        <button
          type="button"
          className="cells__page"
          data-testid="page-next"
          aria-label={t('display.next')}
          disabled={!canNext}
          onClick={() => page(1)}
        >
          →
        </button>

        <div className="cells__side">
          <span className="cells__label num" data-testid="window-label">
            {describeWindow(t, frame)}
          </span>
          {simulated && (
            <label className="cells__count">
              <span className="cells__label">{t('display.cells')}</span>
              <input
                className="cells__range"
                type="range"
                min={SIMULATOR_MIN_CELLS}
                max={SIMULATOR_MAX_CELLS}
                value={profile.cellCount}
                name="cell-count"
                data-testid="cell-count"
                onChange={(event) => setCellCount(Number(event.target.value))}
              />
              <output className="cells__label num">{profile.cellCount}</output>
            </label>
          )}
          <div className="cells__controls">
            <button
              type="button"
              className={`cells__ctl${settings.speechOn ? ' is-on' : ''}`}
              aria-pressed={settings.speechOn}
              data-testid="speech-toggle"
              title={t('strip.speak')}
              onClick={() => {
                const next = !settings.speechOn;
                updateSettings({ speechOn: next });
                if (next) sayCurrent();
              }}
            >
              {t('strip.speak')}
            </button>
            <button
              type="button"
              className={`cells__ctl${exploring ? ' is-on' : ''}`}
              aria-expanded={exploring}
              data-testid="explore-toggle"
              title={t('strip.structure')}
              onClick={() => setExploring((current) => !current)}
            >
              {t('strip.structure')}
            </button>
            <button
              type="button"
              className={`cells__ctl${showingEvidence ? ' is-on' : ''}`}
              aria-expanded={showingEvidence}
              data-testid="evidence-toggle"
              title={t('strip.why')}
              onClick={() => setShowingEvidence((current) => !current)}
            >
              {t('strip.why')}
            </button>
          </div>
        </div>
      </div>

      {exploring && (
        <div className="cells__reader">
          <ReaderPanel />
        </div>
      )}

      {/* The evidence: every cell's dots, meaning and cam — nothing hidden behind pretty
          dots, but behind one press, because a lesson is not an inspection (v4 boardroom). */}
      {showingEvidence && (
        <div className="cells__reader">
          <DisplayStrip />
        </div>
      )}
    </section>
  );
}
