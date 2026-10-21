# AI istorija: uklanjanje iz liste i trajno brisanje

**21.10.2026. · specifikacija kandidata, bez primene na DEV i bez novog dugmeta u klijentu.**

## Dokazano polazište

| Sloj | Stanje | Dokaz |
| --- | --- | --- |
| Izvor | H1 prikazuje vlasnički ograničenu listu `NEED_INTAKE` i stvarnih `PROFILE` sesija; H2 daje tekst zatvorenih razgovora. | `supabase/migrations/20261021014544_ai_history_h1_metadata.sql`, `20261021014557_ai_history_h2_messages.sql`, `20261021014849_ai_history_h2_read_capability.sql`; `src/data/aiHistoryClientService.ts`, `src/data/aiHistoryMessagesClientService.ts`. |
| DEV | H1/H2 su bili aktivni i provereni kroz SQL simulaciju identiteta 21.10. u 01:50 UTC. Ovo nije stvarni Android/korisnički poziv. | `docs/current/AI_HISTORY_DEV_RECEIPT_20261021.md`. Novi readback u ovom paketu nije uspeo jer Supabase konektor vraća `Unknown tool` za `execute_sql`; ne preuzimati stari dokaz kao svež. |
| UI | Lista dozvoljava nastavak OPEN i čitanje zatvorenog reda samo kada H1 vrati `canRead`. Nema kontrole koja obećava brisanje. | `src/ui/aiHistory/AiHistoryListScreen.tsx`, `AiHistoryTranscriptScreen.tsx`, `__tests__/history-ui.test.tsx`. |
| Serverska promena | Task/worker `abandon` menja `OPEN` u `ABANDONED`. Niti H1/H2, niti abandon brišu sadržaj ili sakrivaju istorijski red. | `supabase/migrations/20260910172132_clean_w03_owned_ai_intake_authority.sql:225–247`, `20260912220506_clean_v5_owned_worker_profile.sql:441–454`; `docs/current/AI_CONVERSATION_HISTORY_CONTRACT_20261021.md:20–22`. |
| Zatvaranje naloga | Na poslednjem read-only DEV preseku `retention_ai_source_ready=false`, `closure_erasure_binding_v5=null`; izvršavanje vraća `CLOSURE_POLICY_NOT_READY`. | `docs/current/ACCOUNT_CLOSURE_DEV_GATE_20261021.md`; `supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql:543–544`. |

## Odluka o značenju tri radnje

1. **Napusti započeti razgovor**: postojeća komanda za podoban OPEN nacrt, rezultat `ABANDONED`. Sadržaj ostaje sačuvan i može se čitati u istoriji. Za bound task edit ne nuditi slobodni task abandon.
2. **Ukloni iz liste** (H3): reverzibilno sakriva samo `COMPLETED` ili `ABANDONED` istorijski red. Poruke, potvrđene činjenice, nacrt, objavljen zadatak, profil, komande i export ostaju. Korisnik mora imati „Sakriveni razgovori” i „Vrati u listu”. Ovo **nije** brisanje.
3. **Trajno obriši** (H4): zaseban, strogo ograničen zahtev koji vraća tačne `deletedClasses` i `retainedClasses`. „Trajno obrisan” sme da se kaže tek posle izvršenog server receipt-a i vlasničkog readback-a. Delimično zadržani poslovni dokaz mora biti objašnjen kao takav.

## H3 ugovor za implementaciju

**Schema i recertifikacija.** Kandidat je nullable `history_hidden_at` na `public.ai_conversations`. Ne koristiti `retention_unbound_origin`, `ABANDONED` ili lokalni AsyncStorage kao zastavicu. Nova kolona menja *tačan* inventar u `private.retention_ai_source_ready()` (`20260913014627_clean_v5_retention_source_compatibility.sql:25–29`) i digest svih public/private tabela u `private.closure_source_digest_v5()` (`20260912230039_clean_v5_policy_bound_closure.sql:50–55`). Zato H3 SQL, retention/erasure inventar, export i closure sertifikate treba pripremiti kao jedan provereni forward paket. Samo dodavanje kolone bi učvrstilo već zatvoren closure gate. Rebind hash-a bez provere podataka nije dovoljno.

