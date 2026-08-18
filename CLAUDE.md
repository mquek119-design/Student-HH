# HouseGrocer

## What This Is

A web app for UK university shared houses to plan meals together, build one optimised weekly shop, add it to Tesco's online basket, and split costs per item — not equally.

The core insight: the buying unit is the household (3–5 students), not the individual. One combined order clears Tesco's £25 click-and-collect / £50 delivery minimum that a solo student can't hit. The ingredient-overlap optimiser cuts waste and cost by reusing ingredients across multiple meals.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS
- **Database**: Supabase (Postgres + Auth + Realtime) — live, migrations `0001`–`0017`
- **Deployment**: Vercel
- **Tesco integration**: `lib/tesco/` — a vendored private fork of uk-grocery-cli

## Current State

Working end to end on localhost: auth, onboarding, the two-week plan, the
overlap optimiser against live Tesco prices, slot selection, the posted split,
reconciliation, staples, guests, leftovers and one-off purchases. `npm run
verify` is clean. There is no deployed environment.

**Genuinely outstanding**, and none of it is a UI job:

- **`bookSlot()` has never been executed.** Listing and pricing slots is
  verified against the live API; reserving one is coded and untried.
- **Reconciliation has never met a real delivery.** The money rules are
  implemented and exercised by `/dev` → Simulate delivery, but no Tesco van has
  ever tested them.
- **Ingredient names still need autocomplete at entry.** `canonicalName()`
  (`src/lib/ingredients.ts`) now folds case, leading qualifiers and plurals, so
  "chicken breasts" reuses the "Chicken breast" row. What it cannot catch is a
  difference in the middle — "Lettuce" vs "Cos lettuce" — which is what the
  merge tool on `/dev` is for. Suggesting existing names as a recipe is typed
  would stop those being created at all.
- **A new house starts empty**, so every screen is an empty state until someone
  writes a recipe. The weakest ten minutes in the product.
- **No push notifications.** No service worker, no manifest. `FEATURES.md` has
  the copy; the delivery mechanism does not exist.

### No figure is ever invented. This is the rule the product rests on.

`mockData.ts` has been **deleted**. Every screen reads real rows or renders an empty state — nothing invents a number, and a house with no data looks empty rather than pretending otherwise. In a money app the fabricated figures were the dangerous kind: an invented savings benchmark and a split whose "workings" didn't compute from anything.

Without `.env.local`, `layout.tsx` renders `<SetupRequired>` instead of the app. That is a legible setup screen, not a crash. **Do not reintroduce fixtures to make screens look populated.**

Everything derived is derived for real:
- `getCurrentSplit()` sums the caller's actual share of each basket line via `allocateLine()`; the workings printed on the Split page are that arithmetic, item by item
- `getSavings()` counts only own-brand deltas (`original_unit_price − unit_price`), because that is the one saving we can evidence. There is **no** bulk/pantry breakdown and **no** comparison against other households — we have no data on other houses
- Overlap suggestions are computed in `overlaps.ts`, not stored
- `PayPanel` shows the collector's own payment fields (bank, sort code, account number, link, note), each a copyable row, or says they haven't set any
- A basket line with `unit_price === 0` renders as "No price" and is excluded from the total. Nothing in a supermarket is free, so a zero means "could not be priced" — see "Pack data" below

## Connecting Supabase

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_initial_schema.sql` then `0002_rls.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
4. Set the Site URL and add `http://localhost:3002/auth/callback` to Redirect URLs (Authentication → URL Configuration), or magic links will bounce.
5. Optional: create four users, paste their UUIDs into the top of `supabase/seed.sql`, and run it to get the demo house.
6. **Regenerate the types** — do not hand-edit them:
   ```
   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
   ```

### Demo data and the week runner

**`/dev` — Testing & Development**, reached by the flask icon beside the settings
cog. Its own page rather than a panel in House Settings: settings is a screen
four housemates share, this is a workbench for one person, and half of what is
on it deletes the house.

It walks a whole week without a Tesco order — seed, build the basket (for real,
on the Basket tab), mark ordered, post the split, take a delivery, swap
collector, mark housemates as paid. Every step writes exactly the rows the real
event writes: no Tesco call, no invented price, no money moved.

`/dev` has **Reset demo data** and **Clear everything** (`src/app/settings/seedActions.ts`, contents in `src/lib/demoData.ts`). Reset always clears first — layering a second demo week on an existing one was how the previous seeder produced two plans for the same week and meals nobody could account for.

