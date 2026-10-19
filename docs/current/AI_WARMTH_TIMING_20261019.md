# USKOČI — topliji AI razgovori, pouzdaniji nacrt i stvarno merenje

Datum: 19.10.2026. Izvor: 7d584c2758e69d1d41375d7597be1b215b8e1373 (prvi checkpoint 8064b34b). Grana: feature/unified-qa-master-20261017. DEV: leqcwgzvjsxugfgzdmth.

## Šta je primenjeno

Oba razgovora koriste jedan zajednički glas: srpska latinica, obraćanje sa „ti“, kratak, pažljiv i prijateljski odgovor. Smajli 🙂 ili 👍 je dozvoljen povremeno i prema situaciji. Nema obaveznog „Super!“ na početku svake poruke, prepričavanja cele kartice ili veselih reakcija na ozbiljan problem. AI ne predstavlja sebe kao čoveka i ne obećava sačuvanu promenu pre potvrde korisnika.

Zadatak koristi DEV Edge **112**, radni profil **67**. Posle objave pročitan je sadržaj svih **18 + 16 fajlova** i upoređen sa paketom. Kod je push-ovan na zajedničku granu. Server i dalje poseduje prava, revizije, UUID provere i upise.

## Greške otkrivene i popravljene tokom stvarne probe

1. **Delimično ispravan odgovor za zadatak.** Kada datum zahteva razjašnjenje, nezavisni podaci kao budžet i broj ljudi ostaju u nacrtu. Predloženi pogrešan termin i naslov/opis koji ga mogu ponoviti ne prihvataju se kao tačni. Ovo je potvrđeno determinističkim testom, nije zaseban živi vremenski scenario u ovom paketu.
2. **Radno vreme.** Gemini je prijavljivao nameru izmene, ali povremeno izostavljao kalendarsku operaciju. Server je odbijao takvu izmenu i ponavljao već odgovoreno pitanje. Ugovor odgovora sada traži izričitu odluku o kalendaru: konkretne operacije ili null za nepromenjeno stanje. Null se ne prosleđuje bazi kao brisanje. Zaštita i dalje odbija PATCH bez operacije. Citati tolerišu samo razlike u formatu, ne izmenjene reči, negaciju ili sate.
3. **Oprema.** U prvim probama model je pretpostavio posedovanje 3D štampača i upisao „nema vozila“ kao vozilo. Uputstva i opisi polja sada jasno odvajaju ponuđeni posao od izričito navedene opreme. Završna živa proba nema izmišljene resurse. Ovo je poboljšanje modelskog ponašanja, ne univerzalni dokaz da nikada neće pogrešiti.
4. **Postojeća kategorija.** Model može da upotrebi akciju REUSE_ALIAS uz već preuzet zvanični naziv. Kada naziv i UUID tačno odgovaraju istoj trenutnoj kategoriji, adapter to normalizuje u REUSE_EXISTING. Ne pretpostavlja se novi sinonim. Ostaju provere svežine, jedinstvenosti, režima rada, kolizija i eksplicitnog Save-a. Nepoznat sinonim i pogrešan ID se i dalje odbijaju.
5. **Nema ručnog AI editora.** Uklonjeno je kontradiktorno uputstvo koje je nudilo ručnu ispravku na pregledu. Korekcija ide kroz isti razgovor.

## Stvarna proba

Korišćen je nov izolovan DEV QA nalog. Milošev nalog, razgovori i telefon nisu menjani. Ukupno **14 korisničkih poruka / 25 modelskih poziva** kroz pet datiranih iteracija. Neuspešne iteracije ostaju u dokazu; nisu predstavljene kao prolaz.

| Završni provereni slučaj | Rezultat |
| --- | --- |
| 3D figurica, izrada kod izvršioca i dostava unutar Srbije | Zadatak zadržava REMOTE i predaju predmeta; pregled READY |
| Izmena budžeta na 5.000 RSD za ceo posao | Sačuvana ostala značenja nacrta; pregled READY |
| Radnik: 3D štampa, Novi Sad, Srbija, dostava, pon–pet 15–19 | U završnom paketu već prvi pregled READY; ispravan UUID i kalendar |
| „Samo ponedeljkom 18–20“ | Menja samo ponedeljak; utorak–petak ostaju 15–19, vikend nije dodat |
| Nisu navedeni alati i vozila | Završni pregledi imaju prazne liste resursa |
| Pre eksplicitnog čuvanja | Pet kanonskih otisaka nepromenjeno: katalog, profil, zadaci i oba vezivanja |

