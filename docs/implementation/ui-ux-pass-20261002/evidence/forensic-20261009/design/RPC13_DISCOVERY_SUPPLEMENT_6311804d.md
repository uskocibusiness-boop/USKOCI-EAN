# Dodatak:13 RPC stavki i stvarni Discovery loading

**SOURCE samo.** Bez backend poziva, novih testova, uređaja ili izmene repozitorijuma.

##13stavki nisu13nedostajućih funkcija

No real missing user capability established solely from these13 entries. Static direct-call absence is not unused-system proof. Do not delete functions on this basis.

| RPC | Klasifikacija | Obrazloženje / izvor |
|---|---|---|
| `rpc_agreement_invalidation_visible_v1` | INTERNAL_GUARD | RLS predicate for realtime invalidation table; client subscribes to INSERT/UPDATE, not direct RPC. `supabase/candidates/chat_b3c_private_invalidation.sql:100`, `supabase/candidates/chat_b3c_private_invalidation.sql:122`, `src/data/agreementInvalidationService.ts:152` |
| `rpc_ai_open_conversation` | SUPERSEDED_WRAPPER | Legacy generic AI opener. NEED uses owned v2 opener; worker uses rpc_open_worker_ai. No missing screen follows from absence of legacy direct call. `supabase/migrations/20260829184024_clean_rpc_ai_intake.sql:4`, `src/data/aiNeedV2Production.ts:314`, `src/data/workerAiClientService.ts:154` |
| `rpc_ai_open_need_conversation_v2` | SUPERSEDED_WRAPPER | No-argument opener replaced at client boundary by rpc_ai_open_need_conversation_owned_v2 with clientRequestId. `supabase/migrations/20260903190000_clean_ru2_need_v2_draft.sql:429`, `src/data/aiNeedV2Production.ts:314` |
| `rpc_ai_read_need_location_turn_v1` | ALTERNATIVE_INTERNAL_EDGE_PATH | Authenticated document reader is not the client recovery path. Edge uses service variant over the same private document; client has read/recover_need_turn_v2. Not evidence location conversation is missing. `supabase/operations/dev-alpha/ledger/20261002185306_dev_alpha_ai_location_01_contextual_map_dialogue.sql:111`, `supabase/operations/dev-alpha/ledger/20261002185306_dev_alpha_ai_location_01_contextual_map_dialogue.sql:119`, `supabase/functions/uskoci-ai-interview/index.ts:793`, `src/data/aiNeedV2Production.ts:353`, `src/data/aiNeedV2Production.ts:360` |
| `rpc_authorize_data_export_download` | INTERNAL_EDGE | Actually used by export download Edge; not supposed to be a direct UI command. `supabase/functions/uskoci-data-export-download/index.ts:11` |
| `rpc_closure_api_guard` | INTERNAL_GUARD | PostgREST pre-request hook; absence of client invocation is correct. `supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql:275`, `supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql:277`, `supabase/migrations/20260913045824_clean_v5_support_case_authority.sql:494`, `src/data/accountClosingStanding.ts:15` |
| `rpc_confirm_need_edit` | SUPERSEDED_CLIENT_ENTRY | Older material edit entry is not the UI submit contract; current reviewed edit calls rpc_confirm_need_edit_from_review_v2 with expected revision. Classification does not authorize deleting older SQL function or dependencies. `supabase/migrations/20260904214500_clean_ru4_owner_edit_lock.sql:305`, `src/data/aiNeedV2Production.ts:453`, `src/data/aiNeedV2Production.ts:465` |
| `rpc_get_my_safety_report` | ALTERNATIVE_RECEIPT_READER | Returns only reportId/received/createdAt/authoritative, not a richer case status UI. Client recovers exact submission by clientRequestId and has support-case context path. No distinct missing user capability established by unused getter. `supabase/migrations/20260912091000_clean_pre_v3_safety_authority.sql:164`, `supabase/migrations/20260912091000_clean_pre_v3_safety_authority.sql:172`, `src/data/safetyClientService.ts:107`, `src/data/supportCaseClientService.ts:213` |
| `rpc_get_push_device` | SUPERSEDED_WRAPPER | Owned variant includes expected user identity and token; generic read not required on screen. `src/data/pushDeviceClientService.ts:44` |
| `rpc_list_my_agreements` | SUPERSEDED_WRAPPER | Client uses paged agreements reader, not the unpaged predecessor. `src/data/agreementClientService.ts:588` |
| `rpc_send_agreement_message` | SUPERSEDED_WRAPPER | Current text send uses v2; photos use v5 and voice its specific protocol. Do not duplicate send action. `src/data/agreementMessageClientService.ts:48`, `src/ui/messages/threadModel.ts:177` |
| `rpc_storage_account_open` | INTERNAL_GUARD | RLS closure fence on storage and user tables. Invoked by policy, not a user capability. `supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql:297`, `supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql:302`, `supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql:308` |
| `rpc_submit_classified_preselection_qa` | INTERNAL_EDGE | uskoci-qa-classify commits classified preselection Q&A via RPC. It is actually used indirectly, not a missing public form. `supabase/functions/uskoci-qa-classify/index.ts:219` |

