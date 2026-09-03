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
      id="main-content"
      // Focusable so the skip link (AppChrome) can land focus here, but kept
      // out of the tab order — tabIndex -1 is programmatic focus only.
      tabIndex={-1}
      className={clsx(
        'w-full mx-auto px-margin-mobile md:px-margin-desktop py-md md:py-lg flex flex-col gap-lg outline-none',
        wide ? 'max-w-7xl' : 'max-w-4xl',
        className
      )}
    >
      {children}
    </main>
  );
}
