/**
 * The evidence panel.
 *
 * The display shows a window; this shows the whole run and the numbers behind it — the Nemeth
 * string, every cell's dots, and the exact cam position that would travel down the I2C bus. It
 * exists so nothing about the translation is hidden behind the pretty dots, and so the hardware
 * team can check a real expression against a real cam without asking anyone.
 */

import { useBraillix } from '../store';
import { maskToDots, maskToUnicode, type DotMask } from '../core/braille';
import { toCam } from '../core/profile';
import { cellsToUnicode } from '../core/translate';
import { NEMETH_MEANINGS } from '../core/nemeth-meanings';
import { bharatiMeaning } from '../core/bharatiback';
import { literalMeaning } from '../core/literalback';
import type { BrailleCode } from '../core/mixed';
import { useT } from './i18n';
import './DisplayStrip.css';

export function DisplayStrip() {
  const t = useT();
  const activeCells = useBraillix((s) => s.activeCells);
  const profile = useBraillix((s) => s.profile);
  const windowStart = useBraillix((s) => s.windowStart);
  const cellCodes = useBraillix((s) => s.cellCodes);
  const setWindowStart = useBraillix((s) => s.setWindowStart);

  const cells = activeCells;

  if (cells.length === 0) {
    return (
      <section className="evidence" aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className="read__h2">
          {t('display.braille')}
        </h2>
        <p className="evidence__empty">{t('evidence.empty')}</p>
      </section>
    );
  }

  const visibleFrom = windowStart;
  const visibleTo = windowStart + profile.cellCount;

  return (
    <section className="evidence" aria-labelledby="evidence-heading">
      <div className="evidence__head">
        <h2 id="evidence-heading" className="read__h2">
          {t('display.braille')}
        </h2>
        <p className="evidence__count num">
          {t(cells.length === 1 ? 'evidence.countOne' : 'evidence.count', {
            count: cells.length,
            codes: codesOnTheStrip(cellCodes, t),
          })}
        </p>
      </div>

      <p className="evidence__unicode" lang="en">
        {cellsToUnicode(cells)}
      </p>

      <div className="evidence__scroll">
        <table className="wire">
          <caption className="visually-hidden">{t('evidence.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('evidence.col.index')}</th>
              <th scope="col">{t('evidence.col.cell')}</th>
              <th scope="col">{t('evidence.col.dots')}</th>
              <th scope="col">{t('evidence.col.meaning')}</th>
              <th scope="col">{t('evidence.col.cam')}</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((mask, index) => {
              const onDisplay = index >= visibleFrom && index < visibleTo;
              return (
                <tr key={index} className={onDisplay ? 'is-on-display' : undefined}>
                  <td className="num">{index + 1}</td>
                  <td className="wire__glyph">
                    <button
                      type="button"
                      className="wire__jump"
                      title={t('evidence.jump', { index: index + 1 })}
                      onClick={() => setWindowStart(index)}
                    >
                      {maskToUnicode(mask)}
                    </button>
                  </td>
                  <td className="num">{maskToDots(mask).join('-') || '—'}</td>
                  {/* The column that lets a teacher who does not read Nemeth follow the line. */}
                  <td className="wire__meaning">{meaningOf(mask, cellCodes?.[index] ?? 'nemeth')}</td>
                  <td className="num wire__cam">{toCam(profile, mask)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="evidence__foot">{t('evidence.foot')}</p>
    </section>
  );
}


/**
 * What this cell means, in the code it is actually written in.
 *
 * The strip used to reach for the Nemeth table whatever was on the display, so a Hindi question was
 * annotated as though it were mathematics — ⠛ described as "letter g" when it is ग, and ⠼ as
 * "numeric indicator" when it is ण. Each code has its own reading, and each is shown.
 */
function meaningOf(mask: DotMask, code: BrailleCode): string {
  const braille = maskToUnicode(mask);
  if (code === 'bharati') return bharatiMeaning(braille);
  if (code === 'literary') return literalMeaning(braille);
  return NEMETH_MEANINGS[mask];
}

/** The codes actually present on the strip, named in the order a reader meets them. */
function codesOnTheStrip(codes: readonly BrailleCode[] | null, t: ReturnType<typeof useT>): string {
  const names: Record<BrailleCode, string> = {
    nemeth: t('strip.nemeth'),
    bharati: t('strip.bharati'),
    literary: t('strip.literary'),
  };
  if (!codes || codes.length === 0) return names.nemeth;
  const present: BrailleCode[] = [];
  for (const code of codes) if (!present.includes(code)) present.push(code);
  return present.map((code) => names[code]).join(' + ');
}
