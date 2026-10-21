# USKOČI · Istorija AI razgovora i brisanje — provereni ugovor

**21.10.2026 · lokalna forenzička provera; bez izmene DEV/prod, migracija, Edge funkcija i APK-a.**
Ovaj dokument nastavlja raniji izolovani predlog za radni AI (`C:/Users/user/Documents/Codex/2026-10-17/u-i-u-radni-direktorijum-projekta/work/worker-ai-history-contract-20261020/proposal.md`), ali zaključci ispod ponovo su provereni u aktuelnom izvornom kodu i read-only DEV katalogu. Nazivi predloženih RPC-ova u ovom dokumentu nisu postojeći API.

## Odluka za proizvod

Korisnik treba da ima dve jasno odvojene istorije: **Razgovori o zadacima** i **Razgovori o radnom profilu**. Svaki red prikazuje smislen, ograničen naslov, datum i status. OPEN razgovor vodi u nastavak istog nacrta; COMPLETED/ABANDONED se otvara za čitanje. Opcija **„Ukloni iz započetih”** ostaje postojeće napuštanje otvorenog nacrta. Opcija **„Ukloni iz liste”** bila bi skrivanje istorijskog reda, kada dobije serverski ugovor. **„Trajno obriši”** sme da se prikaže tek nakon posebnog, proverljivog server postupka koji razlikuje obrisan sadržaj od zadržanog dokaza.

Nijedna od ove tri radnje nije sinonim. Naročito `ABANDONED` nije brisanje.

## Provereno postojeće stanje

| Oblast | Dokaz u repozitorijumu | Stvarno ponašanje |
| --- | --- | --- |
| Zajednički lifecycle | `supabase/migrations/20260829183711_clean_ai_persistence.sql:7–16` | `ai_conversations` ima `NEED_INTAKE`, `APPLICATION`, `PROFILE` i statuse `OPEN`, `COMPLETED`, `ABANDONED`; `bound_need_id` može vezati razgovor za zadatak. Sam status ne znači da je sadržaj obrisan. |
| Owner čitanje | `supabase/migrations/20260903130355_clean_ru0_authority_closure.sql:137–146`; `20260901112607_clean_ai_interview_turn_persistence.sql:6–28`; `20260912230039_clean_v5_policy_bound_closure.sql:297–308` | Authenticated otvoren nalog ima SELECT na svojim `ai_conversations` i `ai_messages`, bez direktnog UPDATE/DELETE. Restriktivna closure policy dodatno ograničava vidljivost. Poruke imaju FK cascade na conversation, ali to nije dozvola za slepo brisanje roditelja. |
| Započeti razgovori o zadacima | `src/data/aiOpenIntakes.ts:8–84`; `src/ui/home/IntakeResume.tsx:97–193` | Straniči 20 OPEN, nevenčanih `NEED_INTAKE` nacrta. Naslov čita samo iz potvrđene aktivne činjenice `need.title`; bez nje prikazuje „Razgovor o zadatku”. Ne nudi sve stare/COMPLETED/ABANDONED razgovore. |
| Nastavak konkretnog task razgovora | `src/data/aiNeedV2Production.ts:324–353`; `src/app/(app)/nova.tsx:420–466` | Vlasnički read po CID-u učitava header, poruke i pregled; `nova` ima eksplicitan restart/abandon. UI kaže da raniji podaci nisu obrisani. Trenutni decoder dopušta najviše 1.000 poruka i zahteva tačan count (`aiNeedV2Production.ts:291–310`), pa se ne sme obećati neograničena istorija kroz tu putanju. |
| Task abandon | `supabase/migrations/20260910172132_clean_w03_owned_ai_intake_authority.sql:225–247`; `src/data/aiNeedV2Production.ts:418–427` | RPC vlasniku menja OPEN u ABANDONED samo za slobodan V2 intake i završava processing turn; vraća receipt. Ne briše poruke, činjenice, predloge ili media. Klijent proverava lifecycle i razlikuje nepotvrđen ishod od uspeha. |
| Radni AI | `supabase/migrations/20260912220506_clean_v5_owned_worker_profile.sql:15–48,204–252`; `src/data/workerAiClientService.ts:268–306` | Private session, turn, review i save evidencije. `rpc_open_worker_ai` vraća postojeći OPEN ili pravi novi; `rpc_read_worker_ai` čita jedan vlasnički CID. Nema poziva za listu, skrivanje ili brisanje u klijentskom servisu. Originalni server dokument sadrži samo poslednjih 100 poruka, a decoder odbija više od 100 (`workerAiClientService.ts:212–231`). |
| Worker abandon | `supabase/migrations/20260912220506_clean_v5_owned_worker_profile.sql:441–454`; `src/app/(app)/profil/razgovor.tsx:289–326` | Menja OPEN u ABANDONED i vraća snapshot; ne uklanja session, poruke, review ili save. Klijentski tekst već kaže „podaci se ne brišu”. |
| Worker istorijska ruta | `src/app/(app)/profil/razgovor.tsx:94–150,401–434` | Aktivna ruta vraća pending journal pre eksplicitnog CID-a i može preusmeriti na njegov razgovor. Zato ne sme biti read-only istorijski pregled samo dodavanjem starog CID-a. Trenutni naslov je generički „Moj radni profil”. |
| Edge funkcije | `supabase/functions/uskoci-ai-interview/index.ts`; `supabase/functions/uskoci-worker-interview/index.ts` | Obrađuju AI turn i kontekst; pretraga ovih funkcija nije pronašla history/list/delete vlasnički endpoint. Ovo ne dokazuje stanje svakog živog server objekta. |

