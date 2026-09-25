/**
 * What a maths teacher actually types.
 *
 * Arcs 1–6 asked for LaTeX. That was the right internal representation and the wrong thing to put
 * in front of a person: research (RESEARCH.md part two, verdict 2) says nobody at a school for the
 * blind is going to write `\frac{1}{2}` — they are going to write `1/2`, and if the box rejects it
 * the product has failed before the braille is ever reached.
 *
 * So this file is a small, complete parser for school mathematics as it is written by hand:
 *
 *     1/2            ->  \frac{1}{2}
 *     (x+1)/(x-1)    ->  \frac{x+1}{x-1}
 *     sqrt(9)        ->  \sqrt{9}
 *     2 <= x         ->  2 \le x
 *     45 degrees     ->  45^{\circ}
 *     3 x 4          ->  3 \times 4          (a number, the letter x, a number — a teacher's cross)
 *     Rs 250         ->  \text{Rs }250
 *     sin^2 A        ->  \sin^{2}A
 *
 * LaTeX still works: anything starting with a backslash is carried through untouched, so an
 * expression pasted from a textbook, from the recogniser, or written by someone who does know LaTeX
 * behaves exactly as it did before. The two notations mix freely in one line.
 *
 * TWO RULES WORTH KNOWING, both of them visible in the on-screen preview:
 *   · `/` takes everything written so far in the current product as its numerator and the next
 *     single term as its denominator — so `2x/3` is (2x)/3, and `1/2 x` is (1/2)x.
 *   · a run of two or more letters is a product of variables (`ab` is a times b), which is what a
 *     maths line means. Words belong in `core/mixed.ts`, where they are handled explicitly.
 *
 * It never throws and never returns nothing: a line it cannot fully understand still produces the
 * best LaTeX it can, plus an issue saying what confused it (CLAUDE.md Law 4).
 */

/* ------------------------------------------------------------------ vocabulary */

/** Functions a school maths line can contain. Emitted as LaTeX operators so they stay upright. */
const FUNCTIONS: Readonly<Record<string, string>> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  sec: '\\sec',
  cosec: '\\csc',
  csc: '\\csc',
  cot: '\\cot',
  sinh: '\\sinh',
  cosh: '\\cosh',
  tanh: '\\tanh',
  arcsin: '\\arcsin',
  arccos: '\\arccos',
  arctan: '\\arctan',
  log: '\\log',
  ln: '\\ln',
  lg: '\\lg',
  exp: '\\exp',
  lim: '\\lim',
  max: '\\max',
  min: '\\min',
  gcd: '\\gcd',
  det: '\\det',
};

/** Functions that wrap their argument in a shape of their own rather than juxtaposing it. */
const WRAPPING: Readonly<Record<string, (argument: string) => string>> = {
  sqrt: (argument) => `\\sqrt{${argument}}`,
  root: (argument) => `\\sqrt{${argument}}`,
  cbrt: (argument) => `\\sqrt[3]{${argument}}`,
  abs: (argument) => `\\left|${argument}\\right|`,
  bar: (argument) => `\\overline{${argument}}`,
  mean: (argument) => `\\overline{${argument}}`,
};

/** Greek letters, written by name. Capitalised name gives the capital letter where one exists. */
const GREEK = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'pi',
  'rho',
  'sigma',
  'tau',
  'phi',
  'chi',
  'psi',
  'omega',
] as const;

const CAPITAL_GREEK = new Set(['Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega']);

/** Words that stand for a symbol on their own. */
const WORD_SYMBOLS: Readonly<Record<string, string>> = {
  infinity: '\\infty',
  infty: '\\infty',
  times: '\\times',
  into: '\\times',
  div: '\\div',
  // "twelve by four" is division in Indian English, and "divided by" must not come out as two
  // division signs — so the word that carries the meaning is `by`, and `divided` introduces it.
  divided: '',
  by: '\\div',
  plusminus: '\\pm',
  therefore: '\\therefore',
  because: '\\because',
  angle: '\\angle',
  triangle: '\\triangle',
  parallel: '\\parallel',
  perp: '\\perp',
  approx: '\\approx',
  equiv: '\\equiv',
  propto: '\\propto',
  subseteq: '\\subseteq',
  supset: '\\supset',
  cup: '\\cup',
  cap: '\\cap',
  // The words a class 11 sets chapter is actually taught in. `cap`/`cup` are what LaTeX calls
  // them; `union`/`intersection` are what a teacher calls them, and both must be the symbol —
  // "A union B" split down the middle was v5 audit gap G1.
  union: '\\cup',
  intersect: '\\cap',
  intersection: '\\cap',
  // The conditional-probability bar, as a word and via the (A|B) rewrite in `toLatex`.
  mid: '\\mid',
  in: '\\in',
  notin: '\\notin',
  subset: '\\subset',
  to: '\\to',
  sum: '\\sum',
  prod: '\\prod',
  int: '\\int',
  integral: '\\int',
};

