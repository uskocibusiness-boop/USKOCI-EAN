# USKOČI — detaljan komandni izveštaj za nastavak u običnom ChatGPT razgovoru

> **Naknadni presek 02.11.2026:** ovaj izveštaj ostaje istorijski. Za aktuelni DEV, R04 WIP, reprodukovan klijentski kvar i sledeći rad prvo čitati „R04/DEV revizija i primopredaja 02.11.2026“ u [jedinom CODEX masteru](../plan/CODEX_PLAN_RADA.md) i [dokazni prilog](r04-audit-20261102/verification.json).

Datum preseka: 1. novembar 2026. Pripremljeno posle provere GitHub-a u 19:25 UTC.
Namena: samostalan prenos konteksta iz razvojnog razgovora u običan ChatGPT razgovor.
Ovo je datirani izveštaj o stanju i uputstvo za nastavak. Nije novi master plan.
Jedini izvršni master ostaje docs/plan/CODEX_PLAN_RADA.md.
Jedini proizvodni/UX master ostaje docs/product/USKOCI_PRODUCT_UX_MASTER.md.

## 0. Kako novi običan ChatGPT razgovor treba da koristi ovaj dokument

Korisnik želi da se dovrši postojeća aplikacija USKOČI: pouzdan prirodan AI razgovor, radni profil, zadaci, čuvanje na serveru, matching, push, prijave, Dogovori, poruke, ocene, izgled i konačno izdanje za prodavnice. Ne želi još jedan plan od nule, beskonačno usavršavanje ili skidanje zaštita da bi nešto prividno proradilo.

Najpre pročitaj ovaj dokument, zatim postojeće master dokumente i najnovije dokaze ako imaš pristup repozitorijumu. Običan ChatGPT razgovor nema automatski pristup lokalnom računaru, emulatoru, alatima i prijavama koje je imao razvojni razgovor. Jasno navedi svoj stvarni pristup. Ako imaš samo ovaj dokument, koristi ga kao dostavljeni istorijski presek; nemoj tvrditi da si upravo proverio GitHub, Supabase ili APK.

Ako imaš priključene GitHub/Supabase alate, proveri aktuelno stanje pre zaključka ili izmene. Ako nemaš izvršno okruženje, možeš analizirati i pripremiti tačan sledeći razvojni zadatak, ali ne tvrdi da kodiraš, testiraš, deployuješ ili radiš u pozadini. Ne traži lozinke ili API tajne kroz razgovor. Kada je potreban dodatni izvor, traži najmanji konkretan dokument ili bezbedan izlaz, ne ceo projekat naslepo.

Korisnik često piše brzo sa greškama. Tumači „grane“ u AI kontekstu kao grane stabla usluga, osim ako govori o Git-u. „Pustiti blokade“ znači omogućiti stvarnu završenu aplikaciju; nije odobrenje za ukidanje privatnosti, TEST/REAL izolacije, potvrde čuvanja ili kontrola produkcije.

## 1. Misija, proizvodne odluke i nepromenljiva pravila

USKOČI počinje u Srbiji. Povezuje korisnike radi konkretnih samostalnih zadataka i usluga; nije platforma za angažovanje radnika u smenama.

Zvanični slogan: USKOČI — Vaš partner za svaki zadatak.

Sačuvane odluke:
- Jedan nalog može biti naručilac na jednom zadatku i izvršilac na drugom. Nema globalnog preklopnika uloge.
- Glavni tabovi su Početna, Zadaci, Dogovori i Poruke. Profil nije peti donji tab.
- AI prikuplja stvarno potrebne informacije, najviše jedno stvarno potrebno pitanje po odgovoru.
- Korisnik potvrđuje smisao svoje potrebe/ponude i čuvanje. Ne administrira taksonomiju.
- Isti smisao usluge zadržava isti stvarni ID. Sinonim ne treba da napravi duplikat.
- Opravdanu novu uslugu ili granu proverava i upisuje baza; model ne izmišlja trajni ID.
- ON_SITE, REMOTE i BOTH moraju biti tačni. REMOTE nije samo digitalni rad: može uključiti radionicu/rad kod izvršioca uz potrebnu predaju.
- Ne izmišljati grad, lokaciju, dolazak ili potvrđenu sposobnost da bi aktivacija prošla.
- Jedan razumljiv završni pregled; ne uvoditi dodatne obavezne administrativne formulare za korisnika.
- Privatni nacrt, pripremljeni pregled, Save, aktivacija, objava i spremnost za matching nisu isto stanje.
- Pending klasifikacija sama po sebi nije opšta zabrana svakog Save-a ili objave. Važe konkretni uslovi ugovora, uključujući mode/handoff.
- Jedna zajednička reputacija naloga je važeća odluka.
- Početni ugovor: Srbija, RSD, promotivna naknada povezivanja 0 RSD. Ne otvarati ponovo tu odluku bez nove namere vlasnika.
- Formalno obraćanje Vi/Vam. Sačuvati postojeći odobreni izgled; ne raditi samovoljan redizajn.
- Funkcionalne kontrole koriste postojeću 2D linijsku porodicu. Postojeće 2.5D ilustracije koriste se selektivno, ne na svakom redu.
- Ne uvoditi novi framework, treći klasifikator ili generičku apstrakciju bez stvarnog razloga.

Produkcioni deploy, javno puštanje u prodavnici, promena naplate i destruktivne migracije zahtevaju odgovarajuće izričito odobrenje. Dosadašnji nastavak obuhvatio je kontrolisane DEV promene i internu proveru.

## 2. Tačan GitHub i lokalni checkpoint

Repozitorijum:
https://github.com/uskocibusiness-boop/USKOCI-EAN

Aktivna radna grana: work/rev14-review-f17.
Ciljna integraciona grana: feature/uskoci-cisto.
Draft PR #43:
https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43

Provereno pre dodavanja ovog izveštaja:
- Lokalni HEAD = stvarni remote HEAD = 9f8108e37f5b09abd4c1fcf4bbd513233f95a975.
- Integraciona baza = a9692e11942609bab9406215c3e407d79589dafa.
- PR otvoren, Draft, nije merged; 407 commitova u tom trenutku.
- Tracked radno stablo čisto.
- Jedini vidljivi untracked unos je ranije postojeći .codex-remote-attachments/. Nije otvaran, prepisivan ili automatski dodat u Git.
- Poslednji runtime source je 51ac4e24c805c4b99db0b82bf1e4b1c9b1785286.
- Commitovi 6b29f351 i 9f8108e3 posle runtime-a menjaju samo dokumentaciju/dokaze.
- Ovaj izveštaj dobija dodatni dokumentacioni commit; zato će HEAD grane biti noviji od navedenog polaznog HEAD-a. Runtime/CI/APK pin ostaje 51ac4e24 dok nova izvršna promena nema nov dokaz.

