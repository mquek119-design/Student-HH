'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, getWeeklyPlan } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { TescoProvider } from '../../../lib/tesco/providers/tesco';

export interface SlotOption {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Unambiguous instants, used for storage. Display strings are Europe/London. */
  startsAt: string | null;
  endsAt: string | null;
  /** Charge in integer pence. Collection slots are often 0. */
  charge: number;
  available: boolean;
}

export interface SlotActionState {
  status: 'idle' | 'error' | 'success';
  message: string;
  slots?: SlotOption[];
}

const fail = (message: string): SlotActionState => ({ status: 'error', message });

/**
 * Lists bookable slots for the house's chosen fulfilment method.
 *
 * This replaces reading a delivery cost off the checkout page. Tesco returns a
 * price per slot, so the charge is quoted rather than inferred — and a figure
 * that ends up in someone's share of the bill should never come from a regex
 * over page text.
 *
 * Requires an authenticated Tesco session (unlike product search, which does
 * not). Returns a legible error rather than throwing if the session is absent.
 */
export async function listSlots(
  method: 'delivery' | 'collect' = 'delivery'
): Promise<SlotActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  try {
    const provider = new TescoProvider();

    if (!(await provider.isAuthenticated())) {
      return fail(
        'Tesco session required to list slots. Import your cookies under House Settings first.'
      );
    }

    const raw = await provider.getDeliverySlots(method);
    const slots: SlotOption[] = raw
      .map((slot) => ({
        slotId: slot.slot_id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        startsAt: (slot as { starts_at?: string | null }).starts_at ?? null,
        endsAt: (slot as { ends_at?: string | null }).ends_at ?? null,
        // Tesco quotes pounds; everything here is integer pence.
        charge: Math.round((Number(slot.price) || 0) * 100),
        available: slot.available,
      }))
      .filter((slot) => slot.available && slot.slotId);

    if (slots.length === 0) {
      return fail(
        `No ${method === 'collect' ? 'collection' : 'delivery'} slots came back. ` +
          'Check the store or postcode in House Settings, and that the session is still valid.'
      );
    }

    return { status: 'success', message: `${slots.length} slots available.`, slots };
  } catch (error) {
    return fail(`Could not load slots: ${(error as Error).message ?? 'unknown error'}`);
  }
}

/**
 * Records the chosen slot against this week's plan and books it with Tesco.
 *
 * Stored before booking: if booking fails the house still sees which slot was
 * intended and what it costs, rather than losing the choice entirely.
 */
export async function chooseSlot(
  slot: SlotOption,
  method: 'delivery' | 'collect' = 'delivery'
): Promise<SlotActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const plan = await getWeeklyPlan();
  if (!plan?.id) return fail('No plan for this week yet.');

  const supabase = createClient();
  const saved = await supabase
    .from('weekly_plans')
    .update({
      slot_id: slot.slotId,
      slot_method: method,
      // Store the instant Tesco gave us. Rebuilding a timestamp from the
      // display strings would bake in whatever zone they were rendered for.
      slot_starts_at: slot.startsAt,
      slot_ends_at: slot.endsAt,
      slot_charge: slot.charge,
    })
    .eq('id', plan.id);

  if (saved.error) {
    const hint =
      saved.error.code === '42703'
        ? ' — run supabase/migrations/0009_booked_slot.sql.'
        : '';
    return fail(`Could not save the slot: ${saved.error.message}${hint}`);
  }

  let bookingNote = '';
  try {
    const provider = new TescoProvider();
    await provider.bookSlot(slot.slotId);
  } catch (error) {
    // The choice is recorded either way; the collector can book manually.
    bookingNote =
      ` Saved, but booking it with Tesco failed (${(error as Error).message ?? 'unknown error'}) — ` +
      'book it yourself on tesco.com before checking out.';
  }

  revalidatePath('/basket');
  revalidatePath('/split');

  return {
    status: 'success',
    message:
      `Slot booked for ${slot.date} ${slot.startTime}–${slot.endTime}` +
      (slot.charge > 0 ? ` (£${(slot.charge / 100).toFixed(2)})` : ' (free)') +
      '.' +
      bookingNote,
  };
}
