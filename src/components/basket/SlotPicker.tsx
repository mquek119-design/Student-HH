'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import { describeMatch, hasPreference, suggestSlot, type SlotPreference } from '@/lib/slotMatching';
import { chooseSlot, listSlots, type SlotActionState, type SlotOption } from '@/app/basket/slotActions';

/**
 * Choosing the delivery or collection slot for this week's order.
 *
 * Two rules shape this:
 *
 *  1. **The collector always actively selects.** A saved preference only
 *     highlights a suggestion — nothing is booked on the house's behalf, because
 *     the charge lands in everyone's split and a slot booked by accident is a
 *     real cost and a wasted delivery window.
 *  2. **A house with no preference loses nothing.** The picker simply opens on
 *     delivery and lists what is available.
 */
export function SlotPicker({
  preference,
  bookedSlot,
  isCollector,
}: {
  preference: SlotPreference;
  bookedSlot: { startsAt: string | null; charge: number; method: string } | null;
  isCollector: boolean;
}) {
  // Open on the preferred method when there is one, else delivery.
  const [method, setMethod] = useState<'delivery' | 'collect'>(
    preference.method ?? 'delivery'
  );
  const [state, setState] = useState<SlotActionState>({ status: 'idle', message: '' });
  const [pending, startTransition] = useTransition();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const slots = state.slots ?? [];
  const suggestion = hasPreference(preference) ? suggestSlot(slots, preference) : null;

  const load = useCallback(
    (target: 'delivery' | 'collect') => {
      startTransition(async () => {
        const result = await listSlots(target);
        setState(result);
        setLoadedFor(target);
      });
    },
    []
  );

  // Reload when the collector switches method, but never fetch on first render:
  // slots need a Tesco session, and a failed background call would show an
  // alarming error to someone who has not asked for anything yet.
  useEffect(() => {
    if (loadedFor !== null && loadedFor !== method) load(method);
  }, [method, loadedFor, load]);

  function pick(slot: SlotOption) {
    startTransition(async () => {
      const result = await chooseSlot(slot, method);

      if (result.status === 'error') {
        // A refusal usually means the slot went while the list was on screen,
        // so re-fetch rather than leaving stale options the collector will
        // keep clicking. Show the reason above the refreshed list.
        const refreshed = await listSlots(method);
        setState({ ...result, slots: refreshed.slots ?? [] });
        setLoadedFor(method);
        return;
      }

      setState({ ...result, slots: undefined });
      setLoadedFor(null);
    });
  }

  const label = method === 'collect' ? 'Click & Collect' : 'Delivery';

  return (
    <Card accent={state.status === 'error' ? 'error' : 'none'} className="flex flex-col gap-md">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Delivery Slot</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {bookedSlot
              ? `Booked${
                  bookedSlot.startsAt
                    ? `: ${new Date(bookedSlot.startsAt).toLocaleString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'Europe/London',
                      })}`
                    : ''
                } — the charge is split equally across the house.`
              : 'Pick a slot. Its charge is added to the split, divided equally.'}
          </p>
        </div>
        {bookedSlot && (
          <span className="shrink-0 text-right">
            <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant">
              {bookedSlot.method === 'collect' ? 'Collection' : 'Delivery'}
            </span>
            <span className="block font-numeric-data text-numeric-data">
              {bookedSlot.charge > 0 ? formatPence(bookedSlot.charge) : 'Free'}
            </span>
          </span>
        )}
      </div>

      {/* Method is chosen here, not in House Settings — a household may collect
          one week and have it delivered the next. */}
      <div role="tablist" className="flex items-center gap-1 p-1 bg-surface-container rounded-lg">
        {(['delivery', 'collect'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={method === option}
            disabled={!isCollector || pending}
            onClick={() => setMethod(option)}
            className={clsx(
              'flex-1 px-md py-2 rounded font-body-sm text-body-sm transition-colors disabled:opacity-60',
              method === option
                ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {option === 'collect' ? 'Click & Collect' : 'Delivery'}
          </button>
        ))}
      </div>

      {!isCollector ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Only the collector can book the slot — it uses their Tesco account.
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => load(method)}
          className="w-full h-11 rounded-lg border border-primary text-primary font-semibold flex items-center justify-center gap-sm hover:bg-primary/10 transition-colors disabled:opacity-60"
        >
          <Icon name={pending ? 'progress_activity' : 'event_available'} className="text-[18px]" />
          {pending
            ? 'Loading…'
            : slots.length > 0
              ? `Refresh ${label.toLowerCase()} slots`
              : `Find ${label.toLowerCase()} slots`}
        </button>
      )}

      {suggestion && (
        <p className="font-body-sm text-body-sm text-primary flex items-start gap-xs">
          <Icon name="auto_awesome" className="text-[18px] mt-0.5 shrink-0" />
          <span>
            Suggested below based on your house preference — {describeMatch(suggestion, preference).toLowerCase()}.
            Select it to confirm.
          </span>
        </p>
      )}

      {slots.length > 0 && (
        <ul className="flex flex-col gap-xs max-h-80 overflow-y-auto">
          {slots.map((slot) => {
            const isSuggested = suggestion?.slotId === slot.slotId;
            return (
              <li key={slot.slotId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pick(slot)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-md px-md py-2 rounded-lg border transition-colors text-left disabled:opacity-60',
                    isSuggested
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-surface-container-highest hover:border-primary hover:bg-primary/5'
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-xs">
                      <span className="font-body-sm text-body-sm truncate">
                        {new Date(`${slot.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'Europe/London',
                        })}
                      </span>
                      {isSuggested && (
                        <span className="font-label-caps text-[10px] uppercase text-primary border border-primary/40 rounded px-1">
                          Suggested
                        </span>
                      )}
                    </span>
                    <span className="block font-numeric-data text-[12px] text-on-surface-variant">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </span>
                  <span className="font-numeric-data text-numeric-data shrink-0">
                    {slot.charge > 0 ? formatPence(slot.charge) : 'Free'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {state.message && (
        <p
          role="status"
          className={clsx(
            'font-body-sm text-body-sm',
            state.status === 'error' ? 'text-error' : 'text-primary'
          )}
        >
          {state.message}
        </p>
      )}
    </Card>
  );
}
