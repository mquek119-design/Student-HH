'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

/**
 * A tap-to-toggle pill: recipe filters, dietary tags, meal-type pickers.
 *
 * Selected state is a pale green fill with a green outline rather than a solid
 * green block. Solid reads as "this is a button, press it"; the filled outline
 * reads as "this is on", which is what a toggle needs to say. The icon swaps to
 * a tick when active so the state survives being looked at in greyscale.
 */
export function Chip({
  active,
  icon,
  children,
  onClick,
  disabled,
  title,
  tickWhenActive = true,
  className,
}: {
  active: boolean;
  icon?: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Why it is unavailable — an unexplained dead control is worse than none. */
  title?: string;
  tickWhenActive?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={clsx(
        'shrink-0 inline-flex items-center gap-xs px-md py-2 rounded-full border text-[13px] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
        'disabled:opacity-40 disabled:pointer-events-none',
        active
          ? 'border-primary bg-primary-fixed text-on-primary-fixed'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
        className
      )}
    >
      {(icon || (active && tickWhenActive)) && (
        <Icon
          name={active && tickWhenActive ? 'check' : (icon as string)}
          className="text-[16px]"
        />
      )}
      {children}
    </button>
  );
}
