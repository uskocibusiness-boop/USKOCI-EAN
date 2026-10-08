> **Dopuna posle read-only pregleda 8.10. uveče:** PUSH-KAPACITET recept nije izvršen. Prvo uskladiti postojeći25s deadline sa SEND budžetom i rešiti RECEIPT kapacitet;1receipt/tick ne prati predloženih40send/tick. Single-target kandidat je istorijski vezan zaledger225 i traži novi preflight na235. Ne povlačiti preostaliCREATED i ne uključivati globalno slanje bez posebne vlasnikove reči. [Aktuelan dokaz i bezbedan redosled](../ui-ux-pass-20261002/NACRT_PROIZVODA_20261008.md#telefon-plan-20261008). Tekst ispod ostaje zapis predaje, ne novo odobrenje.

# Lista za Codex — šta TI radiš (vlasnik, 8. 10. uveče: „reši sve što možeš sad, ali navedi Codexu šta treba on“)

Sve što je Claude mogao bez telefona i bez tvoje reči je URAĐENO i komitovano (spisak u `FORENZICKI_PRESEK_20261008.md` §9–13). Ispod je samo ono što ostaje — redom. Pored svake stavke stoji merilo „gotovo“ i gde je materijal. Pravila: `AGENTS.md`; nikad tvrdnja „radi na telefonu“ bez slike sa telefona; dokazani serverski paket smeš sam (stojeći nalog), ostalo iz liste odluka = vlasnikova reč.

## A. Odmah (dan 1)
1. **Pročitaj** `START_PROMPT_CODEX.md`, pa presek; proveri `git status -sb` (čisto na 5f004187+), DEV ledger = 235, digest = 3a785d42. — *Gotovo: pet redova vlasniku.*
2. **Dokaz na telefonu/emulatoru** talasa 4e0ea506 (vlasnik gleda APK; ti na emulatoru `USKOCI_V5_TEST`): Zadaci (lista, traka tabova koja se krije, kartica pina, „Moja lokacija“, kapsule, pretraga, filteri), kalendar (Mesec/Nedelja/Dan, font 1,3, rotirani „Mogu da radim“), pregled pre objave, Lični podaci (upis imena u oba profila, poruka pri neuspehu), fotografija (bez „M“), Obaveštenja (naslov zadatka), Poruke, Profil, Dogovor (radnje, koraci). Popravke po vlasnikovim primedbama; ekran koji odbije vraća se po fajlu. — *Gotovo: nov APK na grani `visual/phone-<datum>-<n>`, vlasnik „ovako ostaje“, registar sa dokazima (slike u `docs/implementation/evidence/`).*
3. **Registar posle dokaza:** `docs/control/redovi.json` (svetlo „Telefon“ samo sa slikom za tačan APK), `node scripts/control/osvezi.mjs`, `osvezi-master-plan.mjs --check`, komit, republish `docs/control/out/tabla.html` na artefakt VxTvL3VpwhYv8cxJCWzD5t.

## B. Server (dan 2–4; dokaz na jednokratnoj bazi pa primena po stojećem nalogu)
4. **RETIRE-V1** (`supabase/candidates/retire-v1-20261008/`): generiši `revert.sql` iz DEV-a (`pg_get_functiondef` + grants + komentar za `rpc_confirm_need_edit`), `preflight.readonly.sql`/`postflight.readonly.sql`, workflow `retire-v1-proof.yml` (lanac kao DISCOVERY-GRAD: PRE 4 postoje, PRIMENA, POSLE 4 nestale + postojeći klijentski dokazi prolaze + sertifikat nepomaknut, REVERT bajt-tačan), primena (baza prvo izmeri otkucani tekst), potvrda `write_application_receipt.py`, red S04. Drugi talas: prepiši pozivaoce `rpc_ai_open_need_conversation_v2`, `rpc_get_push_device`, `rpc_send_agreement_message` pa ih ukloni.
5. **`publishedAt`** u vlasnikovom čitanju zadatka (`rpc_read_task`/vlasnički čitač koji `potrebe/[id]/pregled.tsx` koristi) → prosledi u `NeedPresentation` (već prima) → „Objavljen pre 2 sata“.
6. **Redosled prijava/kandidata** po ceni i oceni u `rpc_list_need_candidates_page` (klijent ima kontrolu samo za celu listu; `ApplicationSelectionPresentation`).
7. **Broj nepročitanih 1:1** u ugovoru `rpc_list_my_conversations_v1` (klijent: `conversationInboxClientService`, danas „nepoznato“).
8. **(ako vlasnik želi) „Najbliže“** — kursor po udaljenosti u `rpc_discovery_v1`.
9. **PUSH-KAPACITET** (`DRUGI_PROLAZ_I_PUSH_RECEPT_20261008.md`): izmena Edge radnika + test u `n09_push_transport_edge.test.mjs` (72/72 danas) → deploy NA VLASNIKOVU REČ + bajt-tačan readback → povuci 1 zaostalu CREATED isporuku → prvi jednociljni push na njegovu reč → tek onda slanje svima.
10. **Edge tekstovi** (`uskoci-ai-interview` završna rečenica izmene; predlog radnog profila bez `displayName`) — deploy na vlasnikovu reč.
11. **HITNO:** registar kategorija + allowlist (`urgent_activation_policy`) + klijent; vlasnik bira kategorije i da li se naplaćuje.
12. **Nov dokazni APK za P6 native journey** (artefakt 36702278038 istekao) — pin na vlasnikovu reč.

## C. Čišćenje koda (posle dokaza na telefonu; dan 4–6)
13. Rez `src/ui/v2/DiscoveryPresentation.tsx` (≈1.430) u module: kamera/mapa, list i stanice, kapsule i filteri, kartica pina, merenja, povezivanje; `pregled-zadatka.tsx` (≈700) i `profil/radnik.tsx` tanke rute. Testovi prate; cilj nijedan fajl > 600 redova u `src/ui`.
14. Dokazani prekidači → trajno: P6 čitač, EX-04 tri straničenja (obriši legacy čitanja celih lista), D12 komentar kad pravni tekstovi dozvole; voice ostaje iza flaga do B2.
15. Sitno: `Skeleton.tsx` varijanta `preview` (stara kartica pregleda → kartica zadatka), scene „Blokirane osobe“ u `dizajn-obavestenja.tsx`, `StatusChip` ključevi za podršku/izvoz (umesto `StatusMark`+`STATUS_TONES` u `support/**`), `TaskDecision.tsx:159` „Objavio“ (vlasnikova reč o rodu), `src/ui/notifications/{NoticeSwitchRow,TimedRow}` → `SettingsSwitchRow`/`ListRow` (predlog agenta P), `Screen` sa `scrollRef` (predlog agenta K).
16. Merenja na HONOR-u za novu mapu (halo, kartica, povratak; cilj < 100 ms do halo-a) i B22 probe; EX-03 brojke važe samo za stari raspored.
17. Repozitorijum: obriši foldere worktree-ova primenjenih kandidata (`USKOCI-CLEAN-inbox-naslov`, `-grad-20261008`, `-match-20261007`, `-trust-20261007`) i granu `backup/telefon-20261008-1` (kad vlasnik potvrdi 4e0ea506); `explore/varijante-20261008` ostaje istorija; dokumentacija: jedan živi indeks, ostalo u `history/`.

## D. Pred izlazak (vlasnik otvara, ti izvodiš)
18. Produkcioni Supabase (R04) + ceo lanac kandidata istim redosledom (B24 oba dela … INBOX-NASLOV, RETIRE-V1); izbaci vlasnikove naloge iz TEST sveta (pkg029e); dve odložene privatnosne grane (d18e830a, 1ab01e78); pravni tekstovi; Play Console (`rs.uskoci`), potpisan AAB; test na dva telefona do 32/32; imenovan release candidate.

## Vlasnikove reči koje čekaš (pitaj ga čim krene)
„Dogovoren“/„Dogovoreno“; „⋯“ u Porukama Dogovora; „d“→„đ“; GRAD S3; deploy PUSH-KAPACITET; prvi push; HITNO kategorije/naplata; Edge tekstovi; nov P6 dokazni APK; brisanje backup grane; plaćanje (provajder, cene); produkcija/Play/pravni tekstovi.

## Šta NE radiš
Ne pokrećeš Claude sesiju u istom checkout-u; ne primenjuješ nedokazan paket; ne uključuješ push/HITNO/plaćanje bez reči; ne brišeš podatke/sesiju na telefonu; ne menjaš `AGENTS.md` zaobilazno ako ga klasifikator odbije (zapiši u `docs/authority/`).
