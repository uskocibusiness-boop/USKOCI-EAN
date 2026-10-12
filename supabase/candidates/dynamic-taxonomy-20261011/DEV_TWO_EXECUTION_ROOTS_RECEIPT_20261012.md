# USKOČI — dve glavne grane izvršenja + hijerarhija, DEV receipt

**Zahtev vlasnika:** korisnik prvo bira **NA LOKACIJI** ili **NA DALJINU**. Tek unutar izabrane grane pregledava `kategorija → potkategorija → uža potkategorija → ...`. Nema fiksnog maksimuma dubine ili broja poslova.

**Target:** only USKOČI canonical DEV `leqcwgzvjsxugfgzdmth`. **Migracija:** `20261011233955_uskoci_taxonomy_two_execution_roots_20261012`; Supabase migration API returned success:true. This does NOT modify production.

## Verified against live DEV after installation

- `private.work_taxonomy_category_modes`: **14** records; 11 ON_SITE legacy family roots; 3 REMOTE starter roots (Digitalne usluge, Pisanje i jezici, Online podučavanje). These are initial folders, not the full universe of tasks.
- Catalog categories total: **14**. `auto_registration_enabled=false`; no live worker confirmed capability or classified task revision rows yet.
- `private.taxonomy_execution_scope_v1`: `STATIONARY`, `POINT_TO_POINT`, `MULTI_STOP`, `AREA_BASED` → `ON_SITE`; `REMOTE` → `REMOTE`. No existing task execution mode was overwritten.
- `private.taxonomy_browse_children_v1`: returns root and scoped direct children with stable IDs, `hasChildren`, paging and `notificationAuthority=NONE`. It cannot be invoked directly by `anon` / `authenticated`; service can read but not INSERT mode mappings.
- Canonical matcher `private.worker_need_fit_v1(uuid,uuid,boolean)` remains MD5 `1e698d3d22c887f639e4837a4e588d01` with 7 existing tasks, 0 new opportunity deliveries. Real dispatch still uses legacy eligibility, not browse tree identity.

## Isolated acceptance

[GitHub Actions run 38184935663](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38184935663), **PostgreSQL 16 PASS + PostgreSQL 17 PASS**, exact migration plus isolated fixture. Tests verify:
1. All five canonical execution-location values fold into exactly two top-level modes.
2. Both root browse listings and pagination return the expected modes.
3. Remote branch `Digitalne usluge → Grafički dizajn → Izrada logotipa` and physical branch `Molerski radovi → Krečenje → Krečenje zidova` traverse correctly across several levels.
4. Parent category from wrong mode cannot be read as part of the other mode.
5. No provider push, worker capability assignment, job publishing or automatic registration; unsafe direct DML and repeated installation denied.

**Important distinction:** demo sub/subcategory rows were inserted ONLY in disposable CI fixture. On real DEV we installed root category anchors, not arbitrary new live service classifications.

## Still pending — not concealed by schema deployment

- Existing AI interview for customer + worker needs UX for primary ON_SITE vs REMOTE and reviewed nested service identity, with undo/edit rules.
- New-category creation must atomically bind a category and execution mode and task revision, pass semantic/risk duplicate checks and user confirmation. Current registrar `taxonomy_register_low_risk_v1` lacks mode parameter and remains OFF; no orphan categories.
- Worker must review and explicitly confirm the exact capability and allowed delivery modes; parent category alone never authorizes any leaf match.
- Full matching/dispatch adaptation must preserve service competency, hard skills, location only on physical jobs, time, blocks, privacy, open capacity and notification consent; two root browse functions give **ZERO push authority**.
- Category mode hierarchy integrity (cycle checking, same-scope parent) must be added before granting any runtime write permissions.
- Real HTTP/RLS + application lifecycle + FCM phone proof + new APK remain separate release gates.

**Source:** `dev-execution-scopes-two-root.sql`, `disposable-execution-two-roots-assert.sql`, `.github/workflows/taxonomy-two-root-execution-proof.yml` and `docs/architecture/USKOCI_TWO_EXECUTION_ROOTS_20261012.md`.
