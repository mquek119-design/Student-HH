export interface ParsedIngredient {
  quantity: number;
  unit: string;
  name: string;
}

/** Measurement words we recognise; anything else is taken as part of the name. */
const UNITS =
  /^(g|kg|ml|l|tsp|tbsp|tin|tins|pack|packs|jar|jars|box|boxes|clove|cloves|nest|nests|slice|slices|tub|tubs|bunch|whole|pint|pints)\b/i;

/**
 * Parses one ingredient line, in "<quantity> <unit> <name>" order:
 *
 *   500 g Penne pasta      → 500 g, "Penne pasta"
 *   2 tins Chopped tomatoes→ 2 tins, "Chopped tomatoes"
 *   1 Lime                 → 1 whole, "Lime"
 *
 * Lives in `lib` rather than beside the server action because both the action
 * and the form need it — a `'use server'` module may only export async
 * functions, so a sync helper cannot sit there.
 */
export function parseIngredientLine(line: string): ParsedIngredient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return null;

  const quantity = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const rest = match[2].trim();
  if (!rest) return null;

  const unitMatch = rest.match(UNITS);
  if (unitMatch) {
    const name = rest.slice(unitMatch[0].length).trim();
    if (!name) return null;
    return { quantity, unit: unitMatch[0].toLowerCase(), name };
  }

  return { quantity, unit: 'whole', name: rest };
}
