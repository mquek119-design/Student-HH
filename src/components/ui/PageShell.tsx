import type { ReactNode } from 'react';
import { clsx } from '@/lib/clsx';

/** Standard content canvas: 16px mobile gutters, 48px desktop, centred. */
export function PageShell({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <main
      className={clsx(
        'w-full mx-auto px-margin-mobile md:px-margin-desktop py-md md:py-lg flex flex-col gap-lg',
        wide ? 'max-w-7xl' : 'max-w-4xl',
        className
      )}
    >
      {children}
    </main>
  );
}