Lokalni razvojni checkout:
C:/Users/user/Desktop/USKOCI-CISTO

Originalni task workspace:
C:/Users/user/Documents/Codex/2026-11-01/usko-i-glavna-komanda-za-nastavak

Ne resetovati branch, ne koristiti reset --hard ili force push, ne praviti novu paralelnu implementaciju. Pre rada uvek proveriti nove commitove i korisničke izmene.

Izvršni master:
https://github.com/uskocibusiness-boop/USKOCI-EAN/blob/work/rev14-review-f17/docs/plan/CODEX_PLAN_RADA.md

Product/UX master:
https://github.com/uskocibusiness-boop/USKOCI-EAN/blob/work/rev14-review-f17/docs/product/USKOCI_PRODUCT_UX_MASTER.md

Master je ranije pročitan u celini. Sadrži normativni ugovor, stare nalaze i novije checkpointe. Najnoviji izvršni checkpoint je na početku §11.2a, „Nastavak sa obnovljenim pristupom“. Kratak uvod i aktuelna matrica usklađeni su u 9f8108e3. Starije pasuse ne predstavljati kao današnje stanje bez poređenja sa novijim dokazom.

## 3. Izvršni zaključak

Aplikacija ima mnogo implementiranog i testiranog koda, stvarne DEV prenose i instalirani interni Android APK. Razvoj nije na početku. Međutim, završeni osnovni posao između dve osobe još nije dokazan i postoji konkretan kvar semantičkog prihvata usluge koji blokira testiranu objavu.

Dokazano je da prijavljena aplikacija otvara osnovne ekrane, čita sopstvene zadatke i sačuvani privatni AI nacrt. Dokazano je i da tri stvarna razgovorna AI turna mogu sačuvati činjenice i ispravku opisa. Nije dokazano da isti novi zadatak prođe objavu, matching, push, izbor, novi Dogovor, obostrani završetak i ocene.

Najvažniji otvoreni rad je:
1. R04 — završiti semantički prihvat do čuvanja/povezivanja/objave, uključujući sinonim i novu granu.
2. R01/F21 — stvarna privatnosna prava i reproducibilnost baze.
3. R10 — izvoz, brisanje i životni ciklus podataka.
4. R05 — kontrolisano preneti i dokazati saved-area matching.
5. R06 — trajni prvi klasifikacioni posao, oporavak i ograničenja troška.
6. Povezati i proveriti ceo dvokorisnički tok, stvarni push i završni UI.
7. Završiti produkcioni i poslovni/store paket.

Nema potvrđenog procenta završenosti i nema dokazivog datuma javnog lansiranja. Interni APK postoji; javno izdanje nije spremno.

## 4. Kako čitati nivoe dokaza

Razlikovati:
- Normativna odluka: šta proizvod treba da radi.
- Istorijski nalaz: šta je bilo pokvareno u tadašnjem source-u.
- SOURCE_DONE: konkretna implementacija postoji.
- Izolovani test: određeni ugovor prolazi u kontrolisanom modelu/fixture-u.
- CI_PROVEN: imenovani testovi prošli su na tačno poznatom source/merge SHA-u.
- DEV_PROVEN: stvarno primenjeno ili provereno na imenovanom DEV projektu, u navedenom obimu.
- E2E_PROVEN: stvaran korisnički tok izvršen kroz imenovani klijent i server.
- RELEASE READY: proizvodni, bezbednosni, operativni i store zahtevi potvrđeni za konkretno izdanje.

SOURCE PASS nije DEV PASS. CI SUCCESS nije RELEASE READY. SQL uloga sa sintetičkim claims nije stvaran GoTrue/JWT/PostgREST nalog. Emulator nije fizički telefon. Pregled starog Dogovora nije nov dvostrani posao. Putanja do lokalne slike nije slika dostupna običnom ChatGPT chatu.

Za cele R pakete status ostaje PARTIAL ili BLOCKED dok njihovi kriterijumi nisu zatvoreni. Zatvoreni podugovor ne zatvara automatski ceo paket.

## 5. Poslednji CI i šta je stvarno potvrdio

Runtime source:
51ac4e24c805c4b99db0b82bf1e4b1c9b1785286

Testirani PR merge:
b7fdbd85dd8567319888bc06a085f610b89996bd

Glavni CI 41335325789 — SUCCESS:
https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41335325789

Rezultati:
- 626 Jest suite-ova, 14.565 testova, tri snapshota PASS.
- AI skup: 1.487 PASS i jedan postojeći TODO.
- TODO ostaje stvarni Auth/full signed accept/Save/publish posle povlačenja stare cene, uključujući već pripremljen pregled.
- Reviewed DEV paketi: 37/37; uključeni R03 6/6 i R07 7/7.
- TypeScript PASS.
- Dvanaest Edge typecheck-a PASS; to nije izvršavanje svih funkcija.
- Migration integrity i povezane SQL provere PASS.
- Zaseban stvarni izolovani PG17/PostGIS job PASS.
- Svih 33 source koraka i devet PostGIS job koraka uspešno.

Zasebni R01 41335325947 — FAILURE:
https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41335325947

STRICT_PARITY / METADATA_PARITY_DIFFERENT:
- osam strict razlika;
- 49 supplementary razlika;
- tri managed-hook razlike;
- paired native invoker true, nula razlika u tom uskom poređenju;
- kompletna boundary dozvola i dalje false;
- cleanup PASS.

Prethodni glavni run 41334618636 za 207a6618 zvanično je CANCELLED usled narednog push-a, iako su vraćeni pojedinačni koraci i testni sažeci uspešni. Ne preimenovati ga u SUCCESS.

Trajni dokazi:
- docs/continuation/source-bridge-20261030/evidence-20261101-51ac4e24-full-ci.json
- docs/continuation/source-bridge-20261030/evidence-20261101-207a6618-ci.json

Dokumentacioni commitovi sa [skip ci] ne tvrde novi runtime CI. Za njih su provereni diff i struktura dokumenata; prethodni runtime dokaz ostaje vezan za 51ac4e24.

## 6. Šta je stvarno preneto na Supabase DEV

Kanonski DEV projekat: leqcwgzvjsxugfgzdmth.
Poslednja potvrđena platforma: PostgreSQL 17.6, platformni image/build 17.6.1.165.
Pristup bazi je tokom rada obnovljen i korišćen. Ranija blokada pristupa nije razlog da se tvrdi da danas nikakva DEV provera nije moguća. U novom razgovoru ipak proveriti sopstveni aktuelni pristup.

