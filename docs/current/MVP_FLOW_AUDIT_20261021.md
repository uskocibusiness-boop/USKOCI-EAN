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
| P0 | DEV readback 21.10: oba aktivna `private.need_candidate_states_v5` overload-a računaju i otkazani istorijski Dogovor kao `SELECTED`, iako aktivni `rpc_cancel_agreement` menja Dogovor u `CANCELLED` i prijavu u `NOT_SELECTED`. Sopstvene prijave već isključuju otkazani Dogovor; u DEV-u trenutno ima 0 otkazanih redova, pa je raskorak dokazan definicijama, a ne posmatranim korisničkim primerom. `docs/current/APPLICATIONS_AGREEMENTS_CONFLICT_AUDIT_20261021.md`. | `supabase/candidates/cancelled-candidate-parity-20261021/forward.sql` je samo izolovan kandidat sa MD5 preduslovima, nije aktivna migracija. Ne puštati ga bez dvonaložne probe otkazivanje 3/3 → 2/3 → zamena 3/3, ACL/closure postflight-a i rollback plana. Klijentski `CLOSED` sada kaže uzročno neutralno „Prijava više nije u izboru”, jer otkazani Dogovor ne zatvara nužno zadatak. |
| P1 | Grupni razgovor modeluje/šalje tekstualno `body`, ima ručno osvežavanje i nema novi inbound activity event za grupnu poruku. `src/data/groupConversationService.ts:8,76-79`; `src/ui/groups/GroupConversationPresentation.tsx:124-147,185-209`; `supabase/migrations/20260913002405_clean_v5_group_conversation.sql:169-177`. | Mediji/glas, dostava, retry i događaji tek uz odgovarajući server ugovor i test. |
| P1 | Stvarni DEV gate brisanja naloga je zatvoren: `retention_ai_source_ready=false`, `closure_erasure_binding_v5=null`. Ekran i klijent postoje, ali početak zatvaranja odbija `CLOSURE_POLICY_NOT_READY`. `docs/current/ACCOUNT_CLOSURE_DEV_GATE_20261021.md`. | Potvrditi politiku čuvanja/brisanja AI istorije, erasure binding i pun signed tok. Bez slepog podešavanja digest-a. |
| P1 | Nova prijava iz push-a još nema aktivan precizan cilj: transport DEV v36 radi uz isključenu application-target zastavicu; SQL kandidat nije primenjen. `docs/current/PUSH_APPLICATION_EDGE_V36_20261021.md`; `supabase/functions/uskoci-push-transport/index.ts`. | Otključati closure preduslov, owner-scoped target read, uključiti samo DEV i probati OS tap + red obaveštenja na dva naloga. |
| P1 | Široka/multigradska radna oblast ostaje kandidat, ne aktivan matcher; task AI rok za prijave je OFF i edit-only promena pada na `NO_MATERIAL_CHANGE`. `docs/candidates/worker-area-v2-sql/README.md`; `docs/candidates/task-ai-deadline-20261021/README.md`. | Završiti signed Save, listanje i matching za oblasti; zasebno rešiti deadline edit writer/snapshot i testirati objavu/izmenu. |
| P1 | Stari task AI review fallback može za REMOTE prikazati `canAccept` bez typed handoff-a; potpisani draft writer tada odbija `HANDOFF_REQUIRED`. Isti pisac odbija i `MY_PRICE` bez iznosa i neispravan `FIXED_WINDOW`. `supabase/migrations/20261019104604_service_handoff_signed_matching.sql:263-299,541-574`; `src/data/reviewFactProblem.ts`. | Klijent sada pre Save/Publish pokazuje konkretno objašnjenje i vodi do ispravke; ni privatni nacrt više ne nudi upis koji bi server odbio. Pripremni review RPC još treba ujednačiti na DEV-u i potvrditi potpisanim REMOTE tokom. Ovo je otklonjen slepi klik u klijentu, a ne dokazana server E2E objava. |

## Pre kandidata APK-a

Za svaki red dokazati: (1) autoritativni read/write ugovor, (2) dve perspektive i dozvoljene prelaze, (3) grešku/nepotvrđen ishod/Back, (4) lokalni test, (5) DEV signed probu, (6) HONOR vizuelni i dodirni prolaz. Posebno proći `3/3 → 2/3 → zamena`, povučenu prijavu, preklop vremena, obradu i oporavak AI-ja, grupni čet, push cilj i brisanje. Figma prototip i izvorni testovi nisu zamena za ta izvršavanja.