/**
 * Words in the table above that stand for a BINARY operator.
 *
 * They need something on their left, so where there is nothing — the start of a line, the inside of
 * a freshly opened bracket, straight after another operator — the word is a word. `mixed.ts` keeps
 * its own copy of this rule for the start of a line, because it decides before this parser is ever
 * called; the two lists are short and each is checked by its own test.
 */
const NEEDS_A_LEFT_OPERAND = new Set([
  'in',
  'by',
  'to',
  'cup',
  'cap',
  'union',
  'intersect',
  'intersection',
  'mid',
  'subset',
  'subseteq',
  'supset',
  'notin',
]);

/** Two- and three-character sequences that mean one thing. Longest first — order matters. */
const MULTI: readonly (readonly [string, string])[] = [
  ['<=', '\\le'],
  ['>=', '\\ge'],
  ['!=', '\\ne'],
  ['~=', '\\approx'],
  ['==', '='],
  ['+-', '\\pm'],
  ['-+', '\\mp'],
  ['->', '\\to'],
  ['**', '^'],
  ['//', '/'],
];

/** Single characters that map straight to a LaTeX symbol. */
const SYMBOLS: Readonly<Record<string, string>> = {
  '×': '\\times',
  '÷': '\\div',
  '±': '\\pm',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '≈': '\\approx',
  '∞': '\\infty',
  '√': '\\sqrt',
  '∠': '\\angle',
  '∴': '\\therefore',
  '·': '\\cdot',
  '−': '-',
  '–': '-',
  '—': '-',
  '’': "'",
};

/* ------------------------------------------------------------------ tokens */

type TokenKind =
  | 'number'
  | 'name' // a run of letters — variables, functions, greek, words
  | 'latex' // a backslash command, carried through whole
  | 'op'
  | 'open'
  | 'close'
  | 'degree'
  | 'percent'
  | 'rupee';

interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  /** Where it started, so an error can point at it. */
  readonly at: number;
  /** True when whitespace preceded this token — used for the `3 x 4` cross. */
  readonly spaced: boolean;
}

export interface MathInputIssue {
  readonly message: string;
  readonly fix?: string;
}

export interface MathInputResult {
  readonly latex: string;
  readonly issues: readonly MathInputIssue[];
  /** True when the input already was LaTeX and came through untouched. Used only for messages. */
  readonly wasLatex: boolean;
}

const LETTER = /[A-Za-z]/;
const DIGIT = /[0-9]/;

/**
 * Read one balanced `{…}` or `[…]` group starting at `start`, returning its end index.
 *
 * Used only for LaTeX passthrough: once a backslash command is seen, its arguments belong to it and
 * must not be re-interpreted, or `\frac{1}{2}` would come out as a fraction of a fraction.
 */
function matchGroup(source: string, start: number, open: string, close: string): number {
  if (source[start] !== open) return start;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return source.length; // unbalanced — the caller reports it
}

