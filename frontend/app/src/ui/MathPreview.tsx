/**
 * The expression, as it looks in the textbook.
 *
 * Until this existed, a sighted teacher looking at Braillix saw two things they could not read:
 * raw LaTeX and raised dots. Research (RESEARCH.md part two, verdicts 1 and 2) says that is the
 * normal case, not the edge case — the teacher at a school for the blind typically reads neither
 * braille nor LaTeX. So this is the surface where they check that the machine understood them:
 * they type `1/2`, they see a real fraction, and only then do the dots mean anything.
 *
 * It renders through temml, the same library that feeds the braille pipeline, so what is on screen
 * and what is on the cells come from one parse. Two renderers would be two opinions.
 */

import { useEffect, useRef } from 'react';
import temml from 'temml';
import './MathPreview.css';

export interface MathPreviewProps {
  /** LaTeX. Already converted from whatever the teacher typed. */
  latex: string;
  /** Screen-reader label. Defaults to the spoken maths where the caller has it. */
  label?: string;
  size?: 'normal' | 'large' | 'huge';
  /** Shown when there is nothing to render. */
  placeholder?: string;
}

export function MathPreview({ latex, label, size = 'normal', placeholder }: MathPreviewProps) {
  const host = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    node.textContent = '';
    if (!latex.trim()) return;

    try {
      // temml writes the MathML itself, so no HTML string ever passes through this component.
      temml.render(latex, node, { throwOnError: false, displayMode: false });
    } catch {
      // A parse failure is already reported next to the input; here it just means nothing to show.
      node.textContent = '';
    }
  }, [latex]);

  const empty = !latex.trim();

  return (
    <div className={`mathpreview mathpreview--${size}`} data-testid="math-preview">
      {/*
        The rendered maths is decorative for a screen-reader user: the spoken form and the braille
        are both better. So it is hidden from the accessibility tree, and the caller's label — the
        real spoken maths — is what gets announced.
      */}
      <span ref={host} className="mathpreview__math" aria-hidden="true" />
      {empty && placeholder && <span className="mathpreview__placeholder">{placeholder}</span>}
      {label && <span className="visually-hidden">{label}</span>}
    </div>
  );
}
