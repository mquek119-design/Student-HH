'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/media/Icon';
import { clsx } from '@/lib/clsx';

/**
 * A submit button that knows its own form is in flight.
 *
 * `useFormStatus` only reports for the form the calling component is rendered
 * *inside*, so a page cannot hand `pending` down to its buttons — each one has
 * to be its own component. That is the whole reason this file exists, and why
 * roughly thirty raw `<button type="submit">` across the app spun at nothing:
 * there was nowhere for them to read the state from.
 *
 * **Several submits in one form.** `useFormStatus` goes true for all of them,
 * which would set every button in the row spinning at once. `data` carries the
 * FormData actually being submitted, and a submit button contributes its own
 * `name`/`value` to that — so passing `name` and `value` here scopes the
 * spinner to the button that was really pressed. The others disable, which is
 * right: while the form is going nothing else in it should be clickable.
 */
export function SubmitButton({
  name,
  value,
  ...props
}: ComponentProps<typeof Button> & { name?: string; value?: string }) {
  const { pending, data } = useFormStatus();

  // Unscoped: one submit in the form, so its pending is the form's pending.
  const isThisOne = name === undefined || value === undefined || data?.get(name) === value;

  return (
    <Button
      {...props}
      type="submit"
      name={name}
      value={value}
      pending={pending && isThisOne}
      disabled={props.disabled || pending}
    />
  );
}

/**
 * A bare icon that submits — the little × that removes a row.
 *
 * It has no label to swap, so the icon itself becomes the spinner. These sit in
 * lists where every row has one, and each row is its own form, so the spinner
 * lands on the row being removed rather than all of them.
 */
export function IconSubmitButton({
  icon = 'close',
  label,
  className,
}: {
  icon?: string;
  /** Required: with no text, this is the only thing a screen reader has. */
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      className={clsx(
        'p-2 rounded-full text-on-surface-variant transition-colors',
        'hover:bg-error-container hover:text-error',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-60',
        className
      )}
    >
      <Icon
        name={pending ? 'progress_activity' : icon}
        className={clsx('text-[18px]', pending && 'animate-spin')}
      />
    </button>
  );
}

/**
 * The same knowledge, for controls the `Button` variants do not cover — round
 * steppers, selectable pills, a chip with an avatar in it. Returns whether
 * *this* control is the one in flight, and whether the form is busy at all.
 *
 * Kept as a hook rather than another component because these controls carry
 * their own shape and selected-state styling; wrapping them would mean passing
 * a dozen classes through a component that has no opinion about them.
 */
export function useSubmitState(name?: string, value?: string): {
  pending: boolean;
  thisOne: boolean;
} {
  const { pending, data } = useFormStatus();
  const isThisOne = name === undefined || value === undefined || data?.get(name) === value;
  return { pending, thisOne: pending && isThisOne };
}
