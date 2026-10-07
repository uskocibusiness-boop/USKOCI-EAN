# CANCEL-INFO — "Otkazano {datum} · {ko} · {razlog}" za Dogovore (2026-10-07)

**Ukratko za vlasnika (srpski):**
- Ekran Dogovori može da prikaže kada je Dogovor otkazan, ko ga je otkazao (ti / druga strana) i razlog.
- Nova tabela ne postoji i ne pravi se: podaci se čitaju iz onoga što otkazivanje već upisuje (status, obaveštenje drugoj strani i poruka sa razlogom u razgovoru).
- Vide ga samo dve strane tog Dogovora, isto kao što razlog već vide u Porukama. Niko drugi ne dobija ništa.
- Ako je par bio blokiran u trenutku otkazivanja, razlog nikad nije sačuvan i to se tako i kaže; ako je nalog zatvoren, razlog je obrisan i to se kaže.
- Sertifikat zatvaranja naloga se ne pomera; ništa nije primenjeno na DEV.
- Primena samo na tvoju tačnu reč **„PRIMENI CANCEL-INFO“**; povratak je jedna skripta (`revert.sql`).

**Status: SOURCE ONLY, NOT APPLIED.** Canonical DEV `leqcwgzvjsxugfgzdmth` only on the owner's exact word **`PRIMENI CANCEL-INFO`** (relayed by the lead). Proof: `.github/workflows/profile-trust-cancel-info-proof.yml` (disposable database only, never DEV). Apply it **before PROFILE-TRUST** (which reads its helper); independent of ZONE-PERF, MATCH-V1 and DISCOVERY-ZAMENE (any order, both orders proven). ZONE-PERF has been applied on DEV since 2026-10-07 19:22 (migration `20261007192233`, ledger 228); the read-only preflight on DEV after that shows no drift of any pin (`dependencyDrift: []`, `cancelWriterIsOnlyThePinnedWriter: true`, certificate `3a785d42…` ready).

## Where cancellation facts really live (finding, read-only on DEV 2026-10-07)

