/**
 * The ink strip — writing lands where it will live.
 *
 * A blackboard is not a form; it is a surface you write on. This strip is the board's next
 * empty line: the teacher writes a step with a finger, stylus or mouse exactly where the line
 * will stand, the strokes are read on-device (D-V4.1: rasterised ink through the same verified
 * recognisers the camera uses), and the reading lands in the tray's box — where the print
 * preview and the braille verdict light up, and the ordinary Put-on-the-board press is the
 * confirmation the lesson store demands. One commit path, whatever the grip.
 *
 * The teacher's own strokes are kept and drawn faintly behind the committed line (ink.ts) —
 * the board remembering her hand.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareImage, imageWarning } from '../recognise/preprocess';
import { recogniser } from '../recognise/shared';
import { tidyLatex } from '../recognise/tidy';
import { readWords } from '../recognise/words';
import { useBraillix } from '../store';
import { useDraft } from '../draft';
import { useLesson } from '../lesson';
import { useT } from './i18n';
import './InkStrip.css';

type InkMode = 'maths' | 'words';

/** One stroke: the pointer's path, in canvas CSS pixels. */
type Stroke = { x: number; y: number }[];

const STROKE_WIDTH = 5;
/** How long the hand rests before we read the line. A beat, not a wait. */
const PAUSE_MS = 1200;