Četiri važne stvarno primenjene operacije 1. novembra:

| Migracija | Šta je preneto | Granica dokaza |
|---|---|---|
| 20261101140429_worker_saved_service_read_model_v1 | F10: postojeći reader sačuvanih usluga/mode podataka. | Tačno telo/ACL i SQL no-row/auth-denial; nije ceo mobilni Save tok. |
| 20261101140909_worker_signed_remote_only_activation_v1 | R08: prvi potpisani REMOTE-only Save+Activate bez izmišljenog grada. | Stvarna hosted SQL transakcija sa sintetičkim claims, replay/readback/batch/binder i odbijanje tuđeg/nepotpisanog upisa. |
| 20261101172612_owner_task_page_contract_v1 | R03: jedan postojeći page RPC usklađen sa stvarnim mobilnim ugovorom. | SQL→client provere, exact postflight i zasebni prijavljeni native pre/posle. |
| 20261101174446_application_attention_agreement_lifecycle_v1 | R07: tri postojeća reader tela za attention/history prema životnom ciklusu Dogovora. | SQL/client 19 slučajeva i native attention0/history1. |

Tačni SQL bajtovi, ledger receipt-i, pre/postflight i rollback postupci nalaze se u:
- supabase/operations/dev-alpha/ledger/
- supabase/operations/dev-alpha/f10-saved-services-20261101/
- supabase/operations/dev-alpha/r08-remote-only-20261101/
- supabase/operations/dev-alpha/r03-owner-page-20261101/
- supabase/operations/dev-alpha/r07-application-attention-20261101/

To su precizno zaštićene DEV operacije. Ne kopirati ih automatski kao čist produkcioni bootstrap. R08 rollback ima posebnu zabranu kada stvarni cityless ACTIVE profili već postoje; tada je potreban kontrolisan forward repair.

R03 promotion SHA256:
b10e5c3532378b340d83e9c19b54ac6765c2f5641e9f2f18f296e7c60f16cc24

R07 promotion SHA256:
5e174baae5fe232e07d1676008be42ec25676767c8a9346d0920051ea679269d

Poslednje potvrđene Edge verzije:
- uskoci-ai-interview: Need v154.
- uskoci-worker-interview: Worker v107.
- post-save worker v8.
- push transport v39.
- speech v25.
- media v24.
- account closure v14.
- export worker/download v24 prema poslednjem sačuvanom recheck-u.

Need i Worker kompletni deployovani bundle-ovi byte-provereni su prema source-u:
53a3220d58643ee30e6646b6be04c807f9c1eb19

Need bundle SHA256:
5a5e6ed42521aaa667fb5ecf0d4b1ec709a30d8f0d5a5a754bd4eca75880afac

Worker bundle SHA256:
90a1b99d8fa6e385a182a0792f15d5a4b70bed9daa90bc044260c52643e3475c

Poslednji sačuvani puni Edge recheck je 15:45:10 UTC. Kasniji R03/R07 SQL prenosi ne znače nov Edge deploy. Povećanje Edge verzije zbog konfiguracije ne znači promenjen source.

Šest netajnih taxonomy konfiguracionih vrednosti provereno je preko dashboard-a: DEV scope, tačan allowed project ref, DUAL_GEMINI, DIRECT_REPLY, UNIFIED_SHADOW i SHADOW_CAPTURE. Nisu menjani API ključevi, provider/model ili budžetska politika. Detalji su u edge-ai-20261101/config-receipt.json.

## 7. Konkretno završene popravke koje ne treba ponovo otvarati

### 7.1. „Moji zadaci“ — R03

Na prijavljenom emulatoru prethodno je postojao stvaran OWN_TASKS_PAGE_INVALID: server je vraćao dokument koji aktuelni klijent nije prihvatao.

Postojeći reader usklađen je sa kanonskim task dokumentom, pet scope-ova, prvim counts i keyset cursor-om. Sačuvani su owner/ACL/privatnost i closure digesti. Nije dodata paralelna lista.

Dokazano:
- šest SQL→stvarni client testova;
- tačan preimage/postimage i kontrolisana DEV primena;
- na istom tadašnjem APK-u greška nestaje;
- šest aktivnih i osam istorijskih zadataka se čita;
- WAITING prazan rezultat;
- detalji se otvaraju;
- stvarna offline greška, pa online retry/reset;
- kasnije novi privatni AI DRAFT i njegov readback.

Nije zatvoren kompletan R03: veće native straničenje, puna matrica svih grupa i promena naloga još traže dokaz.

### 7.2. Završena prijava pogrešno u „Čeka odgovor“ — R07

Istorijski SELECTED je ranije davao attention iako je povezan Dogovor završen i ocenjen. Reader-i sada pažnju izvode iz stvarnog životnog ciklusa Dogovora.

Dokazano:
- sedam SQL/client testova, 19 lifecycle slučajeva;
- tri kontrolisano promenjena tela na DEV-u;
- native attention0/history1;
- ista selekcija, cena, broj ljudi i Agreement link;
- postojeće poruke i završeni Dogovor ostaju dostupni.

Ovo nije novo biranje izvršioca, završavanje posla ili nova ocena.

### 7.3. Ulazni ekrani, tastatura i Home

Popravljeni su welcome safe-area pri skrolu, vidljivost Auth inputa iznad tastature i previsoki signup blok sa greškom. Provereni su recovery/Back, hladni restart, 360×640 dp i font1.3, uz smanjene i normalne animacije.

Home je pojednostavljen na postojeće sažete redove. Uklonjeni su redundantni preview poziv i njegov jedini nepotrebni helper; sačuvani su osnovni reader-i, zbirni podaci i zaštite promene naloga.

To nije potvrda svih ekrana, kartica ili overflow scenarija. Na AI kartici još je zabeleženo neformalno „možeš“, koje treba uskladiti sa Vi/Vam.

### 7.4. Ispravka pogrešno protumačenog „busy“ stanja

Ranije je XML duže zadržavao reč „busy“, što je prvo protumačeno kao zastoj osvežavanja. Ta pretpostavka je povučena: HTTP je završavao, dugme je bilo enabled, spinner nije postojao, a ponovni tap stvarao je novi pregled.

Uzrok tog native opisa je izostavljanje busy svojstva posle učitavanja. V2Action sada izričito šalje busy:false. Dve regresije prvo su pale, potom prošle; finalni APK potvrđuje normalan opis posle oba osvežavanja.

Odvojeno je nađen i popravljen stvarni neograničeni task-detail transport: postojeći owned-read helper sada daje 15 s deadline/abort, a opcioni urgency ima zasebnu granicu do 4 s. To nije dokazani uzrok stare busy oznake i nije tvrdnja da ceo AI pregled traje najviše 19 s.

