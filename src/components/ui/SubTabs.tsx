'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from '@/lib/clsx';

/**
 * Segmented control per DESIGN.md — a white pill sliding over a soft-grey
 * track. Used for the sections inside a tab (e.g. Split / Balances / Delivery)
 * now that the app is down to four primary tabs.
 */
export interface SubTab {
  href: string;
  label: string;
}

export function SubTabs({ tabs }: { tabs: SubTab[] }) {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 p-1 bg-surface-container rounded-lg overflow-x-auto hide-scrollbar"
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={clsx(
              'flex-1 text-center px-md py-2 rounded font-body-sm text-body-sm whitespace-nowrap transition-colors',
              isActive
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
