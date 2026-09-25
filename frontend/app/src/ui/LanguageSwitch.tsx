/**
 * One control, two languages, everywhere in the product.
 *
 * It lives in the masthead rather than buried in a settings screen because for the intended user it
 * is not a preference — it is the difference between an interface they can read and one they
 * cannot. Changing it also re-checks which voice this machine has, so the status strip tells the
 * truth immediately rather than at the next reload.
 */

import { useBraillix } from '../store';
import { LANGS, useLang, useT, setLang, type Lang } from './i18n';
import './LanguageSwitch.css';

export function LanguageSwitch() {
  const t = useT();
  const active = useLang();
  const refreshSpeech = useBraillix((s) => s.refreshSpeech);

  function choose(next: Lang) {
    setLang(next);
    refreshSpeech();
  }

  return (
    <div className="langswitch" role="group" aria-label={t('app.language')}>
      {LANGS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          lang={entry.id}
          className={`langswitch__btn${active === entry.id ? ' is-current' : ''}`}
          aria-pressed={active === entry.id}
          /*
            WCAG 2.5.3, Label in Name: whatever is written on a control must be part of its
            accessible name, or somebody driving the machine by voice cannot say the thing they can
            see. So the accessible name is "हिन्दी (Hindi)" rather than "Hindi" — the visible word
            first, and the English one after it for a voice that cannot pronounce Devanagari.
          */
          aria-label={entry.label === entry.english ? undefined : `${entry.label} (${entry.english})`}
          data-testid={`lang-${entry.id}`}
          onClick={() => choose(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
