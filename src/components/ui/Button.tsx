import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

/**
 * One button, five looks.
 *
 * Before this the same twelve Tailwind classes were retyped at roughly thirty
 * call sites, which is why heights drifted between 36, 40, 44 and 48px on the
 * same screen, why some buttons had a focus ring and most did not, and why a
 * pending spinner appeared on some and not others. None of that was a decision.
 *
 * `pending` is a prop rather than a hook so this works both inside a form (fed
 * from `useFormStatus`) and outside one (fed from `useTransition`).
 */

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90 active:opacity-100',
  secondary: 'bg-secondary-container text-on-secondary hover:bg-secondary',
  outline:
    'border border-outline-variant text-on-surface-variant bg-transparent hover:bg-surface-container',
  ghost: 'text-primary bg-transparent hover:bg-primary/10',
  danger: 'border border-error text-error bg-transparent hover:bg-error-container',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-sm text-[13px] gap-xs',
  md: 'h-11 px-md text-[14px] gap-xs',
  lg: 'h-12 px-md text-title-md gap-sm',
};

const ICON_SIZES: Record<Size, string> = {
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[20px]',
};

interface Shared {
  variant?: Variant;
  size?: Size;
  icon?: string;
  /** Trailing icon, e.g. a chevron on a navigation action. */
  iconRight?: string;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

function classesFor({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: Shared): string {
  return clsx(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors',
    // A ring everywhere, on the page background rather than the button's own
    // colour, so keyboard focus is visible on every surface in the app.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
    'disabled:opacity-50 disabled:pointer-events-none',
    // Pills for inline actions; a softer rectangle when it spans a column,
    // because a full-width pill reads as a pill-shaped page.
    fullWidth ? 'w-full rounded-lg' : 'rounded-full',
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  pending,
  pendingLabel,
  ...props
}: Shared &
  Omit<ComponentProps<'button'>, 'className' | 'children'> & {
    pending?: boolean;
    /** Shown in place of the label while pending. */
    pendingLabel?: string;
  }) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={classesFor({ variant, size, fullWidth, className })}
    >
      {(icon || pending) && (
        <Icon
          name={pending ? 'progress_activity' : (icon as string)}
          className={clsx(ICON_SIZES[size], pending && 'animate-spin')}
        />
      )}
      {pending ? (pendingLabel ?? children) : children}
      {iconRight && !pending && <Icon name={iconRight} className={ICON_SIZES[size]} />}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  ...props
}: Shared & Omit<ComponentProps<typeof Link>, 'className' | 'children'>) {
  return (
    <Link {...props} className={classesFor({ variant, size, fullWidth, className })}>
      {icon && <Icon name={icon} className={ICON_SIZES[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} className={ICON_SIZES[size]} />}
    </Link>
  );
}
