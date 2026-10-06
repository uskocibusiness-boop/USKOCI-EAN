# Radni AI profil V2 — izolovan ugovor, 2026-10-03

**Status: PARTIAL SOURCE IMPLEMENTATION / NOT DEPLOY READY. WPP02-A ima forward SQL kandidat; PostgreSQL/CI dokaz nije izvršen. Ceo V2 nije završen.**

Ovaj dokument konkretizuje preostali V2 deo [ličnog radnog profila](WORKER_PERSONAL_PROFILE_20261003.md). Kandidat je [worker-personal-v2-20261003](../../../supabase/candidates/worker-personal-v2-20261003/README.md). Ne menja primenjeni WPP01, Edge v18/v52, postojeći klijent, sertifikate ili podatke. Prvi korak bio je ugovor; naknadni konkretan SQL rez i njegove granice navedeni su ispod.

## Naknadna izvorna implementacija WPP02-A

Implementirani su četiri kanonska preference polja, validacija, proširen postojeći authority guard, privatni owned read/replace primitive i jedan dispatch-only predicate za detailed/cheap putanju. [Forward SQL](../../../supabase/candidates/worker-personal-v2-20261003/candidate.sql) proverava 11 stvarnih prethodnih funkcija i relevantnu šemu/ACL/trigger stanje. Menja tri postojeća tela, dodaje četiri privatne funkcije. Ne menja manual eligibility, score, iskustvo, V1 AI writer ili obaveštenja.

Cheap selekcija ranije nije imala detailed same-day HITNO filter. Zajednički helper usklađuje taj deo; ukupne dve funkcije i dalje imaju različite svrhe i neke sopstvene uslove. Ne tvrdi se da su sve njihove odluke globalno iste.

Privatni writer: auth → closure shared advisory lock → owned DRAFT/ACTIVE profile lock → preference row → expected-document provera → upis. Nema public endpoint-a/granta; future potpuni AI review writer mora dodatno vezati verziju, registry, source hash, notification revision i receipt. Samostalno pozivanje primitive iz aplikacije nije implementirano. Opisne napomene ne ulaze u dispatch filter.

Nezavisan source pregled ispravio je redosled closure/profile lock-ova, granicu editabilnog profila i potpune signature/security metadata pinove rollback/resume helper-a. [Kompatibilna pauza](../../../supabase/candidates/worker-personal-v2-20261003/compatible-rollback.sql) čuva sve kolone i vrednosti, odbija novi upis sa PT409 i pauzira automatski izbor kada postoje novi filteri; ne vraća slanje odbijenih poslova. [Resume](../../../supabase/candidates/worker-personal-v2-20261003/resume.sql) prihvata samo tačno pauzirane funkcije.

Lokalno izvršeno: osam SQL/PLpgSQL source/grammar granica, 18 semantičkih Node provera, JS syntax i workflow YAML. Nema PostgreSQL runtime rezultata. Pripremljeni [manual-only workflow](../../../.github/workflows/worker-personal-v2-candidate-proof.yml) ponovo koristi WPP01 disposable replay i postojeće dependency verzije. Na računaru nema PostgreSQL/Docker/WSL, a root je prijavio nedostupan GitHub Actions pristup. Pripremljeni stvarni Auth/PostgREST/SQL slučajevi zato su **NOT RUN**, uključujući prave lock overlap slučajeve.

Potpuni AI/export/certificate paket ostaje potreban. [Granica budućeg approval artefakta](../../../supabase/candidates/worker-personal-v2-20261003/APPLICATION_BOUNDARY.md) konkretno navodi šta budući kompletan APPROVAL.md mora sadržati; nije zahtev za primenu parcijalnog SQL-a.

## Najmanji potpun sledeći rez

Jedan postojeći AI razgovor → verzionisan nacrt → kompletan zamrznut pregled → **jedna atomska potvrda** ličnog profila, radnih izbora i uskog WORKER podskupa obaveštenja → isti sačuvani pregled. Ponovo koristiti postojeće sesije, poruke, review/save/recovery mehanizme. Ne dodavati drugi razgovorni sistem, katalog alata, licence ili trajnu veličinu tima.

