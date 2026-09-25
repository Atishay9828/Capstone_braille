/**
 * Tidying what the recogniser emits.
 *
 * The model was trained on tokenised LaTeX, so it hands back one token at a time with spaces
 * between them: `\frac { 2 2 } { 7 }`. That is *valid* LaTeX and renders correctly — but a student
 * or teacher looking at it in the correction box sees noise, and a digit split into `2 2` looks
 * like an error even though it is not.
 *
 * Every rule here is conservative: it changes spacing, never meaning. `latexUnchanged()` is the
 * test that keeps it that way — the tidied and untidied forms must translate to the same braille.
 */

/** Collapse the model's token spacing into LaTeX a human would have written. */
export function tidyLatex(raw: string): string {
  let text = raw.trim();
  if (!text) return '';

  // The model's own spacing hints add nothing here.
  text = text.replace(/\\[,;!:]/g, ' ');

  // `~` is LaTeX's non-breaking space; the model sprinkles it around fractions and relations.
  // In maths it is spacing, nothing more — but in the correction box it reads as garbage.
  // (A `\~` accent would matter; `(?<!\\)` leaves it alone.)
  text = text.replace(/(?<!\\)~/g, ' ');

  text = text.replace(/\s+/g, ' ');

  // Rejoin split numbers: "2 2" -> "22". Only between digits, so "2 x" is untouched.
  let previous: string;
  do {
    previous = text;
    text = text.replace(/(\d) (?=\d)/g, '$1');
  } while (text !== previous);

  // A command keeps its space only when the next character could extend its name.
  text = text.replace(/(\\[a-zA-Z]+) (?![a-zA-Z])/g, '$1');

  // Braces, sub/superscripts and brackets do not need padding.
  text = text.replace(/ *([{}]) */g, '$1');
  text = text.replace(/ *([_^]) */g, '$1');
  text = text.replace(/([([]) /g, '$1');
  text = text.replace(/ ([)\]])/g, '$1');

  // Keep exactly one space around binary operators and relations — this is where readability
  // actually lives, and removing it would make "x^2+3x+2=0" a wall of characters.
  text = text.replace(/ *([+\-=<>]) */g, ' $1 ');

  return text.replace(/\s+/g, ' ').trim();
}