function tokenise(source: string, issues: MathInputIssue[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let spaced = false;

  const push = (kind: TokenKind, text: string, at: number) => {
    tokens.push({ kind, text, at, spaced });
    spaced = false;
  };

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      spaced = true;
      i += 1;
      continue;
    }

    // A LaTeX command and everything it owns.
    if (char === '\\') {
      const start = i;
      i += 1;
      if (i < source.length && !LETTER.test(source[i])) {
        // \{ \} \% \, — an escaped single character.
        i += 1;
      } else {
        while (i < source.length && LETTER.test(source[i])) i += 1;
      }
      // Optional [..] then any number of {..} arguments.
      if (source[i] === '[') i = matchGroup(source, i, '[', ']');
      while (source[i] === '{') {
        const end = matchGroup(source, i, '{', '}');
        if (end === i) break;
        i = end;
      }
      push('latex', source.slice(start, i), start);
      continue;
    }

    if (DIGIT.test(char)) {
      const start = i;
      while (i < source.length && DIGIT.test(source[i])) i += 1;
      // Indian and international digit grouping: 1,000 and 1,00,000 — but not the comma in {1,2,3}.
      while (source[i] === ',' && /^\d{2,3}(?!\d)/.test(source.slice(i + 1))) {
        i += 1;
        while (i < source.length && DIGIT.test(source[i])) i += 1;
      }
      if (source[i] === '.' && DIGIT.test(source[i + 1] ?? '')) {
        i += 1;
        while (i < source.length && DIGIT.test(source[i])) i += 1;
      }
      push('number', source.slice(start, i), start);
      continue;
    }

    if (LETTER.test(char)) {
      const start = i;
      while (i < source.length && LETTER.test(source[i])) i += 1;
      const word = source.slice(start, i);
      const lower = word.toLowerCase();
      // Written-out units behave exactly like the symbol a teacher would have typed.
      if (lower === 'degrees' || lower === 'degree' || lower === 'deg') push('degree', '°', start);
      else if (lower === 'percent') push('percent', '%', start);
      else push('name', word, start);
      continue;
    }

    if (char === '°') {
      push('degree', '°', i);
      i += 1;
      continue;
    }
    if (char === '%') {
      push('percent', '%', i);
      i += 1;
      continue;
    }
    if (char === '₹') {
      push('rupee', '₹', i);
      i += 1;
      continue;
    }

    const two = source.slice(i, i + 2);
    const multi = MULTI.find(([text]) => text === two);
    if (multi) {
      push('op', multi[1], i);
      i += 2;
      continue;
    }

    if (SYMBOLS[char]) {
      push('op', SYMBOLS[char], i);
      i += 1;
      continue;
    }

    if ('([|'.includes(char)) {
      push('open', char, i);
      i += 1;
      continue;
    }
    if (')]'.includes(char)) {
      push('close', char, i);
      i += 1;
      continue;
    }
    // Braces are sets here, because a LaTeX command has already eaten its own arguments above.
    if (char === '{') {
      push('open', '{', i);
      i += 1;
      continue;
    }
    if (char === '}') {
      push('close', '}', i);
      i += 1;
      continue;
    }

    if ('+-*/^_=<>,.;:!\'"'.includes(char)) {
      push('op', char, i);
      i += 1;
      continue;
    }

    issues.push({
      message: `“${char}” is not something Braillix can put in a maths line.`,
      fix: 'Remove it, or write the words separately in the question box.',
    });
    i += 1;
  }

  return tokens;
}

/* ------------------------------------------------------------------ emitting */

/** Join two LaTeX fragments, adding a space only where one would otherwise change the meaning. */
function cat(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  const needsSpace = /\\[a-zA-Z]+$/.test(left) && /^[a-zA-Z0-9]/.test(right);
  return left + (needsSpace ? ' ' : '') + right;
}

function braced(latex: string): string {
  // Single characters and complete groups do not need another layer of braces.
  if (latex.length === 1) return latex;
  return `{${latex}}`;
}

/* ------------------------------------------------------------------ the parser */

class Parser {
  #tokens: Token[];
  #index = 0;
  #issues: MathInputIssue[];
  /** How many `|…|` we are inside. A bar can only open a new term when we are not inside one. */
  #barDepth = 0;

  constructor(tokens: Token[], issues: MathInputIssue[]) {
    this.#tokens = tokens;
    this.#issues = issues;
  }

