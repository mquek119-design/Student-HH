'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';
import type { User } from '@/lib/types';
import { TABS, activeTabHref } from './tabs';

interface TopAppBarProps {
  currentUser: Pick<User, 'name' | 'accent' | 'avatarUrl'>;
}

export function TopAppBar({ currentUser }: TopAppBarProps) {
  const pathname = usePathname();
  const active = activeTabHref(pathname);

  return (
    <header className="flex justify-between items-center gap-sm px-margin-mobile md:px-margin-desktop py-sm w-full fixed top-0 z-50 bg-surface shadow-sm h-[72px]">
      <Link href="/account" className="flex items-center gap-sm min-w-0 group">
        <Avatar user={currentUser} size="md" className="group-hover:opacity-80 transition-opacity" />
        <span className="font-headline-lg-mobile text-headline-lg-mobile text-primary tracking-tight truncate">
          HouseGrocer
        </span>
      </Link>

      {/* Desktop mirrors the same four tabs — no bottom bar above md. */}
      <nav aria-label="Primary" className="hidden md:flex items-center gap-lg h-full">
        {TABS.map((tab) => {
          const isActive = active === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2 transition-opacity hover:opacity-80',
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant'
              )}
            >
              <Icon name={tab.icon} filled={isActive} className="text-[20px]" />
              <span className="font-title-md text-title-md">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <Link
          href="/settings"
          aria-label="House settings"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors active:scale-95"
        >
          <Icon name="settings" />
        </Link>
      </div>
    </header>
  );
}
