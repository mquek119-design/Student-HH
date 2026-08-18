import 'server-only';

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { toUser } from './mappers';
import type { User } from './types';

/**
 * Seeing the app as one of the demo housemates.
 *
 * Demo profiles are created with `is_demo = true` and **no `auth.users` row** —
 * that is the whole point of `0008`, and it means they can never sign in. So
 * from one account you can only ever see one side of anything: the collector
 * sees who owes them, everybody else sees what they owe, and half the settle-up
 * flow is unreachable without a second real email address.
 *
 * This swaps the identity the app *renders for*. It does not touch the Supabase
 * session: `auth.uid()` stays you, so row-level security still judges every
 * write by who is really signed in. See CLAUDE.md for which writes that allows
 * and which it refuses.
 */

export const VIEW_AS_COOKIE = 'grub_view_as';

/**
 * Inert in production.
 *
 * The demo-only guard below is the real safety property and holds everywhere,
 * but a testing affordance should not follow the app to a deployment at all.
 */
export function readViewAsId(): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  return cookies().get(VIEW_AS_COOKIE)?.value ?? null;
}

/**
 * The housemate to render as, or null to be yourself.
 *
 * Two conditions, both required, and this function is the only place they are
 * checked:
 *
 *   1. the target is a **demo** profile — you can never look through a real
 *      person's account, in your house or anyone else's; and
 *   2. it belongs to the same house as the real signed-in user.
 *
 * Anything else resolves to null and you stay yourself, rather than erroring.
 */
export async function resolveViewAs(
  realUser: User,
  supabase: SupabaseClient<Database>
): Promise<User | null> {
  const targetId = readViewAsId();
  if (!targetId || targetId === realUser.id) return null;

  const target = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
  if (target.error || !target.data) return null;

  const row = target.data;
  if (!row.is_demo) return null;
  if (!realUser.houseId || row.house_id !== realUser.houseId) return null;

  return toUser(row);
}

/**
 * Why a write just did nothing.
 *
 * Impersonation changes who the app renders for; it does not change
 * `auth.uid()`, which is what row-level security reads. `splits_update` is
 * scoped to the two people on the split and `profiles_update` to your own row,
 * so those two refuse — silently, as a zero-row update — while viewing as
 * somebody else. Saying so is better than letting it be found by confusion.
 */
export async function viewAsRefusal(what: string): Promise<string | null> {
  const targetId = readViewAsId();
  if (!targetId) return null;
  return (
    `Nothing saved. ${what} is tied to whoever is really signed in, and you are ` +
    'viewing as somebody else — switch back to your own account to do it.'
  );
}
