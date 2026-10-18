# AI zadatak / radni profil — prvi povezani UX rez (18.10.2026)

Opseg: EAN checkout `feature/unified-qa-master-20261017`, izvorni kod. Ovaj zapis ne potvrđuje novu instalaciju APK-a, Edge primenu ili novi AI poziv. Canonical DEV ostaje `leqcwgzvjsxugfgzdmth` u prethodno potvrđenom stanju. Pre rada su već postojali izmenjen `eas.json` i nevezani `supabase/candidates/register_3d_print_taxonomy.sql`; nisu dirani.

## Zašto

Stvaran DEV AI razgovor za 3D figurice (`dynamic-taxonomy-20261018/EMULATOR_AI_3D_PROBE_20261018.md`) prvo je pitao za lokaciju izvršenja u Novom Sadu, iako se predmet izrađuje kod izvođača i kasnije šalje ili preuzima. Korisnik je morao da ispravi tumačenje; tek tada je nastao REMOTE zadatak. Na UI snimcima početni zadatak troši previše prvog ekrana na tri primera, a radni profil na veliki robot i četiri jednaka segmenta, gde alat i vreme izgledaju obavezno.

## Sada promenjeno u source-u

1. Requester AI instrukcija izričito razlikuje mesto izvršenja od kasnije isporuke/preuzimanja. REMOTE fizički proizvod ne dobija lažan pin rada; izričito pomenut način predaje ide u opis bez privatne adrese. Ako je nejasno gde se stvarno radi, AI pita jedno razjašnjenje.
2. Početak „Novi zadatak“ nudi dva kratka, različita primera: lokalnu selidbu i 3D izradu sa slanjem. Jedan tap samo popunjava unos.
3. Dok se činjenice prikupljaju, kratka linija „Za sada“ pokazuje prepoznatu javnu uslugu i javno mesto/rutu. Potpuna kartica i akcija za pregled ostaju tek kada je nacrt spreman. Privatna adresa se ne čita u toj liniji; slobodna lokacijska oznaka sa ciframa se ne koristi kao fallback za javni sažetak.
4. Završna kartica prikazuje prepoznatu uslugu ljudskim imenom ako je takva vrednost zaista dostupna. Stari veliki tehnički token kategorije nije prikazan kao korisnički naziv. Za `POINT_TO_POINT` i `MULTI_STOP` pokazuje redosled svih javnih stanica, ne samo početnu tačku.
5. U radnom AI razgovoru napredak čine „Usluge“ i „Područje“. Vreme i oprema ostaju dostupni u pregledu, ali više nisu jednaki obavezni koraci. Pri dopuni profila sa već postojećim sadržajem ne ponavlja se velika uvodna ilustracija.
6. Worker AI source instrukcija sada pošteno kaže da V1 terenski dispatch podržava jedan centar i 1–200 km. Izjava „cela Vojvodina“ ili „cela Srbija“ ne sme se predstavljati kao aktivna regionalna pokrivenost niti tiho pretvoriti u krug od 200 km. REMOTE usluge nisu ograničene tim radijusom.

## Odnos prema starom UX nacrtu i odluci vlasnika

UX nacrt od 22.09. zahteva razgovor koji gradi karticu „šta, gde, kada, koliko ljudi, cena“ i jedan pregled pre objave; to je očuvano. Raniji izbor od 09.10. da se cela kartica pojavljuje tek na kraju takođe je očuvan. Nova vlasnikova instrukcija od 18.10. traži da proces bude lakši i da se vidi kako AI razume lokaciju/rutu; zato je dodat samo kratak, neinteraktivan sažetak u toku razgovora. Nema novog formulara niti dodatne potvrde posle svakog odgovora. Oprema nije izbrisana iz podataka ili postojećih profila; uklonjen je samo njen izgled obaveznog koraka.

## Granica ovog reza — regionalni dispatch

Nijedna regionalna granica trenutno nije modelovana u radnom profilu. `WorkerAiProfile.location` i baza imaju grad, jednu približnu tačku i radijus; `private.worker_need_fit_v1` poredi udaljenost ili isti grad. Zato ova izmena **ne uključuje** Vojvodinu/celu Srbiju u matchingu. Za to je potreban zaseban server paket:

- verzionirana baza kanonskih administrativnih oblasti i njihovih granica, proverena za Srbiju, uz izvornu/licencnu evidenciju;
- tipizovana pokrivenost za jedan ili više krugova/oblasti/državu, potvrđena od vlasnika profila; grad profila ostaje odvojen od teritorije rada;
- javna lokacija zadatka razrešena na iste oblasti, uz odbijanje nejasnog razrešenja umesto nagađanja;
- ownership/revision/idempotency provere na upisu i kompatibilno čitanje starih profila sa jednim krugom;
- matcher koji poredi teritoriju po konkretnoj terenskoj usluzi, čuva REMOTE nezavisno, štiti od masovnog push-a za preširoku oblast i ne dodeljuje zadatak bez pouzdane lokacije;
- stvarni dvonaložni DEV test za Novi Sad, Vojvodinu, Srbiju, granice i jedno ovlašćeno push odredište.

Taj paket zahteva novu šemu i primenu na DEV. Ovo je priprema i lokalni source rez; nema razloga da UI tvrdi da je takva pokrivenost već aktivna.

## Provere

- `npx tsc --noEmit --pretty false`: PASS.
- `git diff --check`: PASS.
- Fokusirani UI: 5 paketa / 274 testa PASS.
- Fokusirani AI/source ugovori: 3 paketa / 74 testa PASS.
- Novi pure test proverava prikaz sve tri stanice rute, javnu uslugu i odsustvo privatne adrese iz sažetka.
- Na `emulator-5554` sa aktivnim Metro serverom otvoreni su Početna → Novi zadatak i Profil → Radni profil → Uredi kroz razgovor, bez slanja AI poruke ili upisa. Na ekranu zadatka viđena su tačno dva nova primera; na radnom razgovoru viđene su samo dve trake „Usluge“ i „Područje“ i odsustvo velike povratničke ilustracije. To je ograničen nativni vizuelni dokaz za izvorni kod koji je Metro poslužio, ne dokaz novog instaliranog APK-a ili Edge funkcije.
- Ceo `npm test -- --runInBand --silent` je pokrenut i prekinut posle prvih uspešnih paketa: checkout ima stotine testnih fajlova, a serijsko izvršavanje je nesrazmerno opsegu ovog UI/AI reza. Nema tvrdnje o punom PASS-u; navedene fokusirane provere jesu završene.

## Preostalo do tvrdnje „radi na telefonu“

Izvorni kod mora u novi APK, Edge instrukcije moraju biti zasebno pregledane/primenjene, a zatim treba probati stvaran razgovor sa drugim nalogom. Ovaj rez ne menja postojeći signed taxonomy mehanizam i ne dokazuje novokonstruisanu granu, regionalni dispatch, drugi nalog, push ili fizički telefon. Snimci ovog nativnog pregleda su u task `outputs` direktorijumu kao `USKOCI_AI_TASK_START_SOURCE_20261018.png` i `USKOCI_AI_WORKER_EDIT_SOURCE_20261018.png`.
