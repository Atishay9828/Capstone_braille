/**
 * The status strip — CLAUDE.md Law 3 made visible.
 *
 * Every optional capability declares its state here, permanently, with the reason it is not ready
 * and what to do about it. A user should never have to wonder whether a feature is missing or
 * merely broken; and a panel should be able to see, at a glance, that nothing is being hidden.
 */

import { rankedCapabilities, useBraillix, type CapabilityId, type CapabilityState } from '../store';
import { describeProfile } from '../core/profile';
import { useT, type StringKey } from './i18n';
import './StatusStrip.css';

const STATE_LABEL: Record<CapabilityState, StringKey> = {
  ready: 'status.ready',
  checking: 'status.checking',
  degraded: 'status.degraded',
  unavailable: 'status.off',
};

/**
 * What each capability is called, in the interface's language.
 *
 * The *reasons* and *fixes* below stay in English on purpose: they name Web Serial, npm commands
 * and file paths, and a half-translated `npm install` helps nobody. The frame is translated; the
 * diagnostics are quoted. (DECISIONS D7.8.)
 */
const CAP_LABEL: Record<CapabilityId, StringKey> = {
  sre: 'cap.sre',
  speech: 'cap.speech',
  recognition: 'cap.recognition',
  usb: 'cap.usb',
  pod: 'cap.pod',
  offline: 'cap.offline',
};

export function StatusStrip() {
  const t = useT();
  const capabilities = useBraillix((s) => s.capabilities);
  const profile = useBraillix((s) => s.profile);
  const planSummary = useBraillix((s) => s.planSummary);

  const items = rankedCapabilities(capabilities);

  return (
    <footer className="strip" aria-label={t('status.title')}>
      <div className="strip__group">
        <span className="strip__key">{t('status.display')}</span>
        <span className="strip__value num">{describeProfile(profile)}</span>
      </div>

      <div className="strip__group strip__group--grow">
        <span className="strip__key">{t('status.motion')}</span>
        <span className="strip__value num" data-testid="plan-summary">
          {planSummary || t('status.idle')}
        </span>
      </div>

      <ul className="strip__caps">
        {items.map(({ id, capability }) => (
          <li key={id} className={`cap cap--${capability.state}`}>
            <span className="cap__led" aria-hidden="true" />
            <span className="cap__label">{t(CAP_LABEL[id])}</span>
            <span className="cap__state">{t(STATE_LABEL[capability.state])}</span>
            {capability.reason && <span className="cap__reason">{capability.reason}</span>}
            {capability.fix && <span className="cap__fix">{capability.fix}</span>}
          </li>
        ))}
      </ul>
    </footer>
  );
}
