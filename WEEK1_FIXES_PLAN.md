# Week 1: Critical Fixes + Grub Voice Polish

**Objective:** Complete all critical Week 1 bugs + ensure copy matches Grub voice (dry, British, faintly deadpan)

**Status:** In Progress  
**Target Completion:** 8-12 hours  
**Estimated Timeline:** 2-3 days with parallel agents

---

## Task Breakdown

### Task 1: Touch Target Sizing (WCAG 2.5.5)
**Agent:** Fix-1 (Touch Targets)  
**Effort:** 2-3 hours  
**Files:**
- `src/components/basket/BasketView.tsx:416-430` (quantity +/- buttons)
- `src/components/split/Reconciliation.tsx:205-224` (quantity buttons)
- `src/components/split/Reconciliation.tsx:287-314` (Accept/Reject buttons)
- Any other buttons < 44px × 44px

**Definition of Done:**
- All interactive elements ≥ 44px × 44px (touch target size)
- Focus ring visible on all buttons (keyboard nav)
- No layout regression at 375px/768px/1440px
- Build passes `npm run verify`
- Commit created

---

### Task 2: Dietary Filter Wire-Up
**Agent:** Fix-2 (Dietary Filters)  
**Effort:** 2-3 hours  
**Files:**
- `src/components/recipes/RecipeFilterChips.tsx` (filter state → URL params)
- `src/lib/queries.ts` (recipe search with dietary matching)
- `src/app/plan/page.tsx` (display dietary warnings on meal cards)

**Scope:**
- Selected dietary filters persist in URL (`?dietary=vegetarian,gluten-free`)
- Recipe list filters in real-time
- Meal cards show "Contains X (you're Y)" warnings during planning
- Join button shows warning instead of blocking

**Definition of Done:**
- Filter by "Vegetarian" shows only vegetarian recipes
- Join non-veg meal as veg person shows warning (doesn't block)
- Filters persist across navigation
- No console errors
- Build passes
- Commit created

---

### Task 3: Room Assignment Display
**Agent:** Fix-3 (Room Display)  
**Effort:** 1-2 hours  
**Files:**
- `src/components/meal/MealCard.tsx` (show room next to cook name)
- `src/components/split/SplitLine.tsx` (show room in balances)
- `src/components/account/PaymentPanel.tsx` (show room in payment details)
- Any other user references

**Scope:**
- Room displays as "(Room X)" next to username where relevant
- Works on mobile/tablet/desktop
- Graceful fallback if room is null

**Definition of Done:**
- Room visible on meal assignments
- Room visible on split balances
- Room visible on payment panel
- No layout breakage
- Build passes
- Commit created

---

### Task 4: "Mark as Cooked" UI
**Agent:** Fix-4 (Mark Cooked)  
**Effort:** 2-3 hours  
**Files:**
- `src/components/kitchen/KitchenPanel.tsx` (add checkbox/button)
- `src/app/plan/actions.ts` (add setCookedStatus action)
- Permission checks (only cook can mark cooked, only past days)

**Scope:**
- Add UI element to mark meal as "cooked" after the day passes
- Updates `planned_meals.status = 'cooked'`
- Only cook or house member can mark
- Only available for past days
- Enables leftovers creation

**Definition of Done:**
- Checkbox appears on past day meals
- Clicking updates status in DB
- Permission check prevents unauthorized marking
- Leftovers creation works after marking cooked
- Build passes
- Commit created
- E2E test for cook flow

---

### Task 5: Form Validation Feedback
**Agent:** Fix-5 (Form Validation)  
**Effort:** 1-2 hours  
**Files:**
- `src/components/recipes/RecipeForm.tsx` (cook time min, servings min)
- `src/components/onboarding/CreateHouseForm.tsx` (if validation needed)
- Add real-time validation messages

**Scope:**
- Cook time: min 5 minutes validation
- Servings: min 1, max 20 validation
- Show error message before submit
- Disable submit if invalid

**Definition of Done:**
- Validation messages appear in real-time
- Form won't submit if invalid
- Messages use Grub voice (dry, plain)
- Build passes
- Commit created

---

### Task 6: Copy & Voice Polish
**Agent:** Fix-6 (Grub Voice)  
**Effort:** 1-2 hours  
**Scope:**
- Audit all user-facing copy (error messages, labels, hints, CTAs)
- Ensure dry, plain, British, faintly deadpan tone
- Remove exclamation marks from non-urgent messages
- Remove cutesy language ("Let's", "Amazing!", "Perfect!")
- Test on `/welcome`, `/login`, `/onboarding`, error states

**Examples:**
- ❌ "Let's get planning! 🎉"
- ✅ "Add a meal to the plan"
- ❌ "That link has expired or was already used. Try again!"
- ✅ "That link has expired or was already used. Request a new one."

**Definition of Done:**
- All copy reviewed for tone
- No exclamation marks on routine messages (only errors/critical)
- No "Let's", "Great!", "Awesome!", wellness-brand language
- Commit created

---

## Success Criteria

- [ ] All 5 functionality fixes completed
- [ ] Voice polish applied to all copy
- [ ] `npm run verify` passes (typecheck, lint, build)
- [ ] No console errors on main routes
- [ ] Responsive at 375px, 768px, 1440px
- [ ] All commits created
- [ ] Build ready for staging deploy

---

## Parallel Execution

**Agents 1-5:** Work in parallel (independent fixes)  
**Agent 6:** Work on voice during Agent 1-5 execution  

**Timeline:**
- Agents spawn → 1h per agent task
- QA/merge phase → 1-2h
- Total: 4-6h wall-clock time

---

## Blockers/Dependencies

- None (all tasks independent)
- No database migrations needed
- No new dependencies

---

## Rollback Plan

Each commit can be reverted independently via `git revert <commit-hash>`

---

## Next: Options 2-8 To-Do

See [WEEK1_PLUS_ROADMAP.md](./WEEK1_PLUS_ROADMAP.md) for post-Week1 work
