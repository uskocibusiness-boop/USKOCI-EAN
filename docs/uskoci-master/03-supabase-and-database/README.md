# 03 — Supabase & Database Architecture

## 1. Pregled šeme (`public` i `private`)

Baza podataka na projektu `leqcwgzvjsxugfgzdmth` koristi strogu podelu na:
- **`public.*` tabele:** Čitljive klijentu isključivo kroz RLS politike (`SELECT`), dok su direktni `INSERT`, `UPDATE` i `DELETE` opozvani (`REVOKE`) za `anon` i `authenticated`. Svaka izmena ide kroz `SECURITY DEFINER` RPC funkcije i zaštićena je okidačima (`trg_guard_need_write`, `trg_guard_response_write`, `trg_guard_agreement_write`, `trg_guard_execution_write`, `trg_guard_app_profile_write`).
- **`private.*` tabele:** Potpuno zaključane za direktan pristup klijenta (`REVOKE ALL FROM PUBLIC, anon, authenticated, service_role`), dostupne samo kroz serverske `SECURITY DEFINER` funkcije.

---

## 2. Kanonska mapa tabela

| Domen | Tabele u `public` | Tabele u `private` | Ključne RPC funkcije |
|---|---|---|---|
| **Nalozi i Profili** | `app_accounts`, `app_profiles`, `worker_match_preferences`, `profile_availability_rules`, `profile_availability_windows` | `worker_calendar_events`, `worker_execution_mode_choices`, `worker_service_region_coverage_v1` | `rpc_get_public_profile`, `rpc_set_worker_availability`, `rpc_save_worker_availability`, `rpc_update_requester_identity` |
| **Zadaci (Needs)** | `needs` (kolonska `SELECT` dozvola na 29 javnih kolona), `need_sensitive` (tačna adresa/pin), `need_geography`, `need_requirement_details` | `task_replacements`, `need_remaining_search_closures`, `dispatch_schedule` | `rpc_list_open_tasks_v3`, `rpc_publish_need_canonical`, `rpc_cancel_need`, `rpc_close_remaining_search`, `rpc_reopen_remaining_search` |
| **Prijave i Izbor** | `marketplace_responses`, `marketplace_response_versions`, `need_selections`, `opportunity_deliveries`, `dispatch_rounds` | `response_submit_commands`, `response_withdraw_commands`, `response_application_snapshots` | `rpc_submit_response`, `rpc_withdraw_response`, `rpc_list_need_candidates_page`, `rpc_select_response`, `rpc_resolve_changed_response` |
| **Dogovori i Izvršenje** | `agreements`, `agreement_versions`, `agreement_change_proposals`, `agreement_execution`, `access_grants`, `agreement_reviews` | `agreement_review_comments_v1`, `agreement_location_snapshots_v5` | `rpc_get_agreement_workspace`, `rpc_propose_agreement_change_v2`, `rpc_cancel_agreement`, `rpc_mark_work_done`, `rpc_confirm_completion`, `rpc_report_problem`, `rpc_submit_agreement_review_v2` |
| **Razgovori (Chat)** | `agreement_messages` | `group_conversations_v5`, `group_members_v5`, `group_messages_v5`, `agreement_photo_assets_v5`, `agreement_voice_assets_v1` | `rpc_send_agreement_message_v2`, `rpc_send_agreement_photo_message_v5`, `rpc_send_agreement_voice_message_v1`, `rpc_send_group_message_v5`, `rpc_read_group_messages_v5` |
| **AI Razgovori i Pregled** | `ai_conversations`, `ai_messages`, `ai_structured_facts`, `ai_action_proposals` | `ai_need_turn_commands`, `ai_task_reviews`, `ai_task_review_commands`, `worker_ai_sessions`, `worker_ai_turns`, `worker_ai_reviews`, `worker_ai_saves` | `rpc_ai_claim_need_turn_v2_service`, `rpc_ai_complete_need_turn_v2_service`, `rpc_prepare_ai_task_review_taxonomy`, `rpc_accept_ai_task_review`, `rpc_prepare_worker_ai_review_taxonomy_confirmed`, `rpc_save_worker_ai_review` |
| **Taksonomija** | *(Nema javnih tabela)* | `work_taxonomy_control`, `work_taxonomy_categories`, `work_taxonomy_category_modes`, `work_taxonomy_aliases`, `work_taxonomy_relations`, `work_taxonomy_gemini_turn_hints_v1`, `work_taxonomy_postsave_outbox_v1`, `work_taxonomy_review_batches_v1`, `work_taxonomy_worker_capabilities`, `taxonomy_confirmed_worker_modes_v1`, `work_taxonomy_need_snapshots` | `rpc_taxonomy_query_catalog_service`, `rpc_taxonomy_capture_gemini_turn_hints_service`, `rpc_taxonomy_commit_reviewed_batch_service`, `rpc_taxonomy_bind_ready_reviews_service` |
| **Obaveštenja i Push** | `user_activity_events`, `notification_deliveries`, `notification_preferences`, `notification_push_devices`, `notification_push_attempts` | `processor_provider_inventory` | `rpc_list_inbox`, `rpc_mark_activity_event_read`, `rpc_set_push_device_owned`, `rpc_claim_push_transport`, `rpc_complete_push_transport` |

---

## 3. Spremnost za Supabase promenu dozvola (30.10.2026.) — OBAVEZNA AKCIJA

Od **30.10.2026.** Supabase menja podrazumevane `GRANT` privilegije za tabele u `public` šemi. Forenzičkim pregledom svih 188 migracija utvrđeno je da sledeće `public` tabele imaju uključen RLS i `REVOKE INSERT, UPDATE, DELETE`, ali **nemaju eksplicitan `GRANT SELECT ... TO authenticated`** u migracijama:

1. `public.marketplace_responses`
2. `public.marketplace_response_versions`
3. `public.need_selections`
4. `public.agreements`
5. `public.agreement_versions`
6. `public.agreement_execution`
7. `public.user_activity_events` *(kritično: `activityApplicationTargetService.ts` radi direktan `.from('user_activity_events').select(...)`)*
8. `public.ai_structured_facts`
9. `public.worker_match_preferences`
10. `public.dispatch_rounds`
11. `public.opportunity_deliveries`

**Rešenje (P0 migracija):** Dodati jednu čistu forward migraciju koja eksplicitno izvršava `GRANT SELECT ON TABLE ... TO authenticated;` za navedenih 11 tabela (uz očuvanje kolonske `SELECT` dozvole na `public.needs`).
