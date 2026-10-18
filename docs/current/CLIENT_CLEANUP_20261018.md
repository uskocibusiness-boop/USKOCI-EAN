# Tehničko čišćenje klijenta — 18.10.2026.

Završen je ograničen paket čišćenja na polazištu `bb0ba8df8b9eabf492607415f41a2a02d96ed672`, na postojećoj grani `feature/unified-qa-master-20261017`. Klijent je kod aplikacije koji radi na telefonu: ekrani, navigacija, lokalno stanje, prikaz i komunikacija sa serverom. Ovaj paket sređuje njegov izvor bez redizajna ili promene poslovnog ponašanja.

## Šta je uklonjeno

| Celina | Rezultat |
| --- | --- |
| Mrtav aplikacioni kod | 15 modula bez aktivnih ili laboratorijskih importera, odsutnih i iz stvarnog Android paketa |
| Stari ručni editori | FactValueEditors, ResponseDeadlineEditor, AmountField i neupotrebljeni AI token alias; postojeći AI razgovor/pregled ostaje |
| Stari vizuelni donori | ReferenceEntryHero, HomeIllustration, WorkProfileArt, CalendarArt, PeopleArt, ToolArt, LottieArt i povučeni V2Icon |
| Duplirane/nepovezane putanje | NoApplicationsHelp, availableNowWrite i workerAiAvailabilityPatch; aktivni waitingHelp i AI dostupnost ostaju |
| Razvoj i testovi | Nekorišćen template reset-project.js, 5 test-fajlova povučenih modula i 44 zastarela jest.mock poziva |

Sve obrisano je povratljivo iz prethodnog Git commita; tačne putanje, veličine i SHA-256 nalaze se u [mašinskom dokazu](evidence/CLIENT_CLEANUP_20261018.json). Nisu brisani korisnički podaci, aktivne rute, serverske funkcije, migracije ili originalni grafički resursi.

Promene u tri živa aplikaciona fajla su samo komentari. AST bez komentara ostao je jednak. U testovima je jedan stari mock uklonjen i iz sačuvane reprodukcije `outputs/audit-20260924/client-terminal-photos.repro.test.tsx`; rezultati starih izvršavanja nisu prepravljani.

## Dokaz da aktivni prikaz nije prepravljen

Pre i posle izmene izvršen je stvarni Android Expo export sa Hermesom, sourcemap-om i istim preview podešavanjima kao aktuelni phone workflow. Oba imaju **5.809 identičnih putanja izvora** i **63 bajt-identična resursa**. Nijedan od 15 povučenih modula nije ulazio ni u prethodni paket. Jedine tri razlike u source sadržaju su pomenuti komentari.

Hermes fajlovi imaju istu veličinu, **13.729.012 bajtova**, ali različite hash-eve. Zato ne tvrdimo bajt-identičan paket. Ovo takođe nije dokaz ubrzanja, manjeg APK-a ili fizičkog uređaja; ponovljeni export sa toplim kešom nije benchmark.

Konzervativni AST graf: 720 → 705 razmatranih source fajlova; aktivni koreni ostaju na 662, sa design-lab korenima na 696. Prazan broj običnih importera sam po sebi nije bio dovoljan kriterijum za brisanje.

## Provere

- TypeScript: PASS.
- Cela Jest regresija: **619/619 grupa, 13.824/13.824 testova, 3/3 snapshot-a**, prirodan exit 0.
- Design-lab granica, resursi i CI scope: **32/32 Node provere**.
- Osveženi postojeći registar/LIVE prikaz: **16/16 control testova** i provera konzistentnosti PASS; stari DEV snapshot ostaje datiran, bez lažnog novog očitavanja.
- Aktuelno vlasništvo izvora, native patch guard i whitespace diff: PASS.
- Četiri nova testa montiraju stvarni `EntryWelcome` sa različitim sistemskim trakama i uvećanim tekstom; provere scroll prostora i obe auth radnje zamenjuju source-string test starog donora.
- Test pregleda proverava odsustvo stvarnih ručnih kontrola roka, a ne više odsustvo lažnog uklonjenog mock tipa. Postojeće publikovanje/rok i zaštitni testovi ostaju.

