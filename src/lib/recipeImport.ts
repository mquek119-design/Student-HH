/**
 * Extracting a recipe from a web page.
 *
 * Uses schema.org JSON-LD rather than scraping markup. Almost every recipe site
 * publishes it — Google requires it for rich results — and it is a stable
 * contract, where CSS selectors break the moment a site restyles.
 *
 * Pure and free of `server-only` so the parsing can be tested against saved
 * fixtures without a network call. Fetching lives in the server action.
 */

import { parseIngredientLine } from './parseIngredient';

export interface ImportedRecipe {
  title: string;
  /** One per line, in the format the recipe form expects. */
  ingredientLines: string[];
  instructions: string[];
  servings: number | null;
  cookTimeMins: number | null;
  imageUrl: string | null;
  sourceUrl: string;
  /** Lines the ingredient parser could not read, for the user to fix. */
  unparsed: string[];
}

/** "PT1H30M" → 90. Null when absent or unreadable. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^P(?:([\d.]+)D)?T?(?:([\d.]+)H)?(?:([\d.]+)M)?/.exec(value.trim());
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const mins = Number(match[3] ?? 0);
  const total = days * 1440 + hours * 60 + mins;
  return total > 0 ? Math.round(total) : null;
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.url === 'string') return record.url;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.name === 'string') return record.name;
  }
  return null;
}

/** recipeYield is wildly inconsistent: "4", "Serves 4", ["4","4 servings"]. */
function parseYield(value: unknown): number | null {
  const text = firstString(value);
  if (!text) return null;
  const match = /(\d+)/.exec(text);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toInstructionList(value: unknown): string[] {
  if (!value) return [];
  const out: string[] = [];

  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      // Some sites cram every step into one string with newlines.
      for (const part of node.split(/\n+/)) {
        const trimmed = part.trim();
        if (trimmed) out.push(trimmed);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      // HowToSection nests its steps.
      if (record.itemListElement) {
        walk(record.itemListElement);
        return;
      }
      if (typeof record.text === 'string') {
        walk(record.text);
        return;
      }
      if (typeof record.name === 'string') walk(record.name);
    }
  };

  walk(value);
  return out;
}

/** Pulls every JSON-LD block out of a page and returns the parsed objects. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // A malformed block is common and not worth failing the import over.
    }
  }
  return blocks;
}

/** Depth-first search for the first node whose @type includes "Recipe". */
export function findRecipeNode(blocks: unknown[]): Record<string, unknown> | null {
  const queue = [...blocks];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;

    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (typeof node !== 'object') continue;

    const record = node as Record<string, unknown>;
    const type = record['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'recipe')) {
      return record;
    }

    // @graph is how many sites wrap multiple entities.
    if (record['@graph']) queue.push(record['@graph']);
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return null;
}

/**
 * Turns a page's HTML into an importable recipe, or null when the page
 * publishes no structured recipe data.
 */
export function parseRecipeFromHtml(html: string, sourceUrl: string): ImportedRecipe | null {
  const node = findRecipeNode(extractJsonLd(html));
  if (!node) return null;

  const rawIngredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient
    : Array.isArray(node.ingredients)
      ? node.ingredients
      : [];

  const ingredientLines: string[] = [];
  const unparsed: string[] = [];

  for (const entry of rawIngredients) {
    const text = typeof entry === 'string' ? entry.trim() : firstString(entry);
    if (!text) continue;

    // Our form wants "<qty> <unit> <name>". Sites usually already write that,
    // but fractions ("1½ tbsp") and leading words ("a pinch of salt") do not
    // parse — surface those rather than dropping them silently.
    const normalised = text
      .replace(/½/g, '.5')
      .replace(/¼/g, '.25')
      .replace(/¾/g, '.75')
      .replace(/⅓/g, '.33')
      .replace(/⅔/g, '.66')
      .replace(/\s+/g, ' ')
      .trim();

    if (parseIngredientLine(normalised)) {
      ingredientLines.push(normalised);
    } else {
      unparsed.push(text);
    }
  }

  const title = firstString(node.name) ?? 'Imported recipe';

  return {
    title: title.trim(),
    ingredientLines,
    instructions: toInstructionList(node.recipeInstructions),
    servings: parseYield(node.recipeYield),
    cookTimeMins:
      parseIsoDuration(node.totalTime) ??
      parseIsoDuration(node.cookTime) ??
      parseIsoDuration(node.prepTime),
    imageUrl: firstString(node.image),
    sourceUrl,
    unparsed,
  };
}
