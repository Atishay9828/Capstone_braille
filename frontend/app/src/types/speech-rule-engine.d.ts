/**
 * Types for speech-rule-engine.
 *
 * The package ships as CommonJS with no `types` entry, so TypeScript sees `any`. Rather than
 * silence that with a blanket `declare module`, this file states the exact surface Braillix
 * depends on. If a future SRE release changes one of these signatures, the compiler tells us
 * instead of the hardware doing it.
 *
 * Contract verified against speech-rule-engine 4.1.4.
 */
declare module 'speech-rule-engine' {
  interface SpeechRuleEngine {
    /**
     * Configure the global engine. `json` is the directory to load locale files from — Braillix
     * always passes a local path so the engine never reaches a CDN.
     */
    setupEngine(features: Record<string, unknown>): Promise<void>;

    /** Resolves once the configured locale data has finished loading. */
    engineReady(): Promise<unknown>;

    /**
     * Render MathML in the currently configured modality. With `modality: 'braille'` and
     * `locale: 'nemeth'` this returns a Unicode-braille string; with `modality: 'speech'` it
     * returns spoken text.
     */
    toSpeech(mathml: string): string;

    /** MathML annotated with `data-semantic-*` attributes. */
    toEnriched(mathml: string): unknown;

    /** The semantic tree as a plain object. */
    toJson(mathml: string): unknown;

    /** Engine version string, e.g. "4.1.4". */
    version?: string;
  }

  const sre: SpeechRuleEngine;
  export default sre;
}