Klasifikacija je o ulozi API-ja u aktuelnom izvoru. Ne znači da je svaka server funkcija primenjena/verifikovana danas, niti da je stari wrapper slobodan za brisanje. Safety getter sam nije istorija slučaja; location reader ima servisnu putanju; prava korisnička praznina mora se dokazati tokom, ne imenom u listi.

## Šta se vidi dok Discovery kasni

### Cold first open, no accepted snapshot

Loading StateView with task skeleton and Učitavamo zadatke. No prior map/list to retain. Failure replaces skeleton with error/retry.

Izvori: `src/ui/v2/discovery/DiscoveryV1Screen.tsx:76`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:270`, `src/ui/v2/discovery/DiscoveryListState.tsx:47`

### Explicit refresh or non-warm restore

loading=true empties presentation mapped/list; mapShown=false draws neutral ground. Skeleton in sheet, not old rows. After success new list/map returns; true empty has compact empty state over map.

Izvori: `src/ui/v2/discovery/DiscoveryV1Screen.tsx:98`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:199`, `src/ui/v2/DiscoveryPresentation.tsx:440`, `src/ui/v2/DiscoveryPresentation.tsx:570`, `src/ui/v2/DiscoveryPresentation.tsx:1218`, `src/ui/v2/DiscoveryPresentation.tsx:1333`

### Filter/search apply or user pans map

execute default busy=false; coordinator retains last complete snapshot until new read applies. Filter askedView changes immediately while rows/markers can still be old. No explicit refreshing state is sent for this wait. Delayed result is not blank, but old results can look current under new conditions.

Izvori: `src/ui/v2/discovery/DiscoveryV1Screen.tsx:190`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:195`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:245`, `src/data/discoveryV1RouteCoordinator.ts:57`, `src/data/discoveryV1RouteCoordinator.ts:63`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:277`

### Next page

Existing rows remain; presentation contains a polite floating paging label when loadingMore reaches it. Coordinator sets mutable loadingMore before await but route commits after await; no immediate notification at this assignment. Indicator is not guaranteed without an unrelated optional commit. Need deferred-promise render test, not assume it shows just because component exists.

Izvori: `src/data/discoveryV1RouteCoordinator.ts:268`, `src/data/discoveryV1RouteCoordinator.ts:287`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:256`, `src/ui/v2/discovery/DiscoveryV1Screen.tsx:103`, `src/ui/v2/DiscoveryPresentation.tsx:1271`, `src/ui/v2/DiscoveryPresentation.tsx:1412`

### RPC error/timeout after prior results

General error=true empties mapped/list and hides map. Error says Ne možemo da učitamo zadatke / Proveri internet vezu i pokušaj ponovo, with explicit retry. This can misattribute server timeout to internet. Source does not preserve a dim stale list after error.

Izvori: `src/ui/v2/discovery/DiscoveryV1Screen.tsx:104`, `src/ui/v2/DiscoveryPresentation.tsx:440`, `src/ui/v2/DiscoveryPresentation.tsx:570`, `src/ui/v2/discovery/DiscoveryListState.tsx:27`, `src/ui/v2/discovery/DiscoveryListState.tsx:48`

### Slow or superseded transport

Individual request deadline15s; abort/timeout reported, timer cleared, no transport retry. Coordinator has one explicit expired-anchor renewal, which is a separate behavior. Account/generation stale results are discarded.

Izvori: `src/data/discoveryV1ClientTransport.ts:16`, `src/data/discoveryV1ClientTransport.ts:27`, `src/data/discoveryV1ClientTransport.ts:32`, `src/data/discoveryV1RouteCoordinator.ts:274`

## Dve male, proverljive UX dorade

1. **P2 — novi uslovi uz stare rezultate bez indikatora.** Čuvanje prethodnih rezultata je dobro; dodati jasno osvežavanje i ne predstavljati stari count kao potvrđen za novi upit. Jedan deferred read test treba da potvrdi zadržan sadržaj + pending label, potom tačan replacement.
2. **P2 — paging indikator može da ne stigne do prikaza.** Mutable loadingMore se menja u coordinator-u, ali nema neposrednog commit-a. Deferred nextPage test treba da vidi signal pre razrešenja promise-a; zatim success/error/stale svi gase signal.

Dodatno: eksplicitni refresh sada uklanja mapu tokom učitavanja i RPC greške. To je stvarno source ponašanje, ne nova native reprodukcija. Stale-with-retry može biti bolji nastavak, uz nepromenjene scope/privacy zaštite. Transport timeout15s nije dokaz da baza završava za15s ili daUIzadovoljava performansni cilj.
