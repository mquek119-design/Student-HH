'use client';

import { useFormState } from 'react-dom';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { Button } from '@/components/ui/Button';
import { SubmitButton, useSubmitState } from '@/components/ui/SubmitButton';
import { clsx } from '@/lib/clsx';
import {
  claimCook,
  offerCook,
  removeFromMeal,
  respondToCookOffer,
  setGuests,
  setMealCapacity,
  standDownAsCook,
  type PlanActionState,
} from '@/app/plan/actions';
import { canSetCapacity, mouthsAt } from '@/lib/meals';
import type { PlannedMeal, User } from '@/lib/types';
import { MEAL_TYPE_LABELS, WEEKDAY_LABELS } from '@/lib/types';

/**
 * Everything you can change about a meal, in one place you have to ask for.
 *
 * These four controls used to sit permanently under every meal you had joined —
 * a native `<select>` for the cook, a guest stepper and a capacity button, on
 * every row, on every day. Five meals meant fifteen controls competing with the
 * thing you actually came to read, and the whole week stopped being scannable.
 *
 * They are settings, not information. You change who is cooking roughly once
 * per meal and then never again, so they belong behind a tap.
 */

const INITIAL: PlanActionState = { status: 'idle', message: '' };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
      {children}
    </h4>
  );
}

/**
 * A round +/− that submits.
 *
 * Every stepper in this sheet posts a whole form, so it is a network round trip
 * with a visible delay — the one place a control most needs to admit it is
 * working. `name`/`value` scope the spinner to the arrow actually pressed, so
 * pressing − does not set + spinning as well.
 */
function StepperButton({
  name,
  value,
  disabled,
  label,
  icon,
}: {
  name: string;
  value: string;
  disabled?: boolean;
  label: string;
  icon: string;
}) {
  const { pending, thisOne } = useSubmitState(name, value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-label={label}
      className="w-9 h-9 rounded-full border border-outline-variant text-on-surface-variant flex items-center justify-center hover:bg-surface-container disabled:opacity-40"
    >
      <Icon
        name={thisOne ? 'progress_activity' : icon}
        className={clsx('text-[18px]', thisOne && 'animate-spin')}
      />
    </button>
  );
}

/**
 * A pill that is both a choice and a submit — "Anyone can join" / "Cooking for
 * a set number", "I'm covering them" / "Split across the table".
 *
 * `selected` is a filled outline rather than a solid block, matching `Chip`:
 * solid reads as "press me", the filled outline reads as "this is on".
 */
