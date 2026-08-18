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
      className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-2 py-2 pb-safe bg-primary border-t border-primary/10 shadow-lg"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={clsx(
              'relative flex flex-col items-center justify-center transition-transform duration-200 active:scale-90 p-2 rounded-lg',
              isActive
                ? 'text-secondary font-bold'
                : 'text-[#A3C4A8] hover:text-white'
            )}
          >
            <Icon name={tab.icon} className="text-[20px]" />
            {tab.href === '/basket' && basketHasUpdates && !isActive && (
              <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-[#E07A5F] rounded-full border-2 border-primary" />
            )}
            <span className="font-label-caps text-[10px] tracking-wide mt-1">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
