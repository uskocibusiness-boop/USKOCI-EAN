# MVP tokovi: izvorni audit i granice dokaza (21.10.2026)

Ovaj presek razlikuje povezani ekran, lokalni test, aktivan DEV ugovor i potvrđen tok na telefonu. Provera je rađena nad razvojnom granom `feature/unified-qa-master-20261017`; nema novog APK-a ni HONOR prolaza u ovom paketu.

## Povezani delovi koji već imaju stvarne handlere

- Objava: AI nacrt i eksplicitna potvrda, zatim `PUBLISHED` readback (`src/app/(app)/pregled-zadatka.tsx`).
- Prijava: revizija zadatka, trajni request ID pre slanja i oporavak nepoznatog ishoda (`src/app/(app)/prilike/[id]/prijava.tsx`).
- Izbor: vlasnički read, provera ponude i revizije, pa receipt/readback pre otvaranja Dogovora (`src/app/(app)/potrebe/[id]/kandidati.tsx`).
- Pojedinačan Dogovor ima dozvoljene radnje i serversku proveru pre završetka (`src/app/dogovor/[id].tsx`). Ovo ne potvrđuje pun tok sa dva naloga.

## Otvorene korisničke putanje

| Prioritet | Nalaz i dokaz | Potrebna potvrda/izmena |
| --- | --- | --- |
| P0 | Ispravka objavljenog zadatka vraća **isti** zadatak u `DRAFT` pre ponovne procene; neuspešna objava ostavlja ga van pretrage. `src/app/(app)/pregled-zadatka.tsx:412-414,570`. | Osmisliti i testirati bezbedno ponovno objavljivanje koje čuva aktivan zadatak do potvrde novog stanja; ne obećavati atomarnost sadašnjeg toka. |
| P0 | Promena uslova Dogovora je vezana za pojedinačni agreement ID. `src/app/dogovor/[id].tsx:461-463,583-599`; `src/data/agreementClientService.ts:391-399`; grupni ekran pokazuje privatne Dogovore. | Za zajedničke uslove više izvršilaca definisati učesnike, potrebne saglasnosti, konflikt i odustajanje, pa server/test i oba ugla. |
| P0 | Vremenski konflikt drugih prijava nema potvrđen status zamrzavanja u postojećim klijentskim enumima. `src/data/candidateClientService.ts:18-24`; `src/data/myApplicationsClientService.ts:17-18`. | Server vlasnik stanja, povratak posle izlaska iz Dogovora i dvonaložna proba pre novog UI natpisa. |
| P0 — delimično rešeno | CCP02 je primenjen na DEV-u: otkazani istorijski Dogovor više ne označava kandidata kao SELECTED. Origin rollback proba sa tri izvršioca potvrđuje stvarni otkaz 3/3 → 2/3, oba owner reader-a, worker CLOSED i odbijanje tuđeg pristupa. [Dokaz](CANCELLED_CANDIDATE_DEV_20261021.md). | Stvarni izbor zamene preko rpc_select_response, signed HTTP i Android tok ostaju otvoreni. Sintetički početni izbor nije dokaz kompletnog lifecycle-a. |
| P1 | Grupni razgovor modeluje/šalje tekstualno `body`, ima ručno osvežavanje i nema novi inbound activity event za grupnu poruku. `src/data/groupConversationService.ts:8,76-79`; `src/ui/groups/GroupConversationPresentation.tsx:124-147,185-209`; `supabase/migrations/20260913002405_clean_v5_group_conversation.sql:169-177`. | Mediji/glas, dostava, retry i događaji tek uz odgovarajući server ugovor i test. |
| P1 | Stvarni DEV gate brisanja naloga je zatvoren: `retention_ai_source_ready=false`, `closure_erasure_binding_v5=null`. Ekran i klijent postoje, ali početak zatvaranja odbija `CLOSURE_POLICY_NOT_READY`. `docs/current/ACCOUNT_CLOSURE_DEV_GATE_20261021.md`. | Potvrditi politiku čuvanja/brisanja AI istorije, erasure binding i pun signed tok. Bez slepog podešavanja digest-a. |
| P1 | Nova prijava iz push-a još nema aktivan precizan cilj: transport DEV v36 radi uz isključenu application-target zastavicu; SQL kandidat nije primenjen. `docs/current/PUSH_APPLICATION_EDGE_V36_20261021.md`; `supabase/functions/uskoci-push-transport/index.ts`. | Otključati closure preduslov, owner-scoped target read, uključiti samo DEV i probati OS tap + red obaveštenja na dva naloga. |
| P1 | Široka/multigradska radna oblast ostaje kandidat, ne aktivan matcher; task AI rok za prijave je OFF i edit-only promena pada na `NO_MATERIAL_CHANGE`. `docs/candidates/worker-area-v2-sql/README.md`; `docs/candidates/task-ai-deadline-20261021/README.md`. | Završiti signed Save, listanje i matching za oblasti; zasebno rešiti deadline edit writer/snapshot i testirati objavu/izmenu. |
| P1 | Stari task AI review fallback može za REMOTE prikazati `canAccept` bez typed handoff-a; potpisani draft writer tada odbija `HANDOFF_REQUIRED`. Isti pisac odbija i `MY_PRICE` bez iznosa i neispravan `FIXED_WINDOW`. `supabase/migrations/20261019104604_service_handoff_signed_matching.sql:263-299,541-574`; `src/data/reviewFactProblem.ts`. | Klijent sada pre Save/Publish pokazuje konkretno objašnjenje i vodi do ispravke; ni privatni nacrt više ne nudi upis koji bi server odbio. Pripremni review RPC još treba ujednačiti na DEV-u i potvrditi potpisanim REMOTE tokom. Ovo je otklonjen slepi klik u klijentu, a ne dokazana server E2E objava. |

