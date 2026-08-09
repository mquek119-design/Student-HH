/**
 * Unit handling for ingredient aggregation.
 *
 * Two recipes wanting "500 g" and "0.5 kg" of pasta must add up to one kilo,
 * not two incompatible lines. Anything we cannot convert with confidence is
 * kept separate rather than guessed at — silently treating 2 "tins" as 2 "g"
 * would corrupt the shop and, downstream, the split.
 */

/** Canonical base unit for each dimension we can convert within. */
type Dimension = 'mass' | 'volume' | 'count';

interface UnitSpec {
  dimension: Dimension;
  /** Multiplier to the dimension's base unit (g, ml, or one item). */
  toBase: number;
}

const UNITS: Record<string, UnitSpec> = {
  g: { dimension: 'mass', toBase: 1 },
  kg: { dimension: 'mass', toBase: 1000 },
  ml: { dimension: 'volume', toBase: 1 },
  l: { dimension: 'volume', toBase: 1000 },
  // Cooking spoons are volume by convention (UK metric).
  tsp: { dimension: 'volume', toBase: 5 },
  tbsp: { dimension: 'volume', toBase: 15 },
  pint: { dimension: 'volume', toBase: 568 },
  pints: { dimension: 'volume', toBase: 568 },
};

/**
 * Countable units. These are NOT interchangeable with each other — a tin is not
 * a pack — so each forms its own aggregation group, converting only to itself.
 */
const COUNT_UNITS = new Set([
  'whole', 'each', 'piece', 'pieces', 'item', 'items',
  'tin', 'tins', 'pack', 'packs', 'jar', 'jars', 'box', 'boxes',
  'clove', 'cloves', 'nest', 'nests', 'slice', 'slices', 'tub', 'tubs', 'bunch',
]);

/**
 * Collapses countable units to one canonical spelling so they aggregate.
 *
 * "each", "piece" and "item" all mean a bare countable thing, so they fold into
 * "whole". Without this a recipe saying `2 each Onion` and another saying
 * `1 Onion` (which the parser records as `whole`) land in different groups and
 * are never pooled — silently defeating the overlap the app exists for.
 *
 * Note "pack" deliberately stays distinct: a pack is a container, and how many
 * items it holds is pack data, not a unit.
 */
function canonicalCount(unit: string): string {
  const map: Record<string, string> = {
    each: 'whole', piece: 'whole', pieces: 'whole', item: 'whole', items: 'whole',
    tins: 'tin', packs: 'pack', jars: 'jar', boxes: 'box', cloves: 'clove',
    nests: 'nest', slices: 'slice', tubs: 'tub', pints: 'pint',
  };
  return map[unit] ?? unit;
}

export function normaliseUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

/**
 * A key identifying what can be summed together. Two quantities may only be
 * added when their group keys match.
 */
export function unitGroup(unit: string): string {
  const u = normaliseUnit(unit);
  const spec = UNITS[u];
  if (spec) return spec.dimension;
  if (COUNT_UNITS.has(u)) return `count:${canonicalCount(u)}`;
  // Unrecognised: its own group, so it never merges with anything else.
  return `raw:${u}`;
}

/** Converts a quantity into its group's base unit. Returns null if impossible. */
export function toBaseQuantity(quantity: number, unit: string): number | null {
  const u = normaliseUnit(unit);
  const spec = UNITS[u];
  if (spec) return quantity * spec.toBase;
  if (COUNT_UNITS.has(u) || u) return quantity;
  return null;
}

/** The unit a group's base quantity is expressed in, for display. */
export function baseUnitLabel(group: string): string {
  if (group === 'mass') return 'g';
  if (group === 'volume') return 'ml';
  if (group.startsWith('count:')) return group.slice('count:'.length);
  return group.slice('raw:'.length);
}

/**
 * Converts between two units of the same group. Returns null when they are not
 * comparable, which the caller must treat as "cannot pack this line".
 */
export function convert(quantity: number, from: string, to: string): number | null {
  if (unitGroup(from) !== unitGroup(to)) return null;
  const fromBase = toBaseQuantity(quantity, from);
  const toUnitBase = toBaseQuantity(1, to);
  if (fromBase === null || toUnitBase === null || toUnitBase === 0) return null;
  return fromBase / toUnitBase;
}