### 7.5. Druge završene uske promene

- Sačuvani REMOTE profil se ne prikazuje sa izmišljenim gradom.
- Task pregled sledi dogovoreni redosled opisa, cene, ljudi, termina, mesta i uslova.
- About koristi zvanični slogan i formalni tekst.
- iOS AI govor povezan je sa postojećim Expo PCM putem, uz source testove; nije potvrđen na iPhone-u.
- Jedna ranjiva decode-uri-component komponenta ažurirana je ciljano i regresijski proverena.
- Postojeći account/readback/lost-ACK guard-i su ojačani; ne predstavljati sve starije nalaze kao aktivne.

## 8. Šta se stvarno dogodilo u AI testu „lektura“

Test je izvršen na stvarnom ručno prijavljenom TEST app nalogu u emulatoru.

Zadatak: lektura približno 500 reči na srpskom, pravopis i gramatika bez prevođenja, rad na daljinu, jedna osoba, ukupno 1.000 RSD, rok 4. novembra.

Potvrđeno:
- tri uspešna razgovorna provider-dispatched turna;
- AI činjenice i ispravka opisa sačuvane;
- razumljiv pregled;
- čuvanje privatnog nacrta;
- razgovor COMPLETED;
- vezani zadatak DRAFT;
- „Nacrti“ lista i detalj ponovo čitaju isti zadatak.

Nije objavljen novi javni zadatak, nije poslat push drugoj osobi i nije započet nov dvokorisnički posao.

Prvi ADB unos isporučio je samo 99 znakova. Nedostajuće informacije dopunjene su sledećom porukom. Zato AI pitanje o roku u toj probi nije dokaz nepotrebnog ponavljanja već datog odgovora.

Pozadinski predlog:
- service: lektura;
- postojeća usluga: Lektura tekstova;
- action: REUSE_EXISTING;
- mode: REMOTE;
- catalogVersion: 11;
- handoff.required: false.

Pre Save-a latest review source hash odgovara latest hint source fingerprint-u i katalog se poklapa. Dakle, taj konkretni pending nije objašnjen zastarelim pre-Save ulazom. Posle Save-a source se menja očekivano; kasnije nepoklapanje ne koristiti kao dokaz prethodnog problema.

Live taxonomy_review_candidate_projection_v2, definicija MD5 f9318f476e32a8233fbb07ccf5d22aeb, ostavlja neregistrovani sinonim u PENDING_CLASSIFICATION. Pronađeno značenje nije preneto u završeni potvrđeni zapis usluge.

Poslednji finalni native prolaz dodao je samo jedan vezani edit razgovor i tri signed review-a. Ukupno ostaju ista tri razgovorna provider turna. To nije dokaz ukupnog broja pozadinskih Gemini poziva ili fakturisanog troška.

Dokaz: docs/continuation/evidence-20261101-r04-ai-native.json.

## 9. Da li Gemini gleda celo stablo i šta bi bilo sa novom granom

Aktivni DEV režim koristi DUAL_GEMINI=true. U toj grani razgovorni classificationExplorer nije aktivni klasifikacioni put; poziva se backgroundTaxonomyArchitect.

Aktuelni kod:
- učita kompletan snapshot ili iscrpi ROOTS/CHILDREN stranice;
- proveri potpunost i veze roditelja;
- sastavi completeCatalogTree sa ID-jevima, roditeljima/putanjama, aliasima, načinima rada i leaf informacijom;
- pošalje ga pozadinskom Gemini pozivu kada je semantička obrada potrebna.

Relevantni fajlovi:
- supabase/functions/uskoci-ai-interview/index.ts
- supabase/functions/uskoci-worker-interview/index.ts
- supabase/functions/_shared/backgroundTaxonomyArchitect.mjs
- supabase/functions/_shared/classificationGeminiShadow.mjs
- supabase/functions/_shared/classificationExplorer.mjs

Kod za pozadinski Gemini podržava:
- REUSE_EXISTING za isti konkretan posao;
- CREATE_CHILD ispod odgovarajućeg postojećeg roditelja;
- CREATE_NEW_BRANCH kada odgovarajući roditelj ne postoji;
- smislen višestepeni proposedPath;
- razjašnjenje stvarno dvosmislene usluge.

Postojanje drugog explorer modula nije dokaz da je on korišćen u ovoj probi. Native dokaz lekture ne sadrži pun snimak konkretnog BG prompta ili trag svakog čitanja. Ne tvrditi da znamo da je model mentalno razmotrio svaku granu. Možemo potvrditi implementirani aktivni put i vraćeni predlog postojeće usluge.

Za novu granu nije dovoljan modelov odgovor. Baza mora proveriti postojeće značenje/duplikate, roditelja, način rada i potpisanu nameru, upisati stvarni ID i povezati ga sa sačuvanim objektom. Ceo taj put sa pravim korisnikom još nije potvrđen.

## 10. Šta R04 plan već zahteva i kako nastaviti

Ovo nije previd plana. R04 već traži potpun katalog, vernu hijerarhiju, isti smisao/isti ID, novu smislenu granu i povezivanje sa pregledom i čuvanjem.

Korisnik ne treba da potvrđuje tehničku kategoriju. Njegova potvrda odnosi se na razumljiv opis onoga što nudi ili traži, kroz postojeći pregled/Save/Objavi. Ne uvoditi novi birač kategorija radi internog problema.

Nedostaje usklađeni serverski prihvat semantičkog predloga kroz postojeći review, Save, batch admission i binder. Samo menjanje poruke ili REFRESH dugmeta to ne završava.

Sledeći konkretan razvojni paket:
1. Pročitati R04 ugovor i postojeće dokaze.
2. Reprodukovati lekturu kroz stvarne relevantne SQL helper-e i Save/binder lanac.
3. Uključiti stvarni taxonomy_risk_triage_v1; postojeći pending test ga stubuje.
4. Ukloniti korišćenje broja reči kao zamene za procenu smisla. Jednorečni jasan naziv nije automatski nejasan.
5. Povezati tačan postojeći ID sa potvrđenim opisom, owner-om, source/revision/digest-om, katalogom, mode-om i handoff-om.
6. Proveriti konkretan publish guard. Pending nije blanket zabrana; razlikovati tehničku klasifikaciju, privatni Save i stvarno obavezne uslove.
7. Sačuvati odbijanje pogrešnog smisla, tuđeg naloga, zastarelog pregleda, drugog ID-ja i konfliktne namere.
8. Dokazati ponovljen Save, izgubljen ACK i readback bez duplog upisa.
9. Posebno dokazati postojeću uslugu, neupisani sinonim, novu granu i BOTH.
10. Pripremiti kontrolisani DEV paket, preneti ga tek posle provera i ponoviti native scenario.

