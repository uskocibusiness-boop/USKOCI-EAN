# Worker coverage: two independent source packages

Status 18 October 2026: **country guard APPLIED** to canonical DEV as migration `20261018075854`; exact body readback, ACL and unchanged closure digests verified. Regional core **NOT APPLIED / NOT WIRED**. CI [39109590162](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39109590162) passed on source `48eae637`. Receipt: `supabase/operations/dev-alpha/ledger/20261018075854_worker_city_country_guard.receipt.json`. The pre-existing live/certified closure mismatch remains unresolved; no recertification occurred.

## 1. Country guard for the existing matcher

`country-guard.candidate.sql` changes exactly the fallback used when distance cannot be computed. An identical city label is sufficient only when both sides have the same explicit, non-null country code. Unknown country fails closed. The measured-distance branch, REMOTE bypass, taxonomy scope, service, exclusions and time are byte-identical to the captured predecessor. This does not solve two same-named places in one country, multiple work areas, routes or countrywide dispatch.

`live-worker-need-fit.sql` is the canonical DEV function read on 18 October 2026, with a terminating SQL semicolon added. Body MD5 `74de2072260579799b651aa69f84cecb`. Do not substitute the older October 10 matcher: it lacks the current signed-scope and taxonomy gates. Rebuild the forward/revert pair with `node supabase/candidates/worker-coverage-20261018/build-country-guard.mjs`. Both transactions guard predecessor hash, preserve function owner/ACL/security/settings and abort if the closure digest changes. No business rows or notification events are written.

Read-only DEV preflight found zero active workers without a country, and one non-REMOTE task without a country. This is an aggregate observation, not permission to alter that task. Before deployment, check current drift and the precise impact without returning private task/profile content. A missing-country task will no longer match solely by a city label; it needs a genuine location confirmation.

## 2. Regional geometry foundation — NOT integrated or deployable as a feature

`coverage-core.candidate.sql` is a private, owner-only geometry library with an empty versioned region catalogue. **No profile save, public RPC, AI prompt, existing matcher or candidate stream calls it.** Do not enable a regional UI or claim that the live app accepts “all Serbia” on the strength of this package.

Input `p_areas` is an array of up to 32 normalized selections:

```json
[
  {"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":45.26,"longitude":19.84,"radiusKm":20},
  {"kind":"ADMIN_REGION","countryCode":"RS","catalogVersion":"reviewed-catalog-version","regionId":"canonical-region-id"},
  {"kind":"COUNTRY","countryCode":"RS"}
]
```

These are alternative coverage choices; a country selection deliberately covers the whole confirmed country. The examples are structural examples, not imported catalogue entries or confirmed user choices. A model cannot grant itself authority by sending `confirmed:true`; unknown fields are refused. The future caller must derive selections from the owner's current signed review, restrict them to the matching service and ON_SITE mode, and resolve country identities on the server. Home city and bio text are never coverage authority.

`p_points` contains public/coarse execution points only, each with `countryCode`, `latitude`, `longitude`, `uncertaintyMeters`. Server-derived uncertainty must include rounding and resolver uncertainty. Do not send private addresses or raw private witnesses: extra fields are refused. Zero uncertainty is for genuinely exact synthetic/math cases; never turn a two-decimal coordinate into zero-uncertainty evidence.

- STATIONARY requires exactly one point; POINT_TO_POINT exactly two; MULTI_STOP 2–32. Every working stop must be covered by at least one selected area. This is **working-stop coverage**, not proof that every road segment lies inside the territory.
- Remote returns `area:true,state:NOT_REQUIRED` without a city or circle. It still needs normal service/mode, time, ownership and restriction checks by the real matcher.
- Administrative IDs are pinned to an exact catalogue version and country. Missing/stale versions are `CATALOG_UNAVAILABLE`. All entries are validated, including ones another broad selection would make redundant.
- Region boundaries include exact edge points. For uncertain points, the entire uncertainty disk must fit inside one choice. A disk crossing an edge produces `LOCATION_REQUIRED`. A union of adjacent areas is conservative: if no single choice covers the disk, the result stays pending; no silent expansion.
- AREA_BASED stays `LOCATION_REQUIRED` until a full-footprint contract is implemented. It is never reduced to a centroid.
- The result uses `area`, not `matches`: geography alone proves no service fit. `matchedAreasByPoint` contains selection indexes for a future truthful UI explanation, not coordinates.

The empty catalogue carries source URI and license metadata, valid MultiPolygon geometry, country, immutable version identity and a GiST index. No real boundaries, provider data or license are imported. A vetted loader must enforce version immutability and check country/geometry consistency, holes, disputed borders and dateline handling before real data is eligible. This library is not a geocoder.

New private tables are part of the closure digest. This regional candidate therefore requires a dedicated reviewed integration/recertification package and owner approval. Its revert refuses a nonempty catalogue and has no CASCADE. Never use it to erase a populated catalogue.

## Proof scope

Workflow `.github/workflows/worker-coverage-proof.yml` uses an isolated PostGIS 16/3.5 container, synthetic identities and fictional polygons only. The country regression must fail before the patch, pass afterwards, revert to the exact predecessor and pass on reapply. The geometry corpus checks separated centers, every route stop, country identity, version mismatch, holes, borders, uncertainty, malformed/oversized payloads and absence of public execution/table grants. Fixture transactions roll back.

The existing minimal fixture stubs time/world/identity/taxonomy and closure; it **does not certify those systems**. No DEV writes, paid Gemini/geocoder calls, push sends or private profile rows are used by CI. A successful run is not proof of natural-language extraction, correct Serbian boundaries, signed profile persistence, dispatch scale, or notification delivery.

## Required integration before exposing this to people

1. Resolve offered coverage phrases to verified country/city/region identities. Preserve ambiguity as a question; never convert Vojvodina to a 200 km circle.
2. Extend the versioned candidate, exact client decoders, signed review digest, base hash and atomic profile save together. Coverage is per service where appropriate, separate from home city. Old clients retain their existing contract.
3. Add account-bound storage with RLS/ACL, export, erasure and closure recertification; no standalone ownerless `confirmed` setter.
4. Derive complete public work points/footprints bound to the current task revision, respecting uncertainty and privacy.
5. Change `private.candidate_profile_ids`: the current 300 km single-point prefilter would omit a countrywide worker before matching. Union spatial and region/country candidates, deduplicate before the cap, and apply the same fit rule; prove bounded load and fairness.
6. Wire the shared matcher, discovery and dispatch together. Prove profile edit/requeue idempotency, no duplicate event and existing push preference gates.
7. Show one review: offered services, how each is performed, actual work coverage, optional time. Let corrections happen through conversation. Show pending location/catalog honestly; no tools/vehicles questionnaire as a matching gate.
8. Test the full signed save on the emulator; then one authorized real AI flow and one authorized target notification. Only then claim end-to-end support.

Primary references: [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis), [PostGIS ST_Covers](https://postgis.net/docs/ST_Covers.html), [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html). Provider `place_id` is not a durable region identity; the current location adapter returns candidate hints, not this catalogue.
