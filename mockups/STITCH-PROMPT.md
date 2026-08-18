# Google Stitch prompt — Grub

Paste the **System prompt** once, then one **Screen prompt** per screen. Stitch
does better with one screen per generation than with a whole app in one go.

The tokens below are the live values from `tailwind.config.ts`. Keep them exact
— anything Stitch returns in different colours has to be re-derived by hand
before it can be ported.

---

## System prompt (prepend to every screen)

> Design a mobile-first web app called **Grub**. It helps UK university
> housemates plan meals together, build one shared Tesco order, and split the
> cost per item rather than equally. The tone is calm, plain-spoken and a bit
> dry — students, not a wellness brand. Never cute, never corporate.
>
> **Palette — use these hex values exactly.**
> - Background: `#FAFAF7` (warm off-white, the page ground)
> - Primary: `#1B4332` (deep forest green) with white text
> - Primary container: `#2D6A4F`, on-primary-container `#D8F3DC`
> - Primary fixed (tints, chips): `#D8F3DC`
> - Secondary / accent: `#D4A574` (warm tan) with `#1B4332` text
> - Secondary fixed (soft highlight blocks): `#FDECD0`
> - Cards: white `#FFFFFF`, 1px border `#E5E5E0`, very soft ambient shadow
> - Error: reserved for destructive actions only, never for plan states
>
> **Type.** Plus Jakarta Sans for all text. JetBrains Mono for every number —
> money, quantities, dates, countdowns — so columns of figures align.
>
> **Shape.** Corner radius 4px default, 8px medium, 12px on cards. Pill/full
> radius on buttons and filter chips. 375px viewport, generous 16px gutters,
> comfortable tap targets (44px minimum).
>
> **Rules that matter.**
> - Money is only ever shown when it is real. Never render a placeholder price,
>   never show `£0.00` for something unpriced — write "No price" instead.
> - Nothing in the UI blocks or scolds a user's choice. Suggestions are offers.
> - No red for a normal state. Red is for deleting things.
> - Use Material Symbols icons, outlined weight.

---

## Screen 1 — Plan (the week)

> Screen: **Your Week**. A single mobile screen showing one week of meals, and
> nothing else on the page.
>
> Header: "Your Week", with a sub-line "Add meals and join your housemates' by
> Sunday 5:00 pm".
>
> Main content: a **horizontally scrolling row of day cards**, Monday to Friday.
> Each card is about 260px wide, white, 12px radius, thin border, with the day
> name and date (date in mono) at the top.
>
> Inside a day card, **meals stack vertically** — a night can hold more than
> one. Each meal block shows: a 48px square food thumbnail, a small uppercase
> label for the sitting (BREAKFAST / LUNCH / DINNER) with a matching icon, the
> recipe name over two lines, a row of overlapping circular avatars with a mono
> count like "4 in" on the right, one line of grey text reading "Maya is
> cooking", and a full-width pill button that says **Join** (filled green) or
> **Leave** (outlined) depending on whether you are already in.
>
> Below the meals in each card, a dashed-outline "Add a meal" button filling the
> remaining space on empty days, or a smaller "Add another" strip on days that
> already have something.
>
> Below the week row, in order:
> 1. A full-width green gradient banner: "SHARED SAVINGS" in small uppercase on
>    the left, a mono amount like "£15.40" on the right.
> 2. A soft tan panel (`#FDECD0`) with a lightbulb icon headed "Wednesday
>    dinner: shop once, cook separately." One line of body text, then two
>    tappable recipe rows each showing a title and a small grey line reading
>    "Shares chicken breast, coconut milk, rice", then a final small line: "Buying
>    the same ingredients twice costs the house about £2.50."
> 3. A green pill button "Browse recipes" and a plain green text link "Pantry".
>
> Bottom navigation with four items: Feed, Plan (active), Basket, Split.
>
> Show a version where one day has two different meals stacked, so the layout is
> tested at its busiest.

## Screen 2 — Recipes (the book, and how meals get planned)