Kandidati i testovi:
- supabase/candidates/r04_semantic_review_pending_projection.sql
- supabase/candidates/r04_semantic_review_signed_projection.sql
- supabase/candidates/r04_signed_taxonomy_publish_fence.sql
- supabase/proofs/ai/r04_semantic_review_pending.test.mjs
- supabase/proofs/ai/r04_signed_taxonomy_publish_fence.test.mjs

Oprez: stari signed-projection kandidat sadrži worker prepare tela sa obaveznim gradom. Ne primenjivati ga preko novijih R08 cityless REMOTE tela bez usklađivanja.

Ne praviti globalni alias samo da lektura prođe. Ne postavljati READY naslepo. Ne uklanjati provere source-a i vlasništva. Ne pisati novi klasifikator.

## 11. Šta je R01, zašto pada i šta nije isto što i taj pad

R01 proverava privatnost čitanja, stvarna prava i mogućnost da se očekivana baza pouzdano reprodukuje i nadogradi.

Postoje dve različite otvorene stvari:
- Strict replay/parity razlike, uključujući managed-platform metadata/extension/hook deo.
- F21: široko pravo čitanja Need kolona, koje zahteva stvaran privatnosni popravak i Auth/PostgREST dokaz.

Poslednji strict pad je isti 8/49/3. Nema smisla ponavljati potpuno istu analizu bez novog ulaza. Paired invoker poređenje ima nula razlika, ali kompletna granica nije prihvaćena.

F21 kandidat 42→38 ima 16 izolovanih kompatibilnosnih provera sa stvarnim reader telima. Nije primenjen na DEV. Postojeća metadata prava dopuštaju 42 kolone; to je potvrđen problem obima prava, ne automatski dokazana eksfiltracija iz proizvoljnog korisničkog toka.

Potrebno:
- objašnjiv i reproduktivan platform/bootstrap/upgrade dokaz;
- aktuelan katalog koji uključuje današnje DEV operacije;
- pozitivni i negativni stvarni end-user Auth/PostgREST testovi;
- provera closure/export posledica i podržanih klijenata;
- kontrolisan paket prava i oporavka.

Read-only katalog od 14:22 potvrđuje tačno 11 F10/R08 funkcijskih delti i ostalih 15 grupa nepromenjeno. On prethodi R03/R07 operacijama. Ne predstavljati ga kao poslednji kompletan DEV katalog.

Ne oslabiti parity checker, ne prepisati očekivani hash radi zelenog statusa i ne izjednačiti platformsku razliku sa svim privatnosnim pitanjima.

## 12. Aktuelna matrica R01–R12

| Paket | Status celog ugovora | Šta je potvrđeno | Šta ostaje |
|---|---|---|---|
| R01 | BLOCKED | Izolovani privacy reader testovi, kataloški dokazi i precizno ponovljen strict pad. | Platform/provenance, aktuelan bootstrap/upgrade, stvarna privatna kolonska granica i Auth/PostgREST. |
| R02 | PARTIAL | Discovery source/CI promene; prijavljena mapa/list-count se otvara. | Cela PAGE/MAP/PLACES/filter/lokacija/recovery/account-switch matrica. |
| R03 | PARTIAL | DEV reader i native own-list/detail/draft/offline retry. | Veće straničenje, puna matrica pet scope-ova i promena naloga. |
| R04 | PARTIAL | Potpuna struktura kataloga u kodu, stvaran AI intake/ispravka/private Save. | Semantički prihvat, nova grana/BOTH/handoff i stvarna objava/readback. |
| R05 | PARTIAL | Indeksirani kandidat i izolovani PG17/PostGIS/960 graničnih prihvata. | DEV prenos, puni dispatch budžet, saved-area/ForMe/push i TODAY. |
| R06 | PARTIAL | Bounded transport i BG reservation/usage preneti u Edge. | Trajni prvi posao/worker/recovery/retention i stvarno enforced limiti. |
| R07 | PARTIAL | Cena/revizija source, DEV attention fix, postojeći Agreement readback. | Satnica/korekcije/replacement i konkurentni prijava→izbor→Dogovor na usklađenom DEV-u. |
| R08 | PARTIAL | F10 reader i signed REMOTE bez grada primenjeni; ograničen hosted SQL PASS. | Stvarni AI Save+Activate/readback/matching, mixed/new/BOTH i account switch. |
| R09 | PARTIAL | Source/CAS/readback/navigacija; stari re-send nalaz povučen. | Prava dostava push-a, tap, tihi sati, odjava, dva uređaja i media recovery. |
| R10 | BLOCKED | Consent recovery source; izolovani workAreas export kandidat. | Tačan export/erasure/retention binding, sve kopije, stvarno brisanje i izvoz. |
| R11 | PARTIAL | Više uskih popravki i cleanup podpaketa. | Blind ocene DEV/ciklus reputacije, media tokovi i preostali opravdani cleanup. |
| R12 | BLOCKED | Glavni CI, instalirani interni APK i ograničeni native prihvat. | Svi ekrani, fizički Android, ceo A/B E2E, produkcija, Play, iOS i poslovni prihvat. |

Ovo nije lista tvrdnji da je sve u svakom redu pokvareno. Status se odnosi na kompletan ugovor; potvrđeni poddelovi su navedeni odvojeno.

## 13. R05, R06 i R10 — važni pripremljeni delovi koji još nisu na DEV-u

R05 saved-area kandidat:
- supabase/candidates/r05_saved_area_retrieval.sql
- LOCAL_ONLY, nije primenjen.
- Reprodukovan slučaj odgovarajućeg izvršioca udaljenog 390,5 km koji važeće sačuvano područje dopušta, a stari prefilter gubi.
- Novi indeksirani nadskup koristi GIN/GiST/latest-Save bez promene konačnog matchera.
- Izolovani pravi PG17/PostGIS: 4.000 dodatnih fixture redova, prihvaćenih 960/960 graničnih parova, bez izgubljenog odgovarajućeg para.
- Nije dokazan ukupan dispatch budžet, puna DEV šema ili stvarni Save→ForMe→push.
- TODAY kandidat ima dodatne retention zavisnosti.

