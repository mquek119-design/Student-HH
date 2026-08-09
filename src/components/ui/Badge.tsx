import type { ReactNode } from 'react';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

type BadgeTone = 'neutral' | 'primary' | 'secondary' | 'error' | 'solid-primary';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant border-surface-container-highest',
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary-container/10 text-secondary-container border-secondary-container/20',
  error: 'bg-error-container text-on-error-container border-error/20',
  'solid-primary': 'bg-primary-container text-on-primary-container border-transparent',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: string;
  className?: string;
}

export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded border font-label-caps text-label-caps whitespace-nowrap',
        TONE_CLASSES[tone],
        className
      )}
    >
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </span>
  );
}