**Komande.** Posebni authenticated owner RPC-ovi `rpc_set_owned_ai_history_visibility_v1(p_purpose,p_conversation_id,p_hidden,p_expected_hidden_at,p_request_id)` i `rpc_read_owned_ai_history_visibility_v1(p_purpose,p_conversation_id)` (nazivi su predlog, funkcije još ne postoje). Server mora da proveri `auth.uid()`, otvoren nalog, owner, purpose, H1 podobnost i status pod zaključavanjem roditeljskog reda. `OPEN` odbiti; worker session/profil i vezu zadatka ne menjati. `p_request_id` veže ponavljanje za iste argumente. Potvrđeni receipt: `conversationId`, `visibility`, `hiddenAt|null`, `contentDeleted:false`, `profileChanged:false`, `taskChanged:false`, `authoritative:true`, `idempotentReplay`. Različit payload za isti request ID odbiti; zastareli `p_expected_hidden_at` vratiti kao konflikt. Ovo je specifikacija: SQL tek nakon tačnog DEV readback-a i izolovane migracione probe.

**Čitanje.** H1 mora da filtrira `history_hidden_at is null` *pre* `LIMIT 20+1` i ostavi stabilno `(created_at DESC,id DESC)` straničenje. Potreban je zaseban vlasnički pager „Sakriveni razgovori” ili eksplicitni parametar bez PostgREST dvosmislenog overload-a. Taj pogled vraća `visibility='HIDDEN'`; postojeći decoder `AiHistoryRow` sada namerno prihvata samo `VISIBLE`, pa ga proširiti tek uz novi dokazani ugovor. H2 direktan owner read po CID-u može ostati dostupan: skrivanje je organizacija liste, ne tajnost. Readback po CID-u je autoritet kada odgovor na komandu nestane; odsustvo reda iz vidljive liste nije potvrda.

**Klijent.** Na zatvorenom redu kompaktna komanda „Ukloni iz liste” sa potvrdom: „Razgovor ostaje sačuvan. Možeš ga vratiti iz Sakrivenih razgovora.” Nakon tap-a: pending, uspešan receipt, zatim readback; tek tada ažurirati obe liste. Offline i nepoznat ishod čuvaju red i nude „Proveri stanje”; neuspeh ne prikazuje lažan uspeh. Na sakrivenom redu „Vrati u listu”. Otvoreni red nudi samo postojeći nastavi/napusti tok. Posle promene naloga odbaciti zakasneli odgovor; Back vraća isti tab i položaj.

**Provere pre DEV primene.** Owner/tuđ nalog/anon/closing account; OPEN odbijen; worker i task razdvojeni; istovremeni Save/turn; ponovljen zahtev; izgubljen odgovor; konflikt očekivanog stanja; 20+1 pagination sa skrivenim redovima; dva uređaja; reconnect; H2 i aktivni task/profile nepromenjeni; RLS/ACL/SECURITY DEFINER; export/erasure inventar i `retention_ai_source_ready=true` sa validnim closure binding-om posle paketa. Potom signed pozivi oba naloga i stvarni HONOR UX.

## H4: trajno brisanje je poseban posao

Automatski retention kandidat trenutno prihvata samo uzak `ABANDONED NEED_INTAKE` bez bound zadatka, činjenica, review/komandi, media, worker session i drugih veza (`20260913014627_clean_v5_retention_source_compatibility.sql:100–118`). To nije generički API koji korisnik može pozvati za sve stare razgovore. `worker_ai_saves` je u klasi `COMMAND_LEDGERS`, a ne `AI_VOLATILE` (`20260912230039_clean_v5_policy_bound_closure.sql:23–25`). FK `ON DELETE CASCADE` na porukama nije dovoljan pravni, poslovni ni tehnički ugovor.

Pre H4 popisati reference po klasi: povezani zadatak i revizije, objava, AI review, worker Save i aktivan profil, idempotentni command ledger, provider turn, media/Storage, export, retention hold, anonimni/tombstone dokaz. Zatim definisati dozvoljene klase za potpuno brisanje, uslov za zadržane dokaze, eksplicitnu potvrdu, transakciju, idempotentnost, audit receipt i proveru posle izvršenja. Aktivni zadatak ili radni profil ne smeju nestati posrednim cascade-om. Stvarna politika rokova nije dokazana; ne navoditi izmišljen rok.

## Status i sledeći konkretan korak

H1/H2: aktivni na poslednjem dokumentovanom DEV preseku; lokalni UI: izvorno povezan; H3/H4: **nisu implementirani**. Ovaj fajl ne dodaje dugme, migraciju ili lažno obećanje. Sledeći paket je jedan precizan DEV katalog/ACL/closure readback, inventar export/erasure za novu kolonu, izolovana H3 SQL proba sa owner/foreign/race/replay dokazom, tek potom source klijent i signed uređajski prolaz. H4 ostaje odvojena transakciona i retention celina.
