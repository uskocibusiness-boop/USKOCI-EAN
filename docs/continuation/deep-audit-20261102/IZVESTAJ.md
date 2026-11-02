# USKOČI — poređenje plana, izvora, DEV-a i Android prikaza, 02.11.2026.

Ovo je datirani dokazni izveštaj, **ne novi master niti drugi backlog**. Izvršni autoritet ostaje [CODEX_PLAN_RADA.md](../../plan/CODEX_PLAN_RADA.md), a proizvodni [USKOCI_PRODUCT_UX_MASTER.md](../../product/USKOCI_PRODUCT_UX_MASTER.md). Prioriteti ispod samo povezuju postojeće R/C/SV ugovore sa novim dokazom.

## I. Izvršni zaključak

1. USKOČI ima upotrebljivu osnovu i stvaran napredak; nije opravdano prepisivati aplikaciju ili menjati Dual Gemini arhitekturu.
2. Postoji stvaran DEV/Android dokaz aktivnog REMOTE radnog profila bez obaveznog grada i objavljenog REMOTE zadatka, sa povezivanjem na isti potvrđeni ID usluge.
3. To su objekti istog vlasnika, pa ne dokazuju da drugi korisnik dobija priliku, prijavljuje se, sklapa Dogovor i završava saradnju.
4. Potvrđene AI odluke sada prolaze žive batch/binder/REMOTE/sync provere bez zahteva da prirodan naziv bude upisan globalni sinonim.
5. Prva pozadinska klasifikacija i dalje nema dovršen trajan posao za oporavak posle prekida.
6. Važni delovi matching-a, satnice, slepih ocena, privatnosti i životnog ciklusa podataka još nisu završeni na DEV-u.
7. Postojanje `price_basis` kolona popravilo je čitanje, ali nije završilo satnicu kroz prijavu i Dogovor.
8. Zeleni glavni CI potvrđuje veliki source/test obuhvat; ne potvrđuje sve žive poslovne ugovore.
9. R01 i dalje pada pre stvarnog Auth/PostgREST prihvata, a preširoko pravo čitanja `needs` postoji i na današnjem DEV-u.
10. UI ima postojeći brand i dobre zajedničke komponente, ali mapa, Dogovori i formalno obraćanje još odstupaju od Product mastera.
11. Nije potvrđena isporuka push-a na uređaj; cron uspeh nije taj dokaz.
12. Interna proba vlasnika može da se nastavi na TEST podacima; opšta zatvorena beta i javno izdanje još nisu spremni.
13. Najkraći put je završavanje malog broja povezanih lanaca u postojećim vlasnicima, a ne novi plan, nova arhitektura ili uklanjanje svih zaštita.

## II. Tačan checkpoint i granice revizije

