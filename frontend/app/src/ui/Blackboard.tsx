/**
 * The board — the product, filling the screen.
 *
 * The lesson stack IS the interface (v4 brief): every line the teacher has written stands here
 * in the order she wrote it, drawn as print maths, exactly as a blackboard accumulates a
 * lesson. The amber chalk stroke under one line is where the class is — what the cells are
 * showing and the speaker is saying. Tapping any line is the teacher pointing at the board:
 * it goes back under the child's fingers.
 *
 * Correction happens in the tray (one place maths is ever typed); this surface only hands the
 * line down. Ghost ink — the teacher's own handwriting, kept faintly behind a recognised
 * line — is drawn here when the line arrived by writing.
 */

import { useEffect, useRef } from 'react';
import { useLesson } from '../lesson';
import { useDraft } from '../draft';
import { useBraillix } from '../store';
import { ghostInkFor } from '../ink';
import { ChalkLine } from './ChalkLine';
import { InkStrip } from './InkStrip';
import { useT } from './i18n';
import './Blackboard.css';

export function Blackboard() {
  const t = useT();
  const lines = useLesson((s) => s.lines);
  const currentIndex = useLesson((s) => s.currentIndex);
  const selectLine = useLesson((s) => s.selectLine);
  const removeLine = useLesson((s) => s.removeLine);
  const clearLesson = useLesson((s) => s.clearLesson);
  const beginEdit = useDraft((s) => s.beginEdit);
  const writing = useDraft((s) => s.writing);
  const translating = useBraillix((s) => s.translating);
  const listRef = useRef<HTMLOListElement>(null);

  // The class is always looking where the chalk is: keep the current line in view as the
  // lesson grows past one screen, the way a teacher steps aside after writing. Scrolled by
  // hand rather than scrollIntoView, because Chromium moves the KEYBOARD focus starting
  // point to whatever was scrolled into view — which silently disinherited the skip link.
  // Found by the first-Tab e2e test, not by eye.
  useEffect(() => {
    if (currentIndex === null) return;
    const list = listRef.current;
    const surface = list?.parentElement; // .hall__lines — the scroller, except while writing
    const row = list?.children[currentIndex] as HTMLElement | undefined;
    if (!list || !surface || !row) return;
    // While writing, the recent-lines band is its own scroller and the current line is almost
    // always the newest — keep it in view at the band's foot, under the teacher's eye.
    const scroller = writing ? list : surface;
    const top = row.offsetTop - scroller.clientHeight / 2 + row.clientHeight / 2;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [currentIndex, lines.length, writing]);

  if (lines.length === 0) {
    return (
      <>
        <div className="board__empty" data-testid="lesson-empty">
          <p className="board__empty-word">{t('rail.empty')}</p>
          <p className="board__empty-hint">{t('rail.emptyHint')}</p>
        </div>
        {writing && <InkStrip />}
      </>
    );
  }

  return (
    <>
      <ol ref={listRef} className="board__lines" aria-label={t('rail.title')} data-testid="lesson-rail">
        {lines.map((line, index) => {
          const current = index === currentIndex;
          const ghost = ghostInkFor(line.id);
          return (
            <li key={line.id} className={`boardline${current ? ' is-current' : ''}`}>
              {ghost && <img className="boardline__ghost" src={ghost} alt="" aria-hidden="true" />}
              <button
                type="button"
                className="boardline__face"
                aria-current={current ? 'true' : undefined}
                aria-label={t('rail.show', { n: index + 1 })}
                data-testid={`lesson-line-${index}`}
                onClick={() => selectLine(index)}
              >
                <span className="boardline__index num" aria-hidden="true">
                  {index + 1}
                </span>
                <ChalkLine source={line.source} />
                {current && translating && <span className="boardline__busy">{t('rail.translating')}</span>}
              </button>
              <span className="boardline__tools">
                <button
                  type="button"
                  className="boardline__tool"
                  aria-label={t('rail.edit', { n: index + 1 })}
                  title={t('rail.edit', { n: index + 1 })}
                  data-testid={`lesson-edit-${index}`}
                  onClick={() => beginEdit(index)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="boardline__tool"
                  aria-label={t('rail.remove', { n: index + 1 })}
                  title={t('rail.remove', { n: index + 1 })}
                  data-testid={`lesson-remove-${index}`}
                  onClick={() => removeLine(index)}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      {/* The board's writable next line — where a written step will land (v4 innovation). */}
      {writing && <InkStrip />}

      <div className="board__foot">
        <button type="button" className="chip chip--board" data-testid="lesson-clear" onClick={() => clearLesson()}>
          {t('rail.clear')}
        </button>
      </div>
    </>
  );
}
