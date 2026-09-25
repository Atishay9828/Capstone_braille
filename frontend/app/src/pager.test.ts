/**
 * The pager — lines → panes → cells, one continuous walk.
 *
 * A blind student reads the blackboard by walking it: Next through the panes of a line, and
 * past its last pane on to the next line of the working. These tests prove the walk has no
 * seams: the edge of a line hands over to the lesson, backwards entry lands on the LAST pane,
 * and the edges of the board itself are hard stops, not wrap-arounds.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useBraillix } from './store';
import { useLesson } from './lesson';

/** Wait until the store's async translation settles for the given source. */
async function settled(source: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const s = useBraillix.getState();
    if (s.source === source && !s.translating) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`translation never settled for: ${source}`);
}

beforeEach(async () => {
  localStorage.clear();
  useLesson.setState({ lines: [], currentIndex: null });
  // One simulated cell — the hardware that exists today, and the hardest case for paging.
  const store = useBraillix.getState();
  await store.switchToSimulator();
  store.setCellCount(1);
  store.updateSettings({ speechOn: false });
});

describe('paging within one line', () => {
  it('walks panes forward and back without leaving the line', async () => {
    useLesson.getState().addLine('x + 1', { kind: 'typed' });
    await settled('x + 1');
    const total = useBraillix.getState().activeCells.length;
    expect(total).toBeGreaterThan(1);

    expect(useBraillix.getState().windowStart).toBe(0);
    useBraillix.getState().page(1);
    expect(useBraillix.getState().windowStart).toBe(1);
    useBraillix.getState().page(-1);
    expect(useBraillix.getState().windowStart).toBe(0);
    expect(useLesson.getState().currentIndex).toBe(0);
  });
});

describe('paging across lines', () => {
  it('continues past the end of a line into the next line of the lesson', async () => {
    useLesson.getState().addLine('x', { kind: 'typed' });
    await settled('x');
    useLesson.getState().addLine('y', { kind: 'typed' });
    await settled('y');
    useLesson.getState().selectLine(0);
    await settled('x');

    // Walk to the end of line 1, then one more press crosses to line 2.
    const total = useBraillix.getState().activeCells.length;
    for (let i = 1; i < total; i += 1) useBraillix.getState().page(1);
    expect(useLesson.getState().currentIndex).toBe(0);
    useBraillix.getState().page(1);
    expect(useLesson.getState().currentIndex).toBe(1);
    await settled('y');
    expect(useBraillix.getState().windowStart).toBe(0);
  });

  it('paging backwards into a line lands on its LAST pane, not its first', async () => {
    useLesson.getState().addLine('x + 1', { kind: 'typed' });
    await settled('x + 1');
    useLesson.getState().addLine('y', { kind: 'typed' });
    await settled('y');

    useBraillix.getState().page(-1); // off the top of line 2, back into line 1
    await settled('x + 1');
    const s = useBraillix.getState();
    expect(useLesson.getState().currentIndex).toBe(0);
    expect(s.windowStart).toBe(s.activeCells.length - 1); // 1-cell display: last pane = last cell
  });

  it('the edges of the board are hard stops', async () => {
    useLesson.getState().addLine('x', { kind: 'typed' });
    await settled('x');
    useBraillix.getState().page(-1);
    useBraillix.getState().page(-1);
    expect(useLesson.getState().currentIndex).toBe(0);
    const total = useBraillix.getState().activeCells.length;
    for (let i = 0; i < total + 3; i += 1) useBraillix.getState().page(1);
    expect(useLesson.getState().currentIndex).toBe(0); // nowhere to go — still the only line
  });
});
