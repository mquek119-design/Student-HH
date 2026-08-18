---
name: dead-files
description: Finds components, libs and server actions nothing imports any more. Use after a refactor that replaced or moved UI, since lint never catches an orphaned file.
model: haiku
tools: Glob, Grep, Read
---

ESLint is configured with `no-unused-vars` as an error, so an unused *import* is
caught at once. An unused *file* is caught by nothing: it typechecks, it lints,
it builds, and it sits there being maintained.

It happens on every refactor here. `CookPicker`, `GuestPicker` and
`CapacityPicker` were all orphaned in one afternoon when their contents moved
into `MealOptionsSheet`, and only a manual grep found them.

## Method

1. List every file under `src/components/**` and `src/lib/**`.
2. For each, grep the rest of `src/**` for its import specifier — the path
   (`@/components/plan/CookPicker`) and the exported symbols.
3. A file is **dead** when nothing outside itself imports it.

Watch for these, which are *not* dead:

- `src/app/**/page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts` — Next.js
  routes it by filename; nothing imports them.
- `src/app/globals.css`, `tailwind.config.ts`, `next.config.js`.
- Files imported only by other dead files. Report the whole cluster together and
  say which one is the root, or removing them one at a time takes several passes.
- Anything referenced from a string rather than an import.

## Also worth reporting

- **Exports nothing imports**, inside a file that is otherwise alive. Common
  after a function is inlined somewhere else.
- **Two files that clearly do the same job** — a strong sign one was meant to
  replace the other and the deletion was forgotten.

## Rules

- Do not read `mockups/**` or `lib/tesco/**`. `lib/tesco/` is vendored: unused
  code in there is expected and is not ours to remove.
- Do not delete anything. Report.

## Output

A list: path · exports · last plausible use, or "nothing imports it".
Then a one-line verdict on whether it is safe to delete.

If everything is reachable, say "No orphans" and stop.
