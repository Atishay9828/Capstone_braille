/**
 * Help — and, more usefully, proof.
 *
 * Two things a teacher needs that no amount of good design replaces: a short answer to "how do I
 * run a lesson with this", and a way to find out whether the laptop in front of them is actually
 * going to work before twelve children are waiting. The second is a button that does the work —
 * translating a known expression, fetching the braille tables from disk, writing to storage — and
 * then says what happened in words, with the fix next to anything that is not right.
 *
 * It is also the honest answer to a panel: press it and every claim in the demo is checked live.
 */

import { useState } from 'react';
import { useBraillix } from '../store';
import { runSelfCheck, reportToText, type CheckId, type CheckNote, type CheckResult } from '../core/selfcheck';
import { proveCoverage, type CoverageReport } from '../core/coverage';
import { voiceFor } from './speech';
import { webSerialSupported } from '../transport/webserial';
import { useT, useLang, type StringKey } from './i18n';
import './HelpScreen.css';

const CHECK_LABEL: Record<CheckId, StringKey> = {
  engine: 'check.engine',
  nemeth: 'check.nemeth',
  readback: 'check.readback',
  bharati: 'check.bharati',
  offline: 'check.offline',
  storage: 'check.storage',
  recognition: 'check.recognition',
  speech: 'check.speech',
  usb: 'check.usb',
};

const STATE_LABEL = { pass: 'check.pass', warn: 'check.warn', fail: 'check.fail' } as const;

const STEPS: StringKey[] = ['help.step1', 'help.step2', 'help.step3', 'help.step4', 'help.step5'];

const KEYS: { keys: string[]; what: StringKey }[] = [
  { keys: ['←', '→', '↑', '↓'], what: 'help.keysReader' },
  { keys: ['space'], what: 'help.keysSay' },
  { keys: ['PgUp', 'PgDn'], what: 'help.keysTeach' },
];

