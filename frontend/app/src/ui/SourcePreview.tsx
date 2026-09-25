/**
 * Show a line exactly as it will be read — whatever a teacher typed into it.
 *
 * A worksheet item is not always an expression. It might be `1/2`, it might be LaTeX pasted from a
 * textbook, and it might be "दो संख्याओं का योग 12 है". Rendering all three with a maths renderer
 * would turn the Hindi into italic variables; rendering all three as text would turn the fraction
 * into a slash. So this splits the line the same way `core/mixed.ts` does, renders the maths as
 * maths and the words as words, and stays synchronous so a list of forty items does not flicker.
 */

import { toLatex } from '../core/mathinput';
import { splitLine } from '../core/mixed';
import { MathPreview } from './MathPreview';
import './SourcePreview.css';

export interface SourcePreviewProps {
  source: string;
  size?: 'normal' | 'large' | 'huge';
}

export function SourcePreview({ source, size = 'normal' }: SourcePreviewProps) {
  const segments = splitLine(source);

  if (segments.length === 0) return null;

  // The common case — a pure expression — renders as one piece, with no wrapper to shift it about.
  if (segments.length === 1 && segments[0].kind === 'maths') {
    return <MathPreview latex={toLatex(source).latex} label={source} size={size} />;
  }

  return (
    <div className={`sourceview sourceview--${size}`} data-testid="source-preview">
      {segments.map((segment, index) =>
        segment.kind === 'maths' ? (
          <MathPreview key={index} latex={toLatex(segment.text).latex} label={segment.text} size={size} />
        ) : (
          <span key={index} className="sourceview__words">
            {segment.text}
          </span>
        ),
      )}
    </div>
  );
}
