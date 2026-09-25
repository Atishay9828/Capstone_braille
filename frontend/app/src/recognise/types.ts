/**
 * Reading maths off a photograph.
 *
 * Recognition is a *provider*, never a requirement. The app is fully usable without it
 * available — you type instead — and every result lands in an editable field rather than being
 * committed on the model's say-so. A recogniser that cannot be corrected is a recogniser you
 * cannot trust in front of a class.
 */

/**
 * Only one provider exists, deliberately.
 *
 * A cloud vision provider was designed and then cut — see DECISIONS.md D5.1. Leaving 'cloud' in
 * this union while nothing implemented it would have been a lie in the type system, which is the
 * quietest kind.
 */
export type ProviderId = 'on-device';

export type ProviderState = 'unavailable' | 'loadable' | 'loading' | 'ready' | 'error';

/**
 * How much to trust a result.
 *
 * Deliberately NOT a percentage. This model does not emit a calibrated probability, and inventing
 * one would be exactly the kind of confident-sounding fiction this project exists to avoid. These
 * are observations we can actually defend:
 *
 *   good      — the output parses as maths and shows no sign of the model losing its way
 *   uncertain — it parses, but something looks off (very short, or the writing filled little of
 *               the frame)
 *   poor      — it does not parse as maths, or the model started repeating itself, which is what
 *               an autoregressive decoder does when it has run out of confidence
 */
export type Quality = 'good' | 'uncertain' | 'poor';

export interface RecognitionResult {
  readonly latex: string;
  readonly quality: Quality;
  /** Plain-language reasons behind the quality judgement. Shown to the user, not hidden. */
  readonly notes: readonly string[];
  readonly ms: number;
  readonly provider: ProviderId;
}

export interface ProviderStatus {
  readonly state: ProviderState;
  readonly reason?: string;
  readonly fix?: string;
  /** 0–1 while loading. */
  readonly progress?: number;
}

export interface RecognitionProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** Whether this provider could work here at all, before any loading is attempted. */
  probe(): Promise<ProviderStatus>;
  load(onProgress?: (progress: number, message: string) => void): Promise<void>;
  recognise(pixels: Float32Array): Promise<RecognitionResult>;
  dispose(): void;
}

/**
 * Judge a result without pretending to a probability we do not have.
 *
 * `parses` comes from actually running the LaTeX through the same parser the rest of the app uses,
 * which is the strongest signal available: if the maths engine cannot read it, the reader cannot
 * either, regardless of how confident the model felt.
 */
export function judge(latex: string, options: { parses: boolean; inkCoverage: number }): {
  quality: Quality;
  notes: string[];
} {
  const notes: string[] = [];
  const trimmed = latex.trim();

  if (!trimmed) {
    return { quality: 'poor', notes: ['The model returned nothing at all.'] };
  }

  // Autoregressive decoders loop when they lose the thread — "x x x x x" or "+++++".
  const repeating = /(.{2,10}?)\1{3,}/.test(trimmed);
  if (repeating) notes.push('The model started repeating itself, which usually means it could not read the writing.');

  if (!options.parses) notes.push('The result is not valid maths, so something was misread.');
  if (trimmed.length <= 2) notes.push('The result is very short — check that the whole expression was in frame.');
  if (options.inkCoverage > 0 && options.inkCoverage < 0.02) {
    notes.push('The writing filled very little of the photo. A closer picture usually reads better.');
  }

  if (!options.parses || repeating) return { quality: 'poor', notes };
  if (notes.length > 0) return { quality: 'uncertain', notes };

  return { quality: 'good', notes: ['Reads as valid maths.'] };
}