## Pre kandidata APK-a

### Naknadni paket: grupni razgovor, 21.10.2026.

`GroupConversationController.syncLatest` sada čita novu stranu poruka u fokusiranom, aktivnom ekranu na osam sekundi. Koristi postojeće owner-scoped context/messages RPC-eve, posle poslednje potvrđene sequence; ne zahteva novu server funkciju. Dopunjava istoriju i čuva stariji cursor, mesto čitanja i neslati tekst. Spor read ne zaključava slanje i ne sme da pregazi noviji command/refresh/read ACK. Izlazak, pozadina i promena naloga odbacuju kasni rezultat. Završena grupa prestaje da se proverava nakon preuzimanja završnih strana.

Dokazani lokalni timeout/SDK status-zero prikazuje objašnjenje uz kompozer i privremeno onemogućava slanje/read marking; tekst ostaje u memoriji ekrana. Sledeće uspešno čitanje vraća rad. Server odbijanje ili neispravan odgovor uklanjaju nedostupan sadržaj. Nema automatskog ponavljanja upisa, izmišljenih poruka, „online” ili „pročitano” oznaka.

Provere: četiri Jest paketa (`v5-group-conversation-controller`, `v5-group-conversation-screen`, `v5-group-conversation-service`, `group-reading`): **161/161 PASS**. `npx tsc --noEmit`: PASS. `git diff --check`: PASS. Ovo je lokalni SOURCE/TEST dokaz; nema novog APK-a, potpisane dvonaložne probe ili HONOR potvrde za ovu izmenu. Inbound push događaj i grupni mediji ostaju otvoreni; polling nije Realtime niti push.

Figma readback: isti dokument `nZwxDeRClrrecngX09bimy`, 21 stranica uključujući tri review stranice. Na review stranici `223:897` postoje vlasnički Dogovor `227:1844`, izvršiočev `227:1879`, Inbox `227:1910`, tekstualna grupa `227:1927` i vlasnička grupa `228:1690`. Ovo potvrđuje postojeće čvorove, ne sve prototype veze ili vizuelnu prihvatljivost APK-a. ADB u ovom paketu vidi samo `emulator-5554`.

### Jedanaest Master scenarija — šta ostaje do prihvatanja

Ovo je mapa nastavka uz prethodni audit i postojeće rute, ne nova tvrdnja o izvršenih jedanaest scenarija.

| FLOW | Postojeći ulaz / izvor | Preostali dokaz ili prepreka |
| --- | --- | --- |
| 01 Novi korisnik | `src/app/auth.tsx`, `(app)/index.tsx` | Sveža registracija, dozvole, povratak i prvi zadatak na tekućem buildu. |
| 02 AI objava | `(app)/nova.tsx`, `pitanja-zadatka.tsx`, `pregled-zadatka.tsx` | Potpisana objava i neuspešan ishod; bezbedna nova-ID zamena postojeće objave; valuta/handoff. |
| 03 Izvršilac | `(app)/prilike/[id]/prijava.tsx`, `moje-prijave.tsx` | Dva naloga: prijava → izbor → Dogovor; preklop vremena i povlačenje. |
| 04 Objavljivač | `(app)/potrebe/[id]/kandidati.tsx` | Potpisana selekcija, popunjenost i obe perspektive na uređaju. |
| 05 Više ljudi | kandidati + `dogovor/[id].tsx` | DEV parity migracija primenjena; SQL role proba 3/3 → 2/3 PASS. Stvarni izbor zamene, HTTP i uređaj ostaju otvoreni. |
| 06 Komunikacija | `GroupConversationScreen`, privatni tab Dogovora | Novi foreground sync lokalno potvrđen; dvonaložni runtime, privatni mediji/glas, grupni inbound događaj ostaju za probu/implementaciju. |
| 07 Izmena Dogovora | `dogovor/[id]/izmene.tsx` | Bilateralni tok proveriti; zajednički uslovi više ljudi zahtevaju poseban server ugovor. |
| 08 Završetak | `dogovor/[id].tsx`, `(app)/oceni-dogovor.tsx` | Dvostrana potvrda, neslaganje, ocena i istorija na tačnoj verziji. |
| 09 Radni profil | `(app)/profil/razgovor.tsx`, `radnik.tsx` | Signed Save/aktivacija, cross-mode identitet i Area V2; izvorni kandidat nije aktivan matcher. |
| 10 Mapa | `(app)/mapa.tsx`, `zadaci.tsx` | Filteri, remote odvajanje, pin/kartica/Back i zadržavanje kamere na finalnom buildu. |
| 11 Rubni slučajevi | funkcionalne prezentacije/controller-i | Novi grupni offline/recovery provereni lokalno; celokupni presek grešaka, Auth povratka, prekida mreže i stale podataka nije kompletno izvršen. |

Redosled završavanja: prvo otvoreni serverski ugovori koji menjaju istinitost akcija, zatim povezivanje njihovih prikaza i međustanja, zajednička regresija, novi APK, potpisane probe obe uloge i vizuelni pregled na uređaju. Otvoreni closure/AI history erasure i push target ostaju release stavke iz gornje tabele. Nijedan FLOW ovim paketom nije proglašen potpuno runtime potvrđenim.

Za svaki red dokazati: (1) autoritativni read/write ugovor, (2) dve perspektive i dozvoljene prelaze, (3) grešku/nepotvrđen ishod/Back, (4) lokalni test, (5) DEV signed probu, (6) HONOR vizuelni i dodirni prolaz. Posebno proći `3/3 → 2/3 → zamena`, povučenu prijavu, preklop vremena, obradu i oporavak AI-ja, grupni čet, push cilj i brisanje. Figma prototip i izvorni testovi nisu zamena za ta izvršavanja.
