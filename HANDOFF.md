# HouseGrocer — Status & Handoff

**Read `CLAUDE.md` first** for the product, stack and rules. This file covers
where things stand and who should do what next.

---

## State

Next.js 14 + TypeScript + Tailwind + Supabase, running at **http://localhost:3002**
(`npm run dev`). No deployed environment.

`npm run verify` (typecheck + lint + build, quiet unless it fails) is clean.

### Working end to end

- **Auth** — Supabase magic link; profile auto-created on first sign-in.
- **Collector needs a desktop browser** for the weekly Tesco session export
  (Cookie-Editor is a desktop extension). Everyone else is phone-only. The
  session modal says so below `md`.
- **Onboarding** — `create_house` / `join_house`, invite codes.
- **Recipes** — creation with one-ingredient-per-line parsing and a live preview.
- **Two weeks.** `/plan` and `/plan?week=next`, switched by a segmented control.
  This week locks when the shop goes in; next week is always editable. Only this
  week can be shopped — `getWeeklyPlan()` now means the *current* week by date,
  not the latest row. No migration; the schema already keyed plans by week.
- **Plan** — a vertical list of day cards, savings banner and nav cards above.
  The recipe browser lives on `/recipes` (search + chips + quick-add sheet),
  constraints on `/account`. A day card's "Add a meal" carries the day via
  `/recipes?day=wed` and returns you to the week. `FancyForm`, `PlanGrid`,
  `ConstraintTags`, `CookPicker`, `GuestPicker`, `CapacityPicker` and the old
  `RecipeCard` are all deleted — don't reinstate a dropdown picker. Picking a
  recipe a housemate already chose *for the same sitting* joins their meal
  rather than duplicating it; that overlap is the product, don't "fix" it. Meals
  carry `breakfast | lunch | dinner`, and the join, the overlap detector and the
  grid are all keyed on day + meal type.
