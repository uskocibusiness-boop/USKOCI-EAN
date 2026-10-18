# Od razgovora do pravog zadatka — izvršni nacrt (18.10.2026)

Ovo je specifikacija sledećeg povezanog paketa unutar postojeće aplikacije, ne novi master plan niti dokaz da je paket primenjen. Izvor: trenutni EAN kod i read-only DEV šema projekta `leqcwgzvjsxugfgzdmth`. Poslednje dve AI instrukcije jesu objavljene kao `uskoci-ai-interview` v89 i `uskoci-worker-interview` v44; ovde opisani regionalni ugovor i promene matchera nisu objavljeni.

## Ovaj izvorni korak

U `WorkerAiPresentation.tsx` pregled potpisanog REMOTE-only profila sada prikazuje grad kao **grad profila**, bez lokalnog radijusa ili mape kao lažnog ograničenja online rada. Mešoviti/terenski profil i dalje vidi postojeći krug. Nova kategorija je označena kao *predlog za katalog*, a tekst o obaveštenjima kaže da ona zavise od uključenih obaveštenja i stvarnog poklapanja. Izbor načina rada opisuje njegov uticaj na zadatke običnim jezikom; stanje koje čeka potvrdu upućuje na kontrolu na istom pregledu. Provera: ciljani Jest 19/19, TypeScript i `git diff --check` prolaze. Ovo je izvorni kod, bez novog APK ili native prihvatanja.

## Šta je danas stvarno povezano

1. Radni razgovor pravi predlog usluga, grada, zemlje, jednog radijusa, vremena i opcionih resursa. AI ne aktivira profil direktno. Vlasnik proverava i čuva potpisani pregled.
2. Potpisani pregled zasebno potvrđuje za svaku uslugu `ON_SITE`, `REMOTE` ili oba načina. Kategorija/alias prolaze taksonomsku klasifikaciju; nepotvrđena usluga ne dobija lažnu matching sposobnost. `private.taxonomy_confirmed_worker_modes_v1` sadrži aktivan potvrđeni način po kategoriji.
3. `private.worker_need_fit_v1` je zajedničko pravilo za otkrivanje i dispatch. Kombinuje vrstu rada, mesto, vreme i tvrde izuzetke. Oprema/vozilo nisu uslov. Push je posledica primljenog događaja i uključenih obaveštenja, ne samog AI odgovora.
4. `public.app_profiles` ima `city`, `operating_country_code` i `radius_km`; `public.worker_match_preferences` ima približnu tačku. Nema strukturisane regionalne/višecentarske pokrivenosti. `public.need_geography` čuva javnu topologiju zadatka. REMOTE za stvarnu izradu kod izvođača ne sme dobiti lažni pin grada isporuke.
5. Zbog tačke 4 AI sada pošteno ograničava terenski rad na jedan centar i 1–200 km. Izjava „cela Vojvodina” sme ostati kao korisnikova namera, ali sama ne može uključiti matching za celu regiju.

## Traženo ponašanje razgovora

- Prva poruka: „Čime se baviš i koje zadatke želiš da preuzimaš?” Bez upitnika od deset polja.
- AI iz jedne rečenice izdvoji **samo ponuđene usluge**. Zanimanje, poznavanje jezika, posedovanje kombija ili alata nisu automatska ponuda usluge. Jasno odbijenu aktivnost ne dodaje.
- Jedno pitanje samo ako je bitno za rutiranje: za dvosmislenu uslugu pita da li je radi kod naručioca, na daljinu ili oba. Za terensku uslugu pita gde stvarno prihvata zadatke. Za remote-only profil traži grad samo kao podatak profila ako je obavezan za aktivaciju i kaže da ne ograničava online zadatke.
- „Živim u Novom Sadu, radim po celoj Srbiji” znači profilni grad Novi Sad i **posebnu, još nepotvrđenu** radnu teritoriju Srbija. „Radim u Beogradu i Novom Sadu” znači dve teritorije, ne krug od 200 km oko proizvoljnog centra. „Izrađujem 3D figurice kod sebe i šaljem u Novi Sad” znači REMOTE posao; Novi Sad je mesto predaje, ne mesto izvršenja.
- Vreme se pita samo ako menja rutiranje. Alat/vozilo se pita samo kada je stvarno važno za opis rada, nikada kao opšti uslov prijema zadatka. Ne obećavati da se obaveštenje šalje samo zato što je pomenut alat.
- Svaka poruka menja samo ono što je korisnik rekao. Kod „to je to” sledi jedan pregled bez novih opcionih pitanja. Pregled pokazuje uslugu, način rada, profilni grad, aktivnu radnu teritoriju i status povezivanja; korisnik potvrđuje jedanput pre čuvanja.

## Predlog server ugovora za regionalni rad

Uvesti verzionirane podatke koji su odvojeni od slobodnog biografskog teksta:

