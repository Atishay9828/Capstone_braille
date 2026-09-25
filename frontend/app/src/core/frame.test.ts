import { describe, expect, it } from 'vitest';
import { BLANK, dotsToMask } from './braille';
import { pageCount, pageWindow, renderFrame, windowFollowingCursor } from './frame';
import { simulatedProfile } from './profile';
import { describeWindow } from '../ui/window-label';
import { translate } from '../ui/i18n';

const RUN = [1, 2, 3, 4, 5, 6, 7]; // seven distinguishable dot masks

describe('renderFrame — works at any cell count', () => {
  // The brief's hardest constraint: 1, 2, 3 or many cells, no rewrite. So the same expression is
  // rendered at every width and must always be self-consistent.
  for (const width of [1, 2, 3, 4, 7, 20]) {
    it(`renders a ${width}-cell display`, () => {
      const frame = renderFrame(simulatedProfile(width), { cells: RUN });
      expect(frame.cells).toHaveLength(width);
      expect(frame.cam).toHaveLength(width);
      expect(frame.total).toBe(RUN.length);
      // Cells beyond the end of the run are blank, never undefined.
      for (const cell of frame.cells) expect(typeof cell).toBe('number');
    });
  }

  it('shows the first cells of the run by default', () => {
    expect(renderFrame(simulatedProfile(3), { cells: RUN }).cells).toEqual([1, 2, 3]);
  });

  it('pads with blanks when the run is shorter than the display', () => {
    const frame = renderFrame(simulatedProfile(5), { cells: [1, 2] });
    expect(frame.cells).toEqual([1, 2, BLANK, BLANK, BLANK]);
  });

  it('renders an empty run as an all-blank display rather than failing', () => {
    const frame = renderFrame(simulatedProfile(4), { cells: [] });
    expect(frame.cells).toEqual([BLANK, BLANK, BLANK, BLANK]);
    expect(frame.total).toBe(0);
  });

  it('clamps a window that would run off the end', () => {
    const frame = renderFrame(simulatedProfile(3), { cells: RUN, windowStart: 99 });
    expect(frame.windowStart).toBe(4);
    expect(frame.cells).toEqual([5, 6, 7]);
  });

  it('clamps a negative window', () => {
    expect(renderFrame(simulatedProfile(3), { cells: RUN, windowStart: -5 }).windowStart).toBe(0);
  });
});

describe('renderFrame — cam numbers', () => {
  it('derives cam values through the profile, never independently', () => {
    const mirrored = simulatedProfile(2, { bitOrder: [5, 4, 3, 2, 1, 0] });
    const frame = renderFrame(mirrored, { cells: [dotsToMask([1, 2, 5]), dotsToMask([1])] });
    expect(frame.cells).toEqual([19, 1]); // dot masks are untouched by wiring
    expect(frame.cam).toEqual([0b110010, 0b100000]); // cam values follow the wiring
  });
});

describe('renderFrame — reversed docks', () => {
  it('mirrors both the cells and the cursor', () => {
    const profile = simulatedProfile(3, { reversed: true });
    const frame = renderFrame(profile, { cells: RUN, windowStart: 0, cursor: 0 });
    expect(frame.cells).toEqual([3, 2, 1]);
    expect(frame.cursorCell).toBe(2); // logical cell 0 sits at the right-hand end
  });
});

describe('renderFrame — the cursor', () => {
  it('reports which display cell holds the cursor', () => {
    const frame = renderFrame(simulatedProfile(4), { cells: RUN, windowStart: 2, cursor: 3 });
    expect(frame.cursorCell).toBe(1);
  });

  it('reports no cursor cell when the cursor is outside the window', () => {
    expect(renderFrame(simulatedProfile(2), { cells: RUN, windowStart: 0, cursor: 6 }).cursorCell).toBeNull();
  });

  it('reports no cursor cell when there is no cursor', () => {
    expect(renderFrame(simulatedProfile(2), { cells: RUN }).cursorCell).toBeNull();
  });
});

describe('window labels', () => {
  // Core reports numbers; `describeWindow` in the interface turns them into a sentence in whichever
  // language is on. These assertions cover both halves of that contract.
  it('reports the window as numbers', () => {
    const one = renderFrame(simulatedProfile(1), { cells: RUN });
    expect([one.windowStart, one.width, one.total]).toEqual([0, 1, 7]);
    const three = renderFrame(simulatedProfile(3), { cells: RUN, windowStart: 2 });
    expect([three.windowStart, three.width, three.total]).toEqual([2, 3, 7]);
  });

  it('reads naturally at every width', () => {
    const say = (cells: number[], width: number, start = 0) => {
      const frame = renderFrame(simulatedProfile(width), { cells, windowStart: start });
      return describeWindow((key, vars) => translate(key, vars, 'en'), frame);
    };
    expect(say(RUN, 1)).toBe('cell 1 of 7');
    expect(say(RUN, 3)).toBe('cells 1–3 of 7');
    expect(say(RUN, 3, 5)).toBe('cells 5–7 of 7');
    expect(say(RUN, 20)).toBe('all 7 cells');
    expect(say([9], 2)).toBe('one cell');
    expect(say([], 4)).toBe('nothing to read');
  });

  it('says the same thing in Hindi', () => {
    const frame = renderFrame(simulatedProfile(1), { cells: RUN });
    const hindi = describeWindow((key, vars) => translate(key, vars, 'hi'), frame);
    expect(hindi).toContain('7');
    expect(hindi).not.toMatch(/[a-z]/);
  });
});

describe('windowFollowingCursor', () => {
  it('does not move while the cursor is comfortably inside the window', () => {
    expect(windowFollowingCursor(2, 3, 4, 20)).toBe(2);
  });

  it('scrolls just far enough when the cursor walks off the right', () => {
    expect(windowFollowingCursor(0, 4, 4, 20)).toBe(2); // keeps one cell of context
  });

  it('scrolls just far enough when the cursor walks off the left', () => {
    expect(windowFollowingCursor(6, 5, 4, 20)).toBe(4);
  });

  it('keeps no context margin on a one-cell display, because there is no room for one', () => {
    expect(windowFollowingCursor(0, 5, 1, 20)).toBe(5);
    expect(windowFollowingCursor(5, 0, 1, 20)).toBe(0);
  });

  it('never scrolls past the end of the run', () => {
    expect(windowFollowingCursor(0, 19, 4, 20)).toBe(16);
  });
});

describe('paging', () => {
  it('advances by a whole display width', () => {
    expect(pageWindow(0, 1, 4, 20)).toBe(4);
    expect(pageWindow(4, -1, 4, 20)).toBe(0);
  });

  it('stops at both ends instead of wrapping', () => {
    expect(pageWindow(0, -1, 4, 20)).toBe(0);
    expect(pageWindow(16, 1, 4, 20)).toBe(16);
  });

  it('counts pages the way a reader would', () => {
    expect(pageCount(7, 1)).toBe(7);
    expect(pageCount(7, 3)).toBe(3);
    expect(pageCount(7, 20)).toBe(1);
    expect(pageCount(0, 4)).toBe(1);
  });
});