  #peek(offset = 0): Token | undefined {
    return this.#tokens[this.#index + offset];
  }

  #take(): Token | undefined {
    return this.#tokens[this.#index++];
  }

  #atOp(...texts: string[]): boolean {
    const token = this.#peek();
    return token?.kind === 'op' && texts.includes(token.text);
  }

  /** The whole line: relations chained left to right, as `1 < x < 5` genuinely is. */
  parse(): string {
    let latex = this.#sum();
    while (this.#index < this.#tokens.length) {
      const token = this.#peek()!;
      if (token.kind === 'op' && ['=', '<', '>', '\\le', '\\ge', '\\ne', '\\approx', '\\to', '\\in', '\\subset'].includes(token.text)) {
        this.#take();
        latex = cat(cat(latex, token.text), this.#sum());
        continue;
      }
      if (token.kind === 'close') {
        this.#issues.push({
          message: `There is a closing “${token.text}” with nothing to close.`,
          fix: 'Delete it, or add the opening bracket.',
        });
        this.#take();
        continue;
      }
      if (token.kind === 'op' && [',', ';', '.', ':', "'", '"', '!'].includes(token.text)) {
        // Keep parsing after it. This used to take the mark and `continue`, so everything past the
        // first comma fell through to the stray branch below and was appended letter by letter:
        // `triangle ABC, angle A` reached the display as △ABC, then the LETTERS a-n-g-l-e, then A.
        // A comma separates two pieces of mathematics; it does not end the mathematics.
        this.#take();
        latex = cat(cat(latex, token.text), this.#sum());
        continue;
      }
      // Anything else at this level is a stray; take it verbatim rather than dropping it silently.
      this.#take();
      latex = cat(latex, token.text);
    }
    return latex;
  }

  #sum(): string {
    let latex = this.#product();
    while (this.#atOp('+', '-', '\\pm', '\\mp', '\\cup', '\\cap')) {
      const op = this.#take()!;
      latex = cat(cat(latex, op.text), this.#product());
    }
    return latex;
  }

  /**
   * A product, including division.
   *
   * `/` turns everything accumulated so far into a numerator. That is the rule that makes `2x/3`
   * mean what a teacher means by it, and it is why this is not simply a binary operator.
   *
   * But "everything so far" stops at an explicit multiplication sign. A teacher writing
   * `3/4 x 2/5` means two fractions multiplied, not one fraction stacked inside another — so the
   * × acts as a wall, and only the factors written since it become the numerator:
   *
   *     3/4 x 2/5   →   \frac{3}{4} \times \frac{2}{5}      (not \frac{\frac{3}{4}\times 2}{5})
   *     2x/3        →   \frac{2x}{3}                        (no × written, so nothing is walled off)
   *     n(n+1)/2    →   \frac{n(n+1)}{2}                    (juxtaposition is not an explicit ×)
   *
   * `wall` holds everything up to and including the last explicit multiplication; `factors` holds
   * what has been written since. The product is the two of them joined.
   */
  #product(): string {
    let wall = '';
    let factors = this.#unary();
    const multiply = (symbol: string) => {
      wall = cat(cat(wall, factors), symbol);
      factors = this.#unary();
    };
    for (;;) {
      if (this.#atOp('/')) {
        this.#take();
        const denominator = this.#unary();
        factors = `\\frac{${unwrapBrackets(factors) || '{}'}}{${unwrapBrackets(denominator) || '{}'}}`;
        continue;
      }
      if (this.#atOp('*', '\\times', '\\div', '\\cdot')) {
        const op = this.#take()!;
        multiply(op.text === '*' ? '\\times' : op.text);
        continue;
      }
      if (this.#isCrossX()) {
        this.#take(); // "3 x 4", "1/2 x b x h" — a lone spaced x between two operands is a cross
        multiply('\\times');
        continue;
      }
      if (this.#startsTerm()) {
        factors = cat(factors, this.#unary()); // implicit multiplication: 3x, 2(x+1), a b
        continue;
      }
      return cat(wall, factors);
    }
  }

  /** Could the next token begin another factor? Decides where implicit multiplication stops. */
  #startsTerm(): boolean {
    const token = this.#peek();
    if (!token) return false;
    if (token.kind === 'open' && token.text === '|') return this.#barDepth === 0;
    return token.kind === 'number' || token.kind === 'name' || token.kind === 'open' || token.kind === 'rupee' || token.kind === 'latex';
  }

  /**
   * The letter x, spaced, with an operand on each side — a teacher's handwritten multiplication.
   *
   * `3 x 4` was the easy case. The one that matters in a classroom is `1/2 x b x h`, the area of a
   * triangle, where the operands either side are letters rather than numbers. What keeps this from
   * eating real variables is that all three conditions must hold at once: the x stands alone with
   * spaces around it, something that can be multiplied comes before it, and something that can be
   * multiplied comes after. `y = m x + c` fails the last one — `+` is not an operand — so the x
   * there stays a variable, which is what it is.
   */
  #isCrossX(): boolean {
    const token = this.#peek();
    if (!token || token.kind !== 'name' || token.text !== 'x' || !token.spaced) return false;
    const previous = this.#tokens[this.#index - 1];
    const next = this.#peek(1);
    if (!previous || !next || next.spaced !== true) return false;
    const before = previous.kind === 'number' || previous.kind === 'name' || previous.kind === 'close';
    const after = next.kind === 'number' || next.kind === 'name' || next.kind === 'open';
    return before && after;
  }

  #unary(): string {
    if (this.#atOp('+', '-', '\\pm', '\\mp')) {
      const op = this.#take()!;
      return cat(op.text, this.#unary());
    }
    return this.#power();
  }

  /** An atom with everything that can hang off it: subscripts, superscripts, degree, percent, !. */
  #power(): string {
    let latex = this.#atom();
    for (;;) {
      /*
       * A name straight onto a bracket is ONE thing — an application or a tight product:
       * P(B), f(x), x(x+1). Binding it here (rather than as loose juxtaposition upstream)
       * is what makes `P(A)/P(B)` a fraction over ALL of P(B), and `1/x(x+1)` the partial-
       * fractions denominator a class 11 teacher means — not (1/x)·(x+1). Found by LOOKING
       * at the printed Bayes line, which showed (B) standing outside the fraction; the
       * round-trip could not catch it, because both engines were faithful to the same
       * mis-grouped LaTeX. Cells for products are unchanged: Nemeth writes tight and loose
       * juxtaposition identically.
       */
      const next = this.#peek();
      if (next?.kind === 'open' && next.text === '(' && /^[A-Za-z][A-Za-z]*$/.test(latex)) {
        latex = `${latex}${this.#atom()}`;
        continue;
      }
      if (this.#atOp('^')) {
        this.#take();
        latex = `${latex}^${braced(this.#script(true))}`;
        continue;
      }
      if (this.#atOp('_')) {
        this.#take();
        latex = `${latex}_${braced(this.#script(false))}`;
        continue;
      }
      const token = this.#peek();
      if (token?.kind === 'degree') {
        this.#take();
        latex = `${latex}^{\\circ}`;
        continue;
      }
      if (token?.kind === 'percent') {
        this.#take();
        latex = cat(latex, '\\%');
        continue;
      }
      if (token?.kind === 'op' && token.text === '!' && latex) {
        this.#take();
        latex = `${latex}!`;
        continue;
      }
      return latex;
    }
  }

  /**
   * The thing after a `^` or a `_`.
   *
   * Braces here are LaTeX grouping, not a set: `x^{10}` and `sum_{i=1}^{n}` are the two commonest
   * expressions in a school syllabus, and reading `{i=1}` as the set containing "i equals 1" would
   * put two extra bracket cells on the display and change what the child reads.
   */
  #script(superscript: boolean): string {
    const next = this.#peek();
    if (next?.kind === 'open' && next.text === '{') {
      this.#take();
      let inner = this.#sum();
      while (this.#atOp('=', '<', '>', '\\le', '\\ge', '\\ne', '\\in', '\\to', ',')) {
        const op = this.#take()!;
        inner = cat(cat(inner, op.text), this.#sum());
      }
      const close = this.#peek();
      if (close?.kind === 'close' && close.text === '}') this.#take();
      else this.#issues.push({ message: 'A “{” after ^ or _ is never closed.', fix: 'Add a “}”.' });
      return inner;
    }
    return superscript ? this.#unary() : this.#atom();
  }

  #atom(): string {
    const token = this.#take();
    if (!token) {
      this.#issues.push({
        message: 'The line stops in the middle of something.',
        fix: 'There is an operator with nothing after it.',
      });
      return '';
    }

    switch (token.kind) {
      case 'number':
        return token.text;

      case 'latex':
        return token.text;

      case 'rupee':
        return '\\text{Rs }';

      case 'open':
        return this.#group(token);

      case 'name':
        return this.#name(token);

      case 'degree':
        return '^{\\circ}';

      case 'percent':
        return '\\%';

      case 'op':
        // An operator where a value was expected: keep it, say so, carry on.
        this.#issues.push({
          message: `“${token.text}” has nothing before it to work on.`,
          fix: 'Check the line for a missing number or letter.',
        });
        return token.text;

      case 'close':
        this.#issues.push({
          message: `There is a closing “${token.text}” with nothing to close.`,
          fix: 'Delete it, or add the opening bracket.',
        });
        return '';
    }
  }

  #group(open: Token): string {
    const closers: Record<string, string> = { '(': ')', '[': ']', '{': '}', '|': '|' };
    const wanted = closers[open.text];
    if (open.text === '|') this.#barDepth += 1;
    const inner = this.#sum();

    // Relations are allowed inside brackets: (x = 1) and {x : x > 0} both occur in school maths.
    let latex = inner;
    while (this.#atOp('=', '<', '>', '\\le', '\\ge', '\\ne', '\\in', ',', ':', ';')) {
      const op = this.#take()!;
      latex = cat(cat(latex, op.text), this.#sum());
    }

    const next = this.#peek();
    if (open.text === '|') {
      this.#barDepth -= 1;
      // The closing bar is the same character as the opening one, so it arrives as an 'open' token.
      if (next?.kind === 'open' && next.text === '|') this.#take();
      else this.#issues.push({ message: 'A “|” is never closed.', fix: 'Absolute value needs a bar on both sides.' });
    } else if (next?.kind === 'close' && next.text === wanted) {
      this.#take();
    } else if (next?.kind === 'close') {
      this.#issues.push({
        message: `A “${open.text}” is closed by a “${next.text}”.`,
        fix: 'Brackets have to match — check the line.',
      });
      this.#take();
    } else {
      this.#issues.push({
        message: `The “${open.text}” bracket is never closed.`,
        fix: `Add a “${wanted}”.`,
      });
    }

    if (open.text === '{') return `\\{${latex}\\}`;
    if (open.text === '|') return `\\left|${latex}\\right|`;
    if (open.text === '[') return `[${latex}]`;
    return `(${latex})`;
  }

  #name(token: Token): string {
    const word = token.text;
    const lower = word.toLowerCase();

    if (lower === 'rs') {
      // "Rs 250" — the rupee has no Nemeth symbol, so it is written as the letters, which is what
      // an Indian braille reader expects. Same for the ₹ sign.
      return '\\text{Rs }';
    }

    const wrapping = WRAPPING[lower];
    if (wrapping) {
      const index = this.#index;
      const argument = this.#power();
      if (!argument) {
        this.#index = index;
        this.#issues.push({ message: `“${word}” has nothing to work on.`, fix: `Write ${lower}(9), for example.` });
        return '';
      }
      return wrapping(unwrapBrackets(argument));
    }

    const fn = FUNCTIONS[lower];
    if (fn) {
      // sin^2 x, log_10 100, lim_{x to 0} — the decoration binds to the function, not the argument.
      let head = fn;
      while (this.#atOp('^', '_')) {
        const op = this.#take()!;
        head = `${head}${op.text}${braced(this.#script(op.text === '^'))}`;
      }
      // `sin x / x` is (sin x) over x — a trig function binds only the factor next to it. `lim` is
      // the opposite: `lim_{x to 0} sin x / x` is the limit OF the quotient, and reading it any
      // other way gives 0/x, which is not what anybody wrote. So the limit takes the whole product.
      const wide = lower === 'lim';
      const argument = this.#startsTerm() ? (wide ? this.#product() : this.#power()) : '';
      return cat(head, argument);
    }

    if ((GREEK as readonly string[]).includes(lower) && word === lower) return `\\${lower}`;
    if (CAPITAL_GREEK.has(word)) return `\\${word}`;

    const symbol = WORD_SYMBOLS[lower];
    if (symbol !== undefined) {
      // A binary operator needs something on its left. "(in cm)" was reaching the display as
      // (∈ cm) — the bracket opened and the very next thing said "is a member of". Same rule as the
      // one `mixed.ts` applies at the start of a line, applied here at the start of a bracket.
      const previous = this.#tokens[this.#index - 2];
      const nothingToTheLeft = !previous || previous.kind === 'open' || previous.kind === 'op';
      if (nothingToTheLeft && NEEDS_A_LEFT_OPERAND.has(lower)) return word.split('').join('');
      return symbol;
    }

    // Anything else is variables: a run of letters is a product of them, as `ab` is on a maths line.
    return word.split('').join('');
  }
}

