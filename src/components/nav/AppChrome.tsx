'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { clsx } from '@/lib/clsx';
import type { User } from '@/lib/types';
import { BottomNav } from './BottomNav';
import { TopAppBar } from './TopAppBar';
import { ViewAsBanner } from './ViewAsBanner';

// The Supabase realtime client (postgrest, auth, websocket) is a meaningful
// chunk of JS that every other component on this chrome does without. Code-split
// it so it loads after hydration instead of sitting in the page's critical path —
// the subscription attaching a beat late is invisible; a bigger First Load JS on
// every route is not.
const RealtimeListener = dynamic(
  () => import('../realtime/RealtimeListener').then((mod) => mod.RealtimeListener),
  { ssr: false }
);

/** Routes that render bare — no tab bar, no app bar. */
const BARE_PREFIXES = ['/welcome', '/onboarding', '/login', '/auth', '/setup'];

/**
 * Wraps every page in the app chrome, except the routes above.
 *
 * Onboarding and login run before a house (or a session) exists, so there is
 * nothing for the tabs to point at — showing them would offer four dead ends.
 * This is a client component because the decision depends on the pathname.
 */
export function AppChrome({
  currentUser,
  viewingAsName,
  children,
}: {
  currentUser: User | null;
  /**
   * Set when the app is rendering as a demo housemate rather than the signed-in
   * account. Shown on every page — writes land as them, so forgetting is not a
   * small mistake.
   */
  viewingAsName?: string | null;
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
      <RealtimeListener houseId={currentUser.houseId} />
      <TopAppBar currentUser={currentUser} />
      {viewingAsName && <ViewAsBanner name={viewingAsName} />}
      {/* Top padding clears the fixed app bar, plus the banner when it is up. */}
      <div className={clsx('pb-[96px] md:pb-xl', viewingAsName ? 'pt-[108px]' : 'pt-[72px]')}>
        {children}
      </div>
      <BottomNav basketHasUpdates />
    </>
  );
}
