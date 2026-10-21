# CCP02 — otkazivanje i prikaz prijava, 21.10.2026.

## Primenjeno
DEV `leqcwgzvjsxugfgzdmth`: migracija `20261021085952_cancelled_candidate_history_parity.sql`.
Oba overload-a `private.need_candidate_states_v5` isključuju CANCELLED istorijski Dogovor iz has_agreement. Ostali pisci, kapacitet i javni čitači nisu menjani.
Klijent za CLOSED koristi „Zatvorena” i „Prijava više nije u izboru.” FULL ostaje odvojeno stanje. Otkazivanje ne znači da zadatak više ne prima prijave.

## Izvršeni dokazi
- Pre izmene: stvarni rpc_cancel_agreement oslobađa mesto; worker reader CLOSED, owner reader pogrešno SELECTED.
- Posle izmene: origin.rollback.sql, uključeni trigger-i, authenticated role/JWT claims, sintetički početni 3/3, stvarni otkaz jednog izvršioca, oba owner čitača CLOSED/SELECTED/SELECTED i remainingSlots=1. Worker CLOSED; tuđi vlasnički read odbijen NOT_REQUESTER.
- ROLLBACK svih fixture redova; završna provera auth.users za ccp2-%@proof.invalid: 0.
- Helper readback i ACL provereni; privatni helperi bez authenticated/anon EXECUTE. Javne definicije cancellation/read funkcija nepromenjene.
- Closure source/program digest nepromenjeni. Postojeći retentionReady=false i erasure binding=null ostaju otvoreni.
- Osam Jest paketa: 324/324 PASS. TypeScript (npx tsc --noEmit): PASS.
- Integritet migracija: 177 fajlova, 87 live snapshot, 60 pending, 30 physical suffix; participant contract PASS.

## Tačan ledger
MD5 migracije: 2a8494444e37af24a73546c1c4e564d0.
SHA256: d9e4205cae1fd7c91f5e78e8deb23103d0c3daf274ccc6132c1378d622ccb232.
10740 bajtova; lokalni sadržaj jednak ledger-u.
Helper MD5 pre → posle:
- uuid: 6e9656abe2475b53b6dc49ead1131620 → f87f872758b5caa618ab96864fe96ade
- uuid,uuid[]: 1c25fd199f84964d2ffbb5b54d5aeca0 → 2c8b6e1d1344991a9d696a39f60e8d3a

## Granice
Fixture početne selekcije su sintetičke. Auth korisnici nastaju SQL-om uz signup trigger; ovo nije HTTP registracija/prijava. Deferred creation constraints nisu zasebno potvrđeni. Nije izvršen stvarni rpc_select_response za zamenu, concurrency proba, novi APK niti HONOR prolaz. FLOW05 ostaje delimično potvrđen.
Rollback preimage je sačuvan u candidates/cancelled-candidate-parity-20261021/rollback.preimage.sql; vraćanje stare greške nije izvršavano.

## Izvori
- supabase/candidates/cancelled-candidate-parity-20261021/origin.rollback.sql
- supabase/migrations/20261021085952_cancelled_candidate_history_parity.sql
- supabase/operations/dev-alpha/ledger/20261021_ccp02_physical_suffix.receipt.json
- src/ui/v2/ApplicationFace.tsx, CandidateFace.tsx; src/ui/system/StatusChip.tsx