export function HelpScreen() {
  const t = useT();
  const language = useLang();
  const capabilities = useBraillix((s) => s.capabilities);

  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Every check's sentence, in the language the teacher is reading. */
  const say = (note: CheckNote) => t(note.key, note.vars);

  async function run() {
    setRunning(true);
    setCopied(false);
    try {
      // The voice's own name if it has one, and words the teacher can read if it does not.
      const voice = voiceFor(language);
      const outcome = await runSelfCheck({
        voice: { available: voice.available, name: voice.name ?? t('check.someVoice') },
        language: t('check.systemLanguage'),
        usbSupported: webSerialSupported(),
      });
      setResults(outcome);
    } finally {
      setRunning(false);
    }
  }

  async function copy() {
    if (!results) return;
    const names = Object.fromEntries(
      (Object.keys(CHECK_LABEL) as CheckId[]).map((id) => [id, t(CHECK_LABEL[id])]),
    ) as Record<CheckId, string>;
    try {
      await navigator.clipboard.writeText(reportToText(results, names, say, new Date().toISOString()));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const worst = results
    ? results.some((result) => result.state === 'fail')
      ? 'fail'
      : results.some((result) => result.state === 'warn')
        ? 'warn'
        : 'pass'
    : null;

  return (
    <div className="help">
      <header className="help__head">
        <h1 className="read__title">{t('help.title')}</h1>
        <p className="read__lede">{t('help.lede')}</p>
      </header>

      <div className="help__grid">
        <section className="panel" aria-labelledby="check-heading">
          <h2 id="check-heading" className="panel__title">
            {t('help.check')}
          </h2>
          <p className="panel__lede">{t('help.checkLede')}</p>

          <div className="hw__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={running}
              data-testid="run-selfcheck"
              onClick={() => void run()}
            >
              {running ? t('help.running') : t('help.run')}
            </button>
            {results && (
              <button type="button" className="btn" data-testid="copy-report" onClick={() => void copy()}>
                {copied ? t('help.copied') : t('help.copy')}
              </button>
            )}
          </div>

          {worst && (
            <p className={`notice ${worst === 'fail' ? 'notice--bad' : worst === 'warn' ? 'notice--warn' : ''}`} role="status" data-testid="selfcheck-summary">
              {worst === 'fail' ? t('help.someFail') : worst === 'warn' ? t('help.someWarn') : t('help.allWell')}
            </p>
          )}

          {results && (
            <ul className="checks" data-testid="selfcheck-results">
              {results.map((result) => (
                <li key={result.id} className={`check check--${result.state}`}>
                  <span className="check__led" aria-hidden="true" />
                  <span className="check__body">
                    <span className="check__name">
                      {t(CHECK_LABEL[result.id])}
                      <span className="check__state">{t(STATE_LABEL[result.state])}</span>
                    </span>
                    <span className="check__detail">{say(result.detail)}</span>
                    {result.fix && <span className="check__fix">{say(result.fix)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Before the check has been run, the status strip's own view is still the honest one. */}
          {!results && (
            <p className="hw__note">
              {Object.values(capabilities).filter((capability) => capability.state === 'ready').length} /{' '}
              {Object.keys(capabilities).length}
            </p>
          )}

          <CoveragePanel />
        </section>

        {/*
          The syllabus, proven live. "Does it cover class 11–12?" gets answered by watching
          every curriculum line translate and read back on this very machine — the founder's
          instruction was to make the answer visible, not to assert it.
        */}
        <section className="panel" aria-labelledby="howto-heading">
          <h2 id="howto-heading" className="panel__title">
            {t('help.howTo')}
          </h2>
          <ol className="help__steps">
            {STEPS.map((step) => (
              <li key={step}>{t(step)}</li>
            ))}
          </ol>

          <h2 className="panel__title help__keysheading">{t('help.keys')}</h2>
          <ul className="help__keys">
            {KEYS.map((row) => (
              <li key={`${row.what}-${row.keys.join('')}`}>
                <span className="help__keycaps">
                  {row.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
                <span>{t(row.what)}</span>
              </li>
            ))}
          </ul>

          <h2 className="panel__title help__keysheading">{t('help.about')}</h2>
          <p className="help__about">{t('help.aboutText')}</p>
        </section>
      </div>
    </div>
  );
}

/**
 * The syllabus, proven on this machine.
 *
 * One button walks every line of the committed curriculum — arithmetic to calculus, classes
 * 1 through 12 — through the same pipeline the Board uses, and reads each result back with
 * the engines that never saw the input. The teacher (or the panel) watches the counts climb.
 */
function CoveragePanel() {
  const t = useT();
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function prove() {
    setReport(null);
    setProgress({ done: 0, total: 1 });
    try {
      const outcome = await proveCoverage((done, total) => setProgress({ done, total }));
      setReport(outcome);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="coverage">
      <h2 className="panel__title help__keysheading">{t('cov.title')}</h2>
      <p className="panel__lede">{t('cov.lede')}</p>

      <div className="hw__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={progress !== null}
          data-testid="prove-coverage"
          onClick={() => void prove()}
        >
          {progress
            ? t('cov.running', { done: progress.done, total: progress.total })
            : t('cov.run')}
        </button>
      </div>

      {report && (
        <>
          <p
            className={`notice ${report.clean === report.total ? 'notice--good' : 'notice--warn'}`}
            role="status"
            data-testid="coverage-summary"
          >
            {t('cov.summary', {
              clean: report.clean,
              total: report.total,
              topics: report.topics.length,
              s: (report.ms / 1000).toFixed(1),
            })}
          </p>
          <ul className="checks" data-testid="coverage-results">
            {report.topics.map((topic) => (
              <li
                key={topic.topic}
                className={`check check--${topic.clean === topic.total ? 'pass' : 'warn'}`}
              >
                <span className="check__led" aria-hidden="true" />
                <span className="check__body">
                  <span className="check__name">
                    {topic.topic}
                    <span className="check__state num">
                      {topic.clean}/{topic.total} · {t('cov.classes', { classes: topic.classes })}
                    </span>
                  </span>
                  {topic.failures.map((failure) => (
                    <span key={failure.source} className="check__fix num">
                      {failure.source} — {failure.problem}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
