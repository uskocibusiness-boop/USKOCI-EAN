# USKOČI — stručni presek i uslovi završetka, 9.10.2026.

Ovo je vremenski presek postojećeg plana, ne novi master ili drugi registar. Jedini registar ostaje `docs/control/redovi.json`; njegov pregled je `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`. Pregled obuhvata izvor ce23eb06, postojeće receipts, poslednju primenu na kanonskom DEV-u (ledger 237), novu emulator proveru i telefonski APK istog izvora. Tri nezavisna read-only stručna pregleda pokrila su AI/lokaciju, saradnje i komunikaciju; korenska sesija proverila je bazu, performanse, konfiguraciju i artefakte. Nije izvršen novi test svakog dugmeta niti svih poslovnih grana.

## Zaključak

USKOČI ima povezanu funkcionalnu osnovu i stvarne dokaze objave, čuvanja radnog profila, prijava/Dogovora i jedne dostavljene push poruke. Nije završena niti spremna za javnu prodavnicu. Trenutno stanje je **integrisan testni proizvod sa nezatvorenim funkcionalnim, performansnim i release uslovima**.

Glavne prepreke nisu nedostatak još jednog vizuelnog redizajna. To su: potpuno prihvatanje AI izmena i nastavka nacrta; povezani tokovi na jednom aktuelnom APK-u; nedovršen push za prilike i grupu; konkretno spora Discovery pretraga pri velikom skupu podataka; produkcioni paket i privatnost/release dokazi. Završavanje treba voditi po tim uslovima, bez beskonačnog dodavanja kozmetičkih krugova.

Ne dajemo zbirni procenat: 341 ciljani test UI-ja, klijenta i obračuna ne može nadoknaditi jedan nedostajući prirodni push, a broj gotovih ekrana ne meri spremnost za prodavnicu.

## Stanje po oblastima