function ChoicePill({
  name,
  value,
  selected,
  tone = 'primary',
  children,
}: {
  name: string;
  value: string;
  selected: boolean;
  tone?: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const { pending, thisOne } = useSubmitState(name, value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={clsx(
        'inline-flex items-center gap-xs px-md py-2 rounded-full border text-[13px] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-60',
        selected
          ? tone === 'secondary'
            ? 'border-secondary bg-secondary-fixed/60 text-on-secondary-fixed'
            : 'border-primary bg-primary-fixed text-on-primary-fixed'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
      )}
    >
      {thisOne && <Icon name="progress_activity" className="text-[16px] animate-spin" />}
      {children}
    </button>
  );
}

/**
 * "Ask Maya", with the avatar it needs and the spinner every other control got.
 *
 * Its own component because `useFormStatus` reads the form it is rendered
 * inside — and one per housemate means one form per housemate, so each chip
 * genuinely reports only its own.
 */
function AskCookChip({ user, asked }: { user: User; asked: boolean }) {
  const { pending } = useSubmitState();

  return (
    <button
      type="submit"
      disabled={asked || pending}
      className={clsx(
        'inline-flex items-center gap-xs pl-1 pr-md h-9 rounded-full border text-[13px] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-50',
        asked
          ? 'border-secondary bg-secondary-fixed/60 text-on-secondary-fixed'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
      )}
    >
      {pending ? (
        <Icon name="progress_activity" className="text-[18px] animate-spin ml-1" />
      ) : (
        <Avatar user={user} size="xs" />
      )}
      {asked ? `Asked ${user.name}` : `Ask ${user.name}`}
    </button>
  );
}

/**
 * Cooking, offered rather than assigned.
 *
 * Whoever adds a meal is its cook. Handing it over asks somebody — it does not
 * put their name on it, because a rota you were entered into without being
 * asked is not a rota anybody honours.
 */
function CookChoice({
  meal,
  diners,
  currentUser,
}: {
  meal: PlannedMeal;
  diners: User[];
  currentUser: User;
}) {
  const [offerState, offerAction] = useFormState(offerCook, INITIAL);
  const [respondState, respondAction] = useFormState(respondToCookOffer, INITIAL);
  const [claimState, claimAction] = useFormState(claimCook, INITIAL);
  const [standDownState, standDownAction] = useFormState(standDownAsCook, INITIAL);

  const byId = new Map(diners.map((user) => [user.id, user]));
  const cook = meal.cookedByUserId ? byId.get(meal.cookedByUserId) : undefined;
  const offeree = meal.cookOfferTo ? byId.get(meal.cookOfferTo) : undefined;

  const iAmCook = meal.cookedByUserId === currentUser.id;
  const askedMe = meal.cookOfferTo === currentUser.id;

  const error = [offerState, respondState, claimState, standDownState].find(
    (state) => state.status === 'error'
  );

  return (
    <div className="flex flex-col gap-xs">
      <SectionTitle>Who&apos;s cooking</SectionTitle>

      {/* Somebody has asked *you*. This is the only place the cooking moves. */}
      {askedMe ? (
        <form action={respondAction} className="flex flex-col gap-xs">
          <input type="hidden" name="mealId" value={meal.id} />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-on-surface font-semibold">
              {cook?.name ?? 'Somebody'} has asked you to cook this.
            </strong>{' '}
            Until you say yes, they are still down for it.
          </p>
          <div className="flex gap-xs">
            <SubmitButton name="accept" value="true" size="sm" icon="check">
              I&apos;ll cook it
            </SubmitButton>
            <SubmitButton name="accept" value="false" size="sm" variant="outline">
              No thanks
            </SubmitButton>
          </div>
        </form>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {cook ? (
            <>
              <strong className="text-on-surface font-semibold">
                {iAmCook ? 'You are' : `${cook.name} is`} cooking.
              </strong>
              {offeree && ` Waiting on ${offeree.name} to answer.`}
            </>
          ) : (
            <span className="italic">Nobody is cooking this yet.</span>
          )}
        </p>
      )}

      {/* Unclaimed: any diner may take it, since nobody is being volunteered. */}
      {!cook && !askedMe && (
        <form action={claimAction}>
          <input type="hidden" name="mealId" value={meal.id} />
          <SubmitButton size="sm" icon="skillet" className="self-start">
            I&apos;ll cook it
          </SubmitButton>
        </form>
      )}

      {iAmCook && (
        <>
          <div className="flex flex-wrap gap-xs">
            {diners
              .filter((user) => user.id !== currentUser.id)
              .map((user) => (
                <form key={user.id} action={offerAction}>
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input type="hidden" name="userId" value={user.id} />
                  <AskCookChip user={user} asked={meal.cookOfferTo === user.id} />
                </form>
              ))}
          </div>

          <form action={standDownAction}>
            <input type="hidden" name="mealId" value={meal.id} />
            <SubmitButton size="sm" variant="ghost" icon="logout" className="self-start -ml-sm">
              Stand down
            </SubmitButton>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="font-body-sm text-[12px] text-error">
          {error.message}
        </p>
      )}
    </div>
  );
}

function GuestChoice({ meal, mine }: { meal: PlannedMeal; mine: { guests?: number; guestsCovered?: boolean } }) {
  const [state, action] = useFormState(setGuests, INITIAL);
  const guests = mine.guests ?? 0;
  const covered = mine.guestsCovered ?? true;

  return (
    <form action={action} className="flex flex-col gap-xs">
      <input type="hidden" name="mealId" value={meal.id} />
      <input type="hidden" name="currentGuests" value={guests} />
      <input type="hidden" name="currentCovered" value={covered ? 'true' : 'false'} />
      <SectionTitle>Anyone with you</SectionTitle>

      <div className="flex items-center gap-sm">
        <StepperButton
          name="guests"
          value={String(Math.max(0, guests - 1))}
          disabled={guests === 0}
          label="One fewer guest"
          icon="remove"
        />
        <span
          className={clsx(
            'font-numeric-data text-body-lg min-w-[5rem] text-center',
            guests > 0 ? 'text-on-surface font-bold' : 'text-on-surface-variant'
          )}
        >
          {guests === 0 ? 'Just me' : `+${guests}`}
        </span>
        <StepperButton
          name="guests"
          value={String(Math.min(6, guests + 1))}
          disabled={guests === 6}
          label="One more guest"
          icon="add"
        />
      </div>

      {guests > 0 && (
        <div className="flex flex-wrap gap-xs">
          <ChoicePill name="setCovered" value="true" selected={covered}>
            I&apos;m covering them
          </ChoicePill>
          <ChoicePill name="setCovered" value="false" selected={!covered}>
            Split across the table
          </ChoicePill>
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-[12px] text-error">
          {state.message}
        </p>
      )}
    </form>
  );
}

function CapacityChoice({ meal, mouths }: { meal: PlannedMeal; mouths: number }) {
  const [state, action] = useFormState(setMealCapacity, INITIAL);
  const floor = Math.max(1, mouths);
  const max = meal.maxDiners;

  return (
    <form action={action} className="flex flex-col gap-xs">
      <input type="hidden" name="mealId" value={meal.id} />
      <SectionTitle>How many it feeds</SectionTitle>

      <div className="flex items-center gap-sm flex-wrap">
        <ChoicePill name="maxDiners" value="null" selected={max === null}>
          Anyone can join
        </ChoicePill>
        <ChoicePill
          name="maxDiners"
          value={String(max ?? floor)}
          selected={max !== null}
          tone="secondary"
        >
          Cooking for a set number
        </ChoicePill>
      </div>

      {max !== null && (
        <div className="flex items-center gap-sm">
          <StepperButton
            name="maxDiners"
            value={String(Math.max(floor, max - 1))}
            disabled={max <= floor}
            label="Cook for one fewer"
            icon="remove"
          />
          <span className="font-numeric-data text-body-lg min-w-[5rem] text-center font-bold">
            {max}
          </span>
          <StepperButton
            name="maxDiners"
            value={String(Math.min(20, max + 1))}
            disabled={max >= 20}
            label="Cook for one more"
            icon="add"
          />
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Can&apos;t go below the {mouths} already in — nobody gets removed by a stepper.
          </span>
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-[12px] text-error">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** One form per diner, so this reports only the row being removed. */
function RemoveDinerButton({ name }: { name: string }) {
  const { pending } = useSubmitState();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Take ${name} off this meal`}
      className={clsx(
        'inline-flex items-center gap-xs px-sm h-8 rounded-full border border-outline-variant',
        'text-on-surface-variant text-[12px] font-semibold transition-colors',
        'hover:border-error hover:text-error hover:bg-error-container/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-60'
      )}
    >
      {pending && <Icon name="progress_activity" className="text-[14px] animate-spin" />}
      Take off
    </button>
  );
}

function DinerList({
  meal,
  diners,
  currentUser,
  canRemove,
}: {
  meal: PlannedMeal;
  diners: { user: User; guests: number }[];
  currentUser: User;
  canRemove: boolean;
}) {
  const [state, action] = useFormState(removeFromMeal, INITIAL);

  return (
    <div className="flex flex-col gap-xs">
      <SectionTitle>Who&apos;s in</SectionTitle>
      <ul className="flex flex-col divide-y divide-surface-container-highest">
        {diners.map(({ user, guests }) => (
          <li key={user.id} className="py-sm flex items-center justify-between gap-sm">
            <span className="flex items-center gap-sm min-w-0">
              <Avatar user={user} size="sm" />
              <span className="min-w-0">
                <span className="block font-body-lg text-body-lg font-semibold truncate">
                  {user.id === currentUser.id ? 'You' : user.name}
                </span>
                {guests > 0 && (
                  <span className="block font-body-sm text-[12px] text-on-surface-variant">
                    plus {guests} guest{guests === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            </span>

            {canRemove && user.id !== currentUser.id && (
              <form action={action}>
                <input type="hidden" name="mealId" value={meal.id} />
                <input type="hidden" name="userId" value={user.id} />
                <RemoveDinerButton name={user.name} />
              </form>
            )}
          </li>
        ))}
      </ul>

      {canRemove && (
        <p className="font-body-sm text-[12px] text-on-surface-variant">
          Only before the shop goes in. Afterwards their share is bought and it&apos;s theirs.
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-[12px] text-error">
          {state.message}
        </p>
      )}
    </div>
  );
}

export function MealOptionsSheet({
  meal,
  diners,
  currentUser,
  onClose,
}: {
  meal: PlannedMeal;
  diners: { user: User; guests: number }[];
  currentUser: User;
  onClose: () => void;
}) {
  const mine = meal.participants.find((participant) => participant.userId === currentUser.id);
  const isOwner = canSetCapacity(meal, currentUser.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div className="relative w-full sm:max-w-md bg-surface-container-lowest rounded-t-xl sm:rounded-xl border border-surface-container-highest shadow-ambient-card p-lg flex flex-col gap-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              {WEEKDAY_LABELS[meal.day]} · {MEAL_TYPE_LABELS[meal.mealType]}
            </span>
            <h3 className="font-title-md text-title-md leading-tight">{meal.recipeTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
          >
            <Icon name="close" />
          </button>
        </div>

        <CookChoice
          meal={meal}
          diners={diners.map((entry) => entry.user)}
          currentUser={currentUser}
        />
        {mine && <GuestChoice meal={meal} mine={mine} />}
        {isOwner && <CapacityChoice meal={meal} mouths={mouthsAt(meal)} />}
        <DinerList
          meal={meal}
          diners={diners}
          currentUser={currentUser}
          canRemove={isOwner}
        />

        <Button variant="outline" fullWidth onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