Primer stvarnog završnog odgovora: „Pomerio sam ponedeljak na termin od 18 do 20 h, dok za ostale radne dane ostaje od 15 do 19 h. Možeš da baciš pogled na profil i sačuvaš izmene kad god poželiš. 🙂“

Nije izvršena objava zadatka, aktiviranje profila, matching ili push. QA dozvola za plaćene pozive povučena je po završetku probe; evidencija razgovora sačuvana je za proveru. Interni obračun za sve iteracije je **0,189180 USD**, bez neobračunatih poziva. To je procena sistema na osnovu usage podataka, nije potvrda računa dobavljača niti projekcija cene redovnog korisničkog razgovora.

## Brzina — stvaran nalaz

Uvedena su merenja bez sadržaja poruka: provider, katalog, budžetska autorizacija/obračun, završavanje odgovora i beleženje predloga.

| Uzorak | Ukupno do odgovora | Zbir Gemini vremena | Čitanje alatom |
| --- | ---: | ---: | ---: |
| Prvi zadatak, početna iteracija | 12,44 s | 9,90 s | 0,083 s |
| Izmena budžeta, početna iteracija | 5,55 s | 3,97 s | bez dodatnog alata |
| Radni profil, završni paket | 11,08 s | 8,71 s | 0,087 s |
| Izmena ponedeljka, završni paket | 7,64 s | 6,10 s | 0 ms, keširan rezultat |

**Brzina nije završena.** U ovom uzorku vreme uglavnom odlazi na model, uključujući dodatni modelski krug posle alata. Prompt sada dozvoljava korišćenje već dostupnog tačnog unosa bez ponovljene pretrage, ali završna radnička proba i dalje ima dva modelska poziva po poruci. Zato nema dokaza da je samo ovo uputstvo donelo ubrzanje.

Sledeća povezana celina treba da razdvoji brz razgovor od istraživanja usluge: jedna verzija nacrta, pozadinski posao vezan za semantičku promenu usluge, odbacivanje zastarelog rezultata i poslednja sveža provera pre čuvanja. Promena budžeta ne treba ponovo da pokreće istraživanje iste usluge. Ne treba obećavati trenutno spreman pregled ako klasifikacija još traje. Pozadinski posao zahteva pouzdan red poslova i oporavak; samo waitUntil nije takva garancija. Taj deo **nije implementiran ovim paketom**.

## Provere i granice

- Fokusirani početni Node skup: 318 PASS.
- Završni radnički ugovor: 75 PASS.
- Završni katalog/alias/explorer skup: 93 PASS.
- Acceptance harness: 9 PASS. Skupovi se preklapaju; brojevi nisu zbir jedinstvenih testova.
- TypeScript: PASS.
- Puna lokalna Jest regresija: **621/621 paket, 13.959 PASS, 9 SKIP, 0 FAIL**, 3/3 snapshot. Pokrenuta na 8064b34b; native klijent se nije menjao tokom izvršavanja, a završne Edge izmene imaju dodatne navedene Node provere. Trajanje 1.773,902 s. Za ovaj paket nije pokrenut zaseban GitHub APK workflow.
- Nema promena native klijenta, novog APK-a ili nove fizičke provere UI-ja u ovom paketu. Postojeći klijent koristi ažurirane Edge funkcije; prethodni APK/emulator dokazi ostaju datirani u AI_MAP_PACKAGE_20261019.md.
- Novi izgled ekrana, regionalna područja rada, kompletna dva naloga sa objavom i push-om i javno izdanje ostaju otvoreni u istom registru.

## Testovi koji su promenjeni

Nijedan testni fajl nije obrisan. Dodate su provere nezavisnih činjenica, odsustva lažnog uspeha i privatnosti merenja. U alias testu nepoznat sinonim ostaje negativan slučaj; tačan zvanični naziv sa pogrešno nazvanom tehničkom akcijom sada ima zaseban pozitivan test i negativne provere pogrešnog ID-ja, moda, verzije i kolizije.

Tehnička referenca za opis strukturiranih polja: [Google — Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). Referenca ne zamenjuje proveru serverskog značenja.

Detaljni dokaz: evidence/AI_WARMTH_TIMING_20261019.json.