| Predmet | Potvrđeno |
|---|---|
| GitHub/lokalno | `work/rev14-review-f17@ec7abd509ff20246ddff0aa4f74725b74a3d11db`; runtime `4b9755364a7f87dc93d456ff4d7fb56ee67092a5` |
| PR | [#43](https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43), OPEN/DRAFT, baza `feature/uskoci-cisto`; 469 commitova u trenutku čitanja |
| Radno stablo pre audita | Bez tracked izmena; korisnički `.codex-remote-attachments/` nije čitan niti menjan |
| Glavni CI | [41498974039 SUCCESS](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41498974039): 626 mobile suite / 14.585 testova; AI 1.611 PASS / 0 FAIL / 1 postojeći TODO; TS, 12 Edge check-ova, SQL/PostGIS i migration integrity |
| R01 | [41498973974 FAILURE](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41498973974); PR projekcija `d79c6e05570e1f4554727608d9d567ec40bb7da0`; STRICT_PARITY / METADATA_PARITY_DIFFERENT |
| DEV | `leqcwgzvjsxugfgzdmth`; 323 ledger zapisa, od toga 219 sa NULL statements; poslednji `20261102182959` |
| Edge | Need 163, Worker 115, publication 29, post-save 13, push 43, media 28, speech 29, location 31, closure 18, export 28 |
| Poslednje uske DEV izmene | `20261102175412` response price schema; `20261102182959` Need edit resume. Ranije `20261102113012` R04 continuity i `20261102141629` Need complete turn |
| Instalacija | Android emulator API 36, `rs.uskoci.preview`, versionCode 36, runtime `uskoci-v1-preview-r1`; APK SHA256 `fd76da0662f0ddf5c2e8e46cc97668f284117f9ea79375dbf3326dc924375e57` |

**Metod:** pročitan je sadržaj R01–R12, C01–C19 i SV01–SV14 izvršnih ugovora i relevantnih kasnijih checkpointa; Product S01–S18 korišćen je kao ugovor prikaza. Kritične implementacije i promptovi čitani su po telima i pozivnim lancima. Preuzete su aktuelne žive definicije batch/binder/sync/REMOTE, matching, response, reputacije i push funkcija. Pročitani su CI rezultati/logovi, efektivna prava, readiness i cron metapodaci. Pored izvora pregledana su dostupna stanja instaliranog emulatora.

**Granica:** ovo nije tvrdnja da je svaka linija svakog fajla ili svih 31.721 redova Product dokumenta ponovo ručno pročitana. Product dokument sadrži veliki istorijski materijal; pregled je usmeren na važeće ugovore i njihove implementacije. Nisu izvršeni svi loading/error/font/keyboard scenariji svih ekrana. Nisu ponovljeni fizički telefon, drugi Auth nalog, iOS, produkcija ili plaćeni model. Istorijski izvori u source-bridge/payload paketima nisu proglašeni nedostajućim samo zato što raspakovani `docs/plan/dokazi/` ne postoji u ovom checkout-u.

Mašinski presek je u [evidence.json](evidence.json). Dve reprodukcije koriste **stvarna preuzeta DEV tela**, uz minimalne izolovane fixture-e: [funkcije](live-functions.json), [skripta](reproduce-live-gaps.mjs), [rezultat](reproduction-result.json). To nije puna hosted Auth/HTTP proba.

## III. R01–R12 matrica

Status važi za **ceo paket**. Kada paket ima dobar parcijalni dokaz, njegov nivo je naveden zasebno. Nijedan široki R paket nije ovde unapred označen DONE.

| Paket / cilj | Status | Izvedeno i dokaz | Šta ostaje / kriterijum zatvaranja | Prioritet |
|---|---|---|---|---|
| R01 privatnost i isporučeni ugovor | BLOCKED | Postoji izolovan kandidat; aktuelni CI dijagnostikuje platformu. Sveža DEV prava potvrđuju široki SELECT. | Sužavanje tri privatna polja uz očuvane javne/owner čitače; stvarni dva-naloga Auth/PostgREST negativni i pozitivni dokaz; razrešen relevantni parity. | P0 pre spoljašnjih korisnika |
| R02 Discovery/mapa/filteri | PARTIAL | Aktivna lista/mapa i REMOTE prikaz postoje; pregledani emulator i PAGE RPC. | Finalni jedan tok mape/liste, shell, filteri, ForMe; P6 MAP/PLACES nije implementiran na DEV-u. Ne uključiti flag unapred. | P1 |
| R03 kolekcije/paginacija | PARTIAL | Source/CI pokriće keyset/owner stranica, kasnije DEV owner read izmene; sopstveni zadatak otvoren na emulatoru. | Potvrditi sve aktivne gate-ove, kompletno straničenje bez duplikata i lažnog praznog rezultata, filter/promena naloga/povratak. | P1 |
| R04 klasifikacija/identitet | PARTIAL | Živi commit/binders/sync/REMOTE sadrže signed semantic witness; REUSE REMOTE task/profile ima raniji DEV+Android dokaz. Novi multi-service izbori u Worker115. | Nova grana, EXTEND_MODE, više usluga/BOTH/handoff kroz model→review→Save→readback→matching; kandidat test nije native rezultat. | P1 |
| R05 područja/vreme/matching | PARTIAL | Potvrđene oblasti i matching postoje; saved-area/TODAY kandidati imaju izolovan PostGIS/SQL i CI dokaz. | Na DEV-u je stari prefilter i TODAY telo. Jedan dozvoljen par mora proći retrieval→fit→ForMe→dispatch. | P1 |
| R06 pouzdan AI/trošak | PARTIAL | Bounded transport, odvojen BG obračun, capture readback, cache ograničenja, post-save13; edit resume DEV/native potvrđen. | Durable first-plan odsutan; kompletan UNKNOWN oporavak, produkcioni per-account/global limit i kraći čekani tok. | P1 |
| R07 prijava/izbor/cena/Dogovor | PARTIAL | Cena TOTAL proporcionalna broju ljudi; verzije/idempotentnost/readback; response kolone DEV potvrđene. | Živi MY_PRICE HOURLY pada; writer/version/selection/Agreement jedinica nisu povezani; dva naloga, stale/withdraw/select/cancel/complete. | P1 |
| R08 radni profil | PARTIAL | REMOTE bez grada aktivan; potvrđeni ID/mode/handoff prikazani; per-service izmena u aktuelnom Edge-u. | Više usluga/BOTH/radionica, izmena bez gubitka prava, namerno uklanjanje i automatski match; razrešiti `Mogu odmah` TTL kontradikciju. | P1 |
| R09 poruke/media/push | PARTIAL | Outbox/draft, kasni ACK, voice/photo journal, target RPC i transport postoje; empty inbox native. | Push readiness zastareo; PUSH-only target traži IN_APP; kapacitet/two-device/group događaj; realni media/poruke između dva naloga. | P1 |
| R10 izvoz/retention/closure | BLOCKED | Postoje lifecycle radnici/guardovi; ne tvrde lažni uspeh. | `source_ready=false`, export/erasure NULL; workAreas nedostaje u export projekciji; kopije/Storage/Auth brisanje i pravni sadržaj. | P1 / release blocker |
| R11 oporavci/ocene/cleanup/UX | PARTIAL | Mnoge source+CI popravke: receipts, drafts, formalni delovi, public comments, voice recovery, deo cleanup-a. | Slepe ocene/world granica nisu na DEV-u; PHONE legacy, copy/screen delte i preostali C/SV ugovori. | P1, čist dekor P2 |
| R12 izdanje i stvarna celina | BLOCKED | Novi poznat preview APK instaliran uz očuvan Auth; osnovni REMOTE i edit-resume dokaz. | Produkcija namerno blokirana; potpisani AAB, push build, stores/business, dva korisnika; iOS source adapter postoji ali nema uređajskog dokaza/naloga. | P1 / release blocker |

### R01: šta tačno pada i zašto nije dovoljno ignorisati ga

R01 sadrži **dve različite stvari**: stvarnu privatnosnu popravku aplikacije i dokaz da testno okruženje dovoljno verno predstavlja živi Supabase. Današnji CI pada na drugoj stvari, pre primene kandidata i Auth/HTTP prihvata. Osam strict razlika čine ACL upravljane relacije, nedostajuća membership putanja, dva role-setting zapisa, jedna uloga i tri vlasnika ekstenzija. Dodatno postoje 49 extension owner/ACL i tri managed-net razlike (`helper.config_md5`, `body_md5`, `definition_md5`).

Dosadašnji rad nije bio bez rezultata: napravljen je pinned CLI bootstrap bez nametnutog webhook-a, dokazano da prerequisites nisu promenili 49 rutina, proveren native pg_net izvor/invoker i pojedini efektivni putevi. I dalje nema dokaza istorije hosted provisioning-a i pune jednakosti. Četrdeset devet rutina su pgcrypto 36, uuid-ossp 10 i pg_stat_statements 3; to nisu 49 kvarova korisničkih ekrana.

**Naš nezavisan kvar ostaje:** `authenticated` danas ima table SELECT na `public.needs`, uključujući `requester_account_id`, `remaining_search_closed_by_account_id`, `remaining_search_close_reason`. Pročitana su prava, ne tuđi poslovni sadržaj; nema tvrdnje o dokazanom anonimnom ili cross-world curenju. RLS ograničava redove, ali table SELECT otvara sve njihove kolone.

Bezbedan nastavak: pribaviti tačno nedostajući platform provisioning dokaz, pa izvršiti jednu novu reprodukciju tek sa novom hipotezom; paralelno pripremiti i dokazati usku privatnosnu migraciju nad stvarnom Auth/HTTP granicom. Sačuvati legitimate čitače i kompatibilnost. Masovno prepisivanje vlasnika/ACL-a ili slabiji checker ne dokazuju da privatna kolona više nije dostupna. Nezavisni UI/AI/source rad ne mora čekati R01, ali javni izlaz ne sme preskočiti privatnost. Već odobrene uske DEV operacije imaju svoje pre/postflight dokaze; one nisu R01 PASS.

## IV. Korisnički tokovi, AI i ekrani

### A. Nalog i sesija

`src/data/authClientService.ts` proverava redirect konfiguraciju, mapira Auth neuspehe, revokuje push pri odjavi i pokreće account-scoped čišćenje lokalnih redova/nacrta. Identitet AI zahteva se potvrđuje preko Auth-a, ne uzima se iz proizvoljnog body account ID-ja. To treba sačuvati. Registracija→stvarni mejl→deep link, password recovery, A→B→A i account closure nisu dokazani današnjim prijavljenim emulatorom. SMTP/redirect/rate-limit management konfiguracija i domen nisu proglašeni proverenim samo zato što login trenutno radi.

### B. Šta Dual Gemini stvarno radi

Prvi model vodi razgovor i daje strukturisane činjenice, drugi radi semantičko povezivanje sa katalogom. Zadatak ostaje jedan konkretan posao; radni profil može imati više usluga sa zasebnim modovima. `BOTH` se prikazuje korisniku kao kombinacija, ali ugovor čuva dva potvrđena para usluga/mode. REMOTE uključuje rad bez odlaska kod naručioca; fizička predaja radionici ima poseban handoff, pa REMOTE nije automatski „bez ikakvog mesta ili predaje”.

Stablo ne mora da čita razgovorni model za svaku poruku. U aktivnom Dual putu pozadinski klasifikator dobija pun dinamički parent-first katalog kada se promeni relevantna usluga/smisao/mode/handoff. Loader proverava count, unique ID-jeve, parent closure i potpuno straničenje; nepotpun katalog ne proglašava kompletnim. Egzaktno poznata Need usluga može izbeći novi model poziv. Izmena biografije sama ne treba da pokrene novu Worker klasifikaciju.

**Upis:** model predlaže postojeći ID ili novu putanju. Korisnik potvrđuje razumljiv pregled. Batch proverava vlasnika, potpisani sadržaj, reviziju, mode/handoff, idempotency i važeći katalog; nova kategorija dobija ID na serveru. Binder povezuje taj ID sa tačnom Need revizijom ili sačuvanim Worker profilom. Server više ne traži globalni sinonim za svaki prirodan naziv kada postoje validni potpisani dokazi. Globalni alias se time ne stvara i tuđe sposobnosti se ne nasleđuju.

**Šta je dobro u promptovima:** traže jedno stvarno potrebno pitanje; razlikuju prozu od trajnih činjenica; ne traže da korisnik administrira katalog; predviđaju korekcije, vremensku zonu, cenu, broj ljudi, područja i fizičku predaju. Geokodiranje je serversko, a tačan pin potvrđuje korisnik. AI ne sme da izmisli koordinate ili potvrdu korisnika.

**Šta treba popraviti:**

- Need i Worker promptovi imaju preklapanja i stare instrukcije. Worker tekst istovremeno opisuje staru opremu kao prisutnu u signed review-u i kao povučenu iz novog review-a. To treba jednoznačno napisati bez vraćanja obrisanih UI polja.
- Worker prompt kaže da `availableNow` traje dok ga korisnik ne promeni, dok Product S14 zahteva TTL. To je nesaglasnost ugovora, ne stvar za nasumičan SQL timeout.
- Fallback poruke mešaju Vi i ti. I baza `notification_copy_v5` neke formalne poruke pretvara u neformalne; frontend-only zamena nije dovoljna.
- `maxOutputTokens:1024` za klasifikaciju do 24 service/mode para predstavlja proverljiv rizik truncation-a. U ovom auditu nije dokazan konkretan modelski pad zbog tog limita. Proveriti maksimalni podržani izlaz ciljanim fixture-om/odobrenom malom modelskom probom, ne odmah neograničeno povećavati tokene.
- Unchanged-saved-service shortcut u BG builder-u još koristi canonical/alias poređenje naziva. Potrebno je proveriti slučaj sa ranije potpisanim neregistrovanim sinonimom kada se doda druga usluga. SQL continuity već postoji; ovo nije dokaz da svaki takav Save sada pada, već otvorena provera nepotrebnog ponovnog modelskog rada/potpunosti predloga.

### C. Brzina, čekanje, trošak i oporavak

Razgovor u aktivnom Dual putu ne čeka završetak celog pozadinskog klasifikatora da bi završio foreground odgovor. Ipak čeka odgovor modela, validaciju i potvrđeni SQL completion; tekst se prikazuje tek zatim. SSE `text_delta` ovde nije garancija vidljivog toka reč po reč od prvog provider tokena. Prikaz statusa treba da bude brz, ali „Gemini Flash mora sve za delić sekunde” nije izmeren ugovor ove aplikacije.

Pozadinski klasifikator ima 9 s, uspešan pravovremen rezultat dobija odvojenih 7 s za persistence/readback, settlement ima svoj ograničen tok. Time je otklonjeno ranije gubljenje već plaćenog uspešnog odgovora. Međutim, `waitUntil` i log greške nisu trajan posao: **tabela first-plan poslova ne postoji na DEV-u**, a aktivni handleri nemaju povezani durable enrollment. Post-save red obrađuje već postojeći plan; ne može obnoviti onaj koji nikada nije nastao.

Ranije merene probe nisu cena jednog normalnog budućeg razgovora: ukupno 21 obračunat poziv iz razvojne probe iznosio je 0,325375 USD, uz jedan raniji UNKNOWN sa rezervacijom do 0,25 USD. Kasnija uspešna dopuna+klasifikacija+provera objave bila je 0,024223 USD prema internom usage zapisu. To nisu faktura provajdera ni garantovani prosek. Kompaktovanje istog potpunog kataloga i uklanjanje duplog prefetch-a već su urađeni. **U ovom auditu nije bilo novih plaćenih poziva.**

STT stari nalaz „nema transkripta pa refund” više nije tačan za aktuelni source: poslati audio bez potvrđenog ishoda zadržava rezervaciju; samo nula audio/nula output otvara unused release. Ali produkcioni globalni/per-account limit, razrešenje UNKNOWN i nadzor stvarnog računa još nisu kompletan release dokaz. Ostaviti eksplicitni provider cache za kasnije osim ako merenje pokaže jasnu korist.

### D. Lokacija, discovery i matching

Sačuvane CITY/RADIUS/COUNTRY oblasti, do pet oblasti ili jedna COUNTRY, imaju postojeći ugovor. Nova REMOTE usluga ne dobija izmišljen grad radi aktivacije. UI REMOTE zadatka ne prikazuje lažan pin/distance.

**Otvoreni živ problem:** fizički `candidate_profile_ids_v1b` i dalje koristi staru profilnu geografiju i prefilter 300 km pre konačnog fit-a. Radnik sa udaljenom starom tačkom i validnom dodatnom sačuvanom oblašću može biti izbačen prerano. `worker_saved_area_candidates_v1` na DEV-u ne postoji; R05 testirani kandidat nije prenet. TODAY time-tier telo takođe ostaje preimage. Ne može se tvrditi „matching završen” iz jedne REMOTE objave istog vlasnika.

REMOTE prilika ne treba da ide nasumično svim nalozima: i dalje važe odgovarajuća usluga/mode, vreme, aktivan profil, TEST/REAL, blokade, preference i transportna pravila. Ručna prijava ima odvojene hard gates; ne zabranjivati je samo zato što automatska preporuka nije izabrala radnika.

P6 flag je 0 u oba EAS profila. Živi `rpc_discovery_v1` podržava PAGE/EXACT_PUBLIC, ali MAP/PLACES odbija; filter whitelist ne predstavlja ceo odobreni ForMe/filter ugovor. Prebacivanje zastavice nije završetak implementacije. Lista i map preview već dele `TaskRecordBody/useTaskRecord`; tu zajedničku činjenicu treba sačuvati.

### E. Prijave, izbor i Dogovor

Živi submit proverava vlasnika, isti svet, aktivnost profila, rok/reviziju, slobodna mesta, stvarni interval i idempotency; isti request key vraća prvi receipt. Novi nullable response `price_basis` popravio je nedostajuću kolonu, ali **živi submit je ne upisuje ni u response ni u version**.

Stvarno `private.assert_application_price_v5` telo prihvata TOTAL proporcionalno originalnom broju ljudi i stari PER_PERSON; HOURLY za MY_PRICE završava sa `UNKNOWN_PRICE_BASIS`. Izolovano izvršeno: TOTAL 6.000 RSD / 3 mesta, prijava za 2 = 4.000 prolazi; MY_PRICE HOURLY 1.000 pada. Potrebno povezati osnovicu kroz submit, content hash, version, selection, frozen Agreement, izmene, prikaz i export. Ne popravljati samo natpis „po satu”.

Agreement outbox je stvarna korisna zaštita: čuva komandu pre mreže, isti ključ pri oporavku, ne pretvara kasni ACK u duplikat i ne meša vlasnike. Photos i voice imaju odvojene životne cikluse jer imaju različite upload/commit ishode; to nije samo po sebi nepotrebno dupliranje. Na današnjem nalogu nema Dogovora, pa kompletna privatna/grupna komunikacija, foto/glas, izmena uslova, prekid mreže, otkazivanje i završetak nisu ponovo native dokazani.

### F. Ocene i reputacija

Jedna reputacija naloga je dobra odluka i postoji zajednički read put. **Slepo objavljivanje još nije na DEV-u:** `private.account_reputation` neposredno računa sve ocene ciljnog naloga, a publication helper ne postoji. Izolovano izvršeno stvarno telo vraća `reviewCount=1, averageRating=5` čim postoji jedna ocena. Javnom RPC-u nedostaje kandidatova eksplicitna same-world provera; to je definicijski gap, ne dokaz anonimnog pristupa ili stvarno pročitanog tuđeg sadržaja.

Postojeći R11b testovi proveravaju **kandidat** za obe ocene ili 14 dana od završetka i zasebne sintetičke readere. Oni nisu deployment. Promeniti sve relevantne agregate/čitače i događaje zajedno, pa dokazati vidljivost pre/posle druge ocene i roka, uz blokirane/zatvorene i TEST/REAL naloge.

### G. Push, podešavanja i život podataka

Sva tri cron posla su aktivna na minut; svaki je imao 30 uspešnih SQL izvršenja u svežem prozoru od 30 minuta. Ali poslednji `push_runtime_readiness` ostaje `TICK_OK` iz **23.10.2026. 22:23 UTC**, dakle nije svež. Ne zaključuje se da scheduler ne radi niti da push radi.

Transport43 obrađuje po jedan receipt i jedan send u tick-u; to je postojeće ograničenje kapaciteta koje treba izmeriti. Tačan opportunity target u globalnom tick-u nije automatski aktivan. Živi message/opportunity target readeri zahtevaju IN_APP delivery, pa PUSH uključeno / IN_APP isključeno nema zatvoren nezavisan target ugovor. Običan preview APK namerno koristi inertni Firebase put; potreban je odgovarajući push kandidat i pravi uređajski dokaz.

PushPreferences već ima readback/reconcile za delimičan requester/worker save — stari nalaz „nikakav reconcile” je zastareo. Ali pending intent je memorijski; potpun restart sa delimičnim upisom nije time završen. LegalReview već podržava isti-key replay za ABSENT i nov prikaz posle stvarno promenjenog bundle-a; to nije dokaz pravne ispravnosti sadržaja.

R10 ne treba otključavati promenom flag-a: `retention_ai_source_ready=false`, export i erasure binding NULL, a aktuelni worker export projektor nema workAreas. Mora se zatvoriti sadržaj projekcije, inventar životnih kopija, Storage i Auth brisanje, pa legitimno obnoviti dokaz. Ne izmišljati da su Edge export/closure verzije dovoljne.

### H. Ekran po ekran — S01–S18

| Ugovor | Stvarno stanje i potrebna završnica | Nivo dokaza |
|---|---|---|
| S01 Početna | Brand, dve glavne akcije, avatar i četiri taba postoje. „Nastavi/Izaberi” odstupa od Vi. | Aktuelni Android render; PARTIAL |
| S02 Zadaci | Lista, map i REMOTE postoje; stari map prikaz bez istog root nav-a; P6/MAP/ForMe nesaglasnost. Nema fizičkog pina za native test u sadašnjem sadržaju. | Source + živi RPC + Android; PARTIAL |
| S03 detalj zadatka | Sopstveni objavljeni REMOTE detalj i povratak dokazani; shared task facts postoje. Public drugog naloga, fizička lokacija i sva stanja nisu novi dokaz. | Parcijalni DEV/Android |
| S04 prijava | Review i guards postoje; satnica ima živ serverski kvar. | Source/CI + izolovana reprodukcija; bez dva-naloga native |
| S05 Moji zadaci | Nova objava ostaje posle restarta; owner read/page rad prenet. | Parcijalni DEV/Android |
| S06 Moje prijave | Source pager/revision/receipt zaštite i nov schema expand; nema stvarne prijave ovog naloga u ovoj probi. | SOURCE/CI; native sadržaj otvoren |
| S07 kandidati | Izbor/revizije/capacity imaju implementaciju i provere; treba stvarna druga osoba i ispravna jedinica cene. | SOURCE/CI; E2E otvoren |
| S08 Dogovori | Na aktuelnom emulatoru i source-u i dalje `Aktivni | Istorija`, iako master izričito traži jednu vremensku listu i `Prethodne saradnje`. Postojeće grupe/role filter/kalendar sačuvati. | Aktuelno prazno stanje + source; PARTIAL |
| S09 task-group | Postoji grupisanje; potrebno potvrditi više izvršilaca, različite intervale i granice grupnih poruka. | Source/test pokriće, bez aktuelnog populated native dokaza |
| S10 bilateralni Dogovor | Pregled/Poruke i jedan sledeći CTA postoje; footer ne treba ponovo izmišljati. Formalni copy i frozen cena ostaju. | Pročitan Workspace; bez živog Dogovora |
| S11 Poruke | Root prazno stanje postoji i vodi u Dogovore; nema slobodnog DM-a. Copy „tvojim/započinješ” nije usaglašen. | Aktuelni prazni Android; media/pun inbox nisu time dokazani |
| S12 Raspored | Postojeći model i ulaz sa Dogovora; populated Mesec/Nedelja/Dan, zona i povratak traže native prihvat. | SOURCE/CI, nije E2E_PROVEN |
| S13 Moj profil | Jedan identitet i reputacija prikazani; formalni copy delimičan, reputacioni backend otvoren. | Aktuelni Android + SQL |
| S14 Radni profil | Aktivan REMOTE profil, sačuvan opis i usluga/mode/handoff vidljivi; bez administriranja stabla. TTL i multi-service fizički tok otvoreni. | Parcijalni DEV/Android |
| S15 Podešavanja/privatnost/podrška | Postoje domenski ekrani, legal/push recovery source; closure/export nisu spremni, konačni pravni/support sadržaj nije potvrđen. | SOURCE/CI + readiness metapodaci |
| S16 AI zadatak/review/history | Stvarna objava i novi edit-resume postoje. Trenutni resume ima 20 činjenica/0 poruka; ne dokazuje prikaz stare duge istorije. Lokacijski/safety recovery i sve kartice nisu finalno pregledani. | Ograničen DEV/Android + source |
| S17 Auth/obaveštenja | Prijavljena sesija i bell postoje; nov signup/mail/OTP/recovery i push tap na drugom nalogu nisu novi dokaz. | Parcijalno |
| S18 child tokovi | PIN, mediji, location grant, report, legal/export imaju posebne ugovore. Sva empty/error/keyboard/large-font stanja nisu provedena na uređaju. | SOURCE/CI po konkretnom potrošaču; finalni UX otvoren |

Snimci sa vlasnikovim imenom/fotografijom ostaju lokalno u `artifacts/android-preview-4b975536-20261102/` (uključujući `deep-home.png`, `deep-worker.png`, `deep-messages.png`); nisu poslati kao javni GitHub dokaz. Ekran na jednom emulatoru nije potvrda 360dp/1,3×/TalkBack/iOS.

## V. Kvalitet arhitekture i čišćenje bez prepisivanja

| Predlog | Stvarni problem i korist | Rizik / pre lansiranja / odluka |
|---|---|---|
| Zadržati Dual Gemini i signed ID/binder | Odvojeno prirodno razumevanje i bezbedan upis; rešava vlasnikovu nameru. | Prepisivanje visok rizik bez dokazane koristi. **Ne dirati arhitekturu.** |
| Skraćivanje promptova u postojećim modulima | Ponavljanja, stale equipment uputstvo, TTL kontradikcija, duži input. | Srednji rizik promene ponašanja; prvo ukloniti kontradikcije, kratki scenario corpus. Korisno pre beta. |
| Dovršiti durable first-plan u postojećem lancu | Nezavršen tehnički posao izgleda kao da korisnik nije dovoljno objasnio. | Srednji rizik, velika korist; pre pouzdane beta. Bez trećeg modela. |
| Završiti jednu Discovery putanju | Dve zrelosti klijenta/backend-a, neusklađen shell/filtri. | Povezani srednji zahvat; pre beta; ne uključiti P6 pre backend-a. |
| Zadržati TaskRecordBody i postojeće Agreement grupe | Već deljena istina kartice i vremenskog grupisanja. | Mala ciljna UI promena bolja od novog sistema kartica. |
| Formalni copy frontend + SQL | Korisnik dobija mešavinu Vi/ti iz više izvora. | Nizak rizik u statičkim porukama; ne menjati korisnikov tekst ili cele regex fajlove naslepo. |
| Ukloniti samo dokazane mrtve putanje | Manje konkurentnih ulaza i održavanja. | Posle potvrđene zamene; PHONE zahteva usklađeno povlačenje sa servera i klijenta. |
| Odložiti preuređenje svih velikih fajlova i proof arhiva | Veličina sama nije kvar. | Potencijalna regresija bez koristi za prvi posao; **ne raditi pre lansiranja**. |
| Ne dodavati indekse zbog svakog advisor upozorenja | 93 unindexed FK info nisu 93 izmerena uska grla. | Prvo EXPLAIN reprezentativnog upita; optimizovati konkretan retrieval/red. |
| Ujednačiti aktuelni status u postojećem masteru | U istom dokumentu ostali su istorijski „nije implementirano” i kasniji PASS. | Kratak checkpoint + superseded napomena; ne još jedan master. |

### C01–C19

Ranije završeni cleanup paketi zadržavaju raniji source/CI obuhvat; ovo nije novo izvršeno brisanje niti novi native benchmark.

| Paket | Status / odluka sada |
|---|---|
| C01 template resursi | SOURCE_DONE — ranije povučeni; ne vraćati. |
| C02 ručni izbor veština | SOURCE_DONE — AI-first put sačuvan. |
| C03 stari editor činjenica | SOURCE_DONE — važeći AI formatteri ostaju. |
| C04 stari card/layout podskup | SOURCE_DONE — nije dozvola za brisanje svih aktuelnih kartica. |
| C05 registry/stats alternativa | SOURCE_DONE. |
| C06 duplirani identičan test | SOURCE_DONE. |
| C07 stari motion/design-only reference | SOURCE_DONE; ne proglašavati finalnu animaciju svih ekrana. |
| C08 V1 port/fake AI | SOURCE_DONE za odobren povučeni podskup; aktivne legacy guard-ove ne poistovećivati sa fake AI. |
| C09 nepovezani owner review builder | SOURCE_DONE. |
| C10 AI alternativne strategije | PARTIAL — flagovane grane još postoje; mapirati stvarni podržani deploy pre povlačenja. |
| C11 PHONE | NOT_STARTED za celovit kompatibilni izlaz — živi grant/reveal put ostaje; EXACT_LOCATION odvojeno. |
| C12 budući GPS/permission dead code | SOURCE_DONE; ne uklanjati aktuelni geocoder/pin. |
| C13 javni komentari | PARTIAL — čitač je povezan; raniji predlog „dead consumer” OBSOLETE. Server publication ostaje otvoren. |
| C14 stari testovi | PARTIAL — pojedini stari oracle-i ispravljeni; nema opravdanja za masovno brisanje zaštita. |
| C15 zelena karakterizacija kvara | PARTIAL — razlikovati reprodukciju od acceptance; konkretan R11b test proverava kandidat, ne DEV. |
| C16 dokazni/generator fajlovi | NOT_STARTED za šire povlačenje; uglavnom odložiti, sačuvati migration provenance. |
| C17 test/build katalog | PARTIAL — 12/12 Deno sada provereno, stari 4/12 nalaz OBSOLETE; nije dokaz da je sav tooling dug zatvoren. |
| C18 identične premium slike | SOURCE_DONE — prethodni izmereni repo-byte cleanup; nema novog APK size benchmarka. |
| C19 SQL/proof blizanci | NOT_STARTED za široko uklanjanje; odložiti dok se ne potvrde svi potrošači/manifesti. |

### SV01–SV14

| Paket | Status / DEV zaključak |
|---|---|
| SV01 privatne Need kolone | BLOCKED — široki SELECT i dalje stvarno prisutan; R01. |
| SV02 katalog/hijerarhija | PARTIAL — kompletan validiran snapshot i kompaktniji prompt; uslovni stamp/NOT_MODIFIED nije kompletno zatvoren. |
| SV03 semantika/first-plan | PARTIAL — semantic admission/binder na DEV-u, durable first-plan nije. |
| SV04 post-save | DEV_PROVEN samo za isporučeni transport/ugovor verzije13; puni lost-ACK lifecycle i prvi-plan ne zaključivati iz toga. |
| SV05 cron/push | PARTIAL — cron uspešan, readiness zastareo, exact target/capacity/device otvoreni. |
| SV06 lifecycle | BLOCKED — false/NULL binding i workAreas export gap. |
| SV07 stari intake delete | NOT_STARTED za povlačenje; funkcija još postoji, referiše odsutne stare relacije. Owner guard postoji; anon grant nije dokaz anonimnog brisanja. |
| SV08 PHONE | NOT_STARTED za kompatibilan messages-only prelaz; postojeći exact-location grant sačuvati. |
| SV09 legacy taxonomy wrapper | DEV_PROVEN za bezbedno izričito odbijanje; brisanje nije potrebno za prve korisnike. |
| SV10 sedam backup tabela | NOT_STARTED za povlačenje; šest ima lifecycle zavisnosti po postojećem inventaru. Ne brisati zato što nema PK. |
| SV11 dupli indeks | NOT_STARTED — lookup postoji; mala ušteda nije launch blocker. |
| SV12 dijagnostika | PARTIAL — istorijski 410 stub status ne odobrava brisanje debug podataka; tabela postoji. |
| SV13 hardening | PARTIAL — search_path/pg_net/leaked-password upozorenja otvorena; nisu sva eksploatabilne rupe. |
| SV14 provenance/bootstrap | BLOCKED za release — source193 / DEV323, 219 NULL statements. To nije 130 neprimenjenih migracija. Potreban reproduktivan bootstrap i upgrade. |

Aktuelni security advisor ima mnogo privatnih RLS-without-policy i security-definer upozorenja. Privatni deny-by-default i namerni RPC nisu automatski ranjivost. Potvrđene posebne stavke su `notification_copy_v5` bez izričitog search_path-a (literalni CASE), pg_net placement i disabled leaked-password zaštita; prioritet ne sme potisnuti dokazani Need privatnosni problem. Performance advisor daje kandidate za merenje, ne dozvolu za masovno menjanje baze.

**Zavisnosti — sveža dopuna posle objave izveštaja:** `npm audit --package-lock-only --json` sada nalazi **42 zapisa: 6 high, 31 moderate, 5 low, 0 critical**, na nepromenjenom lockfile-u ove grane. To zamenjuje raniji broj27 za ovaj obuhvat. Šest high paketa su Expo CLI, brace-expansion, compression, node-forge, source-map-js i zod; njihovi roditelji su u Expo CLI/signing, Jest/minimatch i PostCSS putanjama. Direktan import poslednjih pet nije pronađen u `src`/Edge izvorima, ali to samo po sebi ne dokazuje odsustvo tranzitivnog rizika. Potreban je ciljan pregled dostupne ranjive putanje i kompatibilne nadogradnje pre release-a; nije izvršen automatski `audit fix`. GitHub push poruka o50 upozorenja, uključujući6 critical, odnosi se na **default branch**, ne ovaj lock. [Tačan inventar i hash](dependencies.json); primeri zvaničnih advisory izvora: [zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [compression](https://github.com/advisories/GHSA-vc2v-76pw-4v95). Broj upozorenja nije broj dokazanih napada na APK.

## VI. Stvarni blokatori za korisnike

| Rizik | Dokaz i posledica | Zatvaranje |
|---|---|---|
| P0 R01/F21 privatni Need atributi | Efektivni table SELECT + sva tri privatna column prava true. | Dozvoljene javne i sopstvene projekcije + odbijena nedozvoljena polja kroz pravi Auth/HTTP. |
| P1 R06 prvi plan | Živa tabela odsutna; aktivni BG failure može ostaviti samo log/odsutan rezultat. | Trajan ograničen posao, restart/unknown/readback bez duplog plaćenog pokušaja. |
| P1 R05 matching | Živi stari prefilter i TODAY telo; kandidat nije DEV. | Tačni saved-area/TODAY parovi kroz ceo automatski izbor. |
| P1 R07 satnica | Stvarni DEV body u izolaciji baca UNKNOWN_PRICE_BASIS; writer ne čuva osnovicu. | Ista jedinica kroz prijavu, izbor, zamrznut Dogovor, izmene i prikaz. |
| P1 R11b ocene | Stvarni agregat odmah uključuje jednu ocenu; helper absent. | Svi čitači/događaji po istom publication/world pravilu. |
| P1 R09 push | Stara runtime potvrda, IN_APP zavisnost target-a, običan APK inertan. | Saglasnost/token→događaj→red→provider→uređaj→tačan ekran, dva uređaja. |
| P1 R10 privatnost/brisanje | false/NULL binding, nepotpun workAreas export. | Potpun owned export/closure/retention i istinit policy/source dokaz. |
| P1 R12 produkcija | Build namerno odbijen; nema dokazanog store/production sklopa. | Poseban backend, potpisani build, operativa i platformni prihvat. |

UI greške koje sakriju glavnu radnju ili pogrešno pokažu uspeh ulaze u P1. Nijansa senke, arhivski folder, savršena animacija i mali redundantni indeks ne smeju odlagati izdanje.

## VII. Najkraći nastavak po postojećem planu

1. **R01/SV01 + R10:** zatvoriti privatnosne granice za spoljne naloge i pripremiti validan lifecycle. Platform provenance voditi izdvojeno, bez ponavljanja istog bootstrap-a bez nove hipoteze.
2. **R04/R06/R08:** završiti durable first-plan, uskladiti prompt kontradikcije i potvrditi jedan profil sa više usluga/mode-ova. Isti signed ID kroz Save i matching ostaje autoritet. Ne raditi novi klasifikator.
3. **R05:** preneti rebase-ovan saved-area/TODAY paket tek nakon pre/postflight i relevantnih kontrola; dokazati pravi različiti worker/task par.
4. **R07 + R11b:** završiti satnicu kroz ceo poslovni ugovor i blind reviews kroz sve čitače. Nullable schema expand je preduslov, ne završetak.
5. **R02/R03/R11 UI:** završiti aktivni Discovery, Dogovori root i formalni copy u postojećim komponentama; pregledati karticu u razgovoru/listi/mapi/detalju po istim činjenicama. Bez novog dizajn sistema.
6. **R09/R12:** odgovarajući push build, dva naloga i telefon+emulator za saradnju; dva fizička uređaja za punu dostavu/pozadinu gde je potrebno.
7. **R12:** kompletan milestone CI jednom za povezani kandidat, kontrolisana DEV proba i poslovni/store paket, zatim zasebno odobren production izlaz. Ne slati ceo `candidates/` folder.

Uz male izmene raditi direktnu reprodukciju i komšijsku regresiju; veći integracioni skup kada se zatvori povezani lanac; puni CI pre promocije/milestone-a. Ovaj audit nije ponavljao 14.585 testova jer nije menjao runtime i već postoji tačan zeleni CI. Korisnikov telefon daje važan UX prihvat, ali ne može zameniti server negativni test privatnosti, novca ili idempotentnosti.

## VIII. Nivoi spremnosti i minimalna stvarna proba

| Nivo | Odluka danas | Minimalan dokaz / nadzor / oporavak |
|---|---|---|
| 1. Interna demonstracija vlasnika | CONDITIONAL GO | Poznati APK i TEST podaci, REMOTE osnovni tok; jasno označene satnica/push/ocene/lifecycle granice. Čuvati nacrt i isti command ID, ponovo čitati server pre retry-a. |
| 2. Pozvana zatvorena beta | NO-GO za samostalne spoljne korisnike sada; vođena vlasnička QA može | R01 privatnost, osnovni dva-naloga lanac, funkcionalni recovery i podrška, ograničen AI trošak; odvojiti test podatke. Posmatrati failures/queue age/UNKNOWN; povratak klijenta ne vraća bazu. |
| 3. Ograničena javna Srbija | NO-GO | Prethodno + R10, stabilan matching/push/cena/ocene, pravni i support sadržaj, poseban produkcioni projekat, store build, backup/restore dokaz. |
| 4. Šire javno | NO-GO | Prethodno + izmeren rast kataloga/queue/SQL/AI troška i više gradova/uređaja; nema potrebe graditi novi framework pre tih merenja. |

Minimalni E2E ostaje iz originalnog plana: A/B potvrđeni Auth → B aktivan profil → A AI/review/publish/readback → B odgovarajuća prilika/push → prijava → A izbor → isti Dogovor → obe poruke → završetak → dve ocene u dozvoljeno vreme → ista reputacija. Ponoviti najmanje jedan prekid mreže, izgubljen ACK, povratak/restart, izmenu revizije i otkazivanje. Trenutno su dokazani delovi do objave i owner readback-a; ceo niz **nije izvršen**. Vlasnik ima dva naloga i jedan telefon, ali je tražio da se bez njegovog prisustva ne menja prijava. Nisu tražene niti korišćene njegove lozinke.

## IX. Poslovni, pravni i store zahtevi

Ovo je tehnička readiness procena, ne pravno odobrenje. Identitet izdavača, stvarni uslovi/privatnost, naplata povezivanja, reklamacije, podrška, rokovi čuvanja i ugovori sa obrađivačima nisu potvrđeni postojanjem ekrana. Podrška `podrska@uskoci.rs` u konfiguraciji nije dokaz da domen/mejl/prijem reklamacije rade.

- Srbija: primenljivost obaveza rukovaoca i prava lica proverena je prema [Povereniku — rukovaoci](https://poverenik.rs/zastita-podataka/obaveze-rukovaoca/) i [pravima lica](https://poverenik.rs/zastita-podataka/kako-da-ostvarite-svoja-prava/?script=lat). Konkretni osnovi obrade, AI/Supabase prenosi, retention i dokumenti zahtevaju ljudsku pravnu proveru. Ministarstvo objavljuje propise i novije predloge; ne tretirati predlog kao važeći zakon niti tehnički test kao potvrdu svih poslovnih obaveza.
- Google zahteva tačan Data Safety, privatnost i stvaran put brisanja; za aplikaciju sa otvaranjem naloga traži i spoljašnji veb put zahteva. [User Data](https://support.google.com/googleplay/android-developer/answer/10144311), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111). R10 je zato stvarna release obaveza.
- Za lične Play naloge otvorene posle 13.11.2023. zvanični zahtev je najmanje 12 testera neprekidno 14 dana pre production access zahteva. Nije provereno da li se ovo primenjuje na vlasnikov konkretan nalog niti da li je ispunjeno. [Google pravilo](https://support.google.com/googleplay/android-developer/answer/14151465).
- Naplata povezivanja nije automatski isto što i naplata fizičkog rada. Plaćena digitalna funkcija i fizička usluga imaju različit billing tretman; usaglasiti konkretan proizvod pre implementacije naplate. [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738), [Apple smernice](https://developer.apple.com/app-store/review/guidelines/).
- Google Play nalog postoji prema vlasniku; pristup recenzentu za obe uloge, listing, konačni screenshots, signing/AAB/Play instalacija, target/native zahtevi i produkcioni FCM nisu ovde potvrđeni.
- Apple nalog još nema prema vlasniku. iOS sada ima source Expo PCM adapter; tvrdnja da nema nikakvu implementaciju govora je zastarela. Ipak nema IPA/iPhone/TestFlight/APNs prihvata. [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) i [App Review](https://developer.apple.com/app-store/review/guidelines/) ostaju posebni uslovi; Android PASS ih ne zatvara.
- Pre javnog izlaza imenovati odgovornog za nedostupan AI, nedostavljen push, zastali posao, curenje podataka, zahtev brisanja i reklamaciju; proveriti restore/roll-forward proceduru i upozorenja troška. Nije potrebna nova administratorska aplikacija da bi ovi osnovni procesi postojali.

## X. Šta je urađeno u ovom krugu i šta nije

**Urađeno:** dubinski pregled navedenih ugovora/implementacija; fresh GitHub/CI/DEV read; živa prava i definicije; emulator vizuelna provera dostupnih stanja; dve konkretne izolovane reprodukcije plus TOTAL pozitivna kontrola; ovaj dokazni zapis i kratak dodatak u isti master. Obuhvat odabranih čitanja postoji lokalno u `artifacts/deep-audit-20261102/reads.jsonl`; on beleži opsege ispisane za pregled, nije automatska potvrda semantičkog pregleda svake linije kod skraćenog izlaza.

**Nije urađeno ovim auditom:** runtime popravka, migracija, Edge deploy, promena flagova/tajni/cron-a, brisanje podataka, novi APK, paid Gemini, drugi nalog, stvarni push/device E2E, production ili store predaja. Raniji DEV/APK rezultati su jasno označeni kao raniji dokaz na istom runtime-u.

**Zastareli nalazi koje ne vraćati kao sadašnji kvar:** nema response price kolone (sada postoji); svaki edit pravi novi razgovor (nov owner resume prenet); svaki prirodan sinonim odbija radnički binder (signed witness prenet); samo četiri Deno check-a (sada 12); nema iOS capture source-a (sada Expo put); STT bez transkripta uvek oslobađa rezervaciju (sada čuva nepoznati poslati ishod); public-comment consumer je mrtav (sada povezan). Njihovo ispravljanje ne znači da su cele R oblasti DONE.

**Stručna ocena plana:** proizvodni koncept i osnovni ugovori su dobri; operativni dokument je postao predugačak i meša istoriju sa aktuelnim statusom. Problem danas nije nedostatak još jednog plana. Potrebno je po postojećim R paketima zatvarati ceo vertikalni put i prenositi samo dokazanu povezanu promenu, uz minimum smislenih testova i stvarni korisnički prihvat. Ovaj izveštaj je snimak stanja, a sledeći rezultati menjaju isti CODEX master.

### Izvorni oslonci za ključne zaključke

Ovi linkovi vode u stvarne vlasnike ponašanja; nisu tvrdnja da njihovo postojanje predstavlja DEV ili E2E uspeh. Git identitet za ovo čitanje je naveden u §II.

| Oblast | Pročitani implementacioni oslonac |
|---|---|
| AI razgovor i prompt za zadatak | [Need handler](../../../supabase/functions/uskoci-ai-interview/index.ts), naročito prompt i aktivni završetak/pozadinsko pokretanje |
| AI profil, pitanja, mode/handoff, completion | [Worker handler](../../../supabase/functions/uskoci-worker-interview/index.ts) |
| Dinamički katalog i drugi model | [Background architect](../../../supabase/functions/_shared/backgroundTaxonomyArchitect.mjs) |
| Jezik i execution ugovor promptova | [Voice instruction](../../../supabase/functions/_shared/interviewVoiceInstruction.mjs), [execution instruction](../../../supabase/functions/_shared/serviceExecutionInstruction.mjs) |
| Stvarni upis klasifikacije | [Postojeći R04 paket](../../../supabase/operations/dev-alpha/r04-semantic-admission-20261101/README.md) plus preuzete žive definicije; kandidat nije korišćen kao dokaz prisustva na serveru |
| Auth i publikacija | [Auth servis](../../../src/data/authClientService.ts), [publication servis](../../../src/data/publicationClientService.ts) |
| Prijava i oporavak Dogovora | [Application servis](../../../src/data/applicationClientService.ts), [Agreement outbox](../../../src/data/agreementOutbox.ts) |
| Kartice i Dogovori | [TaskRecordBody](../../../src/ui/v2/discovery/TaskRecordBody.tsx), [kolekcija](../../../src/ui/v2/AgreementCollectionPresentation.tsx), [Workspace](../../../src/ui/agreements/AgreementWorkspace.tsx) |
| Push i pravna potvrda | [PushPreferences](../../../src/ui/notifications/PushPreferences.tsx), [legalReview](../../../src/ui/legal/legalReview.ts), [push transport](../../../supabase/functions/uskoci-push-transport/index.ts) |
| Govor i platformski adapter | [Speech session](../../../supabase/functions/uskoci-speech-session/index.ts), [native adapter](../../../src/features/voice/nativeSpeechAdapter.ts) |
| CI i njegove granice | [Full CI workflow](../../../.github/workflows/ci-clean.yml), [R01 workflow](../../../.github/workflows/r01-disposable-schema.yml), stvarni run-ovi iz §II |

Ponovljiva lokalna provera: `node docs/continuation/deep-audit-20261102/reproduce-live-gaps.mjs`. Uspešan izlaz skripte znači da su navedeni sadašnji kvarovi reprodukovani, **ne da je poslovni ugovor ispravljen**.
