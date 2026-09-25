/**
 * The Device — everything about the physical display, in one place.
 *
 * Connecting a pod and looking up a cam position are the same job done by the same person on the
 * same afternoon; they were two top-level tabs because they were two files. The atlas is reference
 * material *about the device*, so it lives here, one click away, instead of occupying a fifth of a
 * teacher's navigation bar forever.
 */

import { useState } from 'react';
import { AtlasScreen } from './AtlasScreen';
import { HardwareScreen } from './HardwareScreen';
import { useT } from './i18n';

type DeviceTab = 'connect' | 'atlas';

export function DeviceScreen() {
  const t = useT();
  const [tab, setTab] = useState<DeviceTab>('connect');

  return (
    <div className="device">
      <div className="segmented device__tabs" role="group" aria-label={t('device.sections')}>
        <button
          type="button"
          className={`segmented__btn${tab === 'connect' ? ' is-current' : ''}`}
          aria-pressed={tab === 'connect'}
          data-testid="device-connect"
          onClick={() => setTab('connect')}
        >
          {t('device.connect')}
        </button>
        <button
          type="button"
          className={`segmented__btn${tab === 'atlas' ? ' is-current' : ''}`}
          aria-pressed={tab === 'atlas'}
          data-testid="device-atlas"
          onClick={() => setTab('atlas')}
        >
          {t('device.atlas')}
        </button>
      </div>

      {tab === 'connect' ? <HardwareScreen /> : <AtlasScreen />}
    </div>
  );
}