Ponovljena **read-only** SQL provera kataloga na DEV projektu `leqcwgzvjsxugfgzdmth` u `2026-10-20T23:15:06Z` (lokalno 21.10.; sažetak u `docs/current/evidence/AI_HISTORY_SERVER_READONLY_20261021.json`) proverila je samo `pg_proc`, postojanje tabela i retention metapodatke, bez korisničkih redova: task/worker abandon postoje, `private.worker_ai_sessions` i `public.ai_conversations` postoje, nema RPC-a za **istoriju task/worker AI razgovora** ili njihovo hide/archive/delete, `activeRetentionPolicySets=0`, `private.retention_ai_source_ready()=false`. `public.rpc_list_my_conversations_v1` jeste postojao, ali klijentski ugovor ga dekodira kao inbox `AGREEMENT|GROUP` poruka (`src/data/conversationInboxClientService.ts:10,45–64,125`), ne AI istoriju. `public.rpc_delete_draft_need` briše strogo ograničen neobjavljen **zadatak**, ne AI razgovor (`20260830172000_clean_p1_cancel_withdraw_closure.sql:477–572`). Raniji detaljniji DEV snimak metapodataka je `work/worker-ai-history-contract-20261020/server-readonly.json`, 20.10.2026 21:37 UTC. Stanje servera ponovo proveriti neposredno pre migracije.

## Šta može bez nove serverske operacije

1. **Task metadata istorija:** postojeći owner SELECT može da lista `NEED_INTAKE` po `(created_at DESC,id DESC)` za sva tri statusa, sa odvojenim OPEN/COMPLETED/ABANDONED grupama. Ponovo koristiti proveru account revision iz `aiOpenIntakes.ts`; broj redova 20+1; cursor mora očuvati PostgreSQL mikrosekunde. Naslov samo iz potvrđenog `need.title`, uz fallback i datum. Lista ne preuzima poruke, adresu, dokaze ili media.
2. **Task read-only zatvoreni pogled:** može da koristi postojeći read po CID-u samo dok je ispod limita; potreban je namenski `history` režim bez composer-a, Save/Publish, journal preusmeravanja i automatskog novog Open-a. Za >1.000 poruka prvo napraviti server pager. Ako je transcript nepotpun, korisniku to jasno reći.
3. **Worker jedan poznati CID:** sadašnji `read` podržava owned pojedinačni CID, ali **ne otkriva listu** starih ID-jeva. Čuvanje ID-jeva samo u AsyncStorage nije puna istorija: ne radi preko uređaja/reinstalacije i ne sme se predstavljati kao autoritativna lista.
4. **Napuštanje OPEN:** postojeće komande već rade i pošteno su nazvane. Nije primereno dodavati klijentski „trash” koji istu komandu reklamira kao trajno brisanje.

Zbog tačaka 2–3, u ovom paketu **nema izmene source UI-ja**: jedan polovičan „Istorija” ekran bi stvarao lažno obećanje punog pregleda i brisanja. Postojeće jasno označeno uklanjanje započetog task razgovora ostaje dostupno.

### Minimalna mapa ekrana i akcija

