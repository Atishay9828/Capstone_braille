/**
 * Reading handwriting — a photograph of maths becomes moving dots.
 *
 * Three ways in (camera, file, drawing) and one rule that governs all of them: **the model never
 * gets the last word**. Every result lands in an editable field with an honest quality note, and
 * nothing reaches the display until a human presses "Read this". A recogniser that commits its own
 * output is a recogniser that will, one day, teach a child the wrong equation.
 */

import { useEffect, useRef, useState } from 'react';
import { useBraillix } from '../store';
import { NORM_MEAN, NORM_STD, imageWarning, prepareImage, type PreparedImage } from '../recognise/preprocess';
import { recogniser } from '../recognise/shared';
import type { ProviderStatus, RecognitionResult } from '../recognise/types';
import { DrawPad } from './DrawPad';
import { MathPreview } from './MathPreview';
import { QuestionScan } from './QuestionScan';
import { useT, type StringKey } from './i18n';
import './RecogniseScreen.css';

type Source = { url: string; label: string } | null;

export interface RecognisePanelProps {
  /**
   * Called with the teacher-approved reading when they press "put this on the board".
   * That press IS the confirm gate: the caller records the line as recognised-and-confirmed.
   * Nothing in this panel touches the display directly.
   */
  onSent: (source: string) => void;
}

