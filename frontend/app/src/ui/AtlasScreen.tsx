/**
 * The Cell Atlas — all 64 cam positions, what dots they raise, and what they mean in Nemeth.
 *
 * This page is as much for the hardware team as for the student: it is the sheet you hold against
 * the physical cam to check that track order is right. Printing it is a supported use.
 */

import { useMemo } from 'react';
import { PATTERN_COUNT, maskToDots, maskToUnicode } from '../core/braille';
import { toCam } from '../core/profile';
import { useBraillix } from '../store';
import { BrailleCell } from './BrailleCell';
import { NEMETH_MEANINGS } from '../core/nemeth-meanings';
import { useT } from './i18n';
import './AtlasScreen.css';

export function AtlasScreen() {
  const t = useT();
  const profile = useBraillix((s) => s.profile);

  const rows = useMemo(
    () =>
      Array.from({ length: PATTERN_COUNT }, (_, mask) => ({
        mask,
        cam: toCam(profile, mask),
        dots: maskToDots(mask),
        unicode: maskToUnicode(mask),
        meaning: NEMETH_MEANINGS[mask] ?? '',
      })),
    [profile],
  );

  return (
    <div className="atlas">
      <header className="atlas__head">
        <h1 className="read__title">{t('atlas.title')}</h1>
        <p className="read__lede">{t('atlas.lede')}</p>
        <p className="atlas__profile num">
          {t('atlas.profile', {
            order: profile.bitOrder.join(' '),
            order2: profile.reversed ? t('atlas.reversed') : t('atlas.normal'),
          })}
        </p>
      </header>

      <div className="atlas__grid">
        {rows.map((row) => (
          <figure key={row.mask} className="atlas__item">
            <BrailleCell dots={row.mask} cam={row.cam} index={row.mask} bare />
            <figcaption className="atlas__caption">
              <span className="atlas__cam num">{t('atlas.cam', { position: String(row.cam).padStart(2, '0') })}</span>
              <span className="atlas__dots num">{row.dots.join('-') || t('atlas.blank')}</span>
              {row.meaning && <span className="atlas__meaning">{row.meaning}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
