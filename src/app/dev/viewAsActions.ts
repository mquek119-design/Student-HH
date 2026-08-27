'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, getHousemates } from '@/lib/queries';
import { VIEW_AS_COOKIE } from '@/lib/viewAs';
import type { DevResult } from './actions';

const fail = (message: string): DevResult => ({ status: 'error', message });

/**
 * Renders the rest of the app as one of the demo housemates.
 *
 * The guard that matters lives in `resolveViewAs()` and is checked on every
 * request, so a stale or hand-written cookie cannot outlive it. This action
 * checks the same thing up front purely so the button can refuse with a
 * sentence rather than appearing to work and silently doing nothing.
 */
export async function startViewingAs(profileId: string): Promise<DevResult> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const housemates = await getHousemates();
  const target = housemates.find((user) => user.id === profileId);

  if (!target) return fail('Nobody in this house has that id.');
  if (!target.isDemo) {
    return fail(
      `${target.name} is a real account. You can only look through a demo housemate's eyes.`
    );
  }

  (await cookies()).set(VIEW_AS_COOKIE, target.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Long enough for a testing session, short enough that a forgotten cookie
    // expires rather than quietly following you into next week.
    maxAge: 60 * 60 * 8,
  });

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: `Viewing as ${target.name}. Everything you do now lands as them.`,
  };
}

/** Back to your own account. */
export async function stopViewingAs(): Promise<DevResult> {
  (await cookies()).delete(VIEW_AS_COOKIE);
  revalidatePath('/', 'layout');
  return { status: 'success', message: 'Back to your own account.' };
}
