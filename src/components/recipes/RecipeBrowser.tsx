'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import { addMealToPlan, type PlanActionState } from '@/app/plan/actions';
import type { MealType, Recipe, Weekday } from '@/lib/types';
import type { WeekChoice } from '@/lib/weeks';
import { MEAL_TYPES, MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, WEEKDAYS, WEEKDAY_LABELS } from '@/lib/types';

/**
 * The house recipe book, and the way meals get planned.
 *
 * This owns a whole screen rather than a section of the Plan tab. It was inline
 * on Plan for exactly one iteration, which made Plan about 70% recipe browser
 * and left two differently-designed browsers over one dataset. A library and a
 * week are different things with different lifespans; they get different pages.
 *
 * Arriving from a day card (`/recipes?day=wed`) pre-selects that day and
 * returns you to the week once the meal lands, so planning is still two taps.
 * Arriving with no day is ordinary browsing and stays put.
 */

const INITIAL: PlanActionState = { status: 'idle', message: '' };

/** Under this, a recipe is quick enough to cook on a weeknight after lectures. */
const QUICK_MINUTES = 25;

/** Per portion. Above this it is not a student budget meal. */
const BUDGET_PENCE = 250;

/**
 * Meat and fish words, for the Veggie filter.
 *
 * A heuristic, and a deliberately cautious one: it only ever *excludes*, so the
 * failure mode is a vegetarian recipe missing from the filter rather than a
 * chicken curry appearing in it. Recipes tagged vegetarian or vegan are trusted
 * outright.
 */
const MEAT_WORDS = [
  'chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'ham', 'turkey', 'duck',
  'mince', 'steak', 'salmon', 'tuna', 'prawn', 'fish', 'anchovy', 'chorizo',
  'pepperoni', 'gelatin', 'stock cube',
];

type ChipKey = 'quick' | 'budget' | 'pantry' | 'veggie';

interface Chip {
  key: ChipKey;
  label: string;
  icon: string;
  matches: (recipe: Recipe) => boolean;
}

const CHIPS: Chip[] = [
  {
    key: 'quick',
    label: 'Quick',
    icon: 'bolt',
    matches: (recipe) => recipe.cookTimeMins <= QUICK_MINUTES,
  },
  {
    key: 'budget',
    label: 'Budget',
    icon: 'savings',
    // Zero means "not priced yet", not "free" — an unpriced recipe must never
    // pass a budget filter by being cheapest of all.
    matches: (recipe) => recipe.costPerPortion > 0 && recipe.costPerPortion <= BUDGET_PENCE,
  },
  {
    key: 'pantry',
    label: 'Pantry match',
    icon: 'kitchen',
    matches: (recipe) => recipe.ingredients.some((ingredient) => ingredient.inPantry),
  },
  {
    key: 'veggie',
    label: 'Veggie',
    icon: 'eco',
    matches: (recipe) => {
      const tags = recipe.tags.map((tag) => tag.toLowerCase());
      if (tags.includes('vegetarian') || tags.includes('vegan') || tags.includes('veggie')) {
        return true;
      }
      return !recipe.ingredients.some((ingredient) => {
        const name = ingredient.name.toLowerCase();
        return MEAT_WORDS.some((word) => name.includes(word));
      });
    },
  },
];

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth icon="check" pending={pending} pendingLabel="Adding…">
      {label}
    </Button>
  );
}

