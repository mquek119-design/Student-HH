# Grub brand assets

| File | Use |
|---|---|
| `grub-mark.svg` | Mark alone, for light backgrounds. |
| `grub-mark-on-dark.svg` | Mark for dark ground (the forest-green app bar) — the front disc inverts to cream so it stays legible. |
| `grub-logo.svg` | Mark plus wordmark, light backgrounds. |

Colours: forest `#1B4332`, oat `#D4A574`, cream `#F7F5EF`. These are the same
values as `primary` / `secondary` in `tailwind.config.ts` — change both together.

**In the app, prefer the React component** `src/components/brand/Logo.tsx`:
it inherits the tokens and needs no network request. These files are for
anything outside React — README badges, social cards, print, handing to a
designer.

`src/app/icon.svg` is the favicon and is a separate copy by necessity: Next.js
reads that exact path.
