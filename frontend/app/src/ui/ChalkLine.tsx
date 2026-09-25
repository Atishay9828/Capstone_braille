/**
 * One line of the board, drawn the way a teacher would have drawn it.
 *
 * A sighted child looking up at a blackboard sees a fraction, not the word "1/2" — so a
 * committed maths line renders as real print maths, through temml, the same parse that feeds
 * the braille. A worded question renders as the sentence the teacher wrote, because that is
 * exactly what a board would show. Rendering failures fall back to the source text: the board
 * never blanks (CLAUDE.md Law 4), and whatever is wrong is already reported at the tray.
 */

import { useEffect, useRef } from 'react';
import temml from 'temml';
import { hasWords } from '../core/mixed';
import { toLatex, looksLikeLatex } from '../core/mathinput';

export function ChalkLine({ source }: { source: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const worded = hasWords(source);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    node.textContent = '';
    if (worded) return;
    try {
      const latex = looksLikeLatex(source) ? source : toLatex(source).latex;
      temml.render(latex, node, { throwOnError: false, displayMode: false });
      if (!node.textContent?.trim()) node.textContent = source;
    } catch {
      node.textContent = source;
    }
  }, [source, worded]);

  if (worded) {
    return <span className="chalkline chalkline--words">{source}</span>;
  }
  return <span ref={host} className="chalkline chalkline--maths" aria-hidden="true" />;
}
