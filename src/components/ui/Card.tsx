import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

/** Surface Level 1 per DESIGN.md: white, hairline border, soft ambient shadow. */
interface CardProps {
  children: ReactNode;
  className?: string;
  /** Anchor target, so a link can land on this card. */
  id?: string;
  /** 4px left border accent — green for information, orange for urgency. */
  accent?: 'none' | 'primary' | 'secondary' | 'error';
  padded?: boolean;
  /** Background variant: white (interactive/elevated) or oat (static info section). */
  variant?: 'white' | 'oat';
}

const ACCENT_CLASSES = {
  none: '',
  primary: 'border-l-4 border-l-primary',
  secondary: 'border-l-4 border-l-secondary-container',
  error: 'border-l-4 border-l-error',
} as const;

const VARIANT_CLASSES = {
  white: 'bg-surface-container-lowest shadow-ambient-card border border-surface-container-highest',
  oat: 'bg-surface-container border border-surface-container-highest/40',
} as const;

export function Card({
  children,
  className,
  id,
  accent = 'none',
  padded = true,
  variant = 'white',
}: CardProps) {
  return (
    <section
      id={id}
      className={clsx(
        VARIANT_CLASSES[variant],
        'rounded-xl',
        ACCENT_CLASSES[accent],
        padded && 'p-md',
        className
      )}
    >
      {children}
    </section>
  );
}
