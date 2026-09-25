/**
 * One line of trust, in plain words.
 *
 * Nearly every teacher who will use Braillix cannot read braille (D12.3), so this line is the
 * whole reason she can trust the dots: a second engine reads the cells back with its own
 * grammar and says what they mean. Silent policy inverted from Teach mode: while *preparing*
 * a line the verdict is always visible, because this is where trust gets built — green and
 * quiet when the readings agree, loud when they do not (D13.6).
 */

import { useReadback } from './useReadback';
import { useBraillix } from '../store';
import { useT } from './i18n';

export function VerdictLine() {
  const t = useT();
  const { result, reading } = useReadback();
  const translating = useBraillix((s) => s.translating);

  if (!result || translating) return null;

  const tone = result.verdict === 'agrees' ? 'good' : result.verdict === 'differs' ? 'bad' : 'warn';
  const label =
    result.verdict === 'agrees'
      ? t('verdict.agrees')
      : result.verdict === 'differs'
        ? t('verdict.differs')
        : t('verdict.unchecked');

  return (
    <p className={`verdict verdict--${tone}`} data-testid="readback-verdict" data-verdict={result.verdict}>
      <span className="verdict__mark" aria-hidden="true" />
      <span className="verdict__word">{label}</span>
      {/* The reading itself, always: what a braille reader would say the cells mean. This is
          the teacher SEEING the dots speak, which is where trust comes from — not from a tick. */}
      {reading && (
        <span className="verdict__reading num" data-testid="readback-reading">
          {reading}
        </span>
      )}
    </p>
  );
}
