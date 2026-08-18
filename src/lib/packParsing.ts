/**
 * Turning Tesco search results into pack figures.
 *
 * Pure and free of `server-only` so it can be unit-tested directly — the
 * network calls live in `tescoResolver.ts`.
 *
 * Adapted from the uk-grocery-cli fork's `tesco-sync` service (keyword
 * relevance, then cheapest) with one deliberate change: multipack titles like
 * "4 X 400G" expand to their true total, which the original regex missed.
 * Getting that wrong buys four times too much.
 */

import type { Pence } from './types';

export interface ResolvedProduct {
  tescoProductId: string;
  title: string;
  /** Pack price in integer pence. Tesco returns pounds as a float. */
  packPrice: Pence;
  /** Total quantity in one purchase, e.g. 1600 for "4 X 400G". */
  packSize: number;
  packUnit: string;
  originalPrice: Pence | null;
  imageUrl: string | null;
}

/**
 * Titles that match on keywords but are not food for people.
 *
 * "Beef strips" resolved to *Tesco Tasty Treats Meaty Strips – Rich in Beef*,
 * a dog treat, because it hit both keywords and was cheap. Cheapest-first
 * matching needs a floor somewhere, and "not pet food" is the least
 * controversial one available.
 */
const NOT_FOR_PEOPLE =
  /\b(dog|dogs|cat|cats|puppy|kitten|pet|pets|hamster|rabbit)\b|\bdental stick|\bchews\b/i;

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'with', 'in', 'for', 'to', 'at', 'some', 'fresh']);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,\-]+/)
    .map((word) => word.replace(/[^a-z]/g, ''))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/**
 * Crude stem so plurals match singular product names.
 *
 * "Beef patties" never matched "Beef Patty", and "burger buns" missed "Burger
 * Bun", so both scored on one keyword and lost to whatever was cheapest. Four
 * characters is enough to keep "beef" and "bean" apart while letting
 * patties/patty and onions/onion meet.
 */
function stem(word: string): string {
  return word.length > 4 ? word.slice(0, 4) : word;
}

/** "4 X 400G" → 1600 g. Multipacks first, since they contain a plain size too. */
const MULTIPACK_RE = /(\d+)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|litre|liter)\b/i;
const SINGLE_RE = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|litre|liter)\b/i;
/**
 * "6 Pack", "4pk", "Eggs x6" — a count of individual items.
 *
 * `\b(s)\b` was in the original alternation and matches a bare "s", so titles
 * like "Tesco Eggs 6s" work — but it also makes the pattern fire on plurals.
 * Anchoring on pack/pk/x keeps it to real pack counts.
 */
const COUNT_RE = /(?:(\d+)\s*(?:pack|pk)\b|[x×]\s*(\d+)\b)/i;

const TO_BASE: Record<string, { unit: string; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  litre: { unit: 'ml', factor: 1000 },
  liter: { unit: 'ml', factor: 1000 },
};

/** Extracts total pack quantity from a product title. Null when unreadable. */
export function parsePackFromTitle(title: string): { size: number; unit: string } | null {
  const multi = title.match(MULTIPACK_RE);
  if (multi) {
    const spec = TO_BASE[multi[3].toLowerCase()];
    if (spec) {
      return { size: Number(multi[1]) * Number(multi[2]) * spec.factor, unit: spec.unit };
    }
  }

  const single = title.match(SINGLE_RE);
  if (single) {
    const spec = TO_BASE[single[2].toLowerCase()];
    if (spec) return { size: Number(single[1]) * spec.factor, unit: spec.unit };
  }

  // A "6 Pack" is six individual things, so record it as 6 `whole` rather than
  // 1 `pack`. Recipes ask for "2 onions", never "0.33 packs" — expressing the
  // pack in the same countable unit as the demand is what lets it be priced.
  const count = title.match(COUNT_RE);
  if (count) {
    const size = Number(count[1] ?? count[2]);
    if (Number.isFinite(size) && size > 0) return { size, unit: 'whole' };
  }

  return null;
}

function priceInPence(product: { price?: { actual?: number | string } }): Pence | null {
  const raw = product.price?.actual;
  const pounds = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(pounds) || pounds <= 0) return null;
  return Math.round(pounds * 100);
}

/**
 * Picks the best product for an ingredient: prefer titles matching the
 * ingredient's keywords, then take the cheapest whose pack size we can read.
 *
 * Cheapest-first is deliberate — this is a student budget app, and the fork's
 * own sync service made the same call.
 */
export function pickBestProduct(
  products: { id?: string; title?: string; price?: { actual?: number | string }; defaultImageUrl?: string }[],
  ingredientName: string
): ResolvedProduct | null {
  const words = keywords(ingredientName);

  const scored = products
    .map((product) => {
      const title = product.title ?? '';
      const price = priceInPence(product);
      if (!product.id || !title || price === null) return null;
      if (NOT_FOR_PEOPLE.test(title)) return null;

      // A title with no readable size is not a dead end. Loose produce — "Tesco
      // Onions Loose", "Tesco Ripe & Ready Avocado" — is sold by the item, and
      // one purchase is one of the thing. Treating that as `1 whole` is what
      // lets a recipe asking for "1 onion" be priced at all; before this those
      // ingredients silently fell out of the basket with no price.
      const parsed = parsePackFromTitle(title);
      const pack = parsed ?? { size: 1, unit: 'whole' };

      const lower = title.toLowerCase();
      const hits = words.filter((word) => lower.includes(stem(word))).length;

      // Word order carries real meaning. "Beef strips" should find *Beef Stir
      // Fry Strips*, not *Tasty Treats Meaty Strips - Rich In Beef*, which hits
      // the same two keywords backwards and was winning on price alone.
      let cursor = -1;
      const inOrder = words.every((word) => {
        const at = lower.indexOf(stem(word), cursor + 1);
        if (at === -1) return false;
        cursor = at;
        return true;
      });

      return { product, title, price, pack, hits, inOrder, parsed: parsed !== null };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (scored.length === 0) return null;

  const bestHits = Math.max(...scored.map((entry) => entry.hits));
  // Only fall back to ignoring relevance when nothing matched at all.
  const byRelevance = bestHits > 0 ? scored.filter((entry) => entry.hits === bestHits) : scored;

  // Among equally relevant products, prefer one that reads the ingredient's
  // words in the ingredient's order, then one whose pack we could actually
  // read — a stated size beats an assumed single item every time.
  const ordered = byRelevance.filter((entry) => entry.inOrder);
  const byOrder = ordered.length > 0 ? ordered : byRelevance;

  const withPack = byOrder.filter((entry) => entry.parsed);
  const relevant = withPack.length > 0 ? withPack : byOrder;

  relevant.sort((a, b) => a.price - b.price);
  const winner = relevant[0];
  const mostExpensive = relevant[relevant.length - 1];
  const originalPrice = mostExpensive.price > winner.price ? mostExpensive.price : null;

  return {
    tescoProductId: String(winner.product.id),
    title: winner.title,
    packPrice: winner.price,
    packSize: winner.pack.size,
    packUnit: winner.pack.unit,
    originalPrice,
    imageUrl: winner.product.defaultImageUrl || null,
  };
}

