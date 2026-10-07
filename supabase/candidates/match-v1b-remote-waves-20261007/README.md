# MATCH-V1B — remote tasks in waves + optional daily cap per worker (owner decisions 2026-10-07)

**Status: SOURCE ONLY, NOT APPLIED.** Canonical DEV `leqcwgzvjsxugfgzdmth` only on the owner's exact word **`PRIMENI MATCH-V1B`**, and only AFTER MATCH-V1 (it is a delta on top of it). Proof: `.github/workflows/match-v1b-remote-waves-proof.yml` (disposable database only; run @@RUN_ID@@). Files: `candidate.sql` (own transaction), `candidate.in-transaction.sql` (for a runner that wraps the text in its own transaction), `revert.sql`, `switch-remote-waves-on.sql`, `switch-remote-waves-off.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `manifest.json`, `body.diff` (the whole change of the one replaced function), `build_candidate.py` (generator, `--check` proves the files are exact).

## Za vlasnika (srpski)

1. **Šta se menja za zadatke bez mesta** (rad na daljinu, ili zadatak bez koordinata; to je slučaj sa oko 40.000 mogućih radnika): obaveštenja ne idu svima odjednom nego u talasima. Prvi talas je **300** radnika, svaki sledeći **1.000**, na svakih **30 minuta**, sve dok zadatak ima manje od **5 prijava** i dok nije dogovoren ili otkazan. Ukupna kočnica je **10.000** radnika po zadatku.
2. **Pravednost:** isti radnik dobija isti zadatak najviše jednom (po verziji zadatka). Redosled kreće od drugog radnika za svaki zadatak, pa isti ljudi nisu uvek prvi; radnik koji se naknadno javi ili promeni profil stiže u sledeći talas. Zadaci sa mestom i lestvica 5-5-10-20 ostaju kako su u MATCH-V1 (jedan talas svima u krugu, do plafona).
3. **Dnevna zaštita radnika, ISKLJUČENA po difoltu:** podešavanje `workerDailyCap` je **1000, što znači "isključeno"** (dozvoljeno 1 do 1000). Ako ga spustite na npr. 10, radnik koji je u poslednja 24 sata već dobio 10 obaveštenja o novim zadacima se preskače (ne troši mesto u talasu); i dalje vidi zadatak na mapi, u listi i u "Za mene". HITNO i sve ostale vrste obaveštenja se ne broje.
4. **Brojevi (probna baza, 40.000 radnika koji svi odgovaraju zadatku):** @@SUMMARY_NUMBERS@@
5. **Podešavanje bez izmene koda**, jedan red `match_v1_dispatch`, sedam vrednosti (tabela dole). Greška u vrednosti nije tiha: izlazi `DISPATCH_CONFIG_INVALID` i niko nije obavešten. Isključivanje talasa jednom skriptom (`switch-remote-waves-off.sql`) vraća zadatke bez mesta na ponašanje MATCH-V1 (svima odjednom do plafona).
6. **Primena i redosled:** ZONE-PERF (urađeno) → **MATCH-V1** (pa jedan red: plafon `ceiling` na 10.000) → **MATCH-V1B** (`PRIMENI MATCH-V1B`) → DISCOVERY-ZAMENE (V1B i DISCOVERY-ZAMENE traže MATCH-V1 i ne zavise jedno od drugog). Povratak obrnutim redom: DISCOVERY-ZAMENE → MATCH-V1B → MATCH-V1 → ZONE-PERF. Ništa se ne primenjuje bez vaše reči.

## What changes

