/**
 * The translation pipeline: LaTeX -> MathML -> Nemeth braille cells (+ speech, + semantic tree).
 *
 *   temml  turns LaTeX into MathML.
 *   SRE    turns MathML into Nemeth braille, into spoken maths, and into a semantic tree.
 *
 * Nemeth is the maths braille code we emit — see DECISIONS.md D2.1 for why, and for the seam that
 * lets a Bharati maths table replace it later without touching anything above this file.
 */

import temml from 'temml';
import { unicodeStringToMasks, type DotMask } from './braille';
import { latexToPlainText, textToLiteralBraille } from './literal';
import { toEnrichedMathml, toNemeth } from './sre-service';

export interface TranslationIssue {
  readonly kind: 'parse' | 'unknown-character' | 'engine';
  readonly message: string;
  /** Something the user can actually do about it. */
  readonly fix?: string;
}

export interface Translation {
  readonly latex: string;
  readonly mathml: string;
  /** MathML annotated with `data-semantic-*` — the Reader's raw material. Empty if enrichment failed. */
  readonly enriched: string;
  /** The full expression as Nemeth, one entry per braille cell. */
  readonly cells: readonly DotMask[];
  /** The same thing as a Unicode braille string, for copy/paste and for tests. */
  readonly unicode: string;
  readonly issues: readonly TranslationIssue[];
  /**
   * Set when the braille on the cells is NOT Nemeth. 'literal' means the maths engine was
   * unavailable and this is Grade-1 literary braille of the plain text. The interface must say so:
   * a display quietly showing a different braille code is worse than one that stops.
   */
  readonly degraded?: 'literal';
}

/** temml signals some failures inside its output rather than by throwing. Detect those too. */
function detectParseFailure(mathml: string): string | null {
  if (mathml.includes('temml-error') || mathml.includes('ParseError')) {
    const match = /title="([^"]*)"/.exec(mathml);
    return match ? decodeHtmlEntities(match[1]) : 'the expression could not be parsed';
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** LaTeX -> MathML. Throws only for genuinely unusable input; soft failures come back as `issue`. */
export function latexToMathml(latex: string): { mathml: string; issue: TranslationIssue | null } {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"></math>', issue: null };
  }

  let mathml: string;
  try {
    mathml = temml.renderToString(trimmed, { xml: true, throwOnError: false });
  } catch (err) {
    return {
      mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"></math>',
      issue: {
        kind: 'parse',
        message: err instanceof Error ? err.message : String(err),
        fix: 'Check the LaTeX — unbalanced braces are the usual cause.',
      },
    };
  }

  const failure = detectParseFailure(mathml);
  if (failure) {
    return {
      mathml,
      issue: {
        kind: 'parse',
        message: failure,
        fix: 'Check the LaTeX — unbalanced braces or an unknown command are the usual causes.',
      },
    };
  }

  return { mathml, issue: null };
}

/**
 * Full translation of one expression.
 *
 * Never throws. A failure anywhere degrades to an empty cell list plus a described issue, because
 * the caller is allowed to keep showing the previous frame (CLAUDE.md Law 4) but is never allowed
 * to fail silently (Law 3).
 */
export async function translateLatex(latex: string): Promise<Translation> {
  const issues: TranslationIssue[] = [];
  const { mathml, issue: parseIssue } = latexToMathml(latex);
  if (parseIssue) issues.push(parseIssue);

  if (parseIssue) {
    return { latex, mathml, enriched: '', cells: [], unicode: '', issues };
  }

  let unicode: string;
  try {
    unicode = await toNemeth(mathml);
  } catch (err) {
    // The maths engine is gone. Rather than a blank display, fall back to LITERARY braille of the
    // plain text — which is not Nemeth and cannot express a fraction, so the caller is told loudly
    // and the UI says which code is on the cells. A display that keeps working in the wrong code
    // without saying so would be far worse than one that stops.
    const plain = latexToPlainText(latex);
    const fallback = textToLiteralBraille(plain);
    issues.push({
      kind: 'engine',
      message: `The maths engine is unavailable (${err instanceof Error ? err.message : String(err)}). Showing plain Grade-1 braille of "${plain}" instead — this is NOT Nemeth and cannot express fractions or powers.`,
      fix: 'Reload the page; if it persists, run `npm install` again — the locale files in public/sre/mathmaps may be missing.',
    });
    return {
      latex,
      mathml,
      enriched: '',
      cells: fallback.cells,
      unicode: cellsToUnicode(fallback.cells),
      issues,
      degraded: 'literal',
    };
  }

  const { cells, unknown } = unicodeStringToMasks(unicode);
  if (unknown.length > 0) {
    issues.push({
      kind: 'unknown-character',
      message: `The translator produced ${unknown.length} character(s) with no braille cell: ${[...new Set(unknown)].join(' ')}`,
      fix: 'They were skipped. Simplify the expression if the braille looks short.',
    });
  }

  let enriched = '';
  try {
    enriched = await toEnrichedMathml(mathml);
  } catch {
    // Enrichment only powers the Reader's tree view. Losing it must not cost us the braille.
    issues.push({
      kind: 'engine',
      message: 'Structure analysis unavailable for this expression.',
      fix: 'Reading still works character by character; structural navigation is disabled.',
    });
  }

  return { latex, mathml, enriched, cells, unicode, issues };
}

/** Convenience for tests and the cell atlas: cells as a Unicode braille string. */
export function cellsToUnicode(cells: readonly DotMask[]): string {
  return cells.map((mask) => String.fromCodePoint(0x2800 + mask)).join('');
}

