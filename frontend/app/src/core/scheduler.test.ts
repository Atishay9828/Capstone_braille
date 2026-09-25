import { describe, expect, it } from 'vitest';
import {
  DisplayState,
  HALF_STEPS_PER_POSITION,
  describePlan,
  planRefresh,
  shortestArc,
} from './scheduler';

describe('shortestArc', () => {
  it('takes the short way round the 64-position cam', () => {
    // The whole point: 60 -> 2 is six positions forward, not fifty-eight backward.
    expect(shortestArc(60, 2)).toBe(6);
    expect(shortestArc(2, 60)).toBe(-6);
  });

  it('is zero for no movement', () => {
    expect(shortestArc(19, 19)).toBe(0);
  });

  it('handles the simple forward case', () => {
    expect(shortestArc(0, 5)).toBe(5);
    expect(shortestArc(5, 0)).toBe(-5);
  });

  it('resolves an exact half turn deterministically (forward)', () => {
    expect(shortestArc(0, 32)).toBe(32);
    expect(shortestArc(32, 0)).toBe(32);
  });

  it('never proposes a rotation longer than half a turn', () => {
    for (let from = 0; from < 64; from += 1) {
      for (let to = 0; to < 64; to += 1) {
        expect(Math.abs(shortestArc(from, to))).toBeLessThanOrEqual(32);
      }
    }
  });
});

describe('planRefresh', () => {
  it('commands every cell when the display state is unknown', () => {
    const plan = planRefresh(null, [1, 2, 3]);
    expect(plan.fullRefresh).toBe(true);
    expect(plan.cellsMoved).toBe(3);
  });

  it('moves only the cells that actually changed', () => {
    const plan = planRefresh([1, 2, 3, 4], [1, 9, 3, 4]);
    expect(plan.fullRefresh).toBe(false);
    expect(plan.cellsMoved).toBe(1);
    expect(plan.moves[0]).toMatchObject({ cell: 1, from: 2, to: 9 });
  });

  it('moves nothing when nothing changed', () => {
    const plan = planRefresh([1, 2, 3], [1, 2, 3]);
    expect(plan.moves).toEqual([]);
    expect(plan.halfStepsPlanned).toBe(0);
    expect(describePlan(plan)).toMatch(/no motion needed/);
  });

  it('costs each move in real half-steps from the handoff (4096 / 64 = 64)', () => {
    expect(HALF_STEPS_PER_POSITION).toBe(64);
    const plan = planRefresh([0], [3]);
    expect(plan.halfStepsPlanned).toBe(3 * 64);
  });

  it('saves a large amount of travel on the wrap-around case', () => {
    const plan = planRefresh([60], [2]);
    expect(plan.moves[0].delta).toBe(6);
    expect(plan.halfStepsPlanned).toBe(6 * 64);
    // The naive strategy rotates forward the long way: 6 positions vs… also 6 here, because
    // forward-only from 60 to 2 wraps too. The saving shows up in the reverse direction:
    const reverse = planRefresh([2], [60]);
    expect(reverse.moves[0].delta).toBe(-6);
    expect(reverse.halfStepsPlanned).toBe(6 * 64);
    expect(reverse.halfStepsNaive).toBe(58 * 64);
  });

  it('treats a changed display width as untrustworthy state', () => {
    // Cells were added or removed — we cannot know what any of them show.
    const plan = planRefresh([1, 2], [1, 2, 3]);
    expect(plan.fullRefresh).toBe(true);
    expect(plan.cellsMoved).toBe(3);
  });

  it('reports the saving in a form a human can read', () => {
    const plan = planRefresh([2, 2, 2, 2], [60, 2, 2, 2]);
    const text = describePlan(plan);
    expect(text).toContain('1 of 4 cells moving');
    expect(text).toMatch(/less motor travel/);
  });
});

describe('DisplayState', () => {
  it('starts out knowing nothing, so the first frame is a full refresh', () => {
    const state = new DisplayState();
    expect(state.known).toBeNull();
    expect(state.plan([1, 2]).fullRefresh).toBe(true);
  });

  it('remembers only what was actually committed', () => {
    const state = new DisplayState();
    const first = state.plan([1, 2]);
    // Not committed yet — the transport has not confirmed. Still a full refresh.
    expect(state.plan([1, 2]).fullRefresh).toBe(true);
    state.commit(first);
    expect(state.plan([1, 2]).fullRefresh).toBe(false);
    expect(state.plan([1, 2]).cellsMoved).toBe(0);
  });

  it('forgets everything when told the display state is uncertain', () => {
    // Reconnect, re-home, error, profile change — uncertainty costs a resend, never correctness.
    const state = new DisplayState();
    state.commit(state.plan([1, 2]));
    state.invalidate();
    expect(state.known).toBeNull();
    expect(state.plan([1, 2]).fullRefresh).toBe(true);
  });

  it('does not alias the committed array', () => {
    const state = new DisplayState();
    const target = [1, 2, 3];
    state.commit(state.plan(target));
    target[0] = 99;
    expect(state.plan([1, 2, 3]).cellsMoved).toBe(0);
  });
});
