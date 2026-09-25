/**
 * One braille cell, rendered as a physical object.
 *
 * This is the hero of the interface, so it is not six flat circles. A raised dot is a dome lit
 * from the top left with a cast shadow; a lowered dot is a recess with an inner shadow. That is
 * the whole art direction in one component — everything else on screen recedes behind it.
 *
 * It also renders the *mechanism*: when the cell changes, the cam ring rotates through the arc
 * the real 28BYJ-48 would take, in the direction the scheduler actually chose. Motion here is
 * information, not decoration (CLAUDE.md — art direction), and it collapses to nothing under
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from 'react';
import { describeMask, hasDot, type DotMask, type DotNumber } from '../core/braille';
import './BrailleCell.css';

const DOT_LAYOUT: readonly { dot: DotNumber; col: 0 | 1; row: 0 | 1 | 2 }[] = [
  { dot: 1, col: 0, row: 0 },
  { dot: 2, col: 0, row: 1 },
  { dot: 3, col: 0, row: 2 },
  { dot: 4, col: 1, row: 0 },
  { dot: 5, col: 1, row: 1 },
  { dot: 6, col: 1, row: 2 },
];

export interface BrailleCellProps {
  /** The dot pattern this cell is showing. */
  dots: DotMask;
  /** The cam position on the wire — shown under the cell so the mapping is never invisible. */
  cam: number;
  /** Position in the display, 0-based. Shown as a small index. */
  index: number;
  /** True when the reading cursor is on this cell. */
  active?: boolean;
  /** Suppress the per-cell footer (used in dense contexts like the atlas). */
  bare?: boolean;
  onClick?: () => void;
}

export function BrailleCell({ dots, cam, index, active = false, bare = false, onClick }: BrailleCellProps) {
  const previous = useRef(cam);
  const [turning, setTurning] = useState(false);

  useEffect(() => {
    if (previous.current === cam) return;
    previous.current = cam;
    setTurning(true);
    const timer = window.setTimeout(() => setTurning(false), 460);
    return () => window.clearTimeout(timer);
  }, [cam]);

  const label = `Cell ${index + 1}: ${describeMask(dots)}, cam position ${cam}`;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`cell${active ? ' is-active' : ''}${turning ? ' is-turning' : ''}${onClick ? ' is-clickable' : ''}`}
      data-testid={`cell-${index}`}
      data-cam={cam}
      data-dots={dots}
      role={onClick ? undefined : 'img'}
      aria-label={label}
      title={label}
      {...(onClick ? { type: 'button' as const, onClick } : {})}
    >
      <span className="cell__face">
        {DOT_LAYOUT.map(({ dot, col, row }) => (
          <span
            key={dot}
            className={`dot${hasDot(dots, dot) ? ' is-raised' : ''}`}
            style={{ gridColumn: col + 1, gridRow: row + 1 }}
            data-dot={dot}
            aria-hidden="true"
          />
        ))}
      </span>
      {!bare && (
        <span className="cell__foot num" aria-hidden="true">
          <span className="cell__index">{index + 1}</span>
          <span className="cell__cam">{String(cam).padStart(2, '0')}</span>
        </span>
      )}
    </Tag>
  );
}

