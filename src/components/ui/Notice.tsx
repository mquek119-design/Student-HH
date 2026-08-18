import type { ReactNode } from 'react';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

/**
 * The app talking to you: an explanation, a suggestion, a caveat.
 *
 * There were eight hand-built versions of this panel by the time it was worth
 * naming — some tan, some grey, some a bare paragraph floating on the page
 * background between two cards — and the tone carried no meaning because it was
 * whatever got typed that day. Now the tone is the message:
 *
 *   `info`    — how something works. Neutral, quiet, no action implied.
 *   `suggest` — an offer you may ignore. Warm tan, never red.
 *   `check`   — something to look at before it costs money. Tan, stronger.
 *   `good`    — a state that is fine and worth confirming.
 *   `danger`  — reserved for destructive actions. Nothing else earns red.
 *
 * A plan that differs from someone else's is never `danger`, and a suggestion
 * is never styled as a warning. See `overlaps.ts` for why that matters.
 */

type Tone = 'info' | 'suggest' | 'check' | 'good' | 'danger';

const TONES: Record<Tone, { box: string; icon: string; defaultIcon: string }> = {
  info: {
    box: 'bg-surface-container-low border-surface-container-highest',
    icon: 'text-on-surface-variant',
    defaultIcon: 'info',
  },
  suggest: {
    box: 'bg-secondary-fixed/40 border-secondary-container/40',
    icon: 'text-secondary',
    defaultIcon: 'lightbulb',
  },
  check: {
    box: 'bg-secondary-fixed/60 border-secondary-container/50',
    icon: 'text-secondary',
    defaultIcon: 'help',
  },
  good: {
    box: 'bg-primary/5 border-primary/20',
    icon: 'text-primary',
    defaultIcon: 'check_circle',
  },
  danger: {
    box: 'bg-error-container/30 border-error/40',
    icon: 'text-error',
    defaultIcon: 'warning',
  },
};

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  icon?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}) {
  const style = TONES[tone];

  return (
    <div
      role={role}
      className={clsx('flex items-start gap-sm p-md rounded-lg border', style.box, className)}
    >
      <Icon
        name={icon ?? style.defaultIcon}
        filled
        className={clsx('mt-0.5 shrink-0 text-[18px]', style.icon)}
      />
      <div className="min-w-0 flex flex-col gap-xs">
        {title && <p className="font-title-md text-title-md text-on-surface">{title}</p>}
        <div className="font-body-sm text-body-sm text-on-surface-variant">{children}</div>
      </div>
    </div>
  );
}