- **A task WITHOUT a place** = `execution_location_mode = 'REMOTE'`, or a physical task that has no approximate point (`approx_geog is null`). Such a task is no longer sent to every admitted worker at once (MATCH-V1 mode ALL) but in **waves** by `private.dispatch_remote_wave_v1b`, called from `private.dispatch_next_wave` (mode ALL only; the ladder never reaches the new code):
  - **wave size:** the first wave notifies at most `remoteWaveSize` (300) workers, every later wave at most `remoteNextWaveSize` (1,000), always the NEXT workers of the task's rotation (below), never one worker twice for one revision of the task (the unique key of `opportunity_deliveries` and an index probe before any evaluation);
  - **pace:** the next wave is due `remoteWaveMinutes` (30) after the previous one (an urgent task: its own, shorter window, 3 minutes), whoever wakes the task up. An early call (a changed profile re-queues the task at once) writes nothing and answers `status SENT, inserted 0, waiting true, deadlineAt = the time it is due`, so the tick reschedules the task for that time without any change to the tick;
  - **stop:** while the task has at least `remoteStopAfterResponses` (5) active responses that also cover its open slots, nothing is sent (`REMOTE_RESPONSE_TARGET_REACHED`, no round written; the task stays queued under the usual back-off and the waves go on when responses are withdrawn); a task that is closed, agreed or cancelled stops for good (the checks of `dispatch_next_wave` before the new code: `NEED_NOT_OPEN`, `SLOTS_FILLED`, `REMAINING_SEARCH_CLOSED`, `SEARCH_WINDOW_CLOSED`);
  - **brake:** at most `remoteCeiling` (10,000) workers are notified for one revision of one task; above it the wave answers `DELIVERY_CEILING_REACHED` without writing a round, raising the knob continues;
  - **rotation (equal chances):** the profiles in id order starting at the task's own id, then the ones below it: the order of MATCH-V1's `candidate_profile_ids` for a task without a place, so different tasks start at different workers. The walk reads the profiles in keyset chunks of 500 by id (an ordered index range, never a sort of all profiles), skips the already notified by an index probe on the unique key of `opportunity_deliveries`, and returns only workers who would really be notified (the prefilter AND the detailed matcher agree), so a worker the matcher refuses can never hold up the ones behind him. A worker who becomes eligible later (a new profile, a changed profile) is reached by the next wave, in rotation order; a changed profile never pulls a wave forward (the pace is kept);
  - **nobody new:** a check that finds nobody is recorded as `STOPPED / NO_ELIGIBLE_CANDIDATES` and paced like the tick paces every such task (5, 5, 5, 8, 16 ... up to 360 minutes), so a task that has reached everybody is not checked every 30 minutes;
  - **a new revision** of the task (an edit) starts a new rotation and the first wave size again;
  - **validity** of the deliveries and their notifications: `validMinutes` of the row (24 h), an urgent task until the end of its urgency; "Mogu odmah" first inside a wave, as in MATCH-V1.
- **A task WITH a place** keeps MATCH-V1 mode ALL: one wave to every admitted worker, nearest first, up to the global `ceiling` of the row. Proven: the same result keys and the same workers.
- **The ladder (`mode: "LADDER"`) is untouched.** The new knobs are not even read in that mode (proven with junk values).

### Daily cap per worker (third layer; default OFF)

