'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@/lib/types';
import { BottomNav } from './BottomNav';
import { TopAppBar } from './TopAppBar';

/** Routes that render bare — no tab bar, no app bar. */
const BARE_PREFIXES = ['/onboarding', '/login', '/auth', '/setup'];

/**
 * Wraps every page in the app chrome, except the routes above.
 *
 * Onboarding and login run before a house (or a session) exists, so there is
 * nothing for the tabs to point at — showing them would offer four dead ends.
 * This is a client component because the decision depends on the pathname.
 */
export function AppChrome({
  currentUser,
  children,
}: {
  currentUser: User | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isBare =
    currentUser === null ||
    BARE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isBare) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <>
      <TopAppBar currentUser={currentUser} />
      {/* Top padding clears the fixed app bar; bottom clears the tab bar. */}
      <div className="pt-[72px] pb-[96px] md:pb-xl">{children}</div>
      <BottomNav basketHasUpdates />
    </>
  );
}
