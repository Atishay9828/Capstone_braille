/**
 * One plain sentence that two different engines can both be asked to write.
 *
 * `readback.ts` reads the braille on the display and produces a canonical string. This file takes
 * the LaTeX that went *into* the translator and produces a string in the same form. If they match,
 * the whole chain — LaTeX → MathML → Nemeth → cells — carried the meaning across without losing
 * or inventing anything. If they differ, the difference names the defect.
 *
 * The form is deliberately ugly. Everything is parenthesised: `\frac{1}{2}` is `(1)/(2)` and `x^2`
 * is `x^(2)`, because the only question being asked is "is this the same mathematics", and any
 * prettiness would be a place for a grouping bug to hide. Spaces are dropped on both sides, since
 * Nemeth's spacing rules are its own business and say nothing about meaning.
 *
 * It is a printer for the LaTeX Braillix itself produces, not a general LaTeX engine. Anything it
 * does not recognise is passed through unchanged and reported, so an unhandled command shows up as
 * a mismatch rather than as a silent pass.
 */

export interface Canonical {
  readonly text: string;
  /** LaTeX commands this printer has no rule for. A mismatch is expected wherever these appear. */
  readonly unknown: readonly string[];
}

/** Commands that stand for exactly one character. */
const SIGNS: Readonly<Record<string, string>> = {
  times: '×',
  cdot: '·', // Nemeth writes a raised dot and a cross differently, so this one does too
  mid: '|', // the conditional-probability bar: P(A|B) (v5 audit gap G7)
  div: '÷',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  infty: '∞',
  circ: '°',
  degree: '°',
  percent: '%',
  '%': '%',
  '{': '{',
  '}': '}',
  '|': '||', // the norm bars, which Nemeth writes as two cells
  ' ': '',
  ',': '',
  ';': '',
  '!': '',
  subseteq: '⊆',
  supset: '⊃',
  propto: '∝',
  therefore: '∴',
  because: '∵',
  cup: '∪',
  cap: '∩',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  angle: '∠',
  triangle: '△',
  parallel: '∥',
  perp: '⊥',
  to: '→',
  rightarrow: '→',
  sum: 'Σ',
  prod: 'Π',
  int: '∫',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  theta: 'θ',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
  ldots: '…',
  dots: '…',
};

/** Function names, written out as letters exactly as Nemeth writes them. */
const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'lim',
  'max',
  'min',
  'exp',
  'gcd',
  'det',
  // The inverse trigonometric functions as words — class 12 writes both arcsin x and
  // sin^(-1) x, and the checker must vouch for both (v5 audit gap G4).
  'arcsin',
  'arccos',
  'arctan',
  'adj',
]);

/** Commands that only affect how something is drawn, and mean nothing here. */
const TRANSPARENT = new Set(['left', 'right', 'displaystyle', 'limits', 'nolimits', 'mathrm', 'mathit', 'operatorname']);

type Token =
  | { kind: 'char'; value: string }
  | { kind: 'command'; value: string }
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'openBracket' }
  | { kind: 'closeBracket' };

function tokenize(latex: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < latex.length) {
    const char = latex[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === '\\') {
      const match = /^[a-zA-Z]+/.exec(latex.slice(i + 1));
      if (match) {
        tokens.push({ kind: 'command', value: match[0] });
        i += 1 + match[0].length;
      } else {
        tokens.push({ kind: 'command', value: latex[i + 1] ?? '' });
        i += 2;
      }
      continue;
    }
    if (char === '{') tokens.push({ kind: 'open' });
    else if (char === '}') tokens.push({ kind: 'close' });
    else if (char === '[') tokens.push({ kind: 'openBracket' });
    else if (char === ']') tokens.push({ kind: 'closeBracket' });
    else tokens.push({ kind: 'char', value: char });
    i += 1;
  }
  return tokens;
}

class Printer {
  private at = 0;
  private readonly unknown: string[] = [];

  constructor(private readonly tokens: Token[]) {}

  run(): Canonical {
    return { text: this.sequence(null), unknown: this.unknown };
  }

  /** Print tokens until `stop` (or the end). */
  private sequence(stop: 'close' | 'closeBracket' | null): string {
    const out: string[] = [];
    while (this.at < this.tokens.length) {
      const token = this.tokens[this.at];
      if (stop && token.kind === stop) {
        this.at += 1;
        break;
      }
      out.push(this.one());
    }
    return out.join('');
  }

  /** Print exactly one thing, whatever it is. */
  private one(): string {
    const token = this.tokens[this.at];
    this.at += 1;

    switch (token.kind) {
      case 'open':
        return this.sequence('close');
      case 'openBracket':
        return `[${this.sequence('closeBracket')}]`;
      case 'close':
      case 'closeBracket':
        // Unbalanced. Emitting nothing keeps the reading legible; the mismatch will be visible.
        return '';
      case 'char':
        if (token.value === '^') return `^(${this.group()})`;
        if (token.value === '_') return `_(${this.group()})`;
        return token.value;
      case 'command':
        return this.command(token.value);
      default:
        return '';
    }
  }

  private command(name: string): string {
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const numerator = this.group();
      const denominator = this.group();
      return `(${numerator})/(${denominator})`;
    }
    if (name === 'sqrt') {
      if (this.tokens[this.at]?.kind === 'openBracket') {
        this.at += 1;
        const index = this.sequence('closeBracket');
        return `√[${index}](${this.group()})`;
      }
      return `√(${this.group()})`;
    }
    if (name === 'text' || name === 'textrm' || name === 'mbox') {
      return this.group();
    }
    // A bar goes over what it covers, and comes after it in the braille — so it comes after it here.
    if (name === 'overline' || name === 'bar') return `${this.group()}‾`;
    // A binomial is a bracketed pair with the lower term written below the upper one.
    if (name === 'binom' || name === 'choose') {
      const upper = this.group();
      const lower = this.group();
      return `(${upper}_(${lower}))`;
    }
    if (TRANSPARENT.has(name)) return '';
    if (FUNCTIONS.has(name)) return name;
    if (name in SIGNS) return SIGNS[name];

    this.unknown.push(`\\${name}`);
    return name;
  }

  /** The argument of `\frac`, `^` or `_`: a braced group, or the single token that follows. */
  private group(): string {
    const token = this.tokens[this.at];
    if (!token) return '';
    if (token.kind === 'open') {
      this.at += 1;
      return this.sequence('close');
    }
    return this.one();
  }
}

/** Print LaTeX in the canonical form. Never throws. */
export function canonicalise(latex: string): Canonical {
  return new Printer(tokenize(latex)).run();
}

/**
 * Strip everything that is presentation rather than meaning, so two readings can be compared.
 *
 * Spaces go because Nemeth's spacing is a rule about braille, not about mathematics — it puts a
 * space either side of `=` and Braillix's input does not, and neither is wrong.
 */
export function comparable(text: string): string {
  return text.replace(/\s+/g, '');
}