export function RecognisePanel({ onSent }: RecognisePanelProps) {
  const t = useT();
  const setCapability = useBraillix((s) => s.setCapability);

  const [status, setStatus] = useState<ProviderStatus>({ state: 'unavailable', reason: 'checking…' });
  const [progress, setProgress] = useState<{ value: number; message: string } | null>(null);
  const [source, setSource] = useState<Source>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  /** A second reading of the same image, taken only when the first one was not confident. */
  const [second, setSecond] = useState<RecognitionResult | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'photo' | 'question' | 'draw'>('photo');

  const fileInput = useRef<HTMLInputElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void recogniser.probe().then((probed) => {
      if (cancelled) return;
      setStatus(probed);
      setCapability('recognition', {
        state: probed.state === 'unavailable' ? 'unavailable' : 'ready',
        reason: probed.state === 'unavailable' ? (probed.reason ?? 'unavailable') : 'on this device, offline',
        fix: probed.fix,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [setCapability]);

  /** Draw what the model will actually see — the honest preview, after cropping and inversion. */
  useEffect(() => {
    const canvas = previewCanvas.current;
    if (!canvas || !prepared) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.sqrt(prepared.pixels.length);
    canvas.width = size;
    canvas.height = size;
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < prepared.pixels.length; i += 1) {
      // Undo the normalisation for display purposes only.
      const value = Math.max(0, Math.min(255, Math.round((prepared.pixels[i] * NORM_STD + NORM_MEAN) * 255)));
      image.data[i * 4] = value;
      image.data[i * 4 + 1] = value;
      image.data[i * 4 + 2] = value;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [prepared]);

  async function accept(url: string, label: string) {
    setError(null);
    setResult(null);
    setSecond(null);
    setSource({ url, label });
    try {
      const image = await prepareImage(url);
      setPrepared(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPrepared(null);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    accept(URL.createObjectURL(file), file.name).catch(() => {});
  }

  async function run() {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      if (status.state !== 'ready') {
        await recogniser.load((value, message) => setProgress({ value, message }));
        setProgress(null);
        setStatus({ state: 'ready' });
      }
      recogniser.setInkCoverage(prepared.inkCoverage);
      // The pixel buffer is transferred to the worker, so hand over a copy and keep the preview.
      const outcome = await recogniser.recognise(new Float32Array(prepared.pixels));
      setResult(outcome);
      setDraft(outcome.latex);

      /*
       * When the model is not confident, read the image again with the greys pushed apart.
       *
       * This is not a retry hoping for a better answer — it is a second opinion. Two readings of
       * the same handwriting through different preprocessing that AGREE is real evidence, of a
       * kind the model's own output cannot give; two that disagree is a question worth putting to
       * the teacher rather than hiding. It costs about a second, and only on the images that
       * deserve it.
       */
      if (outcome.quality !== 'good' && source) {
        setProgress({ value: 1, message: t('rec.secondTry') });
        try {
          const harder = await prepareImage(source.url, { contrast: 1.8 });
          recogniser.setInkCoverage(harder.inkCoverage);
          setSecond(await recogniser.recognise(new Float32Array(harder.pixels)));
        } catch {
          // A second opinion is a bonus, never a requirement.
        } finally {
          setProgress(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  function sendToDisplay() {
    if (!draft.trim()) return;
    onSent(draft);
  }

  const warning = prepared ? imageWarning(prepared) : null;

  return (
    <div className="rec">
      {status.state === 'unavailable' && (
        <p className="notice notice--warn" data-testid="rec-unavailable">
          <strong>{t('rec.notInstalled')}</strong> {status.reason}
          {status.fix && <span className="notice__fix">{status.fix}</span>}
          <span className="notice__fix">{t('rec.notInstalledFix')}</span>
        </p>
      )}

      <div className={mode === 'question' ? undefined : 'rec__grid'}>
        <section className="panel" aria-labelledby="rec-input-heading">
          <h2 id="rec-input-heading" className="panel__title">
            {mode === 'question' ? t('qs.title') : t('rec.image')}
          </h2>

          <div className="segmented" role="group" aria-label={t('rec.how')}>
            <button
              type="button"
              className={`segmented__btn${mode === 'photo' ? ' is-current' : ''}`}
              aria-pressed={mode === 'photo'}
              onClick={() => setMode('photo')}
            >
              {t('rec.photoOrFile')}
            </button>
            <button
              type="button"
              className={`segmented__btn${mode === 'question' ? ' is-current' : ''}`}
              aria-pressed={mode === 'question'}
              data-testid="mode-question"
              onClick={() => setMode('question')}
            >
              {t('rec.fullQuestion')}
            </button>
            <button
              type="button"
              className={`segmented__btn${mode === 'draw' ? ' is-current' : ''}`}
              aria-pressed={mode === 'draw'}
              data-testid="mode-draw"
              onClick={() => setMode('draw')}
            >
              {t('rec.writeIt')}
            </button>
          </div>

          {mode === 'photo' && (
            <>
              <div className="rec__actions">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="visually-hidden"
                  name="image"
                  aria-label={t('rec.chooseLabel')}
                  data-testid="file-input"
                  onChange={(event) => onFile(event.target.files?.[0])}
                />
                <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                  {t('rec.choosePhoto')}
                </button>
              </div>
              <p className="hw__note">{t('rec.cameraNote')}</p>
              <SampleImages onPick={accept} label={t('rec.samples')} />
            </>
          )}
          {mode === 'draw' && <DrawPad onDone={(url) => accept(url, 'drawing')} />}
          {mode === 'question' && <QuestionScan onSent={onSent} />}
        </section>

        {mode !== 'question' && (
        <section className="panel" aria-labelledby="result-heading">
          <h2 id="result-heading" className="panel__title">
            {t('rec.whatItRead')}
          </h2>

          {!prepared && <p className="evidence__empty">{t('rec.chooseSomething')}</p>}

          {prepared && (
            <>
              <div className="rec__preview">
                <canvas ref={previewCanvas} className="rec__canvas" aria-label={t('rec.whatItSees')} />
                <ul className="rec__facts num">
                  <li>{source?.label}</li>
                  {prepared.inverted && <li>{t('rec.inverted')}</li>}
                  <li>{t('rec.cropped')}</li>
                </ul>
              </div>

              {warning && <p className="notice notice--warn">{warning}</p>}

              <div className="rec__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void run()}
                  disabled={busy || status.state === 'unavailable'}
                  data-testid="run-recognition"
                >
                  {busy ? t('rec.reading') : t('rec.readThis')}
                </button>
              </div>

              {progress && (
                <p className="rec__progress num" role="status">
                  {progress.message}
                  <span className="rec__bar" style={{ ['--p' as string]: `${Math.round(progress.value * 100)}%` }} />
                </p>
              )}

              {error && (
                <p className="notice notice--bad" role="alert" data-testid="rec-error">
                  {error}
                  <span className="notice__fix">{t('rec.typeInstead')}</span>
                </p>
              )}
            </>
          )}

          {result && (
            <>
              <p className={`quality quality--${result.quality}`} data-testid="rec-quality">
                <strong>{t(QUALITY_LABEL[result.quality])}</strong>
                <span className="num"> · {t('rec.onDevice', { ms: result.ms })}</span>
              </p>
              <ul className="rec__notes">
                {result.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>

              {second && second.latex === result.latex && (
                <p className="notice notice--good" data-testid="rec-agree">
                  {t('rec.agree')}
                </p>
              )}
              {second && second.latex !== result.latex && (
                <div className="rec__second" data-testid="rec-disagree">
                  <p className="notice notice--warn">{t('rec.disagree')}</p>
                  <div className="rec__actions">
                    <button
                      type="button"
                      className={`chip${draft === result.latex ? ' is-current' : ''}`}
                      onClick={() => setDraft(result.latex)}
                    >
                      {t('rec.readingOne')}
                    </button>
                    <button
                      type="button"
                      className={`chip${draft === second.latex ? ' is-current' : ''}`}
                      data-testid="use-second-reading"
                      onClick={() => setDraft(second.latex)}
                    >
                      {t('rec.readingTwo')}
                    </button>
                  </div>
                </div>
              )}

              <label className="field">
                <span className="field__label">{t('rec.correctIt')}</span>
                <textarea
                  className="field__input num"
                  rows={3}
                  value={draft}
                  spellCheck={false}
                  name="recognised" data-testid="rec-latex"
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>

              {/* The teacher checks the model's reading as *maths*, not as LaTeX. This is the
                  whole correction loop: see it in print, fix the field, see it again. */}
              <p className="field__label rec__checklabel">{t('rec.checkPrint')}</p>
              <MathPreview latex={draft} size="large" label={draft} />

              <div className="rec__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={sendToDisplay}
                  disabled={!draft.trim()}
                  data-testid="send-to-display"
                >
                  {t('rec.send')} →
                </button>
              </div>
              <p className="hw__note">{t('rec.lastWord')}</p>
            </>
          )}
        </section>
        )}
      </div>
    </div>
  );
}

const QUALITY_LABEL: Record<RecognitionResult['quality'], StringKey> = {
  good: 'rec.good',
  uncertain: 'rec.uncertain',
  poor: 'rec.bad',
};

/**
 * Known-good images, committed to the repository.
 *
 * The demo must never depend on the room's lighting or on a phone being to hand — a point the
 * boardroom made about OCR generally, and the cheapest insurance in the whole project.
 */
function SampleImages({ onPick, label }: { onPick: (url: string, label: string) => Promise<void>; label: string }) {
  const samples = [
    { file: 'quadratic.svg', label: 'Quadratic' },
    { file: 'fraction.svg', label: 'Fraction' },
    { file: 'root.svg', label: 'Square root' },
    { file: 'sum.svg', label: 'Summation' },
    { file: 'pythagoras.svg', label: 'Pythagoras' },
    { file: 'handwritten.svg', label: 'Handwritten' },
  ];

  return (
    <div className="samples" role="group" aria-label={label}>
      {samples.map((sample) => (
        <button
          key={sample.file}
          type="button"
          className="samples__btn"
          data-testid={`sample-${sample.file}`}
          onClick={() => void onPick(`samples/${sample.file}`, sample.label)}
        >
          <img src={`samples/${sample.file}`} alt="" className="samples__img" />
          <span className="samples__label">{sample.label}</span>
        </button>
      ))}
    </div>
  );
}
