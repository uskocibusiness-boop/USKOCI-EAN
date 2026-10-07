# DISCOVERY-ZAMENE — "Za mene" in `rpc_discovery_v1` (owner decision 2026-10-07)

**Status: SOURCE ONLY, NOT APPLIED.** Only after MATCH-V1, on the owner's exact word **`PRIMENI DISCOVERY-ZAMENE`**. Proof: `.github/workflows/match-v1-discovery-zamene-proof.yml`. Gap closed: G4.

## Behaviour

- The map and the list keep showing **all** tasks. The optional filter key `forMe: true` narrows PAGE, MAP, PLACES and their `counts` to the caller's "Odgovara mi" = `private.worker_need_match_v1` (kind of work + area + time), the **same rule** the notifications use after MATCH-V1.
- Absent or `false`: request validation, `filterKey`, anchors, cursors and the response are byte-identical to the P6 rollout v3 reader (proved).
- No ACTIVE worker profile: refusal `P6_FOR_ME_PROFILE_REQUIRED` (SQLSTATE `22023`, HTTP 400), `details` = `NOT_ACTIVE` | `MISSING` | `AUTH_REQUIRED`. A non-boolean `forMe` is `P6_INVALID_FILTER`. `EXACT_PUBLIC` is unchanged. The `availability` block still describes every open task (chips stay stable when the switch is on).
- Client contract: `CLIENT_CONTRACT.md`. This package edits no app code.

## Exact boundaries

- `public.rpc_discovery_v1(jsonb)`: anchored edits (declare, filter keys, `forMe` read + refusal + the caller's circle read once, normalised filter, and for PLACES and for PAGE/MAP a conservative distance pre-test followed by the rule as the LAST condition of the list). Predecessor `1c602244…` (P6 rollout v3 = DEV); SECURITY INVOKER, STABLE, ACL `{postgres=X/postgres,authenticated=X/postgres}` unchanged.
- New `public.discovery_for_me_state_v1()` (returns jsonb: `state` ACTIVE / NOT_ACTIVE / MISSING / AUTH_REQUIRED and, when the worker has an approximate point, `lat`, `lng`, `radiusKm`) and `public.discovery_for_me_v1(uuid)`: SECURITY DEFINER, STABLE, SQL, `search_path=pg_catalog`, EXECUTE `authenticated` only (they are callable through PostgREST; they only answer for the caller's own profile and for open published tasks, i.e. nothing beyond Discovery). The security advisor will list them like the EX06e owner RPCs.
- Pins MATCH-V1's three rule functions; refuses without them. Certificate: does not move (asserted in the transaction).
- Cost: without `forMe` nothing extra runs. With `forMe` the exact rule (`private.worker_need_match_v1`, about 0.2 ms per task) would run for every open task; a **conservative distance pre-test** turns away a task that is clearly outside the caller's circle with plain arithmetic first (about 3 us), so the rule runs only for the tasks inside the circle (plus tasks without a point, remote tasks, and every task when the caller has no approximate point). The pre-test can only remove tasks the rule would refuse: the rule accepts when `round(distance, 2) <= radius`, the pre-test keeps everything up to `radius + 0.01`, and the load proof compares the number of tasks "Za mene" lists with the exact rule over 100 and over 1,000 open tasks spread over about 220 km. Measured numbers: the `load` job of `.github/workflows/match-v1-discovery-zamene-proof.yml`. The reader as a whole is still linear in the open tasks (the known spatial-prefilter work of ZAVRSNA_PROVERA §5.3 is a separate package); "Za mene" rides on it and adds only the pre-test per task.

## POINT_TO_POINT on the map (owner decision 2, "da")

Already true on DEV for every task published through the product path: `private.materialize_resolved_location` stores the coarse public point (2 decimals, the 1 km rule) from the **start** slot for every mode except `AREA_BASED` (service area). DEV read-only check 2026-10-07: all 17 POINT_TO_POINT tasks with a resolved place carry that point. The 4 open POINT_TO_POINT tasks without a pin are TEST-world fixtures from 2026-08-30 with **no geography, no resolved place, no city** (`preflight.readonly.sql` counts them: `openPointToPointWithoutPoint` = 4, `openPointToPointWithoutPointButStartRecorded` = 0). There is no recorded start point to backfill, and writing coordinates on a published task would need either invented data or bypassing the published-task edit guard (`PUBLIC_NEED_EDIT_REQUIRES_CONFIRM_COMMAND`). **No backfill is shipped**; what to do with those 4 legacy TEST tasks (e.g. close them) is a DEV data decision for the owner. The proof publishes a real POINT_TO_POINT task (Novi Sad → Beograd) through the product path and shows its pin, its MAP bucket and its POINT_MEMBERS scope at the rounded start point, not the end.

## Files

`build_candidate.py`, `live-functions.json`, `candidate.sql`, `revert.sql` (exact inverse), `preflight.readonly.sql`, `postflight.readonly.sql`, `body.diff`, `patches.json`, `manifest.json`, `CLIENT_CONTRACT.md`.