| Postojeći redovi | Dokazano | Otvoreno i sledeći konačni dokaz |
|---|---|---|
| **B00–B03: AI radni profil** | Na emulatoru f64 stvarni AI odgovori → pregled → čuvanje; DEV potvrđuje ACTIVE profil i COMPLETED razgovor, grad, veštinu i dostupnost. Pregled/ručno uređivanje postoje. | Na aktuelnom APK-u otvoriti aktivni profil, promeniti činjenicu kroz AI, pregledati, sačuvati, ponovo otvoriti. Dokazati uticaj na podobnost za zadatak. Geometrijski radijus, stvarni glas i proširene WPP02 preference nisu zatvoreni tim dokazom. |
| **A02/A06/A07/A13: AI zadatak i izmene** | Stvarna native objava 09.10: pregled, izričita potvrda, PUBLISHED revizija1 i završen razgovor. Edge60 primenjen i šest fajlova byte-equal. Postoje poseban razgovor za izmenu, revizije i zaštita sačuvanih Dogovora. | Edge60 popravka završne naredbe „to je to“ još nema real-provider potvrdu. Proveriti AI izmenu objavljenog zadatka, odustajanje bez upisa, zastareli odgovor i propagaciju promene prijavama. **Pronađena praznina:** ulaz `/nova` posle restarta bez conversationId ne daje dokazan vidljiv nastavak sačuvanog nedovršenog razgovora. To nije dokaz gubitka podataka na serveru. |
| **A03: AI glas** | Jedan hold-to-talk ulaz, lokalno snimanje/pregled i odustajanje imaju ranije native dokaze. Poseban ulaz za glasovni AI razgovor uklonjen po vlasniku. | Stvarni govor → transkript → AI odgovor → sačuvana činjenica na oba AI toka; odbijena dozvola, prekid i pozadina. Tok zadatka zadržava odgovor dok ne obradi činjenice; potpuno prikazivanje reč po reč nije potvrđeno. |
| **A04/B02: lokacija, pin, ruta** | Pravi geocoder rezultati i potvrda Beograda; puna adresa pre potvrde; pregled tačke i povratak kroz ugnježdene ekrane. Latinica/ćirilica i pomeren pin posle neuspešnog reverse-geocoding-a popravljeni i pokriveni ciljanim testovima. | Svež native drag pina → nova adresa/neutralan opis → čuvanje/reopen. Pravi AI tok A→usputna tačka→B, redosled i povratak na pogrešnu tačku. Pregled prikazuje numerisane tačke, ne navigacionu liniju puta. Google Maps link prenosi do pet tačaka; duže rute ne seče prećutno. |
| **B04/B05: mapa, lista, filteri** | Mapa i lista su jedan ekran; capsule kontrole, tačke van mape/na daljinu, podizanje liste i kartica postoje. B52 prikazuje lokalnih1000 fixture zadataka i čitljivu podignutu listu. Izvor mape ostaje dole levo po odluci vlasnika. | Na SwiftShader emulatoru nedostaju nazivi ulica/brojevi grupa pinova. Uzrok nije dokazan kao produkcioni kvar telefona. Potrebni završni dokaz simbola i merenja pin→kartica, list→scroll→collapse, očuvanja filtera i kamere; Discovery API performanse niže su zaseban blokator. |
| **B09–B11/A11/A12: prijave i izbor** | Default1, ± i direktan unos; ograničenje broja, srazmerna TOTAL cena i zaokruživanje jednom po prijavi. Server ledger237 i klijent usaglašeni; 341 test,8925 numeričkih vektora, lokalni pravi SQL izbor1+2 i3333+6667. Novi ce23 emulator prikazuje3333/6667/10000, blokira neispravan unos i čuva2 pri povratku iz pregleda. | Interaktivne scene su inertne, nisu live slanje. Zatvoriti ceo aktuelni native UI→RPC→prijem kod naručioca→izbor→isti uslovi Dogovora. Proveriti promenu slobodnih mesta i stale KEEP/UPDATE/WITHDRAW. Stari sačuvani uslovi ostaju autoritet. |
| **A14/A15/D06–D12: otkaz, brisanje, zamena, završetak** | Odvojeni cancel/delete-draft; neizvestan ishod ima readback. R3 primenjen05.10:22 behavioral+9 refusal provera. Izolovani povezani RPC lanac sa četiri Auth naloga potvrđuje dva izbora, otkaz jednog, zatvaranje/otvaranje i zamenu. Postoje izmene Dogovora, problem, završetak i ocena. | Aktuelni native dokaz tih grana sa dve strane i prekidom mreže. Brisanje nacrta sa slikom posebno od otkaza objavljenog zadatka. Zatvaranje potrage ne otkazuje Dogovore; ručno zatvorena potraga ostaje zatvorena posle otkaza. |
| **D01–D05: privatni/grupni čet i učesnici** | Stvarna tekstualna poruka prešla između naloga. Postoje identitet/inicijali pošiljaoca, izbor privatnog/grupnog kanala, istorija, potvrda čitanja i retry. Izolovani RPC dokaz: učesnik privatno samo sa naručiocem, otkazani ne vidi buduće poruke, zamena ne dobija staru istoriju. | Nova višekorisnička native provera: najmanje tri osobe, stvarni izbor sagovornika posle straničenja, istorija+tastatura, slanje posle zamene i pravi prijem. Nije potvrđena stvarna profilna fotografija uz svaku poruku. Jedan prethodni složen skrol pokušaj prekinut ANR-om nije prolaz. |
| **A05/D03/D04: fotografije i glasovne poruke** | Upload/prikaz/retry/uklanjanje i zaštite postoje; RC-02 korekcija primenjena02.10. Voice B1 server primenjen01.10; recorder/player/UI i build zastavica postoje. | Snimanje→slanje→drugi nalog→slušanje, odustajanje/pozadina/prekid; slika zadatka i četa→otvori→retry→ukloni. Uklanjanje iz prikaza nije samo po sebi dokaz fizičkog Storage brisanja. Radni AI profil nema foto-prilog; grupa je u sadašnjem opsegu tekstualna. |
| **P01–P05: obaveštenja** | Prirodna privatna tekstualna MESSAGE poruka: jedan SEND, provider prihvatio, vlasnik potvrdio da je stigla i otvorila tačan razgovor. To jeste stvaran uspeh. | OPPORTUNITY ima izolovane matching/SQL/sertifikat dokaze, ali proširenje transporta nije primenjeno na DEV niti fizički dostavljeno. Telefonski cilj poslednje ima DRAFT profil bez veština/grada. Grupni send RPC nema notification emitter. Ostale kategorije nisu fizički potvrđene; transportne zastavice ostale OFF posle ograničene probe. |
| **N01–N11/S01–S04: nalog, bezbednost, oporavak** | Postoje Auth/session, RLS/RPC autoriteti, verzionisanje i sprečavanje duplikata. Ledger237 ne menja sertifikate/ACL; retention readiness ostaje true. Poslovni reset pet testnih naloga urađen po odobrenju. | Završni paket: A→B→A bez curenja podataka, recovery link, prava pristupa, export/closure sa prilozima, prijava/blokiranje/podrška, restart/offline/retry. Reset testnih podataka nije dokaz korisničkog brisanja naloga. Ne ponavljati reset. |

