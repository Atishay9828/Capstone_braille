/**
 * The Hardware screen — the seam, made visible and adjustable.
 *
 * Three things live here, and each answers a specific risk named in the brief or the handoff:
 *
 *   1. **Connection.** Simulator, USB, or Wi-Fi pod. USB is the recommendation for a demo because
 *      it needs no network, and the brief says the room's Wi-Fi may not cooperate.
 *   2. **What is actually there.** The chain is *discovered* — pods, I2C addresses, firmware — and
 *      shown, so nobody has to trust a number that came from a config file.
 *   3. **Calibration.** The handoff flags the cam bit order as unconfirmed against the physical
 *      cam. Raise one dot; if the wrong dot pops up, fix the mapping here. Ten seconds, no
 *      re-flash, no code change — and export the result for the hardware team.
 */

import { useState } from 'react';
import { useBraillix } from '../store';
import { SIMULATOR_MAX_CELLS, SIMULATOR_MIN_CELLS } from '../config';
import { DOT_COUNT, maskToUnicode, type DotNumber } from '../core/braille';
import { exportCalibration, toCam, type BitOrder } from '../core/profile';
import type { PodMode } from '../transport/httppod';
import { dotsToMask } from '../core/braille';
import { DisplayDock } from './DisplayDock';
import { useT } from './i18n';
import './HardwareScreen.css';

const DOTS: DotNumber[] = [1, 2, 3, 4, 5, 6];