| Stanje | Red u listi | Otvaranje | Dozvoljena radnja |
| --- | --- | --- | --- |
| Task `OPEN`, bez povezanog zadatka | „Započeti” + potvrđen naslov ili fallback | Isti `conversationId` u postojećem editoru, posle recovery-ja | „Nastavi” i posebno potvrđeno „Ukloni iz započetih”; drugo znači ABANDONED. |
| Task `COMPLETED`, `bound_need_id` postoji | „Razgovor je završen”; objavu/nacrt imenovati tek po potvrđenom statusu povezanog zadatka | Istorijski read-only razgovor; povezani zadatak posebna akcija | Pregled povezanog zadatka; eventualno „Ukloni iz liste” tek uz H3. |
| Task `ABANDONED` | „Razgovor je napušten” | Istorijski read-only razgovor | Eventualno „Ukloni iz liste” tek uz H3. |
| Worker `OPEN` | „Nacrt radnog profila” | Isti CID u aktivnoj ruti uz journal reconciliation | Nastavi, pregledaj, sačuvaj ili napusti prema postojećim guard-ovima. |
| Worker `COMPLETED` | „Profil sačuvan” **samo** kada postoji Save receipt; inače „Razgovor je završen” | Zaseban read-only ekran | Otvori današnji profil odvojeno; H3 kasnije. |
| Worker `ABANDONED` | „Razgovor je napušten” | Zaseban read-only ekran | H3 kasnije. |

Svako vidljivo dugme dobija zaseban `loading`, `offline`, `unknown outcome` i uspešan readback prikaz. Android Back vraća isti tab, list offset i filter; potvrda uklanjanja čuva prethodni ekran. Nema „obrisano” toast-a nakon pukog nestanka reda iz lokalne liste.

## Naredni serverski ugovor (predlog, još ne postoji)

### H1 · Vlasničke liste metapodataka

Za radni AI dodati `rpc_list_worker_ai_history(p_before_created_at,p_before_id,p_limit)` sa eksplicitnim join-om `private.worker_ai_sessions` i `public.ai_conversations`, oba za `auth.uid()`, `purpose='PROFILE'`. `SECURITY DEFINER` mora sam proveriti owner i stanje naloga, ne oslanjati se samo na RLS. Rezultat po redu: `conversationId`, `createdAt`, `closedAt|null`, `status`, `title`, `titleSource`, `hasSavedProfile`, `visibility`, `canContinue`, `canRead`; bez raw candidate/body/review poruka u listi. `hasSavedProfile` se izvodi iz stvarnog Save receipt-a, ne iz današnjeg profila. `canContinue` ne obećava da su stale/safety/turn provere već prošle.

Predloženi response envelope: `schemaVersion='AI_HISTORY_V1'`, `accountId`, `purpose`, `observedAt`, `rows[]`, `nextCursor={createdAt,conversationId}|null`, `authoritative=true`. Klijent mora proveriti tačan oblik, owner ID, purpose i svako polje, kao u postojećem `readOwnedResult`; greška dekodiranja ne sme postati prazna lista. Task list projekcija koristi `purpose='NEED_INTAKE'` i `fact_schema_version='NEED_FACT_V2'`; `APPLICATION`, legacy razgovori i PROFILE bez worker session-a se ne mešaju neprimetno u istu istoriju. Njihovo eventualno prikazivanje zahteva poseban legacy ugovor.

Naslov worker reda nastaje deterministički iz najviše dve bezbedno skraćene usluge predložene **u toj sesiji**, označen kao tema nacrta; bez prihvaćenih usluga fallback „Razgovor o radnom profilu”. Ne izvlačiti slobodnu poruku, biografiju, privatnu lokaciju ili trenutni profil kao naziv stare sesije. Ne pozivati Gemini radi naslova. Za task red koristiti potvrđen `need.title`; ako je naslov nastao tek nakon objave, jasno naznačiti da je to naziv povezanog zadatka, ne tekst prve poruke.

Paging: limit 1–20 plus jedan dokaz naredne strane; sort `(created_at DESC, conversation_id DESC)`, cursor oba polja sa originalnim timestamptz stringom. Late response posle promene naloga/route-a se odbacuje. Prazan rezultat, permission greška, offline i ponovni pokušaj imaju zasebna stanja.

### H2 · Poruke starijih razgovora

