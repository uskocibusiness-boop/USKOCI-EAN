# Aktuelni presek za Premium White

Naknadni lokalni tehnički paket na polazištu `aa61d04e`: [ograničeni Home pregled, build paritet i SQL kandidati](LOCAL_RELIABILITY_PACKAGE_20261018.md). Nije primenjen na DEV niti ugrađen u ovde opisani APK; istorijski baseline i njegovi device dokazi ispod ostaju odvojeni.

Ovaj presek je primena najnovijeg naloga vlasnika od 18.10.2026: postojeći proizvod postaje proverljivo polazište za redizajn. Ne znači da su svi ekrani već redizajnirani. Status rada ostaje u `docs/control/redovi.json`; ovaj dokument objašnjava odakle nastavljamo.

## Jedna polazna verzija

- Repozitorijum: `USKOCI-EAN`; grana `feature/unified-qa-master-20261017`.
- Polazni commit: `eaa38a04e20be24bba71840660493b634180ee72`; posle `git fetch` nije bilo razlike sa upstream-om.
- Sačuvan je snimak svih 6.465 postojećih tracked i relevantnih untracked fajlova, njihov SHA-256 manifest i početni diff. Lokalni scratch, ignorisani build izlazi i `.env` nisu deo snimka. Prethodni rad nije resetovan niti prepisan.
- Poslednji uspešan APK pre čišćenja: CI `39138831963`, source `0175d364938ba157990ab4af777ed86c28678dad`, x86_64 preview. Na HEAD-u koji je usledio nije bilo novih proizvodnih `src` promena; lokalni foundation paket jeste noviji i ima zasebnu proveru.
- DEV `leqcwgzvjsxugfgzdmth`: pročitano 18.10.2026 u 18:03 UTC, zdrav projekat, 285 migracija, poslednja `20261018144207`. AI zadatak v99, AI radnik v53, push v35. Svih 18 fajlova preuzetih iz ta tri Edge paketa odgovara lokalnom izvoru uz normalizovane završetke redova. Nema novog server upisa u ovom čišćenju.

Mašinski ulaz i vlasnici: [CURRENT_BASELINE_20261018.json](CURRENT_BASELINE_20261018.json). Istorijski APK, novo testiranje, build, emulator i telefon imaju odvojene statuse.

## Šta je aktivno, a šta istorija

| Oblast | Aktivan izvor | Kako se tretira istorija |
| --- | --- | --- |
| Proizvodni tokovi | `src/app`, data/features/contracts i živi DEV | Star naziv `v2` ili datum testa ne znače da je kod mrtav. Aktivne importere prvo prevezati. |
| Izgled i UX | Jedan `PREMIUM_WHITE_CANON.md` | V28, SPOJ, R1–R8 i stari recepti nisu obavezna kompozicija. |
| Boje i materijali | Centralni tokeni i jedan Surface | Kontrolisane varijante prema svrsi; bez nove paralelne palete. |
| Motion | Centralni tokeni + lifecycle/Reduce Motion mehanizam | Native/Reanimated, layout i drugi prelazi mogu se razvijati uz proveru konkretne tehnologije. |
| Galerije | `src/designLab`, van proizvodnih ruta/bundle-a | Primeri za razvoj, ne prisilni raspored proizvodnih ekrana. |
| Backend istorija | Primenjene forward migracije i ledger | Ne brisati istoriju migracija: ona omogućava reprodukciju baze i proveru prava. |
| Lokalni radni tragovi | Ignorisani `/work/` | Dokaz isporuke prenosi se u `docs/`; scratch nije izvor proizvoda. |

## Koji testovi su potrebni

Starost i naziv testa nisu kriterijum za brisanje. Važno je koju grešku sprečava.

| Tip provere | Odluka i razlog |
| --- | --- |
| Autorizacija, RLS, privatni podaci, članstvo, javne projekcije | Ostaviti: sprečavaju stvarno otkrivanje podataka i neovlašćene radnje. |
| Objavi/prijavi/izaberi/otkaži/završi, revizije i nepoznat ishod | Ostaviti: izgled ne sme promeniti poslovni dogovor niti duplirati radnju. |
| AI isti razgovor, delimični odgovor, ispravka, server nacrt, potvrda | Ostaviti i prilagoditi novom ulazu; povući dokaze ručnog editora kada ga novi tok zaista zameni. |
| Back, nacrt, filteri, viewport, tekst poruke, keyboard, veliki font | Čuvati ponašanje, ne tačnu staru poziciju ili komponentu. |
| Kontrast, minimalan dodir, Reduce Motion, background/unmount | Ostaviti kao semantičke i runtime provere; brojevi boje/trajanja mogu da evoluiraju. |
| Tačan stari radius, dekorativna senka, broj SVG čvorova, stari literal boje | Ukloniti ili zameniti proverom odgovarajuće uloge, kontrasta i dostupnosti. |
| Source-text regex koji zabranjuje tehnologiju ili novu kompoziciju | Povlači se estetska zabrana. Stvarni poznati native kvar i njegova zaštita ostaju dok zamena ne dokaže da ga nema. |
| Snapshot velike stranice | Zadržati samo kada otkriva korisnički problem; aktivnu interakciju pokriti direktno, bez čuvanja cele dekoracije. |
| Istorijski tekst i stara galerijska navigacija | Nisu uslov novog UI-ja. Poreklo je sačuvano u Git-u/arhivi. |