/** `(x+1)` handed to sqrt should become `\sqrt{x+1}`, not `\sqrt{(x+1)}`. */
function unwrapBrackets(latex: string): string {
  if (!latex.startsWith('(') || !latex.endsWith(')')) return latex;
  let depth = 0;
  for (let i = 0; i < latex.length; i += 1) {
    if (latex[i] === '(') depth += 1;
    else if (latex[i] === ')') {
      depth -= 1;
      if (depth === 0 && i !== latex.length - 1) return latex; // (a)(b) — not one group
    }
  }
  return latex.slice(1, -1);
}

/* ------------------------------------------------------------------ the entry point */

/**
 * Turn what the teacher wrote into LaTeX.
 *
 * Never throws. Anything it could not make sense of comes back as an issue with a fix, and the
 * LaTeX is still the best reading it could manage — because a display that keeps working while
 * saying what is wrong beats one that blanks (CLAUDE.md Law 4).
 */
export function toLatex(input: string): MathInputResult {
  let trimmed = input.trim();
  if (!trimmed) return { latex: '', issues: [], wasLatex: false };

  /*
   * Two spellings a senior class uses that the tokeniser cannot see locally (v5 audit):
   *
   * · A SPACED dot between two things is the multiplication dot — `vec(a) . vec(b)` is a dot
   *   product. A decimal point is never written with air around it, so the space is the whole
   *   signal, exactly as it is for the spaced x (D12.4).
   * · A bar inside a bracket with something on both sides is the conditional-probability bar —
   *   `P(A|B)`. Absolute-value bars come in pairs; this one is alone between two operands, and
   *   reading it as an opening |...| left the bracket "never closed".
   */
  trimmed = trimmed.replace(/(?<=\s)\.(?=\s)/g, '·');
  trimmed = trimmed.replace(/\(([^()|]+)\|([^()|]+)\)/g, '($1 mid $2)');

  const issues: MathInputIssue[] = [];
  const tokens = tokenise(trimmed, issues);
  let latex = new Parser(tokens, issues).parse();

  /*
   * `f: A -> B` — the colon that names a function's domain and codomain. As a bare relation
   * SRE writes the RATIO colon ⠐⠂, which unspaced after a letter is indistinguishable from
   * "f1" (D15.15), so the round-trip could never vouch for it. Braced, SRE writes the
   * punctuated colon ⠸⠒, which reads back as exactly what it is.
   */
  latex = latex.replace(/^([A-Za-z]):(?![=:])/, '$1{:}\\ ');

  const wasLatex = tokens.every((token) => token.kind === 'latex') && tokens.length > 0;
  return { latex, issues, wasLatex };
}

