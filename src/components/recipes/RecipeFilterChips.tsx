import { Chip } from '@/components/ui/Chip';
import type { Recipe } from '@/lib/types';

/**
 * Dietary tags supported for filtering.
 * Each tag represents a common dietary restriction or preference.
 */
export const DIETARY_TAGS = [
  { key: 'vegetarian', label: 'Vegetarian', icon: 'eco' },
  { key: 'vegan', label: 'Vegan', icon: 'eco' },
  { key: 'gluten-free', label: 'Gluten-free', icon: 'shield' },
  { key: 'nut-free', label: 'Nut-free', icon: 'shield' },
  { key: 'dairy-free', label: 'Dairy-free', icon: 'shield' },
  { key: 'egg-free', label: 'Egg-free', icon: 'shield' },
] as const;

export type DietaryTagKey = (typeof DIETARY_TAGS)[number]['key'];

/**
 * Filter chips for dietary tags on the recipe browser.
 * Allows users to find recipes that match their dietary requirements or preferences.
 */
export function RecipeFilterChips({
  active,
  usable,
  onToggle,
}: {
  active: DietaryTagKey[];
  usable: Set<DietaryTagKey>;
  onToggle: (key: DietaryTagKey) => void;
}) {
  return (
    <div className="flex gap-xs overflow-x-auto hide-scrollbar pb-1">
      {DIETARY_TAGS.map((tag) => {
        const on = active.includes(tag.key);
        const available = usable.has(tag.key);
        return (
          <Chip
            key={tag.key}
            active={on}
            icon={tag.icon}
            disabled={!available}
            onClick={() => onToggle(tag.key)}
            title={available ? undefined : 'No recipes match this yet.'}
          >
            {tag.label}
          </Chip>
        );
      })}
    </div>
  );
}

/**
 * Check if a recipe matches all active dietary filters.
 * A recipe matches if all its dietary tags include the filter tags,
 * or if it has no dietary tag and the filter is broad.
 */
export function matchesDietaryFilter(recipe: Recipe, filters: DietaryTagKey[]): boolean {
  if (filters.length === 0) return true;
  if (recipe.dietaryTags.length === 0) return false;
  return filters.every((filter) =>
    recipe.dietaryTags.some((tag) => tag.toLowerCase() === filter.toLowerCase())
  );
}