**Ritam provera:** tokom jedne povezane celine ciljane provere pogođenog ponašanja i TypeScript; na integracionom preseku puna regresija i APK. Ne ponavljati sve testove posle svake izmene razmaka. CI za APK i dalje izvršava funkcionalnu regresiju i bezbedne build granice. Ne uvodi se slepi `testPathIgnorePatterns` koji bi sakrio sve stare testove.

## Prostor za novi dizajn

Dozvoljeni su nove kartice prema ulozi, tonirane površine, fotografije, originalne 2.5D ilustracije, promena kompozicije, sheet umesto nepotrebnog ekrana, sticky akcije, mapa/lista kao povezana površina i smisleni prelazi. Numeričke vrednosti pripadaju tokenima; ista semantika zadržava isto značenje. Komponenta ne mora zauvek imati isti oblik.

Logo i „Uskoči“ ostaju prepoznatljiva osnova. Uklonjena je zaostala Expo iOS ikona iz konfiguracije i resursa; iOS sada koristi postojeći USKOČI PNG. To nije nova grafika niti potvrđen iOS build. PNG konfiguracija je podržana u [Expo dokumentaciji](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

## Redosled posle preseka

Devet povezanih talasa je u jedinom canonu: sistem/nav → Početna → Zadaci/mapa → AI → prijave/kandidati → Dogovori → čet → profil/reputacija → obaveštenja/podešavanja/polish.

Sledeći vizuelni paket prvo pokaže stvarnu kompoziciju Početne, navigacije i porodicu ikonica. Zatim se isti sistem prenosi na povezane tokove. Mapa se zadržava uz polish. Zadatak i radni profil imaju AI izmene; ljudska potvrda tačke na mapi, fotografije i sistemske dozvole ostaju direktne akcije.

Otvorene funkcionalne celine iz prethodnog audita ostaju otvorene dok ne dobiju dokaz: regionalna pokrivenost kroz matching/prefiltere, svi relevantni route punktovi, AI rok za prijave, grupni chat invalidation/push, potpuna isporuka obaveštenja i dva naloga kroz završetak. Čišćenje dizajna ih ne zatvara samo po sebi.

## Rezultat provera ovog paketa

Paket izvora `2a6e7df82172f13ca37eb7e11d36142ef08fbe9e`: [CI 39155015938](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39155015938) PASS. Jest: **13806 uspešnih, 0 neuspešnih, 0 preskočenih provera**; 623 test fajlova. TypeScript, povezane Node/build provere i Android release build prolaze.

Novi x86_64 preview APK je instaliran preko postojeće sesije; hash `39cb15de1e9083d4627ac355cb0c254099c6051c402747f730ff67b80179df0d`. O aplikaciji potvrđuje izvršeni izvor i embedded update. Build beleži `sourceDirty: true`: sačuvani prebuild diff sadrži samo Expo izmenu dve package.json komande za pokretanje Android/iOS aplikacije. To je poznata generisana promena, ne neidentifikovan aplikacioni kod.

Ciljana native matrica i njene granice su u `evidence/premium-baseline-20261018/final-verification.json`. Provereni su Početna na 361/390/412 dp, normalan/uvećan tekst, radni profil, otvaranje postojećeg AI razgovora i Back, smanjeno kretanje i offline greška profila. Podešavanja emulatora su vraćena. Emulator je pri hladnom podizanju imao Android System UI zastoj, pa su za dokaz korišćeni tek oporavljeni prikazi. Telefon, iOS i produkciona objava nisu provereni ovim paketom.

Ovo zatvara polazni cleanup paket. Novi komplet ikonica i kompletan redizajn ekrana ostaju sledeći rad. `NeedLocationForm` još ima širi ručni opseg za zadatak; njegovo sužavanje na potvrdu tačaka pripada povezanom AI/location toku. Radni profil nema obični aktivni ručni editor; sačuvani nacrti i njihova zaštita od gubitka ostaju.

Sledeći UI paket preuzima dva konkretna nalaza sa uređaja: objasniti nastavak starijeg nesačuvanog nacrta koji se razlikuje od aktivnog profila; red dostupnosti složiti ranije u dve linije jer na oko 361 dp i fontu 1,15 prelama reč „Dostupnost“. To su otvoreni polish nalazi, ne razlog za vraćanje uklonjenih estetskih zabrana.
