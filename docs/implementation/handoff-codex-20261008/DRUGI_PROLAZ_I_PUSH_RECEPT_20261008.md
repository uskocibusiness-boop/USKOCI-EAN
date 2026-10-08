> **Dopuna posle read-only pregleda 8.10. uveče:** PUSH-KAPACITET recept nije izvršen. Prvo uskladiti postojeći25s deadline sa SEND budžetom i rešiti RECEIPT kapacitet;1receipt/tick ne prati predloženih40send/tick. Single-target kandidat je istorijski vezan zaledger225 i traži novi preflight na235. Ne povlačiti preostaliCREATED i ne uključivati globalno slanje bez posebne vlasnikove reči. [Aktuelan dokaz i bezbedan redosled](../ui-ux-pass-20261002/NACRT_PROIZVODA_20261008.md#telefon-plan-20261008). Tekst ispod ostaje zapis predaje, ne novo odobrenje.

# Drugi prolaz uveče 8. 10. 2026 (rešeno) + recept za PUSH-KAPACITET (nije primenjeno)

Dopuna `FORENZICKI_PRESEK_20261008.md`, odeljak 9. Sve ispod je komitovano i na `novi` (obe grane).

## Rešeno (Codex ne radi ponovo)

| Šta | Komit | Dokaz |
|---|---|---|
| `ClosureDialog` red „Zatvaranje naloga“ bez rečenice-objašnjenja (J5); test usklađen | 6ebef10f | privacy-retention + closure testovi 84/84 |
| Zastareli Maestro tokovi: `.maestro/ai-welcome.yaml` (nema više prekidača „Piši umesto da govoriš“), `.maestro/my-applications.yaml` („Vidi sve“ → red „Moje prijave“) | 6ebef10f | vozači NISU pokrenuti (emulator/telefon) |
| Vlasnikove odluke 8. 10. u autoritetu: `docs/authority/OWNER_DECISIONS_20261008.md` + red u `AUTHORITY_INDEX.md` | 6ebef10f | — |
| „Mogu odmah“ ima JEDAN upis: `src/data/availableNowWrite.ts` (Početna i Radni profil ga dele) | c5cfe96d | `available-now-write.test.ts` 3/3, oba ekrana 189/189, tsc 0 |
| `src/ui/v2/ownTaskTabs.ts` uklonjen (bez pozivaoca od faza Mojih zadataka); test fonta zadržan | a507813d | tsc 0, 164 testa |
| Registar + tabla osveženi (20 redova, snimak DEV-a 16:45 UTC) | 0515b53f | tabla v45 |
| `git worktree prune` (lokalno) | — | 37 → 34 unosa |
| Provereno, NIJE mrtvo: `availabilityShade.dayAvailability` koristi `AgendaScreen.tsx:142` | — | — |

## PUSH-KAPACITET — uzrok potvrđen čitanjem; IZMENA NIJE URAĐENA

Klasifikator Claude Code-a je zaustavio izmenu Edge koda za push kao „production deploy“; nisam je zaobilazio. Ostaje vlasniku i Codexu (Edge deploy je ionako vlasnikova reč).

**Uzrok (pročitano 8. 10. uveče):**
- `supabase/functions/uskoci-push-transport/index.ts`, red 169: `const receipt = await once('RECEIPT'); const send = await once('SEND');` — jedan otkucaj (cron `uskoci_edge_workers`, svaki minut) pravi tačno JEDAN SEND claim → najviše jedno push obaveštenje u minuti.
- `public.rpc_claim_push_transport(text)` na DEV-u (telo md5 `8059dcbd…`, 5.361 znakova) vraća jedan pokušaj po pozivu i već ima svoje kapije: najviše 6 živih zakupa, najviše 60 claim-ova u sekundi, `FOR UPDATE SKIP LOCKED`, red po prioritetu pa vremenu, limit 64 kandidata po pozivu, zakup 90 s, gubitak radnika posle `begin` = `UNKNOWN` (nikad ponovno slanje). Server NE treba menjati.

**Recept (samo Edge radnik):**
1. U otkucaju umesto jednog `once('SEND')`: petlja dok baza daje posao — stani na prvom `'NONE'`, najviše npr. 40 slanja i 40 s zidnog sata po otkucaju (`SEND_PER_TICK`, `SEND_BUDGET_MS`); `send` u odgovoru = najgore stanje otkucaja (rang: `UNKNOWN/FINAL/RETRYABLE` > ostalo > `NONE`) da `TICK_DEGRADED` zadrži smisao; dodati `sent` (broj claim-ova koji su stigli do provajdera). `once('RECEIPT')` ostaje jednom po otkucaju.
2. Offline test: `node --test supabase/proofs/notifications/n09_push_transport_edge.test.mjs` — danas **72/72** na nepromenjenom kodu; dodati test „otkucaj šalje više od jednog dok ima posla i staje na NONE“ i „granica po broju/vremenu“.
3. CI: `.github/workflows/chat-p4-push-transport-proof.yml` već pokreće taj test.
4. Deploy = vlasnikova reč; bajt-tačan readback posle deploy-a (konektor rešava `\u` sekvence u izvoru — memorija `uskoci-edge-deploy-via-connector-caveat`; vlasnikov CLI deploy je bajt-tačan).
5. Pre uključivanja slanja (`EXPO_PUSH_TRANSPORT_ENABLED=true`): povući 1 zaostalu `CREATED` isporuku (od d15 zatvaranja 7. 10.), ostaviti netaknute stare isporuke (A24), prvi pravi push samo jednociljno (jedan vlasnikov uređaj, jedan događaj) na njegovu tačnu reč (AGENTS 3.1.7).

## Napomena o modelu
Ovaj prolaz je radila glavna sesija na Fable 5.1 (model promenjen u aplikaciji); pomoćnici nisu pokretani. Pomoćnik „T4c sistemski ekrani“ (jutarnji talas, Sonnet 5.5 → Fable 5.1 posle kompakcije) završio je i prijavio: sve već integrisano u e9307b95 jutros; otvoreno za T0: `StatusChip` nema ključeve za podršku/izvoz, `SuccessMark` ima oprugu koja odskače (vlasnik: odskok NE), scene „Blokirane osobe“ u `dizajn-obavestenja.tsx` zastarele.
