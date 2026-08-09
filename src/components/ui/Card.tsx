import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

/** Surface Level 1 per DESIGN.md: white, hairline border, soft ambient shadow. */
interface CardProps {
  children: ReactNode;
  className?: string;
  /** 4px left border accent — green for information, orange for urgency. */
  accent?: 'none' | 'primary' | 'secondary' | 'error';
  padded?: boolean;
}

const ACCENT_CLASSES = {
  none: '',
  primary: 'border-l-4 border-l-primary',
  secondary: 'border-l-4 border-l-secondary-container',
  error: 'border-l-4 border-l-error',
} as const;

export function Card({ children, className, accent = 'none', padded = true }: CardProps) {
  return (
    <section
      className={clsx(
        'bg-surface-container-lowest rounded-xl shadow-ambient-card border border-surface-container-highest',
        ACCENT_CLASSES[accent],
        padded && 'p-md',
        className
      )}
    >
      {children}
    </section>
  );
}
