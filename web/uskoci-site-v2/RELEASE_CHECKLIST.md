# USKOČI website V2 — release checklist (2026-10-09)

## Google Play coverage
- Privacy Policy: public HTML, app identity, privacy contact, categories, purposes, sharing, security, retention and deletion.
- Account deletion: in-app path + external authenticated web path.
- UGC: Terms define objectionable content; app must retain in-app report and block.
- AI: if generative AI is active in release, in-app reporting/flagging must remain available.
- Data Safety: must exactly match the production build.
- Location: distinguish approximate/public and precise/private; no background tracking claim.
- Public pages must be active, non-geofenced HTML, not PDF.

## Web deletion
Current V2 web candidate (branch work/uskoci-web-release-20261009) has **not** passed public release acceptance.
The candidate `delete-account.js` is configured for the existing canonical DEV/ALPHA endpoint `leqcwgzvjsxugfgzdmth`, **not** the older `uskoci-alpha` project `wjxilkkyyuxyzbvhgmop`.
The browser includes only a publishable Supabase key; it must never include privileged service credentials.
The candidate uses session-authenticated canonical RPC commands for account closure (not the older `uskoci-web-account-close` Edge route). Confirm the exact RPC/revision/idempotency and Auth/Storage/relational cleanup against the selected production backend.
**Safety gate:** `VERIFIED_PRODUCTION_ERASURE_ENABLED = false` and the host check deliberately block web sign-in/erasure even on `uskoci.rs`; previews are non-destructive. Do not present this as working external account deletion or flip the switch without disposable-account end-to-end proof on the isolated production backend.
The status `CLOSED` must be shown only after authoritative closure readback; a successful HTTP response alone is insufficient.

## Before uskoci.rs production cutover
1. Provision and approve the isolated production backend for `rs.uskoci`; do **not** point the store client or web erasure at current DEV (`leqcwgzvjsxugfgzdmth`) or the old alpha (`wjxilkkyyuxyzbvhgmop`). Verify the web/API endpoint, production project identity, Auth redirect/allowed Origins and consistent in-app/web account closure.
2. Final legal review and any operator/business address required by applicable law.
3. Confirm production processor/AI provider list and mirror it in Privacy + Data Safety.
4. Confirm age target/content rating.
5. Verify report + block and AI-content reporting in the production app.
6. Remove noindex and set robots.txt Allow: /.
7. Run link, mobile, reduced-motion, keyboard and contrast checks.
8. Test deletion with a disposable production-like account: login -> phrase -> CLOSED -> login fails.
9. Deploy to the existing uskoci-web project; keep uskoci.rs attached.
