'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { Icon } from '@/components/media/Icon';
import { Notice } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';
import { respondToCookOffer, type PlanActionState } from '@/app/plan/actions';
import type { PlannedMeal, User } from '@/lib/types';
import { WEEKDAY_LABELS, MEAL_TYPE_LABELS } from '@/lib/types';

const INITIAL: PlanActionState = { status: 'idle', message: '' };

interface CookOfferPromptProps {
  offers: PlannedMeal[];
  housemates: User[];
}

/**
 * Shows pending cook offers to the current user.
 *
 * Displayed at the top of the plan page when there are pending offers.
 * Shows up to 3 offers; if more than 3, shows a "View all" link to a modal.
 * Users can accept or decline each offer with immediate feedback.
 */
export function CookOfferPrompt({ offers: initialOffers, housemates }: CookOfferPromptProps) {
  const [offers, setOffers] = useState(initialOffers);
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (offers.length === 0) {
    return null;
  }

  const shown = offers.slice(0, 3);
  const hasMore = offers.length > 3;

  const handleOfferResponded = (respondedMealId: string) => {
    startTransition(() => {
      setOffers((current) => current.filter((meal) => meal.id !== respondedMealId));
    });
  };

  return (
    <>
      <div className="flex flex-col gap-md">
        {shown.map((meal) => (
          <CookOfferCard
            key={meal.id}
            meal={meal}
            housemates={housemates}
            onRespond={handleOfferResponded}
            disabled={isPending}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setShowModal(true)}
            className="text-center text-primary hover:text-primary-container font-semibold text-sm py-md"
          >
            View all {offers.length} offers
          </button>
        )}
      </div>

      {showModal && (
        <CookOfferModal
          offers={offers}
          housemates={housemates}
          onClose={() => setShowModal(false)}
          onRespond={handleOfferResponded}
          disabled={isPending}
        />
      )}
    </>
  );
}

interface CookOfferCardProps {
  meal: PlannedMeal;
  housemates: User[];
  onRespond: (mealId: string) => void;
  disabled?: boolean;
}

function CookOfferCard({ meal, housemates, onRespond, disabled }: CookOfferCardProps) {
  const cooker = housemates.find((h) => h.id === meal.cookedByUserId);
  const cookerName = cooker?.name ?? 'Someone';
  const dayLabel = WEEKDAY_LABELS[meal.day];
  const mealLabel = MEAL_TYPE_LABELS[meal.mealType];

  return (
    <Notice tone="suggest" icon="local_dining">
      <div className="flex flex-col gap-sm">
        <div>
          <p className="font-semibold text-on-surface">{meal.recipeTitle}</p>
          <p className="text-on-surface-variant text-sm">
            {cookerName} is asking you to cook on {dayLabel} {mealLabel}
          </p>
        </div>
        <div className="flex gap-sm pt-xs">
          <CookOfferResponseButton
            meal={meal}
            accept={true}
            onRespond={onRespond}
            disabled={disabled}
          />
          <CookOfferResponseButton
            meal={meal}
            accept={false}
            onRespond={onRespond}
            disabled={disabled}
          />
        </div>
      </div>
    </Notice>
  );
}

interface CookOfferResponseButtonProps {
  meal: PlannedMeal;
  accept: boolean;
  onRespond: (mealId: string) => void;
  disabled?: boolean;
}

function CookOfferResponseButton({
  meal,
  accept,
  onRespond,
  disabled,
}: CookOfferResponseButtonProps) {
  const [_state, formAction] = useFormState(respondToCookOffer, INITIAL);

  const handleAction = async (formData: FormData) => {
    await formAction(formData);
    onRespond(meal.id);
  };

  return (
    <form action={handleAction} className="flex-1">
      <input type="hidden" name="mealId" value={meal.id} />
      <input type="hidden" name="accept" value={accept ? 'true' : 'false'} />
      <Button
        type="submit"
        variant={accept ? 'primary' : 'outline'}
        size="sm"
        fullWidth
        disabled={disabled}
      >
        {accept ? 'Accept' : 'Decline'}
      </Button>
    </form>
  );
}

interface CookOfferModalProps {
  offers: PlannedMeal[];
  housemates: User[];
  onClose: () => void;
  onRespond: (mealId: string) => void;
  disabled?: boolean;
}

function CookOfferModal({
  offers,
  housemates,
  onClose,
  onRespond,
  disabled,
}: CookOfferModalProps) {
  // Auto-close when all offers are responded to
  if (offers.length === 0) {
    return null;
  }

  const handleRespond = (mealId: string) => {
    onRespond(mealId);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-0 top-0 bottom-0 z-50 flex items-center justify-center overflow-y-auto p-md">
        <div className="w-full max-w-md rounded-xl bg-surface-0 p-md shadow-lg my-auto">
          <div className="flex flex-col gap-md">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-title-lg text-title-lg text-on-surface">
                Cook Offers ({offers.length})
              </h2>
              <button
                onClick={onClose}
                disabled={disabled}
                className="p-xs text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
              >
                <Icon name="close" className="text-2xl" />
              </button>
            </div>

            {/* Offers list */}
            <div className="flex flex-col gap-md max-h-96 overflow-y-auto">
              {offers.map((meal) => (
                <CookOfferCard
                  key={meal.id}
                  meal={meal}
                  housemates={housemates}
                  onRespond={handleRespond}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