Prvi pokušaj nije bio potpuno uspešan: deo brisanja nije ostao fizički primenjen u radnom prostoru. To je izazvalo nedostajuće test importe i jedan stari entry guard pad. Originali su provereni, tačna brisanja ponovljena i indeksirana; gore navedeni pun prolaz važi tek za tako usaglašeno stablo. Jest je upozorio na odloženi izlazak, a zatim se sam završio sa 0; nije upotrebljen forceExit i nije proglašeno otklanjanje uzroka tog upozorenja.

Arhitektonski scanner zadržava dva REVIEW_REQUIRED nalaza: javni map-style fetch u `MapLabelsProbe.tsx` i `mapStyle.ts`. Pregled koda pokazuje postojeće učitavanje javnog stila mape, ne potvrđen privatni data leak. Nisu menjani u ovom paketu.

## Šta namerno ostaje

- `agreementCurrentLocationService` i `AgreementLocationController`: proveriti aktivni public/private location ugovor i recovery pre povlačenja para. Ne brisati server RPC samo zbog statičkog klijentskog grafa.
- `locationResolver`: proveriti paritet sa produkcionim geokoderom.
- `selectionIdempotency`: postojeći test/CI dokaz bitne semantike; ne odbacivati zbog odsustva UI importera.
- `notificationAsk`: uporediti sa stvarnim native permission tokom.
- `ReviewCommentsSection`: aktivni profil koristi `ReceivedReviewsSection`, ali domen/vidljivost komentara zahtevaju zaseban pregled.
- Tri test pomoćnika (`voiceMessages/testing/fakes`, `permissions/testing/answeringHost`, `system/stateRules`) nisu pogrešno proglašena beskorisnim kodom.
- Aktivni `ui/v2`, stare redirect rute, privatnost, oporavak, centralni tokeni, Reduce Motion, veliki tekst i native zaštite ostaju.
- Postinstall sync starih entry resursa još pripada ugovoru build/patch skripti. Njegovo kasnije povlačenje treba dokazati kroz taj pipeline; biblioteke/native paketi nisu naslepo izbačeni. Lottie se još koristi u laboratorijskoj komponenti.

## APK je zaseban dokaz

U toku ovog rada završio se [prethodni phone build 39163968732](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39163968732): **SUCCESS**, izvor `bb0ba8d`, ARM64, artifact `12149464814`. Njegova puna regresija je 624/624 i 13.839/13.839; sadrži raniji Home/DEV reliability paket, **ne ovo novo čišćenje**. CI receipt navodi APK SHA-256 `46991a162f693371200c6e90323652250210b8b43d9b6e10a99603554c582427`.

Pročitani su CI rezultat, metadata i receipt log; artifact nije ovde preuzet i ponovo hash-ovan. Nema nove instalacije, OTA objave, emulator/phone prihvatanja niti podizanja release statusa. Za ovaj source-only paket nije pokretan još jedan skup native build.

## Sledeća korisna celina

Prvo ograničiti **Home core čitanje ličnih kolekcija**, bez promene izgleda, i reprodukovati/opraviti slučaj u kome nepotpuna stranica Dogovora izgleda kao uspešno učitan ceo spisak. Zatim pregledati preostale location/review/permission grane sa dokazom njihovog aktivnog naslednika. Vizuelni redizajn ostaje u postojećem planu, kao zaseban povezan posao.

Baza nije menjana niti ponovo očitavana u ovom source-cleanup paketu. Poslednji potvrđen DEV ledger je 288 iz prethodne isporuke; nema novog DEV dokaza samo zato što je ovaj izveštaj noviji.