/** Day + sitting, as tap targets. No dropdown, no free text, two taps to plan. */
function QuickAddSheet({
  recipe,
  onClose,
  onPlanned,
  locked,
  initialDay,
  week,
}: {
  recipe: Recipe;
  onClose: () => void;
  onPlanned: () => void;
  locked: boolean;
  initialDay: Weekday;
  week: WeekChoice;
}) {
  const [state, action] = useFormState(addMealToPlan, INITIAL);
  const [day, setDay] = useState<Weekday>(initialDay);
  const [mealType, setMealType] = useState<MealType>('dinner');

  // Close on success only. Staying open after an error is the point — the
  // message is inside the sheet.
  useEffect(() => {
    if (state.status === 'success') onPlanned();
  }, [state, onPlanned]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div className="relative w-full sm:max-w-md bg-surface-container-lowest rounded-t-xl sm:rounded-xl border border-surface-container-highest shadow-ambient-card p-lg flex flex-col gap-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-start gap-sm">
          <FoodImage
            seed={recipe.id}
            alt={recipe.title}
            className="w-14 h-14 rounded-lg text-[24px] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-title-md text-title-md leading-tight">{recipe.title}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {recipe.cookTimeMins} min · serves {recipe.servings}
            </p>
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

        <form action={action} className="flex flex-col gap-md">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="mealType" value={mealType} />
          {/* Which plan the meal lands on. Without it every add would go to the
              week being eaten, which is the one you cannot change. */}
          <input type="hidden" name="week" value={week} />

          <fieldset className="flex flex-col gap-xs">
            <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-xs">
              Which day
            </legend>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-xs">
              {WEEKDAYS.map((option) => (
                <Chip
                  key={option}
                  active={day === option}
                  tickWhenActive={false}
                  onClick={() => setDay(option)}
                  className="h-11 w-full justify-center px-0"
                >
                  {WEEKDAY_LABELS[option].slice(0, 3)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-xs">
            <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-xs">
              Which sitting
            </legend>
            <div className="grid grid-cols-3 gap-xs">
              {MEAL_TYPES.map((option) => (
                <Chip
                  key={option}
                  active={mealType === option}
                  tickWhenActive={false}
                  icon={MEAL_TYPE_ICONS[option]}
                  onClick={() => setMealType(option)}
                  className="h-11 w-full justify-center px-0"
                >
                  {MEAL_TYPE_LABELS[option]}
                </Chip>
              ))}
            </div>
          </fieldset>

          {locked ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Planning is closed for this week.
            </p>
          ) : (
            <AddButton label={`Add to ${WEEKDAY_LABELS[day]}${week === 'next' ? ' next week' : ''}`} />
          )}

          {state.status === 'error' ? (
            <p role="alert" className="font-body-sm text-body-sm text-error">
              {state.message}
            </p>
          ) : (
            <p className="font-body-sm text-[12px] text-on-surface-variant">
              If a housemate already picked this for the same sitting you&apos;ll join them —
              that overlap is where the savings come from.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export function RecipeBrowser({
  recipes,
  locked,
  planningForDay,
  week = 'this',
}: {
  recipes: Recipe[];
  locked: boolean;
  /** Set when you arrived from a day card. Pre-selects it and returns you there. */
  planningForDay?: Weekday;
  /** Which week a pick lands on. */
  week?: WeekChoice;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ChipKey[]>([]);
  const [chosen, setChosen] = useState<Recipe | null>(null);

  const today = WEEKDAYS[(new Date().getDay() + 6) % 7];

  // A chip that can only ever return nothing is worse than no chip: it looks
  // like the house has no cheap meals rather than no recorded prices.
  const usable = useMemo(
    () => new Set(CHIPS.filter((chip) => recipes.some(chip.matches)).map((chip) => chip.key)),
    [recipes]
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (needle) {
        const haystack = `${recipe.title} ${recipe.tags.join(' ')} ${recipe.ingredients
          .map((ingredient) => ingredient.name)
          .join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return active.every((key) => CHIPS.find((chip) => chip.key === key)?.matches(recipe));
    });
  }, [recipes, query, active]);

  function toggle(key: ChipKey) {
    setActive((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm">
        <label className="relative block">
          <span className="sr-only">Search recipes</span>
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a recipe, or something in the fridge…"
            className="w-full h-12 pl-10 pr-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg"
          />
        </label>

        <div className="flex gap-xs overflow-x-auto hide-scrollbar pb-1">
          {CHIPS.map((chip) => {
            const on = active.includes(chip.key);
            const available = usable.has(chip.key);
            return (
              <Chip
                key={chip.key}
                active={on}
                icon={chip.icon}
                disabled={!available}
                onClick={() => toggle(chip.key)}
                title={
                  available
                    ? undefined
                    : chip.key === 'budget'
                      ? 'No recipe has a cost per portion yet — build a basket to price them.'
                      : 'Nothing matches this yet.'
                }
              >
                {chip.label}
              </Chip>
            );
          })}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-sm py-lg text-center">
          <Icon name="search_off" className="text-on-surface-variant text-[32px]" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Nothing matches. Drop a filter, or{' '}
            <Link href="/recipes/new" className="text-primary font-semibold underline">
              add the recipe
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-md">
          {results.map((recipe) => {
            const inPantry = recipe.ingredients.filter((ingredient) => ingredient.inPantry).length;
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => setChosen(recipe)}
                  className={clsx(
                    'group w-full h-full text-left bg-surface-container-lowest rounded-xl border border-surface-container-highest',
                    'shadow-ambient-card overflow-hidden flex flex-col transition-all',
                    'hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0'
                  )}
                >
                  <span className="relative block overflow-hidden">
                    <FoodImage
                      seed={recipe.id}
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-24 text-[32px] transition-transform duration-200 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/25 to-transparent" />
                  </span>
                  <span className="p-sm flex flex-col gap-xs flex-1">
                    <span className="font-body-lg text-body-lg font-semibold leading-tight line-clamp-2">
                      {recipe.title}
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant flex items-center gap-xs flex-wrap mt-auto">
                      <span className="flex items-center gap-0.5">
                        <Icon name="schedule" className="text-[14px]" />
                        {recipe.cookTimeMins} min
                      </span>
                      {/* Never "£0.00/portion": zero means unpriced, and this
                          screen is where people judge what a meal costs. */}
                      {recipe.costPerPortion > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-numeric-data">
                            {formatPence(recipe.costPerPortion)}/portion
                          </span>
                        </>
                      )}
                    </span>
                    {inPantry > 0 && (
                      <span className="font-label-caps text-label-caps uppercase text-primary">
                        {inPantry} already in the pantry
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ButtonLink href="/recipes/new" variant="ghost" size="sm" icon="add" className="self-start">
        Add one the house hasn&apos;t got
      </ButtonLink>

      {chosen && (
        <QuickAddSheet
          recipe={chosen}
          locked={locked}
          initialDay={planningForDay ?? today}
          week={week}
          onClose={() => setChosen(null)}
          onPlanned={() => {
            setChosen(null);
            // Came from the week, so go back to it — landing on a recipe list
            // after planning leaves you wondering whether it worked.
            if (planningForDay) router.push(week === 'next' ? '/plan?week=next' : '/plan');
            else router.refresh();
          }}
        />
      )}
    </div>
  );
}