## Šta znači da je povezano sa Supabase-om

Klijent koristi server za poslovni autoritet: sopstvene naloge, revizije, prijave, tačne prihvaćene uslove i dozvoljene komande. AI/mediji/push imaju zasebne Edge i asinhrone putanje. Provera poziva klijenta ne nalazi nedostajući deklarisani server RPC; to ne dokazuje da je svaki tok ispravan. Jedanaest serverskih mogućnosti i dve Edge putanje ostaju neizložene prema postojećem inventory-ju; svaku treba klasifikovati kao namerno internu ili potrebnu korisniku pre dodavanja dugmeta.

Aktuelni tehnički snimak beleži237 ledger zapisa,260 public RPC-a,11 Edge funkcija i nula zabeleženih cron grešaka u posmatrana24h. To potvrđuje inventar, ne ukupnu brzinu, uspešnu dostavu ili odsustvo bagova. Postojeći security advisories nisu nestali; nova korekcija cene nije dodala promenu u njihovoj raspodeli.

Pravila su bitna korisniku: izmena zadatka ne prepisuje prihvaćen Dogovor; otkaz jednog izvođača ne ruši ostale; ponovljen dodir posle prekida ne sme napraviti drugi upis; privatna adresa i razgovor ne smeju ostati dostupni povučenom učesniku. Dokazi se vezuju za te ishode, ne samo za prisustvo funkcije u bazi.

## Brzina i kapacitet — glavni tehnički rizik

Ranije optimizacije jesu primenjene: uklonjen deterministički PostgREST retry problem, poboljšano zbirno čitanje/straničenje i brz put za vremensku zonu Srbije. Ne znači da je cela baza sada brza.

Izolovani Discovery test imao je **40000 sintetičkih zadataka**, dva Auth naloga i jednog posmatračkog korisnika, na deljenom2CPU CI hostu sa loopback HTTP-om. To nisu40000 aktivnih ljudi niti merenje produkcionog Supabase kapaciteta.

| Istovremeni zahtevi | Merenje | Uspešan protok | p50 / p95 HTTP | Greške |
|---|---|---:|---|---|
|1|60s posle15s zagrevanja|1,28 zahteva/s (77)|567ms /2055ms|0|
|4|60s posle15s zagrevanja|1,43 zahteva/s (86)|1995ms /6707ms|0|
|16|samo zagrevanje,27 početih|nije merena faza|nije prihvatljiv uzorak za poređenje|22 uspela,5 HTTP500/57014|
|32|nije pokrenuto|—|—|—|

Generisanje opterećenja i baza dele ograničen host; nema dokaznog zaključka o maksimalnom serveru. Mešavina čitanja ima sedam oblika upita u deset slotova. Bez retry-ja; finalna provera fideliteta posle prekinutog testa nije dostignuta. Rezultat jasno **ne zadovoljava** postojeći početni cilj običnog straničenog API čitanja p95≤1s u deklarisanim uslovima.

Sledeća dijagnostika reprodukovala je problem plana tekstualne pretrage: automatski plan prvih pet puta oko2,1–2,3s, šesti timeout90s; prisilan generic plan odmah timeout. Lokalni kandidati sa istim odgovorima i rollback-om i dalje traju približno7–15s u svojim drugim kontrolisanim SQL scenarijima. **Nisu prihvatljivo rešenje i nisu primenjeni na DEV.** Delimična lokalna kopija u tim eksperimentima nije pun dokaz aktuelnog DEV sertifikata. Rezultati tih različitih eksperimenata ne smeju se neposredno porediti kao ubrzanje/usporenje.

