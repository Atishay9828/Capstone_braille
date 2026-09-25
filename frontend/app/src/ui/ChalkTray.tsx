/**
 * The chalk tray — the one place anything is ever written.
 *
 * WhatsApp ancestry, deliberately: a field, a send button, and the symbols on a rail above it,
 * always visible (keys.ts explains why). While the teacher types, the print preview and the
 * dots track her keystroke by keystroke; Enter puts the line on the board exactly as it sends
 * a message. Correcting a board line happens here too — one input, one commit path.
 *
 * Scanning a page and writing by hand are grips on the same chalk: both end in this tray's
 * confirm flow, because nothing recognised may reach the board without the teacher's press
 * (CLAUDE.md design law 2 — the lesson store's origin type enforces it).
 */

import { useEffect, useRef, useState } from 'react';
import { useBraillix } from '../store';
import { useLesson } from '../lesson';
import { useDraft } from '../draft';
import { chalkKeys, insertAtCaret } from './keys';
import { MathPreview } from './MathPreview';
import { QuestionStrip } from './QuestionStrip';
import { VerdictLine } from './VerdictLine';
import { RecognisePanel } from './RecognisePanel';
import { useT } from './i18n';
import './ChalkTray.css';

export function ChalkTray() {
  const t = useT();
  const draft = useDraft((s) => s.text);
  const editing = useDraft((s) => s.editing);
  const setText = useDraft((s) => s.setText);
  const commit = useDraft((s) => s.commit);
  const cancelEdit = useDraft((s) => s.cancelEdit);
  const writing = useDraft((s) => s.writing);
  const setWriting = useDraft((s) => s.setWriting);

  const latex = useBraillix((s) => s.latex);
  const spokenText = useBraillix((s) => s.spokenText);
  const mixedLine = useBraillix((s) => s.mixedLine);
  const translation = useBraillix((s) => s.translation);
  const inputIssues = useBraillix((s) => s.inputIssues);
  const sre = useBraillix((s) => s.capabilities.sre);

  const addLine = useLesson((s) => s.addLine);
  const [scanning, setScanning] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  /*
   * The board resumes where the class left off: the moment the maths engine is ready, the
   * last line of the lesson goes back on the cells. First launch is covered by the seeded
   * example line (lesson.ts), so a new teacher's first sight is a working board.
   */
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || sre.state !== 'ready') return;
    greeted.current = true;
    const lesson = useLesson.getState();
    if (lesson.lines.length > 0 && useBraillix.getState().source === '') {
      lesson.selectLine(lesson.lines.length - 1);
    }
  }, [sre.state]);

  function insert(text: string, back: number) {
    const node = field.current;
    if (!node) {
      setText(draft + text);
      return;
    }
    setText(insertAtCaret(node, text, back));
  }

  const issues = translation?.issues ?? [];
  const parseIssue = issues.find((issue) => issue.kind === 'parse');
  const drafting = draft.trim().length > 0;

  return (
    <div className="tray" data-testid="chalk-tray">
      {/* What the line will look like, while it is still in the hand. */}
      {drafting && (
        <div className="tray__preview" data-testid="tray-preview">
          {mixedLine ? (
            <QuestionStrip />
          ) : (
            <MathPreview latex={latex} label={spokenText} size="large" placeholder={t('board.print.empty')} />
          )}
          <VerdictLine />
        </div>
      )}

      {inputIssues.map((issue, index) => (
        <p key={index} className="notice notice--warn tray__notice" data-testid="input-issue">
          {issue.message}
          {issue.fix && <span className="notice__fix">{issue.fix}</span>}
        </p>
      ))}
      {parseIssue && (
        <p className="notice notice--bad tray__notice" role="alert">
          <strong>{t('board.parseFailed')}</strong> {parseIssue.message}
          {parseIssue.fix && <span className="notice__fix">{parseIssue.fix}</span>}
        </p>
      )}
      {issues
        .filter((issue) => issue.kind !== 'parse')
        .map((issue, index) => (
          <p key={index} className="notice notice--warn tray__notice">
            {issue.message}
            {issue.fix && <span className="notice__fix">{issue.fix}</span>}
          </p>
        ))}

      {/* The symbols. All of them, always on screen — the rail scrolls, the page never. */}
      <div className="tray__rail" role="group" aria-label={t('keypad.symbols')} data-testid="symbol-rail">
        {chalkKeys(t).map((key) => (
          <button
            key={key.face}
            type="button"
            className={`tray__key${key.math ? ' tray__key--math' : ''}`}
            title={key.name}
            aria-label={`${key.face} — ${key.name}`}
            data-testid={`key-${key.face}`}
            onClick={() => insert(key.insert, key.back ?? 0)}
          >
            {key.face}
          </button>
        ))}
      </div>

      <div className="tray__hand">
        <button
          type="button"
          className={`tray__grip${writing ? ' is-on' : ''}`}
          aria-label={t('tray.write')}
          title={t('tray.write')}
          data-testid="tray-write"
          aria-pressed={writing}
          onClick={() => setWriting(!writing)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
            <path d="M14 7l3 3" />
          </svg>
        </button>
        <button
          type="button"
          className="tray__grip"
          aria-label={t('tray.scan')}
          title={t('tray.scan')}
          data-testid="tray-scan"
          aria-expanded={scanning}
          onClick={() => setScanning((current) => !current)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </button>

        <label className="tray__fieldwrap">
          <span className="visually-hidden">{t('board.field')}</span>
          <textarea
            ref={field}
            className="tray__field num"
            value={draft}
            spellCheck={false}
            rows={1}
            name="expression"
            data-testid="latex-input"
            placeholder={t('tray.placeholder')}
            aria-describedby="tray-help"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter puts the line on the board, exactly as it sends a message.
              // Shift+Enter keeps its meaning of "new line inside the box".
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                commit();
              }
              if (event.key === 'Escape' && editing !== null) cancelEdit();
            }}
          />
        </label>

        {editing !== null && (
          <button type="button" className="tray__cancel" data-testid="cancel-edit" onClick={cancelEdit}>
            {t('board.cancelEdit')}
          </button>
        )}

        <button
          type="button"
          className="tray__put"
          data-testid="commit-line"
          disabled={!drafting}
          onClick={commit}
          aria-label={editing !== null ? t('board.saveLine', { n: editing + 1 }) : t('board.put')}
          title={editing !== null ? t('board.saveLine', { n: editing + 1 }) : t('board.put')}
        >
          {editing !== null ? (
            t('tray.save')
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
      <p id="tray-help" className="tray__help">
        {t('board.help')}
      </p>

      {/* Scan: a photograph or a page, recognised, confirmed here, landed on the board.
          A full sheet over the hall — camera work needs room, and the crop stage must
          never be clipped mid-drag. */}
      {scanning && (
        <div className="tray__scan" data-testid="tray-scan-panel" role="dialog" aria-label={t('tray.scan')}>
          <div className="tray__scan-bar">
            <button type="button" className="tray__scan-close" data-testid="tray-scan-close" onClick={() => setScanning(false)}>
              ← {t('drawer.back')}
            </button>
          </div>
          <RecognisePanel
            onSent={(recognised) => {
              addLine(recognised, { kind: 'recognised', confirmed: true });
              setScanning(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
