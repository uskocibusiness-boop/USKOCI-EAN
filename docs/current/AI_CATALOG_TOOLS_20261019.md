# USKOČI — pretraga rastućeg kataloga iz oba AI razgovora

> Datirani prethodni paket. Naknadni [SERVICE_EXECUTION_20261019.md](SERVICE_EXECUTION_20261019.md) beleži Task106/Worker59, uklonjenu prepreku roditeljskih režima, živ CREATE_CHILD/EXTEND_MODE, Save, matching i novi klijent. Nalazi ispod opisuju stanje prethodne probe, ne preostalu blokadu nakon tog paketa.

Datum: 19.10.2026. Kanonski DEV: `leqcwgzvjsxugfgzdmth`.
Implementacija: `e105d3bf`; završna ispravka: `80619453`.
Detaljan dokaz: [AI_CATALOG_TOOLS_20261019.json](evidence/AI_CATALOG_TOOLS_20261019.json).

## Kratak zaključak

Oba AI razgovora sada imaju serverski alat za pretragu aktuelnog kataloga, otvaranje roditelja, dece i srodnih grana. Ceo katalog se više ne šalje modelu odjednom. Pretraga nije ograničena na prvih 96 kategorija niti na šest nivoa.

Ovo je objavljeno: Task Edge **105**, Worker Edge **58**, sa proverom sadržaja svih **14/12** fajlova. Nova SQL funkcija primenjena je kao DEV migracija **20261019092405**, sa potpuno istim bajtovima kao lokalna migracija. Prava su proverena: samo service_role; funkcija je read-only, STABLE, SECURITY INVOKER.

Sadašnje tehničke granice dovoljne su za proverene razgovore. Nije dokazano da svaki budući složen slučaj može da se potpuno klasifikuje u jednom odgovoru. Konkretan preostali slučaj je proširenje dozvoljenog načina rada već postojeće grane.

## Kako radi

1. Server učitava verziju i otisak aktuelnog kataloga, početne grane i relevantne već poznate usluge.
2. Gemini kroz isti razgovor poziva read-only alat: SEARCH, ROOTS, CHILDREN, SIBLINGS, ANCESTORS i RESOLVE.
3. Rezultati dolaze u stranicama. Ako postoji nastavak, prva stranica se ne predstavlja kao cela pretraga.
4. Pre prihvatanja predloga server zasebno proverava sve tačne nazive i registrovane alijase, uključujući moguće duplikate van stranica koje je model pogledao.
5. Posle odgovora proverava se da katalog nije promenjen u međuvremenu.
6. Modelov rezultat ostaje predlog u privatnom nacrtu. Potpisani pregled i eksplicitno čuvanje ostaju granica za kanonske veze i eventualno dodavanje kategorije. Objavljivanje zadatka/aktiviranje profila i pravila dispatchinga ostaju zasebni uslovi.

Pretraga je leksička po nazivima i alijasima; Gemini tumači značenje i može da istražuje više izraza i grana. Sama prazna pretraga jednog izraza ne dokazuje da usluga ne postoji.

## Šta je stvarno provereno na DEV-u

Sve probe vođene su na novom izolovanom QA nalogu. Milošev nalog, telefon i razgovori nisu menjani.

| Primer | Ishod | Model pozivi | Od slanja do potvrđenog čitanja |
| --- | --- | ---: | ---: |
| Zadatak: figurica prema STL fajlu, izrada kod izvršioca i dostava | READY, postojeći ID 3D printovanja, REMOTE | 2 | 13,141 s |
| Radni profil: ista usluga, Novi Sad, slanje gotovog predmeta | READY, isti ID, REMOTE | 3 | 18,726 s |
| Autorska taktilna karta zvezdanog neba | READY, pronađena ranije postojeća odgovarajuća kategorija | 4 | 17,034 s |
| Restauracija mehaničke muzičke kutije, pre dopune instrukcije | Sačuvane činjenice; odbijen roditelj koji ne podržava REMOTE | 4 | 18,677 s |
| Isti retki slučaj u novom razgovoru posle ispravke | NEEDS_REVIEW; pošteno prikazana nedovršena klasifikacija | 3 | 18,598 s |

Prva tri slučaja proverena su na Task104/Worker57. Poslednja proba je na Task105; Worker58 ima istu zajedničku dopunu instrukcije i offline proveru, bez dodatnog stvarnog worker razgovora posle te dopune.

3D zadatak i radni profil predlažu UUID `d5e890a0-2502-4901-8803-7462b8ca6d24`. Taktilna karta koristi `ef63d6d2-7087-4d67-8a9d-b07952655d03`. To su predlozi potvrđeni za pregled, a ne novi sačuvani matching zapisi iz ovog testa.

Ukupno: **5 korisničkih poruka, 16 Gemini poziva**, svi sa pojedinačnom rezervacijom i evidentiranom potrošnjom. Interni obračun prema tokenima: **0,143341 USD**; to nije potvrda spoljne fakture. Maksimalni unapred određeni zbir rezervacija za sva tri testna kruga bio je 5 USD.

Otisci kataloga, kanonskog profila, zadataka i njihovih taxonomy veza jednaki su pre i posle svih proba. **0 Save, 0 Publish, 0 aktiviranja profila**. Harness nije pozivao matching ili push. Sačuvani su privatni razgovori, činjenice, predlozi/pregledi i obračun potrošnje. Nije napravljena nova globalna kategorija tokom četa.

## Ograničenja: šta je promenjeno i šta ostaje