`rpc_list_owned_ai_history_messages(p_conversation_id,p_before_sequence,p_limit)` ili dve purpose-specifične funkcije; owner i purpose se ponovo proveravaju na svakoj strani. Limit 1–50, `hasMore`, `nextBeforeSequence` kao **decimalni string** zbog PostgreSQL bigint; stabilan redosled i deduplikacija. Ne menjati postojeći 100-message worker snapshot ni task turn kontekst. Pregled prikazuje starije strane dodavanjem iznad i čuva scroll anchor. Zatvoreni istorijski ekran nema send, patch, review, save ili publish akciju. OPEN klik ide u postojeći editor tek posle pending-journal reconciliation.

### H3 · Skrivena istorija, bez promene sadržaja

Ako vlasnik želi „skloni stare razgovore sa ekrana” pre trajnog brisanja, zaseban `history_hidden_at` i `rpc_hide_*_ai_history` sa owner proverom, očekivanom revizijom i zaključavanjem. Dozvoliti samo COMPLETED/ABANDONED posle razrešenog pending turn/Save-a; OPEN mora koristiti postojeći abandon uz eksplicitnu potvrdu. Receipt mora reći `hidden=true`, `contentDeleted=false`, `profileChanged=false` i biti idempotentan. Čitanje po CID-u potvrđuje stanje posle izgubljenog odgovora; odsustvo reda iz liste nije dokaz brisanja. UI naziv: **„Ukloni iz liste”**, uz objašnjenje da razgovor ostaje sačuvan. Sakriveni razgovori moraju imati zaseban pristup ili jasno definisan restore.

### H4 · Stvarno trajno brisanje (posebna odluka i implementacija)

Potreban je odobren policy/retention i transakcioni inventar referenci, pre javnog dugmeta. Postojeći kandidat za automatsko uklanjanje je samo uski `ABANDONED NEED_INTAKE` bez bound need/facts/proposals/komandi/review/media i **isključuje worker sessions** (`20260913014627_clean_v5_retention_source_compatibility.sql:100–118`). `worker_ai_saves` je `COMMAND_LEDGERS`, odvojeno od `AI_VOLATILE` (`20260912230039_clean_v5_policy_bound_closure.sql:23–25`), a taksonomsko vezivanje čita source review i save (`20261019104047_taxonomy_parent_navigation_and_mode_admission.sql:1345–1371`). Čak i task poruke mogu biti vezane za AI review, medije i izdati zadatak. Blind parent DELETE/cascade nije prihvatljiv ugovor.

Specifikovati eligible klase, legal/retention hold, aktivni provider turn, povezan published need/profil, export, media, idempotentni command ledger, tombstone i odgovor `deletedClasses`/`retainedClasses`/`reason`. Tek kada server vrati potvrđen deletion receipt i readback, UI sme reći „Razgovor je trajno obrisan”. Ne pretpostavljati ni zakonski rok ni da se svi pomoćni dokazi smeju ukloniti.

## Redosled implementacije i kriterijumi

| Korak | Izlaz | Gate pre sledećeg koraka |
| --- | --- | --- |
| 0 | Ponovni read-only DEV audit funkcija/ACL/policy/retention i ažuriranje ovog ugovora | Poklapanje sa stvarnim serverom; bez korisničkih podataka u dokazima. |
| 1 | Task istorijska metadata lista + worker H1 read RPC, typed decoders | Owner/foreign/closed account, 20+1 cursor, naslov/fallback, no-body list, account switch, offline. |
| 2 | Dva read-only istorijska ekrana; H2 pager; OPEN nastavak kroz postojeći editor | >100 i >1.000 poruka bez gubitka, journal ne preusmerava istoriju, Save/Publish nikad iz closed view-a, Android Back vraća istu listu. |
| 3 | H3 skrivanje samo zatvorenih razgovora i proverljivo readback stanje | Replay/izgubljen odgovor, race sa Save/turn, drugi uređaj i drugi nalog, profil/zadatak/taksonomija nepromenjeni. |
| 4 | H4 trajno brisanje kroz zaseban retention paket, tek po odluci o klasama podataka | Test referenci, holds/export/media/receipts, aktivni zadaci i profili očuvani; UI razlikuje delimično zadržane dokaze. |
| 5 | Native proveravanje oba ugla na telefonu, potom APK po vlasnikovom redosledu | List/read/abandon/hide/delete scenariji, slaba mreža, duži naslovi, velik font, fokus i Back. |

Ovo je **specifikacija, ne potvrda izvršenog API-ja ili gotovog APK-a**. Za nastavak je najbliži konkretan posao korak 0–2; kompletno brisanje je odvojena serverska celina.
