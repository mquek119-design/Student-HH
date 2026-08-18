# Local changes to the vendored Tesco fork

`lib/tesco/` is copied from the private `uk-grocery-cli` fork and CLAUDE.md says
to treat it as a dependency. It has nonetheless been modified. **Re-vendoring
from upstream will silently discard everything listed here** — re-apply these,
or better, push them upstream and re-vendor cleanly.

Keep this file current. An undocumented divergence in vendored code is the kind
of thing that gets lost and then quietly breaks a shop.

| File | Change | Why |
|---|---|---|
| `providers/types.ts` | `checkout(dryRun?, options?)` | Thread fulfilment choice through to the browser flow. |
| `providers/tesco/index.ts` | `checkout()` forwards `options` | Same. |
| `providers/tesco/index.ts` | `getDeliverySlots(method)` | Was delivery-only; Click+Collect needs `COLLECTION`. |
| `providers/tesco/api.ts` | `getSlots(start, end, method)` queries `delivery` **or** `collection` | Slots live under two root fields, not one field with a type argument — see below. |
| `providers/tesco/index.ts` | slot times formatted in `Europe/London`; `starts_at`/`ends_at` added | Times were rendered in the machine's local zone while dates used UTC. |
| `browser/normalise-cookies.ts` | **new file** | Cookie Editor exports use `sameSite` spellings Playwright rejects. |
| `browser/{checkout,slots,tesco-checkout,tesco-slots}.ts` | use `normaliseCookies()` | Same; all four browser fallbacks threw on the first cookie. |
| `providers/tesco/auth.ts` | session handling tweaks | Made by a previous agent; not audited here. |
| `browser/tesco-checkout.ts` | `handleTescoFulfillment()` + fulfilment-aware dry run | Select delivery vs collection and a store/postcode before previewing. |
| `browser/tesco-slots.ts` | minor | Made by a previous agent; not audited here. |
| `providers/tesco/api.ts` | `bookSlot` selection set corrected to `{ slot { … } }` | Asked for `orderId`/`status`/`error`, none of which exist on `SlotWrapperType`; every booking failed validation. |
| `browser/{slots,tesco-slots}.ts` | query `[id="${slotId}"]` instead of `#${slotId}` | Avoids Playwright CSS selector syntax crash when slotId contains base64/URL special chars like `=` or `:`. |

## Known weakness in `browser/tesco-checkout.ts`

The dry-run path scrapes the page for a total:

```js
dryPageText?.match(/(?:order total|total)[:\s]*£(\d+\.?\d*)/i)
```

That takes the **first** match of "total" anywhere in the document — which may be
a subtotal, a "total savings" figure, or a guide price. It is a guess, not a
reading, and it feeds money into the split.

Prefer `getDeliverySlots()`, which returns a structured `price` per slot, and
add that charge explicitly. See `src/app/basket/slotActions.ts`. The scrape is
kept only as a fallback for when no slot has been chosen.


## Verified against the live API (2026-08-09)

### Slots are two root fields, not one field with a type

`Query.delivery` takes **no** `type` argument — passing one is rejected
outright. An earlier attempt set `type: 'COLLECTION'` on the sibling
`fulfilment(...)` field, which only returns metadata (`preBookedOrderDays`), so
it silently kept returning delivery vans.

Probed against the live schema (introspection is disabled, so by trial):

| Field | Result |
|---|---|
| `collection(start,end)` | **works** — 54 slots, same shape as `delivery` |
| `clickAndCollect(...)` | exists but different shape (`ClickAndCollectInterface`) |
| `collectionSlots(...)` | no such field |
| `slots(...)` | `Insufficient permissions` |
| `delivery(..., type:)` | `Unknown argument "type"` |

So `getSlots` selects the root field by method and normalises the result onto
`delivery` so downstream mapping stays single-path.

### Timezone

Slot times came from `toTimeString()` (machine-local) while dates came from
`toISOString()` (UTC) — two zones on one slot. On a UTC+7 machine a real 08:00
UK collection slot displayed as **14:00**, and late slots landed on the wrong
date. Booking from that display picks the wrong slot. Now both are formatted in
`Europe/London`, and the raw instants are passed through as `starts_at`/`ends_at`
so callers store the unambiguous value.

Live check after the fix: 166/166 delivery and 52/52 collection slots fall at
plausible UK hours; before, many read as 00:00–04:00.

### Booking a slot

`fulfilment(slotId:)` returns `SlotWrapperType`, whose only field is
`slot: SlotType`. `SlotType` exposes `id`, `start`, `end`, `status`, `charge`,
`group`, `locationUuid`, `expiry` and `price { … }`. There is **no** `orderId`,
`status` or `error` on the wrapper — the original selection set was invalid, so
booking failed schema validation on every attempt and fell through to a browser
fallback that could not work either.

Field names were confirmed without booking anything: send a selection set
containing one deliberately invalid field, and GraphQL fails validation *before*
execution while naming exactly which fields are wrong. Anything absent from that
list is real.
