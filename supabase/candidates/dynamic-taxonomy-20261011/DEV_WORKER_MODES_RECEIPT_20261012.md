# USKOČI — explicit worker execution modes, owner-approved DEV receipt

**Target:** `leqcwgzvjsxugfgzdmth` DEV, not production. **Recorded migration:** `20261012001052_uskoci_worker_explicit_execution_modes_20261012`.

User's taxonomy rule: **Na lokaciji** vs **Na daljinu** are the two first-class execution modes and may be chosen independently of concrete service skill identity. A worker must explicitly state which mode they want; a skill name alone is NOT remote consent.

## Verified implementation

- `private.worker_execution_mode_choices`: new private RLS-enabled table bound to real `public.app_profiles(id)` and `public.app_accounts(id)`, constrained to exactly `ON_SITE`, `REMOTE`, or both. No default mode for any preexisting worker.
- `public.rpc_get_worker_execution_modes(worker_profile_id)` and `public.rpc_set_worker_execution_modes(worker_profile_id,modes[])`: server-owned Postgres `auth.uid()` identity; worker profile must belong to that account, and saves require DRAFT or ACTIVE worker status, an explicit canonical nonduplicate array, and an existing Auth session. Requester/other-user/suspended identity attempts rejected.
- Both RPCs are SECURITY DEFINER because they access private schema, with `search_path=pg_catalog`, direct private table rights revoked. Explicit default `public` grants to `anon`, `service_role` and `PUBLIC` revoked; EXECUTE only `authenticated`. Private table cannot be SELECTed by authenticated or written by service_role.
- Return body includes `matchingAuthority='NONE'` and `notificationAuthority='NONE'` because the current dispatcher has NOT been integrated with these modes.
- CI [PG16/17 worker owner-bound proof 38186783684](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/38186783684) **2/2 PASS** under mocked authenticated JWT sessions; covered absent default, remote-only, on-site-only, combined mode, other-account rejection, requester rejection, duplicate/invalid arrays, suspended worker, raw table access forbidden, duplicate install fails closed.
- Live Supabase `apply_migration` returned success; live readback `migration count 245`, `worker_execution_mode_choices records=0`, RLS=true, authenticated EXECUTE=true for both; anon/service false for both, and no direct private table access for either authenticated or service INSERT.
- Live before/after existing `needs=7`, `opportunity_deliveries=0`, canonical matcher MD5 `1e698d3d22c887f639e4837a4e588d01`, registry auto-registration OFF; no existing worker choices auto-assigned.

## Release blockers — no overclaiming

1. **The worker-profile UI does not yet call these RPCs**, so this is not yet a tappable choice on the phone. UX must present explicit ON_SITE/REMOTE choices and read the saved state.
2. `WORKER_PROFILE_V1` Gemini patch schema still supports existing skill arrays and city/radius and does **NOT** carry authoritative execution-mode selection. AI may suggest but not auto-save remote consent.
3. Canonical matcher/dispatch does **NOT** check `private.worker_execution_mode_choices` yet. This prevents side effects during dark launch, but also means old matching is NOT yet respecting the new mode preference. A guarded, separate migration and real end-to-end delivery proof are required before enabling.
4. Consent is separate from capability UUID confirmations (currently zero) and from availability/calendar. Remote-only worker legacy profile still requires city before activation: separate workflow/product revision required.
5. No Gemini/HTTP user session, provider push or HONOR phone proof performed. CI fake Auth role fixtures test SQL boundaries only.

Source: `dev-worker-mode-consent-rpc.sql`, `disposable-worker-mode-auth-fixture.sql`, `disposable-worker-mode-owner-assert.sql`, `.github/workflows/worker-execution-mode-owner-proof.yml`.
