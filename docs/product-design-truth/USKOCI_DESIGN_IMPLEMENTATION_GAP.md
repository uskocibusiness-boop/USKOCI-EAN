# ISTORIJSKA REFERENCA — nije aktivan dizajn canon

Označeno 18.10.2026. **Aktuelni izgled i UX definiše [USKOČI Premium White](../implementation/design-system/PREMIUM_WHITE_CANON.md).** Donji tekst je sačuvan kao datirano poreklo. Njegove ranije reči „current“, „locked“, „rulebook“, obavezna geometrija, ručni editori i proceduralna odobrenja nisu sadašnja uputstva. Poslovne zaštite opstaju kroz aktuelne ugovore; stare tvrdnje o implementaciji nisu današnji status.

[Forenzička klasifikacija pravila i testova](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Status proizvoda ostaje u postojećem registru i LIVE planu.

---

## Sačuvan prethodni dokument

# USKOČI Design → Implementation Gap

Baseline: canonical `38e9a38`, live migrations 87/87, Edge `uskoci-ai-interview` v11 ACTIVE/JWT. Open PRs are candidates only.

## READY

- **S01 Splash / brand introduction** — IMPLEMENTED. Route: /auth. Backend: auth session.
- **S03 Authentication** — IMPLEMENTED. Route: /auth. Backend: auth.users, app_accounts, app_profiles.
- **S06 Notifications / Inbox** — IMPLEMENTED. Route: /obavestenja. Backend: user_activity_events, notification_deliveries, rpc_list_inbox, rpc_resolve_inbox_target.
- **D03 Agreement chat** — IMPLEMENTED. Route: /dogovor/[id] embedded. Backend: agreement_messages, rpc_send_agreement_message, D03 retry receipts.

## PARTIAL

- **S02 Intent / role explanation** — PARTIAL. Route: /auth. Backend: app_accounts.active_mode, entry intent local state.
- **S10 Support / report case** — PARTIAL. Route: none. Backend: rpc_report_problem, agreement_execution.problem_open.
- **R02 AI Need creation** — PARTIAL. Route: /nova. Backend: ai_conversations, ai_messages, ai_structured_facts, uskoci-ai-interview.
- **R04 Need full detail / workspace** — PARTIAL. Route: /potrebe/[id]/pregled. Backend: needs, need_geography, need_requirement_details, need_sensitive, marketplace_responses.
- **R06 Public worker profile** — BACKEND READY / UI PARTIAL. Route: none. Backend: rpc_get_public_profile.
- **R07 Need structured review** — PARTIAL. Route: /pregled-nacrta. Backend: ai_structured_facts, need_draft_save_commands, needs.
- **W03 Zadaci discovery / opportunities list and map** — PARTIAL / PR67 SOURCE-PROVEN. Route: /prilike (canonical list only). Backend: needs public projection, need_geography, opportunity_deliveries.
- **W04 Opportunity full detail** — PARTIAL / PR68 SOURCE-PROVEN. Route: /prilike/[id]. Backend: needs, need_geography, need_requirement_details, rpc_get_public_profile.
- **W08 Worker profile editor** — PARTIAL. Route: /profil/radnik. Backend: app_profiles, rpc_complete_worker_profile.
- **D02 Agreement overview** — IMPLEMENTED / PARTIAL. Route: /dogovor/[id]. Backend: agreements, agreement_versions, need_selections, access_grants, agreement_execution.
- **D04 Agreement timeline** — PARTIAL. Route: /dogovor/[id] embedded. Backend: agreement versions, user_activity_events, projection timeline.
- **D05 Change proposal / cancellation / problem** — PARTIAL. Route: /dogovor/[id] embedded. Backend: agreement_change_proposals, agreement_versions, rpc_propose_agreement_change_v2, rpc_respond_agreement_change, rpc_cancel_agreement, rpc_report_problem.
- **M01 Full-screen map** — PARTIAL / PR67 PENDING. Route: none. Backend: need_geography, public opportunities.
- **M02 Map pin compact sheet** — PARTIAL / PR67 PENDING. Route: none. Backend: public opportunity projection.
- **P01 Profile hub** — PARTIAL. Route: /profil. Backend: app_accounts, app_profiles.
- **P02 Personal/requester profile edit** — PARTIAL. Route: /profil (limited). Backend: app_profiles REQUESTER.
- **P03 Skills, tools, licenses, vehicles** — PARTIAL. Route: none. Backend: app_profiles, response_application_snapshots.

## MISSING

- **S04 Password recovery / confirmation** — NOT IMPLEMENTED. Route: /auth (gated notice). Backend: Supabase Auth recovery.
- **S05 Permissions primer** — NOT IMPLEMENTED. Route: none. Backend: device permissions, notification_push_devices.
- **S07 Settings hub** — MISSING. Route: none. Backend: notification_preferences, app_accounts.
- **S08 Notification preferences** — BACKEND READY / UI MISSING. Route: none. Backend: notification_preferences, rpc_get_notification_preferences, rpc_set_notification_preferences.
- **S09 Privacy & data rights** — NOT IMPLEMENTED. Route: none. Backend: account/data lifecycle not present.
- **S11 Account & closure** — NOT IMPLEMENTED. Route: none. Backend: auth.sessions, app_accounts, account lifecycle missing.
- **W02 AI Worker profile** — NOT IMPLEMENTED. Route: none. Backend: app_profiles, worker_match_preferences, AI profile infrastructure missing.
- **W09 Availability & calendar** — BACKEND PARTIAL / UI MISSING. Route: none. Backend: profile_availability_rules, profile_availability_windows, worker_match_preferences, agreements.
- **D06 Completion & review** — PARTIAL / REVIEW MISSING. Route: /dogovor/[id] embedded. Backend: agreement_execution, rpc_mark_work_done, rpc_confirm_completion, review tables missing.
- **Q01 Search** — NOT IMPLEMENTED. Route: none. Backend: opportunity projection/search endpoint missing.
- **Q02 Filters** — NOT IMPLEMENTED. Route: none. Backend: worker_match_preferences, opportunity projection.
- **P04 Reputation & reviews** — NOT IMPLEMENTED. Route: none. Backend: review infrastructure missing; public projection exposes availability flags.
- **P05 Verification & trust** — NOT IMPLEMENTED. Route: none. Backend: verification provider/storage missing.
- **C01 Calendar overview** — BACKEND PARTIAL / UI MISSING. Route: none. Backend: agreements, profile_availability_*.
- **MEDIA01 Need photo capture/gallery** — NOT IMPLEMENTED. Route: none. Backend: storage bucket/schema missing.
- **VOICE01 Voice Need input** — NOT IMPLEMENTED. Route: none. Backend: speech/transcription service missing, same AI conversation.

## NEEDS_REDESIGN

- **R03 My Needs list** — IMPLEMENTED / NEEDS REDESIGN. Route: /potrebe. Backend: needs, requester projection.
- **R05 Candidates / selection** — IMPLEMENTED / NEEDS REDESIGN. Route: /potrebe/[id]/kandidati. Backend: marketplace_responses, marketplace_response_versions, response_application_snapshots, need_selections, agreements.
- **W05 Application composer** — IMPLEMENTED / NEEDS REDESIGN. Route: /prilike/[id]/prijava. Backend: rpc_submit_response, marketplace_responses, marketplace_response_versions, response_application_snapshots.
- **W06 My Applications** — IMPLEMENTED / NEEDS REDESIGN. Route: /moje-prijave. Backend: rpc_list_my_applications, rpc_withdraw_response.
- **D01 Agreements list / shell** — IMPLEMENTED / NEEDS REDESIGN. Route: /dogovori. Backend: rpc_list_my_agreements.

## BACKEND_BLOCKED

- **H01 HITNO explanation / activation** — CONFIG-DISABLED. Route: none. Backend: needs.urgent, dispatch_schedule, marketplace_config, policy bundles.

## SUPERSEDED — excluded from the implementation backlog

- **R01 Former Naručilac Home** and **W01 Former Uskočer Home** are superseded by the owner-confirmed three-zone correction on 8 September 2026. Their absence is not a missing capability. Useful context belongs in Zadaci, Prijave, Dogovori and avatar → Profile.

## Cross-cutting implementation findings

- Owner-confirmed navigation: MENI TREBA = Zadaci | U / Novi | Dogovori; JA MOGU = Prijave | U / Zadaci | Dogovori. Bell → Inbox; avatar → Profile. No permanent Home/Profile tabs.
- Checked source `0e6951e` already implements the three-zone shell in `src/app/(app)/_layout.tsx`; it is aligned, not navigation debt. The final visual treatment and shared List/Map access inside Zadaci for both intents retain their separately recorded partial/pending status. This navigation-only correction does not refresh or promote unrelated feature/live statuses.
- Presentation screens mostly consume ports/projections. One material exception is the worker profile client service, which performs owner-scoped direct `app_profiles` writes inside the data layer; no screen itself writes Supabase.
- AI Edge authority, durable facts and draft save exist; actual OpenAI provider success with the current secret/model remains unproven.
- Push registry/preferences/event infrastructure exists; provider delivery and real device receipt remain unproven.
- Reviews, voice, media storage, identity verification, full settings/data rights and a hard calendar UI are absent.
- HITNO/dispatch foundations exist but must remain visibly gated until policy/config and end-to-end proof allow activation.
- Completion needs lifecycle hardening before design can treat replay and cancelled/superseded terminal behavior as closed.