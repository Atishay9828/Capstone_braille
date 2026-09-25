import { describe, expect, it } from 'vitest';
import { PATTERN_COUNT, dotsToMask } from './braille';
import {
  DEFAULT_BIT_ORDER,
  ProfileError,
  describeProfile,
  exportCalibration,
  fromCam,
  makeProfile,
  orderCells,
  simulatedProfile,
  sliceByPod,
  toCam,
} from './profile';

describe('profile construction', () => {
  it('accepts any positive cell count — 1, 2, 3 or many', () => {
    for (const n of [1, 2, 3, 4, 8, 20, 40]) {
      expect(simulatedProfile(n).cellCount).toBe(n);
    }
  });

  it('refuses a cell count that could not describe a real display', () => {
    expect(() => simulatedProfile(0)).toThrow(ProfileError);
    expect(() => simulatedProfile(-1)).toThrow(ProfileError);
    expect(() => simulatedProfile(2.5)).toThrow(ProfileError);
  });

  it('labels a simulated profile as simulated, so it can never be mistaken for hardware', () => {
    const profile = simulatedProfile(4);
    expect(profile.source).toBe('simulated');
    expect(describeProfile(profile)).toContain('simulated');
    expect(describeProfile(simulatedProfile(1))).toContain('1 cell ');
    expect(describeProfile(simulatedProfile(2))).toContain('2 cells');
  });

  it('rejects a bit order that is not a permutation of the six tracks', () => {
    expect(() => simulatedProfile(1, { bitOrder: [0, 1, 2, 3, 4, 4] })).toThrow(/permutation/);
    expect(() => simulatedProfile(1, { bitOrder: [0, 1, 2, 3, 4, 6] })).toThrow(ProfileError);
    expect(() => simulatedProfile(1, { bitOrder: [0, 1, 2, 3, 4] as never })).toThrow(ProfileError);
  });

  it('refuses a pod layout whose cells do not add up to the display width', () => {
    expect(() =>
      makeProfile({
        cellCount: 8,
        source: 'http',
        label: 'two pods',
        pods: [
          { index: 0, label: 'pod 0', cellAddrs: [0x20, 0x21] },
          { index: 1, label: 'pod 1', cellAddrs: [0x20, 0x21] },
        ],
      }),
    ).toThrow(/sliced wrongly/);
  });

  /*
   * Found live, not by reasoning: a real 4-cell pod and a real 2-cell pod, mirrored for two
   * students, were rejected by the chain-shaped check above (v5 Arc D). Mirrored pods have
   * their own arithmetic — the display is exactly as wide as the smallest pod (D8.6).
   */
  it('accepts mirrored pods of different widths at the width of the smallest', () => {
    const profile = makeProfile({
      cellCount: 2,
      source: 'http',
      label: 'two pods, mirrored',
      mirrored: true,
      pods: [
        { index: 0, label: 'pod 0', cellAddrs: [0x20, 0x21, 0x22, 0x23] },
        { index: 1, label: 'pod 1', cellAddrs: [0x20, 0x21] },
      ],
    });
    expect(profile.cellCount).toBe(2);
    expect(profile.mirrored).toBe(true);
  });

  it('rejects a mirrored cellCount that is not the smallest pod', () => {
    expect(() =>
      makeProfile({
        cellCount: 4,
        source: 'http',
        label: 'two pods, mirrored wrongly',
        mirrored: true,
        pods: [
          { index: 0, label: 'pod 0', cellAddrs: [0x20, 0x21, 0x22, 0x23] },
          { index: 1, label: 'pod 1', cellAddrs: [0x20, 0x21] },
        ],
      }),
    ).toThrow(/smallest/);
  });
});