R06 first-plan:
- supabase/proofs/ai/r06_first_plan_enqueue_candidate.sql
- supabase/proofs/ai/r06_first_plan_completion_candidate.sql
- Atomski wrapper-i postoje i izolovano su testirani.
- Nisu povezani kao aktivan kompletan trajni prvi posao sa handlerima, worker/key/lease/retry/UNKNOWN i retention lancem.
- Post-save worker transport ne zamenjuje prvi posao koji treba bezbedno nastati uz potvrđeni AI turn.
- DEV reservation cap nije enforced. Rezervacija nije provider faktura.
- Ne dozvoliti da dva identiteta pokušaja izazovu dva plaćena poziva za istu poslovnu operaciju.

R10:
- supabase/candidates/r10_worker_area_export_projection.sql
- Sedam izolovanih testova PASS, LOCAL_ONLY i unapplied.
- Vraća osam tipiziranih workAreas polja postojećem export helper-u.
- Helper digest učestvuje u lifecycle autoritetu; nije bezbedno samo prekopirati novi digest u sertifikat.
- DEV readiness ostaje false; export/erasure binding NULL prema poslednjem dokazu.
- Sve AI/poruke/media/arhivske kopije i stvaran export/closure/retention još nisu zatvoreni.

## 14. Čišćenje C01–C19 i serverski paketi SV01–SV14

Prema aktuelnom izvršnom registru:

SOURCE_DONE u svom uskom obimu:
C01 template resursi; C02 stari ručni quick-pick; C03 ručno fact-edit grananje; C04 neaktivni layout podskupovi; C05 nepovezani registry/stats; C06 identičan dupli test; C07 stari motion/design-only reference; C08 V1/fake AI; C09 nepovezani sintetički builder uz prenete korisne provere; C12 nezakačeni GPS/permission prototipovi; C18 identične premium kopije.

PARTIAL:
C10 aktivne/alternativne AI strategije; C11 messages-only/PHONE kompatibilnost; C13 javni komentari; C15 zelene karakterizacije kvarova i recovery; C17 dependency/test/build retirement.

Potpuno povlačenje NOT_STARTED:
C14 stari testni oracle-i; C16 istorijski proofs/kandidati/generatori; C19 SQL/proof blizanci.

Home preview retirement ima poseban zapis docs/cleanup/20261101-home-preview.json.

Serverski statusi:
- SV01 privatne Need kolone: BLOCKED.
- SV02 katalog/hijerarhija: PARTIAL, sa novijim aktivnim Edge poboljšanjima.
- SV03 semantika/transport/trajni prvi plan: PARTIAL.
- SV04 post-save: uski transport prenet; poslovni acceptance PARTIAL.
- SV05 push/cron/red: PARTIAL.
- SV06 export/sve kopije/closure: BLOCKED.
- SV07 legacy intake delete RPC: potpuno povlačenje NOT_STARTED.
- SV08 messages-only/istorijski PHONE opoziv: PARTIAL.
- SV09 odbijajući stari taxonomy wrapper: potpuno povlačenje NOT_STARTED.
- SV10 određene DEV tabele: potpuno povlačenje NOT_STARTED.
- SV11 redundantni scope indeks: potpuno povlačenje NOT_STARTED.
- SV12 debug/410 endpointi i tabela: potpuno povlačenje NOT_STARTED.
- SV13 precizno ojačanje ACL/role/extension: PARTIAL.
- SV14 poreklo/čist bootstrap/upgrade: BLOCKED.

Ne praviti cilj „obrisati sve staro“. Neki stari putevi bezbedno odbijaju nepodržane operacije ili podržavaju stare klijente/opozive/arhive. Uklanjanje traži dokaz zamene. Neesencijalni cleanup može posle lansiranja.

## 15. Zavisnosti i bezbednosni audit

Aktuelni lock audit od 1. novembra:
- 27 affected-package zapisa;
- 21 jedinstven GHSA;
- šest high, 20 moderate, jedan low, nula critical u tom konkretnom npm audit rezultatu;
- deo high putanja vodi kroz CLI/Metro/build/signing/Jest/DevTools.

To nije 27 dokazanih napada na APK. Takođe nije dokaz da su svi nalazi bezopasni. Potrebna je procena stvarne izloženosti i ciljane promene.

GitHub push poruka o 50 upozorenja odnosi se na default branch. Ne izjednačiti je sa rezultatom aktuelnog lock-a ili brojem potvrđenih ranjivosti ovog izdanja. Nije rađen masovni audit fix.

Dokaz:
docs/continuation/source-bridge-20261030/evidence-20261101-1a673-dependency-audit.json

## 16. Interni Android APK i uređaji

Korisnik ima:
- dva testna app naloga;
- jedan Android telefon;
- Google Play Console;
- nema Apple Developer nalog.

Korisnik se sam prijavio u vidljivi emulator. Lozinka nije tražena ili pročitana.

Finalni provereni APK:
- source: 51ac4e24c805c4b99db0b82bf1e4b1c9b1785286;
- package: rs.uskoci.preview;
- versionCode: 36;
- target SDK: 36;
- ABI: arm64-v8a i x86_64;
- runtime: uskoci-v1-preview-r1;
- kanal: preview;
- postojeći debug potpis;
- embedded update: 8ec36beb-935e-4ad3-a19f-0567edf4fa3f;
- SHA256: 67137b7f086f56247ef29b5f603d6f7d11a9a6c949351b20a80a58c1b61f3b20.

Lokalna putanja:
artifacts/android-preview-51ac4e24-20261101-191147/uskoci-preview-51ac4e24-internal.apk

Build receipt je u istom direktorijumu. Instalirani base.apk izvučen je i ima isti SHA. About potvrđuje stvarni source i ugrađeni update. APK ZIP 16 KB alignment prolazi; to ne zamenjuje pun ELF/uređajski dokaz.

Emulator: Android 36.1 Google APIs Play Store x86_64, emulator-5554, AVD USKOCI_20261101_UI. Poslednje ostavljen prijavljen na Home, Wi-Fi uključen, 1080×2424/density420/font1.0. Fizički Android nije bio povezan.

OTA je uključen. Tačan native bundle prvo je pokrenut offline, zatim je mreža uključena. Novi online restart može učitati drugi kompatibilni OTA; sledeća provera mora ponovo pročitati About identitet.

Interni APK nije potpisani Play AAB i nije dozvola za javnu distribuciju. Postojeći preview drži neke Firebase/push tokove inertnim prema build ugovoru; push-proof i production profil moraju biti posebno ispravno podešeni.

## 17. Minimalni celovit E2E koji još mora da prođe