- **What it counts:** the worker's own `OPPORTUNITY_AVAILABLE` events of normal urgency created in the last 24 hours (a rolling window), i.e. the event that `dispatch_next_wave` emits for every notified worker (its in-app and push notification rows hang on it). Not counted: urgent (`HITNO`) events and every other event type (responses, agreements, messages, reviews ...). The cap is checked against the count at the moment the walk reaches the worker.
- **Where it applies:** mode ALL, tasks with a place and tasks without a place (the waves). Not the ladder, not an urgent task (urgent notifications are never held back).
- **What a capped worker experiences:** he is skipped for this wave, it is not an error, nothing is recorded, and **he does not use up a place** of any ceiling, so the next worker takes the place. He still sees the task on the map, in the list and in "Za mene" (the cap only holds the notification back). A later wave picks him up if he has room by then and the task is still open (never twice per revision).
- **Default `workerDailyCap = 1000` = off.** The valid range is 1..1000; a value of 1000 means the cap is off and **no query is made at all** (the new code delegates to MATCH-V1's functions). To switch it on, e.g. at 10 per day: `update private.marketplace_config set value = jsonb_set(value,'{workerDailyCap}','10'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';`
- **Cost:** `private.worker_notify_room_v1b` is one count over one index range (`activity_recipient_idx` on `recipient_user_id, recipient_role, created_at`, or the inbox index, which serves the same range) with `limit workerDailyCap`, so at most that many rows are read however long the worker's history is. @@CAP_COST@@

## Configuration (one row, no code change)

`private.marketplace_config` key **`match_v1_dispatch`** (the MATCH-V1 row). The candidate adds seven keys and keeps every existing value (e.g. the ceiling the owner sets after MATCH-V1):

| key | default | valid | meaning |
| --- | --- | --- | --- |
| `remoteWaves` | `true` | `true` / `false` | tasks without a place in waves (`true`) or as in MATCH-V1 mode ALL (`false`) |
| `remoteWaveSize` | 300 | 1..10000 | first wave |
| `remoteNextWaveSize` | 1000 | 1..10000 | every later wave |
| `remoteWaveMinutes` | 30 | 1..1440 | minutes from one wave to the next |
| `remoteStopAfterResponses` | 5 | 1..1000 | no more waves while the task has this many active responses covering its open slots |
| `remoteCeiling` | 10000 | 1..10000 | total brake per task revision |
| `workerDailyCap` | 1000 | 1..1000 | new-task notifications per worker per 24 h; 1000 = off |

A knob outside its range, not a whole number, not the right JSON type, missing (`workerDailyCap` must always be there) or misspelt (any other key starting with `remote` or `worker`) raises **`DISPATCH_CONFIG_INVALID`** when the next wave of any task starts in mode ALL (the tick files it as an ERROR for that task and retries in 10 minutes), like the other dispatch settings; nothing is delivered and nothing silently stays as it was. While `remoteWaves` is `false` the five wave knobs are not checked (the cap knob always is).

```sql
-- examples (each is one data row update, closure certificate not involved)
update private.marketplace_config set value = jsonb_set(value,'{remoteWaveSize}','500'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';
update private.marketplace_config set value = jsonb_set(value,'{remoteWaveMinutes}','60'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';
update private.marketplace_config set value = jsonb_set(value,'{workerDailyCap}','10'::jsonb), updated_at = statement_timestamp() where key = 'match_v1_dispatch';
```

**Switch the waves off and on** (two guarded scripts in this directory, one `update` of one row, a state-changing write on DEV: only on the owner's exact word): `switch-remote-waves-off.sql` makes tasks without a place behave exactly like MATCH-V1 mode ALL again (workers already notified stay notified); `switch-remote-waves-on.sql` validates the knobs first (a bad knob cannot be switched on). The daily cap is a separate knob and is not touched by either.

## Apply order and revert order

| step | package | word | note |
| --- | --- | --- | --- |
| 1 | ZONE-PERF | done (ledger 228) | |
| 2 | MATCH-V1 | `PRIMENI MATCH-V1` | then the documented one-row update `ceiling` = 10000 (set by the coordinator) |
| 3 | **MATCH-V1B** | **`PRIMENI MATCH-V1B`** | requires step 2; `preflight.readonly.sql` before, `postflight.readonly.sql` after |
| 4 | DISCOVERY-ZAMENE | `PRIMENI DISCOVERY-ZAMENE` | needs MATCH-V1; independent of MATCH-V1B (either order is proven safe: it does not touch the wave) |

Revert in the opposite order: DISCOVERY-ZAMENE → **MATCH-V1B (`revert.sql`)** → MATCH-V1 → ZONE-PERF. MATCH-V1's own revert refuses while MATCH-V1B is applied (it recognises only its own wave body), so MATCH-V1B always goes first. The revert restores the MATCH-V1 body of the wave, drops the five new functions and removes the seven keys from the row (every other value stays); deliveries, events and rounds written stay (code rollback only). A revert after the apply leaves the catalog byte-identical to the one before it (proven).

The apply is atomic and guarded: certificate ready, nothing of this package present (`MATCH_V1B_ALREADY_OR_PARTIALLY_APPLIED`), MATCH-V1 present (`MATCH_V1B_REQUIRES_MATCH_V1`), the body of the wave and the twelve bodies it depends on pinned by md5 (`MATCH_V1B_PREDECESSOR_DRIFT`, `MATCH_V1B_DEPENDENCY_DRIFT`), the row a valid MATCH-V1 row (`MATCH_V1B_DISPATCH_ROW_INVALID`); after it the exact post-image, ACL (`{postgres=X/postgres}`), volatility, the row equal to before plus the seven keys, the defaults present, the configuration valid and the closure certificate **unchanged** (functions outside its roster, no table / column / constraint / trigger / policy / index / grant change; no errcode `40001`: deterministic conflicts would be `PT409`, and this package raises none).

## Exact boundaries

| Function | Change |
| --- | --- |
| `private.dispatch_next_wave(uuid)` | **replaced** (`0bd8b64a...` MATCH-V1 → `e70a2c38...`); the whole change is `body.diff`: the knobs are checked in mode ALL, a task without a place returns `private.dispatch_remote_wave_v1b(...)`, the candidate source is the cap-aware twin; the ladder statements are byte-identical |
| `private.worker_notify_room_v1b(uuid,integer)` | new, `stable`: may this worker still get a notification today (the count with `limit`) |
| `private.candidate_profile_ids_v1b(uuid,integer,integer)` | new, `stable`: the cap-aware twin of `candidate_profile_ids`; with a null cap it IS MATCH-V1's function (delegates) |
| `private.remote_wave_candidates_v1b(uuid,integer,integer)` | new, `stable`: the walk of the rotation (keyset chunks, anti-join, lazy eligibility) |
| `private.dispatch_config_v1b(jsonb)` | new, `stable`: the checks and the named error |
| `private.dispatch_remote_wave_v1b(...)` | new, `volatile`: one wave (ceiling, stop, pace, round, rows, events, back-off) |

Data: the seven keys in the one row. Nothing else. The five new functions are `security definer`, `search_path = pg_catalog`, `revoke all ... from public, anon, authenticated, service_role`.

## Proof (disposable database; run @@RUN_ID@@)

See `supabase/proofs/match-v1b/README.md`. Behaviour (`runtime.proof.mjs`, real Auth and PostgREST): BEFORE, atomic refusals, the apply, waves / pace / stop / resume / agreed / cancelled, rotation and different starts, a changed profile and a late worker, revision, the ceiling, a task without coordinates, an empty check's back-off, urgent, the place-based task unchanged, the cap (remote, place-based, across tasks in one tick, urgent exempt, off by default, ladder not capped), switch off / on, the ladder untouched, every bad knob, DISCOVERY-ZAMENE on top, exact reverts. Load (`load.proof.mjs`, 40,000 matching workers): below.

@@MEASURED@@

## Push facts for the load notes

Provider limits as given in the brief: FCM 600,000 messages per minute per project; the Expo push service takes 100 messages per request and 600 per second per project, so 10,000 pushes take about 17 seconds. The transport is therefore not the bottleneck; the database rows are: **4 rows per notified worker** (one delivery, one event, one in-app and one push notification row), 40,000 rows for a task that reaches the ceiling of 10,000. The proof makes no push send (`pushSends: 0`).

## What is NOT covered

- No push transport, device or DEV access: only the database side of the dispatch is proven; whether the provider delivers 10,000 pushes in time is not measured.
- The cap is not applied to the ladder (the ladder is the old, bounded path) and not to urgent tasks, by design. It counts notifications created (chances given), not pushes delivered: a notification the person muted still counts.
- A task that FEW workers fit still costs one pass over all profiles per check (@@RARE@@). MATCH-V1 alone has the same property; the waves only bound how often it happens (the pace and the back-off). The real fix is an index on the skills (a table-level change, a package of its own).
- For a task with a place the single wave happens at publication and at later checks; a worker held back by the cap at that moment is reached only by a later check while the task is open and he has room.
- A changed profile re-queues the task but never pulls the next wave forward; the worker is reached at the next wave of that task (at most `remoteWaveMinutes` later, at most six hours when the task had already reached everybody and is in its back-off).
- Not changed: the base readers (Discovery, "Moji zadaci") stay linear in the number of tasks; the client app; the push suppression rules (quiet hours); any price or payment rule.