- **Meal options** — cook, guests, capacity and "who's in" (with **Take off**
  for the meal's owner) all live in `MealOptionsSheet`, behind a `tune` icon on
  meals you have joined. They were three permanent controls per row and buried
  the week.
- **Demo data** — `/dev` → Reset demo data. Clears first, then seeds five people
  and a Mon–Sun week (3 days apart, 2 days one shared meal, 2 days two), plus a
  guest, a pantry, staples, a leftover and one off-shop purchase. It writes no
  prices, no basket lines and no savings; build the basket for those.
- **Optimiser** (`src/lib/optimiser.ts`) — scales to diner count, pools
  ingredients across meals, subtracts pantry, rounds to whole packs, attributes
  each line by participation. 17 numeric checks behind it.
- **Tesco pricing** — `search` is **unauthenticated**; ingredients resolve to real
  products with real prices, pack sizes and images, cached on `ingredients` with
  a 7-day TTL.
- **Slots** — delivery *and* Click & Collect, verified live (166 and 52 available).
  Optional house preference suggests a best match; the collector always selects.
  The fee becomes a split line divided equally, penny-exact.
- **Split** — computed from real allocations, arithmetic printed under each line.
- **Server actions** — basket, pantry, payment, reconciliation all persist.
- **Realtime** — live house-wide updates.

- **After the shop arrives** — the Plan tab swaps "What do you fancy?" for what
  you've got: mark a meal cooked / made-something-else / didn't-happen, bail out
  of one, and get leftover suggestions from the ingredients you're holding.
  Nothing there moves money, by design (`0013`).
- **Cook rota** — whoever adds a meal cooks it. Handing over is an *offer*
  (`cook_offer_to`, `0019`); the other person accepts or declines, and until
  they accept the original cook is still on it. `setCook` never checked the
  caller, so anyone could put anyone's name on any meal — don't reintroduce a
  direct assignment.
- **Shared staples** — a standing list of non-food in House Settings, added to
  the basket when due and split equally. The "split staples equally" toggle now
  actually writes (it never did before).
- **Weekends** — the grid and the Feed strip only show Sat/Sun once someone has
  planned something. The app never prompts for a weekend.
- **Meal capacity** — `max_diners` on a meal caps mouths (guests counted) and
  blocks further joins; null is open and is the default. Never retroactive
  (`0017`).
- **Guests** — `+1` on any meal while planning, host covers or the table splits.
  The optimiser weights heads rather than counting participants; four numeric
  checks cover it, including that a meal with no guests is byte-identical to
  before (`0014`).
- **One-off purchases** — "Log a purchase" on the Split tab. Equal or per-person
  amounts, which must add up. Lands on the same balances as the weekly split and
  is labelled as a one-off there, because "you owe Maya £14" means something
  different when it is a kettle.
- **Leftovers board** on the Pantry page, with a Feed nudge when something is
  about to go off. Carries no cost and never touches the split.

### The week, end to end

`/dev` (**Testing & Development**, flask icon next to the settings cog) runs a
whole week without a Tesco order: seed → build basket (real, on the Basket tab)
→ mark ordered → post the split → simulate a delivery → swap collector → mark
housemates as paid. Every step writes exactly the rows the real event writes.

**The split had no ending until now.** `getCurrentSplit()` only ever *computed*
shares and handed the UI an id of `${planId}:${userId}`, which is not a row — so
"I've Paid" updated nothing, `getLedger()` read an empty table, and Balances and
payment status were permanently blank. `postSplit()` writes real `splits` rows;
`getCurrentSplit()` prefers the posted row and falls back to a live preview.
Re-posting keeps a status when the amount is unchanged and resets it to pending
when it moves — paying £20 does not settle a £22 debt.

### Fixed, worth not undoing

- **`setCook` had no caller check.** Any housemate could set the cook on any
  meal, including one they weren't eating. Now an offer/accept flow (`0019`).
- **Avatar rings drew ovals.** A bare `<span>` is `display:inline`, so
  `rounded-full` on it follows a line-height box, not the child. Put the ring on
  `<Avatar className>` — it is square by construction.

- **Ingredient names were matched with `ilike('name', x)`** — case-insensitive
  but otherwise exact — at seven separate call sites. "Chicken breast" and
  "chicken breasts" were two rows, so the optimiser bought two packs and
  reported no saving, silently. One `findOrCreateIngredient()` now matches on
  `canonical_name` (`0018`). Do not reintroduce a bare name lookup.

- **£0.00 basket lines.** Twelve items priced as free because the recipe counted
  items and the pack was weighed. See "Pack data" in CLAUDE.md — the three
  states must stay distinguishable.
- **Loose produce** (onion, lettuce, avocado) never resolved at all; the title
  carries no size. Falls back to `1 whole`.
- **Product matching** now prefers keyword *order* and skips pet food: "Beef
  strips" was resolving to a dog treat because it hit both keywords and was
  cheapest.
- **Week start** was formatted via `toISOString()` from a local midnight, so
  east of Greenwich the whole week was stored and dated a day early.

### Not built

See `FEATURES.md` for the specification. Outstanding from it:

- **Receipt photos.** No storage bucket is configured, so an expense carries a
  text note instead ("receipt's in the drawer"). Adding uploads is an
  infrastructure decision, not a form field.
- **Cook-swap requests.** Assignment and the day-of reminder exist; the
  request → accept/decline negotiation does not, on purpose. Houses settle this
  by talking and would route around an approval queue.
- **Web push notifications.** No service worker, no manifest, nothing. The copy
  in `FEATURES.md` is the valuable part and can go into in-app banners first.
- **Live basket recalculation.** The basket only rebuilds when someone presses
  the button; the spec asks for it to follow plan changes.
- **`confirmed` meal status.** Deliberately skipped — confirming a meal you
  already added says nothing the participant row does not, and a state nobody
  sets is a state that rots.

- `bookSlot()` reserving with Tesco is **coded but never executed** — nobody has
  booked a real delivery. Everything else in the slot flow is verified.
- Recipe scraping from a URL.
- Anything beyond a dry-run checkout preview. `checkout()` stops at the payment
  URL by design; a human finishes 3-D Secure. **The app never touches card details.**

### Migrations

`0001`–`0019`, and **every file is now safe to re-run** — `0005`–`0007` used
bare `ADD COLUMN` and errored the second time, which is the first thing anyone
tries on a half-applied set.

The 17 files are *history*, not a setup procedure. A fresh environment should
get a single squashed schema; nobody replaying eight months of column additions
learns anything from it. Not written yet — see "What to start on next".

Run any not yet applied — currently **`0012`**–**`0019`** (plus
`0010`/`0011` if they were never run). All of them degrade legibly rather than
crashing: a missing table returns an empty list and the panel disappears, a
missing column returns a `42703` with a "run migration NNNN" hint attached.
`supabase/reset.sql` is a destructive dev-only clean slate.

---

## Repeatable checks

Four subagents live in `.claude/agents/`. Each is read-heavy with a small
conclusion — the only shape where a subagent earns its cost, since it keeps the
file contents out of the main context and returns just the finding.

| Agent | Model | Run it when |
| --- | --- | --- |
| `money-auditor` | sonnet | Basket, split, savings or reconciliation changed |
| `voice-check` | sonnet | New screens or new UI strings |
| `schema-drift` | haiku | A migration was added, or a column reads `undefined` |
| `dead-files` | haiku | After a refactor moved or replaced components |

`schema-drift` and `dead-files` are mechanical, so haiku is enough. The other
two need judgement against a rubric and would be noisy on haiku — a check that
cries wolf gets ignored, which is worse than not running it.

**Not worth a subagent:** running typecheck/lint/build (that is `npm run
verify`, a Bash call, not exploration), and anything touching the optimiser or
split arithmetic — that needs the whole design in context.

## What to start on next (bigger calls — worth doing with review)

1. **Ingredient autocomplete on the recipe form.** `canonicalName()` now stops
   plurals and case creating duplicate rows, and `/dev` → Duplicate ingredients
   merges the ones normalisation cannot catch (Lettuce / Cos lettuce). What is
   still missing is stopping them at the source: suggest existing ingredients as
   the line is typed. That, plus a unique index on `canonical_name` once the
   merge tool reports clean, closes this properly.
2. **Notifications.** No service worker or manifest exists yet. Worth doing
   only once someone is using the app daily; the copy in `FEATURES.md` is the
   valuable part and can be written into the in-app banners first.
3. **Book a real slot.** `chooseSlot()` saves the choice and calls `bookSlot()`.
   Listing and pricing are verified; reserving is not. Do it once, deliberately.
4. **Reconciliation against a real delivery.** The money rules are implemented
   (unreceived refunds, partial quantities, substitutions charged at the
   substitute's price) but have never met an actual Tesco order.
5. **Decide on per-house product choice.** `ingredients` is a global catalogue,
   so pack price and product are shared across houses. Fine while everyone wants
   cheapest; the moment two houses want different products for "milk" it needs a
   `house_ingredient_products` table. The trade-off is written into
   `0004_tesco_product_cache.sql`.
6. **Deploy.** Only after the weekly cycle works end to end — deploying earlier
   hides bugs behind "it's the network".

---

## Performance notes

Two real causes were found and fixed; neither was hosting.

- **Query waterfall.** `getCurrentUser()` bottoms out in `auth.getUser()`, a
  network round trip. Pages made ~10. Fixed with React `cache()`, dropping a
  redundant middleware `profiles` lookup, and fetching `ingredients` once per
  request instead of three times.
- **Supabase region.** Origin round trip went from ~210 ms to ~55 ms after moving
  region. Diagnose with `curl -w "ttfb=%{time_starttransfer}"`: low
  `time_appconnect` with high TTFB means the edge is near and the origin is far.

A genuinely sequential 7-hop chain remains in `getWeeklyPlan`. Collapsing hops
with PostgREST embedded selects (`profiles?select=*,houses(*)`) is the remaining
win, worth ~2 hops.
