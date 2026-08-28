'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';
import type { User } from '@/lib/types';
import { TABS, activeTabHref } from './tabs';
import { Logo } from '@/components/brand/Logo';

interface TopAppBarProps {
  currentUser: Pick<User, 'name' | 'accent' | 'avatarUrl'>;
}

export function TopAppBar({ currentUser }: TopAppBarProps) {
  const pathname = usePathname();
  const active = activeTabHref(pathname);

  return (
    <header className="flex justify-between items-center gap-sm px-margin-mobile md:px-margin-desktop py-sm w-full fixed top-0 z-50 bg-primary border-b border-primary/10 shadow-md h-[72px]">
      <Link href="/" className="flex items-center gap-sm group">
        <Logo tone="onDark" markClassName="h-8 w-auto" wordmarkClassName="text-[22px]" />
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
                'flex items-center gap-2 transition-colors duration-200',
                isActive ? 'text-secondary font-bold' : 'text-[#A3C4A8] hover:text-white'
              )}
            >
              <Icon name={tab.icon} className="text-[20px]" />
              <span className="font-title-md text-title-md">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-sm shrink-0">
        <Link
          href="/dev"
          aria-label="Testing and development"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#A3C4A8] hover:text-secondary hover:bg-white/5 transition-colors active:scale-95"
        >
          <Icon name="science" />
        </Link>
        <Link
          href="/settings"
          aria-label="House settings"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#A3C4A8] hover:text-secondary hover:bg-white/5 transition-colors active:scale-95"
        >
          <Icon name="settings" />
        </Link>
        <Link
          href="/account"
          aria-label="My account"
          className="flex items-center justify-center rounded-full hover:opacity-90 transition-opacity"
        >
          <Avatar
            user={currentUser}
            size="sm"
            ring={pathname.startsWith('/account') ? 'secondary' : 'none'}
          />
        </Link>
      </div>
    </header>
  );
}
