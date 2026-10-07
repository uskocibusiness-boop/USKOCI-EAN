# DISCOVERY-GRAD — client contract (place = city, finding without Serbian letters)

For the owner of `src/data/discoveryV1Contract.ts`, `src/data/discoveryV1SpatialContract.ts`, `src/data/discoveryV1SearchOwner.ts`, `src/data/discoveryV1Owner.ts` and the "Gde" panel (`src/ui/v2/discovery/PlacePicker.tsx`, `popularCities.ts`). The server side takes effect only after `PRIMENI DISCOVERY-GRAD`. Until then the server refuses the one new key (`P6_INVALID_REQUEST`), so ship the city list behind a flag or keep it off until the package is applied. Nothing else needs a flag: every request the app sends today stays valid.

## Request

**Unchanged keys, wider meaning (no client change needed):**

- `filter.text`: found in the title, the place text and the needed skills, tools and vehicles, without regard to Serbian letters, case or script (`"cistim"` = `"čistim"`, `"Djordje"` = `"Đorđe"`, `"ЧИСТИМ"` = `"čistim"`). Send what the person typed, as today.
- `filter.place` (PAGE, MAP): a task matches when the place names its **whole place text** (as today) **or its city**. The city is the task's `approximateCity`; for a task without one, the last part of its place text after a comma. So `"Novi Sad"` lists every task in Novi Sad, `"Detelinara, Novi Sad"` only that part. Letters, case and script do not matter (`"Cacak"` = `"Čačak"` = `"Чачак"`). A remote task and a task without any place text never match a place; a task without a pin but with a city does (in an area scope it comes in the "bez tačke" section, as today). With `where: "remote"` the place is ignored, as today.
- PLACES `prefix`: matched the same way (`"cac"` finds `"Čačak"`).

**One new OPTIONAL key, PLACES only:**

```json
{"mode":"PLACES","filter":{...},"anchor":null,"prefix":"","facetArea":null,"limit":30,"after":null,"groupBy":"CITY"}
```

- `groupBy`: `"AREA"` (the same as leaving it out: one row per place text, as today) or `"CITY"` (one row per city).
- Any other value, any other type (`null` included) and the key on PAGE, MAP or EXACT_PUBLIC → `P6_INVALID_REQUEST` (`22023`).
- `groupBy: "CITY"` has its **own `filterKey`**: start the CITY list with `anchor: null` and never reuse an AREA anchor for it (`P6_INVALID_ANCHOR`). `"AREA"` and an absent key share today's key.

## Response

**Shapes are byte-for-byte the shapes of today** (no new field anywhere; the decoders stay as they are).

- PLACES items keep `{key, text, count}` with `key = placeKey(text)`, unique keys, the order `count desc, text (sr-Latn-RS)`, and the sum of counts ≤ `counts.everywhere`.
- With `groupBy: "CITY"`: `text` is the city as the tasks write it (for example `"Novi Sad"`), `count` is the number of tasks in that city under the current filter, and **choosing the row (sending `filter.place = text`) lists exactly `count` tasks** (proved for every row).
- Two spellings of one place (`"Čačak"` / `"Cacak"`, `"Novi Sad"` / `"Нови Сад"`) are one row in both modes; the shown `text` is the most recently published spelling.
- AREA rows that are a bare city name (`"Novi Sad"`) count the tasks that wrote exactly that text, while choosing them now lists the whole city (more). Use `groupBy: "CITY"` for city rows; keep AREA rows for the parts of a city.

## Suggested client changes (owner of the screens decides)

1. "Gde" first shows **cities** (`groupBy: "CITY"`, `prefix` = what is typed): "Novi Sad · 23". A city row is now an ordinary place filter, so `cityStanding(... ).kind === 'parts'` and its "lead to the parts" detour are no longer needed for cities that have tasks; the popular-city list can show the server's count for any city row it finds.
2. The parts of a city stay available as AREA rows (`prefix` = the city name), e.g. under the chosen city.
3. `placeKey()` stays the key rule (`DISCOVERY_V1_PLACE_KEY_MISMATCH` cannot happen: the server sends `p6_discovery_key(text)` as before). `foldPlace()` in `popularCities.ts` folds `đ` to `d`; the server folds `đ` to `dj` (owner decision: `"dj"` for `"đ"`). The client fold only filters rows already received, so the difference shows only when someone types `"Dorde"`: the server prefix does not find `"Đorđe"` (it does find `"Djordje"`).
4. A list opened before the apply keeps working with its anchor (same `filterKey`); after at most 30 minutes it is renewed as today.

## Errors

| Condition | `error.code` | `error.message` |
| --- | --- | --- |
| `groupBy` not `"AREA"` / `"CITY"`, or present on PAGE / MAP / EXACT_PUBLIC | `22023` | `P6_INVALID_REQUEST` |
| an AREA anchor sent with `groupBy: "CITY"` (or the reverse) | `22023` | `P6_INVALID_ANCHOR` |

No other error is new. `filterKey`, anchors and cursors of every other request are unchanged.