| Polje | Značenje | Pravilo |
| --- | --- | --- |
| `home_city`, `home_country` | Profilni grad/država | Ne ograničavaju REMOTE posao. Postojeći grad može služiti kao početni podatak pri migraciji, ali bez zaključka da je to cela teritorija rada. |
| `worker_service_scope` | Potvrđena usluga/kategorija i `ON_SITE`/`REMOTE` | Dolazi iz potpisanog pregleda; pristanak se ne izvodi iz naziva veštine, bio teksta ili AI nagađanja. |
| `worker_coverage_area` | Jedan ili više potvrđenih `LOCAL_CIRCLE`, `ADMIN_REGION`, `COUNTRY` izbora | Vezati za profil i, gde je različito, za konkretnu terensku uslugu. Svaka izmena ima owner, reviziju i idempotency ključ. |
| `area_catalog` | Kanonski ID i geometrija/članstvo oblasti | Izvor, licenca, verzija, država i granice moraju biti provereni. Ime grada/regije nije ključ. |
| `need_execution_area` | Javna lokacija stvarnog izvršenja | Za terenski zadatak razrešiti u isto izdanje kataloga; ruta proverava relevantne tačke/segment. REMOTE nema ovu teritorijalnu proveru. |

Ne treba nekontrolisani krug od 200 km za „Vojvodinu”; krug je samo jedna od eksplicitnih opcija. Dopuštene su dve odvojene lokalne oblasti ili administrativna oblast, ali se njihov identitet i granice proveravaju. Naručiočeva privatna adresa ostaje izvan javne geografije i izvan AI sažetka. Ako geokodiranje/regija nisu pouzdani, profil/zadatak ostaje u stanju **potrebna potvrda mesta**, bez tihog širokog matcha.

## Matching i obaveštenja

Za svaki par zadatak–radnik server radi, tim redom: (1) aktivan profil, različit nalog i dozvoljen svet; (2) potvrđena ponuđena usluga i kompatibilan način izvršenja; (3) za `ON_SITE` javno izvršno mesto unutar bar jedne *potvrđene* teritorije za tu uslugu, za `REMOTE` preskočiti radijus; (4) vreme i postojeće čvrste zabrane; (5) tek zatim dispatch događaj. Jedan zajednički rezultat koristi se za „Za mene”, ručnu prijavu i proaktivnu dostavu, a objašnjenje na ekranu treba da odgovara istom rezultatu. Push dodatno zahteva korisnikov izbor obaveštenja, valjan uređaj i uspešan transport; `matches=true` samo po sebi nije potvrda isporuke.

Široka teritorija ne sme napraviti nekontrolisanu masu push poruka: poštovati postojeći per-task ceiling, deduplikaciju, vremenski budžet i idempotency. Promena usluge/teritorije ponovo razmatra otvorene zadatke bez duplog događaja za isti zadatak/reviziju/radnika. Nema zasebnog radničkog naloga: sve pripada jednom account ID-u koji može i da objavi zadatak.

## Ekrani u tačnom redosledu

1. **Radni razgovor:** kratka AI poruka i jedan input; iznad kompozera diskretan sažetak „Razumem: 3D izrada · na daljinu”, „Još treba: potvrda načina rada” samo kad je zaista potrebno. Bez velikog robota pri povratku. Ne crtati region kao aktivan dok nije potvrđen.
2. **Jedan pregled profila:** gore usluge sa po jednom oznakom „Na lokaciji / Na daljinu”; ispod „Gde primaš terenske zadatke” samo za usluge na lokaciji; profilni grad zasebno. Vreme i oprema su niže kao opcioni detalji. Katalog se opisuje običnim rečima („Predlog za katalog”), bez tehničkog ID-a ili lažnog obećanja da je predlog već prihvaćen.
3. **Sačuvan profil:** pokaži stvarno aktivne usluge i teritorije, status „Čeka potvrdu kategorije” ako je potrebno i jasan put „Ispravi kroz razgovor”. Remote-only profil ne prikazuje lokalni radijus kao ograničenje online rada.
4. **„Za mene” i detalj zadatka:** kratko „Zašto ti se prikazuje” (vrsta rada, način, područje, vreme) iz *serverovog* matching rezultata. Ako usluga čeka klasifikaciju, ne glumiti da je zadatak već pronađen.
5. **Obaveštenja:** oprezna rečenica „Kada su uključena i pojavi se odgovarajući zadatak, možemo da te obavestimo”; stanje dostave i otvaranje vodi na pravi zadatak. Ne obećavati trenutni push bez uređaja i uspešnog transporta.

## Preduslovi i dokaz pre DEV primene

Pripremiti jedan izolovani SQL kandidat sa tačnim preflight pinovima, revertom i disposable DB dokazom. Uporediti postojeći `worker_need_fit_v1`, dispatch, RLS/RPC, taksonomske bindere, route geokodiranje i closure digest. Dokazni korpus mora pokriti: jedan grad; dva grada; Vojvodinu; Srbiju; granicu oblasti; remote 3D izradu sa lokalnom dostavom; isti servis u dva načina; odbijenu uslugu; nepotvrđenu kategoriju; nejasnu javnu lokaciju; profil koji objavljuje sopstveni zadatak; promenu područja bez duplog dispatch-a. U DEV-u prvo readback šeme i funkcija, pa dva stvarna naloga i najviše jedan ovlašćeni push uređaj/događaj. Nijedan prolaz izvornog testa nije dokaz primljenog push-a ili ispravnog odgovora Gemini-ja.

Za novu migraciju, Edge primenu i push probu potrebna je zasebna vlasnikova odluka po `AGENTS.md` §3.1; ovo nije nalog za njihovu automatsku primenu. Novi APK i njegova vizuelna provera su zaseban korak.