| Podatak | Autoritet i promena | Značenje |
| --- | --- | --- |
| Šta umem / čime se bavim | Postojeći `app_profiles.skills` i `bio` | Sačuvati stvarni slobodan opis; 11 grupa nije zamena za sposobnosti. |
| Šta želim / ne želim među podržanim grupama | Nova `worker_match_preferences.desired_work_kinds` / `declined_work_kinds`, `text[] not null default '{}'` | Samo dodatno sužavanje automatskog izbora. Ne menjati ručnu prijavu ili hard `exclusions`. |
| Precizne napomene i ograničenja | Nova `worker_match_preferences.work_notes`, `text[] not null default '{}'` | Opisni izvorni izrazi, **nisu izvršivi filteri**. Predlog granice: 20 različitih nepraznih stavki po 500 Unicode znakova, bez tihog skraćivanja. |
| Iskustvo | Postojeći `app_profiles.years_experience`, integer 0–80 | Uključiti u isti pregled i atomski upis, bez nove kolone ili promene postojećeg matchera. |
| Alat, vozila, područje, vreme | Postojeća polja i location/availability RPC autoriteti | Nastaviti postojeći tok; ne zaobilaziti njihove validatore. |
| Automatski predlozi | Postojeći `worker_match_preferences.proactive_notifications` | Pauza automatskog izbora; odvojeno od kanala dostave. |
| Svi HITNO zadaci | Nova nullable `worker_match_preferences.urgent_tasks_enabled`, default null | null čuva postojeće same-day pravilo; false isključuje sve hitne predloge; true uklanja samo taj dodatni filter. |
| Poslovna obaveštenja i HITNO tokom tihih sati | Postojeći WORKER `notification_preferences.opportunities_enabled` i `urgent_overrides_quiet_hours` | Predložiti samo uz odgovor korisnika, potvrditi u pregledu; sačuvati uz postojeću revision zaštitu. |
| Verzija razgovora | Nova `private.worker_ai_sessions.contract_version`, default `WORKER_PROFILE_V1` | Neizmenjiva verzija sesije; nove V2 sesije dobijaju eksplicitni V2. |

Nijedno od novih polja trenutno nije primenjeno. Ugovor ne menja `minimum_fee_rsd`, hard `exclusions`, zahteve zadatka, rangiranje, dozvolu ručne prijave, globalni `push_enabled`, OS dozvolu, licence/tim ili pravila retencije.

### Tačan slobodan opis ima prednost nad preširokom klasifikacijom

Trenutni `WK-1` ima 11 grupa. `SELIDBE_PREVOZ` obuhvata i nošenje i prevoz. Iz „Mogu da nosim, ne mogu da prevozim” **ne sledi** odbijanje cele grupe. Pozitivna sposobnost ostaje precizna u `skills`; izvorna napomena ostaje u `workNotes`. Bez izričite potvrde korisnika ne dodavati široku grupu u željene/odbijene.

Pregled razdvaja „Vrste predloga” od „Napomene o poslu”. Za nepotpuno podržano ograničenje ne prikazivati „Neću ti slati takve poslove”. Primer tačnog prikaza: „Sačuvana napomena: mogu da nosim, ne mogu da prevozim. Automatski izbor još ne razlikuje ove poslove.” Ako korisnik traži garanciju takvog filtriranja, taj deo ostaje jasno nezavršen; opisni upis nije dokaz primene ograničenja.

Prazna lista željenih čuva postojeću selekciju. Neprazna traži presek klasifikovanih grupa zadatka; neklasifikovan zadatak tada ne prolazi novi filter. Bilo koji presek sa odbijenim grupama blokira automatski izbor i kada druga grupa jeste željena. Ova pravila ne proizvode sposobnost, alat, slobodan termin ili pravo na prijavu. Detaljan i jeftini matcher moraju imati istu semantiku.

### Korisna potpitanja, bez formulara u četu

Intervju najpre čita poznate činjenice i pita samo ono što nedostaje ili je nejasno:

1. „Čime se baviš i kakve poslove želiš da radiš?” — sačuvati konkretne zadatke i sopstvene reči.
2. „Da li postoji nešto što ne želiš ili ne možeš da radiš?” — razlikovati želju, ograničenje i nedostajući resurs; ne pretvarati sve u hard zabranu.
3. Dopuna relevantna odgovoru: npr. nošenje → stepenice/teret ako je potrebno; prevoz → sopstveno vozilo. Ne prolaziti kompletan katalog.
4. Područje i raspoloživost kroz postojeće strukturisane autoritete; razjasniti grad/radijus i jednokratno naspram ponavljajućeg vremena.
5. „Želiš li i hitne poslove?” Odvojeno pitanje o tihim satima samo kada je primenljivo; prihvatanje hitnih poslova nije dozvola za globalni push.
6. Kratak potpun pregled sa zasebnom ispravkom činjenice, napomene i stvarno primenjenog filtera.

