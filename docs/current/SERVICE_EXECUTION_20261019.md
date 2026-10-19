# Način rada konkretne usluge i predaja rezultata — 19.10.2026.

## Namena ovog paketa

Vlasnik je odobrio jednostavnije povezivanje usluge i stvarnog načina rada. Ostaju postojeći UUID-jevi i dva režima. Ovo nije novi tok, treći režim ili paralelni ručni editor.

- **ON_SITE**: izvršilac mora da dođe na mesto rada ili obavi traženu rutu. Stvarno krečenje stana nije remote savetovanje.
- **REMOTE**: posao se obavlja bez dolaska izvršioca kod naručioca — digitalno ili kod izvršioca. Slanje kurirskom službom / preuzimanje predmeta nije samo po sebi rad kod naručioca.
- Organizacijski roditelj može imati drugačije sopstvene režime od konkretne podusluge. Ciklusi, nepostojeći/retired roditelji i identitet usluge ostaju provereni.
- Ako ista konkretna usluga već postoji, ali nema opravdani režim, `EXTEND_MODE` predlaže proširenje istog UUID-a. Nema duplikata kategorije ili automatskog proširenja sposobnosti svih radnika.

## Jedan podatak o predaji

Za REMOTE postoji opcioni strukturirani `handoff`: bez fizičke predaje, slanje u potvrđene države, lično preuzimanje u potvrđenom gradu, ili obe izričito podržane alternative. Ne sadrži ulicu, kućni broj, telefon ili pin. Grad profila nije dokaz da se tu može preuzeti predmet.

Novi završni pregled REMOTE zadatka zahteva ovaj podatak. Za očigledno digitalni rezultat AI upisuje „Bez fizičke predaje“, bez dodatnog besmislenog pitanja. Ako fizička predaja nije razjašnjena, pregled ostaje nepotpun. Na radnom profilu je podatak vezan za konkretnu uslugu.

Matching fizičke predaje zahteva zajedničku državu slanja ili isti potvrđeni grad i državu preuzimanja. Gradovi se porede postojećom normalizacijom srpskog pisma; ovo nije novi geografski katalog ili poligonska provera oblasti. Podatak se prikazuje u postojećem pregledu i bitnim uslovima zadatka.

## Granice autoriteta

Razgovor i priprema pregleda čuvaju nacrt i predlog. Ne upisuju kanonsku kategoriju, sposobnost, aktivaciju, objavu ili push. Potpisani pregled, eksplicitno čuvanje, proverena aktuelna revizija i postojeći admission/binding tok ostaju granice. Predaja zadatka je isti tipizirani podatak u pregledu, čuvanju i matching-u. Promena predaje ulazi u materijalni fingerprint.

Pri nepovezanoj izmeni radnog profila sačuvana predaja se čuva. Promena usluge, režima ili predaje zahteva odgovarajući korisnički iskaz i novi pregled. Postojeći radnici ne dobijaju novu sposobnost samo zato što se kategoriji doda režim.

## Šta ovaj paket ne dokazuje

- Fizičku izvodljivost proizvoljnog posla procenjuje AI. SQL proverava identitet, rizik, stanje i potpisani tok; ne postoji deterministički dokaz razumevanja svakog mogućeg opisa.
- Stari zadaci bez strukturirane predaje ostaju sa istorijskom politikom kompatibilnosti. Nedostajući podatak nije prepisan u tvrdnju o slanju svuda. Novi/promenjeni REMOTE zadaci zahtevaju predaju pre prihvatanja pregleda.
- Sačuvani javni radni profil još nema zaseban prikaz predaje po usluzi; novi potpisani pregled je prikazuje. Čitanje tog sažetka na profilu je naredna UI dorada.
- Predaja ne uvodi potvrdu dostave, praćenje kurira, plaćanje, geokodiranje grada ili novu notifikacionu vrstu.
- SQL fixture sa sintetičkim graničnim servisima nije dokaz celog živog toka. Živi razgovor, Save, matching, build i emulator imaju odvojene rezultate.

## Dokazi i primena

Status pri pripremi: SOURCE IMPLEMENTED; ciljane provere prolaze; PostgreSQL CI, DEV primena, živi primeri i novi APK se vode odvojeno i biće dopisani nakon stvarnog rezultata.

Izvori: migracije `20261019104047` i `20261019104604`; dokaz `supabase/proofs/dynamic_taxonomy/parent-mode-admission/` i `service-handoff/`; stvarni AI handler testovi i zajednički `serviceHandoff` ugovor. Postojeći master plan i registar tokova ostaju autoritet napretka proizvoda.