Potrebno je dovršiti usko poboljšanje stvarnog plana/upita, očuvati rezultate/filtere/privatnost, izmeriti pre/posle pod istim uslovima i tek onda ponoviti ograničeno mešovito HTTP opterećenje. Ne rešavati ovo nasumičnim povećanjem timeout-a ili globalnim konfiguracijama. Realističan mešoviti test objava, prijava, otkaza i zamena za populaciju40000 korisnika **još nije dokazani rezultat**.

## Obaveštenja — stvarni obuhvat

Matrica nalazi19 tipova događaja sa emitterom. To obuhvata prilike, prijave, izmene/otkaz zadatka i Dogovora, završavanje, poruku, ocenu i pojašnjenja. Pet deklarisanih tipova nema pronađeni emitter: RESPONSE_SHORTLISTED, RESPONSE_NOT_SELECTED, RESPONSE_STALE, RESPONSE_EXPIRED i PRIVATE_ACCESS_GRANTED. Potrebno je odlučiti prema postojećem produktnom ugovoru da li su potrebni, objedinjeni drugim događajem ili namerno nedostupni. Samo postojanje enum-a nije funkcionalnost.

Konkretna praznina: `rpc_send_group_message_v5` upisuje grupnu poruku i vidljivost, ali nema emit_event niti pronađeni posredni trigger. Privatni push zato ne potvrđuje grupni. Transport radi uz događaj, podobnost, podešavanja, vezu uređaja, ograničeni admission, provider i tap putanju; svaka karika mora biti potvrđena. Nema globalnog pražnjenja reda niti uključivanja svih događaja radi probe.

## APK i javna prodavnica

**Novi testni APK ce23eb06 postoji:** ARM64 `rs.uskoci.preview`, versionCode35, potpis provereno isti kao ranije; SHA256 `d9b875a0e8293eaf07c34190a0b59f119d50d281f9322854a796726826762e16`. Emulator paket istog izvora instaliran preko postojećeg, bez brisanja podataka, runtime identitet potvrđen. Telefonski paket nije ovim fizički prihvaćen; OTA preview takođe zahteva očitavanje stvarnog runtime izvora. Lokalni build nije CI prolaz.

GitHub run37953118571 nije pokrenuo posao zbog billing/spending limita. To je operativna prepreka automatizovanoj proveri; ne proglašavamo CI zelenim i ne menjamo naplatu bez vlasnika. Lokalnih341 ciljanih testova, TypeScript i oba build-a imaju zasebne dokaze.

Izvršeni repo production profil rešava se na Android **`rs.uskoci`**, AAB/store, remote credentials, production OTA. I dalje cilja kanonski DEV, a validator zahteva isti cilj. Preview Firebase namerno je isključen i nema konfiguracije za `rs.uskoci`. To nije potvrda stvarnog EAS cloud okruženja ni potpisanog production AAB-a. iOS bundle ID nije postavljen, postojeći build hook je Android-only.