Sa dva testna naloga A i B i odgovarajućim uređajima:
1. Potvrditi prijavu, email povratak, sesiju i oporavak.
2. B kroz AI napravi i aktivira radni profil.
3. Proveriti REMOTE bez grada, ON_SITE i BOTH u odgovarajućim scenarijima.
4. A kroz AI napravi zadatak i potvrdi objavu.
5. Autoritativno ponovo pročitati objavljeni zadatak.
6. Proveriti da B dobija zadatak kroz isti signed matcher, uključujući udaljeno sačuvano područje.
7. Proveriti push na pravom cilju i tap do pravog objekta.
8. B se prijavi sa pravilnom cenom/brojem ljudi/uslovima.
9. A pročita prijavu i izabere B; konkurentni izbor ne prekoračuje mesta.
10. Obe strane vide isti nastali Dogovor.
11. Razmene nove poruke i podržane medije.
12. Provere izmene uslova i otkazivanje.
13. Završe posao, ostave ocene i provere trenutak njihovog objavljivanja.
14. Provere jedinstvenu reputaciju.
15. Ponove ključne tačke posle prekida interneta, restarta, izgubljenog ACK-a, ponovnog ulaska i promene naloga.
16. Zasebno izvrše export/closure i proveru nedostupnosti tuđih privatnih podataka.

Postojeći istorijski završeni Dogovor i read-only poruke ne zadovoljavaju ove korake. Emulator i jedan fizički telefon mogu pomoći paralelnom razvoju; konačni ugovor dva uređaja i iOS moraju imati svoje dokaze.

## 18. Produkcija, Google Play, App Store i poslovne obaveze

Nisu potvrđeni konačni identitet izdavača, poslovno-pravna usklađenost, finalni uslovi korišćenja/politika privatnosti, stvarna podrška/reklamacije i operativna moderacija.

Potrebni su:
- javni i stvarni put za zahtev brisanja;
- tačna mapa podataka i primaoci, uključujući AI i SDK-ove;
- domen i aktivacioni/recovery mejlovi;
- podrška koja zaista prima i obrađuje zahteve;
- nadzor troškova Supabase/Gemini/mapa i redova;
- ograničenja i postupak pri padu servisa;
- odgovorne osobe za incidente, privatnost i korisnički sadržaj;
- proverena obnova i kompatibilan rollback.

Produkcioni backend, Auth/Storage/Realtime/push konfiguracija, TEST/REAL izlaz i runtime/kanali nisu potvrđeni gotovim internim APK-om. Build guard koji odbija production nije greška koju treba samo obrisati; mora dobiti odobren i proveren produkcioni ugovor.

Google Play:
- Console postoji.
- Potrebni su odgovarajući paket/potpis, AAB i instalacija koju Play stvarno isporučuje.
- Potrebni su Data Safety, App Access/testni pristup za pregled, tačan listing i screenshotovi finalnog kandidata.
- Proveriti primenljive zahteve testiranja konkretnog naloga i aktuelna zvanična pravila u trenutku predaje.
- Lokalni target SDK 36 ili ZIP alignment sami ne potvrđuju sve Play zahteve.

iOS:
- Apple Developer nalog nije otvoren.
- Ostaju odobren Bundle ID/Team, provisioning, APNs, build profil, iOS artefakt, iPhone/TestFlight i App Privacy.
- AI govor je source-povezan sa Expo PCM-om, ali native mikrofon/prekidi/Siri/audio route i ostali iOS tokovi nisu potvrđeni.
- Android može prvi, prema postojećem redosledu. iOS ostaje deo ukupnog zahteva i ne sme se predstavljati kao završen.

Ovo je lista otvorenih obaveza, ne novo pravno mišljenje. Pravne i store zahteve proveriti prema aktuelnim zvaničnim izvorima; pravni prihvat traži odgovarajuću ljudsku proveru.

## 19. GO/NO-GO i rok

| Nivo | Trenutna odluka | Razlog |
|---|---|---|
| Interna demonstracija poznatih TEST tokova | CONDITIONAL GO | Postoji instalirani APK i konkretni dokazani tokovi uz poznata ograničenja. |
| Zatvoreni rad sa stvarnim korisničkim podacima | NO-GO | Ključni funkcionalni, privatnosni i dvostrani dokazi nisu zatvoreni. |
| Ograničeno javno lansiranje u Srbiji | NO-GO | Nema završenog osnovnog E2E-a, privacy/production/store paketa. |
| Šire javno lansiranje | NO-GO | Pored prethodnog nedostaju kapacitet, troškovi i operativni prihvat. |

Interna razvojna proba sa kontrolisanim TEST podacima nije isto što i otvaranje aplikacije pozvanim stvarnim korisnicima.

Nema potvrđenog kalendarskog roka. Ne obećavati „sutra“ ili proizvoljan broj dana na osnovu broja testova. Prvi smislen merljiv završetak je:
- postojeća usluga i sinonim;
- opravdana nova grana;
- profil Save+Activate;
- zadatak Publish;
- isti potvrđeni identitet na serveru i readback.

Zatim zatvoriti matching/push i dvostrani posao uz paralelno zatvaranje R01/F21/R10. Tek na toj osnovi proceniti zatvoreno testiranje i javnu predaju. Vlasnik naloga, testeri, pravni pregled i prodavnice imaju zasebne zavisnosti.

Naplata, HITNO, neesencijalni cleanup, dodatna optimizacija i kasniji iOS mogu slediti posle prvog Android izdanja. Bezbednost, podaci i stvarno izvršiv osnovni tok ne mogu.

## 20. Jedinstveni redosled sledećeg rada

1. Osvežiti Git/PR/DEV checkpoint. Sačuvati lokalne izmene.
2. Nastaviti postojeći R04 ugovor od dokazane lektura reprodukcije. Ne ponavljati celo istraživanje.
3. Nezavisno pripremati R01/F21 Auth/privatnosni prihvat i R10 tačan lifecycle binding.
4. Završiti R06 trajnu integraciju i stvarna ograničenja.
5. Kontrolisano preneti R05 i potrebne R07/R11 server kandidate sa odgovarajućim prihvatom.
6. Izvršiti ceo dvokorisnički tok i stvarni push.
7. Sistematski proći sve ekrane u normalnom/praznom/loading/error/offline stanju, na 360dp/font1.3, sa tastaturom i Back ponašanjem.
8. Napraviti odgovarajući novi interni kandidat sa tačnim source/DEV/OTA identitetom.
9. Završiti produkcioni i Play paket; javno puštanje tek uz izričito odobrenje.
10. Nastaviti iOS u njegovom zasebnom dokazu, bez tvrdnje da Android test potvrđuje iPhone.

Za svaki paket: reprodukcija → minimalna ispravka uzroka → relevantni pozitivni/negativni testovi → potrebni CI → kontrolisani DEV prenos → stvarni readback/native → sažet checkpoint u istom masteru.

## 21. Važne netačne interpretacije koje ne ponavljati

