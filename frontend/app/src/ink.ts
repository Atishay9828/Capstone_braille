/**
 * Ghost ink — the board remembering the teacher's hand.
 *
 * When a line arrives by writing, the strokes that produced it are kept and drawn faintly
 * behind the typeset line, the way real chalk stays under a corrected working. Held in memory
 * only, never persisted: a lesson's PNGs would blow through the localStorage quota and take
 * the lesson itself with them (DECISIONS D-V4), and the ink is a memory of *this* class, not
 * a record.
 */

const ghosts = new Map<string, string>();

export function rememberInk(lineId: string, pngDataUrl: string): void {
  ghosts.set(lineId, pngDataUrl);
}

export function ghostInkFor(lineId: string): string | undefined {
  return ghosts.get(lineId);
}

export function forgetInk(lineId: string): void {
  ghosts.delete(lineId);
}
