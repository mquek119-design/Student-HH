import { clsx } from '@/lib/clsx';
import type { ReactNode } from 'react';

/**
 * A horizontal strip that scrolls its content forever.
 *
 * The children are rendered twice and the track slides by exactly -50%, so the
 * second copy sits precisely where the first began — the loop has no seam and
 * no jump. Pure CSS (the `marquee` keyframe in tailwind.config.ts), so it needs
 * no `'use client'` and stays a server component.
 *
 * The duplicate is `aria-hidden` — a screen reader hears the phrases once, not
 * twice. Under `prefers-reduced-motion` the animation stops (globals.css), so
 * the strip simply sits still, which is fine: it is decoration, never the only
 * place a fact appears.
 */
export function Marquee({
  children,
  className,
  /** Seconds for one full pass. Lower is faster. */
  duration = 30,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
}) {
  return (
    <div className={clsx('group relative overflow-hidden', className)}>
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${duration}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
