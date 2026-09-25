/**
 * Scanning a FULL question — words and maths — straight out of the textbook.
 *
 * The flow a teacher actually follows with a book in one hand:
 *   1. photograph the question
 *   2. drag a box around each part, left to right — the sentence, then the expression
 *   3. say what each part is (words / maths) and watch it read
 *   4. correct anything doubtful — doubtful parts say so themselves
 *   5. put the assembled line on the board
 *
 * Nothing here touches the display. The assembled line leaves through `onSent`, which is the
 * confirm gate: the "put it on the board" press is the teacher vouching for every part.
 */

import { useRef, useState } from 'react';
import { prepareImage } from '../recognise/preprocess';
import { recogniser } from '../recognise/shared';
import { readWords, wordsStatus } from '../recognise/words';
import { MathPreview } from './MathPreview';
import { useT } from './i18n';
import './QuestionScan.css';

interface Part {
  readonly id: number;
  readonly kind: 'words' | 'maths';
  readonly value: string;
  /** Honest doubt: set whenever the engine was not sure. The teacher sees it, always. */
  readonly doubtful: boolean;
  readonly note: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

let nextPartId = 1;

export function QuestionScan({ onSent }: { onSent: (source: string) => void }) {
  const t = useT();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [box, setBox] = useState<Box | null>(null);
  const [dragFrom, setDragFrom] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState<'words' | 'maths' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const img = useRef<HTMLImageElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset(url: string) {
    setImageUrl(url);
    setParts([]);
    setBox(null);
    setError(null);
  }

  function pointer(event: React.PointerEvent): { x: number; y: number } {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    };
  }