/**
 * Does this line need the natural-maths parser at all?
 *
 * Used only to decide whether to mention it in the interface. Anything with a backslash and no
 * bare `/` is already LaTeX and will pass through unchanged.
 */
export function looksLikeLatex(input: string): boolean {
  return /\\[a-zA-Z]/.test(input);
}

/**
 * Is this word part of the mathematics rather than the sentence around it?
 *
 * Used by `core/mixed.ts` to tell "sin" and "theta" from "the" and "value" when a teacher types a
 * word problem. Deliberately the same vocabulary the parser accepts, so the two can never disagree
 * about what counts as maths.
 */
export function isMathWord(word: string): boolean {
  // nCr, nPr, 5C2 — the combinatorics tokens, written exactly as a class 11 teacher writes
  // them. The capital C or P in the middle is the operator; the parser reads the run as the
  // juxtaposed letters Nemeth wants. Classified here so `mixed.ts` cannot take them for words.
  // Lowercase or digit either side, deliberately: nCr and 5C2 qualify, the acronyms OCR and
  // NCC do not — an all-caps word in a sentence is a word.
  if (/^[a-z0-9][CP][a-z0-9]$/.test(word)) return true;
  // The differentials: dx, dy, du, dv, dt — integration by parts is written in them, and a
  // "dv" taken for a word cut `int u dv = uv - int v du` in half. `do` is English and is
  // decided by the never-maths list before this is consulted.
  if (/^d[a-z]$/.test(word) && word !== 'do') return true;
  const lower = word.toLowerCase();
  return (
    lower in FUNCTIONS ||
    lower in WRAPPING ||
    lower in WORD_SYMBOLS ||
    (GREEK as readonly string[]).includes(lower) ||
    CAPITAL_GREEK.has(word) ||
    lower === 'rs' ||
    lower === 'deg' ||
    lower === 'degrees' ||
    lower === 'degree'
  );
}
