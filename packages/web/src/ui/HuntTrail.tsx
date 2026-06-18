import { useRef, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

// CSS custom properties aren't in the standard CSSProperties type.
type CSSWithVars = CSSProperties & { [key: `--${string}`]: string | number };

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ellipse cx="12" cy="8.5" rx="5" ry="4.2" />
      <ellipse cx="5.2" cy="14.5" rx="2.1" ry="2.7" />
      <ellipse cx="9.5" cy="17.3" rx="2.1" ry="2.8" />
      <ellipse cx="14.5" cy="17.3" rx="2.1" ry="2.8" />
      <ellipse cx="18.8" cy="14.5" rx="2.1" ry="2.7" />
    </svg>
  );
}

// Gentle, deterministic side-to-side wander for node i (two-sine = organic path).
function wanderFrac(i: number, amp: number): number {
  return (Math.sin(i * 1.3) * 0.6 + Math.sin(i * 0.7 + 1) * 0.4) * amp;
}

// Cubic-bezier point + tangent angle (deg, 0 = straight down) at parameter t.
function bezier(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
) {
  const mt = 1 - t;
  const x = mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0];
  const y = mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1];
  const dx = 3*mt*mt*(p1[0]-p0[0]) + 6*mt*t*(p2[0]-p1[0]) + 3*t*t*(p3[0]-p2[0]);
  const dy = 3*mt*mt*(p1[1]-p0[1]) + 6*mt*t*(p2[1]-p1[1]) + 3*t*t*(p3[1]-p2[1]);
  return { x, y, angle: Math.atan2(dx, dy) * 180 / Math.PI };
}

export interface HuntTrailItem {
  id?: string;
  name: string;
  completed?: boolean;
  thumbnail?: string;
}

interface HuntTrailProps {
  items: HuntTrailItem[];
  currentIndex?: number;
  defaultImage?: string;
  maxHeight?: number;
  pawsPerSegment?: number;
  compact?: boolean;
  onSelectItem?: (index: number, item: HuntTrailItem) => void;
}

/**
 * Schematic, gently-wandering map of a hunt: previous → current → upcoming items.
 * The path ahead is a faint dashed line; the path you've walked is a line of
 * distinct black paw prints. Completed nodes fill with the step photo.
 * Auto-centers the current step; steps are tappable via onSelectItem.
 */
export function HuntTrail({
  items = [],
  currentIndex = 0,
  defaultImage,
  maxHeight = 460,
  pawsPerSegment = 3,
  compact = false,
  onSelectItem,
}: HuntTrailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = scrollRef.current;
    const node = currentRef.current;
    if (!c || !node) return;
    const target = node.offsetTop - c.clientHeight / 2 + node.offsetHeight / 2;
    c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [currentIndex, items.length]);

  const amp = compact ? 0.12 : 0.16;
  const xPct = items.map((_, i) => 50 + wanderFrac(i, amp) * 100);

  return (
    <div className={'ftp-trail' + (compact ? ' ftp-trail--compact' : '')}>
      <div className="ftp-trail__scroll" ref={scrollRef} style={{ maxHeight }}>
        {items.map((item, i) => {
          const done = !!item.completed;
          const current = i === currentIndex;
          const state = done ? 'done' : current ? 'current' : 'upcoming';
          const prevDone = i > 0 && !!items[i - 1]?.completed;
          const isFirst = i === 0;
          const isLast = i === items.length - 1;
          const thumb = item.thumbnail || defaultImage;
          const clickable = typeof onSelectItem === 'function';

          // xPct has the same length as items, so these accesses are safe.
          const xi = xPct[i]!;
          const xNext = isLast ? xi : xPct[i + 1]!;
          const midPrev = isFirst ? xi : (xPct[i - 1]! + xi) / 2;
          const midNext = isLast ? xi : (xPct[i + 1]! + xi) / 2;

          const topD = `M ${midPrev} 0 C ${midPrev} 25, ${xi} 25, ${xi} 50`;
          const botD = `M ${xi} 50 C ${xi} 75, ${midNext} 75, ${midNext} 100`;

          const paws = (!isLast && done)
            ? Array.from({ length: pawsPerSegment }, (_, k) => {
                const t = (k + 0.5) / pawsPerSegment;
                const pt = bezier(t, [xi, 50], [xi, 92], [xNext, 108], [xNext, 150]);
                const lateral = (k % 2 === 0 ? -1 : 1) * 6;
                return (
                  <span
                    key={k}
                    className="ftp-trail__paw"
                    style={{
                      left: `calc(${pt.x}% + ${lateral}px)`,
                      top: `${pt.y}%`,
                      '--rot': `${pt.angle}deg`,
                      animationDelay: `${0.08 + k * 0.09}s`,
                    } as CSSWithVars}
                  >
                    <PawIcon />
                  </span>
                );
              })
            : null;

          const nodeClass = [
            'ftp-trail__node',
            state === 'done' ? 'ftp-trail__node--done' : '',
            state === 'current' ? 'ftp-trail__node--current' : '',
            state === 'upcoming' ? 'ftp-trail__node--upcoming' : '',
          ].filter(Boolean).join(' ');

          const stepClass = 'ftp-trail__step' + (clickable ? ' ftp-trail__step--clickable' : '');
          const handler = clickable ? () => onSelectItem(i, item) : undefined;
          const interactive = clickable
            ? {
                role: 'button' as const,
                tabIndex: 0,
                onClick: handler,
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler?.();
                  }
                },
                'aria-label': `${item.name} — ${
                  done ? 'found, tap to revisit' : current ? 'current step' : 'not found yet'
                }`,
              }
            : {};

          return (
            <div
              className={stepClass}
              key={item.id ?? i}
              ref={current ? currentRef : null}
              {...interactive}
            >
              <div className="ftp-trail__rail">
                <svg className="ftp-trail__path" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {!isFirst && !prevDone && (
                    <path className="ftp-trail__seg ftp-trail__seg--faint" d={topD} />
                  )}
                  {!isLast && !done && (
                    <path className="ftp-trail__seg ftp-trail__seg--faint" d={botD} />
                  )}
                </svg>
                {paws}

                <span className={nodeClass} title={item.name} style={{ left: `${xi}%` }}>
                  {done && thumb
                    ? <img src={thumb} alt="" />
                    : done
                      ? <span aria-hidden="true">📷</span>
                      : <span className="ftp-trail__q" aria-hidden="true">?</span>}
                  {done && <span className="ftp-trail__check" aria-hidden="true">✓</span>}
                </span>
              </div>

              <div className="ftp-trail__body">
                <p className={'ftp-trail__name' + (state === 'upcoming' ? ' ftp-trail__name--upcoming' : '')}>
                  {item.name}
                </p>
                <p className="ftp-trail__status">
                  {done
                    ? 'Found it! · tap to revisit'
                    : current
                      ? "You're here · find it!"
                      : `Step ${i + 1}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