  /** Crop the selected box out of the ORIGINAL pixels, not the scaled-down screen ones. */
  function cropToCanvas(box: Box | null): HTMLCanvasElement | null {
    const el = img.current;
    if (!el || !box || box.w < 8 || box.h < 8) return null;
    const scaleX = el.naturalWidth / el.clientWidth;
    const scaleY = el.naturalHeight / el.clientHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(box.w * scaleX));
    canvas.height = Math.max(1, Math.round(box.h * scaleY));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      el,
      box.x * scaleX,
      box.y * scaleY,
      box.w * scaleX,
      box.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas;
  }

  async function readAs(kind: 'words' | 'maths', givenBox: Box | null = box) {
    const canvas = cropToCanvas(givenBox);
    if (!canvas) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'words') {
        const status = await wordsStatus();
        if (status.state === 'unavailable') {
          setError(`${status.reason ?? t('qs.wordsUnavailable')}${status.fix ? ` — ${status.fix}` : ''}`);
          return;
        }
        const reading = await readWords(canvas);
        if (!reading.text) {
          setError(t('qs.nothingRead'));
          return;
        }
        setParts((current) => [
          ...current,
          {
            id: nextPartId++,
            kind,
            value: reading.text,
            doubtful: reading.confidence < 80,
            note: t('qs.wordsNote', { pc: reading.confidence }),
          },
        ]);
      } else {
        const prepared = await prepareImage(canvas.toDataURL('image/png'));
        recogniser.setInkCoverage(prepared.inkCoverage);
        const result = await recogniser.recognise(new Float32Array(prepared.pixels));
        if (!result.latex.trim()) {
          setError(t('qs.nothingRead'));
          return;
        }
        setParts((current) => [
          ...current,
          {
            id: nextPartId++,
            kind,
            value: result.latex,
            doubtful: result.quality !== 'good',
            note: result.notes.join(' · ') || t('qs.mathsNote', { ms: result.ms }),
          },
        ]);
      }
      setBox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  function editPart(id: number, value: string) {
    // A hand-corrected part is no longer in doubt — the correction IS the verification.
    setParts((current) => current.map((p) => (p.id === id ? { ...p, value, doubtful: false } : p)));
  }

  function removePart(id: number) {
    setParts((current) => current.filter((p) => p.id !== id));
  }

  const assembled = parts
    .map((p) => p.value.trim())
    .filter(Boolean)
    .join(' ');
  const anyDoubt = parts.some((p) => p.doubtful);

  return (
    <div className="qs">
      <p className="hw__note">{t('qs.lede')}</p>

      <div className="rec__actions">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          name="question-image"
          aria-label={t('rec.chooseLabel')}
          data-testid="qs-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) reset(URL.createObjectURL(file));
          }}
        />
        <button type="button" className="btn" data-testid="qs-choose" onClick={() => fileInput.current?.click()}>
          {t('rec.choosePhoto')}
        </button>
        {imageUrl && (
          <button type="button" className="chip" onClick={() => reset(imageUrl)}>
            {t('qs.startOver')}
          </button>
        )}
      </div>

      {imageUrl && (
        <>
          <p className="qs__hint">{t('qs.dragHint')}</p>
          {/* The keyboard road: no dragging required when the photo holds exactly one part.
              (A mouse is a convenience; operating this app must never require one — Law 6.) */}
          <div className="rec__actions">
            <button
              type="button"
              className="chip"
              disabled={busy !== null}
              data-testid="qs-whole-words"
              onClick={() => {
                const el = img.current;
                if (!el) return;
                void readAs('words', { x: 0, y: 0, w: el.clientWidth, h: el.clientHeight });
              }}
            >
              {t('qs.wholeWords')}
            </button>
            <button
              type="button"
              className="chip"
              disabled={busy !== null}
              data-testid="qs-whole-maths"
              onClick={() => {
                const el = img.current;
                if (!el) return;
                void readAs('maths', { x: 0, y: 0, w: el.clientWidth, h: el.clientHeight });
              }}
            >
              {t('qs.wholeMaths')}
            </button>
          </div>
          <div
            className="qs__stage"
            data-testid="qs-stage"
            onPointerDown={(event) => {
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // A pointer that cannot be captured (synthetic events, some pens) still drags;
                // capture only makes the drag survive leaving the element.
              }
              const p = pointer(event);
              setDragFrom(p);
              setBox({ x: p.x, y: p.y, w: 0, h: 0 });
            }}
            onPointerMove={(event) => {
              if (!dragFrom) return;
              const p = pointer(event);
              setBox({
                x: Math.min(dragFrom.x, p.x),
                y: Math.min(dragFrom.y, p.y),
                w: Math.abs(p.x - dragFrom.x),
                h: Math.abs(p.y - dragFrom.y),
              });
            }}
            onPointerUp={() => setDragFrom(null)}
          >
            <img ref={img} src={imageUrl} alt={t('qs.photoAlt')} className="qs__img" draggable={false} />
            {box && box.w > 2 && (
              <span
                className="qs__box"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                aria-hidden="true"
              />
            )}
          </div>

          {box && box.w >= 8 && box.h >= 8 && !dragFrom && (
            <div className="qs__ask" data-testid="qs-ask">
              <span className="field__label">{t('qs.whatIsThis')}</span>
              <div className="rec__actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  data-testid="qs-read-words"
                  onClick={() => void readAs('words')}
                >
                  {busy === 'words' ? t('rec.reading') : t('qs.itsWords')}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  data-testid="qs-read-maths"
                  onClick={() => void readAs('maths')}
                >
                  {busy === 'maths' ? t('rec.reading') : t('qs.itsMaths')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="notice notice--bad" role="alert" data-testid="qs-error">
          {error}
          <span className="notice__fix">{t('rec.typeInstead')}</span>
        </p>
      )}

      {parts.length > 0 && (
        <div className="qs__composer" data-testid="qs-composer">
          <h3 className="field__label">{t('qs.theLine')}</h3>
          <ol className="qs__parts">
            {parts.map((part) => (
              <li key={part.id} className={`qs__part${part.doubtful ? ' is-doubtful' : ''}`}>
                <span className="qs__kind">{part.kind === 'words' ? t('qs.words') : t('qs.maths')}</span>
                <input
                  className="field__input num qs__value"
                  value={part.value}
                  aria-label={part.kind === 'words' ? t('qs.words') : t('qs.maths')}
                  onChange={(event) => editPart(part.id, event.target.value)}
                />
                {part.doubtful && (
                  <span className="qs__doubt" data-testid="qs-doubt">
                    {t('qs.checkThis')}
                  </span>
                )}
                <button
                  type="button"
                  className="rail__tool"
                  aria-label={t('qs.removePart')}
                  onClick={() => removePart(part.id)}
                >
                  ×
                </button>
                <span className="qs__note">{part.note}</span>
              </li>
            ))}
          </ol>

          <p className="field__label rec__checklabel">{t('rec.checkPrint')}</p>
          {parts.some((p) => p.kind === 'maths') ? (
            <div className="qs__preview">
              {parts.map((part) =>
                part.kind === 'maths' ? (
                  <MathPreview key={part.id} latex={part.value} size="large" label={part.value} />
                ) : (
                  <span key={part.id} className="qs__previewwords">
                    {part.value}
                  </span>
                ),
              )}
            </div>
          ) : (
            <p className="qs__previewwords">{assembled}</p>
          )}

          <div className="rec__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!assembled}
              data-testid="qs-send"
              onClick={() => onSent(assembled)}
            >
              {t('rec.send')} →
            </button>
          </div>
          <p className="hw__note">{anyDoubt ? t('qs.doubtWarning') : t('rec.lastWord')}</p>
        </div>
      )}
    </div>
  );
}