Iskustvo je već uslov postojećeg matchera, ali V1 intervju ga ne upisuje. V2 može jednom pitati koliko godina relevantnog iskustva korisnik želi da navede, kada je to korisno. Prihvatiti samo eksplicitni ceo broj 0–80, bez zaključivanja iz godina života/zanimanja i bez sabiranja paralelnih poslova. Ako odgovor razlikuje više oblasti, postojeći jedan broj to ne predstavlja: sačuvati opis, tražiti pojašnjenje za zajednički broj ili ostaviti vrednost. Vrednost 0 sama ne razlikuje neevidentirano iskustvo od potvrđenih 0 godina; ne zaključivati da je korisnik početnik. Ne obećavati da nema iskustvenog gate-a dok je on u motoru.

## Verzija, review, hash i upis

V2 zadržava devet V1 ključeva radi čitanja istorije i dodaje `yearsExperience` i `workPreferences`. Provider i dalje ne sme da menja skrivena `licenses`/`teamCapacity`; WPP01 poređenje sa stvarnim stanjem ostaje. Model ne upisuje podatke: predlaže strogo dozvoljene patch ključeve.

`workPreferences` sadrži: `registryVersion`, `registrySha256`, `desiredWorkKinds`, `declinedWorkKinds`, `workNotes`, `proactiveNotifications`, `urgentTasksEnabled`, read-only `legacySameDayUrgentNotifications`, i `notifications { revision, opportunitiesEnabled, urgentDuringQuietHours }`. Parcijalni patch čuva nepomenute vrednosti; niz se menja samo eksplicitno. Model ne sme menjati registry identitet, revision, legacy flag ili transportnu dozvolu.

V2 source hash mora pokriti postojeći profil (time i iskustvo), lokaciju, raspoloživost, sve navedene radne preference, tačnu verziju i SHA registra, postojanje/default stanje WORKER obaveštenja, njihov revision i pregledani podskup. Trenutni V1 source/hash preference ne obuhvata. Zamrznuti review digest vezuje kompletan kandidat, aktivaciju i base hash; source revision i status razgovora ostaju provereni.

Verzija se dosledno sprovodi u initial/source/hash/document/patch/recovery, prepare/save i service claim/context/dispatch/complete, ne samo na poslednjem save pozivu. Stari javni V1 upisi odbijaju V2 sesiju; V2 klijent čita V1 istoriju i receipt. Predloženi V2 open koji nađe otvorenu V1 sesiju vraća kompatibilni V1 dokument: završiti/recover/eksplicitno napustiti stari razgovor pre novog V2. Ne prebacivati procesiranu/neizvesnu sesiju tiho u novu verziju. Uspešan V1 receipt ostaje dostupan pre novih stale provera.

Upis mora biti jedna DB transakcija. Zadržati postojeći closure guard, save idempotency i zaključavanje session → conversation → profile. Pre čitanja/revalidacije nezavisnih obaveštenja steći postojeći owner/role advisory lock `uskoci:notification-prefs:<aid>:WORKER`, zatim red. Proveriti i dokazati ceo redosled prema svim postojećim writer-ima; prvi upis nedostajućeg profila/prefs reda zahteva istu stabilnu serijalizaciju, ne samo `FOR UPDATE` nad nepostojećim redom.

Pod istim lock-om ponovo proveriti base hash i notification revision. Spojiti samo dva pregledana notification polja sa aktuelnim kompletnim podešavanjima. Ako nema promene, nema posebnog notification upisa niti stvaranja reda pristanka. Direktne izmene zaštićenih preference kolona zatvoriti postojećim authority obrascem, uz očuvanje location/availability i erasure putanja. Konflikt koristi postojeći PT409, ne 40001. Nepoznat rezultat proverava se postojećim receipt/recovery tokom.

## Export i erasure: postojeća prepreka, ne V2 popravka

Metadata je ponovo pročitana 2026-10-03, 19:35–19:40 UTC. [Binding summary](../../../supabase/candidates/worker-personal-v2-20261003/evidence/live-binding-summary.json) i [export gate](../../../supabase/candidates/worker-personal-v2-20261003/evidence/live-export-gate.json) beleže:

- `retention_ai_source_ready = true`; WPP01 closure source i erasure digests nepromenjeni.
- Postoje 52 export dataseta i postojeći projection SHA.
- `private.retention_policy_sets` ima **0 redova**; efektivnih/nepenzionisanih redova takođe 0.
- `private.data_export_policy_binding()` vraća **null**.

