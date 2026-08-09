'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';

/**
 * Order-cutoff countdown.
 *
 * Per DESIGN.md the track is green until under 6 hours remain, then it turns
 * Secondary Orange. The first render deliberately shows a placeholder so the
 * server and client markup agree — the real value lands on mount.
 */

const URGENT_THRESHOLD_MS = 6 * 3600_000;

function breakdown(msRemaining: number) {
  const clamped = Math.max(0, msRemaining);
  const totalMinutes = Math.floor(clamped / 60_000);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    seconds: Math.floor((clamped % 60_000) / 1000),
  };
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

interface CountdownCardProps {
  cutoffAt: string;
  /** Length of the planning window, used to size the progress bar. */
  windowHours?: number;
}

export function CountdownCard({ cutoffAt, windowHours = 24 }: CountdownCardProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(cutoffAt).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cutoffAt]);

  const isUrgent = remaining !== null && remaining < URGENT_THRESHOLD_MS;
  const locked = remaining !== null && remaining <= 0;
  const { hours, minutes, seconds } = breakdown(remaining ?? 0);

  const elapsedFraction =
    remaining === null ? 0 : 1 - Math.min(1, Math.max(0, remaining / (windowHours * 3600_000)));

  return (
    <Card className="flex flex-col justify-between gap-sm">
      <div>
        <h2 className="font-title-md text-title-md text-on-surface mb-xs">Order Cutoff</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {locked ? 'Planning is locked for this week.' : "Locking in this week's delivery."}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-sm">
        <div
          className={clsx(
            'font-numeric-data text-display-lg tabular-nums',
            locked ? 'text-on-surface-variant' : isUrgent ? 'text-secondary-container' : 'text-primary'
          )}
        >
          {remaining === null ? '--:--' : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
        </div>
        <span
          className={clsx(
            'font-label-caps text-label-caps uppercase tracking-wider mt-xs',
            isUrgent && !locked ? 'text-secondary font-bold' : 'text-on-surface-variant'
          )}
        >
          {locked ? 'Locked' : isUrgent ? 'Cutoff approaching' : 'Until lock'}
        </span>
      </div>

      <div
        className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsedFraction * 100)}
        aria-label="Time elapsed in planning window"
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-1000',
            isUrgent ? 'bg-secondary-container' : 'bg-primary'
          )}
          style={{ width: `${elapsedFraction * 100}%` }}
        />
      </div>
    </Card>
  );
}