export function InkStrip() {
  const t = useT();
  const setText = useDraft((s) => s.setText);
  const draftText = useDraft((s) => s.text);
  const linesCount = useLesson((s) => s.lines.length);
  const recognition = useBraillix((s) => s.capabilities.recognition);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last text this strip wrote into the box. If the box says something else, the teacher
      edited it by hand, and the strip must never overwrite her. */
  const lastFed = useRef<string | null>(null);

  const [mode, setMode] = useState<InkMode>('maths');
  const [hasInk, setHasInk] = useState(false);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** Render-side mirror of lastFed — refs must not be read during render. */
  const [fedText, setFedText] = useState<string | null>(null);

  /* ---- drawing ---- */

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeStyle = 'rgba(244, 242, 231, 0.92)'; /* chalk on slate */
    for (const stroke of [...strokes.current, ...(live.current ? [live.current] : [])]) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i += 1) {
        const mid = { x: (stroke[i - 1].x + stroke[i].x) / 2, y: (stroke[i - 1].y + stroke[i].y) / 2 };
        ctx.quadraticCurveTo(stroke[i - 1].x, stroke[i - 1].y, mid.x, mid.y);
      }
      const tail = stroke[stroke.length - 1];
      ctx.lineTo(tail.x + 0.01, tail.y);
      ctx.stroke();
    }
  }, []);

  /*
   * The canvas follows its box — on mount, on window resize, on a tablet rotating mid-lesson.
   * The strokes are rescaled proportionally so the writing stays exactly where the hand left
   * it. Sizing once on mount was an instability the v5.1 brief is about: after any layout
   * change the pointer coordinates silently stopped matching the pixels.
   */
  const lastSize = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const previous = lastSize.current;
      if (previous && (previous.w !== rect.width || previous.h !== rect.height)) {
        const sx = rect.width / previous.w;
        const sy = rect.height / previous.h;
        for (const stroke of strokes.current) {
          for (const point of stroke) {
            point.x *= sx;
            point.y *= sy;
          }
        }
      }
      lastSize.current = { w: rect.width, h: rect.height };
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  /* A committed line means this ink now lives on the board — the strip starts the next one. */
  const seenLines = useRef(linesCount);
  useEffect(() => {
    if (linesCount > seenLines.current) {
      strokes.current = [];
      live.current = null;
      lastFed.current = null;
      setFedText(null);
      setHasInk(false);
      setNote(null);
      redraw();
    }
    seenLines.current = linesCount;
  }, [linesCount, redraw]);

  function positionOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    live.current = [positionOf(event)];
    setHasInk(true);
    redraw();
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!live.current) return;
    live.current.push(positionOf(event));
    redraw();
  }

  function end() {
    if (live.current) {
      strokes.current.push(live.current);
      live.current = null;
      redraw();
    }
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => void read(), PAUSE_MS);
  }

  function undo() {
    strokes.current.pop();
    setHasInk(strokes.current.length > 0);
    redraw();
    if (strokes.current.length > 0) {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => void read(), PAUSE_MS);
    }
  }

  function wipe() {
    strokes.current = [];
    live.current = null;
    lastFed.current = null;
    setFedText(null);
    setHasInk(false);
    setNote(null);
    redraw();
  }

  /* ---- reading ---- */

  /** The strokes as the model expects them: dark ink on a white page. */
  function rasterise(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas || strokes.current.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const page = document.createElement('canvas');
    page.width = Math.round(rect.width);
    page.height = Math.round(rect.height);
    const ctx = page.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeStyle = '#101215';
    for (const stroke of strokes.current) {
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i += 1) {
        const mid = { x: (stroke[i - 1].x + stroke[i].x) / 2, y: (stroke[i - 1].y + stroke[i].y) / 2 };
        ctx.quadraticCurveTo(stroke[i - 1].x, stroke[i - 1].y, mid.x, mid.y);
      }
      const tail = stroke[stroke.length - 1];
      ctx.lineTo(tail.x + 0.01, tail.y);
      ctx.stroke();
    }
    return page;
  }

  async function read() {
    if (strokes.current.length === 0 || working) return;
    // The teacher corrected the box by hand — her text outranks anything we might read now.
    const boxText = useDraft.getState().text;
    if (lastFed.current !== null && boxText !== lastFed.current) return;

    const page = rasterise();
    if (!page) return;
    setWorking(true);
    setNote(null);
    try {
      let reading: string;
      if (mode === 'maths') {
        const prepared = await prepareImage(page.toDataURL('image/png'));
        recogniser.setInkCoverage(prepared.inkCoverage);
        const result = await recogniser.recognise(new Float32Array(prepared.pixels));
        reading = tidyLatex(result.latex);
        const warning = imageWarning(prepared);
        if (result.quality !== 'good') setNote(result.notes[0] ?? t('ink.check'));
        else if (warning) setNote(warning);
      } else {
        const words = await readWords(page);
        reading = words.text;
        if (words.confidence < 70) setNote(t('ink.check'));
      }
      if (reading.trim()) {
        // Feed the box: the preview and the braille verdict light up in the tray, and the
        // teacher's ordinary Put press does the committing. One pipeline, one gate.
        lastFed.current = reading;
        setFedText(reading);
        setText(reading);
        // The ghost keeps the white-page raster: Blackboard.css inverts it, so the black page
        // disappears into the slate and the strokes come back as faint chalk.
        useDraft.setState({ pendingInk: page.toDataURL('image/png') });
      } else {
        setNote(t('ink.nothing'));
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  /* ---- render ---- */

  if (recognition.state === 'degraded') {
    return (
      <div className="inkstrip inkstrip--off" data-testid="ink-strip">
        <p className="inkstrip__note">{t('ink.unavailable')}</p>
      </div>
    );
  }

  return (
    <div className="inkstrip" data-testid="ink-strip">
      <div className="inkstrip__bar">
        <div className="inkstrip__modes" role="group" aria-label={t('ink.modeLabel')}>
          <button
            type="button"
            className={`inkstrip__mode${mode === 'maths' ? ' is-current' : ''}`}
            aria-pressed={mode === 'maths'}
            data-testid="ink-maths"
            onClick={() => setMode('maths')}
          >
            {t('ink.maths')}
          </button>
          <button
            type="button"
            className={`inkstrip__mode${mode === 'words' ? ' is-current' : ''}`}
            aria-pressed={mode === 'words'}
            data-testid="ink-words"
            onClick={() => setMode('words')}
          >
            {t('ink.words')}
          </button>
        </div>
        <span className="inkstrip__status" aria-live="polite">
          {working ? t('ink.working') : draftText && fedText === draftText ? t('ink.landed') : ''}
        </span>
        <div className="inkstrip__tools">
          <button type="button" className="inkstrip__tool" disabled={!hasInk} data-testid="ink-undo" onClick={undo}>
            {t('ink.undo')}
          </button>
          <button type="button" className="inkstrip__tool" disabled={!hasInk} data-testid="ink-wipe" onClick={wipe}>
            {t('ink.clear')}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="inkstrip__canvas"
        data-testid="ink-canvas"
        aria-label={t('ink.canvasLabel')}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />

      {/* One reserved line, always in the layout: a note appearing must never resize the
          canvas under a moving hand. Empty = the hint; occupied = the warning. */}
      <p className={note ? 'inkstrip__note' : 'inkstrip__hint'} data-testid={note ? 'ink-note' : undefined} role={note ? 'status' : undefined}>
        {note ?? t('ink.hint')}
      </p>
    </div>
  );
}
