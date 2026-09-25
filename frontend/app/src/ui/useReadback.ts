/**
 * The verdict for whatever is on the display right now.
 *
 * Two screens ask this question and they must not answer it differently: the Board, where a teacher
 * is preparing, and Teach mode, where they are one keypress from putting the line under a child's
 * fingers. One hook, one answer (CLAUDE.md Law 5).
 *
 * The two screens *show* it differently, and deliberately. The Board shows the reading whatever it
 * says, because that is where trust is built. Teach mode shows nothing at all when the verdict
 * agrees — a lesson is not a settings screen — and speaks up only when something is wrong, which is
 * the one moment a teacher genuinely needs to be interrupted.
 */

import { useBraillix } from '../store';
import { checkRoundTrip, checkSegment, type RoundTrip } from '../core/roundtrip';

export interface ReadbackVerdict {
  /** One per segment of the line, in order. Empty when there is nothing to check. */
  readonly trips: readonly RoundTrip[];
  /** The verdict for the line as a whole: the worst of its parts, since one wrong part is wrong. */
  readonly result: RoundTrip | null;
  /** Every segment's reading, joined — what a braille reader would say the whole line means. */
  readonly reading: string;
}

export function useReadback(): ReadbackVerdict {
  const translation = useBraillix((s) => s.translation);
  const mixedLine = useBraillix((s) => s.mixedLine);

  const trips: RoundTrip[] = mixedLine
    ? mixedLine.segments.map((segment) => checkSegment(segment.kind, segment.text, segment.latex, segment.cells))
    : translation && translation.cells.length > 0 && !translation.degraded
      ? [checkRoundTrip(translation.latex, translation.cells)]
      : [];

  const result =
    trips.find((trip) => trip.verdict === 'differs') ??
    trips.find((trip) => trip.verdict === 'unchecked') ??
    trips[0] ??
    null;

  return { trips, result, reading: trips.map((trip) => trip.reading).join(' ') };
}
