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
Preview backend: uskoci-alpha (wjxilkkyyuxyzbvhgmop).
Browser ships only a Supabase publishable key.
Edge endpoint: uskoci-web-account-close.
Endpoint validates a real user session, accepts approved Origins, requires ZATVORI NALOG, performs r478 preparation, storage cleanup, Auth deletion and finalization, and reports CLOSED only on confirmed completion.

## Before uskoci.rs production cutover
1. Confirm the store backend project for rs.uskoci; update delete-account.js if production differs from uskoci-alpha.
2. Final legal review and any operator/business address required by applicable law.
3. Confirm production processor/AI provider list and mirror it in Privacy + Data Safety.
4. Confirm age target/content rating.
5. Verify report + block and AI-content reporting in the production app.
6. Remove noindex and set robots.txt Allow: /.
7. Run link, mobile, reduced-motion, keyboard and contrast checks.
8. Test deletion with a disposable production-like account: login -> phrase -> CLOSED -> login fails.
9. Deploy to the existing uskoci-web project; keep uskoci.rs attached.
