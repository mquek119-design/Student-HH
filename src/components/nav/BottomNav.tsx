'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';
import { TABS, activeTabHref } from './tabs';

interface BottomNavProps {
  /** Dot on the Basket tab when the week's basket has unreviewed items. */
  basketHasUpdates?: boolean;
}

export function BottomNav({ basketHasUpdates = false }: BottomNavProps) {
  const pathname = usePathname();
  const active = activeTabHref(pathname);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-2 py-2 pb-safe bg-surface border-t border-surface-container-highest rounded-t-xl shadow-lg"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={clsx(
              'relative flex flex-col items-center justify-center transition-transform duration-200 active:scale-90',
              isActive
                ? 'bg-primary-container text-on-primary-container rounded-full px-4 py-1'
                : 'text-on-surface-variant hover:bg-surface-container-low p-2 rounded-lg'
            )}
          >
            <Icon name={tab.icon} filled={isActive} />
            {tab.href === '/basket' && basketHasUpdates && !isActive && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-secondary-container rounded-full border border-surface" />
            )}
            <span className={clsx('font-label-caps text-label-caps mt-1', isActive && 'font-bold')}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