**Prazan policy binding je postojeće stanje pre V2.** V2 ga ne sme potajno „osvežiti”, izmišljati pravni/policy zapis ili označiti export kao gotov. Source readiness ne dokazuje export policy readiness. Ranija preporuka „refresh postojeće policy instance” sada nije dovoljna: trenutno nema instance koja može da se osveži. Potrebno je odvojeno razrešenje stvarne policy instance u njenom postojećem vlasničkom/legal procesu; ovde se ne predlažu pravni tekstovi ili trajanja.

Postojeći `data_export_snapshot` ne izlaže ove kanonske matching preference ni `years_experience`; `data_export_worker_candidate_v5` allow-list izostavlja nove ključeve iz draft/review projekcije. Sledeći atomski kandidat mora:

- Proširiti postojeći `profiles` dataset sa `yearsExperience` i `workPreferences`, bez novog dataseta; uključiti opisne napomene.
- Verzionisati export AI nacrta/pregleda, očuvati V1 projekciju i izložiti verziju sesije za pravilno tumačenje.
- Uključiti svaki novi tranzitivni projection helper u `data_export_projection_sha_v5` (sada eksplicitno vezuje šest helper-a), katalog i selekciju polja. Predlog identiteta je `OWN_ACCOUNT_V5_11`; to **nije** postojeći aktivni binding.
- Dokazati odbijanje starog binding-a za novu projekciju i očuvati identitet ranije zamrznutih export artefakata.

Erasure već briše ceo `worker_match_preferences` red, postavlja `years_experience` na 0 i rediguje kompletan AI kandidat/review envelope, uz postojeće holds. Nova polja moraju pratiti ove putanje; nema sidecar-a van inventara. To je osnov za dokaz, ne dokaz da V2 brisanje već radi.

Nove kolone/verzija pomeraju schema digest; pojačan preference trigger pomera erasure-program digest; source digest uključuje oba. WPP02 **nije certificate-neutral**. Tačan postimage closure/export admission pripada zasebnom punom paketu. Ne zaobilaziti guard promenom samo hash konstante.

## Šta je dokazano lokalno

`node --test supabase/candidates/worker-personal-v2-20261003/preferences.contract.test.mjs`:

**18/18 PASS.** Testovi proveravaju 45 zamrznutih body-MD5 pinova i zatvorenu klasifikaciju, strogo čitanje/patch, očuvanje slobodnih napomena bez lažnog filtriranja, prednost odbijenih grupa, 24 kombinacije HITNO/legacy ponašanja, odvojenu selekciju i dostavu, registry stale, revision konflikt, očuvanje globalnog push pristanka i iskustvo 0–80.

To je dokaz konzistentnosti izvršive specifikacije sa snimljenim metapodacima. **Nije SQL/Auth/concurrency, provider, native ili push dokaz.** `preflight.readonly.sql` samo poredi funkcijske pinove; nije instalacija, ne upisuje redove i ne proverava celu projektnu ekvivalenciju. U ovoj izradi nije izvršen; svež metadata snimak je već sačuvan.

## Tačno preostali implementacioni paket

1. Kompletan forward SQL i realno ograničen revert: verzionisani autoriteti, canonical polja/guard, atomski notification merge, detailed/cheap matching i export u istom deklarisanom diff-u. Sveži baseline pinovi pre izrade.
2. Disposable SQL/Auth dokaz: V1 save/replay; V2 owner isolation/direct-write guard; stale source/registry/revision; prva kreiranja redova; **stvarno preklapanje** settings-save i AI-save; atomski commit/recovery; matching parity bez promene manual eligibility; export/erasure/holds i tačni closure postimage-i.
3. Odvojeno razrešiti postojeći prazan export-policy binding i pripremiti tačan certificate/export admission. Bez toga ne proglasiti paket spremnim za primenu.
4. Postojeći client journal/strict decoder, intervju, review i saved summary učiniti V1/V2 kompatibilnim; Edge koristi serversku verziju i navedena potpitanja. Vizuelno proveriti stvaran razgovor → pregled → sačuvano → obaveštenja.
5. Tek nakon kompletnog dokaza i odgovarajuće primene proveriti stvarni provider/push u zasebnom ograničenom koraku. Postojeći dokazi uspešnog push-a ostaju važeći za svoj raniji opseg.

Pre stvaranja V2 podataka moguć je samo prethodno dokazan tačan revert. Posle V2 nacrta/review/upisa ne brisati kolone ili istoriju: isključiti novo V2 otvaranje i uraditi kompatibilan forward rollback uz očuvanje čitanja/exporta. Ovaj kandidat ne tvrdi da je taj rollback već implementiran.