- „Sve je na DEV-u“ — netačno. R05, R06 first-plan, R10 export i pojedini drugi kandidati nisu.
- „Gemini nije našao granu“ — za lekturu netačno; vratio je postojeću Lekturu tekstova.
- „Korisnik nije kliknuo potrebnu kategoriju“ — netačno; korisnik ne administrira stablo.
- „Svaki pending zabranjuje objavu“ — nije pravilo plana; proveriti konkretan guard.
- „Novi category predlog znači da je grana upisana“ — netačno.
- „Tri provider turna dokazuju sve BG troškove“ — netačno.
- „R01 je samo beznačajan checker“ — netačno; razdvojiti platform parity od stvarnog privatnosnog rada.
- „R01 pada, pa ništa u aplikaciji ne radi“ — netačno; postoje zasebni DEV/native rezultati.
- „busy opis dokazuje zaglavljen zahtev“ — povučena interpretacija ovog konkretnog nalaza.
- „Prvi REMOTE bez grada nije uopšte popravljen“ — zastarelo za uski primenjeni SQL ugovor; stvarni kompletni AI tok i dalje nedostaje.
- „Moji zadaci i istorijski attention su još isti kvar“ — zastarelo, popravljeni su na DEV/native.
- „Zeleni CI ili postojeći APK znače spreman Play“ — netačno.
- „Nema iOS source govora“ — zastarelo; source put postoji, iPhone dokaz ne postoji.
- „Velik fajl mora da se razbije pre lansiranja“ — nije kriterijum.
- „Običan ChatGPT automatski vidi lokalne artefakte“ — netačno.

## 22. Najvažniji dokumenti za nastavak

Normativni i izvršni:
- docs/plan/CODEX_PLAN_RADA.md
- docs/product/USKOCI_PRODUCT_UX_MASTER.md
- docs/continuation/source-bridge-20261030/

Dokazi stvarne aplikacije:
- docs/continuation/evidence-20261101-r03-native-dev.json
- docs/continuation/evidence-20261101-r07-native-dev.json
- docs/continuation/evidence-20261101-r04-ai-native.json
- docs/continuation/evidence-20261101-native-1a673.json — korigovano tumačenje busy nalaza.
- docs/continuation/evidence-20261101-native-51ac4e24.json — poslednji native/APK dokaz.
- docs/continuation/evidence-20261101-final-native-cbefce43.json — raniji signed-out i Edge recheck.

CI i posebni dokazi:
- docs/continuation/source-bridge-20261030/evidence-20261101-51ac4e24-full-ci.json
- docs/continuation/source-bridge-20261030/evidence-20261101-207a6618-ci.json
- docs/continuation/source-bridge-20261030/evidence-20261101-r05-postgis-ci.json
- docs/continuation/source-bridge-20261030/evidence-20261101-1a673-dependency-audit.json
- docs/continuation/evidence-20261101-r01-dev-catalog.json
- docs/continuation/evidence-20261101-r05-dev-readiness.json
- supabase/proofs/legal/r10-work-areas-export.md
- supabase/operations/dev-alpha/edge-ai-20261101/applied-receipt.json
- supabase/operations/dev-alpha/edge-ai-20261101/config-receipt.json
- supabase/operations/dev-alpha/ledger/

Ove putanje su relativne korenu repozitorijuma. Običan chat bez GitHub pristupa treba da dobije ovaj Markdown dokument i, po potrebi, konkretan dodatni fajl.

## 23. Šta je na GitHubu, a šta je namerno lokalno

Pre ovog handoff-a lokalni i remote HEAD bili su jednaki. Kod, SQL kandidati, testovi, primenjeni operativni paketi, master i privatnost-sačuvani sažeci dokaza su commitovani i poslati na istu granu/PR.

Ovaj handoff se takođe dodaje u docs/continuation/ i šalje na istu granu. Master dobija samo referencu ka datiranom izveštaju; ne pravi se drugi master.

Namerno lokalno ostaju:
- interni APK i izvučeni base.apk;
- sirovi potpisani screenshotovi/XML sa prijavljenim nalogom;
- sirovi logovi i puni lokalni katalog snimci;
- ranije postojeći korisnički prilozi.

Njihovi potrebni sažeci/hash-evi su u dokazima. Ne objavljivati sirove privatne podatke, Auth tokene ili ključeve. Ne tretirati odsustvo APK binarnog fajla u Git-u kao odsustvo izvornog koda ili izgradnje.

## 24. Komanda novom običnom ChatGPT razgovoru

Nastavi USKOČI na osnovu ovog datiranog izveštaja i postojećih master dokumenata. Ovo nije novi projekat i ne treba mi novi paralelni plan. Najpre mi reci koje izvore možeš stvarno da otvoriš, šta je preneti dokaz, a šta si upravo proverio.

Daj jedinstven, razumljiv presek: šta je završeno u kodu, šta je stvarno na DEV-u, šta je potvrđeno na instaliranoj aplikaciji, a šta blokira prve korisnike. Ne vraćaj popravljene istorijske nalaze među aktivne kvarove. Ne proglašavaj CI ili interni APK javnim izdanjem.

Posebno proveri postojeći R04 ugovor i lektura reprodukciju. Korisnik treba da opiše posao/uslugu, vidi razumljiv pregled i sačuva/aktivira/objavi. Sistem treba da razvrsta postojeću ili novu uslugu i sačuva stvarnu vezu u bazi. Korisnik ne bira tehničku granu. Ne praviti globalni alias ili prisilni READY kao prečicu.

Ako imaš izvršne alate i pristup, nastavi konkretan bezbedan rad na tom ugovoru, uz reprodukciju, minimalnu popravku, testove i kontrolisanu DEV proveru. Ako ih nemaš, nemoj tvrditi da implementiraš: pripremi tačan ograničen izvršni zadatak za razvojno okruženje, sa postojećim fajlovima, kriterijumima prolaza i potrebnim dokazima.

Uz R04 zadrži R01/F21 i R10 kao bezbednosne obaveze, pa R05 matching, R06 trajni oporavak/limite i R09 stvarni push. Završni prihvat obuhvata oba naloga, profil→zadatak→matching/push→prijavu→Dogovor→poruke→završetak→ocene, plus prekide i promenu naloga.

Koristi srpski i jednostavan jezik. Daj jasnu listu prioriteta i stvarne zavisnosti. Ne izmišljaj procenat završenosti ili datum. Ne traži ponovo odluke koje su već navedene kao potvrđene. Produkcija, prodavnice, naplata i destruktivne promene zahtevaju posebno odobrenje. Cilj je završena, jednostavna i pouzdana aplikacija, a ne beskrajna dokumentacija.
