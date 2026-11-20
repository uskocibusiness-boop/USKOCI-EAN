# USKOČI — DEV urgency retirement evidence

**Date:** 2026-11-20  
**Environment:** Supabase DEV `leqcwgzvjsxugfgzdmth`  
**Source branch:** `work/urgency-retirement-dev-20261120`  
**Applied migration:** `20261120194323_retire_legacy_urgency_and_available_now_dispatch`

## Outcome

- Four Edge Functions were aligned with the active GitHub source and read back byte-for-byte:
  - `uskoci-worker-interview`: v163 → v164 (25/25 files exact; stale `workerNowFeature.ts` removed)
  - `uskoci-ai-interview`: v212 → v213 (24/24 files exact)
  - `uskoci-push-transport`: v49 → v50 (3/3 files exact)
  - `uskoci-taxonomy-postsave-worker`: v15 → v16 (3/3 files exact)
- `verify_jwt=false` was preserved for all four functions; no production project was changed.
- The DEV migration retired the urgent dispatch/matching/push/projection behavior across 16 functions.
- Both legacy public activation RPCs now raise `URGENT_FEATURE_RETIRED`; the legacy urgency reader returns `URGENCY_RETIRED`.
- Normal dispatch, calendar eligibility, matching, candidate caps, transaction budgets, deduplication and FIFO push ordering were preserved by guarded postimage checks.
- No historical columns, rows, user preferences, or profiles were deleted or rewritten.

## Preflight and postflight

- All 16 exact DEV function preimages, owners, ACLs, SECURITY DEFINER flags and search paths matched the candidate guards before execution.
- A full dry-run executed all 16 changes in one DEV transaction and ended with `ROLLBACK`; all postimage checks passed.
- The actual migration was then applied through the Supabase migration tool. The ledger contains version `20261120194323`.
- Independent readback confirmed all 16 postimage hashes below.
- The failed earlier attempt (before the main-function patch correction) rolled back; no partial database change or migration ledger entry remained.

## Function source hashes

| Function | DEV preimage MD5 | Applied postimage MD5 |
|---|---|---|
| `private.dispatch_next_wave(uuid)` | `bd1d2fd351d8273ddc0cce9e29514ca7` | `e6ef0105afda31ce120a0cde6626b0d6` |
| `private.dispatch_remote_wave_v1b(uuid,jsonb,jsonb,text,integer,integer,integer,integer,integer,integer,integer,integer)` | `2ba676d2f0fbd1456b48eb1ef36b468e` | `8227474bb353238ee09816ea5085666e` |
| `private.worker_notify_room_v1b(uuid,integer)` | `9aac9da0479327fdf82b2f9298e47719` | `e3e40bcc507bb0a99817d8cdd555dbcc` |
| `private.push_suppression(public.notification_deliveries)` | `ebd9c03035630bde62bf9fd8a27378c2` | `e9f104bc1a62aefd73d52fee8294c52d` |
| `private.match_detail_without_calendar(uuid,uuid)` | `41b54908d3f461420c3826ad8b723880` | `2f9e140d4e938f6c7dda8829d41dd04a` |
| `private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)` | `586c40786332a9863922585503f083f6` | `60ae03c2d6acf0f01b86a8470881f6e4` |
| `public.rpc_claim_push_transport(text)` | `7c9145f1b9696f9ed6e4a29949228b58` | `60d39927470ef866f7757212ea1ddfe1` |
| `public.rpc_begin_push_send(uuid,uuid)` | `e693b140450a9bb1cf6d3178b0ad80c1` | `c6b35e8fa0069acdc96a7be851a5ef5f` |
| `public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)` | `7c1d9a979585deae6c2bc2c1b9d597b1` | `8e8ee643e72c9efab746b6a9e7f6ec08` |
| `public.rpc_discovery_v1(jsonb)` | `c75535d3f77b2216ed424843ef57ef04` | `dc53bf4f14b1e35fdb1e12ff883d1edb` |
| `public.rpc_read_task(uuid)` | `1e01db5140248f27ab374187f01fded3` | `6989659ffc9d6445333ab06e6df9c597` |
| `public.rpc_get_worker_profile_for_edit()` | `0b081654ef574b197d978d31db362d68` | `fbb1c121f266200dc2d456e17ceac35f` |
| `public.fn_need_urgency(uuid)` | `8845c7ad50ab5e64aa853043c113a15a` | `1b59a466661a3c7400fcced26ad17f7d` |
| `public.rpc_activate_urgent(uuid,integer)` | `e3d13df0b0cf181334a30efa7576a312` | `fd0cfe668f4ee12451ab316ac46a6215` |
| `private.expire_lifecycle(timestamptz)` | `2e13f16eb5f760c1a8a3ebbf59fb60a9` | `52525fafc3bd45b1a6f751ebd0ea0c4e` |
| `public.rpc_urgent_activation_preview(uuid)` | `e0d15c6769a737e23041283d20f84db9` | `fd0cfe668f4ee12451ab316ac46a6215` |

## Data preserved

- Needs: 26 total; 0 urgent flags; 0 active urgent tasks.
- Dispatch rounds: 430, all `NORMAL`.
- Activity events: 56, all `NORMAL`.
- Notification deliveries: 56 `NORMAL` priority; no `HITNO` deliveries.
- Two profiles still retain historical `available_now=true`; three worker preferences retain the old same-day-urgent flag. These legacy values were intentionally preserved, but the updated matching/dispatch code no longer uses them as gates or ranking inputs.

## Tests

- Targeted local regression suite: **45/45 passed** across urgency retirement, public notification projection, saved-area dispatch, cooperative R13 dispatch and R06 provider dispatch retention.
- PostgreSQL 17 PL/pgSQL candidate parse test passed.
- Existing full QA workflow on base commit `062b2b69282f1f59c48065baef82d0ed36643e98` was successful (run [44771906694](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/44771906694)). The modified branch's targeted tests were run locally using the same archived QA runtime.
- Edge function package readback was exact. No synthetic user-facing Edge invocations were made in this pass, so end-to-end live delivery on a physical device remains a separate QA item.

## Rollback

The exact pre-retirement function definitions are preserved in:

- `scripts/sql/rollback_urgency_preimage_dispatch_20261120.sql`
- `scripts/sql/rollback_urgency_preimage_push_20261120.sql`
- `scripts/sql/rollback_urgency_preimage_projections_20261120.sql`
- `scripts/sql/rollback_urgency_preimage_activation_20261120.sql`

These are controlled rollback artifacts, not routine migrations. Restore only after reviewing the matching function metadata and current state.

## Scope

This work changed DEV only. No PROD deployment, data deletion, user preference reset, Android Play release, or iOS release was performed.