The seeded week is shaped to exercise the product: **Mon–Wed** nobody eats together (Wednesday's stir fry and green curry share no ingredient at all, which is what fires the shared-shopping suggestion); **Thu–Fri** one shared meal each; **Sat–Sun** two shared meals each, at different sittings. Four demo housemates plus whoever seeds it makes five.

**The seed writes no money.** No basket lines, no prices, no `cost_per_portion`, no `shared_savings`. Those come from the optimiser over real Tesco data — a hand-typed price would sit in the same column the split reads from and be indistinguishable from a real one. Seed, then press Build Basket.

Clearing keeps the global `ingredients` table: it caches the resolved Tesco product, price and image per ingredient, and dropping it discards dozens of live lookups to save nothing.

### Seeing it as somebody else, and why that needs SQL

`/dev` → **View as** renders the whole app as a demo housemate. That covers
reads and most writes for free, but not all of them: impersonation changes who
the *app* thinks you are while `auth.uid()` is still you, and RLS reads
`auth.uid()`. Two policies refused every time — `splits_update`
(`from_user_id = auth.uid() or to_user_id = auth.uid()`) and `profiles_update`
(`id = auth.uid()`) — which meant the settle-up flow, the exact thing the demo
housemates exist to test, could not be walked through.

`0020_demo_write_functions.sql` fixes that with `SECURITY DEFINER` functions
that check in SQL what RLS checks with `auth.uid()`: caller and target share a
house, **and the target is `is_demo`**. That second condition is the safety
property — a real housemate's split or profile is never reachable through them,
whatever is passed in, so tampering with the cookie gets you nowhere.

Each returns a row count, so zero is reported rather than passing for success.
`src/app/split/actions.ts` and `src/app/account/actions.ts` call the RPC when
`readViewAsId()` is non-null and the ordinary update otherwise — nothing changes
for a real user.

**The old advice was a second Gmail account via a `you+maya@gmail.com` alias.
It is gone.** Not everyone has spare addresses, and a feature that only works
if you do is not finished.

Payment details and dietary preferences are **two functions, not one**, because
a single one cannot decide what a null argument means: clearing your bank
details is a real edit so nulls must be written through, but then saving dietary
preferences would have to pass five nulls and would wipe them.

### Deleting a house

`0002_rls.sql` grants select, insert and update on `houses` and **no delete**,
so with RLS on nobody could remove one. That is why the last member of a house
used to hit a flat refusal when deleting their account: there was no way out to
offer them.

`delete_house()` (also 0020) is that way out, and it lives **inside
delete-account only** — a standalone Delete House button on a screen four people
share needs more thought than this. The money guard still comes first and is
unchanged: unsettled splits or expense shares refuse outright, because
`splits.from_user_id` and `expense_shares.user_id` both cascade, and a delete
button that quietly writes off what you owe is not a feature.

Demo housemates do not count towards "is anyone else here" — they cannot sign
in, so leaving them the house orphans it just the same. `delete_house` removes
them outright rather than detaching them, since a demo profile with a null
`house_id` is litter nothing can ever reference.

### Why the migration can appear to do nothing

The SQL editor runs a whole file in **one transaction**, so any single failing statement silently discards all 38 — you get zero tables and no obvious error unless you scroll.

The known offender is `create trigger … on auth.users`. Managed Supabase projects give `auth.users` to `supabase_auth_admin`, so the editor's `postgres` role is refused with *"must be owner of relation users"*. `0001` now wraps that trigger in a `DO` block that catches the error and carries on; profiles are instead created by `getCurrentUserOrNull()` on first sign-in, so the trigger is optional.

If a re-run fails with "already exists", an earlier attempt landed partially — run `supabase/reset.sql` first (destructive, dev only).

Verify from the shell without a password:
```
curl -s "$URL/rest/v1/houses?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
`PGRST205 … not found in the schema cache` means the table is missing (or, rarely, the cache is stale — `NOTIFY pgrst, 'reload schema';` rules that out).

### API key naming

Newer projects issue `sb_publishable_…` instead of an `anon` JWT. `supabase/config.ts` accepts either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are browser-safe. Never put a `sb_secret_…` / `service_role` key in a `NEXT_PUBLIC_` var — those bypass RLS.

### Two traps in `database.types.ts`

Both make supabase-js silently type every query result as `never[]`, with no error pointing at the cause. If you must hand-edit:

- **Row types must be `type X = {…}`, never `interface X {…}`.** supabase-js constrains rows to `Record<string, unknown>`; TypeScript grants type aliases an implicit index signature but withholds one from interfaces. Cost an hour of debugging.
- **Empty groups must be `{ [_ in never]: never }`, never `Record<string, never>`.** The latter has a string index signature, so the select-query parser finds every table name in `Views` and resolves it to `never`.

Also keep `@supabase/ssr` ≥ 0.12 — 0.5.x passes generics to `SupabaseClient` in an order `supabase-js` ≥ 2.111 no longer uses, with the same `never` symptom.

## The seams worth knowing

A file tree lived here and was wrong twice within a month — run `ls`, it is
cheaper and it is never out of date. What a listing will *not* tell you:

- **`src/lib/queries.ts`** — the only place the UI touches the database. Every
  read goes through it and every export is wrapped in React `cache()`; removing
  those wrappers restores a ~10-round-trip waterfall per page.
- **`src/lib/optimiser.ts`, `money.ts`, `units.ts`, `packParsing.ts`** — the
  money and pack arithmetic, each with numeric checks behind it. Change nothing
  here without re-running them.
- **`src/lib/weeks.ts`** — the single definition of where a week starts. Three
  copies of this existed before it and one still had a `toISOString()` bug that
  dated the whole week a day early.
- **`lib/tesco/`** — vendored fork, not ours. See "Tesco Integration".
- **`mockups/housegrocer/DESIGN.md`** — the design token spec the Tailwind
  config is ported from.

### Do not read these unless you need a specific named file

- **`mockups/**`** — 2.9MB, including 364KB of `code.html` across 19 folders.
- **`lib/tesco/**`** — 276KB of vendored code.
- `node_modules/`, `.next/`, `.next-dev/`, `.playwright-mcp/`.

Globbing either of the first two into context wastes most of a session's budget
and tells you nothing the docs do not.

### Editing: reach for `Edit` first

For fewer than about five changes, `Edit` calls are cheaper than writing a
script to make them — a 100-line Python file that performs three substitutions
costs more than the three substitutions. Scripts earn their place only on
repetitive mechanical passes across many files.

## Navigation — Four Tabs

Decided deliberately; the mockups were inconsistent (some showed six tabs, some four). Everything remains reachable:

| Tab | What lives here |
|---|---|
| **Feed** | Home, countdown, payment status, nudge |
| **Plan** | One scrollable page: the week as day cards, the recipe browser inline below it, constraints at the bottom |
| **Basket** | Basket review, own-brand toggle, proceed to checkout |
| **Split** | This week's split, delivery reconciliation, balances/ledger |

`src/components/nav/tabs.ts` maps route prefixes to tabs via an `owns` array, so `/recipes/r-tacos` keeps **Plan** highlighted. Add new routes to an existing tab's `owns` list rather than adding a fifth tab.

Onboarding renders without chrome — `AppChrome` checks the pathname and drops the bars under `/onboarding`.

## Design Reference

`mockups/` holds **20 per-screen folders**, each with `code.html` (a complete standalone Tailwind mockup) and `screen.png`. The HTML is the useful artifact — it is real markup, and **9 of the 20 PNGs are broken 28-byte placeholders** (`<FIFE Image failed to fetch>`): house_feed, house_pantry, my_account, order_reconciliation_1, order_reconciliation_2, recipe_detail, recipes_hub_1, savings_history, the_basket.

`order_reconciliation_1` has **no `code.html` and a broken PNG** — there is no usable reference for it. The reconciliation screen was built from `order_reconciliation_2` plus the requirements below.

### Visual identity — from `mockups/housegrocer/DESIGN.md`

The tokens in DESIGN.md are the source of truth and are ported verbatim into `tailwind.config.ts`. An earlier draft of this file quoted a different palette (`#00703C` green, `#F27D21` orange); **that was wrong** — use the tokens.

- **Primary green**: `#006b3f` (`primary`), `#008751` (`primary-container`)
- **Accent orange**: `#994700` (`secondary`), `#fb7800` (`secondary-container`)
- **Body background**: `#F0F9F4` — the `surface-0` token, applied as `bg-surface-0` on `<body>` in `layout.tsx`. It must be a utility on the element, not a rule in `globals.css`: any `bg-*` class on `<body>` beats an `@layer base` declaration, which silently left the app on `#f9f9fc` for a while. The `background` token is a separate, paler colour — don't reach for it on `<body>`.
- **Cards**: `surface-container-lowest` white, 1px `surface-container-highest` border, `shadow-ambient-card`
- **Type**: **Plus Jakarta Sans** for text, **JetBrains Mono** (`font-numeric-data`, `font-label-caps`) for all money, quantities, dates and timers — columns of numbers must align
- **Mobile-first**: 375px viewport. The mockups are also fully responsive with `md:` breakpoints and a desktop top-nav — that is built, not a stretch goal.

**borderRadius caveat**: DESIGN.md's `rounded` frontmatter block and the scale the mockups actually rendered with disagree. `tailwind.config.ts` follows the mockups (`DEFAULT` 0.25rem / `lg` 0.5rem / `xl` 0.75rem), because the ported markup assumes `rounded-xl` on a card means 12px.

### Imagery

The mockups referenced `lh3.googleusercontent.com/aida-public/…` URLs which are temporary and will 404. **Do not reintroduce them.** Instead:

- Housemates → `<Avatar>` renders coloured initials from the DESIGN.md palette
- Food/products → `<FoodImage>` renders a deterministic tinted tile, and passes through a real `src` when one exists

## Local Development & Testing

Everything is tested on localhost. There is no deployed environment yet.

```bash
npm run dev        # http://localhost:3002
npm run verify     # typecheck + lint + build, quiet unless something fails
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

`npm run verify` is the one to use before saying anything is done. It is the
three checks in order with the route table suppressed, so a pass is two lines
rather than thirty.

### Browser testing via Playwright MCP

`.mcp.json` registers [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) as a project-scoped server, so Claude Code can drive a real browser against localhost and verify screens itself rather than asserting on raw HTML.

Configured as: headless, isolated profile (nothing persists between runs), Chromium, **375x812 viewport** to match the mobile-first target. Use `browser_resize` to check the `md:` breakpoints — the desktop layout is real and worth checking at ~1280 wide.

Screenshots and traces land in `.playwright-mcp/` (gitignored).

Start the dev server **before** driving the browser — the MCP server will not start it for you.

## Tesco Integration

`lib/tesco/` is a vendored private fork of uk-grocery-cli. Product search is
**unauthenticated** and works without a session; only add-to-basket and checkout
need the collector's cookies.

- **Do not modify anything in `lib/tesco/`.** Treat it as a vendored dependency.
- **Do not call the CLI from the web app.** Wrap the provider's TypeScript functions in API routes / server actions.
- Custom fork modifications to preserve: reliable add-to-basket without bot detection, single-tab browsing, default best-match product selection.
- **Auth caveat**: Akamai bot detection blocks automated login. Reliable path is manual browser login → Cookie Editor export → `import-session`. The collector authenticates manually once a week.
- **The collector needs a desktop browser; nobody else does.** Exporting a Tesco session requires logging in and running the Cookie-Editor extension, which mobile browsers cannot do. So the app is mobile-first for four housemates and desktop-required for one, once a week, for one step. `TescoSessionModal` says so on narrow screens (a `md:hidden` block — not user-agent sniffing). Do not design the session/checkout flow as though a phone can complete it.
- **Checkout is safe**: `checkout()` stops at the payment URL. A human finishes 3-D Secure. The app never touches card details.
- `next.config.js` already marks `playwright`/`playwright-core` as server-external so they never reach the client or edge bundle.

## Core Data Model

See `src/lib/types.ts` — it is the authoritative version and matches this:

```
House · User · Ingredient · Recipe · RecipeIngredient
WeeklyPlan · PlannedMeal · MealParticipant · PlanConflict
BasketItem (with Allocation[]) · Split (with SplitLine[]) · LedgerEntry
PantryItem · Substitution · ReconciliationItem
```

`PlannedMeal.mealType` is `breakfast | lunch | dinner`, and it is load-bearing rather than a label. Joining an existing meal matches on day **and** meal type, conflicts are detected per *sitting*, and `PlanGrid` renders a day as one block per sitting. Grouped by day alone, someone's porridge and someone else's curry on the same Tuesday read as a clash they could resolve by converging — and "join their meal" could sit you down to a breakfast you thought was dinner.

**There is no "conflict" concept, and reintroducing one would be a regression.** An earlier version detected days where housemates picked disjoint recipes and rendered them in error red as *"Conflict Detected — incompatible choices — tap to resolve"*. That framing was wrong on the product's own terms: nobody is obliged to eat what a housemate fancies, and the "resolve" link did nothing but scroll to the form.

`PlanOverlap` (`src/lib/overlaps.ts`) replaces it. Same detection, opposite conclusion: two people cooking different meals can still cook *from the same shopping*, because one bigger pack is cheaper per gram than two small ones. So it answers with recipes — "Chicken Tikka Masala shares chicken, coconut milk and rice with the green curry already planned" — and **stays silent unless it has a concrete alternative to offer**. A warning with no alternative is just a complaint about what somebody chose to eat. It never blocks a choice and never uses error styling.

## The split has to be posted

`getCurrentSplit()` *derives* everyone's share from basket allocations. That is
a preview, not a debt: for a long time it also handed the UI an id of
`${planId}:${userId}`, which is not a row, so "I've Paid" updated nothing and
`getLedger()` — which reads the `splits` table — was permanently empty. Balances
and payment status could never work.

`postSplit()` (`src/app/split/postActions.ts`) writes the real rows, one per
housemate who owes the collector, and the collector triggers it from the Split
tab. `getCurrentSplit()` prefers the posted row's id, amount and status, falling
back to the live preview when there is none — which is exactly right, because
before the order goes in nobody owes anything, they merely will.

Re-posting after reconciliation **keeps a status when the amount is unchanged
and resets it to pending when it moves**. Somebody who paid £20 has not paid £22.

## Weekly Cycle

1. **Sunday**: Housemates open "What do you fancy?" and submit recipes / constraints / opt-outs
2. **Cutoff** (Sunday 17:00 by default): Planning locks; the optimiser builds the basket
3. **Basket review**: Collector reviews, swaps to own-brand, adjusts quantities
4. **Order placed**: Collector places the Tesco order from their account
5. **Delivery**: Reconciliation page shows substitutions and refunds
6. **Settlement**: Per-item split posted; housemates pay the collector directly; collector confirms

## Key Design Decisions

- **No custody of funds.** The app never holds money — it calculates and displays. Settlement happens by bank transfer / Revolut. Keeps us outside FCA regulation.
- **"I've Paid" is social, not verified.** Display who's outstanding prominently; social pressure is the enforcement mechanism.
- **One person's Tesco account.** The collector rotates weekly. The Basket checkout button is disabled for everyone except the collector. The collector does their week on a laptop — see the desktop caveat under Tesco Integration — while everyone else plans, pays and reconciles from a phone.
- **Substitution reconciliation is mandatory.** The receipt never matches the plan. `src/components/split/Reconciliation.tsx` implements the money rules: unreceived items refund fully; partial deliveries charge received quantity only; accepted substitutions charge the substitute's price (which may exceed the ordered price); rejected substitutions charge nothing.
- **All money in integer pence.** `splitPence()` in `money.ts` distributes remainder pence to the largest fractional shares, so a 3-way split of 100p is 34/33/33 and never loses a penny.
- **Show the arithmetic.** The Split page prints the workings under every line. An opaque split is the fastest way to lose trust in a shared house.

### Every split line says how it got there

`shareWorking()` in `queries.ts` renders one of three cases, and they must stay
distinguishable:

```
Basmati Rice            (£1.45 ÷ 5)          £0.29
Chicken Breast Fillets  (£6.95 × 20%)        £1.39
Beef Stir Fry Strips    (£6.40 — all yours)  £6.40
```

It used to print `(yours)` for **every** allocated line, so a fifth of a chicken
pack and a whole pack you alone were paying for looked identical — there was no
way to tell whether £6.40 meant "all of it" or "your bit of something bigger".
Allocations are relative weights, so the fraction is your weight over the total;
sum repeated `userId`s rather than taking the first, because `allocateLine`
adds them up and a `find` would print 33.3% beside a £6.00 figure.

The percentage is a *label* on exact arithmetic — the pence come from
`splitPence` — so a third showing as 33.3% three times still adds up.

**The Total under the breakdown is the sum of the lines, not `split.amount`.**
Those agree right up until the basket moves after the split was posted, and then
the row was printing a total the lines above it visibly did not reach. The
agreed figure keeps the headline (it is what you owe); the disagreement is
stated plainly with an offer to re-post, rather than shown as two numbers that
do not match.

### Past days close for planning and stay open for recording

`isDayPast()` in `weeks.ts` — today is **not** past, because deciding at 6pm
what to cook at 8pm is the ordinary case. It takes the plan's own week start
rather than a `'this' | 'next'`, so a plan left open from a fortnight ago
answers correctly too.

A gone day drops "Add a meal" and the Join/Leave toggle, greys its header and
reads `GONE` — but **keeps the options sheet**, because whether a meal got
cooked is recorded after the night, usually the next morning. Guarded in
`addMealToPlan` and `joinMeal` as well as the UI: a stale tab still posts.
Leaving is deliberately not guarded.

## Coding Conventions

- Server components by default; `'use client'` only where interactivity requires it
- Tesco calls go through server actions or API routes — never expose session/auth to the client
- All monetary values in pence (integers), displayed via `formatPence()`
- Component files PascalCase; utility files camelCase
- Keep pages thin — data fetching in the page, logic in `lib/`, interactivity in components
- Reach for the tokens (`text-on-surface-variant`, `bg-primary-container`) over raw hex

## A house holds two weeks

**This week** is what the house is eating. Once the shop is placed it stops
being a plan and becomes a record — the food is bought, the split is settled,
and `/plan` shows what you have rather than asking what you want.

**Next week** (`/plan?week=next`) is still a decision and stays editable
whatever this week is doing. You should be able to think about Thursday while
this week is still in the fridge.

`src/lib/weeks.ts` owns the arithmetic and is the only place that defines where
a week starts. Three copies of `currentWeekStart()` existed before it and one of
them still had the `toISOString()` bug that dated the whole week a day early.

**`getWeeklyPlan()` means the current week, by date.** It used to mean "the most
recent plan row", which was fine while a house could hold one week and wrong the
instant it could hold two: the moment a next-week plan existed, the Basket, the
Split and the Feed would all have silently followed it and started costing a
shop nobody had ordered. Callers that want a specific week use
`getWeeklyPlanFor(weekStart)`.

**Only this week can be shopped.** `buildBasket` goes through `getWeeklyPlan()`,
so it can only ever cost the week being eaten. The next-week view says so rather
than offering a Build button that would do the wrong thing.

Meal-scoped actions (join, leave, cook, guests, capacity) resolve their plan
through `getMealContext(mealId)` rather than assuming the current week — before
that, joining anything on next week's plan would have been rejected as "not in
this week".

## Plan is the week; Recipes is the book

They were briefly the same page. The result was a tab called Plan that was about
70% recipe browser, and two differently-designed browsers over one dataset.
Three jobs with three different lifespans — a week changes daily, a recipe book
monthly, dietary constraints roughly once — do not belong in one scroll.

- **`/plan`** — reads top to bottom: shared-savings banner, two nav cards
  (Recipe hub, Import a recipe), then the week as a **vertical list of day
  cards**, Mon–Fri, weekends only once someone plans one. Overlap suggestions
  sit at the bottom.

  Each day card is a header (day, date, TODAY chip, and a `SHARED: …` badge when
  the whole table is on one meal) over a divided list of meal rows. A meal row
  is picture, sitting, **full recipe title**, diner avatars with a head count,
  who is cooking, and one Join/Leave button.

  It was a horizontally scrolling strip of 256px columns for one iteration.
  Three things were wrong with that and none of them were cosmetic: titles
  truncated to "Chicken Tikka…", a vertically scrolling page contained a
  horizontally scrolling strip, and a phone showed two days at a time — so the
  one thing a week view owes you, the whole week, was the thing it could not
  give. Do not put it back.
- **`/recipes`** — search, filter chips (Quick / Budget / Pantry match /
  Veggie), a grid of cards with pictures, cook time and cost per portion, and
  the quick-add bottom sheet. Reached from Plan rather than owning a fifth tab:
  it is a library you visit, not a stage of the week you check.
- **`/account`** — dietary constraints. A personal setting, set once.

The round trip is what makes this work: a day card's **Add a meal** goes to
`/recipes?day=wed`, which pre-selects Wednesday in the sheet and returns you to
the week once the meal lands. Browsing with no day is ordinary browsing and
stays put.

Things removed on purpose, which should not come back:

- **A `<select>` of recipe titles** as the only way to plan. It is what made the
  book feel like a lookup table owned by the plan, and it showed neither cost
  nor cook time at the moment of choosing.
- **"Group 1 / Group 2" labelling.** Two meals on one night are two meals, not
  numbered factions.
- **Fixed sections on `/recipes`** (Pantry Match / Favourites / 20 Minutes /
  All). A popular recipe appeared three times and you could not ask for "quick
  AND veggie". Chips do strictly more with less screen.

**A meal can say how many it feeds.** `planned_meals.max_diners` is null by
default — open to anyone, which stays the common case. Set to a number, it
counts *mouths* (guests included) and refuses the next join with a message that
points at the alternative: add your own meal for the same night. Anyone already
eating can set it, the same rule as the cook picker.

It is **never retroactive**. Lowering the cap below the people already in only
stops the next person; it never removes anybody. Kicking a housemate off a meal
they had planned around is not something a stepper should do by accident, and
after the order it would move their money as well.

**Joining is always a tap and never automatic.** If Alex is doing a curry you
may join it or add your own separate meal for the same night — the day card
stacks both, each with its own cook and diners.

## UI primitives — use these, do not retype the classes

`src/components/ui/` holds the shared vocabulary. Check here before writing a
button or a coloured advisory panel. These exist because the same twelve
Tailwind classes were being retyped at roughly thirty call sites, so heights
drifted between 36/40/44/48px on a single screen and most buttons had no focus
ring at all. None of that was a decision.

- **`Button` / `ButtonLink`** — variants `primary | secondary | outline | ghost |
  danger`, sizes `sm | md | lg`, plus `icon`, `iconRight`, `pending`,
  `pendingLabel`, `fullWidth`. Pill by default; `fullWidth` switches to
  `rounded-lg`, because a full-width pill reads as a pill-shaped page. Every
  variant carries the same focus ring, offset against the page background.
  `pending` is a prop rather than a hook, so it works from `useFormStatus`
  inside a form and `useTransition` outside one.
- **`Notice`** — tones `info | suggest | check | good | danger`. **The tone is
  the message**: `suggest` is an offer you may ignore, `check` is something to
  look at before it costs money, `danger` is reserved for destructive actions.
  A plan that differs from a housemate's is never `danger`.
- **`Chip`** — tap-to-toggle pill for filters, tags and pickers. Selected is a
  pale green fill with a green outline rather than a solid block: solid reads as
  "press me", the filled outline reads as "this is on". The icon becomes a tick
  when active, so the state survives being seen in greyscale.
- **`SubmitButton` / `IconSubmitButton` / `useSubmitState`**
  (`src/components/ui/SubmitButton.tsx`) — the same button, wired to
  `useFormStatus`. **Reach for these instead of `<Button type="submit">`.**
  `useFormStatus` only reports for the form the calling component sits
  *inside*, so a page cannot pass `pending` down to its buttons — that is why
  roughly thirty raw submits across the app spun at nothing, and why nine of
  them swapped in a `progress_activity` icon with no `animate-spin`, showing a
  frozen spinner. Where a form has several submits, pass `name` and `value`:
  `useFormStatus` goes true for all of them, and the FormData in `data` is what
  distinguishes the one actually pressed, so it spins and the rest merely
  disable. Use `useSubmitState` for controls the `Button` variants do not
  cover — round steppers, selectable pills, a chip with an avatar in it.
  `ButtonLink` cannot know it is loading; navigation is left alone.
- **`Card`, `Badge`, `EmptyState`, `PageShell`, `PageHeader`, `SubTabs`** as before.

## Designing new screens

The UI is built by hand, not generated. `mockups/STITCH-PROMPT.md` remains as a
written specification of every screen — palette, type, shape and a
screen-by-screen description — which is useful for briefing a designer or
checking a screen still matches its intent. Its "what to ignore" list is the
part worth keeping in mind whatever tool is used: generated UI reliably invents
prices and savings badges, and a plausible-looking fake figure is the single
most damaging thing that can be pasted into this app.

## The voice

Dry, plain, British, faintly deadpan. Students, not a wellness brand. "You're
all just going to wing it again aren't you" and "Your cupboard is giving
nothing / Probably accurate" are the register; "Let's get planning! 🎉" is not.
Never cute, never corporate, never an exclamation mark.

**The exception, and it is absolute: money copy stays flat.** Anything next to a
price, a split, a balance or a payment is written plainly and precisely. A joke
beside a figure somebody has to pay makes the figure look like a joke too, and
the whole product rests on those figures being believed.

## A Rule Worth Keeping

When a figure cannot be derived, show an empty state saying so — never a placeholder that looks like data. The whole product rests on housemates trusting the split; one invented number seen through costs more than a blank panel ever will.

## The week has two halves

`FEATURES.md` holds the household-coordination spec. The one structural idea in
it: **the Tesco order is the boundary.** Before it, everything is free to change
and nothing is bought. After it, every cost is settled and the app stops asking
what you want to eat — it shows what you have.

`weekly_plans.status` is that boundary (`planning` → `ordered` → `delivered`).
The Plan tab renders `FancyForm` before and `KitchenPanel` after.

**Never name the two halves in the UI.** No "Planning Mode" heading, no mode
switch, no tooltip. Housemates should experience one screen that changes with
the week. The terms belong in code comments and docs only.

The money rule that makes the second half safe: **nothing after the order moves
money.** Skipping a meal, bailing on one, or cooking something else are all
free, because the food is bought and each person's share is theirs. This is why
`meal_participants.bailed` exists and why a bailed participant is never deleted
— removing the row would hand their cost to their housemates days after the
split was agreed.

Testing it locally needs `/settings` → **Mark week as ordered**. Reaching
`ordered` for real requires a Tesco session and a UK address.

## One ingredient, however it was typed

The optimiser pools by `ingredientId`, so the app's whole claim — one bigger
pack instead of two small ones — depends on two housemates typing the same
ingredient landing on the same row.

They used not to. Every call site did `ilike('name', x)`: case-insensitive but
otherwise exact, so a plural made a second row, the shop bought both, and the
saving came out as zero with no error anywhere.

**Always use `findOrCreateIngredient()` (`src/lib/ingredients.ts`).** Never look
an ingredient up by name directly. It matches on `canonical_name` (`0018`) and
keeps the typed string as the display `name`.

`canonicalName()` is deliberately conservative and only ever touches the head
and tail of a string: lowercase, strip leading qualifiers (`fresh`, `organic`,
`large`), singularise the last word. Over-merging is far worse than
under-merging — folding "Butter" into "Peanut butter" would corrupt a shop and
then a split — so anything differing in the middle is left alone and handled by
**`/dev` → Duplicate ingredients**, which repoints all four tables carrying
`ingredient_id` before deleting the loser.

`canonical_name` has **no unique index** yet: existing rows already collide, and
a migration that fails on real data is worse than a missing constraint. Add it
once the merge tool reports clean. Until then look ingredients up with
`.limit(1)`, never a bare `.maybeSingle()` — that errors on multiple rows.

## Pack data, and why a line can be unpriced

Every basket line needs one thing the recipe cannot supply: how much a pack holds. Three outcomes, and they must stay distinguishable:

1. **Priced** — the pack size parsed out of the Tesco title converts into the recipe's unit. Normal case.
2. **Quantity assumed** (`basket_items.quantity_assumed`) — the recipe counts items ("3 garlic cloves", "4 slices of bread") and Tesco sells the thing by weight. No arithmetic converts a 190g jar into a clove count, so **one pack is bought and the line says so**. Before this the line was dropped: no price, no total, rendered as £0.00, and everybody was undercharged. A weighed pack is nearly always a container of many countable things — a loaf, a bulb, a bunch — so one is usually right, and the collector has a stepper.
3. **No price** — nothing matched, or the match had no readable price. Shown as "No price", excluded from the total, and collected via `PackDataForm`.

**`needsPackData` is `unit_price === 0`**, not "the ingredient row has no price". Nothing in a supermarket is free, and the old test let case 2 through as a genuine £0.00.

Loose produce (onions, avocados, lettuce) has no size in its title at all. `pickBestProduct` falls back to `1 whole` — one purchase is one of the thing — which is what makes "1 onion" priceable.

## Cooking is offered, never assigned

Whoever adds a meal is its cook. From there:

- only the current cook may hand it over, and doing so writes
  `planned_meals.cook_offer_to` — a **pending offer**, not an assignment;
- the person asked accepts or declines; until they accept, the original cook is
  still on the hook;
- a cook may stand down, leaving the meal unclaimed for any diner to claim.

`setCook` used to take any meal id and any user id, check that the *target* was
a diner, and write it — **the caller was never checked at all**. Anybody in the
house could put your name against Thursday's dinner on a meal they were not even
eating, and you would find out from the reminder on the day. Four actions
replace it (`claimCook`, `offerCook`, `respondToCookOffer`, `standDownAsCook`)
and each one checks who is asking (`0019`).

## Deleting an account, and why it can refuse

`splits.from_user_id`, `splits.to_user_id` and `expense_shares.user_id` all
cascade on a profile delete, so removing the row erases the debt in **either**
direction, silently, with the other housemates never told. `deleteAccount()`
therefore refuses outright while anything is unsettled and names the amounts.

It removes the **profile** and everything hanging off it. It cannot remove the
Supabase login — that needs a `service_role` key, which this app deliberately
does not hold — so the UI says so plainly rather than implying a clean erasure.

## Money that is not the weekly shop

Two things now reach the ledger, and they are kept in separate tables on purpose.

- **`splits`** are *derived*. Rebuilt from basket allocations, tied to
  `plan_id not null`, and safe to recompute because nothing in them was typed
  by a human.
- **`expenses`** are the opposite: hand-entered, unverifiable, and the one thing
  a basket rebuild must never touch. A kettle from Argos is not a plan.

Making `splits.plan_id` nullable would have put both in one table and left them
one recompute away from deleting somebody's £40. `getLedger()` merges the two
and every row carries `source: 'split' | 'expense'`, because "you owe Maya £14"
means something different when it is a kettle.

Expense shares are stored as **resolved pence, fixed at entry** — an equal split
of £10 three ways is 334/333/333 forever. Nobody should be able to change the
arithmetic of a debt after the fact by editing a rounding rule.

**Guests** never become participants: no account, no balance, no vote. They are
extra mouths folded into whoever invited them. `optimiser.ts` weights *heads*
rather than counting people — a covered guest doubles their host's weight, an
uncovered one spreads evenly across the table — and with no guests every weight
is 1, so it reduces to the previous arithmetic exactly.

**Leftovers** carry no cost at all. The food was paid for by whoever cooked it;
offering it round is a gift. The moment that board starts tracking who owes whom
for a bowl of chilli it has ruined the thing it was for.

## What NOT to Build Yet

- Multi-supermarket support — Tesco only for MVP
- Native mobile app — responsive web is sufficient
- Push notifications — in-app banners and the countdown timer
- AI recipe recommendations — manual input first
- Open-banking payment verification — too expensive at this stage

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
rtk uv run <cmd>        # Compact uv project command output
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->