describe('cam mapping', () => {
  const profile = simulatedProfile(1);

  it('matches the handoff worked examples with the default bit order', () => {
    // SOFTWARE_TEAM_README §3 step 2: blank -> 0, (1,) -> 1, (1,2,5) -> 19.
    expect(toCam(profile, dotsToMask([]))).toBe(0);
    expect(toCam(profile, dotsToMask([1]))).toBe(1);
    expect(toCam(profile, dotsToMask([1, 2, 5]))).toBe(19);
  });

  it('is the identity when the bit order is the identity', () => {
    expect(DEFAULT_BIT_ORDER).toEqual([0, 1, 2, 3, 4, 5]);
    for (let mask = 0; mask < PATTERN_COUNT; mask += 1) {
      expect(toCam(profile, mask)).toBe(mask);
    }
  });

  it('round-trips through fromCam for every pattern and every bit order we tested', () => {
    const orders = [
      [0, 1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1, 0], // cam tracks wired in reverse
      [0, 3, 1, 4, 2, 5], // column-major wiring — a very plausible mistake
      [2, 1, 0, 5, 4, 3],
    ] as const;
    for (const order of orders) {
      const p = simulatedProfile(1, { bitOrder: order });
      const seen = new Set<number>();
      for (let mask = 0; mask < PATTERN_COUNT; mask += 1) {
        const cam = toCam(p, mask);
        expect(fromCam(p, cam)).toBe(mask);
        seen.add(cam);
      }
      // A permutation of bits must still cover all 64 cam positions exactly once.
      expect(seen.size).toBe(PATTERN_COUNT);
    }
  });

  it('changes the wire value — and only the wire value — when the cam is wired differently', () => {
    // This is the demo-day insurance: if dot 1 turns out to drive the last cam track, the fix is
    // a setting, not a code change. The dot mask is untouched.
    const mirrored = simulatedProfile(1, { bitOrder: [5, 4, 3, 2, 1, 0] });
    const dots = dotsToMask([1, 2, 5]); // 0b010011
    expect(dots).toBe(19);
    expect(toCam(mirrored, dots)).toBe(0b110010); // 50
    expect(fromCam(mirrored, 0b110010)).toBe(19);
  });

  it('rejects values that are not cam positions', () => {
    expect(() => toCam(profile, 64)).toThrow(ProfileError);
    expect(() => fromCam(profile, -1)).toThrow(ProfileError);
  });
});

describe('physical ordering', () => {
  it('leaves cells alone on a normal dock', () => {
    expect(orderCells(simulatedProfile(3), [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('mirrors them on a dock assembled right to left', () => {
    expect(orderCells(simulatedProfile(3, { reversed: true }), [1, 2, 3])).toEqual([3, 2, 1]);
  });
});

describe('multi-pod slicing (handoff §4B)', () => {
  const profile = makeProfile({
    cellCount: 7,
    source: 'http',
    label: 'three pods',
    pods: [
      { index: 0, label: 'pod 0', cellAddrs: [0x20, 0x21, 0x22, 0x23] },
      { index: 1, label: 'pod 1', cellAddrs: [0x20, 0x21] },
      { index: 2, label: 'pod 2', cellAddrs: [0x20] },
    ],
  });

  it('gives each pod exactly the cells it owns, in order', () => {
    const slices = sliceByPod(profile, [10, 11, 12, 13, 14, 15, 16]);
    expect(slices.map((s) => s.slice)).toEqual([[10, 11, 12, 13], [14, 15], [16]]);
  });

  it('reassembles into the original run', () => {
    const values = [1, 2, 3, 4, 5, 6, 7];
    expect(sliceByPod(profile, values).flatMap((s) => s.slice)).toEqual(values);
  });

  it('handles the single-pod case without pod addresses', () => {
    expect(sliceByPod(simulatedProfile(3), [1, 2, 3])[0].slice).toEqual([1, 2, 3]);
  });
});

describe('calibration export', () => {
  it('exports something the hardware team can act on', () => {
    const config = exportCalibration(simulatedProfile(2, { bitOrder: [5, 4, 3, 2, 1, 0], reversed: true }));
    expect(config.bitOrder).toEqual([5, 4, 3, 2, 1, 0]);
    expect(config.reversed).toBe(true);
    expect(config.note).toMatch(/cam-track bit/);
  });
});