> Screen: **Recipes**. The house recipe library on its own full page.
>
> Header: "Recipes" with a sub-line "Everything the house has saved. Tap one to
> put it on a day." A small green pill "+ Add" button top right.
>
> Under it: a full-width search field with a magnifier icon, placeholder "Search
> recipes or an ingredient…".
>
> Under that: a horizontally scrolling row of **filter chips** — Quick (bolt
> icon), Budget (savings icon), Pantry match (fridge icon), Veggie (leaf icon).
> Show one chip in the selected state: green outline, pale green fill `#D8F3DC`,
> green text. Show one chip disabled and dimmed.
>
> Main content: a **two-column grid of recipe cards**. Each card is white with a
> 12px radius: a food photo filling the full card width at 96px tall, then the
> title over two lines, then a small grey meta line with a clock icon and "25
> min", a dot separator, and a mono "£2.50/portion". Where relevant, a small
> uppercase green line underneath: "3 already in the pantry".
>
> Below the grid, a plain green text link with a plus icon: "Add a recipe the
> house doesn't have".
>
> Bottom navigation with four items; **Plan** is the highlighted one, because
> this screen is entered from the week.

## Screen 3 — Quick-add bottom sheet

> Screen: the same **Recipes** screen with a **bottom sheet** slid up over a
> dimmed, blurred backdrop.
>
> The sheet is white, rounded 12px at the top corners, and contains:
> - A header row: a 56px food thumbnail, the recipe title, a grey line "25 min ·
>   serves 4", and a close X on the right.
> - A small uppercase grey label "WHICH DAY", then a grid of seven day buttons
>   (Mon Tue Wed Thu Fri Sat Sun), each a 44px-tall rounded rectangle. One is
>   selected: green outline, pale green fill, green text.
> - A small uppercase grey label "WHICH SITTING", then three wider buttons in a
>   row — Breakfast, Lunch, Dinner — each with an icon. Dinner is selected.
> - A full-width filled green button: "Add to Wednesday".
> - A final small grey line: "If a housemate already picked this for the same
>   sitting you'll join them — that overlap is where the savings come from."
>
> No dropdowns and no text inputs anywhere in the sheet. Everything is a tap.

## Screen 4 — Basket

> Screen: **Basket**. A reviewed Tesco order.
>
> Header "The Basket" with a sub-line naming who places the order.
>
> Items are grouped under section headings with icons — Fresh, Cupboard,
> Household. Each row: a 56px product photo on the left, the Tesco product name
> in full, a small grey line under it with the pack size ("500g pack"), a row of
> tiny avatars showing who the item is attributed to, and a small green
> "SWAP BRAND" text button. On the right: the price in mono, with a struck-out
> old price above it in grey when a cheaper own-brand was swapped in, and a
> compact quantity stepper (minus, number, plus).
>
> Show three states in the list:
> 1. A normal priced item.
> 2. An item reading **"No price"** in tan instead of a figure — never £0.00.
> 3. An item with a small tan pill under the name reading "1 PACK ASSUMED —
>    CHECK", with a question-mark icon.
>
> A fixed bottom bar above the navigation showing "Estimated Total" as a small
> uppercase label with a large mono figure, and a filled green "Checkout" button.
>
> Bottom navigation, Basket active.

## Screen 5 — Split (This Week)

> Screen: **Split**, sub-tab **This Week** (three sub-tabs across the top: This
> Week, Delivery, Balances — a segmented row, first one active).
>
> Under the sub-tabs, a thin grey information strip with a small icon: "Ordered.
> When it arrives, tick off what turned up under Delivery — the split is rebuilt
> from that, not from the plan."
>
> Then a centred block: small uppercase "WEEK 33 SETTLEMENT", a green headline
> "Total You Owe", and a very large mono figure "£18.42".
>
> Then a **Cost Breakdown** list. Each entry is a white card: an icon in a pale
> green circle, a category name like "Fresh", a grey count "6 items", the amount
> in mono on the right — and below, an indented list of working lines, each with
> a grey item name on the left and a mono amount on the right, e.g. "Chicken
> breast (yours) …… £3.34" and "Whole milk (£1.75 ÷ 5) …… £0.35". This
> arithmetic is the point of the screen: make it legible, not decorative.
>
> To the right (or below on mobile), a **Pay Maya** card: each payment detail on
> its own row with a copy icon — Bank / Sort code / Account number / Link — the
> numbers in mono. Under it a full-width tan button "I've Paid", and a small
> grey line "Payments happen outside the app."
>
> Bottom navigation, Split active.

---

## What to ignore in whatever Stitch returns

- Any invented prices, savings figures or "you saved 32%" badges. Every number
  in this app is derived from a real basket; a plausible-looking fake one is the
  single most damaging thing that can be pasted into it.
- Progress bars, streaks, gamification, confetti.
- "Conflict" or warning styling on the plan. Housemates cooking different things
  is a normal outcome, not an error state.
- Any dropdown `<select>` in a planning flow.