export function HardwareScreen() {
  const t = useT();
  const profile = useBraillix((s) => s.profile);
  const linkStatus = useBraillix((s) => s.linkStatus);
  const linkLabel = useBraillix((s) => s.linkLabel);
  const linkFirmware = useBraillix((s) => s.linkFirmware);
  const linkError = useBraillix((s) => s.linkError);
  const linkFix = useBraillix((s) => s.linkFix);
  const connectUsb = useBraillix((s) => s.connectUsb);
  const connectPods = useBraillix((s) => s.connectPods);
  const switchToSimulator = useBraillix((s) => s.switchToSimulator);
  const homeDisplay = useBraillix((s) => s.homeDisplay);
  const testDot = useBraillix((s) => s.testDot);
  const testingDot = useBraillix((s) => s.testingDot);
  const setBitOrder = useBraillix((s) => s.setBitOrder);
  const setReversed = useBraillix((s) => s.setReversed);
  const setCellCount = useBraillix((s) => s.setCellCount);
  const usbCap = useBraillix((s) => s.capabilities.usb);

  /**
   * Empty, with the shape shown as a hint rather than filled in.
   *
   * It used to open with 192.168.1.42 already in the box, which looks exactly like a pod somebody
   * has already set up — so the honest first move, pressing Connect, failed against an address that
   * was never real. The placeholder shows two addresses on purpose: that is how a teacher discovers
   * that more than one pod is possible, and typing a second one is what reveals mirror mode.
   */
  const [podAddresses, setPodAddresses] = useState('');
  /*
   * Everything below the connection is for whoever assembled the display, once. A teacher opening
   * this screen wants to know what is plugged in and how to plug something in — putting cam bit
   * order in front of them is the difference between a device screen and an engineering console.
   */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [podMode, setPodMode] = useState<PodMode>('chain');
  const [copied, setCopied] = useState(false);

  /** The addresses actually typed, with the blanks a trailing comma leaves behind removed. */
  const hosts = podAddresses.split(',').map((host) => host.trim()).filter(Boolean);

  const simulated = profile.source === 'simulated';

  function changeBit(dotIndex: number, bit: number) {
    // A bit order must stay a permutation, so assigning a bit swaps it with whoever had it.
    const next = [...profile.bitOrder] as number[];
    const previousHolder = next.indexOf(bit);
    if (previousHolder !== -1) next[previousHolder] = next[dotIndex];
    next[dotIndex] = bit;
    setBitOrder(next as unknown as BitOrder);
  }

  async function copyCalibration() {
    const config = exportCalibration(profile);
    const text = JSON.stringify(config, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="hw">
      <header className="hw__head">
        <h1 className="read__title">{t('hw.title')}</h1>
        <p className="read__lede">{t('hw.lede')}</p>
      </header>

      <div className="hw__grid">
        {/* ------------------------------------------------------------------ connection */}
        <section className="panel" aria-labelledby="conn-heading">
          <h2 id="conn-heading" className="panel__title">
            {t('hw.connection')}
          </h2>

          <dl className="facts">
            <div className="facts__row">
              <dt>{t('hw.now')}</dt>
              <dd className="num" data-testid="link-label">
                {linkLabel} · <span className={`state state--${linkStatus}`}>{linkStatus}</span>
              </dd>
            </div>
            <div className="facts__row">
              <dt>{t('hw.cells')}</dt>
              <dd className="num" data-testid="link-cells">
                {profile.cellCount} {simulated ? t('hw.simulated') : t('hw.reported')}
              </dd>
            </div>
            {linkFirmware && (
              <div className="facts__row">
                <dt>{t('hw.firmware')}</dt>
                <dd className="num">{linkFirmware}</dd>
              </div>
            )}
            <div className="facts__row">
              <dt>{t('hw.pods')}</dt>
              <dd className="num">
                {profile.pods
                  .map((pod) =>
                    pod.cellAddrs.length
                      ? `${pod.label}: ${pod.cellAddrs.map((a) => `0x${a.toString(16)}`).join(' ')}`
                      : pod.label,
                  )
                  .join(' · ')}
              </dd>
            </div>
          </dl>

          <div className="hw__actions">
            <button type="button" className="btn" onClick={() => void switchToSimulator()} data-testid="use-sim">
              {t('hw.useSim')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void connectUsb()}
              disabled={usbCap.state === 'unavailable'}
              data-testid="connect-usb"
              title={usbCap.state === 'unavailable' ? (usbCap.reason ?? '') : t('hw.usbHint')}
            >
              {t('hw.connectUsb')}
            </button>
          </div>

          <label className="field field--inline">
            <span className="field__label">{t('hw.wifiPods')}</span>
            <div className="hw__row">
              <input
                className="field__input num"
                value={podAddresses}
                spellCheck={false}
                placeholder="192.168.1.42, 192.168.1.43"
                name="pod-hosts" data-testid="pod-hosts"
                onChange={(event) => setPodAddresses(event.target.value)}
              />
              <button
                type="button"
                className="btn"
                data-testid="connect-pods"
                /* Nothing typed, nothing to connect to. A button that reports a failure the moment
                   you press it is a button that taught you nothing. */
                disabled={hosts.length === 0}
                onClick={() => void connectPods(hosts, podMode)}
              >
                {t('hw.connect')}
              </button>
            </div>
          </label>
          {/* Only worth asking once there is more than one address: with one pod the two modes
              are the same thing, and a control that changes nothing is a control that confuses. */}
          {hosts.length > 1 && (
            <fieldset className="hw__modes">
              <legend className="field__label">{t('hw.podMode')}</legend>
              {(['chain', 'mirror'] as const).map((mode) => (
                <label key={mode} className="hw__mode">
                  <input
                    type="radio"
                    name="pod-mode"
                    value={mode}
                    checked={podMode === mode}
                    data-testid={`pod-mode-${mode}`}
                    onChange={() => setPodMode(mode)}
                  />
                  <span>
                    <strong>{t(mode === 'chain' ? 'hw.chain' : 'hw.mirror')}</strong>
                    <small>{t(mode === 'chain' ? 'hw.chainHint' : 'hw.mirrorHint')}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <p className="hw__note">{t('hw.noPod')}</p>

          {linkError && (
            <p className="notice notice--bad" role="alert" data-testid="link-error">
              {linkError}
              {linkFix && <span className="notice__fix">{linkFix}</span>}
            </p>
          )}

          {simulated && (
            <label className="cellcount cellcount--block">
              <span className="cellcount__label">{t('hw.simCells')}</span>
              <input
                className="cellcount__range"
                type="range"
                min={SIMULATOR_MIN_CELLS}
                max={SIMULATOR_MAX_CELLS}
                value={profile.cellCount}
                name="hw-cell-count" data-testid="hw-cell-count"
                onChange={(event) => setCellCount(Number(event.target.value))}
              />
              <output className="cellcount__value num">{profile.cellCount}</output>
            </label>
          )}
        </section>


        {/* The cells, next to the thing that drives them.
            `DisplayDock` says it in its own header comment: anywhere that drives the cells must
            also show them. This screen changes the cell count, raises a test dot and sends frames
            down a wire, and until now it showed none of it — a teacher pressed "raise dot 3" and
            got a cam number. The claim at the top of this page is that connecting a pod changes
            nothing except where the frames go; this is that claim, visible. */}
        <section className="panel" aria-labelledby="dock-heading">
          <DisplayDock title="hw.onTheCells" hint="hw.onTheCellsHint" showCellCount={false} showPaging={false} />
        </section>
      </div>

      <button
        type="button"
        className="hw__disclosure"
        aria-expanded={showAdvanced}
        data-testid="show-advanced"
        onClick={() => setShowAdvanced((current) => !current)}
      >
        <span className="hw__disclosurehead">
          <strong>{t('hw.advanced')}</strong>
          <small>{t('hw.advancedHint')}</small>
        </span>
        <span className="hw__disclosureaction">{showAdvanced ? t('hw.hide') : t('hw.show')}</span>
      </button>

      {/* ------------------------------------------------------------------ calibration */}
      <section className="panel" aria-labelledby="cal-heading" hidden={!showAdvanced}>
        <h2 id="cal-heading" className="panel__title">
          {t('hw.calibration')}
        </h2>
        <p className="panel__lede">{t('hw.calLede')}</p>

        <div className="dottest" role="group" aria-label={t('hw.raiseDot')}>
          {DOTS.map((dot) => (
            <button
              key={dot}
              type="button"
              className={`dottest__btn${testingDot === dot ? ' is-current' : ''}`}
              data-testid={`test-dot-${dot}`}
              onClick={() => void testDot(testingDot === dot ? null : dot)}
            >
              <span className="dottest__num num">{dot}</span>
              <span className="dottest__cam num">{t('hw.cam', { position: toCam(profile, dotsToMask([dot])) })}</span>
            </button>
          ))}
          <button type="button" className="btn" onClick={() => void testDot(null)} data-testid="test-clear">
            {t('hw.clear')}
          </button>
        </div>

        <table className="bitmap">
          <caption className="visually-hidden">{t('hw.whichTrack')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('hw.dot')}</th>
              <th scope="col">{t('hw.camBit')}</th>
            </tr>
          </thead>
          <tbody>
            {profile.bitOrder.map((bit, dotIndex) => (
              <tr key={dotIndex}>
                <th scope="row" className="num">
                  {t('hw.dotN', { dot: dotIndex + 1 })}
                </th>
                <td>
                  <select
                    className="select num"
                    value={bit}
                    name={`bit-for-dot-${dotIndex + 1}`}
                    data-testid={`bit-for-dot-${dotIndex + 1}`}
                    onChange={(event) => changeBit(dotIndex, Number(event.target.value))}
                  >
                    {Array.from({ length: DOT_COUNT }, (_, b) => (
                      <option key={b} value={b}>
                        {t('hw.bitN', { bit: b })}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <label className="switch">
          <input
            type="checkbox"
            checked={profile.reversed}
            data-testid="reversed"
            onChange={(event) => setReversed(event.target.checked)}
          />
          <span>{t('hw.reversed')}</span>
        </label>

        <div className="hw__actions">
          <button type="button" className="btn" onClick={() => void homeDisplay()} data-testid="home">
            {t('hw.home')}
          </button>
          <button type="button" className="btn" onClick={() => void copyCalibration()} data-testid="copy-calibration">
            {copied ? t('hw.copied') : t('hw.copyConfig')}
          </button>
        </div>

        <p className="hw__note">
          <code>{maskToUnicode(dotsToMask([1, 2, 5]))}</code>{' '}
          {t('hw.sanity', { position: toCam(profile, dotsToMask([1, 2, 5])) })}
        </p>
      </section>

      <section className="panel" aria-labelledby="proto-heading" hidden={!showAdvanced}>
        <h2 id="proto-heading" className="panel__title">
          {t('hw.wire')}
        </h2>
        <p className="panel__lede">{t('hw.wireLede')}</p>
        <pre className="wirecode">
{`GET  /chain   → {"cells":[32,33,34,35],"count":4,"firmware":"braillix-pod/1.0"}
POST /show    ← {"positions":[19,5,12,60]}        full frame
POST /show    ← {"updates":[{"cell":2,"position":19}]}   only what changed
POST /home    ← {}
GET  /buttons → {"prev":0,"select":1,"next":0,"seq":42}`}
        </pre>
        <p className="hw__note">{t('hw.protoNote')}</p>
      </section>
    </div>
  );
}
