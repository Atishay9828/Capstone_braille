/**
 * A textbook question, cut into the parts that are words and the parts that are mathematics.
 *
 * This is the visible half of `core/mixed.ts`. The splitter is a heuristic — it has to be, since
 * "sum" is both an operator and an English noun — so instead of hiding that behind a confident
 * answer, the guess is laid out in the open: every part shows which braille code it will be
 * written in, and one click flips it. A teacher fixes a wrong guess in a second and can *see* that
 * it is fixed, which is worth far more than a cleverer guess they would have to trust.
 */

import { useBraillix } from '../store';
import { MathPreview } from './MathPreview';
import { endonymOf } from '../core/indic';
import { useT, type StringKey } from './i18n';
import './QuestionStrip.css';

const CODE_LABEL: Record<string, StringKey> = {
  nemeth: 'code.nemeth',
  bharati: 'code.bharati',
  literary: 'code.literary',
};

export function QuestionStrip() {
  const t = useT();
  const line = useBraillix((s) => s.mixedLine);
  const flipSegment = useBraillix((s) => s.flipSegment);

  if (!line || line.segments.length === 0) return null;

  return (
    <div className="qstrip" data-testid="question-strip">
      <div className="qstrip__parts">
        {line.segments.map((segment, index) => (
          <button
            key={`${index}:${segment.text}`}
            type="button"
            className={`qseg qseg--${segment.kind}`}
            data-testid={`segment-${segment.kind}`}
            title={t('mixed.flip')}
            aria-label={`${segment.text} — ${
              segment.script ? `Bharati ${endonymOf(segment.script)}` : t(CODE_LABEL[segment.code])
            }. ${t('mixed.flip')}`}
            onClick={() => flipSegment(segment.text)}
          >
            <span className="qseg__body">
              {segment.kind === 'maths' ? (
                <MathPreview latex={segment.latex} label={segment.text} />
              ) : (
                <span className="qseg__words">{segment.text}</span>
              )}
            </span>
            <span className="qseg__code">
              {/* The script's own name, where there is one: a Bengali teacher should see বাংলা,
                  not a word for Bengali in a language they were not writing in. */}
              {segment.script ? `Bharati · ${endonymOf(segment.script)}` : t(CODE_LABEL[segment.code])}
            </span>
          </button>
        ))}
      </div>

      {line.mixed && <p className="qstrip__note">{t('mixed.switchNote')}</p>}
    </div>
  );
}
