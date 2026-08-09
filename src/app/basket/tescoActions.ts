'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { TescoProvider } from '../../../lib/tesco/providers/tesco/index';
import { loadSession, saveSession, inferSessionExpiry, type TescoSession } from '../../../lib/tesco/providers/tesco/auth';

export interface TescoActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
  authenticated?: boolean;
  expiresAt?: string;
  syncedCount?: number;
  totalCost?: number;
}

const fail = (message: string): TescoActionState => ({ status: 'error', message });

/** Checks if a valid Tesco session cookie file exists and is unexpired. */
export async function checkTescoSession(): Promise<TescoActionState> {
  try {
    const session = loadSession();
    if (!session || !session.cookies || session.cookies.length === 0) {
      return { status: 'idle', authenticated: false, message: 'No active Tesco session.' };
    }
    const isExpired = new Date(session.expiresAt) < new Date();
    if (isExpired) {
      return { status: 'idle', authenticated: false, message: 'Tesco session expired.' };
    }
    return {
      status: 'success',
      authenticated: true,
      expiresAt: session.expiresAt,
      message: 'Tesco session active.',
    };
  } catch (err: any) {
    return fail(err?.message || 'Failed to check Tesco session.');
  }
}

/** Imports exported browser cookies (JSON string or array) and saves session. */
export async function importTescoSession(cookiesJson: string): Promise<TescoActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  try {
    const parsed = JSON.parse(cookiesJson);
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;

    if (!Array.isArray(cookies) || cookies.length === 0) {
      return fail('Invalid cookie data. Please paste a valid Cookie-Editor JSON array.');
    }

    const session: TescoSession = {
      cookies,
      expiresAt: inferSessionExpiry(cookies),
      lastLogin: new Date().toISOString(),
    };

    saveSession(session);

    return {
      status: 'success',
      authenticated: true,
      expiresAt: session.expiresAt,
      message: `Tesco session imported successfully with ${cookies.length} cookies.`,
    };
  } catch (err: any) {
    return fail(`Failed to import session: ${err?.message || 'Invalid JSON format'}`);
  }
}

/** Synchronizes this week's basket items to Tesco's online trolley. */
export async function syncBasketToTesco(planId: string): Promise<TescoActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const sessionCheck = await checkTescoSession();
  if (!sessionCheck.authenticated) {
    return fail('Tesco session required. Please import cookies under My Account or Basket settings.');
  }

  const supabase = createClient();

  // Fetch basket items for this weekly plan
  const itemsResp = await supabase
    .from('basket_items')
    .select('*')
    .eq('plan_id', planId);

  if (itemsResp.error) return fail(itemsResp.error.message);
  const items = itemsResp.data || [];

  if (items.length === 0) return fail('Basket is empty.');

  const syncable = items.filter((item) => item.tesco_product_id && item.quantity > 0);
  if (syncable.length === 0) {
    return fail('No items have valid Tesco product IDs. Build the basket first.');
  }

  try {
    const provider = new TescoProvider();

    let syncedCount = 0;
    for (const item of syncable) {
      await provider.addToBasket(item.tesco_product_id!, item.quantity);
      syncedCount += 1;
    }

    // Fetch actual basket from Tesco trolley to update local database prices
    try {
      const actualBasket = await provider.getBasket();
      for (const actualItem of actualBasket.items) {
        if (!actualItem.product_uid) continue;
        const localMatch = items.find((i) => i.tesco_product_id === actualItem.product_uid);
        if (localMatch) {
          const actualPricePence = Math.round(actualItem.unit_price * 100);
          await supabase
            .from('basket_items')
            .update({ unit_price: actualPricePence })
            .eq('id', localMatch.id);
        }
      }
    } catch (basketErr) {
      console.warn('Failed to update local prices from Tesco trolley:', basketErr);
    }

    // Mark plan as ordered
    await supabase
      .from('weekly_plans')
      .update({ status: 'ordered' })
      .eq('id', planId)
      .eq('house_id', me.houseId);

    revalidatePath('/basket');
    revalidatePath('/split');
    revalidatePath('/');

    return {
      status: 'success',
      authenticated: true,
      syncedCount,
      message: `Successfully pushed ${syncedCount} item${syncedCount === 1 ? '' : 's'} to Tesco online basket!`,
    };
  } catch (err: any) {
    return fail(`Tesco sync error: ${err?.message || 'Could not connect to Tesco'}`);
  }
}

/** Runs a checkout dry-run to retrieve actual slot pricing and total checkout cost. */
export async function startTescoCheckout(planId: string): Promise<TescoActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const sessionCheck = await checkTescoSession();
  if (!sessionCheck.authenticated) {
    return fail('Tesco session required. Please import cookies under My Account or Basket settings.');
  }

  try {
    const provider = new TescoProvider();
    // Run dry-run checkout to fetch slot and actual totals
    const orderResult = await provider.checkout(true);

    return {
      status: 'success',
      totalCost: Math.round(orderResult.total * 100),
      message: `Checkout preview fetched successfully. Total: £${orderResult.total.toFixed(2)}.`,
    };
  } catch (err: any) {
    return fail(`Checkout preview error: ${err?.message || 'Could not fetch checkout preview'}`);
  }
}

