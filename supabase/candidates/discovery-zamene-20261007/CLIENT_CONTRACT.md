# DISCOVERY-ZAMENE — client contract for the "Za mene" switch

For the owner of `src/data/discoveryV1Contract.ts`, `src/data/discoveryV1ClientTransport.ts` and the Zadaci screen. Server side only takes effect after `PRIMENI MATCH-V1` and `PRIMENI DISCOVERY-ZAMENE`; until then the server refuses the key (`P6_INVALID_FILTER`), so ship the switch behind a flag or hide it until the package is applied.

## Request

`filter` keeps its seven required keys and gains one OPTIONAL key:

```json
{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null,"forMe":true}
```

- `forMe` must be a JSON boolean. Omitted or `false` = today's request (same `filterKey`, same anchors and cursors).
- Valid in `PAGE`, `MAP` and `PLACES`. `EXACT_PUBLIC` ignores filters as before.
- `forMe: true` gives a **different `filterKey`**: when the switch changes, start a new anchor (`anchor: null`, `after: null`), exactly as for any other filter change. Reusing an old anchor returns `P6_INVALID_ANCHOR`.

## Response

Same shape as today. With `forMe: true`:

- `PAGE.items`, `MAP.buckets`, `MAP.wholeBounds`, `PLACES.items` and every number in `counts` (`mapped`, `listed`, `inArea`, `withoutPoint`, `undated`, `everywhere`) cover only tasks that "odgovaraju" the caller (kind of work + area + time — the rule of the notifications).
- `availability` (`hasKnownWorkMode`, `hasKnownSchedule`, `priceModes`) still describes all open tasks, so filter chips do not jump when the switch toggles.

## Refusal

| Condition | `error.code` | `error.message` | `error.details` |
| --- | --- | --- | --- |
| caller has no worker profile | `22023` | `P6_FOR_ME_PROFILE_REQUIRED` | `MISSING` |
| worker profile is a draft / not active | `22023` | `P6_FOR_ME_PROFILE_REQUIRED` | `NOT_ACTIVE` |
| not signed in | `28000` (`AUTH_REQUIRED`, as today) | | |
| `forMe` not a boolean | `22023` | `P6_INVALID_FILTER` | |

Suggested copy (owner wording rules: "ti", no gender): "Za mene radi kad je radni profil aktivan." with the existing entry to the worker profile, and the switch turned off.

## Not changed

Default results, sorting, paging, clustering (≤ 256 buckets), the public point precision (`COARSE_1KM`) and the world boundary are exactly those of P6 rollout v3.