| Granica | Aktuelno | Značenje |
| --- | --- | --- |
| Ukupan broj kategorija dostupan AI-u | Nema stare granice 96 | Pretraga obuhvata ceo aktuelni katalog |
| Dubina stabla | Nema stare granice šest nivoa | I dalje važe veličina podataka, odsustvo ciklusa i integritet roditelja |
| Veličina jednog model zahteva | 128 → **256 KiB** | Sadržaj razgovora i rezultati alata; nije kapacitet kataloga |
| Veličina stranice | 32 stavke; RPC dozvoljava najviše 100 | Nastavak pretrage preko kursora |
| Krugovi istraživanja | Do 3, zatim završni odgovor | Najviše 4 model poziva po korisničkoj poruci |
| Alati | Do 24 poziva ukupno, 12 u jednom krugu | Nezavisna read-only čitanja mogu paralelno |
| Serverska čitanja i prikupljeni dokaz | Do 128 upita / 2 MiB po poruci | Prekoračenje znači nepotpunu proveru, ne nepostojeću uslugu |
| Zajedničko vreme istraživanja | Do 42 s od ulaska u handler | Ostaje vreme za obračun i čuvanje pre klijentskog roka od 55 s |
| Završni obračun jednog poziva | Do 3 s | Nepoznata potrošnja nije nula; rezervacija se ne briše |
| Izlaz modela | Do 8.192 tokena po pokušaju | Zaštita od prevelikog/neograničenog odgovora |

Ne treba ukloniti sve granice. Treba meriti kašnjenje i razlog nedovršenog odgovora, pa proširivati onu granicu koja stvarno smeta. Ovih pet proba nisu test velikog kataloga niti statistički pouzdan p95. Sintetičke SQL probe pokrivaju 248 kategorija, 130 sudarajućih alijasa i dubinu 26; Node probe pronalazak 131. kategorije i nastavke stranica.

Postojeći ugovor profila sa najviše 12 usluga / 24 para usluga–način rada nije povećavan. On nije limit ukupnog stabla. Eventualno povećanje treba sprovesti kroz profil, potpisani pregled, bazu i matching zajedno.

## Otkriven i ispravljen problem; preostali deo

Prva proba restauracije muzičke kutije dala je `PARENT_MODE_NOT_SUPPORTED`: model je pokušao da REMOTE uslugu smesti pod roditelja koji podržava samo ON_SITE. Server je to pravilno odbio.

Dopunjena je zajednička instrukcija za oba AI-ja: proveriti režime roditelja, istražiti odgovarajuće druge grane i predložiti smislen novi koren samo ako je to stvarno nova oblast. Ne menjati korisnikovo „izrada kod izvršioca i dostava“ u terenski rad. Ne praviti duplikat sa dodatkom „online“ da bi se zaobišlo pravilo.

Ispravljena je i konkretna kontradikcija u odgovoru zadatka: kada provera odbije REVIEW prelaz, ne ostaje modelova poruka „otvori pregled i objavi“. Činjenice ostaju u nacrtu; korisnik dobija tačan status.

**Automatsko proširenje načina rada postojeće odgovarajuće grane još nije implementirano.** Poslednja proba zato ostaje NEEDS_REVIEW. To ne treba skrivati niti nazvati potpuno rešenom automatskom klasifikacijom.

Sledeći konkretan paket treba da definiše predlog proširenja režima postojeće grane, potpisani pregled i atomsko čuvanje, bez dodeljivanja novih sposobnosti postojećim radnicima. Potrebni su dokazi konkurentnosti, nepromenjenih ID-jeva, eksplicitne potvrde režima i izostanka dispatchinga pre Save/objave/aktivacije. To je promena domenskog ugovora, odvojena od povećanja broja AI poziva.

## Provere i granice zaključka

- **746/746** AI/taxonomy/QA Node provera pre završne dopune instrukcije.
- **56/56** relevantnih provera završne dopune, uključujući obe Edge putanje i očuvanje činjenica pri odbijenom REVIEW.
- TypeScript projekta i zasebnih pomoćnih modula: PASS.
- Puna Jest regresija: **621/621 paketa**, **13.875 prolaznih + 9 preskočenih = 13.884 ukupno**, tri snapshot-a prolaze. Proces je prijavio kasno gašenje, potom završio sa kodom 0. Završna serverska dopuna proverena je odvojeno ciljanim testovima.
- [PostgreSQL 16/17 CI](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39229634304): pretraga, stranice, alijasi, prava, dubina, rollback i ponovna primena.
- Integritet inventure: 171 migracija; 13/13 provera. Istorijski source147 replay dokaz ostaje istorijska granica; novi SQL ima namenski aktuelni dokaz.
- Tačan sadržaj oba objavljena Edge paketa ponovo je pročitan.
- Ovaj paket nije menjao klijent. Novi APK nije pravljen; poslednji prethodno instalirani izvor ostaje `f56c94c3`. Nema nove tvrdnje o telefonu, emulator toku ili stvarnoj isporuci push-a.
- Prethodni signed Save dokazi ostaju zasebno datirani. U ovom krugu nije napravljen novi Save.

## Dalji redosled

1. Završiti kontrolisano proširenje režima postojećih grana i proveriti retki primer do uspešnog potpisanog Save-a.
2. Meriti razgovore sa više različitih usluga, promenama namere i velikim katalogom; optimizovati pre povećavanja rokova.
3. Zatim povezani test dve uloge: čuvanje/objava → UUID veze → matching → stvarno obaveštenje → otvaranje tačnog ekrana.
4. Nastaviti povezane UI/UX talase uz postojeći Premium White canon. Ovaj serverski paket nije dokaz završenog redizajna cele aplikacije.