There is **no cancellation record**. `public.agreements` has no cancel columns (id, need, selection, response, both parties' account and profile ids, version, status, created_at, updated_at), `public.agreement_execution` neither. The only function that sets a Dogovor `CANCELLED` is `public.rpc_cancel_agreement(uuid,text)` (catalog scan of every public/private body; md5 `e59b8f7d…`). Inside ONE statement it leaves three facts that all carry the same `statement_timestamp()`:

1. `public.agreements.status = 'CANCELLED'`, `updated_at` stamped by the trigger `agreements_set_updated_at` → `private.set_updated_at()` (a later closure redaction keeps `updated_at`; nothing else updates a cancelled Dogovor);
2. the event `AGREEMENT_CANCELLED` (dedupe key `agreement-cancelled:<id>`) sent to the **other** party by `private.emit_event`, so the recipient names the canceller;
3. unless the pair was blocked or a party was under a closure restriction at that moment: the canceller's own message `Otkazujem Dogovor. Razlog: <reason>` in the Dogovor's conversation (`left(..., 2000)`, so at most 1,973 characters of reason).

DEV data (aggregates only, 2026-10-07): 10 Dogovori, 3 cancelled; all 3 have the event, the event time equals `updated_at`, the reason message sits at that exact instant; 2 by the worker, 1 by the requester. The helper's own SELECT, run read-only on DEV, answers all 3 (side from the event, reason kept).

**There is no SYSTEM side today**: no job, closure step or support path cancels a Dogovor. A future one must record its side (and this helper must learn it). A closure deletes the events of a closing **recipient** and replaces the text of a closing **sender**'s messages with `Sadržaj uklonjen pri zatvaranju naloga.`; the side then comes from what is left (event first, then the sender of the message at the cancellation instant) and is `null` when nothing is left — never guessed.

## Why a new function and not an extra field on the list readers

`rpc_list_my_agreements_page` and `rpc_get_agreement_workspace` are **not** among the 99 certified functions, so extending them would have been allowed. A separate batch read was chosen because (1) those two readers are pinned by other open work (ZONE-PERF's proof uses the page reader as its control, D12/EX-04 postflights pin both md5s), (2) old clients cannot be affected by construction, (3) the revert is a pure drop. Cost: one extra call per screen (≤ 100 ids).

## Client contract

`rpc_agreement_cancellation_v1(p_agreement_ids uuid[])` — EXECUTE: `authenticated` only. 1..100 ids, no null, one-dimensional; each id once, answered in the order given; an id that is not the caller's Dogovor (or does not exist) is **left out** without an error.

```json
{
  "schema": "AGREEMENT_CANCELLATION_V1",
  "items": [
    {
      "agreementId": "uuid",
      "cancelled": true,
      "cancelledAt": "2026-10-07T18:23:45.123456+00:00",
      "cancelledBy": "REQUESTER | WORKER | null",
      "cancelledByMe": true,
      "reason": "Promenio sam plan. | null",
      "reasonState": "KEPT | NOT_KEPT | REMOVED"
    },
    {"agreementId": "uuid", "cancelled": false, "cancelledAt": null, "cancelledBy": null, "cancelledByMe": null, "reason": null, "reasonState": null}
  ],
  "asOf": "timestamptz",
  "authoritative": true
}
```

- `cancelledBy` is the role of the canceller in that Dogovor; `cancelledByMe` compares with the caller (null when the side is not recorded). A gender-free line needs no verb: "Otkazano 7. okt · ti · {razlog}" / "Otkazano 7. okt · druga strana · {razlog}".
- `reasonState`: `KEPT` (the reason is there), `NOT_KEPT` (no reason message exists: the pair was blocked or a party was closing at that moment), `REMOVED` (the message exists but its text was erased at an account closure).
- Errors: `AUTH_REQUIRED` (28000, no session), `ACCOUNT_CLOSING` (42501, a closing account; the PostgREST pre-request guard answers the same), `INVALID_AGREEMENT_IDS` (22023). Never `40001`.
- Old clients: nothing they call changes.

## Privacy

Only the two parties; the reason is the canceller's own chat message that both already read in Poruke (the chat readers show it whatever a later block says), so nothing beyond the Dogovor is disclosed. The canceller's account id is used internally for `cancelledByMe` and never returned.

## Exact boundaries

| object | change |
| --- | --- |
| `private.agreement_cancellation_facts_v1(uuid)` | NEW, SQL, STABLE, SECURITY DEFINER, `search_path=pg_catalog`, ACL `{postgres=X/postgres}` |
| `public.rpc_agreement_cancellation_v1(uuid[])` | NEW, plpgsql, STABLE, SECURITY DEFINER, `search_path=pg_catalog`, ACL `{postgres=X/postgres,authenticated=X/postgres}` |
| everything else | unchanged; dependency pins (refused on drift): `rpc_cancel_agreement` `e59b8f7d…`, `emit_event` `67413eff…`, `private.set_updated_at()` `d2ba7342…`, the read columns and the `agreements_set_updated_at` trigger |

**Closure certificate: does not move.** Neither function is one of the 99 certified signatures or a trigger function; no table, column, constraint, trigger, policy or grant on an existing object changes; no data row. The apply and the revert assert `closure_source_digest_v5()` and `closure_erasure_program_digest_v5()` unchanged and the certificate ready, in the same transaction (DEV `3a785d42…` / `2027655d…`).

## Evidence

**Latest run [37677943291](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37677943291) (commit `194b4fb0`, candidate SQL byte-identical to `4b4c7585`): job `behavior` success (43 of 43), job `order` success (6 of 6, including state D: DEV as it is now, ZONE-PERF alone). The first attempt of `order` failed in the shared live79 environment step before any proof code ran (the same step passed in `behavior`); attempt 2 of the same commit passed.**

**Proof run [37675024181](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37675024181) (commit `4b4c7585`): job `behavior` success (43 of 43 checks), job `order` success (5 of 5).** Disposable database only (loopback guard), real Auth and PostgREST, no DEV access, no provider, no push. The first run [37673616896](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37673616896) (`3c68ad8d`): `order` success; `behavior` stopped after 7 green checks on a defect of the PROOF (an Auth client serialised into the report, circular JSON), fixed in `4b4c7585` without touching any candidate file.

Fidelity (bounded, relevant bodies only, not global DEV equivalence): the chain of `supabase/proofs/match-v1/chain.mjs` (source147 → PKG-027…050 → P0 → PKG-045b P0 → P6 v3 → EX-04d → EX-06a/b → WPP01 → EX-06e R2/R3) with its 23 pinned bodies equal to DEV; all three CANCEL-INFO dependencies were byte-identical to DEV on the chain (`surface.mjs`: `EXACT`). Of the writers the proof drives, 8 of 10 equal DEV; `rpc_set_account_block` and `rpc_list_my_agreements_page` differ (B24 / EX-04 S3 are not replayed) and only create fixture rows or are not called by this package.

What it showed for CANCEL-INFO (checks `CI_*`):

| case | seeded through the product | answer |
| --- | --- | --- |
| C1 requester cancels | `rpc_cancel_agreement` as requester | REQUESTER, `cancelledByMe` true / false for the other party, reason kept, `cancelledAt` = `agreements.updated_at` |
| C2 worker cancels | as worker | WORKER, reason kept |
| C3 worker cancels while the pair is blocked | block, cancel, unblock | WORKER (from the event), `reason` null, `NOT_KEPT` |
| C4 the event is gone (closure of the recipient, labelled bypass) | | WORKER from the message at the cancellation instant |
| C5 the reason text is replaced (closure of the canceller, bypass) | | REQUESTER from the event, `reason` null, `REMOVED` |
| C6 both of the above | | REQUESTER from the replaced message's sender, `REMOVED` |
| C7 blocked at the cancellation and the event gone | | `cancelledBy` null, `cancelledByMe` null, `NOT_KEPT` (never guessed) |
| C8 worker cancels after saying "gotovo" | `rpc_mark_work_done`, then cancel | WORKER |
| C9 2,100-character reason | | kept to its stored 1,973 characters |
| open Dogovor | | `cancelled` false, every fact null |

Also: batch order kept, duplicates once, a foreign or unknown id left out; a third account that knows the ids gets `[]`; `[]`, 101 ids, a null element, a null array and a 2-D array → `INVALID_AGREEMENT_IDS`; anonymous → denied; no session → `AUTH_REQUIRED`; a closing account → `ACCOUNT_CLOSING` in SQL and through PostgREST; FAIL before (PGRST202), drift / revert-before-apply / repeated apply refused atomically, exact revert (catalog and certificate as before), FAIL again after the revert; no new `40001`. Timing on the seeded set (server execution): 12 ids in one call 5.3 ms cold / 1.1 ms warm, 4 ms through PostgREST. Order (job `order`): applies and reverts exactly without the three, on DEV's current state (ZONE-PERF alone), after ZONE-PERF → MATCH-V1 → DISCOVERY-ZAMENE and before them, with the same answers in every state.

## Apply order on the owner's word

1. `preflight.readonly.sql` → `certificateReady` true, `dependencyDrift` `[]`, `newFunctionsAbsent` true, `cancelWriterIsOnlyThePinnedWriter` true, `agreementWorkerProfileOfAnotherAccount` 0.
2. `candidate.sql` as one migration (`candidate.in-transaction.sql` for a wrapper that adds its own transaction). Guarded: refuses on any drift, a repeated application, a changed fact shape.
3. `postflight.readonly.sql` → `newFunctions` true, `anonCannotExecute` true, `helperAnswers` = `cancelledAgreements`, certificate equal to the preflight; receipt in `supabase/operations/dev-alpha/ledger/`.

**Revert:** `revert.sql` drops both functions (code rollback only). It refuses while PROFILE-TRUST is applied (`CANCEL_INFO_REVERT_BLOCKED_BY_PROFILE_TRUST`): revert PROFILE-TRUST first.

## Loud notes

- The facts are reconstructed, not stored. If `rpc_cancel_agreement` ever changes (another prefix, another dedupe key, a system path), this package refuses to apply (pinned md5) and, once applied, its postflight `dependencyDrift` names the drift; a future change of the writer must re-check this helper.
- A cancellation by a party whose counterpart later closed the account and that happened while the pair was blocked has no side left (`cancelledBy: null`). PROFILE-TRUST does not count such a cancellation against the worker.

## Not included

No new table, no stored cancellation record, no "system" side, no notification change, no change to the agreement list/detail readers, no client code.

## Files

`build_candidate.py` (generator, `--check`), `live-functions.json` (exact DEV bodies of the three pinned dependencies, read-only readback 2026-10-07), `candidate.sql`, `candidate.in-transaction.sql`, `revert.sql`, `preflight.readonly.sql`, `postflight.readonly.sql`, `manifest.json`. Offline check: `python supabase/proofs/profile-trust/check_source.py`. Runtime proof: `supabase/proofs/profile-trust/` (README there).
