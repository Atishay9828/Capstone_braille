/**
 * The lesson store — the blackboard's memory.
 *
 * The display side (what the dots say) is the main store's job and is tested there; here we
 * prove the stack itself behaves: order kept, selection sane after removal, reload survival,
 * and — the law — that a recognised line is unrepresentable without its confirmation.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useLesson, type LineOrigin } from './lesson';

function reset() {
  localStorage.clear();
  useLesson.setState({ lines: [], currentIndex: null });
}

describe('the blackboard keeps the lesson', () => {
  beforeEach(reset);

  it('adds lines in teaching order and follows the newest one', () => {
    useLesson.getState().addLine('2x + 3 = 11', { kind: 'typed' });
    useLesson.getState().addLine('2x = 8', { kind: 'typed' });
    const { lines, currentIndex } = useLesson.getState();
    expect(lines.map((l) => l.source)).toEqual(['2x + 3 = 11', '2x = 8']);
    expect(currentIndex).toBe(1);
  });

  it('refuses a blank line rather than writing nothing on the board', () => {
    useLesson.getState().addLine('   ', { kind: 'typed' });
    expect(useLesson.getState().lines).toHaveLength(0);
  });

  it('keeps the selection pointing at the same line when an earlier one is rubbed out', () => {
    const s = useLesson.getState();
    s.addLine('a', { kind: 'typed' });
    s.addLine('b', { kind: 'typed' });
    s.addLine('c', { kind: 'typed' });
    useLesson.getState().selectLine(2);
    useLesson.getState().removeLine(0);
    const { lines, currentIndex } = useLesson.getState();
    expect(lines.map((l) => l.source)).toEqual(['b', 'c']);
    expect(currentIndex).toBe(1); // still line "c"
  });

  it('drops the selection when the selected line itself is rubbed out', () => {
    useLesson.getState().addLine('a', { kind: 'typed' });
    useLesson.getState().removeLine(0);
    expect(useLesson.getState().currentIndex).toBeNull();
  });

  it('steps through the board like Prev/Next buttons, stopping at the edges', () => {
    const s = useLesson.getState();
    s.addLine('a', { kind: 'typed' });
    s.addLine('b', { kind: 'typed' });
    useLesson.getState().step(-1);
    expect(useLesson.getState().currentIndex).toBe(0);
    useLesson.getState().step(-1);
    expect(useLesson.getState().currentIndex).toBe(0); // the top of the board, not -1
    useLesson.getState().step(1);
    expect(useLesson.getState().currentIndex).toBe(1);
    useLesson.getState().step(1);
    expect(useLesson.getState().currentIndex).toBe(1); // the bottom, not past it
  });

  it('survives a reload through localStorage', () => {
    useLesson.getState().addLine('x^2 = 9', { kind: 'typed' });
    const stored = localStorage.getItem('braillix.lesson.v1');
    expect(stored).toContain('x^2 = 9');
  });

  it('editing a line to nothing rubs it out instead of leaving a blank line', () => {
    useLesson.getState().addLine('a', { kind: 'typed' });
    useLesson.getState().editLine(0, '   ');
    expect(useLesson.getState().lines).toHaveLength(0);
  });
});

describe('the confirm gate is structural', () => {
  beforeEach(reset);

  it('accepts a recognised line only with its literal confirmation', () => {
    const confirmed: LineOrigin = { kind: 'recognised', confirmed: true };
    useLesson.getState().addLine('\\frac{1}{2}', confirmed);
    expect(useLesson.getState().lines[0].origin).toEqual(confirmed);

    // The law itself: `confirmed: false` (or absent) must not compile. If either line below
    // ever stops being a type error, the gate has been dismantled — fail the build.
    // @ts-expect-error a recognised line cannot be unconfirmed
    const rejected: LineOrigin = { kind: 'recognised', confirmed: false };
    void rejected;
    // @ts-expect-error a recognised line cannot omit confirmation
    const silent: LineOrigin = { kind: 'recognised' };
    void silent;
  });
});
