import type { ReactNode } from 'react';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

type BadgeTone = 'neutral' | 'primary' | 'secondary' | 'error' | 'solid-primary';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant border-transparent',
  primary: 'bg-[#D8F3DC] text-[#1B4332] border-transparent',
  secondary: 'bg-[#FDECD0] text-[#7C4A1E] border-transparent',
  error: 'bg-[#FCDADA] text-[#7A1A1A] border-transparent',
  'solid-primary': 'bg-primary text-on-primary border-transparent',
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
