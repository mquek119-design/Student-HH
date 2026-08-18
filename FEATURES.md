# Grub — Student Household Features

These features supplement CLAUDE.md and PRODUCT_SPEC.md. They cover the household coordination layer and how the app handles real student life — spontaneity, skipped meals, guests, and shared costs beyond food.

*Build status for everything below is tracked in HANDOFF.md, not here. This file is the spec.*

---

## The Two-Mode System

**IMPORTANT: "Planning Mode" and "Living Mode" are internal developer concepts only. These labels must never appear anywhere in the UI — no headings, no labels, no tooltips, no copy. The user should experience a seamless transition, not a named mode switch. Use these terms only in code comments and documentation.**

The app has two modes. The boundary is when the Tesco order is placed.

### Planning Mode (before the order)

Everything is free to change. Nothing is bought. No consequences.

- Anyone can add meals, remove meals, swap recipes, opt in, opt out, add guests, change constraints — unlimited changes
- Basket and split recalculate live as people make changes
- No confirmation dialogs, no "are you sure" — zero friction
- Default plan state is mostly empty. Mon–Fri dinner slots exist. Weekends are blank unless someone adds something
- The app asks "which nights do you want to cook together?" not "fill in every meal"
- If nobody submits anything by cutoff, the order doesn't happen. No guilt, no punishment

### Living Mode (after the order)

The food is bought. Every person's cost is settled. The money question is closed.

- If someone skips a planned meal, their ingredients are still theirs — they already paid. No cost redistribution. No one else's split changes.
- The app shifts from "what do you want to eat?" to "here's what you've got and when it goes off"
- Skipped meals trigger suggestions: "You've got chicken, peppers and rice from Thursday's plan. Here's what else you can make: stir fry, fajitas, fried rice."
- Guests are handled naturally — cook your ingredients for two, smaller portions, your call. No app interaction needed.
- End of week: unused ingredients become the starting point for next week's plan

### Data model for this

Every `PlannedMeal` needs a status:
```
planned → confirmed → cooked | skipped | swapped
```
- `skipped` triggers the leftover/suggestion flow
- `swapped` means the user picked a different recipe from suggestions — no cost change

Every `MealParticipant` needs a status:
```
in → opted_out (before order — free, cost removed from basket)
in → bailed (after order — cost stays with them, ingredients are theirs)
```

---

## Suggested Meals from Skipped Ingredients

When a user marks a meal as "skipped" in Living Mode:

1. Look up which ingredients from that meal are allocated to this user
2. Query the recipe database for recipes that can be made with those ingredients (partial matches fine — 3/4 ingredients is a match)
3. Show 2–3 suggestions inline on the plan grid: "You've got [ingredients]. Here's what else you can make:"
4. User taps one to see the recipe, or ignores it

This is a simple ingredient-matching query, not AI. No cost changes — the ingredients are already paid for.

Perishable ingredients get a warning: "Chicken from yesterday — use by tomorrow."

End-of-week nudge: "Still got rice and onions sitting there. Use them or they're going in the bin."

---

## Weekend Unplanned by Default

The plan grid shows Mon–Fri only. Weekends are blank unless someone actively adds a meal. The app never prompts for weekend meals. If someone wants to cook Saturday, they add it. But the default is empty — weekends are chaos and the plan shouldn't pretend otherwise.

---

## Household Extension Features

All of these feed into the existing ledger. Small to build, high impact.

### Shared Household Staples

Non-food items the house always needs: toilet paper, bin bags, sponges, washing-up liquid, kitchen roll.

- Running list in house settings
- Each item: name, preferred product (optional), frequency (weekly/fortnightly/monthly)
- Before each order, the app checks which staples are due and adds them to the Tesco basket automatically
- Cost split equally across all house members
- Anyone can add or remove items
- Appears in basket under "Shared Staples" section
- Appears in split as one line: "Shared Staples: £8.50 (your share: £2.13)"

### One-Off Receipt Splitting

Purchases made outside of Tesco — someone bought a shower curtain, a toaster broke, grabbed something from Aldi.

- "Log a purchase" button in the Split tab
- Fields: what, how much, photo of receipt (optional), who to split between (checkboxes)
- Split equally or enter custom amounts per person
- Appears in the ledger immediately, adds to running balances

### Guest Meals

**During Planning Mode:**
- "+1" toggle on any planned meal
- Host picks: "I'm covering my guest" (cost stays on host) or "Split across the table"
- Adjusts portion count and ingredients

**During Living Mode (unplanned guest):**
- No app interaction needed — cook your ingredients for more people, your food, your choice
- Optional "Had a guest" log after the meal — adjusts nothing financially, just tracks it

### Cooking Rota

- Each shared meal in the plan grid has a "Cook" assignment
- During planning, anyone can volunteer or be assigned
- Swap mechanic: tap your meal, request swap, other person accepts/declines
- Day-of reminder on the Feed: "You're cooking tonight — here's what you're making" with one-tap into cook mode

### Leftovers Tracker

Simple message board on the pantry page.

- "Add leftover" button: what, how many portions, when made
- Shows with a countdown: "Chilli — feeds 2 — made Monday — eat by Wednesday"
- Auto-expires after 3 days (configurable)
- Anyone can claim: "I'll eat this" removes it

### WhatsApp-Optimised Notifications

Not a WhatsApp integration — just notifications written so well that students screenshot and send them to the group chat.

Key notifications:
- Sunday: "New week. What do you fancy?"
- Cutoff approaching: "3 hours left. If you don't pick you're eating whatever everyone else wanted."
- Housemate hasn't submitted: "[Name]'s ghosting the app. Give them a poke."
- Order placed: "Order's in. [Day] [time]. Someone be home."
- Split posted: "This week's damage: you owe [collector] £[amount]."
- Payment reminder: "You owe [name] £[amount]. They can see this."
- Perishable warning: "Chicken from yesterday's plan — use by tomorrow."
- Savings milestone: "Your house has saved £[amount] this term. That's [X] pints."

Use web push notifications. Service worker registration after the user completes at least one planning cycle — never on first visit.
