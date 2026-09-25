/**
 * Write an equation with the mouse (or a finger, or a stylus).
 *
 * This exists for two reasons. It is the fastest way to show the recognition path working when no
 * camera and no printed page are to hand — which describes most demo rooms. And it is how a
 * sighted teacher can put a question in front of a blind student without printing anything.
 */

import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import './DrawPad.css';

const STROKE_WIDTH = 4;

export function DrawPad({ onDone }: { onDone: (dataUrl: string) => void }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Backing store at device resolution so strokes are not soft — the recogniser sees the
    // pixels, not the CSS size.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeStyle = '#101215';
  }, []);

  function positionOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = positionOf(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A single tap should leave a dot, not nothing.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    setHasInk(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = positionOf(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
  }

  function done() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onDone(canvas.toDataURL('image/png'));
  }

  return (
    <div className="pad">
      <canvas
        ref={canvasRef}
        className="pad__canvas"
        data-testid="draw-pad"
        aria-label={t('rec.draw')}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="rec__actions">
        <button type="button" className="btn" onClick={clear} disabled={!hasInk}>
          Clear
        </button>
        <button type="button" className="btn btn--primary" onClick={done} disabled={!hasInk} data-testid="pad-done">
          Use this drawing
        </button>
      </div>
      <p className="hw__note">
        Write large and clearly, left to right. The recogniser is happiest with one expression at a
        time, not a whole page of working.
      </p>
    </div>
  );
}