Pre slanja u Play moraju postojati: potvrđen produkcioni backend i rollout/rollback; pravi Firebase/push za production paket; potpisani i pregledani AAB/manifest/dozvole; završen native prihvatni paket; javne privacy/terms/deletion stranice, stvarni operator/kontakt i Data Safety; reviewer pristup i konkretna Play track provera. Za f61 postoje statičke16KB provere28 biblioteka; nisu runtime/AAB dokaz niti se automatski prenose na ce23. [Android16KB](https://developer.android.com/guide/practices/page-sizes), [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

Testni APK je isporučen kao [privatni prerelease ce23](https://github.com/uskocibusiness-boop/USKOCI-EAN/releases/tag/qa-phone-20261009-ce23eb06); upload SHA256 i veličina provereni sa GitHub asset-om. **Datum store spremnosti još nije odgovorno odrediti**, jer nisu zatvoreni pretraga, push i navedene produkcione obaveze. Dostupnost testnog APK-a, spremnost za upload i odobrenje prodavnice su tri različite tačke. App Store/iOS nema završni dokaz.

## Ograničen redosled završavanja postojećeg plana

1. **AI i lokacija, prioritet vlasnika — A02–A07/A13/B00–B03.** Aktivni profil→AI izmena→save/reopen; zadatak→AI izmena; nastavak nacrta posle restarta; finish-only kategorija; pomeren pin i ruta sa tri tačke; govor→transkript. Svaki scenario završava potvrdom servera i ispravnim povratkom u aplikaciji. Prvo završiti ove dokaze/popravke, bez novog opšteg redizajna.
2. **Povezana saradnja — A08–A15/B09–B11/D01–D13.** Jedan zadatak za tri osobe→prijave1+2→oba izbora; zasebni zadaci za stale KEEP/UPDATE/WITHDRAW i cancel/delete; otkaz jednog→ostali ostaju→close/reopen→zamena; predlog izmene/prihvatanje/odbijanje/povlačenje, problem, završetak i ocena. Isti APK/server manifest, tačni prihvaćeni iznosi, retry bez duplikata.
3. **Komunikacija i push — D03–D05/P01–P05.** Dva naloga za tekst/sliku/glas; najmanje tri učesnika za grupu i privatnu metu; native čitanje/skrol/pozadina. Stvaran aktivan radni profil→prirodno podudaranje→jedan opportunity push; grupni emitter i isporuka; zatim preostala matrica po stvarnoj produktnoj potrebi.
4. **Performanse i oporavak — B04/B05/S01–S04 i postojeći performance uslovi.** Reprodukovano usko SQL poboljšanje, isti odgovori i rollback, HTTP mešovito opterećenje. Zabeležiti populaciju, istovremenost, zahteve/s, odziv/greške i ograničenja hosta. Završni uređaj: najmanje30 ponavljanja za osnovne percentile; feedback≤100ms, učitan pin→kartica≤200ms, topao povratak≤350ms, APIp95≤1s u deklarisanim uslovima. Bez ANR-a, duplikata ili međunaloškog curenja. Ovo su postojeći budžeti, ne novi izmišljeni SLA.
5. **Zamrzavanje izdanja — N/S/P obaveze i postojećih24 store stavki.** Jedan finalni release manifest povezuje commit, APK/AAB, server, Edge, zastavice i potpis. Dovršiti produkcionu konfiguraciju, privatnost/brisanje, uređaj i Play provere. Javna objava ostaje konkretan vlasnikov odobren release paket.

Pojedinačna oblast se zatvara kad navedeni ograničeni scenariji imaju dokaz, svi nalazi koji blokiraju tok ili privatnost su otklonjeni, nema neobjašnjenog UNKNOWN ishoda u novim prihvatnim scenarijima i redovi postojećeg registra su usaglašeni. Istorijski provider UNKNOWN dnevnici ostaju sačuvani i bez automatskog ponavljanja slanja. Zatvorene oblasti ne otvaramo radi estetskih eksperimenata. Nove funkcije koje nisu obavezne za ovaj cilj idu posle izdanja. Ozbiljan reprodukovan bag opravdava ponovno otvaranje.

Kraj ovog posla je prihvaćen paket obaveznog obuhvata i ispunjene release kapije, ne tvrdnja da softver nikada više neće tražiti održavanje.30-minutna automatizacija ostaje pauzirana po vlasniku; ovaj izveštaj je ne uključuje ponovo.

## Glavni trag dokaza

- `evidence/native-f64b6bb4/worker-ai.json`; `evidence/intake-completion-20261009/v59-deployed-native.json`; `evidence/review-map-finish-20261009/deployed-native-phone.json`.
- `evidence/application-people-20261009/`; `supabase/operations/dev-alpha/ledger/20261009_application_people_rounding.receipt.json`.
- `evidence/connected-lifecycle-37867079947/connected-journey-report.json`; R3 ledger05.10.
- `evidence/push-real-message-20261009/receipt.json`; `evidence/push-opportunity-local-20261009/`; `evidence/push-opportunity-certificate-local-20261009/`; `NOTIFICATION_MATRIX.md`.
- `evidence/discovery-concurrency-37868724376/`; `evidence/discovery-local-plan-20261009/`; aktuelne performance dopune registra.
- `supabase/operations/dev-alpha/ledger/20261002_ex05_rc02_application.receipt.json`; voice B1 primena01.10.
- `CONTINUITY_FINISH_20261008.md`, `docs/authority/OWNER_DECISIONS_20261008.md`, postojeći62 redova registra i `FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md`.

Istorijski tekstovi koji su govorili da RC-02 nije primenjen, da voice player tek treba napraviti ili da TOTAL zahteva celu ekipu nisu sadašnje stanje. Njih čuvamo kao istoriju, a aktuelne sažetke usaglašavamo sa receipts. Ni pregled dokumentacije ni nova kontrola broja ljudi ne menjaju automatski svetlo fizičkog telefona u zeleno.
