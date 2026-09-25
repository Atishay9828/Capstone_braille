/**
 * The syllabus, proven live — on this machine, in front of whoever is asking.
 *
 * docs/ACCURACY.md is the same evidence on paper; this is the button that regenerates it in
 * the browser, so "does it cover class 11–12?" is answered by WATCHING every curriculum line
 * translate and round-trip, not by trusting a document. Every line is translated exactly the
 * way the Board translates it, and read back by the engines that never saw the input.
 *
 * Pure engine code: no React, no I/O beyond what translate already does.
 */

import { SYLLABUS } from './syllabus';
import { translateMixed } from './mixed';
import { checkSegment } from './roundtrip';

export interface CoverageLineFailure {
  readonly source: string;
  readonly problem: string;
}

export interface TopicCoverage {
  readonly topic: string;
  readonly classes: string;
  readonly total: number;
  readonly clean: number;
  readonly failures: readonly CoverageLineFailure[];
}

export interface CoverageReport {
  readonly topics: readonly TopicCoverage[];
  readonly total: number;
  readonly clean: number;
  readonly ms: number;
}

/** Walk the whole syllabus. `onProgress` is called after each topic so a screen can narrate. */
export async function proveCoverage(
  onProgress?: (done: number, total: number, topic: string) => void,
): Promise<CoverageReport> {
  const started = performance.now();
  const topics: TopicCoverage[] = [];
  let done = 0;
  const grandTotal = SYLLABUS.reduce((n, t) => n + t.entries.length, 0);

  for (const topic of SYLLABUS) {
    const failures: CoverageLineFailure[] = [];

    for (const entry of topic.entries) {
      try {
        const line = await translateMixed(entry.source);
        const issues = line.segments.flatMap((s) => s.issues).filter((i) => i.kind !== 'engine');
        const trips = line.segments.map((s) => checkSegment(s.kind, s.text, s.latex, s.cells));
        const differs = trips.filter((t) => t.verdict === 'differs');

        if (line.cells.length === 0) {
          failures.push({ source: entry.source, problem: 'produced no braille' });
        } else if (issues.length > 0) {
          failures.push({ source: entry.source, problem: issues[0].message });
        } else if (differs.length > 0) {
          failures.push({
            source: entry.source,
            problem: `read back as “${differs[0].reading}”, expected “${differs[0].expected}”`,
          });
        }
      } catch (err) {
        failures.push({ source: entry.source, problem: err instanceof Error ? err.message : String(err) });
      }
      done += 1;
    }

    topics.push({
      topic: topic.topic,
      classes: topic.classes,
      total: topic.entries.length,
      clean: topic.entries.length - failures.length,
      failures,
    });
    onProgress?.(done, grandTotal, topic.topic);
    // Yield between topics so the screen can paint and speech stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    topics,
    total: grandTotal,
    clean: topics.reduce((n, t) => n + t.clean, 0),
    ms: Math.round(performance.now() - started),
  };
}
