# USKOČI — jedinstveni plan dovršavanja proizvoda i objavljivanja
<!-- EXECUTION-UPDATE-BEGIN: provenance-20261028 -->

> **Radna verzija istog plana — 28.10.2026.** Ovaj fajl je jedini operativni ulaz za nastavak u repozitorijumu. Aktuelni rezultat i sledeći korak su u [odeljku 11.2a](#112a-aktuelni-izvršni-status--28102026). Tekst REV10 u nastavku ostaje sačuvana osnova; njegove izjave o neizvršenoj implementaciji opisuju isporuku dokumentacije od 27.10.2026, a ne poništavaju kasnije izvršne zapise.
> **Potvrđene poslovne odluke 28.10.2026:** Z10/D06 je satnica po osobi; Z10/D08 je povezivanje prema mestu početka posla. Izvršni zapisi uz §9.1–9.2 zamenjuju ranije oznake da su ove dve odluke otvorene. R07b ima source/izolovane provere prema dnevniku; rollout i širi acceptance nisu završeni. R05 se nastavlja prema planu.
>
> Izvor: [neizmenjeni CODEX_PLAN_RADA.md iz REV10](../../../review-inputs/USKOCI_KOMPLETAN_PLAN_I_DOKAZI_REV10_2026-10-27/CODEX_PLAN_RADA.md), SHA-256 `8d74ed652900937b6fa865d1df08246a7769d5a09a4092e571b187f966fb813b`. Originalni ZIP i raspakovani izvor nisu menjani. REV14 određuje ciljnu UX arhitekturu; ovaj dokument i dalje vodi R01–R12.
>
> **Putanje dokaza iz sačuvanog REV10 teksta:** relativne veze `dokazi/...`, PDF-ovi i prateći izveštaji imaju koren u [originalnom paketu](../../../review-inputs/USKOCI_KOMPLETAN_PLAN_I_DOKAZI_REV10_2026-10-27/) i koriste se iz njegovog neizmenjenog plana. Originalni ZIP-ovi i izvršni dokazi sada su u `docs/continuation/payload/`; obnavljaju se u navedeni raspored pomoću [uputstva za nastavak](../continuation/NASTAVAK_RADA.md). Sam ovaj fajl nije zamena za ceo dokazni ZIP. Novi linkovi u izvršnom dnevniku pokazuju konkretne repo ili lokalne artefakte. Originalni PDF je istorijski prikaz REV10, ne osvežen prikaz ovog dnevnika.
> **Prenos 28.10.2026:** [uputstvo i detaljna komanda](../continuation/NASTAVAK_RADA.md), [manifest](../continuation/MANIFEST.json) i originalni ZIP-ovi dostupni su uz ovu granu. `restore.py --restore ..` obnavlja relativne izvore i dokaze bez starog računara. Stare apsolutne managed-artifact putanje mapiraju se na `../managed-artifacts/`. GitHub prikaz ne raspakuje istorijske relativne linkove automatski.

<!-- EXECUTION-UPDATE-END: provenance-20261028 -->

**Datoteka za nastavak rada:** `CODEX_PLAN_RADA.md`  
**Revizija dokumentacije:** 10 — objedinjeni plan i puni dokazni paket, 27.10.2026.  
**Status ove isporuke:** usaglašeni plan, izveštaj, tehnička referenca i dokazni izvori; aplikacija, baza, testovi, build i deployment nisu menjani ili ponovo izvršeni ovom revizijom.

Ovo je **jedan važeći operativni plan**. Preuzima pregledniju organizaciju priloženog plana i sve preciznije završne uslove našeg poslednjeg paketa revizije 9. Nalazi, korisnički tokovi, AI, UI/UX, konkretni vlasnici i testovi, čišćenje, svih 14 serverskih grupa, priprema izdanja i podrška povezani su u istom dokumentu. Stare ulazne verzije sačuvane su isključivo kao dokaz porekla u `dokazi/objedinjavanje_rev10/ulazi/`; njihove instrukcije ne predstavljaju konkurentni važeći plan.

`CODEX_PLAN_RADA.pdf` je čitljiv prikaz celog ovog plana. `USKOCI_IZVESTAJ.md` i njegov PDF objašnjavaju stanje jednostavnijim jezikom; `TEHNICKI_DOKAZI.md` objašnjava pojedinačne izvore i granice zaključaka. Folder `dokazi/` sadrži potrebne registre, definicije, probe, rezultate i originalne slike. Za rad se predaje **ceo ZIP**. Odeljak 12 određuje koji dokaz treba otvoriti za koji zadatak; ne zahteva se ponovno čitanje svih priloga pre svake male izmene.

**Konačan cilj:** sve postojeće aktivne funkcije i potvrđena obećanja USKOČI povezani su u razumljiv, vizuelno dosledan i tehnički pouzdan proizvod. Tokovi su logički određeni, potrebna stanja stvarno nacrtana, radnje povezane sa merodavnim kodom i podacima, provere izvršene nad poznatim izdanjem, a dokumentacija i operativa dovoljne za slanje u prodavnice i podršku posle objave. Plan je put do tog rezultata, a ne potvrda da je on već postignut.

## Sadržaj

| Odeljak | Namena |
|---|---|
| [1. Polazište i važenje](#1-polazište-važenje-i-stvarni-nivo-dokaza) | Šta je stvarno provereno, šta je preneti dokaz i koji izvor se nastavlja. |
| [2. Važeća pravila proizvoda](#2-važeća-pravila-proizvoda) | Korisnikova namera i zaštite koje svaka izmena mora sačuvati. |
| [3. Proizvod, tokovi, ekrani i UI/UX](#3-proizvod-korisnički-tokovi-ekrani-i-završni-uiux) | J01–J14, inventar ekrana, ponašanja, vizuelna razrada i snimci sa telefona. |
| [4. Nalazi i redosled rada](#4-svih-42-nalaza-i-redosled-rada) | Svih 42 F/SB/X nalaza, njihov R vlasnik, zavisnosti i sledeći korak. |
| [5. Vlasništvo nad stanjem](#5-vlasništvo-nad-stanjem-i-očuvani-ugovori) | Postojeći autoriteti za razgovor, review, Save, mapu, sesiju i život podataka. |
| [6. Izvršni zadaci R01–R12](#6-izvršni-zadaci-r01r12) | Konkretne promene, pune poznate putanje, postojeće provere i uslovi završetka. |
| [7. Čišćenje i server](#7-čišćenje-aktivnog-izvora-i-servera) | C01–C19, očuvani potrošači, konkretne putanje i uslovi povlačenja. |
| [8. Prihvatanje, testovi i merenja](#8-prihvatanje-testovi-i-merenja) | A01–A25, provereni CI ulazi, bootstrap/upgrade i granice stvarnog dokaza. |
| [9. Otvorene odluke](#9-otvorene-odluke-i-šta-može-napredovati-odmah) | Uske poslovne i vizuelne odluke koje se rešavaju na konkretnom predlogu. |
| [10. Produkcija, prodavnice i podrška](#10-produkcija-dokaz-izdanja-prodavnice-i-podrška) | Jedno poznato izdanje, obaveze platformi, sadržaj prijave i rad posle objave. |
| [11. Kontinuitet i izvršni zadatak](#11-kontinuitet-ažurira-se-ovaj-isti-plan) | Kako se ažurira ovaj isti plan i kako sledeća sesija nastavlja bez novog paralelnog plana. |
| [12. Izvori i način korišćenja](#12-izvori-način-korišćenja-i-obuhvat-objedinjavanja) | Potpuni prilozi u ZIP-u, mapa zadataka i dokaza, poreklo i preostale granice. |

## 1. Polazište, važenje i stvarni nivo dokaza

### 1.1. Šta ova revizija menja

Revizija 10 objedinjuje dva različita dokumenta koji su oba nosila oznaku revizije 9. Priloženi plan dao je pregledniju organizaciju, pune zadatke i čišćenje na jednom mestu. Naš poslednji paket dao je preciznije ugovore potvrde i objave, konkretne build/native/iOS poslove i sve dostupne izvorne dokaze. Oznake F01–F21, SB01–SB15, X01–X06, R01–R12, R11a–h, R12a–j, J01–J14, A01–A25, C01–C19 i SV01–SV14 ostaju stabilne.

UI/UX i celovit opis proizvoda sastavni su deo ovog plana. Dvadeset oblasti služi kontroli budućeg popisa stvarnih ruta i stanja; to nije tvrdnja da je popis ili dizajn već završen. Obrazac svake radnje ima 16 polja. Stvarni prikazi i uređajski dokaz nastaju u odgovarajućim izvršnim koracima; tri ranije slike ne dokazuju sve ekrane.

Važeći korisnički zahtev ovlašćuje ovo objedinjavanje i isporuku jednog kompletnog ZIP-a. Ne beleži neizvršenu implementaciju kao završenu. Kada korisnik zada nastavak implementacije, izvršava se taj odobreni opseg autonomno kroz postojeće zadatke; ne traži se novo odobrenje za svako čitanje, rutinsku tehničku odluku ili lokalnu proveru. Produkciona objava i promene korisničkog obećanja imaju konkretne izlaze i odgovarajuće granice ovlašćenja.

### 1.2. Potvrđeno u ovom objedinjavanju i preneto iz analize

| Predmet | Poznato stanje | Granica |
|---|---|---|
| Repozitorijum analize | `uskocibusiness-boop/USKOCI-EAN`; grana `feature/uskoci-cisto`. | Stari repo/backend iz memorije nije polazište za rad. |
| Analizirani izvor | `a9692e11942609bab9406215c3e407d79589dafa`; lokalni audit checkout ima isti HEAD i čisto radno stablo. | U reviziji 10 nije ponovljena udaljena GitHub provera. Pred implementaciju osvežiti granu, konkurentne izmene i relevantnu deltu. |
| Raniji pregledi repo ulaza | Celoviti kumulativni registar izvora i ciljani release pregled iz revizije 9. | Ponovo upakovani dokaz ili isti SHA nije novo čitanje cele aplikacije. |
| Referentni DEV | `leqcwgzvjsxugfgzdmth`. | Nema novog live audita ili poslovnog SQL upisa u reviziji 10. |
| Telefonski prikaz | `fcef803e719ba5663f6cfd8fbd5a601e08a3479b`, verzija 1.0.0, runtime `uskoci-v1-preview-r1`, kanal `preview`, OTA prefiks `01a163c4`. | Raniji About screenshot; puni native/OTA sadržaj i sve efektivne zastavice nisu očitani. |
| Razlika telefona i analiziranog izvora | Ranija analiza beleži 69 commit-a. | Broj commit-a nije broj popravki niti potvrda instalirane novije verzije. |
| Server iz revizije 7 | 680 public/private funkcija i dve dodatne RLS definicije, 169 table granica, devet sekvenci, 15 Edge paketa. | To je poslednji puni živi serverski presek; vreme i obim svakog izvora ostaju sačuvani. |
| Edge iz revizije 7 | NEED 151, WORKER 104 i post-save 5 sa poznatim razlikama od a969; push v37 byte-equal. | Ne koristiti istorijsku verziju kao neograničeno važeći opis današnjeg deployment-a. |
| Istorijski CI | Run `40452826819`, a969, SUCCESS prema sačuvanim dokazima. | Nije novi CI run revizije 10, niti native/server/model potvrda. |
| Izvoz i zatvaranje | Poslednji pregledani retention/source/export/erasure binding uslovi ostaju nezadovoljeni. | Ne menjati očekivani digest ili certifikat radi zaobilaženja blokade. |
| Produkcija i iOS | Konkretni source problemi i R12a–j sada su uključeni u §6, R12/§10. | Nova baza sama ne uklanja production zabranu, preview-only hook ili Android-only AI capture. |
| Ulazni paket | Svih 130 sadržajnih fajlova poslednjeg rev9 paketa provereno je prema njegovom manifestu pre objedinjavanja. | Ranijih 120 dokaznih priloga nije nedostajalo ovom radu; ograničenje se odnosilo na drugi čet. |
| Serverski registar | Svih 14 punih SV zapisa i 3.037 inventarskih zapisa nalazi se u ZIP-u. | Nijedno destruktivno povlačenje nije automatski odobreno ili spremno samo zato što postoji u manifestu. |

Tri originalne slike su u `dokazi/slike/`, a izveštaj ih prikazuje u kontekstu. Nema potrebe tražiti iste slike ponovo. Novi screenshot ili video potreban je kada pokazuje nedostajuće stanje ili novi kandidat. Paket ne sadrži ceo aplikacioni checkout ili sve zavisnosti; izvor za implementaciju preuzima se iz potvrđenog repozitorijuma.

Lokalna audit kopija nalazi se u `/workspace/scratch/f356024cf009/audit/deep-review/source`; ta putanja nije prenosivo obećanje da će postojati na drugom računaru. Originalni `USKOCI_ULTRA_MASTER_PLAN_2026-10-26` iz Downloads nije bio dostupan i nije proglašen pročitanim. Tri governance putanje pomenute u projektnom postupku nisu pronađene na analiziranoj grani; ne pripisivati im nepročitana pravila. Pred implementaciju pročitati stvarno dostupna aktuelna repo uputstva.

### 1.3. Kako se koristi dokaz

| Nivo | Šta zaista potvrđuje | Šta ostaje posebno |
|---|---|---|
| Pročitan izvor | Konkretan uslov, caller, decoder ili SQL telo. | Da je ta verzija izvršena na telefonu ili serveru. |
| Izolovana proba | Pravi modul/handler/SQL uz kontrolisan I/O. | Pravi model, cela baza, native renderer i završni poslovni tok. |
| Živa definicija/metapodaci | Objavljen sadržaj, verzija ili agregat u vreme čitanja. | Poslovno izvršenje RPC-a i korisnički rezultat. |
| Živi log | Zabeležen serverski događaj ili ishod. | Veza sa konkretnim telefonom bez request/trace identiteta. |
| Snimak uređaja | Ono što je stvarno vidljivo u tom stanju. | Svi prethodni koraci, pozadinski upis i druga platforma. |
| Preneti dokaz sa istim hash-em | Ranija proba i nepromenjen konkretan sadržaj. | Novo izvršavanje ili potvrda sadašnjeg deployment-a. |
| Celovit uređajski tok | Stvaran korisnički rezultat za imenovani kandidat i server. | Univerzalna garancija za svaki uređaj, mrežu i buduću izmenu. |

U narednim odeljcima „postojeće”, „aktuelno telo” i linijski brojevi označavaju izričito evidentirani presek, uglavnom a969/rev7 i ciljane rev9 release izvore. Pre izmene osvežiti relevantni deo. Zeleni karakterizacioni test može dokazivati reprodukciju postojećeg kvara; tek promenjeni uslov prihvatanja i pravi rezultat dokazuju popravku. Ova revizija dokazuje konsolidaciju dokumenata i očuvanje priloga, a ne nov runtime PASS.

## 2. Važeća pravila proizvoda

Ova pravila proizlaze iz dostavljenog aktuelnog paketa i pročitanog STATUS-a. Novija izričita odluka korisnika ima prednost. Naziv starog testa, izdvojeni prototip ili istorijska memorija ne menjaju kanon.

1. **Dve uloge u jednom proizvodu.** Naručilac i izvršilac imaju odvojene zadatke, prikaze i ovlašćenja. Promena uloge ili naloga ne prenosi nedozvoljene podatke i komande.
2. **Prirodan razgovor.** Sve jasne činjenice ulaze u predlog. Sledeći odgovor traži najviše jednu stvarno potrebnu informaciju. Prazan ulaz ne pokreće model ili poslovni upis.
3. **Klasifikacija je unutrašnji posao.** Čovek potvrđuje svoju potrebu ili ponudu; ne bira tehničku kategoriju da bi popravio interni kvar. Jasna usluga dobija bezbedan tehnički nastavak kada prvi pokušaj nije završen.
4. **Stabilan identitet.** Postojeća usluga zadržava pravi ID. Semantički sinonim nije automatski nova kategorija. Za opravdanu novu granu baza validira i stvara zapis, pa vraća stvarni ID; model ne izmišlja trajni UUID.
5. **Tačan način rada.** ON_SITE znači dolazak na mesto naručioca/zadatka. REMOTE može biti digitalni rad, radionica/rad kod izvršioca i odgovarajuća predaja. Ne izmišljati radni pin, domet ili dolazak za REMOTE. Administrativni grad profila je odvojeno pitanje.
6. **Potpun BOTH.** Oba očekivana načina iste usluge čuvaju isti identitet, smisao i korisničku saglasnost. Uspeh jednog dela nije dokaz celog očekivanog skupa.
7. **Jedan razumljiv završni pregled.** U aktivnom razgovoru nema parcijalnih kartica. Ne uvoditi dodatne obavezne formulare za mode, biografiju, opremu, tim, vozilo ili licence. Stvarno potrebna činjenica prikuplja se u odgovarajućem postojećem toku.
8. **Različita poslovna stanja.** Predlog, review, privatni nacrt, Save, aktivacija, objava, admission/binding i matching READY imaju različito značenje. UI prikazuje stvarno postignuti rezultat.
9. **Pending nije opšta zabrana.** Pending klasifikacija sama ne zabranjuje svaki Save/objavu. Stvarni uži uslovi, uključujući posebne REMOTE handoff granice, ostaju.
10. **Čuvanje i aktivacija.** DRAFT na istom ekranu pregleda bira Save ili Save+activate, uz izbor aktivacije vezan za potpisani review. Promena tog izbora zahteva odgovarajući novi pregled; čuvanje i tražena aktivacija su jedna atomska radnja prema §3.6.2. `activate=false` pri čuvanju ACTIVE profila nije deaktivacija.
11. **Samo poruke za sada.** Dogovor koristi poruke. PHONE saglasnost/reveal treba zatvoriti kroz server i podržane stare klijente. EXACT_LOCATION ostaje zasebno autorizovan. Phone OTP prijava i slobodan tekst poruke nisu ta ista funkcija.
12. **Nema prećutnih novih pravila.** Ne uvoditi zabranu broja telefona u slobodnoj poruci, nove valute, pretplate, naknade, HITNO ili obavezna polja kao usputno čišćenje.
13. **Čuvaju se dokazane zaštite.** Account/focus/revision ograde, journal pre dispatch-a, stabilan request identitet, signed review/digest, eksplicitna potvrda, idempotentni upis i autoritativni readback ostaju kod svojih postojećih vlasnika.
14. **Govori se stvarni ishod.** „Poslato”, „sačuvano”, „objavljeno”, „izabrano”, „izvezeno” ili „obrisano” prikazuje se tek na odgovarajućoj potvrdi. UNKNOWN se proverava kao ista radnja; ne skriva se novim slanjem ili lažnim uspehom.
15. **Jedan dosledan jezik.** AI instrukcija već propisuje persiranje. Determinističke poruke razgovora uskladiti s njom; ostali konačni tekstovi i nazivi razrađuju se kao povezana celina, bez mešanja tehničkih detalja u korisnički tok.

### Obim završetka

Obavezne su sve postojeće aktivne funkcije i potvrđena obećanja, privatnost i konkretni zahtevi ciljne prodavnice. Uslovne obaveze važe kada izdanje sadrži određenu platformu, dozvolu, SDK, prijavu ili način naplate. Dodatna optimizacija ili nova neobećana funkcija može ostati kasniji posao, ali se potvrđen kvar aktivne funkcije ne skriva smanjivanjem obima.

Za svaki obavezni tok moraju postojati **definicija, vizuelna razrada relevantnih stanja, aktuelna implementacija i izvršen odgovarajući dokaz**. Završetak ne znači sve moguće kombinacije svakog uređaja, već sve ključne korisničke situacije i kritične granice uz reprezentativne mobilne uslove. Prekrivena glavna radnja, nečitljiv tekst ili nepristupačan ključni korak jesu blokade. Preostalo manje ograničenje može se prihvatiti samo konkretno, sa razlogom i vlasnikom; ne nestaje iz plana.

## 3. Proizvod, korisnički tokovi, ekrani i završni UI/UX

### 3.1. Obavezni rezultat i granica sadašnjeg dokaza

USKOČI treba da omogući čoveku da prirodno opiše potrebu ili svoju ponudu, potvrdi tačno shvaćene podatke, pronađe odgovarajuću drugu stranu i završi dogovor kroz razumljive, povezane ekrane. Jedan nalog može koristiti odvojena iskustva naručioca i izvršioca. Promena uloge ne prenosi nedozvoljeno stanje, tuđe podatke ili radnje iz prethodnog konteksta.

Cilj obuhvata **sve postojeće aktivne funkcije i potvrđena korisnička obećanja**, uz njihovo logičko, kodno i vizuelno dovršavanje. Teška ili nezavršena aktivna funkcija ne premešta se samovoljno u „kasnije”, ne skriva se i ne proglašava suvišnom radi lakšeg objavljivanja. Promena obima zahteva konkretnu odluku vlasnika proizvoda; istorijski/prototipski sadržaj ostaje odvojen od stvarno aktivnog proizvoda. Redosled platformskih izdanja može biti različit bez tihog smanjivanja funkcionalnog cilja.

Ovaj odeljak određuje završni proizvodni i vizuelni ugovor unutar jedinstvenog plana. **Specifikacija nije dokaz da su svi prikazi već nacrtani, povezani ili provereni na telefonu. U ovoj etapi nisu izrađeni novi konačni nacrti ekrana; plan određuje obavezu njihovog stvarnog dovršavanja.** Poznata ponašanja u nastavku potiču iz analiziranog preseka. Njihovu primenu proveriti na aktuelnom izvoru i konkretnoj isporučenoj kombinaciji aplikacije, servera i konfiguracije.

Za svaki tok i njegov ekran voditi četiri odvojena statusa: **definisano**, **vizuelno razrađeno**, **implementirano** i **dokazano**. Uz poslednji status navesti stvarni nivo: izvor, izvršen test, integracija, native uređaj ili ceo tok. Nedostupna provera ostaje BLOCKED sa razlogom; odsustvo dokaza ostaje UNPROVEN. Postojanje rute, prototipa, starog PASS-a ili jednog screenshot-a ne popunjava ostale statuse.

Čovek vidi smisao svog posla. Interne kategorije, potpisi, revizije i nazivi klasifikatora ostaju unutrašnji detalji. Jasne činjenice se čuvaju, a jedno naredno pitanje rešava jednu stvarno potrebnu nejasnoću. Predlog, pregled, privatni nacrt, objava, sačuvan profil, aktivacija i spremnost za povezivanje ostaju različita stanja.

U aktivnom razgovoru nema parcijalnih kartica. Ne uvoditi dodatne obavezne formulare za mode, opremu, tim, vozilo, licence ili biografiju. Potrebna stvarna činjenica prikuplja se prirodno i potvrđuje u razumljivom završnom pregledu; postojanje starog polja ili testa nije razlog da se uvede nova korisnička obaveza.

### 3.2. Sačuvani kanonski tokovi J01–J14

Oznake i ishodi ostaju stabilni. Svaki red povezati sa konkretnim ekranima, radnjama i dokazom; pomoćni ulazni tokovi iz inventara ispod dopunjuju njihovu celinu.

| Tok | Vidljiv ishod koji treba postići i sačuvati | Radni zadaci |
|---|---|---|
| **J01 — Naručilac opisuje potrebu** | Sve jasne činjenice ostaju; jedno potrebno pitanje; prazan ulaz nema model/upis. | R04/R06/R08 |
| **J02 — Ispravka i nastavak** | Termin ili završna poruka ne obezvređuju istu uslugu; stvarna promena odbacuje samo zastareli rezultat. | R04/R07/R08 |
| **J03 — Jedan pregled i mapa** | Čovek vidi celinu; potvrda pina, lokalna izmena i objava imaju tačan ishod; REMOTE nema lažnu radnu mapu. | R02/R08/R11 |
| **J04 — Nacrt, objava i zamena** | Nacrt ostaje privatan; objava ima readback; zamena čuva staru do uspeha i ne prenosi stare prijave. | R07/R08/R12 |
| **J05 — Radnik opisuje i dopunjava ponudu** | Isti razgovor čuva ostale usluge i područja; nema parcijalnih kartica niti obavezne opcione biografije. | R04/R06/R08 |
| **J06 — Čuvanje i aktivacija profila** | Isti ekran pregleda omogućava Save/Save+activate uz odgovarajući potpisani izbor; ponovo otvoreni profil verno pokazuje potvrđenu ponudu. | R04/R08/R10/R12 |
| **J07 — ID, oba načina i predaja** | Sinonim koristi isti ID; nova grana ima stvaran DB ID; ceo BOTH i stvarni REMOTE/handoff ostaju. | R04/R06 |
| **J08 — Područje i vreme** | Odgovarajući kandidat prolazi od početnog izbora do prilike; stara tačka ne poništava sačuvano područje. | R05 |
| **J09 — Lista, mapa i filteri** | Ponuđeni režimi rade sa pravim serverom; korisna lista opstaje uz odvojenu grešku mape; ručna pretraga dostupna. | R01/R02/R12 |
| **J10 — Moji zadaci, prijava i izbor** | Pet scope-ova i counts odgovaraju podacima; prijava/izbor čuvaju reviziju i uslove; dodatak veštine ne pregazi profil. | R03/R07/R11/R12 |
| **J11 — Dogovor, poruke i ocene** | Obe uloge vide iste uslove, poruke i potvrđen završetak; ocena se osveži; PHONE ugovor zatvoren i na serveru. | R07/R09/R11/R12 |
| **J12 — Obaveštenje i odredište** | Poštuju se obe preference; nema nepotrebnog dupliranja; dodir vodi tačnom dozvoljenom sadržaju. | R09/R12 |
| **J13 — Povratak, restart i nepoznat ishod** | Proverava se ista radnja; sačuvani posao ne ponavlja model; gubitak medijskih bajtova ima bezbedan izlaz. | R06/R07/R11/R12 |
| **J14 — Privatnost i život podataka** | Tri privatne kolone ostaju privatne; saglasnost je za pravi dokument; izvoz/kopije čuvaju potvrđena područja. | R01/R10/R12 |

### 3.3. Potpun radni inventar grupa ekrana

Ovo je obavezan inventar oblasti, **ne tvrdnja da je izvršen nov popis svih ruta niti nalog da se napravi dvadeset novih ekrana**. Jedna grupa može imati više postojećih ruta, modalnih prikaza i stanja. Svaki pronađeni prikaz dobija tačnu putanju i oznaku: aktivan/povezan; kodiran/nepovezan; istorijski/prototip; potreban/nedostaje; aktivan sa nedostajućim stanjem. Nepovezani designLab se ne uključuje samo zato što postoji.

| Br. | Grupa i obuhvat | Obavezni izlaz i veza |
|---|---|---|
| **01** | Početni ulaz i Auth: prijava, registracija, potvrda kontakta prema podržanom načinu, oporavak, nevažeći/istekao link, odjava. | Čovek pouzdano ulazi u pravi nalog; nema prazne slepe ulice ili tuđeg nastavka. R01/R11/R12. |
| **02** | Izbor i promena uloge, povratak u prethodno radno okruženje. | Jasno „Treba mi neko” / „Želim da uskočim”; dozvoljeni nacrti ostaju kod svog vlasnika. R11/R12. |
| **03** | Početna, donja navigacija, prečice, povratak i zabranjeno odredište. | Svaka aktivna radnja otvara odgovarajući sadržaj u pravoj ulozi. R11a; ulazi u J01–J14. |
| **04** | Naručilac AI: uvod, tekst, glas, fotografija, dopuna, prekid i nastavak. | Jasne činjenice opstaju; jedno potrebno pitanje; tehnički problem ne postaje pitanje o kategoriji. J01/J02/J13. |
| **05** | Pregled potrebe, izmena, fotografije, razgovorna i pregledna mapa, predaja. | Jedna razumljiva celina; vidljivo je šta je predlog, lokalna izmena i sačuvani podatak. J03/J04. |
| **06** | Moje potrebe, statusi, brojači, strane, privatni nacrt, detalj, izmena/zamena. | Pet postojećih scope-ova i counts odgovaraju podacima; status određuje dozvoljene radnje. J04/J10. |
| **07** | Izvršilac AI: više usluga, izmene, načini izvođenja, predaja i područja. | Nepogođene usluge ostaju; nema obaveznih suvišnih formi za biografiju/opremu/licence. J05/J07/J13. |
| **08** | Pregled i sačuvan profil, Save/Save+activate, izmena ACTIVE profila. | Ponovo otvoren profil verno pokazuje mode/handoff/pending po usluzi. J06/J07. |
| **09** | Područja i raspoloživost, sačuvani izbor i postojeći dozvoljeni način izmene. | Radni prostor i vreme imaju isti smisao u profilu i povezivanju; nema novog obaveznog formulara. J08. |
| **10** | Prilike: lista, mapa, filteri, ručna pretraga i „Za mene”. | Prazno, parcijalno i neuspešno čitanje su različita stanja; korisna lista ostaje dostupna. J08/J09. |
| **11** | Javni detalj, slanje prijave, Moje prijave i izmena/povlačenje gde ugovor dozvoljava. | Prikazani uslovi odgovaraju poslatoj radnji; privatna polja ostaju zaštićena. J10. |
| **12** | Kandidati, izbor, potvrda i kapacitet. | Izabrana je prava prijava za važeće uslove; brojač potiče iz autoritativnog modela. J10/J11. |
| **13** | Dogovor: pregled, dozvoljene izmene, tok, završetak i otkazivanje prema stanju. | Obe uloge vide iste potvrđene uslove i sledeću dozvoljenu radnju. J11. |
| **14** | Poruke, foto/glas, grupna vidljivost, nacrti, neuspešno slanje i oporavak. | Nema dupliranja, tuđe poruke ili izgubljenog nacrta prikrivenog uspehom. J11/J13. |
| **15** | Obaveštenja i preference, dozvola, push i tačno odredište. | IN_APP i PUSH ostaju nezavisni; dodir ima autorizovan cilj ili pošten rezervni prikaz. J12. |
| **16** | Ocene, javni prikazi i komentari prema važećem ugovoru. | Pravo ocenjivanja, vidljivost, agregat i osvežavanje ostaju dosledni. J11; R11b. |
| **17** | Podrška, prijava problema/sadržaja/korisnika, blokiranje i potvrda prijema. | Razraditi postojeće i za izdanje potrebne mogućnosti; odrediti stvarnog vlasnika obrade. R01/R10/R11. |
| **18** | Pravila, privatnost, saglasnosti, izvoz, zatvaranje naloga i status zahteva. | Važeći dokument, prava potvrda, sve potrebne kopije podataka i proverljiv završetak. J14. |
| **19** | Podešavanja i OS dozvole: lokacija, mikrofon, fotografije i obaveštenja. | Objašnjena svrha, odbijanje i naknadna promena imaju upotrebljiv nastavak. R09/R11/R12. |
| **20** | O aplikaciji, pomoć, kontakt podrške i javni linkovi. | Razumljiv identitet izdanja, funkcionalni linkovi i jasan put do pomoći. R11/R12. |

Loading, greška, offline, uvećan tekst i tastatura nisu novi ekrani po automatizmu: pripadaju svakoj relevantnoj grupi. Skrivena nedozvoljena ruta mora ostati zaštićena i pri direktnom linku, nezavisno od vidljivosti dugmeta.

### 3.4. Cele priče naručioca, izvršioca i sistema

**Naručilac.** Posle prijave i izbora uloge dolazi u svoje radno okruženje. Otvara razgovor; lokalni uvod sam ne pokreće model. Opisuje potrebu tekstom ili podržanim medijem. Asistent čuva jasno izrečene činjenice i pita jednu preostalu bitnu stvar. Čovek ispravlja podatak u istom razgovoru, bez ponovnog diktiranja cele potrebe. Pregled pokazuje posao, uslove, vreme, broj potrebnih ljudi i relevantno mesto/predaju. Nacrt ostaje privatan; objava nastaje tek eksplicitnom radnjom i potvrđuje se čitanjem stvarnog rezultata. U Mojim potrebama vidi status i prijave, bira po važećim uslovima, ulazi u potvrđen Dogovor, razmenjuje poruke i koristi dozvoljene korake do završetka i ocene. Ako menja objavljenu potrebu, priprema ne gasi staru objavu; uspešna zamena zatvara staru u propisanoj transakciji i ne prenosi prijave na nove uslove.

**Izvršilac.** U svom prostoru opisuje jednu ili više usluga, načine rada i područja. Dopuna jedne usluge ne briše ostale. Ista usluga sa oba načina zadržava isti ID i oba potvrđena smisla. REMOTE može obuhvatiti digitalni rad ili radionicu sa predajom; zato ne dobija izmišljenu fizičku radnu tačku. DRAFT na istom ekranu pregleda bira čuvanje ili čuvanje sa aktivacijom, uz pripremu pregleda koji potpisano nosi izabranu vrednost. Izmena ACTIVE profila ne deaktivira ga slučajno i ne daje novoj nepotvrđenoj usluzi prava starih potvrđenih usluga. Ponovo otvoren profil verno pokazuje sačuvano. Izvršilac pronalazi prilike ručno ili preko odgovarajućeg obaveštenja, proverava uslove, šalje prijavu i vidi potvrđen ishod. Posle izbora koristi isti Dogovor i poruke kao naručilac, uz prava svoje uloge, pa završetak i ocenu.

**Sistem.** Za svaki korak proverava nalog, ulogu, svet, reviziju i stvarno dozvoljene podatke. Model predlaže činjenice; baza potvrđuje identitet i čuva poslovni rezultat. Izmena budžeta/vremena ne ruši nepromenjenu semantiku usluge; stvarna promena odbacuje zastareli rezultat. Nedovršena tehnička klasifikacija dobija ograničen nastavak i obračun kroz postojeći vlasnički tok. Izbor kandidata koristi sačuvanu ponudu, područje i vreme; ručna prijava ne dobija automatski dodatne zabrane iz dispatch preference pravila. Poslovna komanda koristi postojeći stabilan identitet i zaštite. Nejasan odgovor zahteva proveru iste radnje, a potvrđen uspeh osvežava povezane ekrane. Poruke, obaveštenja i tačna lokacija imaju zasebne granice vidljivosti. Izvoz i zatvaranje naloga obuhvataju potrebne žive i arhivske kopije.

Sve tri priče proveriti sa dva odvojena naloga i nezavisnim klijentskim sesijama. Uključiti izgubljen odgovor, zastareo pregled, dupli dodir, restart i promenu naloga. Android dokaz ne predstavlja iOS dokaz.

### 3.5. Specifikacija ekrana i svake komande

Za svaki stvarni ekran popuniti sledeća polja u istom operativnom registru plana. UI ne postaje novi vlasnik pravila koje već poseduje domen.

1. **Identitet:** ruta, uloga, svrha, grupa 01–20, J/R/F/SB/X veze i četiri odvojena statusa.
2. **Ulazi i izlazi:** navigacija, dozvoljeni push/deep link, potrebna sesija, preduslovi, zabranjeno odredište i povratak.
3. **Podaci:** vidljiva polja, privatnost, merodavan reader, relevantna verzija i pravilo osvežavanja.
4. **Svaka radnja:** dugme ili gest, naziv i smisao, preduslov, postojeća komanda/writer i razlog nedostupnosti.
5. **Potvrđeni zahtev:** payload i obuhvat izmene, očekivana revizija, identitet pokušaja i sadržaj koji korisnik tačno potvrđuje.
6. **Trajnost:** šta ostaje lokalni nacrt, šta se čuva odmah, šta tek izričitom potvrdom i kada je server potvrdio rezultat.
7. **Potvrda i posledice:** merodavan receipt/readback, povezani ekran, dozvoljena posledica kod druge uloge i potrebno obaveštenje ili nastavak procesa.
8. **Stanja:** početno, loading, empty, success, partial, greška, offline, zabranjeno/isteklo i nepoznat upis, gde su primenljiva.
9. **Prekidi:** Back/gest, zatvaranje sheet-a, tab, background, restart, odjava i promena naloga.
10. **Konkurentnost:** dupli dodir, obrnut red odgovora, paralelna izmena, zastareo pregled i kasni callback.
11. **Oporavak:** šta može bezbedno da se ponovi, šta samo da se proveri, rok i granica automatskog rada; nepoznata ranija komanda ne skriva se novim identitetom.
12. **Tekst:** konačan tačan srpski copy, dosledan ton i postojeće persiranje oba AI razgovora, bez internih oznaka i lažnih potvrda.
13. **Izgled:** hijerarhija, glavna i sporedne radnje, stvarna količina sadržaja, raspored, razmaci i postojeće komponente.
14. **Telefon i pristupačnost:** safe area, tastatura, mali ekran, veliki font, dugačak sadržaj, čitač ekrana, fokus, dodirne površine i smanjene animacije.
15. **Dokaz:** relevantan pozitivan i potreban negativan test, prikaz bitnih stanja i native proba kada je potrebna, uz datum, identitet verzije i stvarni domet provere.
16. **Granica i sledeći korak:** preostalo ograničenje ili poslovna odluka, odgovorni zadatak, razlog da li blokira konkretno izdanje i sledeća radnja. Definisano, vizuelno razrađeno, implementirano i dokazano beleže se odvojeno, prema stvarnim rezultatima.

Obavezna sledljivost je **tok → ekran → radnja → postojeći vlasnik → test → dokaz na telefonu**. Jedan red operativne matrice sadrži:

| Tok i problem | Ekran i stanje | Radnja i efekat | Postojeći vlasnik | Test i rezultat | Dokaz na telefonu |
|---|---|---|---|---|---|
| J oznaka, vezani R/F/SB/X i konkretan scenario | Tačna aktuelna ruta/komponenta, uloga i početno stanje | Naziv komande, uslov, sačuvani rezultat i readback | Reader/writer, ugovor i source putanja | Stvarna testna putanja/komanda, datum, rezultat i granica dokaza | Kandidat/source/OTA/backend, model uređaja/OS, scenario, screenshot/video i rezultat |

Na primer, J03/J04 objava mora povezati pregled potrebe, postojeći review/publish vlasnički tok, proveru izgubljene potvrde i uređajski prikaz iste potvrđene objave. Naziv budućeg testa ili zamišljeni snimak ne popunjavaju polje dokaza. Relevantna provera unosi se iz stvarnog izvršenja; gde uređajski dokaz nedostaje ostaje UNPROVEN.

Ne primenjivati jedan identičan mehanizam trajnosti na sve radnje. Requester izbor već koristi memorijski `session.pending`, zamrznutu komandu i `readSelectedAgreement`; worker prijava ima zaseban postojeći journal. Proveriti potrebnu granicu oporavka, bez uvođenja drugog vlasnika samo radi simetrije.

### 3.6. Četiri obavezna konkretna ugovora ponašanja

#### 3.6.1. Pregled potrebe i objava

Predloženi nazivi su „Izmenite”, „Sačuvajte nacrt” i „Objavite”; uskladiti ih kroz proizvod. Pregled pokazuje stvarni sadržaj, cenu sa osnovicom, vreme, ljude i relevantno mesto/predaju. Pending klasifikacija sama ne uvodi opštu zabranu čuvanja ili objave; posebni stvarni uslovi za sadržaj, mesto, safety i REMOTE predaju ostaju.

**Isti review, različit nastavak.** SaveDraft i Publish prihvataju isti prikazani važeći review i njegov digest kroz postojeći accept ugovor. SaveDraft završava privatnim prihvatom; Publish nastavlja kroz evaluate/publish. Ne pripremati drugi suvišan review samo zato što postoje dva izbora. Nastavak već prihvaćenog nacrta koristi potvrđenu komandu i njen ključ; promena sadržaja ili relevantne revizije zahteva odgovarajući novi pregled. Postojeći `aiTaskReviewClientService` i ruta pregleda ostaju vlasnici tog ugovora.

| Stanje | Korisnički prikaz | Obavezan efekat |
|---|---|---|
| Spremno | Dostupna radnja za prikazani pregled, prema njenim stvarnim preduslovima. | Još nema prihvata ni objave; SaveDraft i Publish imaju različit nastavak. |
| Slanje | Poruka odgovara radnji: čuvanje nacrta ili objavljivanje. | Isti review i identitet pokušaja; dupli dodir ne šalje novu komandu. |
| Potvrđen privatni nacrt | Jasno da je nacrt sačuvan i da zadatak nije objavljen. | ACCEPTED potvrđuje privatni prihvat. Evaluate/publish nisu automatska posledica izbora SaveDraft. |
| Izgubljen odgovor ili obrada još traje | Provera prethodne radnje uz očuvan sadržaj; nema tvrdnje o završenoj objavi. | ACCEPTED, EVALUATING, EVALUATED i UNKNOWN_OUTCOME nisu PUBLISHED. Provera iste komande ne pokreće slepo novu objavu ili plaćeni model. |
| Server je zabeležio objavu, prikaz još nije potvrđen | Jasno da je objava zabeležena i da treba proveriti prikaz zadatka. | Čita se isti rezultat; nedostupan readback nije razlog za novu objavu. |
| Potvrđen uspeh objave | „Vaša potreba je objavljena.” Otvara se stvarni detalj. | Autoritativna komanda je PUBLISHED; pripadajući published receipt ima status PUBLISHED i evaluaciju ALLOW. Identitet, revizija i rok odgovaraju review-u, a readback potvrđuje isti Need/reviziju u dozvoljenom javnom stanju. Sam isti ID i revizija nisu dovoljan dokaz. |
| Dopuna, ručna provera ili odbijanje | Konkretan razlog i dozvoljen sledeći korak. | NOT_READY, CLARIFY, REVIEW i BLOCK zadržavaju svoje značenje. Nema lažnog uspeha, tihog menjanja sadržaja ili automatske nove objave. |
| Neizvesnost traje | Iskreno objašnjenje i dostupna sledeća provera. | Ograničena obrada i oporavak iste radnje; ne stvarati novi identitet da bi se sakrio nepoznat ishod. |

**Tri odvojena prihvatna scenarija:** prva direktna objava iz pregleda; SaveDraft, ponovno otvaranje i objava privatnog nacrta; zamena već javne objave po A24 iz R07. Nacrt nije obavezan dodatni korak pre svake objave. Kod zamene stara objava ostaje do uspeha transakcije, a nova objava, zatvaranje stare i obrada starih prijava imaju istu atomsku granicu. Stare prijave se ne prenose na nove uslove. Sačuvati uspeh, odbijanje, nepromenjen sadržaj, izgubljeni ACK i rollback slučajeve iz A24.

Back tokom provere nije dokaz otkazivanja. Tastatura ne prekriva glavnu radnju; status se čitaču ekrana saopštava jasno, bez neprekidnog ponavljanja.

#### 3.6.2. Čuvanje i aktivacija profila

Svaka usluga pokazuje svoj mode, relevantnu predaju i status. DRAFT na istom ekranu pregleda omogućava Save ili Save+activate kada su odgovarajući uslovi ispunjeni; prethodni zaseban DRAFT Save nije obavezan. **`activate` pripada pripremljenom potpisanom review-u.** Promena izbora aktivacije priprema odgovarajući novi signed review pre slanja. Save koristi pregled koji korisnik potvrđuje; vrednost se ne menja naknadno uz stari potpis.

Postojeći `rpc_save_worker_ai_review` u jednoj transakciji čuva profil, lokaciju i dostupnost, izvršava traženu aktivaciju, zatvara razgovor i zapisuje receipt. Ne dodavati drugi activation writer niti projektovati izmišljeno polustanje „profil uspešno sačuvan, aktivacija odvojeno nije uspela”. Za `activate=true` važeći decoder traži ACTIVE potvrdu. `activate=false` ne aktivira DRAFT i ne deaktivira postojeći ACTIVE profil. Potvrđeno odbijanje transakcije i izgubljen odgovor nisu isto: nepoznat mrežni ishod rešava se readback-om istog Save-a i merodavnog profila, uz isti identitet pokušaja. Tokom upisa nema drugog slanja.

Posle uspeha prikazuje se merodavan sačuvan profil, ne stara lokalna kartica. Ako nova usluga čeka, objašnjenje stoji uz nju. Nepogođene stare usluge ne gube prava bez odgovarajućeg serverskog pravila. Traženi BOTH zahteva oba očekivana dela istog ID-ja; ACTIVE status profila ne potvrđuje sam po sebi admission/binding ili podobnost svake nove usluge za povezivanje. Zastareo pregled obnavlja se uz potrebnu korisničku potvrdu i očuvanje paralelnih izmena. Status ima tekst, ne samo boju; detalji rade i bez animacije. Opciono polje ne odlaže završetak razgovora.

#### 3.6.3. Discovery: lista i mapa

Lista, podloga, pinovi i prostorni rezultat imaju odvojeno stanje. Uspešna lista ostaje upotrebljiva kada mapa ne radi. Ako podloga radi a pinovi ne rade, poruka precizira prikaz zadataka na mapi. Prvi neuspeh bez rezultata i kasniji neuspeh imaju jednako razumljivo objašnjenje i dostupnu radnju. Prazan rezultat jasno kaže da nema zadataka za izabrane uslove.

Tokom osvežavanja sačuvati još važeći sadržaj uz oznaku; stari filter ne sme se predstavljati kao novi. HALF/FULL/PEEK ne skrivaju poruku i dugme iza navigacije. REMOTE ne pokreće besmislen fizički MAP zahtev. Povratak na tab čuva dozvoljeni kontekst, a čitač ekrana ne gubi fokus pri svakom retry-ju. Razlog greške određuje korisnu radnju: serverovo odbijanje se ne objašnjava automatski „lošim internetom”.

#### 3.6.4. Izbor izvršioca i Dogovor

Izbor se vezuje za važeću prijavu, reviziju i prikazane uslove. „Izaberite” šalje postojeću zamrznutu komandu; tokom upisa prikazuje se „Potvrđivanje izbora”. Nepoznat ishod proverava istu radnju. Tek autoritativni `readSelectedAgreement` opravdava prikaz potvrđenog Dogovora. Zastarela prijava ili promenjeni uslovi daju konkretno objašnjenje i osvežen prikaz.

Brojač „Izabrano 0 od 2 → 1 od 2 → 2 od 2” ostaje **predlog prikaza do potvrde šta aktuelni model broji**: osobe, popunjena mesta ili timski kapacitet. Ne povećavati ga brojanjem klikova ili pretpostavkom da jedna prijava uvek popunjava jedno mesto. Dogovor koristi poruke; zasebna kontrola tačne lokacije ostaje. Posebnu PHONE mogućnost zatvoriti i na serveru i za podržane stare klijente. To samo po sebi ne uvodi novu zabranu da čovek otkuca broj u slobodnoj poruci.

### 3.7. Dve mape: postojeće značenje i otvoren vizuelni izbor

Poznati ugovor razlikuje dve radnje. **`ConversationPointAsk`** svaku izričito potvrđenu tačku odmah čuva na serveru uz geografsku reviziju; START može biti sačuvan dok END nedostaje. **`NeedLocationForm`** u pregledu čuva tačke lokalno; „Primeni potvrđene tačke” priprema novi review. Izlazak bez primene ne znači sačuvan novi skup.

UI mora objasniti tu razliku i ponašanje pri izlasku. Sačuvano se ne sme predstaviti kao izgubljeno, niti lokalno kao potvrđeno na serveru. Ne objedinjavati writere zbog sličnog izgleda. Promena redosleda kartice/pregleda/mape ili načina potvrđivanja ostaje konkretan dizajnerski predlog za odluku; jasno označavanje sadašnje trajnosti je obavezna ispravnost.

### 3.8. Vizuelni rad od sadašnjeg APK-a do konačnog izdanja

Rad počinje od nedostajućih prikaza trenutne aplikacije. Ne tražiti ponovo iste tri već dostavljene slike. Uz novi obilazak zabeležiti stvarni identitet tada instaliranog izdanja. Trenutni prikaz nije automatski dokaz ponašanja novijeg izvora.

Snimanje ide u tri prolaza: **polazno stanje**, **isti scenario posle popravke** i **konačan release kandidat**. Korisnik može prvo poslati jednu celu grupu: ulaz/navigacija; naručilac od razgovora do objave; izvršilac od razgovora do sačuvanog profila; prilike/prijava; izbor/Dogovor/poruke/završetak; podešavanja/podrška/privatnost. Kratak video bolje pokazuje tastaturu, čekanje, gest i povratak. Tehničke greške reprodukuje izvršni tim; korisnik ne mora praviti stotine snimaka.

Na postojećim komponentama razraditi reprezentativne površine: početnu, karticu/listu prilike, AI razgovor, završni pregled i Dogovor/poruke. Zaključiti tipografiju, razmake, kontrast, ikone, dugmad, kartice, sheet/modal, prazno i neuspešno stanje. Potom isti jezik primeniti kroz inventar. Veći vizuelni izbor prikazati kao povezanu celinu; rutinske detalje rešavati u tom pravcu. Ne praviti paralelan dizajn sistem.

Za svaku glavnu površinu proveriti jednu jasnu primarnu radnju, stvarnu količinu informacija, dugačke nazive, mali ekran, veliki font, tastaturu, safe areas, fokus i smanjene animacije. Snimke za prodavnicu praviti iz proverenog kandidata sa reprezentativnim probnim sadržajem bez privatnih podataka; prikazana funkcija mora stvarno raditi.

### 3.9. Izlazni kriterijum UI/UX i povezanog proizvoda

Ova celina je završena kada svi obavezni tokovi imaju definisana pravila, vizuelno razrađena relevantna stanja, aktuelnu implementaciju i izvršen odgovarajući dokaz. Povezani scenario uključuje opis, ispravku, pregled, čuvanje/objavu, pronalaženje, prijavu, izbor, Dogovor, poruke, završetak i ocenu; ponovno otvaranje pokazuje iste potvrđene podatke. Ulaz u nalog, uloge, podrška, privatnost i potrebne dozvole nemaju slepe ulice.

Nema nerešenog blokirajućeg gubitka podataka, neovlašćenog pristupa, lažnog uspeha, duplog poslovnog efekta ili neprohodne glavne radnje. Pozitivni tok ima relevantan negativni slučaj. Proverivač mora zaista pasti kada njegov očekivani rezultat izostane. Meriti odziv, korisni prikaz, potvrđen ishod, ukupan AI trošak i push čekanje u imenovanim uslovima; ne proglašavati cilj izmerenim rezultatom.

Konačan izgled mora biti proverljiv na stvarnom Android kandidatu i zasebno na iOS kandidatu ako je iOS u izdanju. UI/UX završetak ulazi u R12 zajedno sa ispravnim produkcionim presecima, pravnim sadržajem, zahtevima prodavnica i operativnom podrškom; sam ne znači da je izdanje već odobreno ili objavljeno. Manje prihvaćeno ograničenje dobija vlasnika, razlog i rok; prekriveno glavno dugme ili nepristupačan ključni korak ostaju blokada.

## 4. Svih 42 nalaza i redosled rada

### 4.1. Stabilan registar nalaza

Svaki red zadržava primarnog R vlasnika iz izvornog tehničkog mapiranja. R11a–h su podzadaci R11. Prateći R ne predstavlja drugi nezavisan vlasnički sistem: označava granicu koja mora ostati usklađena. U ovoj reviziji nijedan nalaz nije označen kao novopopravljen ili novoizvršeni incident. Detaljan posao, tačne poznate putanje i testovi stoje u odeljku 6.

| Nalaz | Konkretan problem | Primarni R | Povezano | Obavezna promena / granica |
|---|---|---|---|---|
| F01 | Lista sopstvenih zadataka ima neusaglašen wire ugovor | R03 | — | Uskladiti pet scope-ova, counts, cursor i tačan wire oblik javnog reader-a i decoder-a. Napraviti usku novu migraciju prema sadašnjem reader-u; ne vraćati ceo istorijski EX04a kandidat. |
| F02 | Satnica nema isto značenje kroz sve faze | R07 | R12 | Nakon zaključivanja podrške za satnicu uskladiti HOURLY/PER_HOUR kroz fact validator, writer, review, objavu, prijavu, izbor, Dogovor i dekodere. Ne uklanjati samo TOTAL guard. |
| F03 | Korekcija valute može ostaviti staru potvrđenu cenu | R07 | — | R07a: povući zastarelu potvrđenu cenu u postojećem RSD/OFFERS domenu. Nepodržana valuta ostaje nerešena do dozvoljene potvrde; ne uvoditi EUR, kurs ili OFFERS po pretpostavci. Proveriti naknadnu validnu RSD korekciju kroz stvarni review/Save/publish, uz očuvan mogući nerešeni DRAFT. |
| F04 | Parcijalan katalog može postati „potpun” keš | R04 | — | Iterirati nextCursor do potvrđenog završetka uz kontrolu ponovljenih kursora, grešaka, verzije/fingerprint-a i kompletne cache jedinice. Delimično stablo ne dobija status celog. |
| F05 | Semantički identitet, nova grana i sintaksička prepreka nisu spojeni u jedan aktivan ugovor | R04 | R08 | Izabrati jednog aktivnog semantičkog vlasnika prema istom korpusu i merama; dozvoliti semantički reuse postojeće grane i smislen predlog nove hijerarhije. Uskladiti bind ID-a i kategorijski tekst, worker rename/sync i sve čitaoce; tek posle parity dokaza povući suvišan put. |
| F06 | Klasifikacija može ostati nedovršena i posle uspešnog modelskog odgovora | R06 | R04, R12 | Pre implementacije definisati tačan minimalan trajni zapis rada: account/conversation, draft revision, ulaz/fingerprint, scope, očekivani mode parovi, pokušaj/budget, stanje i rezultat. Omogućiti ograničen nastavak i kada prvi plan nije nastao. Existing post-save outbox povezati gde je primenljiv, ne nazivati ga rešenjem za nepostojeći plan. |
| F07 | Dodatni model poziv nema zatvoren zaseban obračun | R06 | — | Uskladiti jednog timeout/abort vlasnika i budžet logičkog pokušaja; BG čitanje mora proveriti potpunost/STOP/body limit i beležiti usage ili UNKNOWN. STT rezervaciju ne oslobađati samo zato što nema transkripta, već po dokazu dispatch/usage. |
| F08 | Worker mode ugovor nije jedinstven; nepotpun BOTH može postati READY | R04 | R08 | Iz ulazne namere izvesti ceo očekivani skup service×mode pre provider odgovora; validirati potpunost skupa nezavisno od uspešnog podskupa. BOTH ne sme postati dva nepovezana service ID-a. |
| F09 | Završetak worker razgovora nema autoritativan signal | R08 | — | Izvesti finish/readiness iz obaveznih potvrđenih poslovnih činjenica i statusa semantike, pa povezati isti kriterijum u Edge, decoder i ekran. |
| F10 | Sačuvani profil prikazuje manje značenja nego review | R08 | — | Povezati trajni per-service/per-mode read model sa sačuvanim profilom; prikazati ono što je upravo potvrđeno, uključujući smislen scope. Ne oživljavati stari lokalni manual draft kao drugi vlasnik. |
| F11 | Izgubljeni abandon ACK u pregledu nema odgovarajući readback | R07 | — | Posle unknown abandon čitati isti review/request i razlikovati OPEN/ABANDONED/UNKNOWN; omogućiti proveru i tačan nastavak bez novog prepare-a. |
| F12 | Više guard-ova može tražiti više razjašnjenja odjednom | R08 | — | Birati sledeću relevantnu nejasnoću i ograničiti sastavljeni odgovor na jedno pitanje; proveriti rezultat poruke, ne samo string instrukcije. |
| F13 | Posle uspešne prijave sledi moguć zastareo profilni upis | R07 | — | Ukloniti slepi upis starog celog skills niza; koristiti autoritativno ograničen merge/CAS sa account revision ili vezati postojeći vlasnik koji to već garantuje. |
| F14 | Source, Edge, SQL i instalirani klijent su različiti potvrđeni preseci | R12 | R01 | Za svaku isporuku snimiti source SHA, dependency lock, migration ledger/function bodies/ACL, Edge bundle versions+hashes, flags, build/OTA/runtime i dokaz uređaja. Razlike rebase-ovati po vlasniku; proveriti clean isolated schema bootstrap, jer istorijske proof migracije očekuju fixture stanje. |
| F15 | Instalirani P6 klijent traži MAP koji živi discovery RPC ne podržava | R02 | — | Uskladiti PAGE/MAP/PLACES i exact/filter/paging ugovor između aktivnog transporta, decoder-a i javne funkcije, uz eksplicitnu politiku kompatibilnosti podržanog starog klijenta. |
| F16 | Jedna read greška uklanja mapu; retry menja oblik greške, HALF zaklanja veliku poruku | R02 | R11, R11e native regression | Odvojiti dostupnu listu od MAP/PLACES/native-style greške i specificirati prvi read, retry bez snapshot-a i parcialni uspeh. Za HALF/FULL/PEEK panel nacrtati/stilizovati error i CTA unutar dostupne visine i navigacionih insets. |
| F17 | Trenutna legacy dijagnostika prikazuje boolean „true” | R02 | — | Sačuvati bezbedan tip razloga greške od data vlasnika do UI-ja i mapirati ga na razumljivu radnju; interne detalje ostaviti u dijagnostici. |
| F18 | Prefilter, saved-area i TODAY vreme mogu izgubiti dozvoljenog kandidata | R05 | R11, R12 | Uskladiti candidate_profile_ids/v1b, dispatch konfiguraciju, area-fit i time-tier. Retrieval mora biti nadskup stvarno podobnih radnika; koristiti potpisano područje, ne stari jedan profilni pin. Za STATIONARY/POINT_TO_POINT/MULTI_STOP/AREA_BASED eksplicitno zaključati koji postojeći topološki predicate važi. |
| F19 | `workAreas` nedostaje current export i arhivskom projektoru | R10 | — | Pratiti workAreas i izvedene/private/archive kopije kroz oba export sloja, consent revocation i closure projection. Dodati minimalne postojeće adaptere/kolone, ne vraćati ceo stari WAR01 kandidat. |
| F20 | Kapacitet push reda, suppression i exact-target ugovor | R09 | R12 | Usaglasiti push-only target resolver bez IN_APP zavisnosti, emit/writer za stvarne event tipove i isključivanje već prijavljenog radnika iste revizije iz prve opportunity ponude. Kapacitet meriti stvarnim scheduler claim/send/receipt ciklusom, ne batch deklaracijom. |
| F21 | Authenticated table SELECT poništava granicu tri privatne Need kolone | R01 | — | Novom uskom migracijom ukloniti konflikt širokog table SELECT i eksplicitnih public projekcija/privatnih kolona. Pre toga popisati invoker/owner read korisnike i closure binding; ne menjati ACL naslepo. |
| SB01 | Početna | R11a | — | Uvesti/vezati razlikovan public opportunity target za karticu moje prijave; povezati ga na postojeću /prilike/[id] rutu. |
| SB02 | Ocene | R11b | — | Invalidirati datu ocenu posle potvrđenog upisa i obnoviti prvu stranu primljenih ocena na definisan povratak, uz scope/revision ključeve. |
| SB03 | Pravila | R10 | — | Autoritativno završiti/otkazati staru consent operaciju pre prihvatanja novog TERMS/PRIVACY hash-a; obezbediti izlaz iz READ_REQUIRED stanja i eksplicitan nov pristanak. |
| SB04 | Glasovne poruke | R11c | — | ABSENT posle pokušaja ne zaboraviti pre server cancel/reconcile; izložiti PROCESSING/STAGED oporavak i uskladiti jedan deadline/abort owner. |
| SB05 | Avatar | R11c | — | Definisati avatar-specifičan reconcile/cancel starog upload-a i osloboditi novu selekciju tek posle tačnog završetka; ne kopirati conversation-only task photo API. |
| SB06 | Podrška | R11d | — | Razdvojiti neposlat nacrt od poslate durable komande; očuvati nacrt istog account/context/revision pri običnom background/povratku i upozoriti pri namernom izlasku. |
| SB07 | Izmena Dogovora | R11d | — | Vezati neposlat razlog/predlog za account, agreement i version; očuvati i ponovo proveriti review. Start-only podršku zaključiti i provesti kroz model/writer/read/UI, ne samo oslabiti validProposal. |
| SB08 | Obaveštenja | R09 | — | Ili vezati postojeći atomski autoritet za oba role scope-a ili trajno pročitati oba ishoda i nastaviti samo nedostajući; Back mora uzeti writing/unknown u obzir. |
| SB09 | Javni komentar | R11b | — | Odrediti podržan javni put do komentara, vezati postojeći read/service/UI ili uskladiti obećanje sa stvarnim proizvodnim pravilom. Test sopstvenog profila koji ne šalje comments props ne dokazuje ceo javni tok. |
| SB10 | Osvežavanje poruka | R09 | — | Prikazati refresh kao stvarnu dostupnu radnju ili ukloniti montiranu fokusabilnu kontrolu uz očuvanu dostupnu alternativu. |
| SB11 | Discovery recovery/keš | R02 | R11, R11a regression | Finalize placePaging/controller i kod decode izuzetka; loaded recent account označiti tek nakon prihvaćenog read-a ili dati ponovljiv fallback; fit ključ mora uključiti sva relevantna revision/mode/pin/end polja. |
| SB12 | Vremenska zona | R11e | R05 | Povezati jedan eksplicitan policy prikaza/izmene ugovorenog vremena; označiti relevantnu zonu i čuvati UTC instant. Testirati drugim TZ okruženjem, jer sadašnji Jest setup UTC prikriva razliku. |
| SB13 | Map/motion detalji | R11e | R02, R08, R12 | Razdvojiti style/raster readiness od funkcionalnog SVG pin/drag gde vlasnik to dozvoljava; uskladiti Nearby copy/camera, panel insets, blur draft i reduced-motion lifecycle. Odluku o uklanjanju rastera doneti tek nakon native drag dokaza. |
| SB14 | Proof build/validator | R11g | R12 | Uskladiti namenski proof build sa plugin/patch zahtevom i current repo/workflow; svako dokazno izvršenje vezati za runId/source/input/checks. Osvežiti samo pogođene istorijske harness-e i stroge završne uslove. |
| SB15 | Fotografija bez teksta | R11c | R06 | Definisati jedan kanonski payload za claim i complete uključujući photo-only tekst i attachment identity; primeniti ga na obe strane bez isključivanja hash provere. |
| X01 | Safety ključ | R11c | — | Za nevalidan lokalni identitet obezbediti konkretnu kontrolisanu obnovu sa proverom/objašnjenjem i čišćenjem samo korumpiranog lokalnog zapisa; za validan unknown zadržati server reconciliation. |
| X02 | Dva imena | R11d | — | Naći jedan postojeći autoritet ili uvesti usku trajnu/revision-aware koordinaciju dve stvarne promene, tako da se posle mount-a prepozna i razreši delimičan ishod. |
| X03 | Decoder/receipt | R11f | — | Na servisnoj granici validirati finite vrednosti i sva polja potvrđenog receipt-a; klijentskim potrošačima garantovati jedinstven tačan tip. |
| X04 | Konfiguracija | R11f | — | Povezati sve read/stream/resolver potrošače na jedan eksplicitni config owner sa istim permitted fallback/required-env pravilom i proverom build-a. |
| X05 | Demo reset | R11h | — | Izolovati početni fixture i pri reset-u obnoviti sve mutable kandidate i povezane kolekcije. |
| X06 | Stari toast | R11c | — | Proveriti account+revision neposredno pre objave potvrđenog toast-a, u postojećem lifecycle owner-u. |

**Sačuvane korekcije nalaza:** F14 ne vraća povučenu sumnju o samostalnoj promeni `priceBasis`; ostaje poreklo source/live i reproduktivnost. SB/X opisi su preuzeti sa svojim ranijim dokaznim ograničenjima, a ne ponovljeni runtime nalazi. F21 zahteva proveru stvarne kolonske granice bez tvrdnje da je dokazana eksfiltracija. F16 uređajski problem zahteva isti scenario na novom kandidatu, a ne pretpostavku iz novijeg source-a.

### 4.2. Izvršni redosled i zavisnosti

R12 počinje da prikuplja integracione i uređajske dokaze od prve završene vertikale. Njegov konačni release presek dolazi posle relevantnih završenih zadataka. UI/UX prati promenu stanja i ponašanja; ne ostavlja se kao nepovezano završno ukrašavanje.

| Zadatak | Zavisnost i predmet | Pregledljiv rezultat / uslov izlaza |
|---|---|---|
| R01 — privatnost čitanja, verzije i ugovori | Početak: F21 i aktuelni repo/Edge/SQL/klijenti | Obnovljena javna kolonska granica sa pozitivnim/negativnim dokazom; tabela stvarnih ugovora i tačnih vlasnika; očuvani kompatibilni čitači. |
| R02 — Discovery i poruka greške | R01; F15/F16/F17 | PAGE/MAP/PLACES/filteri i odvojeno stanje liste/podloge/pinova; reprodukovana oba screenshot stanja zatvorena stvarnim decoder-om i uređajem. |
| R03 — sopstveni zadaci | R01; F01 | Pet scope-ova, svi counts i pravi item format; prazna i neprazna prva strana, nastavak i dozvole. |
| R04 — identitet i kompletan rezultat AI-ja | R01; F04/F05/F06/F08 | Pun katalog, reuse/nova grana, stabilna semantika i kompletan očekivani BOTH; prava revizija/signed review/Save/binder, uključujući ranije pripremljen review i replay. |
| R05 — područje, vreme i izbor | R04 signed ugovor očuvan; F18 | Zajednički area/topology/TODAY ugovor i početni izbor bez izgubljenog kandidata; Za mene/dispatch parity i nepromenjena ručna prijava. |
| R06 — tehnički nastavak i obračun | R04; F06/F07 | Postojeći posao ima durable identitet, bounded pokušaje, receipt/readback i zaseban provider usage; prekid ne traži ponovno objašnjavanje iste usluge. |
| R07 — cena i neizvesni dodatni upisi | R01; R07a postojeći domen, R07b širi cenovni ugovor; F02/F03/F11/F13 | Korekcija ne čeka novu valutu; stvarna jedinica ostaje, isti abandon ima pravi readback, dodatni upis čuva paralelnu izmenu. |
| R08 — završetak razgovora i prikaz | R04 i relevantni deo R07; F09/F10/F12 | Jedno potrebno pitanje, autoritativan završetak, jedan pregled, veran sačuvan rezultat po usluzi; bez obaveznih suvišnih formi. |
| R09 — obaveštenja i poruke | R01/R05; F20, SB08/SB10 | Dovoljan ograničen rad reda, isti-key bez duplog slanja, suppression već prijavljene osobe, validan tačan cilj pri oba nezavisna preference izbora. |
| R10 — život podataka i privatnost | R04; F19, SB03, current export/closure vlasnici | workAreas u svim projekcijama, važeći consent replay, proverene sve kopije i autorizacija; gates ostaju zatvoreni dok ceo dokaz nije validan. |
| R11 — ostatak ekrana i usko povlačenje | Po odgovarajućim owner zavisnostima; SB/X | Svi pojedinačni backlog problemi imaju proveru; aktivne module sa istorijskim delovima ne brisati u celini. |
| R12 — stvarna celina i release presek | Prethodni relevantni zadaci | Dve uloge/nalozi, realan model i telefon, prekidi i pristupačnost, poznat deploy/OTA, merene latencije/trošak i izričiti DEV/production izlaz. |

R02 i R03 mogu se raditi paralelno nakon usklađenog R01 ugovora; nezavisni klijentski nacrti/ocene mogu napredovati paralelno sa AI radom. Promene istog review/matching/export vlasnika usklađivati sekvencijalno da jedna grana ne izgubi tuđu zaštitu. Veći cleanup ide posle popravljene aktivne veze, uz caller/kompatibilnost dokaz. SB14, provera samog proverivača, prati svaki zadatak od početka.

### 4.3. Jedinica rada i kriterijum izlaza

Svaki korak ima korisnički ishod, postojeći vlasnički put, najmanju povezanu promenu, relevantnu pozitivnu i negativnu kontrolu, potreban UI prikaz i stvarni readback. Zasebno označiti definiciju, nacrt, implementaciju i dokaz. Rad na istom review/matching/export vlasniku uskladiti sekvencijalno; nezavisne površine mogu se raditi paralelno.

Ne tražiti ponovo puni audit ili nove spekulativne arhitekture kada postoji konkretan potvrđeni uzrok. Kada određeni dokaz ili poslovna odluka nedostaje, označiti pogođeni korak i nastaviti nezavisni posao. Širi cleanup sledi popravljenu aktivnu vezu i dokaz potrošača. SB14, proveravanje samog proverivača, prati sve zadatke.

## 5. Vlasništvo nad stanjem i očuvani ugovori

Ovaj odeljak prenosi konkretne ugovore iz dostupne tehničke reference. Linijski brojevi služe nalaženju polazišta na analiziranom izvoru; posle izmene nisu trajna adresa. Serverski metapodaci pripadaju rev7 pregledu i zahtevaju relevantno osveženje pre promene. Detaljni zadaci koji slede koriste ove vlasnike umesto pravljenja paralelnih writera.

### Naručilac

| Stanje/radnja | Merodavni vlasnik | Tačno značenje |
|---|---|---|
| Razgovor i identitet pokušaja | `src/app/(app)/nova.tsx:50–325`; `src/data/aiTurnIntentJournal.ts:4–37` | Prvi send otvara razgovor stabilnim ključem. Journal čuva identifikatore, ne privatni body. PROCESSING, retry i unknown imaju različite dozvoljene nastavke. |
| Generacija i nalog | `src/hooks/useOwnedEditor.ts:27–119`; `src/app/(app)/nova.tsx:34–42,112–118,217–224` | Kasni callback ne stiče ovlašćenje ponovnim povratkom na isti account ID; bitni su i revision/fokus/generacija. |
| Spremnost završne kartice | `src/ui/v2/draftSummary.ts:52–66`; `src/ui/v2/IntakePresentation.tsx:381–399,476–477,511–517`; `src/contracts/needFactsV2.ts:16–19,67–69` | Potpun predlog, mesto/tačke i blokade odlučuju prikaz. Tekstualni `need.category` je obavezan, a skriva se iz korisničke liste nedostajućih činjenica. Nedostatak tog teksta može sakriti karticu bez jasnog sledećeg koraka. Kartica ne čeka neposredno canonical `category_id` niti opšti classification READY. Sistem treba da dovrši svoj podatak. |
| Ulaz u pregled | `src/app/(app)/nova.tsx:539,558–567`; `src/data/aiTaskReviewClientService.ts:354–369` | `canReview` je blaži od uslova završne kartice. Prepare upisuje zamrznuti review; još ne prihvata i ne objavljuje Need. Neposlat tekst ne postaje deo pregleda. |
| Prihvat/privatni nacrt/objava | `src/app/(app)/pregled-zadatka.tsx:119–340`; `src/data/aiTaskReviewClientService.ts:127–268,297–405` | `canAccept`, classificationState i geografska spremnost su odvojeni. SaveDraft/Publish koriste isti review/accept digest; samo Publish nastavlja evaluate/publish. Potvrđeni PUBLISHED receipt i dozvoljen javni readback istog Need-a/revizije zatvaraju uspeh prema §3.6.1; podudaranje ID-ja samo nije dovoljno. |
| Razgovorna mapa | `src/ui/location/ConversationPointAsk.tsx:165–224` | Potvrda svakog pina odmah ide na server uz očekivanu reviziju; START može biti sačuvan dok END još nedostaje. |
| Mapa u pregledu | `src/ui/location/NeedLocationForm.tsx:63–104,139–145`; `src/app/(app)/pregled-zadatka.tsx:302–316` | Pojedinačna potvrda je lokalna; „Primeni potvrđene tačke” priprema novi review. Povratak bez primene ne znači sačuvan skup. Ta dva map toka ne mogu se zameniti bez očuvanja ovog značenja. |

Nema parcijalnih kartica u aktivnom razgovoru: to je postojeće route pravilo. Direktni test ili designLab scene sa karticom ne menjaju taj ugovor. Sačuvan neposlat tekst pri Back/refocus odnosi se na zadržanu montiranu rutu; nije obećanje da svaki znak preživljava gašenje procesa. [P01, P06]

Deadline prepare proširenje ostaje uslovna kompatibilnost: `src/data/aiTaskReviewClientService.ts:352,359–362` bira posebne `rpc_prepare_ai_task_review_deadline` / `rpc_prepare_ai_task_review_deadline_taxonomy` samo kada je javni build flag doslovno `true`. Read-only provera iz rev7 nije našla ta dva RPC-a, a pregledani tracked build/config i audit runtime nisu pokazali uključenu opciju. To je gate pre budućeg uključivanja, ne dokaz da običan sadašnji prepare endpoint nedostaje; efektivni flag starog APK/OTA nije time očitan. [P04, P06]

### Izvršilac

| Stanje/radnja | Merodavni vlasnik | Tačno značenje |
|---|---|---|
| Tema i ispravka | `src/app/(app)/profil/razgovor.tsx:32–52,212–225,359–363,411–424` | Promena teme sama ne šalje poruku i ne pravi novi razgovor. Ispravka vraća u isti razgovor. |
| Turn/readback | Ista ruta `:96–126,170–189,227–247`; `src/data/workerAiClientService.ts` | Stabilan identitet, readback i zaštita novijeg neposlatog unosa od kasnog odgovora. |
| Priprema i Save | Ruta `:249–292,354–379`; `src/data/workerAiClientService.ts:220–225,292–317`; `rpc_save_worker_ai_review` | Svež potpisani review iste revizije sadrži izbor activate; promena izbora traži odgovarajući novi review. Save i tražena aktivacija su atomski, a activate=true traži ACTIVE receipt prema §3.6.2. Nije obavezan prethodni zaseban DRAFT Save. |
| `activate=false` | `src/data/workerAiClientService.ts:220–225` | Čuvanje bez zahteva za aktivacijom; ne deaktivira već ACTIVE profil. Zato ACTIVE rezultat u tom slučaju nije sam po sebi greška. |
| Classification READY | `src/data/workerAiClientService.ts:134–198`; `src/ui/workerProfile/WorkerAiPresentation.tsx:154–183` | Kandidati i mode parovi su pripremljeni za review. To još nije Save, admission, binding ili matching autoritet. |
| Pending nova usluga | Review + outbox/binding sloj | Nova promena ne dobija autoritet unapred. Nije automatski dokaz da sve ranije potvrđene usluge prestaju da rade. |
| Područja | `src/contracts/workerAreas.ts:1–33`; worker Edge `:202–203,503–515` | Do pet CITY/RADIUS ili jedno COUNTRY područje. RADIUS zahteva eksplicitnu kilometražu od centra mesta. `areaRequests` se razrešava na serveru; nezavisna jasna izmena ne treba da nestane zbog neuspešnog geokodiranja. |

### Semantički i trajni autoritet

Predlog modela i capture imaju `authority:NONE`. Za postojeći posao koristi se stvarni ID iz kataloga; za novu kategoriju SQL writer pravi zapis i vraća ID preko `INSERT … RETURNING`, a model ne izmišlja trajni UUID. Potpisani review, korisnički Save/Accept, admission receipt i reviziono vezivanje imaju različite uloge. Zadržati account/revision/digest ograde, idempotentnost, zaštitu od kasnog odgovora i odvojenu saglasnost za način rada. Relevantni vlasnici su `supabase/migrations/20261021104455_closure_taxonomy_archive_copy_coverage.sql:717–1021,1024–1317,1318–1471`, `supabase/functions/_shared/taxonomyPostSaveWorker.mjs:25–76` i oba signed review klijenta. [P04, N04, N05]

### Tekuće serverske granice koje treba sačuvati i dovršiti

**Pristup i sesija.** Analiza rev7 ponovo potvrđuje F21. Široki table SELECT nad needs ne poništavaju uži column grantovi; row policy i column/table grant imaju različite uloge. Dve rls_private funkcije — `need_participant_can_read(uuid)` i `p6_discovery_test_world_accounts()` — potrebne su za sadašnje politike, sa authenticated USAGE/EXECUTE i bez anon/service pristupa. Private šema nema običan anon/auth table pristup. Authenticator `pgrst.db_pre_request=public.rpc_closure_api_guard` je potvrđen u rev7 pregledu; taj hook se odnosi na Data API, ne automatski na Storage/Realtime. Efektivan hook nije dokaz završene erasure mogućnosti.

**Prava za sužavanje.** Postgres/public default ACL automatski daje široke table/function/sequence grantove. Od public tabela, 17 ima bar jednu anon, a 19 bar jednu authenticated TRUNCATE/TRIGGER/REFERENCES dozvolu. Ovo nije dokaz udaljenog SQL/DDL execution puta ili demonstriranog napada. Urediti i budući default i konkretne postojeće grantove, sa namerno javnim `rpc_get_legal_bundle()` i potrebnim authenticated ulazima. Kod legacy delete-a postoje PUBLIC i role EXECUTE; samo anon revoke ne zatvara PUBLIC grant.

**Auth i PHONE.** Advisor iz rev7 pregleda navodi disabled leaked-password zaštitu; sadašnji password tok je čini relevantnom. JWT/session rotation/MFA/signup/provider/redirect/SMTP/rate-limit management vrednosti nisu ustanovljene. Pročitani `rpc_set_contact_grant`, `rpc_reveal_contact` i `grant_is_ownable` još imaju PHONE put. Zatvoriti novu PHONE saglasnost/reveal prema „Samo poruke”, uz istorijsku revokaciju i receipt kompatibilnost. EXACT_LOCATION, phone OTP prijava i slobodan tekst poruke su različiti ugovori.

**Storage.** Sva tri bucketa su private: profile-media 5 MiB, agreement-voice 4 MiB i data-export-artifacts 8 MiB, sa pregledanim MIME ograničenjima. Owner-prefix politike, restrictive v5/voice zabrane, account-open granica i Edge/SQL vlasništvo deluju zajedno. Čuvaju se immutable server putanja, hash/veličina, generation/lease, jednom priznata dispatch namera i pozitivan readback; unknown upload nije dovoljan razlog za drugi POST ili brisanje journal-a. SB04/SB05 ostaju ciljane klijentske popravke oporavka.

**Realtime.** Aplikacijska publikacija sadrži `agreement_invalidations_v1(agreement_id,revision)`; sedam ostalih stavki su servisne realtime particije. Pročitani policy i potrošači `agreementInvalidationService.ts`, `useAgreementIncomingRefresh.ts`, `useConversationInbox.ts` koriste Postgres Changes kao hint za autoritativno ponovno čitanje, sa account/focus/session ogradama. Hint nije poruka ni ovlašćenje za mark-read. Group event/refresh ostaje odvojen nedovršen posao; odsustvo private Broadcast politike nije automatski greška ovog toka.

**Zatvoreni lifecycle.** Safe config/digest upit iz rev7 daje false za retention source, export binding i closure erasure binding. Čuvaju se exact snapshot, owned download, authorization pre vraćanja bajtova, nezavisna potvrda Storage/Auth operacije i finalizacija tek po važećim rezultatima. Šest DEV tabela bez PK ostaje u sadašnjim lifecycle zavisnostima. Popraviti projektore/kopije/inventare i dokazati važeći binding; ne podizati feature gate ili menjati očekivani digest radi prolaza. Z12/Z14/Z16 su istorijski identifikatori dodatne podloge; njihovi zasebni fajlovi nisu u prilozima. Dostupni vlasnici i uslovi uneti su u ovaj plan.

## 6. Izvršni zadaci R01–R12

Svi zadaci su deo istog plana. Status opisanog koda i starih testova nije novo izvršavanje ove revizije. Pre izmene potvrditi konkretan aktuelni sadržaj i relevantni deployment; posle izmene upisati stvarni rezultat u odeljak 11. Tačno pročitane zajedničke CI komande su u odeljku 8.3. Puni Z09 je priložen: per-R predložene komande, preduslove i granice čitati u `dokazi/namena_i_testovi/intent_review.json` (`test_matrix.work_items`, `test_command_review`). One nisu izvršene ovom revizijom; pre upotrebe proveriti cilj i fixture preduslove.

### R01 — Privatnost čitanja, stvarne dozvole i isporučeni ugovor
<!-- EXECUTION-UPDATE-BEGIN: r01-20261028 -->

**Izvršni status 28.10.2026:** `IN_PROGRESS`; lokalni kandidat `1959064` je `IMPLEMENTED` i `VERIFIED` samo u ograničenom SQL modelu. Novi read-only bootstrap capture `82ff498` izvršen je na DEV PostgreSQL 17.6; svih 680 aplikacionih funkcija zadržava REV10 telo i proverene ACL/security atribute. To nije puna schema parity provera. F21 nije zatvoren: stvarni Auth/PostgREST, puna tekuća šema i kompatibilnost podržanih native/OTA klijenata još nisu dokazani; DEV nije menjan. Tačan obuhvat i nastavak su u [11.2a](#112a-aktuelni-izvršni-status--28102026).

<!-- EXECUTION-UPDATE-END: r01-20261028 -->

#### Problem, cilj i granica dokaza

**Ulazni nalazi: F21 i identitet isporuke iz F14.** Analizirani DEV presek ima `authenticated` table-level `SELECT` nad `public.needs`. Taj širi grant poništava nameru ranijeg javnog kolonskog skupa: na redovima koje RLS dopušta mogu se tražiti i `requester_account_id`, `remaining_search_closed_by_account_id` i `remaining_search_close_reason`. Uži kolonski grantovi ne oduzimaju pravo dobijeno nad celom tabelom. Bezbedna projekcija u `rpc_read_task` ne štiti zaseban direktni table API.

Dokumentovani put odnosi se na ne-vlasnikov PUBLISHED/SELECTION red u istom TEST/REAL svetu, uz otvoren nalog pozivaoca. `needs_public_discovery` i restrictive `v5_closed_account_visibility` imaju različite uloge. Primer privatnog razloga jeste SELECTION sa zatvorenom preostalom pretragom. ACTIVE i istorijski nejavni redovi proveravaju se po svojim owner/participant politikama. Prethodni audit nije čitao stvarne tuđe poslovne redove i nije dokazao anonimnu, cross-world ili stvarnu eksfiltraciju; ovu promenu treba dokazati sintetičkim nalozima.

**Cilj:** javno čitanje otkriva samo nameravani javni skup; dozvoljeni sopstveni i participant prikazi nastavljaju da rade. Paralelno nastaje tačna tabela trenutno podržanih klijent/server ugovora za naredne zadatke. Ovde navedene popravke i provere tek treba izvršiti.

#### Postojeći vlasnici i konkretni ulazi

| Vlasnik | Uloga u promeni |
|---|---|
| `supabase/migrations/20261023210000_matching_work_areas_and_public_grants.sql` | Dokumentovani izvor ponovo dodatog table SELECT-a, red 6; širi `service_role` grant nad javnim rutinama na redu 12 proverava se zasebno. Primenjeni fajl se ne prepravlja kao zamena za novu migraciju. |
| `public.needs`, `needs_public_discovery`, `v5_closed_account_visibility` | Stvarna table/column prava, vidljivost po svetu i zatvorenom nalogu. Pregledati sve sadašnje politike i efektivna prava, uključujući nasleđivanje. |
| `rls_private.need_participant_can_read(uuid)`, `rls_private.p6_discovery_test_world_accounts()` | Pomoćnici sadašnjih politika. Analizirani ugovor ima authenticated USAGE/EXECUTE; ne uklanjati potrebna prava zajedno sa preširokim javnim pristupom. |
| `public.rpc_closure_api_guard`, authenticator `pgrst.db_pre_request` | Potvrđeni Data API hook; ne pretpostaviti da isti hook sam štiti Storage i Realtime. |
| `rpc_read_task`, `rpc_list_my_tasks`, `rpc_list_my_needs_page`, `rpc_discovery_v1` i njihovi invoker/helper lanci | Čitači kojima treba očuvati dozvoljeni javni ili sopstveni rezultat. |
| `src/data/needClientService.ts`, `src/data/ownTasksPage.ts`, `src/data/discoveryV1ClientTransport.ts`, `src/data/supabaseIzvor.ts` | Stvarni klijentski potrošači odgovora. Proveriti pozive i projekcije pre izmene prava. |
| `rpc_close_remaining_search` | Ostaje owner-authorized radnja sa postojećim Dogovorom i delimično izabranim kapacitetom; čuvati prihvaćene statuse PUBLISHED/SELECTION/ACTIVE i upis razloga/actor-a/vremena bez proizvoljne promene statusa. |
| Sadašnji closure schema/source/certificate vlasnici | Promena dozvola može uticati na njihove dokaze. Obnoviti dokaz sadržajno; ne menjati očekivani digest radi prolaza. |

#### Redosled rada i očuvane granice

1. Osvežiti branch/HEAD, stvarna tela i ACL relevantnih funkcija, sve `needs` politike, invoker čitače i owner helpere. Razlikovati zabeleženu primenu migracije, rekonstrukciju statements, bajtnu jednakost izvora i sadašnje efektivno pravo. Identitet u ledger-u sam ne dokazuje poslednji sadržaj funkcije ili grant-a.
2. Napraviti jednu eksplicitnu javnu kolonsku/projekcionu granicu i tačan dozvoljeni put do sopstvenih privatnih podataka. Pripremiti usku novu migraciju; ne izvršavati slepi REVOKE, stari PKG045b ili ceo P6 replayer. Promena mora očuvati RLS svet, vlasništvo, postojeće privatne šeme i closure uslove.
3. Proveriti postojeća i buduća prava. Analizirani default ACL daje široke table/function/sequence grantove; 17 public tabela ima bar jednu anon, a 19 bar jednu authenticated TRUNCATE/TRIGGER/REFERENCES dozvolu. To nije demonstriran udaljeni SQL/DDL napad, ali zahteva namerno sužavanje gde pravo nema potrošača. Sačuvati namerno javni `rpc_get_legal_bundle()` i potrebne authenticated ulaze. PUBLIC EXECUTE proveravati odvojeno: samo anon revoke ne zatvara PUBLIC pravo.
4. Proveriti `service_role` proširenja po funkciji. Dodat service grant nije sam po sebi dokaz javnog anon/auth pristupa; stari strogi ACL pinovi ipak mogu više ne odgovarati. Uskladiti verifikatore sa stvarnim dozvoljenim ugovorom, bez slabljenja poslovnog guard-a.
5. Pre isporuke utvrditi minimalnu bezbednu podržanu verziju klijenta. Privatnost se ne odlaže zato što stari klijent zahteva preširok grant. Postojeći native i OTA klijenti dobijaju jasnu kompatibilnost ili bezbedan kontrolisan izlaz; UI skrivanje nije zaštita.
6. Sa R10/R11 koordinisati zatvaranje starih PHONE metoda i grantova prema pravilu „Samo poruke”, uz očuvan EXACT_LOCATION. `rpc_set_contact_grant`, `rpc_reveal_contact` i `grant_is_ownable` imaju dokumentovani PHONE put. Phone OTP prijava i slobodan tekst poruke nisu ista funkcija i ne povlače se tom promenom.
7. Auth management konfiguraciju proveriti podržanim pristupom. Leaked-password zaštita u analiziranom preseku nije uključena i relevantna je za postojeći password tok; JWT/session rotation/MFA/signup/provider/redirect/SMTP/rate-limit vrednosti nisu potvrđene. Nedostupnu vrednost označiti kao nepoznatu, bez pretpostavke da je sigurna ili neispravna.

R01 prikuplja stvarnu kombinaciju izvora, SQL-a, Edge-a, zastavica i podržanog klijenta. About ekran pokazuje deklarisanu izvornu oznaku, ne hash celog APK-a ili ekstrahovani OTA JavaScript. Broj verzije i zeleni CI nisu dovoljan dokaz istovetne isporuke. Bezbedne metapodatke zabeležiti; tajne i privatne payload-e ne kopirati u dokaz.

#### Prihvatni dokaz

Minimalni izvršni skup koristi dva sintetička naloga istog sveta i zadatak drugog naloga u PUBLISHED/SELECTION, uključujući privatni razlog zatvorene pretrage. Kroz stvarni Auth/Data API proveriti direktni select, alias, filter, order i wildcard za sva tri privatna polja, kao i normalne javne i sopstvene readere. Proba treba da pokaže i zabranu nedozvoljenog polja i uspeh stvarno dozvoljenog sadržaja; potpuno ugašen API nije uspešna popravka.

Negativne kontrole obuhvataju drugi svet, anoniman ili zatvoren nalog, pogrešnu/isteklu sesiju i nedozvoljen participant pristup. Legitimni vlasnik dobija svoj dozvoljeni prikaz. Proveriti posledice na closure binding, RLS helpere i novu sintetičku tabelu/funkciju koju više ne smeju automatski otvoriti nepoželjni default grantovi.

| Postojeća testna putanja | Šta sačuvati ili dopuniti | Granica postojećeg dokaza |
|---|---|---|
| `supabase/proofs/discovery/p6_http_boundary.mjs` | Rebase na sadašnje vlasnike; kroz lokalni Auth/PostgREST pokriti sva tri polja i sve relevantne oblike čitanja. | Istorijski test je pokrivao direktni requester ID, ne ceo sadašnji skup. |
| `supabase/proofs/discovery/p6_world_boundary_proof.mjs` | Sačuvati SQL role/RLS i javni whitelist; dodati zatvorenog viewer-a i povezati sa HTTP granicom. | Istorijski SQL test svih tri granta nije novi Auth/HTTP prolaz. |
| `src/data/__tests__/build-identity.test.tsx` | Sačuvati dozvoljena javna identity polja i embedded/OTA prikaz. | Ne potvrđuje koji je APK/OTA stvarno instaliran niti da je kompatibilan sa živim SQL-om. |

**Izlaz:** proverena privatnosna migracija, očuvani legitimni čitači, tačni podržani ugovori i izvršen pozitivan/negativan dokaz. F21 ostaje otvoren dok se zabrana ne dokaže na stvarnoj autorizacionoj granici.

### R02 — Discovery, mapa, filteri i istinito stanje greške
<!-- EXECUTION-UPDATE-BEGIN: r02-20261028 -->

**Izvršni status 28.10.2026:** `IN_PROGRESS`; F17 (`264d12d`) i sve tri konkretne SB11 klijentske popravke — PLACES nastavak (`6f349ee`), recent-search retry (`117a143`), fit invalidation (`e878667`) — imaju lokalni i udaljeni CI dokaz. F16 klijentsko razdvajanje PAGE/MAP, sopstveni MAP retry i oporavak selekcije (`f831591`) implementirani su i lokalno provereni kroz 503 različita testa u 11 suite-ova i TypeScript. Ceo novi kod i plan `6be13b0` prošli su GitHub CI `40652955784`: **623 suite-a / 14.253 testa / 3 snapshot-a**, uz sve ostale workflow provere. F15 i uređajski deo F16 ostaju otvoreni; nije izvedena server/native potvrda niti isporuka aplikacije. Tačan obuhvat i nastavak su u [11.2a](#112a-aktuelni-izvršni-status--28102026).

<!-- EXECUTION-UPDATE-END: r02-20261028 -->

#### Problem i cilj

**Ulazni nalazi: F15–F17 i SB11; kompatibilnost cene iz F02.** P6 izvor povezan sa dostavljenim telefonskim prikazom pokreće onsite PAGE pa world-seed MAP, čak i kada PAGE nema redove. Dokumentovani `rpc_discovery_v1` prihvata PAGE i EXACT_PUBLIC, odbija MAP/PLACES sa `P6_MODE_NOT_IMPLEMENTED`/22023 i nema opcione `forMe`/`minBudgetRsd` ključeve u filter whitelist-u. Agregirani logovi potvrđuju nepodržani režim, ali bez request ID-a ne pripadaju dokazano jednom konkretnom telefonu.

Istovremeno jedna MAP greška preliva se u globalni error, uklanja native map renderer i može sakriti 50 uspešno učitanih PAGE redova. Početni neuspeh i Retry stvaraju različite oblike ekrana jer prvi ne commit-uje snapshot, a Retry ga kroz execute/finally/commit objavljuje i pri neuspehu. Na ograničenom HALF panelu nastaje veliki error blok delimično prekriven donjom navigacijom. Nova legacy dijagnostika ima odvojen kvar: boolean error pretvara u tekst `true`.

**Cilj:** svaka ponuđena mogućnost liste, mape, mesta i filtera radi sa stvarnim serverom. Delimičan neuspeh ne ukida upotrebljiv rezultat. Korisnik vidi tačno šta je uspelo, šta nije i koju radnju može bezbedno da ponovi.

#### Vlasnici

| Sloj | Pune putanje i simboli |
|---|---|
| Ruta i ugovor | `src/app/(app)/zadaci.tsx`; `src/data/discoveryV1Contract.ts`; `src/data/discoveryV1MarketplaceAdapter.ts`; `src/data/discoveryV1ScreenSession.ts`; `src/data/discoveryV1Owner.ts`; `src/data/discoveryV1ClientTransport.ts`. |
| Pretraga, recent i fit | `src/data/discoveryV1SearchOwner.ts`; `src/ui/v2/discovery/recentSearches.ts`; `src/ui/v2/detail/useTaskFit.ts`. |
| Prikaz i geometrija | `src/ui/v2/discovery/DiscoveryV1Screen.tsx`; `src/ui/v2/DiscoveryPresentation.tsx`; `src/ui/v2/discovery/DiscoveryListState.tsx`; `src/ui/v2/discovery/DiscoveryListSheet.tsx`; `src/ui/system/StateView.tsx`; `src/ui/v2/discovery/mapControls.ts`; `src/app/(app)/_layout.tsx`. |
| Legacy čitanje i greška | `src/data/supabaseIzvor.ts`; `src/data/focusedResource.ts`; postojeći potrošači `DiscoveryPresentation`. |
| Server | `public.rpc_discovery_v1`; odvojeni legacy `public.rpc_list_open_tasks_v3`; `supabase/migrations/20261025000000_baseline_core_client_rpcs.sql`, posebno discovery telo na redovima 71–236 analiziranog izvora. |

#### Redosled popravke ugovora

1. Posle R01 potvrditi aktivnu putanju, deklarisane i efektivne zastavice podržanih klijenata, request/response ugovor i stvarno migrirano telo. Analizirani stari preview/production izvor uključuje P6, sadašnji EAS P6 flag je 0; efektivni OTA bundle nije ekstrahovan. Ne izjednačiti promenu zastavice sa popravljenim P6 proizvodom.
2. Uskladiti PAGE/MAP/PLACES/EXACT_PUBLIC sa mogućnostima koje izdanje stvarno nudi. Obuhvatiti filter whitelist, `forMe`, `minBudgetRsd`, cursor, page ordering, map seed/viewport, exact landing i account/world/revision granice. Ne primenjivati stari kandidat ili menjati privilegije da bi se zaobišao nepodržani režim.
3. Proveriti starog podržanog i ciljnog novog klijenta protiv iste nameravane serverske isporuke. Stari decoder prihvata TOTAL/PER_PERSON/null, ali odbija HOURLY; jedna takva stavka ruši celu PAGE poruku. Novi decoder prihvata HOURLY. Izabrati eksplicitnu strategiju kompatibilnosti, bez prećutnog izbacivanja reda, filtera ili promene satnice u ukupnu cenu. U dostavljenim dokazima nije čitan sadržaj korisnikovih živih zadataka, pa HOURLY nije potvrđen uzrok prikazanog kvara.
4. REMOTE prikaz ne šalje fizički MAP zahtev koji nema korisnički smisao. Handoff/predaja je odvojen potvrđeni podatak. Ne izmišljati fizičku geografiju da bi se zadovoljio stari endpoint.
5. Sačuvati otkazivanje, trenutni upit i njegovu generaciju. Zastareo odgovor ne sme zameniti nov filter, lokaciju, nalog ili tekst pretrage. Tačan razlog odbijanja i tačan identitet pokušaja moraju preživeti put od transporta do potrebne dijagnostike.

| Grana kompatibilnosti | Obavezna provera starog podržanog i novog klijenta |
|---|---|
| PAGE/MAP/PLACES/EXACT_PUBLIC | Prazno/neprazno, nastavak, mapiranje, tačan javni rezultat i opravdano odbijanje; stvarni izlaz prolazi odgovarajući pravi decoder. |
| `forMe` i minimalni budžet | Server prihvata definisani oblik; UI i adapter ne šalju ili tiho uklanjaju drugačije ključeve. |
| HOURLY i mešovita strana | Eksplicitno rešena podrška ceni i celoj poruci; neusaglašen format ne postaje neobjašnjeni gubitak svih redova. |
| REMOTE | Nema nepotrebnog fizičkog MAP zahteva; sačuvano značenje usluge i zasebne predaje. |
| Exact javno odredište | Autoritativan cilj van prve strane i van početnog viewport-a ostaje dostupan samo dozvoljenoj public projekciji. |

#### Legacy put ostaje zasebno proverena mogućnost

`zadaci.tsx` preko `supabaseIzvor.ts` u analiziranom legacy toku čita celu otvorenu kolekciju u stranicama od 200, najviše 25 strana, sa ukupnim route rokom 15 sekundi, `p_bbox=null` i `p_filters={}`. Jedna nevažeća stavka ili neuspešna strana može odbiti celu kolekciju. Opcioni profil/urgency enrichment ima zasebno degradiranje i nije dokazano uzrok greške. P6 „Za mene” se ovim putem ne dobija.

Zato flag 0 nije kompatibilna zamena za sve P6 funkcije ili skaliranje. Ako legacy put ostaje podržan, njegov obim, degradiranje, dijagnostika i granice opterećenja moraju biti jasni. Ako se povlači, prvo se dokazuje ciljni ugovor i proveravaju podržani stari potrošači.

#### Prikaz stanja, geometrija i oporavak

Razdvojiti najmanje PAGE/listu, native podlogu, MAP/pinove, PLACES i preview/tačan cilj. Svaka operacija ima svoj loading/success/failure i dozvoljeni Retry. Još važeće podatke zadržati uz jasan status; rezultat prethodnog filtera ne prikazivati kao odgovor novog upita. Prazan uspešan rezultat nije failure, a neuspešno čitanje nije dokaz nule zadataka.

Dokumentovani `mapShown = where !== 'remote' && !loading && !error` koristi isti globalni error da ukloni mapu i da kroz `compact=false` izabere preveliku poruku. Popraviti tu vezu kod odgovarajućeg vlasnika. Ne menjati globalni `StateView` svim potrošačima bez procene. Veliki blok ima ilustraciju 96 i veće razmake, compact 48 i manje razmake; izbor mora odgovarati stvarnom raspoloživom panelu, ne samo tome da li je renderer trenutno montiran.

HALF je početno loading/error stanje samo kada nema sačuvane `view.sheet` pozicije; sačuvani položaj ima prednost. Automatsko podešavanje visine se tokom greške preskače. End padding omogućava kraj skrola, ali ne garantuje odmah vidljivu radnju u HALF. Donja navigacija, safe area, veći tekst i tastatura moraju biti uračunati. Mala refresh radnja već postoji; problem nije nepostojanje svake radnje nego nejasan i delimično zaklonjen glavni prikaz. Lokacijsko dugme ne sme samo spustiti sheet na PEEK i skloniti objašnjenje dok mape nema.

Za F17 sačuvati bezbedan tip razloga odvojeno od booleana za prikaz. `focusedResource` odbacuje exception i čuva `error:boolean`; `String(resource.error)` zato za auth, permission, contract, mrežu i deadline daje `true`. UI treba kratak odgovarajući tekst i smislen retry; privatni SQL/provider sadržaj ostaje van korisničke poruke. Ovaj nalaz je odvojen od stare P6 slike koja taj prop nije koristila.

SB11 zatvoriti kod njegovih vlasnika: PLACES decode exception mora završiti busy stanje; recent-search nalog označiti učitanim tek posle prihvaćenog read-a ili omogućiti ponovljiv oporavak; fit cache ključ/invalidacija obuhvata relevantne promene revizije, kraja termina, pina i mode-a. Običan detail refresh već šalje null, pa problem nije svaki refresh. Ne uvoditi slučajan globalni cache reset kao zamenu za ispravan ključ.

Sačuvati MapLibre/OpenFreeMap i native/web odgovornosti, scene/focus owner i pin revision. GPS dozvola za „Moja lokacija” nije obavezan uslov svakog prikaza mape. Prazan rezultat sam ne gasi geografiju; native style/render failure proverava se odvojeno od poslovnog RPC-a. Ne pripisivati kvar nedokazanom Google API ključu ili Gemini klasifikaciji.

#### Prihvatni dokaz i postojeće provere

| Scenario | Potreban rezultat |
|---|---|
| Hladan ulaz, pravi PAGE uspeh, kontrolisani MAP failure | Pravi PAGE prolazi decoder; lista i filteri ostaju dostupni; greška pripada MAP operaciji; poslednji izbor korisnika ostaje. |
| Isti neuspeh kroz Retry | Stanje je razumljivo i dosledno i bez početnog snapshot-a i posle njegovog commit-a; nema prelaska na lažni prazni uspeh. |
| PAGE i MAP oba ne uspeju | Jasno nepoznat rezultat i dozvoljene ponovne provere; nema izmišljenog broja 0. |
| MAP se oporavi posle delimičnog uspeha | Podloga/pinovi se usklade sa važećim upitom bez resetovanja filtera i korisničkog sheet izbora. |
| PLACES decode failure, recent read failure, promenjen fit input | Busy se završi, oporavak je ponovljiv, stara fit odluka ne preživi relevantnu izmenu. |
| Mali telefon, veliki font, HALF/FULL/PEEK, povratak na tab | Objašnjenje i radnja su vidljivi i dostupni; navigacija i tastatura ih ne zaklanjaju; zasebna native map greška ne ruši dozvoljenu listu. |
| Promena naloga ili upita, odgovori obrnutim redom | Stari rezultat ne dobija novi autoritet; cancel i focus/generation granice ostaju. |

| Postojeća testna putanja | Odluka | Granica koju treba proširiti |
|---|---|---|
| `src/data/__tests__/discovery-v1-client-transport.test.ts` | Sačuvati tačan RPC, abort, 15-sekundni rok i kodove greške. | Mock ne dokazuje MAP/PLACES/filter podršku objavljenog servera. |
| `src/data/__tests__/discovery-v1-route-lifecycle.test.tsx` | Sačuvati stvarnu rutu/coordinator i reprodukcioni ulaz; posle popravke promeniti global-error očekivanje u očuvanu listu sa posebnom MAP greškom. | Bridge/presentation zamene ne dokazuju native geometriju. |
| `src/data/__tests__/discovery-presentation.test.tsx` | Sačuvati prazni P6, list/pill/nav raspored i relevantne layout slučajeve. | Fiksne mere i padding assertions nisu MapLibre ili telefon. |

Ranije izolovane tri route karakterizacije, pet boolean slučajeva i osam stari/novi decoder slučajeva opisuju reprodukovani kvar; nisu nova provera ove popravke. Završni dokaz vezati za tačan source/SQL/Edge/flags/APK/OTA i uređaj. Za performanse koristiti aktuelni reader, javne kolone i područja, hladne/tople i ponavljane/različite upite, otkaze i ceo odgovor/cursor. Klijentski rok 15 sekundi nije cilj normalnog čekanja; stari 90-sekundni prozor benchmark posmatranja nije prihvatna UX granica.

**Izlaz:** usklađen Discovery ugovor za podržane klijente, razdvojeni delimični ishodi, razumljiva dijagnostika, završiv search recovery i stvarni native dokaz prikaza.

### R03 — Moje potrebe, pet scope-ova i stabilno straničenje

#### Problem i cilj

**Ulazni nalaz: F01.** Klijent očekuje ALL/ACTIVE/DRAFTS/HISTORY/WAITING, svih pet brojača na prvoj strani i snake_case task dokument. Analizirani `rpc_list_my_needs_page` prihvata samo ALL/ACTIVE/HISTORY, uključuje DRAFT u ACTIVE, nema `counts` i vraća camelCase. Zato pada i prazna prva strana zbog brojača; dodavanje samo counts ne rešava nepraznu stranu i nastavak. Tracked preview/production uključuju paged put, ali to nije čitanje zastavice svakog instaliranog APK-a.

**Cilj:** sopstvena lista, njeni filteri, brojači i detalji predstavljaju isti poslovni skup kroz prvu i naredne strane. Ovo je zaseban reader i kvar od javnog Discovery taba.

#### Vlasnici i redosled rada

Primarni vlasnici su `src/data/ownTasksPage.ts`, `src/data/needClientService.ts`, ruta `src/app/(app)/potrebe.tsx`, `public.rpc_list_my_needs_page`, postojeći `own_task_counts` helper i `supabase/migrations/20261025000000_baseline_core_client_rpcs.sql`. Stvarni izlaz treba provesti kroz `ownTasksPage`, `mapNeed` i `readPublicNeedDetail`; ručno sklopljen fixture koji već liči na željeni JSON ne dokazuje SQL ugovor.

1. Ponovo pročitati aktuelni javni reader, count helper, task projekciju, sva upotrebljena pravila scope-a, ordering/cursor i dozvole posle R01.
2. Zadržati jednu poslovnu podelu pet scope-ova i nameravanu count particiju. DRAFT se ne sme slučajno brojati/pojavljivati kao ACTIVE zbog starijeg reader-a. Brojači pripadaju prvoj strani; nastavak ih ne prepisuje drugim skupom.
3. Pripremiti usku novu migraciju za preostali neusaglašeni javni ugovor, uz očuvan helper i task detalj. U analiziranom stanju `own_task_counts` već sadrži EX04A telo, javni paged reader je stariji. Stari EX04A apply očekuje oba prethodna tela i zato nije pravilna gotova popravka.
4. Očuvati keyset, cursor validaciju, stabilan red, dedupe, focus/account/generation granice i ponašanje nakon objave/izmene. Refresh ili nova strana ne smeju izbrisati dobar skup zbog odgovora starog naloga/upita. Pravila važenja brojača tokom promene podataka dokumentovati kod postojećeg vlasnika.
5. Proveriti i praznu i nepraznu prvu stranu svakog scope-a, sledeću stranu i kraj. Nepoznat scope ili pogrešan cursor se odbijaju; uspešna prazna lista se prihvata. Tuđ nalog ne dobija tuđe sopstvene zadatke.

#### Svih 12 baseline RPC-jeva: šta menjati i šta očuvati

Ovo je obavezna granica R02/R03, jer se oba nesklada nalaze u istoj istorijskoj migraciji. Dva utvrđena nesklada nisu dokaz da svih 12 funkcija treba vratiti ili prepisati. U analiziranom preseku devet drugih ugovora je statički kompatibilno, a jednom nedostaje opcioni `displayName`. Telo funkcije samo ne obuhvata sve ACL-ove, pomoćne tabele, triggere ili poslovne podatke. Nijedan ovde navedeni stari writer nije zbog ove tabele ponovo izvršen.

| RPC i redovi analizirane baseline migracije | Aktivni potrošači | Očuvani ugovor i odluka |
|---|---|---|
| `rpc_discovery_v1`, 71–236 | `src/data/discoveryV1ClientTransport.ts`, `src/data/discoveryV1Owner.ts`, `src/data/discoveryV1MarketplaceAdapter.ts` | R02: uskladiti ponuđene PAGE/MAP/PLACES/EXACT_PUBLIC/filter mogućnosti; ne povlačiti kompatibilne funkcije u nastavku. |
| `rpc_get_worker_execution_modes`, 241–258 | `src/data/workerExecutionModeClientService.ts` | Očuvati profileId/confirmed/modes/timestamp. Zbirni mode receipt nije entitlement niti per-service potpuna ponuda. |
| `rpc_get_my_task_relations`, 262–315 | `src/data/supabaseIzvor.ts`; `src/data/taskRelation.ts` | Očuvati 1–100 ID, OWNER/APPLIED i overlay. Odsutni odnos postaje NONE tek posle uspešnog čitanja. |
| `rpc_read_safety_target`, 322–347 | `src/data/safetyClientService.ts` | Osnovni ugovor je kompatibilan. Opcioni displayName može biti null; analizirani tracked release flag ga ne zahteva. Nije dokazan aktivni blokirajući kvar. |
| `rpc_read_task`, 354–408 | `src/data/needClientService.ts`; `src/data/supabaseIzvor.ts` | Očuvati snake_case detalj sa schedule/topology/requirements/capacity/price_basis i dozvoljenim poljima. Koristiti isti poslovni oblik za R03. |
| `rpc_list_my_tasks`, 415–428 | `src/data/needClientService.ts` | Očuvati kompatibilnu listu `rpc_read_task` dokumenata sopstvenog naloga; ona je odvojena od paged reader-a. |
| `rpc_list_my_needs_page`, 435–488 | `src/data/ownTasksPage.ts`; `src/data/needClientService.ts` | R03: popraviti pet scope-ova, counts i task wire format uz već postojeći noviji helper. |
| `rpc_get_my_agreement_review_v2`, 496–516 | `src/data/reviewCommentsClientService.ts`; `src/data/reviewsClientService.ts` | Očuvati context, tag catalog, comment policy/max 500 i sopstveni komentar. |
| `rpc_submit_agreement_review_v2`, 523–587 | `src/data/reviewCommentsClientService.ts` | Očuvati argumente/receipt, request ID i hash-replay zaštitu. Pročitani writer nije izvršni PASS. |
| `rpc_list_review_comments_v1`, 594–651 | `src/data/reviewCommentsClientService.ts` | Očuvati items/author/cursor/hasMore; null je dozvoljeno nedostupno stanje. |
| `rpc_mark_agreement_messages_read`, 658–683 | `src/data/supabaseIzvor.ts` | Očuvati integer receipt i novije izuzimanje `group_message_id`: direct chat ne zatvara grupna obaveštenja. |
| `rpc_list_my_agreements_page`, 690–777 | `src/data/agreementClientService.ts` | Očuvati keyset/currentVersion/terms/ratingDue i noviji phone-consent guard. Null workspace-only akcije/ID u listi nisu nova regresija. |

Ne prepravljati primenjenu baseline istoriju niti vraćati ceo stari candidate paket kao rollback. Istorijski EX04 dokaz ima mešavinu nepromenjenih i promenjenih tela i dodatni ACL drift; test mora krenuti od aktuelnog helper-a i čitača.

#### Minimalni pozitivan, negativan i delimičan dokaz

Za svaki od pet scope-ova izvršiti stvarni važeći SQL/API read i propustiti rezultat kroz pravi decoder: prazna prva, neprazna prva, nastavak i završna strana. Uporediti counts i članstvo sa nameravanim pravilom; proveriti promenu filtera, refresh nakon objave, dedupe i stabilnost poslednjeg prihvaćenog sadržaja. Kasnija strana ne menja counts prve. Tuđ nalog, nevažeći scope i pogrešan cursor ostaju odbijeni.

Delimični/mrežni neuspeh naredne strane ne sme se preimenovati u uspešan kraj liste, a kasni odgovor prethodnog upita ne dodaje redove novom. Odsutnost odnosa, nedostupan komentar i dopuštena null polja čuvaju svoje već navedene posebne ugovore.

| Postojeća testna putanja | Rad | Ograničenje |
|---|---|---|
| `src/data/__tests__/own-tasks-page-client.test.ts` | Sačuvati pravi decoder/mapNeed, pet counts i praznu stranu; dodati stvarni izlaz reader-a. | Ručni payload ne otkriva stari camelCase/no-counts server. |
| `src/data/__tests__/own-tasks-pager.test.ts` | Sačuvati focus, cursor, dedupe, kasni/account odgovor i counts samo prve strane. | Ne izvršava SQL reader. |
| `supabase/proofs/ex04/ex04a_proof.mjs` | Rebase namere lokalnog RPC poređenja svih pet scope-ova i outsider/anon kontrola. | Stari apply očekuje staro stanje oba vlasnika; ne izvršavati ga napamet. |

**Izlaz:** jedan ispravan own-tasks ugovor potvrđen stvarnim reader/decoder lancem, uz očuvanih ostalih deset baseline funkcija i zasebno zatvoren Discovery posao.

### R04 — Potpuna klasifikacija, stabilan identitet i potvrđena namera

#### Problem i granica prema R06

**Ulazni nalazi: F04, F05 i F08, uz semantički deo F06.** Ovaj zadatak zatvara značenje rezultata: potpun katalog, verna hijerarhija, isti smisao/isti ID, nova smislena grana, kompletan service–mode–handoff skup i bezbedno povezivanje tog rezultata sa pregledom i čuvanjem. R06 zatvara trajni posao, pokušaje, transport, cache operacije i obračun. Nezavisne izmene istog BG/review vlasnika moraju se integrisati sekvencijalno.

Cilj nije da korisnik upravlja kategorijama. Glavni requester prompt već normalizuje opis u konkretnu uslugu; ne treba tvrditi da postojeći sistem nema semantičku obradu. Potrebno je dovršiti aktivni ugovor i njegova mesta na kojima se ispravan zaključak izgubi.

#### Pune putanje vlasnika i SQL autoriteti

| Oblast | Vlasnici |
|---|---|
| Aktivni BG i postojeće AI strategije | `supabase/functions/_shared/backgroundTaxonomyArchitect.mjs`; `supabase/functions/_shared/classificationGeminiShadow.mjs`; `supabase/functions/_shared/classificationExplorer.mjs`; `supabase/functions/_shared/taxonomyScopedShadow.mjs`. Poslednja dva nisu automatski novi ciljni runtime; proveriti stvarne gate-ove i potrošače. |
| Mode i način izvršenja | `supabase/functions/_shared/serviceExecutionInstruction.mjs`; `supabase/functions/_shared/workerServiceModeContext.mjs`. |
| Foreground/capture | `supabase/functions/uskoci-ai-interview/index.ts`; `supabase/functions/uskoci-worker-interview/index.ts`; `supabase/functions/_shared/taxonomyPostSaveWorker.mjs`. |
| Katalog i hijerarhija | `supabase/migrations/20261019104047_taxonomy_parent_navigation_and_mode_admission.sql`; `supabase/migrations/20261023200000_taxonomy_snapshot_and_turn_hints.sql`; `rpc_taxonomy_query_catalog_service`; `rpc_taxonomy_fetch_snapshot_v1`. |
| Potpisani pregled/capture/binder | `supabase/migrations/20261021104455_closure_taxonomy_archive_copy_coverage.sql`; `supabase/migrations/20261021103732_worker_equipment_retired_signed_policy.sql`; `supabase/migrations/20260913044510_clean_v5_unknown_ai_turn_exit.sql`; postojeći exact/candidate projection, batch writer i `rpc_complete_worker_ai_turn_service`/`rpc_prepare_worker_ai_review_taxonomy`. |
| Upis posle klasifikatora | `supabase/migrations/20261013193000_uskoci_needs_category_sync_trigger.sql`; `supabase/migrations/20261014093000_uskoci_worker_profile_authoritative_capability_sync.sql`; `needs_sync_taxonomy_category_trigger_fn`; worker authoritative capability sync i signed Need binder. |
| Klijentska potvrda i readback | `src/data/workerAiClientService.ts`; `src/data/aiTaskReviewClientService.ts`; `src/app/(app)/profil/razgovor.tsx`; `src/app/(app)/nova.tsx`; `src/app/(app)/pregled-zadatka.tsx`; `src/contracts/needFactsV2.ts`. |

Primarni princip ostaje: model i capture imaju `authority:NONE`. Postojeća kategorija koristi stvarni ID; novi ID nastaje iz validiranog SQL writer-a kroz `INSERT … RETURNING`. Potpisani pregled, korisnički Save/Accept, admission receipt i vezivanje na reviziju obavljaju različite poslove. Account/revision/digest, idempotentnost, kasni odgovor i zasebna saglasnost za mode/handoff ostaju.

#### 1. Potpunost kataloga i verna hijerarhija

Analizirani ROOTS/CHILDREN fallback ima limit 100, ne prati `nextCursor` i završava posle šest serija po 32 roditelja bez dokaza da je red prazan. Nevažeća strana može biti preskočena, a rezultat ipak označen kao full. Kasniji potpun snapshot iste version/fingerprint može vratiti isti raniji parcijalni objekat. Izolovana reprodukcija imala je 202→200 čvorova, isti nepotpun objekat posle punog snapshot-a i mali 1/2 slučaj bez exception-a. NEED helper vraća failure envelope, WORKER helper za HTTP failure baca; test ne sme pretpostaviti iste sve greške oba handler-a.

Loader mora pratiti sve strane do potvrđenog završetka, proveriti ponovljen/nevažeći cursor, preostali red roditelja, svaku neuspelu stranu i konzistentnu version/fingerprint oznaku. Nepotpuno učitavanje ostaje tehnički nedovršeno, ne tvrdnja „usluga ne postoji”. Potpun snapshot sme i mora zameniti parcijalni iste oznake. Uskladiti stvarne limite: postojeća statička granica snapshot-a 4 MiB i handler-a 512 KiB nije rešena time što je sadašnji katalog mali. Strukturni preci bez sopstvenog mode-a moraju ostati u smislenoj hijerarhiji tamo gde ih ugovor dopušta.

Analizirani snapshot sortira po canonical_key/id, dok BG prompt koristi uvlačenje po dužini putanje, label, ID i modes, bez parentId/path/aliasa. Zabeleženo je 73 children-before-parent, 31 podstablo čiji čvorovi nisu uzastopni u spisku i 25 nelisnih čvorova koji nisu prvi u sopstvenom podstablu. To je dokaz nedovoljno označene strukture ulaza, ne dokaz konkretnog pogrešnog modelskog odgovora.

Uvesti kompaktan, jednoznačan input koji čuva `id`, `parentId` ili potpunu putanju, label, relevantne aliase, modes/scope i status lista/pretka, ili dokazano ispravan preorder sa očuvanim odnosima. Svaki postojeći čvor mora biti dostupan sa istim značenjem. Ne koristiti samo abecedni red sa uvlačenjem kao prikaz stabla. Sadašnji agregat 153 established/root-reachable čvora, 120 listova, jedan koren, devet BOTH čvorova, 17 aliasa, dubina pet i najviše 12 sibling čvorova opisuje audit presek, ne budući dozvoljeni maksimum.

#### 2. Postojeća usluga, sinonim i stvarno nova grana

Exact canonical naziv i registrovan alias već imaju deterministički put. Zatvoriti semantički REUSE za smislen neupisan sinonim: requester odluka trenutno nema pun REUSE/categoryId izlaz, a neprihvaćen REUSE daje `SEMANTIC_REUSE_ADMISSION_UNAVAILABLE`. Istom značenju sa istim scope-om ne praviti duplikat, ali blisku drugačiju uslugu ne spajati samo na osnovu slične reči.

SQL podržava CREATE_NEW_BRANCH i višestepeni path; aktivni BG builder proizvodi jedan CREATE_CHILD pod postojećim roditeljem. Bogatiji full-snapshot ugovor već postoji u shared modulu, ali ga dual foreground put zaobilazi. Izabrati i uskladiti postojeću aktivnu putanju na istom semantičkom korpusu, sa tačnošću, ukupnim čekanjem i troškom. Korisnik ne bira interne klase/flag-ove. Prisustvo instrukcije u nepozvanom modulu nije implementirana mogućnost; ne uvoditi treći klasifikator niti slepo vraćati stari režim.

Ukloniti izjednačavanje naziva bez razmaka sa nejasnom uslugom: dokumentovani `taxonomy_risk_triage_v1` daje NEEDS_CLARIFICATION za `Sisanje`, a LOW_RISK_CANDIDATE za `Sisanje kose` bez aktivnih risk pravila. Taj uslov pogađa i EXTEND_MODE postojećeg naziva. Provera stvarnog smisla, scope-a, rizika, duplikata i ID integriteta ostaje; broj reči nije zamena za nju.

#### 3. Ceo BOTH i stvarna saglasnost za način rada

Pre provider odgovora iz korisničke namere izvesti očekivani skup service–mode–handoff parova. `proposals.length>0` ne dokazuje njegovu potpunost. Dokumentovana proba za izričit BOTH vratila je ON_SITE proposal i REMOTE failure, dok je exact projekcija ipak dala READY samo za ON_SITE. Pozitivna kontrola sa oba item-a dala je oba moda. Failure/unresolved ostatak mora preživeti builder, capture i prepare do odluke o završetku.

Isti servis u oba moda zadržava isti canonical ID. Delimičan rezultat ostaje jasno nedovršen; već potvrđeni nezavisni delovi se ne gase bez pravila. Uskladiti foreground pravilo koje dopušta inherentno jasan početni mode nove konkretne usluge sa BG zahtevom za eksplicitno ponuđenim/sačuvanim mode-om. Sačuvani izbor ima prednost; citat USER poruke potvrđuje poreklo, ali sam ne garantuje potpunu saglasnost.

REMOTE uključuje digitalni rad i rad kod izvršioca/radionicu sa potrebnom predajom. Nepomenut handoff nije `{required:false}`. BG handoff predlog ne postaje korisnička saglasnost: sadašnji autoritet je foreground/saved izbor. Uskladiti prompt, izlaz, validator i prepare, uz serversku proveru celovitosti koja ne zavisi od poslušnosti prompta. Ne vraćati dodatni obavezni mode formular.

#### 4. Nepromenjeni smisao kroz novu reviziju pregleda

Worker hint je vezan za ceo `candidate|revision|base_hash`; uspešan turn povećava revision i kada je `patch:{}`. BG trigger radi samo kada tekuća poruka podržava promenu skills/mode/handoff ili pending pitanje. Zato „to je to” može sačuvati identičan kandidat, povećati reviziju 1→2 i ostaviti nula tekućih hintova uz REVIEW_REQUIRED. Stari hint redovi nisu obrisani; njihova veza više ne važi. Continuity fallback za netaknutu sesiju sa revision=0 i precizno sačuvanim potpisanim izborom nije opšte rešenje.

Odvojiti identitet semantičkog ulaza od identiteta korisničkog pregleda. Nepromenjeno značenje može se bezbedno revalidirati i vezati za novu reviziju, dok stvarna promena usluge/mode/handoff zahteva novu obradu. Ne prihvatati stari potpis ili tuđ rezultat bez provere, ne produžavati timeout kao zamenu i ne odbacivati sve semantičke rezultate samo zato što se promenila nepovezana globalna verzija kataloga.

Requester proveriti odvojeno. Njegov source obuhvata činjenice/poruke/turnove, a BG prati uži service/scope/mode/handoff skup. Budžet ili vreme mogu zastareti plan nove grane/moda bez novog BG pokušaja. Existing exact/alias kategorija ipak ima neposredno razrešavanje iz činjenica; nije svaki requester nastavak pokvaren. Semantički kontinuitet treba dokazati preko pravog prepare/Save/binder/readback-a, ne samo izdvojene completion funkcije.

#### 5. Pisci posle klasifikatora i ranije pripremljeni pokušaji

`needs_sync_taxonomy_category_trigger_fn` radi kao BEFORE INSERT OR UPDATE OF category, traži canonical ključ bez alias-a i u živom analiziranom telu za `/` pokušava poslednji naziv putanje. Neprepoznat neprazan tekst može postaviti ID na NULL. Source migracija nema isti slash fallback. Signed Need binder proverava owner/revision/ID konflikt i menja samo `category_id`; ne pokreće UPDATE-OF-category trigger. Rešenje mora obuhvatiti oba pisca i source/live razliku, bez davanja autoriteta tekstu koji pripada pogrešnom roditelju.

Worker sync čuva ID jedinstvenog canonical naziva ili registrovanog alias-a. Neregistrovano preimenovanje može izostaviti postojeću uslugu iz retained skupa i opozvati capability/opt-in. Dodavanje nepoznate usluge uz očuvanu staru ne opoziva sve. Sync ne stvara niti oživljava novi autoritet. Popraviti rename/identity vezu, ali izričito povlačenje usluge mora ostati delotvorno.

Obuhvatiti canonical naziv, registrovan/neupisan sinonim, pogrešnog roditelja sa stvarnim završnim listom, ID-only binder, novo dodavanje uz očuvanu staru uslugu, eksplicitno uklanjanje i zastarelu listu. Dokazati i već READY review, ponovljen isti Save receipt, Save→batch→binder i obrnuti red završavanja, oba moda istog ID-ja i nameran identity konflikt. Novi čisti fixture ne pokriva automatski stariji već pripremljen pokušaj; istorijski cross-mode kandidat sa promenjenim pinovima nije gotova migracija.

#### 6. Očuvati postojeće korisničke i autorizacione granice

Requester završna kartica, `canReview`, classification stanje, prihvat, privatni nacrt i objava nisu isti uslov. Tekst `need.category` je obavezan za karticu i skriven u listi nedostajućih činjenica; sistem mora dovršiti svoj podatak bez neobjašnjivog čekanja, ali to nije nova blanket zabrana svakog Save-a dok category ID/READY ne postoji. Prepare upisuje zamrznut review, još ne objavljuje. SaveDraft/Publish, nastavak postojeće komande i konačni PUBLISHED/ALLOW/javni readback čuvaju ugovor §3.6.1.

Za worker-a READY označava pripremljene candidate/mode parove, ne Save, admission, binding ili matching autoritet. DRAFT ima izbor Save/Save+activate na istom ekranu pregleda, ali activate mora odgovarati potpisanom review-u; čuvanje i tražena aktivacija su atomski prema §3.6.2. `activate=false` ne deaktivira postojeći ACTIVE profil. Pending nova usluga ne proglašava sve ranije potvrđene usluge neaktivnim. Promena teme ne šalje poruku i ne pravi novi razgovor; ispravka se vraća u isti razgovor. Kasni callback ne dobija pravo samo zato što se nalog promenio A→B→A.

#### Prihvatni dokaz i testovi

Dokaz obuhvata potpun/nepotpun katalog i kasniji pun snapshot iste oznake; abecedni ulaz koji nije DFS; svaki roditelj, alias i expected mode; synonym reuse; stvarno novu granu/path; jasan jednočlani naziv; BOTH sa jednim i dva odgovora; radionicu i predaju; izmenu jedne od više usluga; „to je to”/budžet/vreme/pin bez promene usluge; stvarnu promenu semantike; pripremljeni review i replay. Pozitivan ishod mora proći stvarni aktivni handler, signed prepare, korisničku potvrdu, Save, binder i autoritativni readback. Mock model se koristi za kontrolisanu grešku; ograničeni pravi model je zaseban kasniji dokaz kvaliteta.

| Postojeća testna putanja | Šta izvesti/dopuniti | Granica |
|---|---|---|
| `supabase/proofs/ai/background_taxonomy_scope.test.mjs` | Sačuvati stvarni BG builder i scope/identitet; dodati neupisan sinonim, novu granu i vezu sa signed prepare/Save/binder-om. | Kontrolisani transport sam ne zatvara ceo tok. |
| `supabase/proofs/dynamic_taxonomy/classification-gemini-shadow.test.mjs` | Sačuvati parser/planner i service/mode ugovor. | Druga putanja nije dokaz da aktivni dual handler koristi isti ugovor. |
| `src/data/__tests__/worker-ai-client.test.ts` | Sačuvati signed decoder, oba moda, child/main i stari/novi RPC izbor; povezati stvarni server rezultat. | Ručno sastavljen review ne dokazuje SQL koji ga stvara. |
| `supabase/proofs/dynamic_taxonomy/gemini-real-provider-smoke.mjs` | Zahtevati obavezno prisustvo i validnost `classificationShadowJson` pre PASS-a. | Provera samo ako polje postoji može propustiti nedostajući izlaz; wire smoke nije cela poslovna validacija. |
| `supabase/proofs/ai/classification-full-catalog-edge.test.mjs` | Aktivirati pravu relevantnu handler granu u potpuno presretnutom fixture-u, dodati potpunost/hijerarhiju/verziju. | Postojeći `https://db.invalid` fixture ne uključuje exact-DEV dual selector; shadow/direct PASS nije BG loader dokaz. |
| `supabase/proofs/ai/background_taxonomy_failures.test.mjs` | Sačuvati stvarne `buildFullTreeTaxonomyProposals`/`buildWorkerFullTreeTaxonomyProposals`, synthetic provider/catalog i failure/consent slučajeve; dopuniti strukturu. | Putanja je dodatno potvrđena na analiziranom GitHub commitu; test time nije ponovo izvršen. |

Nenajavljen mrežni poziv u lokalnoj kontrolisanoj probi mora biti odbijen fixture-om. Source regex provere ostaju korisne ograde, ali ne izvršavaju potpis ili SQL semantiku. Alternative `classificationExplorer`/shadow putanje povlačiti tek posle parity dokaza i prevezivanja aktivnih potrošača; `classificationOwnerReview.mjs` i njegov synthetic CI ulaz ne smeju nestati bez prenosa korisnih tekućih scenarija.

**Izlaz:** jedan dokumentovan aktivan semantički ugovor sa potpunim input-om i rezultatom, stabilnim ID-jem, celim BOTH i bezbednim kontinuitetom do sačuvanog autoritativnog stanja. Reprodukovani audit kvar nije novi PASS rešenja.

### R05 — Sačuvana područja, vreme i izbor stvarno dozvoljenih kandidata

#### Problem, obim i vlasnici

**Ulazni nalaz: F18.** Analizirani candidate prefilter može izbaciti radnika zbog stare profilne tačke udaljene preko 300 km pre nego što se primeni merodavno COUNTRY/CITY/RADIUS područje. Saved-area evaluator prihvata RS/STATIONARY, dok klijent poznaje i POINT_TO_POINT, MULTI_STOP, AREA_BASED i REMOTE. U TODAY_FLEXIBLE toku radnik dostupan kasnije danas može ostati bez time tier-a. To su statički lanci nad tadašnjim telima, bez izmerenog broja stvarno pogođenih naloga.

**Cilj:** početni skup kandidata ne gubi nijednog koga važeća konačna provera može dozvoliti; vreme i područje imaju isti smisao u matcher-u, „Za mene” i dispatch-u. Dobrovoljna ručna prijava zadržava zasebna pravila.

| Sloj | Konkretni vlasnici |
|---|---|
| Potvrđeno područje | `src/contracts/workerAreas.ts`; `supabase/functions/uskoci-worker-interview/index.ts`; signed candidate/review/Save vlasnici. |
| Server područja i vremena | `supabase/migrations/20261023210000_matching_work_areas_and_public_grants.sql`; `private.candidate_profile_ids`; `private.candidate_profile_ids_v1b`; `private.dispatch_config_v1b`; `private.worker_area_fit_v1`; `private.worker_need_fit_v1`; `worker_need_match_v1`; `worker_need_time_tier_v1`; `discovery_for_me_v1`; `dispatch_cheap_candidate_admitted` i dispatch admission. |
| Vremenski pomoćnici | `availability_is_future`; `need_search_time_admitted_v1`; važeći availability/calendar writer-i i hard gates. |
| Ručna prijava i izbor | `match_detail_without_calendar`; `rpc_submit_response`; `rpc_select_response`. |
| Dostižni klijentski oblici | `src/data/needClientService.ts`; `src/data/aiTaskReviewClientService.ts`; `src/data/aiNeedV2Ui.ts`. |
| Istorijski dokaz/predlog | `supabase/proofs/match_category_fallback/live-candidate-stream.sql`; `supabase/proofs/match_category_fallback/dispatch-prefilter-assert.sql`. To nisu automatski aktuelna runtime tela ili odobren apply. |

#### Redosled rada i sačuvana pravila

1. Osvežiti stvarna tela i normalizovanu konfiguraciju. Očuvati uključeni signed service-scope gate: Need reviziju/category i stvarno sačuvanu Worker/service/mode saglasnost. Ne „popravljati” match uklanjanjem potvrde ili world granice.
2. Characterize isti mali skup parova prefilter→fit→match→„Za mene”→dispatch. Prvi obavezni par je udaljena stara tačka i važeći COUNTRY ili udaljeni izričiti CITY/RADIUS. Proveriti i postojeći uncapped delegate, ne samo dormant numerički cap granu. Početni retrieval mora biti nadskup konačno dozvoljenih kandidata.
3. Promeniti prefilter u postojećem vlasniku uz ograničeno čitanje, stabilan red/fairness, per-revision dedupe, postojeće budžete i remote rotaciju. Bez geography/no-preference fallback nije zamena za validno sačuvano područje. Ako saved-area evaluator vrati false, stara profilna tačka ne sme proizvoljno preglasiti tu eksplicitnu odluku.
4. Sačuvati postojeći workerAreas ugovor: do pet CITY/RADIUS ili jedno COUNTRY područje; RADIUS zahteva izričite kilometre od centra mesta. `areaRequests` se razrešava na serveru. Nezavisna jasna izmena ne treba da nestane zato što geokodiranje drugog dela nije uspelo. Ne izmišljati radius ili tačnu GPS adresu umesto korisnikovog izbora.
5. STATIONARY popravka i TODAY ne čekaju poslovnu odluku o rutama. Pre proširenja POINT_TO_POINT/MULTI_STOP/AREA_BASED dokumentovati da li oblast pokriva svaku stvarnu radnu tačku, preuzimanje/dostavu ili drugi potvrđen ugovor. Za NS→BG uporediti prevoz, više dostava i rad na dve lokacije; ne zahtevati automatski svaki tranzitni kilometar. Ako tržište ostaje RS, validacija i prikaz to čuvaju. Druga zemlja nije nenamerna posledica geometrijske popravke.
6. REMOTE ne dobija lažan profilni pin, radius, rutu ili ETA da bi prošao fizički prefilter. Postojeći potvrđeni handoff i njegove potrebne lokacijske granice ostaju zasebni. Cityless REMOTE aktivacija nije deo ove popravke: sadašnji review/activation i submit/select još imaju city uslov i njegovo uklanjanje traži drugi kompletan ugovor.

**Konfiguraciona činjenica koju ne menjati pogrešnim čitanjem:** `workerDailyCap=1000` je u analiziranom `dispatch_config_v1b` sentinel koji se pretvara u NULL, odnosno isključen dnevni cap; nije stvarno ograničenje na 1.000. Sačuvati zatečeni dispatch ALL, remote talase 300/1.000, interval 30 minuta i zaustavljanje na pet odgovora dok ne postoji obrazložena namerna promena. Ove brojeve proveriti ponovo pre rada, jer plan beleži polazni ugovor, ne trajno pravilo za svako buduće izdanje.

#### TODAY_FLEXIBLE i vremenski kontinuitet

Analizirani `worker_need_time_tier_v1` pri dodavanju empty-calendar fallback-a izgubio je posebnu TODAY granu. Za važeći TODAY sa obe granice NULL, `available_now=false` i stvarnim AVAILABLE/weekly terminom kasnije danas ne izvodi dnevni prozor. `availability_is_future` zahteva obe granice, a poslednji period fallback važi samo za FIXED_WINDOW; rezultat ostaje NULL i dalji match odbija par. `available_now=true` i dalje može dati tier1. Obuhvaćen je i već započet ograničeni TODAY sa slobodnim ostatkom dana; nisu svi TODAY zadaci neispravni.

Jedan autoritet treba da izvede dan objave i preostali dozvoljeni interval u poslovnoj zoni. Sačuvati namerni empty-calendar fallback, eksplicitni UNAVAILABLE i stvarne vremenske konflikte. Očuvati instant, lokalni datum i promenu sata; uređajna zona ne sme proizvoljno redefinisati dogovoreni dan. Ne vratiti ceo stari exact-pin kandidat radi jedne vremenske grane.

#### Ručna prijava nije automatska preporuka

`match_detail_without_calendar` svrstava service/area/time preference u dispatchBlockers, dok `responseAllowed` ima nezavisne hard gates. `rpc_submit_response` i `rpc_select_response` proveravaju responseAllowed, svet, vlasnika, reviziju, cenu, termine i postojeća ograničenja. Ne dodavati novu zabranu dobrovoljne prijave samo da bi njena odluka postala ista kao „Za mene”. Pozitivna kontrola mora dokazati da legitimni ručni submit/select i dalje rade tamo gde samo preference ne preporučuju radnika.

#### Prihvatna matrica i testovi

| Skup | Obavezni slučajevi |
|---|---|
| Područja | Stara tačka preko 300 km + COUNTRY; udaljeni izričiti CITY/RADIUS; više oblasti; bez stare tačke; unutar/van potvrđenog radius-a; izmena jedne oblasti uz očuvanje drugih. |
| Topologija | STATIONARY; svaka zaista podržana POINT_TO_POINT/MULTI_STOP/AREA_BASED varijanta prema usvojenoj odluci; REMOTE/handoff bez lažne fizičke geometrije; druga zemlja samo prema eksplicitnom tržišnom pravilu. |
| Vreme | TODAY null/null, već započet ograničen TODAY, dostupan sada i kasnije, weekly/AVAILABLE/UNAVAILABLE, kraj dana, promena zone/sata, istek, TOMORROW/WEEK/FIXED i stvarni konflikt. |
| Ceo izbor | Isti tačno navedeni parovi kroz retrieval, fit, „Za mene” i dispatch; nema samo agregata koji prikriva pogrešan par. |
| Zasebna ručna radnja | Dozvoljen submit/select uprkos samom preference blocker-u; odbijanje stvarnog hard-gate, tuđe/stare revizije i nedozvoljene sesije. |
| Ograničen rad | Stabilan red, fairness, budget/cap semantika, remote rotacija i dedupe pod ponavljanjem, bez neograničenog čitanja cele baze kao rešenja. |

| Postojeća testna putanja | Sačuvati/dopuniti | Stvarni domet |
|---|---|---|
| `supabase/proofs/ai/worker_signed_areas_sql.test.mjs` | Writer, validator, stale-source continuity i privatne helpere vezati za stvarno izvršivu proveru gde treba. | Postojeći regex čita SQL stringove; ne izvršava Save ili matching. |
| `src/data/__tests__/worker-area-route.test.tsx` | Sačuvati potvrdu grube tačke/revizije i REMOTE granicu. | Servisne zamene nisu saved-area matcher ili prefilter. |
| `src/data/__tests__/w02-worker-availability-client.test.ts` | Sačuvati normalizaciju, expected revision i conflict zaštitu. | Ne izvršava TODAY time tier i dispatch. |
| `supabase/proofs/match_category_fallback/dispatch-prefilter-assert.sql` | Rebase na aktuelne definicije i signed oblasti, sa celom malom matricom parova. | Istorijski aggregate/fixture nije sadašnji autoritativni match. |

Ne vraćati iz starih fixture-a ukinute equipment/team/experience ili all-slots politike. Current TOTAL proporcionalnost covered/original slots ostaje kod cenovnog vlasnika. **Izlaz:** bez lažno negativnog početnog izbacivanja, ista važeća area/time odluka kroz automatski lanac i očuvana zasebna ručna prijava.

### R06 — Trajan nastavak, ograničen transport, cache i tačan AI obračun

#### Problem i cilj

**Ulazni nalazi: F06/F07, uz semantički ugovor R04.** Analizirani izvor već ima stvarnu lifecycle zaštitu: devetosekundni BG rok počinje pri BG startu, neuspešan/nevažeći foreground completion prekida neodvojeni rad, potvrđen uspeh dopušta ograničen capture posle zatvaranja stream-a, ACK se proverava, a dijagnostika ne iznosi privatnu prozu. To se čuva.

Otvoreno je trajno dovršavanje kada prvi plan nije nastao ili je store/capture ishod izgubljen. Builder `failures/unresolvedServices` često ne postaju trajan status, a `.catch(()=>null)` može ostaviti samo odsustvo rezultata. Ponovljena ista usluga ne mora pokrenuti novi pokušaj. Post-save outbox traži nonempty candidates i fingerprint; pending reconciler beleži nezavršen review, ali ne rekonstruiše propušten prvi plan. `ai_turn_sweep` posle grace perioda postavlja FAILED/CANCELLED, nije automatski provider retry.

**Cilj:** svaki opravdani klasifikacioni posao ima završiv, ograničen i vidljiv lifecycle, a svaki poslati provider pokušaj zaseban poznat ili izričito nepoznat obračunski ishod. Prekid ne traži da korisnik ponovo opisuje jasnu uslugu. Poslovna idempotentnost ne obećava tačno jedan naplaćeni provider poziv.

#### Pune putanje i postojeći vlasnici

| Uloga | Vlasnici |
|---|---|
| BG, transport, budžet | `supabase/functions/_shared/backgroundTaxonomyArchitect.mjs`; `supabase/functions/_shared/geminiTaskStream.ts`; `supabase/functions/_shared/taxonomyProviderBudget.ts`; `supabase/functions/_shared/aiTestBudget.ts`. |
| Foreground/capture | `supabase/functions/uskoci-ai-interview/index.ts`; `supabase/functions/uskoci-worker-interview/index.ts`; `supabase/functions/_shared/aiPhaseTiming.mjs`. |
| Trajni post-save posao | `supabase/functions/_shared/taxonomyPostSaveWorker.mjs`; `supabase/functions/uskoci-taxonomy-postsave-worker/index.ts`; postojeći lease/receipt/outbox/pending SQL vlasnici. |
| Prvi plan, review/capture i potpis | `supabase/migrations/20261021104455_closure_taxonomy_archive_copy_coverage.sql`; `supabase/migrations/20261021103732_worker_equipment_retired_signed_policy.sql`; `supabase/migrations/20260913044510_clean_v5_unknown_ai_turn_exit.sql` i aktuelni prepare/complete/binder vlasnici. |
| Katalog/verzija | `supabase/migrations/20261023200000_taxonomy_snapshot_and_turn_hints.sql`; `rpc_taxonomy_fetch_snapshot_v1`; `rpc_taxonomy_query_catalog_service`; pisci category/mode/alias sadržaja. |
| Klijentski identitet pokušaja | `src/data/aiTurnIntentJournal.ts`; `src/data/aiNeedV2Production.ts`; `src/data/workerAiClientService.ts`; `src/hooks/useOwnedEditor.ts`. |
| Govor u tekst i njegovo rezervisanje | `supabase/functions/uskoci-speech-session/index.ts`; `supabase/functions/uskoci-speech-session/proxy.ts`; `supabase/functions/_shared/aiTestBudget.ts`. Ovo nije voice-message upload journal. |

#### 1. Razdvojiti posao, provider pokušaj i poslovni upis

Pre izmene definisati minimalan trajni zapis kod postojećeg autoriteta: account/conversation, draft revision, relevantni ulaz i fingerprint, scope, očekivani mode parovi, identitet logičkog posla, provider attempt, budget, stanje, rezultat i potrebni rok/lease. Čuvati odgovarajuću privatnost i retention; ne kopirati ceo razgovor u novi trajni red samo zato što je najlakše.

Razlikovati bar tehnički prekid, stvarno potrebno korisničko razjašnjenje, spreman validan predlog, PROCESSING, nepoznat upisni/provider ishod i terminalno stanje. Stvarni semantički rezultat može se bezbedno revalidirati prema R04; stvarna promena input-a ili naloga ne sme preuzeti stari rezultat. Pending status treba da kaže da li čovek treba nešto da odgovori ili sistem završava svoju obradu, bez internog objašnjavanja kategorijskog administriranja.

Postojeći post-save red koristiti tamo gde već obrađuje odobren plan. Prvi izostali plan zahteva svoj jasno povezan trajni nastavak, ne treći klasifikator niti drugi vlasnik iste poslovne istine. Pre-review i post-save posao imaju različite preduslove i dokaze. Journal zapis pre dispatch-a i isti command/request ID ostaju; readback potvrđuje postojeći rezultat pre odluke o novom upisu.

#### 2. Pravila ponavljanja i završetak UNKNOWN stanja

Sigurno neposlat ili izričito retryable neuspeh može imati ograničen nastavak uz lease, budžet i rok. Izgubljen odgovor posle slanja nije dokaz da server ili provider nisu izvršili posao. Lokalni transport abort nije udaljeni rollback i ne znači vraćen model trošak.

Za gubitak store/capture ACK-a prvo pročitati ishod iste operacije. Potvrđen postojeći rezultat ne izaziva novi model ili drugi poslovni upis. Stari readback ne briše noviju komandu istog naloga. Za nepoznat provider generate ishod sačuvati zaseban UNKNOWN zapis; ne praviti slepo novi plaćeni pokušaj pod novim ključem.

Plan lifecycle-a mora imati završiv odgovor i kada UNKNOWN traje: vidljivo stanje, sledeću dozvoljenu proveru, kraj automatskog rada, maksimalan budžet i odgovornu intervenciju ili drugi konkretan terminalni ishod. Ne obećavati dokaz „tačno jednom naplaćeno” kada provider ne daje potreban dokaz. Ograničiti svaki retry/poll; restart instance ili telefona ne resetuje brojač i budžet na nulu.

Objavljeni post-save v5 u analiziranom preseku nema source catch dopunu za stream/UTF-8 read greške. Uskladiti baš retryable/terminal granu i isti logical request key, lease i postojeću granicu od pet pokušaja; ne primenjivati ceo stari Edge paket. Ta popravka i dalje ne stvara prvi izostali plan. Source/Edge razliku zatvoriti kontrolisanom isporukom i dokazom stvarnog paketa.

#### 3. Potpun provider odgovor i jedan vlasnik transporta

BG direktni fetch čita `res.json()` bez byte cap-a, prihvata nedostajući `finishReason`, a prisutan završetak različit od STOP već odbija. Shared `geminiTaskStream.ts` zahteva potvrđen STOP i ograničava telo na 524.288 bajtova. Uskladiti aktivni BG put sa istim potrebnim request/response ograničenjima i verifikovanim parserom; ne oslabiti potpunost radi češćeg prolaza.

BG pozivi imaju `maxOutputTokens:1024` i thinking override samo za ime modela koje sadrži 2.5; shared normalizacija ima svoj low-thinking ugovor. Proveriti stvarni podržani model/API i primeniti njegov dozvoljeni request oblik. Analizirani izvor koristi Gemini Developer API `v1beta` generateContent/streamGenerateContent i pin `gemini-3.8-flash`; efektivne tajne/gate-ovi nisu time očitani. Promena API porodice ili modela nije prećutna optimizacija.

Sačuvati postojeći devetosekundni lifecycle rok, spajanje tekstualnih delova i bezbedne tipizovane greške. Proveriti nedostajući STOP, preveliko telo, truncation, prekinut tok, nevažeći JSON/schema i potpun pozitivan odgovor. Ne tvrditi da raniji kod nije imao timeout ili je čitao samo prvi tekstualni deo. Za svaki ishod ostaje zaseban attempt/usage rezultat, uključujući neuspeh dijagnostike.

#### 4. Odvojeni BG i STT obračun

Glavni provider pokušaj već ima rezervaciju/settlement, dok direktni BG fetch nema zatvoren zaseban operation ID/onUsage tok. Exact/cache i trigger mogu izbeći BG poziv; nije svaka poruka obavezno dva modela. Svaki stvarno poslati BG attempt mora dobiti svoj budžet i poznat/UNKNOWN obračun, bez prepisivanja ili dupliranja foreground računa. Uspeh, abort, izgubljen odgovor i retry ostaju odvojeni događaji.

Za generateContent `promptTokenCount` već uključuje `cachedContentTokenCount`; cached deo ne sabirati preko punog prompt-a. `candidatesTokenCount`, `thoughtsTokenCount` i ukupni zbir imaju svoje značenje. Zapisati stvarne usage vrednosti odgovarajuće API porodice, poznati trošak ili označenu nepoznanicu; ne preslikavati parser druge API porodice. Uključiti cache create/refresh i neuspešne/nepoznate pokušaje. Istorijski koeficijenti i `realSpendUsd:null` nisu stvarni račun providera ili hard cap.

STT rezervacija se trenutno može osloboditi kada nema transkripta, iako proxy može već poslati audio i vratiti `audioBytes>0`. Odsustvo teksta nije dokaz da provider nije obradio sadržaj. Odluka o oslobađanju zahteva dispatch/usage dokaz ili izričit UNKNOWN ishod. Ovaj nalaz je rizik internog obračuna; nije dokazan stvarno pogrešan korisnički račun i ne rešava se promenom voice-message upload journal-a.

#### 5. Dostupno celo stablo i bezbedan cache

R04 određuje sadržaj i potpunost; R06 optimizuje njegovu dostavu i ponovnu upotrebu. Baza ostaje autoritet kategorija i ID-jeva. Trenutni `loadFullCatalogTree` prvo preuzima puni snapshot, pa tek onda poredi memorijski ključ, zato cache pogodak štedi deo rekonstrukcije, ne taj RPC/payload. Edge memorija je memorija pojedinačne instance sa ograničenim vekom; pozadinski `waitUntil` nije trajni red niti način da model vidi tu memoriju.

| Sloj | Ugovor koji implementacija treba da zatvori |
|---|---|
| Snapshot u bazi | Jedan kompletan semantički sadržaj, version i fingerprint/stamp svih relevantnih category/mode/alias/label/scope/parent promena. |
| Uslovni odgovor | Isti potpun stamp daje mali NOT_MODIFIED; hladan start ili promena daje pun snapshot. Novi RPC oblik ne stvara dvosmislene overload-e i zadržava podržani stari Edge caller koji još traži puni sadržaj. |
| Cache instance | Immutable potpun objekat, single-flight, atomska zamena, ograničen život i veličina. Otkazivanje jednog waitera ne ubija tuđ zajednički load; nepotpun objekat ne postaje pun. |
| Semantički rezultat | Ponovo koristi provereni nepromenjeni smisao za važeći nalog/uslugu/mode/handoff, uz novo bezbedno vezivanje za review. Ne prenosi staru saglasnost na novu nameru ili nepotpun BOTH. |
| Provider kontekst | Stabilan javni katalog/instrukcije prvi u promptu; promenljivi service/scope i privatni sadržaj ostaju odvojeni. Provider cache je zasebna, uslovna optimizacija. |

Postojeći META ponovo računa fingerprint i eligible count; ime META ne znači O(1). Postojeći fingerprint nije digest svih prompt bajtova: ne uključuje neposredno display label, alias label i scope. Pre NOT_MODIFIED/provider-cache upotrebe proširiti relevantni content stamp, uključujući rename uz isti normalized key. Ako merenje opravda unapred računat stamp/payload, obuhvatiti sve pisce atomarno ili koristiti izričito dirty stanje koje nije validan snapshot. Ne uvoditi novu materijalizovanu ili vektorsku kopiju kao konkurentski katalog.

Ukloniti dupli prefetch/builder snapshot za isti dual turn i bezuslovni puni prefetch po poruci. Novel-decision ključ sada nema fingerprint/model/prompt verziju ni TTL/size granicu; clarification mapa nema eviction. Dopuniti oba ograničenja i identitet. Worker builder ne treba ponovo plaćeno da pronalazi svaki već poznat važeći ID; obraditi promenjene/nerešene jedinice uz očuvan kompletan review. Unrelated catalog promena može dopustiti postojeću bezbednu revalidaciju istog plana, ne automatsko prihvatanje ili blanket odbacivanje.

Eksplicitni `cachedContent` uvoditi tek kada konkretan model/API, tačni tokeni stabilnog prefiksa, reuse, TTL i trošak skladištenja pokažu korist. Proveriti važeće pragove dokumentacije pri implementaciji; istorijska veličina JSON-a nije tokenizer. Auditski snapshot je imao 71.388 JSONB bajtova, a tadašnja prompt-tree serijalizacija 13.168 UTF-8 bajtova; to nije kompresovani HTTP, token broj, cena ili latencija. Implicitni cache pogodak nije garantovan. Nepostojanje eksplicitnog cache-a samo po sebi ne blokira ispravno izdanje.

Provider cache ključ obuhvata projekat, katalog version/fingerprint, tačan model, prompt/response verziju i svrhu kada se instrukcije razlikuju. Zajednički cache nikada ne sadrži korisnički nalog, razgovor ili privatni profil. Registry/kreiranje ne računaju na trajnost Edge memorije; identično kreiranje ograničiti lease/idempotency pravilom. Potvrđen miss/expiry/mismatch ima jedan ograničen fallback ili recreate uz pun snapshot i budžet. To nije dozvola za ponavljanje generate zahteva čiji je već poslati ishod UNKNOWN. Pri capture/Save/binder-u proveriti važeću DB semantiku i očuvati korisničku potvrdu.

#### Prihvatni dokaz, stvarno čekanje i postojeće provere

| Skup | Minimalan potreban dokaz |
|---|---|
| Prvi plan | Kontrolisani neuspeh pre capture-a i gubitak store ACK-a ostavljaju trajan obradiv posao; post-save/pending red se ne proglašava dokazom prve klasifikacije. |
| Nastavak | Restart procesa/instance, istekao lease, kasni odgovor i A→B→A čuvaju pravi owner/revision/command; uspešan raniji pokušaj prepoznaje se readback-om. |
| Semantička stabilnost | Nepromenjena usluga + „to je to”, vreme, budžet ili pin ne ponavljaju nepotrebno model; stvarna usluga/mode/handoff promena odbacuje stari rezultat. |
| Transport | Missing STOP, preveliko/truncated telo, prekid i nevažeći izlaz ne daju gotov rezultat; puna pozitivna kontrola prolazi. |
| Obračun | Foreground/BG/STT/cache pokušaji imaju odvojene poznate/UNKNOWN ishode; jedan settlement ne postaje dva; cached input se ne sabira dva puta; logging failure ne menja pravo stanje. |
| Snapshot/cache | Hladan/topao, isti/promenjen sadržaj, pun posle parcijalnog iste oznake, paralelni miss, otkazan waiter, rename/alias/mode/scope izmena, model/prompt promena, provider expiry/mismatch. |
| Ograničenost | Bounded pokušaji, ukupni rok, budžet i veličina/život cache-a; UNKNOWN ima konkretan dalji korak i kraj automatskog rada. |

Merenje razdvojiti na foreground provider, catalog load, BG provider i SQL capture, pa dodati tap→prvi korisni prikaz, tap→potvrđen rezultat/readback i vreme do pregleda. `PROVIDER` meri streaming provider, `NEED_COMPLETE`/`WORKER_COMPLETE` SQL completion; korisnički tekst ostaje iza uspešne potvrde upisa. Nijedna od tih postojećih faza sama ne meri render ili ukupno korisničko čekanje. Tačnost, celovitost i ukupni trošak imaju prednost nad samim smanjenjem broja poziva.

| Postojeća testna putanja | Rad i očuvani smisao | Šta nije dokazano njenim postojanjem |
|---|---|---|
| `supabase/proofs/ai/background_capture_receipt.test.mjs` | Sačuvati prave handlere, ACK/dijagnostiku i reprodukciju; postojeće očekivanje da isti input ne pokrene retry posle popravke prevesti u dokaz dozvoljenog trajnog nastavka. | Zeleni karakterizacioni test može danas potvrđivati kvar. |
| `supabase/proofs/ai/taxonomy_provider_budget.test.mjs` | Sačuvati budget modul, jednom settlement, unknown usage i otpornost na logging failure; proveriti stvarni BG caller. | Izolovan modul ne dokazuje da ga direktni BG fetch koristi. |
| `supabase/proofs/dynamic_taxonomy/taxonomy-postsave-worker.test.mjs` | Sačuvati receipt/lease/retry i dodati relevantnoj stvarnoj CI selekciji. | U analiziranom CI izboru nije bio pokrenut; mock RPC nije stvarni SQL lease ili pre-review posao. |
| `src/data/__tests__/ai-turn-intent-journal.test.ts` | Sačuvati account izolaciju i stale-clear zaštitu; dopuniti uređajski prekid gde treba. | Memorijski AsyncStorage mock nije gašenje procesa na telefonu. |
| `supabase/proofs/ai/background_taxonomy_failures.test.mjs` | Dopuniti odgovarajuće failure/consent i loader slučajeve kroz pravi builder i presretnut transport. | Synthetic provider/catalog nije živi trošak ili nova provera isporučenog Edge-a. |
| `supabase/proofs/ai/classification-full-catalog-edge.test.mjs` | Proveriti pravu dual/BG granu i uslovni snapshot ugovor. | `db.invalid` shadow/direct fixture ne zatvara BG loader sam po sebi. |

Istorijski testovi 40 capture/ACK, 16 completion/lifecycle, pet runner slučajeva i ostale izolovane probe zadržavaju svoj tadašnji obim; nisu novi runtime/device/cost rezultat. Pravi model/cache/countTokens i merenje troška rade se kao odvojena ograničena izvršna provera sa unapred određenim korpusom i budžetom.

**Izlaz:** trajan prvi plan i post-save nastavak imaju odvojene ispravne preduslove, ograničen oporavak i readback; aktivni transport proverava potpun odgovor; svaki pokušaj ima svoj obračun; kompletan katalog ne prenosi se bez potrebe; cache ne menja autoritet, privatnost ili korisničku saglasnost.

### R07 — Cena, odustajanje i dodatni profilni upis

#### Problem, zavisnosti i traženi rezultat

Ovaj zadatak zatvara F02/F03/F11/F13, uz R01 ugovore i R04 zaštitu pregleda. R07a ispravlja zastarelu potvrdu cene u već podržanom RSD/OFFERS domenu. R07b usaglašava satnicu tek posle odluke o njenoj osnovici. Odustajanje i dodatni profilni upis napreduju nezavisno od te odluke. Rezultat je isto razumljivo značenje cene u svim fazama, proverljiv ishod iste radnje i očuvana novija izmena profila.

#### Konkretni vlasnici

- `src/app/(app)/pregled-zadatka.tsx`
- `src/app/(app)/prilike/[id]/prijava.tsx`
- `src/contracts/projections.ts`
- `src/data/aiTaskReviewClientService.ts`
- `src/data/applicationClientService.ts`
- `src/data/workerProfileClientService.ts`
- `src/hooks/useOwnedEditor.ts`
- `src/ui/objava/reviewFacts.ts`
- `supabase/functions/uskoci-ai-interview/index.ts`
- `supabase/proofs/ai/currency_correction_characterization.test.mjs`
- `src/data/aiNeedV2Production.ts`
- `supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql`
- `supabase/migrations/20260904230000_clean_ru4_ai_edit_conversation.sql`
- `supabase/migrations/20261021101159_staged_task_replacement.sql`
- `supabase/migrations/20261021101527_staged_task_replacement_noop_guard.sql`

SQL autoriteti su važeći fact writer i review/prepare vlasnici, `validate_need_v2_fact`, `private.assert_application_price_v5`, `private.need_material_snapshot`, `need_full_edit_snapshot`, `task_replacement_material`, `rpc_publish_need_canonical`, `cancel_replaced_task` i `finalize_task_replacement`. Migracioni fajl je trag porekla; pre promene potvrditi stvarno tekuće telo i njegove potpise/dozvole.

#### R07a — Korekcija cene i tačan prikaz

1. Kada korisnik promeni značenje ranije potvrđene cene, u istom kanonskom toku povući staru saglasnost ili je vratiti u stanje koje traži novu potvrdu. Primer „5.000 RSD” pa „mislio sam evre” ne sme ostaviti 5.000 RSD kao važeću potvrđenu cenu. Sistem ne izmišlja kurs i ne uvodi podršku za EUR.
2. Nerešena ili nova cena mora ostati ista kroz writer, signed review, Save i eventualnu objavu. Kasnija nepovezana poruka ne sme samo ukloniti upozorenje, a sačuvati pogrešnu potvrdu. Sačuvati sve druge jasne činjenice. Prelazak na OFFERS proveriti kroz njegove stvarne posebne uslove; ne pretpostaviti da OFFERS i MY_PRICE imaju isti writer.
3. Odvojeno normalizovati protivrečan `displayValue` kao „100 EUR” uz tipizovanih 100 RSD. `src/ui/objava/reviewFacts.ts` već formatira cenu iz broja; taj ispravan put ostaje. Pratiti stvarne potrošače i sačuvane prezentacione kopije, bez tvrdnje da je glavni pregled dokazano prikazivao pogrešnu valutu.
4. **Povučena sumnja ostaje povučena:** ranije pročitano živo `private.need_material_snapshot` sadrži `priceBasis`, iako njegov source prethodnik nije isti. Ne popravljati nepostojeći dokazani live kvar. Sa R12 proveriti reproduktivnost izvora i stvarnu `price-basis-only` izmenu kroz signed review/replacement; ranije živo telo ne proglašavati sveže pročitanim bez novog upita.

#### R07b — Satnica kao kompletan poslovni ugovor

Pre izmene odrediti da li se cena odnosi na jednu osobu, celu ekipu ili eksplicitno podržane obe osnovice. Za dve osobe, tri sata i satnicu od 1.200 RSD ukupan iznos je 7.200 RSD kod satnice po osobi, odnosno 3.600 RSD kod satnice cele ekipe. Predlog za jednostavan početni ugovor je jasno označena satnica po osobi; to nije unapred odobrena odluka.

Nakon odluke usaglasiti HOURLY/PER_HOUR kroz fact validator, Edge guard, writer, pregled, objavu, prijavu, izbor, Dogovor i dekodere. Broj ljudi, jedinica, iznos, valuta i trajanje moraju imati isto značenje. Nepoznato trajanje ne proizvodi izmišljenu konačnu sumu. Ne uklanjati samo TOTAL guard. Obuhvatiti podržani stari Discovery decoder, kod kojeg jedna HOURLY stavka može odbiti celu PAGE poruku; ta kompatibilnost nije dokazan uzrok ranijih slika.

#### F11/F13 — Ista radnja i zaštićena paralelna izmena

Posle izgubljenog abandon odgovora čitati ishod iste operacije i razlikovati OPEN, ABANDONED i UNKNOWN. Ne pokretati novi prepare nad već napuštenim razgovorom niti tvrditi da postoji Need kada ga nije bilo. Ponuditi tačnu proveru i povratak. Abandon menja status; nije obećanje fizičkog brisanja svih podataka.

Opcioni izbor „dodaj veštinu” posle prijave mora biti namera za tačnu uslugu, nalog i važeću reviziju. Koristiti postojeći autoritativni merge/CAS ili odgovarajući aktivni vlasnik; ne slati staru celu uhvaćenu skills listu. Ponoviti proveru konteksta posle await granica i odbiti kasni odgovor posle A→B→A promene naloga/generacije. Sačuvati paralelno dodatu veštinu. Već potvrđena prijava ostaje uspešna kada ova sporedna radnja ne uspe.

#### A24 — Zamena javne objave

Priprema i pregled izmene ne gase staru objavu. Uspešna nova objava, zatvaranje stare i obrada starih prijava moraju ostati u istoj transakciji; kasnija greška vraća tu transakciju. Prijave se ne prenose na nove uslove. Sačuvati `NO_MATERIAL_CHANGE` zaštitu. Pokriti uspešnu zamenu, odbijenu/neizmenjenu izmenu, izgubljen ACK i grešku posle početka finalizacije. Klijent mora otvoriti stvarni potvrđeni rezultat; gubitak odgovora nije nova komanda objave.

#### Provere i uslov završetka

| Postojeća provera | Kako je koristiti i šta još mora da dokaže |
|---|---|
| `supabase/proofs/ai/currency_correction_characterization.test.mjs` | **Sačuvati reprodukciju; promeniti cilj posle popravke.** Izolovana stvarna Edge/SQL tela reprodukuju zadržanu staru potvrđenu cenu i HOURLY nesklad. To je test analiziranog CI izbora koji NAMERNO prolazi kada se postojeći kvar reprodukuje. |
| `src/data/__tests__/application-proportional-price.test.ts` | **Sačuvati.** Nezavisan celobrojni oracle i proporcionalni TOTAL/razni modovi. Nije potvrda konačne poslovne odluke o satnici/valuti niti celu writer putanju. |
| `src/data/__tests__/review-exits-and-place.test.tsx` | **Sačuvati i dopuniti.** Odbijen/unknown abandon i UX readback radnja sa mocked service. Dopuniti slučaj stvarno ABANDONED bez zasebnog Need-a i razrešenje kroz pravi read port. |
| `src/data/__tests__/application-composer-read.test.tsx` | **Sačuvati i dopuniti.** Uspešna prijava ostaje uspešna ako opcioni profile save zakaže. Ne pokriva paralelno izmenjene skills i A→B→A između success-a i dodatnog upisa. |

Najmanji novi dokazi su stvarni signed accept/Save/publish tok nakon korekcije cene, uspešan abandon sa izgubljenim ACK-om bez Need-a i kasni dodatak veštine uz paralelnu promenu i A→B→A. Pozitivne kontrole: nova važeća RSD cena može se potvrditi; OPEN se ne proglašava napuštenim; dodavanje tačne veštine u istoj dozvoljenoj reviziji radi. A24 se izvršava preko tekućih poslovnih vlasnika, ne direktnim fixture insertom koji preskače objavu.

Uslov završetka je potvrđen poslovni rezultat kroz pravi reader/writer i razumljiv prikaz na telefonu. Stare izolovane reprodukcije ne dokazuju da je pogrešna cena stvarno objavljena ili da je izazvan live incident. Pri popravci sačuvati ulaz koji je reprodukovao kvar i promeniti završno očekivanje na ispravno ponašanje, u okviru C15.


### R08 — Prirodan završetak razgovora i veran sačuvani rezultat

#### Problem i traženi rezultat

R08 zatvara F09/F10/F12 i kontinuitet naručiočevog završnog pregleda, uz R04 semantiku i relevantni deo R07. Korisnik kaže više jasnih činjenica, dobije najviše jedno stvarno potrebno pitanje, pregled iste namere i posle potvrde ponovo otvara isti sačuvani sadržaj. Opciona biografija, detaljan kalendar ili stari formular ne postaju prepreka završetku.

#### Konkretni vlasnici

- `src/app/(app)/profil/razgovor.tsx`
- `src/data/__tests__/ai-natural-server-guard.test.ts`
- `src/data/workerAiClientService.ts`
- `src/hooks/useWorkerExecutionModes.ts`
- `src/ui/workerProfile/WorkerAiPresentation.tsx`
- `src/ui/workerProfile/WorkerProfilePresentation.tsx`
- `src/ui/workerProfile/WorkerProfileSaved.tsx`
- `supabase/functions/uskoci-ai-interview/index.ts`
- `supabase/functions/uskoci-worker-interview/index.ts`
- `src/app/(app)/nova.tsx`
- `src/app/(app)/pregled-zadatka.tsx`
- `src/app/(app)/profil/radnik.tsx`
- `src/data/aiTurnIntentJournal.ts`
- `src/data/aiTaskReviewClientService.ts`
- `src/data/reviewFactProblem.ts`
- `src/hooks/useOwnedEditor.ts`
- `src/ui/v2/draftSummary.ts`
- `src/ui/v2/IntakePresentation.tsx`
- `src/contracts/needFactsV2.ts`
- `src/ui/location/ConversationPointAsk.tsx`
- `src/ui/location/NeedLocationForm.tsx`
- `src/ui/workerProfile/workerProfileDraft.ts`
- `src/contracts/workerAreas.ts`
- `supabase/functions/_shared/workerServiceModeContext.mjs`
- `supabase/functions/_shared/serviceExecutionInstruction.mjs`
- `supabase/functions/_shared/taxonomyPostSaveWorker.mjs`
- `supabase/migrations/20261021104455_closure_taxonomy_archive_copy_coverage.sql`

#### Završetak, potvrda i očuvanje namere

1. U postojećem snapshot/Edge/decoder/ekran ugovoru povezati autoritativni završetak sa potrebnim poslovnim činjenicama. `hasProfileContent`, modelov tekst „gotovo”, `canAccept`, classification READY i saved receipt ostaju različiti signali. „To je to” nije automatski Save.
2. Jedan vlasnik sledećeg pitanja bira najvažniju stvarnu nejasnoću, a čuva ostale za naredni korak. Sastavljeni guard za ponavljanje i dnevnicu/satnicu ne sme tražiti više odluka odjednom. Ocenjivati značenje poruke, ne broj upitnika. Sve jasno izrečene činjenice se zadržavaju.
3. Kod naručioca rešiti skriven nedostatak tekstualnog `need.category`, koji može sprečiti završnu karticu bez vidljivog objašnjenja. To je podatak koji sistem dovršava; ne vraćati administriranje kategorije korisniku. Tekst kategorije nije konačni category ID niti univerzalni READY uslov.
4. Sačuvati blaži dozvoljeni ulaz u pregled u odnosu na završnu karticu. Prepare stvara zamrznuti review, ali ne prihvata i ne objavljuje Need. Neposlat tekst nije potvrđen deo pregleda. SaveDraft/Publish dele postojeći accept/digest, uz različit nastavak i potpunu potvrdu prema §3.6.1. Dokazati direktnu objavu, čuvanje/ponovno otvaranje nacrta i A24 zamenu; nerešen ili samo prihvaćen privatni nacrt nije objava.
5. DRAFT worker profil na istom ekranu pregleda bira Save ili Save+activate bez obaveznog prethodnog zasebnog Save-a. Izbor activate mora biti potpisan u odgovarajućem review-u, a traženo čuvanje/aktivacija ostaju jedna transakcija prema §3.6.2. `activate=false` pri izmeni ACTIVE profila nije deaktivacija. Pending nove usluge ne ukida automatski sva ranija potvrđena prava.
6. Posle Save-a i ponovnog otvaranja profila čitati merodavan sačuvan model iste revizije i prikazati mode, relevantnu predaju, oblast i status po usluzi. Ne rekonstruisati nedostajući detalj iz stare lokalne review kartice. Kratke oznake i sklopljeni duži detalji su vizuelni predlog, ne novi obavezni formular.
7. Copy jasno razlikuje stvarno pitanje korisniku od unutrašnje obrade. „Čeka potvrdu kategorija” ne treba da izgleda kao korisnikov administrativni posao. Za REVIEW_REQUIRED dati smislen razlog i dostupnu obnovu gde je dozvoljena; ACTIVE sam nije obećanje da je svaka nova usluga već uključena u povezivanje.

Tema ili ispravka vraćaju u isti razgovor bez implicitnog slanja ili otvaranja nove sesije. Čuvati journal pre slanja, identitet pokušaja bez privatnog body-ja, account/focus/generation zaštite i noviji neposlati unos od kasnog odgovora. Zadržavanje teksta u montiranoj ruti nije automatski dokaz da svaki znak preživljava gašenje procesa; taj vek nacrta jasno definisati i proveriti.

#### Dve mape imaju različito značenje potvrde

| Tok | Kada se podatak stvarno čuva | Potrebno ponašanje pri izlasku |
|---|---|---|
| `ConversationPointAsk` | Svaki potvrđen pin odmah ide na server uz očekivanu geografsku reviziju; START može biti sačuvan dok END nedostaje. | Prikazati stvarno sačuvanu tačku i jasno nedostajući ostatak. |
| `NeedLocationForm` u pregledu | Tačke su lokalne do „Primeni potvrđene tačke”, kada se priprema novi review. | Izlazak pre Primeni ne prikazivati kao sačuvan skup. |

Vizuelno ujednačavanje ne spaja writere niti menja transakcije. Oblast rada, profilni pin i fizička predaja ne postaju isto polje. GPS dozvola za „Moja lokacija” nije opšti uslov svakog prikaza mape. Prikaz i interakciju proveriti kroz stvarni MapLibre/OpenFreeMap native/web vlasnik, fokus i pin reviziju. A24 zamena objave mora ostati ista kao u R07.

#### Ograde i kompatibilnost koje ostaju

Sačuvati aktivni name-adoption i uncertain-write recovery u `profil/radnik.tsx` i `workerProfileDraft.ts`; povučen manual editor ne čini ceo modul mrtvim. `inferWorkerExecutionModes` poziva se samo kada classificationState nedostaje; signed READY/PENDING put ga preskače. Ne opisivati sve sadašnje modove kao nagađanje niti uključivati stari formular da bi fixture prošao.

Deadline prepare bira posebne `rpc_prepare_ai_task_review_deadline` i `rpc_prepare_ai_task_review_deadline_taxonomy` samo kada je odgovarajući javni build flag doslovno `true`. Pre njegovog eventualnog uključivanja potvrditi ta dva RPC-a. Njihovo odsustvo u ranijem pregledu nije dokaz da nedostaje obični aktivni prepare, niti su time očitane efektivne zastavice starog APK-a/OTA.

#### Provere i uslov završetka

| Postojeća provera | Kako je koristiti i šta još mora da dokaže |
|---|---|
| `src/data/__tests__/worker-ai-conversation-recovery.test.tsx` | **Sačuvati i dopuniti.** Prazan/resumed chat, last-good offline stanje, jedna provera i odsustvo parcijalnih kartica. Servis i journal su testne zamene; nije dokaz autoritativnog completion signala u stvarnom toku. |
| `src/ui/workerProfile/__tests__/worker-ai-review.test.tsx` | **Sačuvati i dopuniti.** Per-service mode/handoff pregled i signed no-write policy bez stare obavezne opreme. Pregled sa zadatim props ne dokazuje da sačuvani profil prikazuje isti sadržaj. |
| `supabase/proofs/dynamic_taxonomy/worker-finish-mode-completeness.test.mjs` | **Sačuvati; dodati relevantnoj CI selekciji.** Jedna završna smernica i vidljivost nerazrešenih usluga bez implicitne potvrde. U analiziranom CI izboru nije izabran; helper nije dokaz završetka/Save/binding cele ponude. |
| `supabase/proofs/ai/interview_voice_one_question.test.mjs` | **Sačuvati i dopuniti.** Regex provera da zajednička prompt instrukcija traži jedno pitanje, pamti jasne podatke i ne tvrdi Save autoritet. Ne izvršava model ni guard; prisustvo rečenice u promptu ne dokazuje stvarni razgovor ili kombinaciju više nejasnoća. |

Dopuniti `src/data/__tests__/ai-natural-server-guard.test.ts` stvarnim kombinovanim odgovorom. Pravi tok mora obuhvatiti više usluga, BOTH istog ID-a, konkretnu predaju, normalno „to je to”, Save i ponovno otvaranje profila. Zasebno proveriti DRAFT Save, DRAFT Save+activate i izmenu ACTIVE profila, promenu izbora aktivacije uz novi signed review i izgubljen ACK uz proveru iste radnje. Nepoznat obavezan podatak ostaje jasno označen; delimičan BOTH ne postaje kompletan pregled. Uređajski dokaz uključuje mali ekran, veći tekst, tastaturu, povratak i dostupne potvrde.

Za svaki primarni AI/pregled/profil/map ekran popuniti zajednički obrazac od 16 polja iz §3.5. Uspešna props proba nije dokaz da isti sadržaj dolazi iz sačuvanog server modela. U aktivnom razgovoru nema parcijalnih kartica. Istorijski dizajn ili test ne uvodi dodatni obavezni mode/equipment/bio formular.


### R09 — Obaveštenja, poruke i tačno odredište

#### Problem, zavisnosti i traženi rezultat

R09 zatvara F20/SB08/SB10 posle relevantnih R01/R05 ugovora. Poruka i prilika imaju autoritativan događaj, dovoljan ograničen kapacitet obrade, poštovane nezavisne preference i bezbedno odredište na dodir. Upis poruke, SQL tick, HTTP poziv, provider potvrda i uočena isporuka na telefonu predstavljaju različite dokaze.

#### Konkretni vlasnici

- `src/app/(app)/profil/obavestenja.tsx`
- `src/ui/AgreementChat.tsx`
- `src/ui/notifications/PushPreferences.tsx`
- `supabase/functions/_shared/pushNotificationCopy.mjs`
- `supabase/functions/uskoci-push-transport/index.ts`

Realtime potrošači su u prethodnom server pregledu imenovani kao `agreementInvalidationService.ts`, `useAgreementIncomingRefresh.ts` i `useConversationInbox.ts`; njihove pune fizičke putanje nisu navedene u dostavljenim prilozima i moraju se razrešiti pre izmene. SQL vlasnici uključuju `rpc_claim_push_transport`, `edge_worker_tick_v5`, važeći begin/suppression/dispatch, message/opportunity resolver i group sender sa immutable visibility. Pročitati njihove tekuće definicije i stvarne pozivaoce, bez slepog puštanja istorijskog candidate paketa.

#### Sveža konfiguracija, kapacitet i nepoznat ishod

1. Najpre osvežiti bezbednu konfiguraciju, gates i trag SQL wake → HTTP invocation → claim → provider → receipt → uređaj. U reviziji 7 push v37 odgovara source-u, redovni poziv radi jedan SEND i jedan RECEIPT, a minute SQL cron može završiti kao NOT_CONFIGURED ili IDLE. Poslednji TICK_OK bio je zastareo. Ti podaci nisu dokaz današnje spremnosti ili potpunog kvara.
2. Potreban kapacitet izvesti iz stvarnog dozvoljenog talasa i drugih događaja. U postojećem vlasniku odabrati bounded loop/batch ili drugo ograničeno rešenje uz ukupni rok, lease, pravičnost SEND/RECEIPT rada i izbegavanje gladovanja. Granice šest leases i 60 claims/s nisu dokaz već implementiranog batch sender-a. Meriti starost najstarijeg posla, zaostatak, drain i uspeh potvrde.
3. Čuvati token-first zaključavanje, session/world/Need/revision kontrole, isticanje, suppression i čišćenje starih provider tickets. Restart i nepoznat provider ishod ne proizvode slepi resend. Idempotentan poslovni događaj ili receipt ne znači garantovanu tačno jednu vidljivu mrežnu isporuku; to ne obećavati u UI-ju ili dokazu.

#### Admission, nezavisne preference i target

Proveriti aktivnu ručnu prijavu iste revizije pre prve opportunity delivery. Deduplikacija već napravljenog događaja ne uklanja semantički nepotrebnu prvu poruku. U zajedničkom vlasniku definisati šta se suzbija za active/withdrawn/rejected/selected, prethodnu reviziju i trku response/dispatch. Ne oslanjati se na istorijski EX06D-F5 označen NOT APPLIED ili fixture bez `worker_account_id`.

PUSH on / IN_APP off ostaju legitiman nezavisan izbor. Message i opportunity tačno odredište treba da koriste odgovarajući PUSH/internal receipt autorizacioni trag, bez potajnog IN_APP opt-in-a. Ne otvarati tuđu, nevidljivu ili isteklu poruku/priliku da bi link izgledao ispravno. Kada cilja više nema, ponuditi pošten dozvoljen opšti povratak; ne nagađati ID. Proveriti obe uloge, isteklu/opozvanu sesiju, zatvoren nalog i blokiranje.

Jedan UI prekidač koji piše REQUESTER pa WORKER treba ili da koristi postojeći atomski autoritet, ili da pouzdano čita oba ishoda i nastavlja samo nezavršen deo. Back mora uzeti u obzir writing/unknown. Prvi uspešan upis ne predstavlja se kao potpun neuspeh, a drugi neuspešan kao potpun uspeh.

#### Grupne poruke, osvežavanje i privatnost

Group sender zadržava osnovni upis poruke, receipt i immutable vidljivost, a dobija potreban događaj i autorizovan target. Ponovljeni isti message receipt ne pravi dupli poslovni događaj. Publika događaja mora odgovarati dozvoljenoj publici poruke; kasniji izlazak/blokiranje ne otvara nedozvoljen pristup. Ne emitovati svim članovima bez provere. Prethodni predlog `group-message-events-20261021` nije dokaz primenjenog emit-a.

Sačuvati Postgres Changes nad `agreement_invalidations_v1(agreement_id,revision)` kao hint za autoritativno ponovno čitanje, uz account/focus/session ograde. Hint nije puna poruka ni ovlašćenje za mark-read. Odsustvo private Broadcast politike nije samo po sebi kvar postojećeg CDC toka. Dovršiti group event/refresh kroz njegovog stvarnog vlasnika.

Refresh u `AgreementChat.tsx` učiniti stvarno vidljivom i dostupnom radnjom ili povući skrivenu fokusabilnu kontrolu uz dostupnu alternativu. `height:0`/`opacity:0` nije politika pristupačnosti. Poseban postojeći error retry ostaje upotrebljiv.

#### Provere i uslov završetka

| Postojeća provera | Kako je koristiti i šta još mora da dokaže |
|---|---|
| `src/data/__tests__/notification-preferences-client.test.ts` | **Sačuvati.** Odvojene postavke, owner/CAS, neizvestan ishod i bez tihog opt-in-a. Ne dokazuje server resolver kada je PUSH on / IN_APP off. |
| `src/data/__tests__/message-push-ingress.test.tsx` | **Sačuvati i dopuniti.** Owned događaj, poslednji tap, unavailable bez nagađanja i hladan foreground povratak. Resolver i native notification su zamene; ne zatvara stvarni provider/device tap. |
| `src/data/__tests__/v5-group-conversation-controller.test.ts` | **Sačuvati.** Čitanje/upis kontrolera, istorija i kasni odgovor/permission granice. Sam message upis ne stvara događaj za obaveštenje. |
| `supabase/proofs/chat/exact_message_event_resolver_proof.mjs` | **Sačuvati nameru; uskladiti očekivanje.** Istorijska stvarna SQL granica eksplicitno odbija suppressed/off IN_APP i PUSH kanal. Ako željena nezavisna PUSH postavka ostaje podržana, potreban je novi bezbedan dokaz cilja; ne uključivati IN_APP potajno. |

Izvršiti mali ograničen burst: jedan primalac je već odgovorio istoj reviziji, drugi nije; PUSH on/IN_APP off; grupna poruka sa tačnom publikom; zatim stvarni dodir notifikacije. Uključiti foreground, background, ugašenu aplikaciju, hladan start, isti događaj, revoked/expired sesiju i odsutan cilj. Namerno isključen push se ne šalje. Istorijski transport koji presreće Expo, koristi jedan uređaj i IN_APP on ostaje lokalni dokaz, ne novi dokaz kapaciteta, nezavisnih postavki ili native tap-a.


### R10 — Život podataka, saglasnosti, izvoz i zatvaranje naloga

#### Problem i traženi rezultat

R10 zatvara F19/SB03 uz R04 potpisanu nameru i R01 dozvole. Korisnikova potvrđena područja rada moraju opstati kroz čuvanje, izvoz i arhivske/reset projekcije; nova verzija pravila zahteva novu saglasnost; opoziv pristupa i završetak brisanja imaju stvarno potvrđen ishod. Aktivacija zatvorenih mogućnosti sledi stvarnu ispravku i proveru.

#### Konkretni vlasnici

- `src/app/(app)/profil/pravna.tsx`
- `src/ui/legal/legalReview.ts`
- `supabase/migrations/20261021104455_closure_taxonomy_archive_copy_coverage.sql`

Aktuelni SQL autoriteti su `private.data_export_worker_candidate_v5(jsonb)`, `data_export_snapshot`, `closure_taxonomy_project_v1`, `closure_taxonomy_inventory_v1`, `closure_redaction_relations_v5`, `closure_redaction_patch_v5`, `closure_taxonomy_snapshot_guard_v1`, `closure_taxonomy_scope_v1`, export/grant/retention/closure komande i `public.rpc_closure_api_guard`. Proveriti i stvarne Storage/Auth executore. Owner je važeće telo i njegov program/policy ugovor, ne naziv starog kandidata.

#### Ispravka projekcija i potpunost kopija

1. U postojeći whitelist `data_export_worker_candidate_v5` dodati validiranu `workAreas` projekciju i pratiti je kroz workerAiDrafts/profile, workerAiReviews/profile i arhivski/reset candidate/review.profile. `workerAiSaves` sa samo reviewId/createdAt nije zamena za celu kopiju profila.
2. Očuvati tip, redosled i stvarno potvrđene COUNTRY/CITY/RADIUS vrednosti iz kanonskog, serverom razrešenog pregleda. U izolovanom canary-ju porediti originalnu nameru, signed review, Save, svaku živu projekciju i arhivsku/reset kopiju.
3. Stari WAR01 paket sa dvanaest funkcija nije nova migracija za slepu primenu. Preuzeti samo relevantno značenje nedostajućeg polja i uskladiti tekućeg vlasnika, njegove dozvole, source/projection/policy/certificate vezivanje i zavisnosti.
4. Šest od sedam DEV snapshot/backup tabela ima tekuće closure/redaction veze. `dev_phase1_20261014_needs_snapshot` čitaju i guard/dinamički scope. Pre njihovog povlačenja razrešiti retention i potreban istorijski dokaz, prevezati inventare/guard/scope i ponovo proveriti izvoz i brisanje. Odsutna kvalifikovana referenca za catalog snapshot nije dokaz odsutne operativne potrebe. Puni SV10 i tačna lista svih sedam meta nalaze se u §7.3 i `dokazi/server_final/change_manifest.json`; zasebna KEEP reset arhiva nije meta ovog povlačenja. Pre promene proveriti tadašnje objekte i njihove zavisnosti.

#### Saglasnost, autorizacija i odbijanje nespremnog rada

Za legal-v1 unknown → legal-v2 tok autoritativno završiti ili otkazati prethodni pokušaj, pa tražiti izričitu potvrdu novog TERMS/PRIVACY hash-a. Jedan ABSENT ne dokazuje da zahtev neće naknadno stići. Stari request ne sme potvrditi novi dokument, a ekran ne sme zauvek ostati u READ_REQUIRED bez bezbednog nastavka.

Novi export zahtev bez važećeg binding-a mora ostati odbijen pre upisa zahteva, uz tačno objašnjenje. Sačuvati idempotent replay, exact snapshot, owned download i autorizaciju pre vraćanja bajtova. Testirati strani nalog, ponavljanje, revoke/download grant i zakašnjeli pokušaj; opozvan pristup se ne oživljava starim request-om.

Revizija 7 je dokumentovala false retention-source/export/erasure binding. Ne menjati očekivani digest, certifikat ili flag samo radi zelenog statusa. Zatvoriti projektore, kopije i odgovarajuće semantičko vezivanje pa izvršiti proveru tekućeg sadržaja. Dugme koje stalno odbija obavezan korisnički postupak nije završen javni proizvod.

#### Brisanje i odvojene sistemske granice

Brisanje ima zaseban dokaz svih relevantnih kopija, medija/voice, Storage i Auth koraka. Ne izjednačavati uredno dostavljene export bajtove sa potpunim izvozom niti uspešan export sa izvršenim brisanjem. Finalizovati tek nakon nezavisnih potvrda potrebnih operacija; jasno prikazati status, rok i dozvoljeno zadržavanje.

Sačuvati privatne buckete i stvarne MIME/size granice, owner-prefix i restrictive/account-open politike, immutable server putanju, hash/veličinu, generation/lease, jednu priznatu dispatch nameru i pozitivan readback. U reviziji 7 su profile-media 5 MiB, agreement-voice 4 MiB i data-export-artifacts 8 MiB; pre promene proveriti tekuća podešavanja. Unknown upload nije dovoljan razlog za novi POST ili brisanje journal-a.

Data API pre-request hook ne zatvara automatski Storage/Realtime niti dokazuje erasure spremnost. Testirati te granice odvojeno. Potpuna Auth management konfiguracija nije prethodno potvrđena; efektivne session/redirect/SMTP/provider vrednosti proveriti kroz podržan pristup. Cityless REMOTE aktivacija ostaje zasebna poslovna promena, jer review/activation i submit/select imaju sopstvene city uslove; ne uvoditi je kroz izvoz.

#### Provere i uslov završetka

| Postojeća provera | Kako je koristiti i šta još mora da dokaže |
|---|---|
| `src/data/__tests__/p1-legal-client.test.ts` | **Sačuvati i dopuniti.** Bundle decode, stabilan request i poruka o version drift-u. Dopuniti unknown prihvat starog bundle-a nakon pojave novog sadržaja u montiranom UI toku. |
| `src/data/__tests__/p2-data-export-delivery-client.test.ts` | **Sačuvati.** Auth/transport rokovi, neizvestan upis i exact streamed bytes. Uspelo byte delivery ne dokazuje potpunost polja celog izvezenog naloga. |
| `supabase/proofs/legal/p1_legal_consent_proof.mjs` | **Sačuvati nameru; uskladiti alat sa sadašnjim vlasnikom.** Istorijski lokalni server consent/replay dokaz. Nije current UI unknown readback niti celokupan pravni lifecycle. |
| `supabase/proofs/legal/p2_data_export_proof.mjs` | **Sačuvati nameru; uskladiti alat sa sadašnjim vlasnikom.** Istorijski local export/grant/race dokaz nad tadašnjim roster-om. Stari dataset spisak ne obuhvata novo workAreas polje ni sve današnje arhivske kopije. |

Najmanji izvršni skup: sintetički profil sa svim podržanim tipovima workAreas; potpun autorizovan izvoz i poređenje svih kopija; strani nalog; revoke i kasni download; ponovljeni zahtev; zaseban legal-v1 unknown → v2 montirani UI; završetak account closure uz sve relevantne kopije. Nespremni binding ostaje zatvoren tokom negativne kontrole.

Istorijski P1 v1→v2 server dokaz ne zatvara SB03 UI; P2 tadašnji roster ne obuhvata nova workAreas/sve sadašnje arhive; P3 ograničeni AI_ABANDONED_UNBOUND adapter ne dokazuje ceo account closure; stari P4 READY nije današnja dozvola aktivacije. Očuvati korisne grant/race/lock dokaze, a proširiti samo promene i nedostajuće granice.


### R11 — Ostali ekrani, oporavak i kontrolisano čišćenje

#### Zajednički rezultat i granica rada

R11a–h zatvaraju konkretne preostale SB/X nalaze i povezane regresije. Svaki podzadatak dobija ekran/radnju iz inventara ovog plana, stvarnog reader/writer vlasnika, prikaz potrebnih stanja i dokaz korisničkog ishoda. Funkcionalno dovršavanje odvaja se od uslovnog povlačenja istorije; potpuna reorganizacija svakog starog fajla nije preduslov za popravljanje aktivnog ekrana.

Sačuvati `useOwnedEditor`, journal-e, signed review, autoritativni readback, lifecycle/ACK zaštite, primenjenu SQL istoriju i aktivne formattere. Cleanup C01–C19 iz posebne sekcije ovog istog plana određuje tačne jedinice promene. Broj 912 znači uslovne odluke pri povlačenju, ne broj fajlova za brisanje; 180 putanja uključuje ciljne i kontrolne fajlove. Puni registar svih putanja dostupan je u `dokazi/registar/consolidated_read_register.json`; njegova uslovna preporuka nije dokaz da je deo već mrtav ili bezbedan za brisanje.

#### R11a — Početna i navigacija; SB01 i SB11 regresija

**Vlasnici:** `src/ui/home/HomePresentation.tsx`, `src/app/(app)/index.tsx`, `src/app/(app)/moje-prijave.tsx`. Prečica iz moje prijave vodi na postojeću javnu `/prilike/[id]` rutu; owner put ostaje samo za sopstveni zadatak. Ne menjati serverske dozvole da bi pogrešno odredište proradilo.

Proveriti ulogu, ID, povratak i stanje sesije na početnoj, javnom detalju i listi prijava. Prikaz promenjenog sadržaja ne sme biti blokiran zastarelim search stanjem. SB11 glavno rešenje ostaje u R02: `src/data/discoveryV1SearchOwner.ts`, `src/ui/v2/discovery/recentSearches.ts`, `src/ui/v2/detail/useTaskFit.ts`. Decode izuzetak završava busy; recent nalog postaje loaded tek nakon prihvaćenog čitanja ili dobija ponovljiv fallback; fit ključ obuhvata relevantan mode/pin/kraj/reviziju. Odgovori obrnutim redom ne menjaju noviji upit. Nalaz nije dokaz da je živi PLACES već poslao neispravan odgovor.

#### R11b — Ocene i javni komentari; SB02/SB09

**Vlasnici:** `src/ui/reviews/useGivenRatings.ts`, `src/ui/reviews/useReceivedReviews.ts`, `src/app/(app)/profil/ocene.tsx`, `src/data/focusedResource.ts`, `src/ui/reviews/ReviewCommentField.tsx`, `src/ui/reviews/ReviewCommentsSection.tsx`, `src/ui/system/PublicProfileSheet.tsx`, `src/data/reviewCommentsClientService.ts`.

Invalidirati posle potvrđenog upisa ocene i obnoviti prvu stranu primljenih ocena na definisan povratak. Isti skup završenih Dogovor ID-jeva nije dokaz da su ocene nepromenjene. Čuvati account/revision granice i poslednji dobar sadržaj pri privremenoj grešci.

Povezati već obećani javni komentar sa dozvoljenim javnim čitačem/prikazom. Context/submit i rating tok ostaju aktivni. Promena publike ili ukidanje obećanja zahteva konkretnu poslovnu odluku, ne prikriven cleanup. Dokaz uključuje novu ocenu uz iste ID-jeve, refocus, javni/sopstveni profil i stvarnu vidljivost komentara; props test sopstvenog profila ne zatvara javni tok.

#### R11c — Mediji, safety i život naloga; SB04/SB05/SB15/X01/X06

**Vlasnici:** `src/features/voiceMessages/voiceMessageComposer.ts`, `src/data/agreementVoiceClientService.ts`, `src/data/voiceBinaryRead.ts`, `src/data/serverReceipt.ts`, `src/hooks/useAgreementPhotos.ts`, `supabase/functions/uskoci-media/index.ts`, `supabase/candidates/chat_voice_b1a_feature_chain.sql` kao istorijski ugovorni trag, `src/app/(app)/profil/fotografija.tsx`, `src/ui/profile/ProfilePhotoPresentation.tsx`, `src/ui/media/useTaskPhotoUploads.ts`, `supabase/functions/uskoci-ai-interview/index.ts`, `src/data/aiNeedV2Production.ts`, `src/app/(app)/nova.tsx`, `supabase/migrations/20260913044510_clean_v5_unknown_ai_turn_exit.sql`, `src/ui/safety/SafetyScreen.tsx` i `src/ui/safety/blockOutcome.ts`.

- Voice ABSENT posle pokušaja ne uklanja trajni identitet pre server cancel/reconcile. Pokazati PROCESSING/STAGED i bezbedan oporavak. Spoljašnji 15 s i unutrašnji 30 s rok usaglasiti kroz jednog timeout/abort vlasnika, umesto međusobnog prekidanja.
- Avatar sa sačuvanim UPLOAD journal-om i izgubljenim RAM bajtovima prvo proverava/otkazuje stari pokušaj prema avatar ugovoru. Tek potvrđen završetak oslobađa novu selekciju. Server-primljen upload može biti oporavljiv; conversation-only task photo API ne kopirati kao avatar rešenje.
- Photo-only claim i completion dobijaju isti kanonski tekst i attachment identitet/hash. Čuvati zaštitu od promene sadržaja pod istim ključem. Stara handler proba bila je sintetički 502 naspram tekstualne 200 kontrole, uz nepromenjena relevantna tri fragmenta; nije dokaz kvara svake fotografije niti trenutno izvršene cele Edge verzije.
- Nevažeći lokalni safety ključ dobija konkretan kontrolisan oporavak samo korumpiranog zapisa. Važeći UNKNOWN zahtev mora zadržati server reconciliation; ponavljanje saveta „otvorite ekran” nije oporavak.
- Neposredno pre prikaza potvrđenog toast-a ponoviti account/revision/lifecycle proveru. Postojeći Undo već ima account/revision ograde i ostaje. Ovo je problem veka prikaza, ne dokaz neovlašćenog upisa.

Proveriti restart sa izgubljenim bajtovima, ABSENT i kasni claim, uspešan server upload, retry/proveru, odjavu, A→B→A i dva konteksta istog naloga. Memorijski mock koji vrati STAGED nije dokaz gubitka procesa. Media i život podataka ostaju povezani sa R10, bez slabljenja Storage privatnosti.

#### R11d — Neposlati nacrti i delimični upisi; SB06/SB07/X02

**Vlasnici:** `src/ui/support/useSupportController.ts`, `src/ui/support/SupportDetailScreen.tsx`, `src/ui/support/SupportNewScreen.tsx`, `src/ui/agreements/AgreementActionsScreen.tsx`, `src/ui/agreements/agreementActionsModel.ts`, `src/ui/v2/draftSummary.ts`, `src/app/(app)/profil/podaci.tsx`, `src/ui/profile/writeWorkName.ts`.

Razdvojiti neposlat nacrt od poslate trajne komande. Nacrt podrške i odgovor preživljavaju običan background/povratak prema dogovorenom veku; nameran izlazak dobija razumljivu odluku. Posle potvrđenog slanja i pri promeni naloga privatni nacrt se čisti prema vlasniku, bez prenosa drugom nalogu.

Razlog/predlog izmene Dogovora vezati za account, agreement i version. Pri povratku očuvati sadržaj i obnoviti važeći review. Start-only termin usaglasiti kroz model, writer, read i UI; samo uklanjanje uslova `validProposal` nije potpuna podrška. Ne nametati kraj gde važeći ugovor dopušta nepoznat kraj.

Za upis requester pa worker imena koristiti jedan postojeći autoritet ili usku trajnu/revision-aware koordinaciju. Remount mora prepoznati delimičan ishod i završiti samo dozvoljeni nedostajući deo. Potvrđen displayName uz nerešen drugi upis nije ceo uspeh; oporavak ne prepisuje novije ime.

Provere uključuju blur/focus, Back, remount, pozadinu, paralelnu izmenu i prvi-upis-uspeo/drugi-unknown. Postojeći group draft dokaz ne prenosi se automatski na support/Dogovor editore.

#### R11e — Vreme, mapa, native raspored i animacije; SB12/SB13

**Vlasnici:** `src/ui/v2/ApplicationComposerPresentation.tsx`, `src/ui/v2/MyApplicationsPresentation.tsx`, `src/ui/agreements/agreementListModel.ts`, `src/ui/agreements/AgreementActionsPresentation.tsx`, `src/ui/v2/DiscoveryPresentation.tsx`, `src/ui/v2/discovery/mapControls.ts`, `src/ui/location/LocationPointEditor.tsx`, `src/ui/location/ResolvedPinMap.tsx`, `src/ui/entry/EntryWelcome.tsx`.

Usaglasiti prikaz/izmenu vremena jednom eksplicitnom poslovnom politikom i jasno označenom zonom, uz očuvan stvarni UTC instant. Proveriti uređaj u drugoj zoni, promenu sata, lokalni datum, danas/kasnije i početak bez kraja gde je dozvoljen. Jest podešen samo na UTC može prikriti razliku; promena prikaza ne sme promeniti stvarni ugovoreni trenutak.

Uskladiti Nearby tekst sa kamerom, dostupnost kontrola i panel insets; očuvati odgovarajući pin nacrt kroz blur. Razdvojiti stil/raster readiness od funkcionalnog SVG pina/drag-a gde to stvarni vlasnik dozvoljava. Nevidljivi raster trenutno može upravljati drag-om i neuspehom cele pin mape; ne uklanjati ga pre native dokaza. To nije isti potvrđeni uzrok kao F16.

Proveriti reduced-motion pri promeni postavke i životnog ciklusa, povratak, mali ekran, veći tekst, tastaturu i dostupnost svih glavnih radnji. Fiksna skeleton aritmetika i Text stubovi tabova ne dokazuju Yoga/native geometriju, MapLibre kameru ili stvarni gest. Koordinisati F16 regresiju sa R02 i različita značenja dve mape sa R08.

#### R11f — Strogi dekoderi i zajednička konfiguracija; X03/X04

**Vlasnici:** `src/data/applicationClientService.ts`, `src/data/ru4Production.ts`, `src/app/(app)/moje-prijave.tsx`, `src/data/supabaseClient.ts`, `src/data/authAvailabilityClientService.ts`, `src/data/productionLocationResolver.ts`, kao i stvarni povezani read/stream potrošači.

Na servisnoj granici odbiti NaN/Infinity i nedostajuća ili nevažeća obavezna receipt polja; klijentu dati jedinstven tačan tip. Dodatna zaštita u moje-prijave ostaje; njen dokaz ne preimenovati u već opažen lažan uspeh. Pozitivne kontrole uključuju nulu/validnu granicu gde domen to dozvoljava i kompletan receipt.

Sve potrošače vezati za isti postojeći konfiguracioni autoritet i isto pravilo dozvoljenog fallback-a/obaveznog env-a. Nedoslednost source-a nije dokaz da env nedostaje u instalaciji. Proveriti build i konfiguracije koje su stvarno podržane; ne dodavati drugi paralelni config servis.

#### R11g — Namenski proof build i provera samih proverivača; SB14

**Vlasnici:** `app.config.js`, `package.json`, `scripts/check-eas-preview.cjs`, `scripts/verify-native-patches.cjs`, `.github/workflows/ci-clean.yml` i dole imenovani proof/test fajlovi.

Usaglasiti proof flag sa plugin/native patch ugovorom i aktuelnom granom/workflow putanjom. Sačuvati consent i proveru nativnih patch bajtova. Istorijski preview PASS/proof FAIL nije kvar običnog APK-a ili `npm ci`, niti je razlog da se zaštita isključi.

Istorijski proverivač popraviti i ponovo izvršiti kada se koristi za zaključak ovog izdanja ili za promenjenog aktivnog vlasnika. Ako nije deo potrebne dokazne putanje, zadržati ga jasno vezanog za istorijski izvor ili povući prema C15; sređivanje svakog starog harness-a nije uslov objave.

| Konkretan proverivač | Potrebna korekcija ili tačna granica |
|---|---|
| `supabase/proofs/dynamic_taxonomy/gemini-real-provider-smoke.mjs` | Obavezno prisustvo i validan `classificationShadowJson` pre PASS-a; odsutno polje ne preskače proveru. Stvarni provider se ne poziva radi popravke ove statičke rupe. Smoke ne dokazuje ceo Save/binding. |
| `supabase/proofs/dynamic_taxonomy/need-review-signed-source.test.mjs`, `supabase/proofs/dynamic_taxonomy/worker-signed-review-source.test.mjs`, `supabase/proofs/dynamic_taxonomy/classification-gemini-shadow-source.test.mjs` | Sačuvati source ograde, ali staged string/regex ne nazivati izvršenim potpisom, transakcijom ili modelom. Aktuelnu integraciju vezati za stvarno migrirani owner. |
| `src/data/__tests__/worker-profile-read.test.ts` | Foreign/late Auth no-query tvrdnju postaviti na stvarni `mockRpc`, ne nepovezani `mockFrom`. Odbijanje rezultata i dokaz da poziv nije poslat proveravaju se odvojeno. |
| `supabase/proofs/d12/d12_proof.mjs` | Sačuvati stvarni P5 tok; završni PASS mora zahtevati sve obavezne grane bez neoznačenog seed/loader/ratingDue fallback-a, gaps/residuals/notVerified. Ne tvrditi da je konkretan istorijski run koristio fallback bez dokaza. |
| Istorijski EX06 S03/S04 i CUR01 proverivači | PARTIAL/SMOKE_ONLY/skip nije PASS cele situacije. Zahtevati stvarne preduslove, redove, očekivani suppression razlog, tačan stage i NULL-safe kardinalnost. `proof_stage=NULL` ne preskače obaveznu granu. |
| EX06 S04 `lib/sql.mjs` i READ_BUILDERS | SELECT koji poziva `private.emit_event` može upisati događaj; odsustvo INSERT/UPDATE/DELETE reči nije read-only dokaz. |
| `ex06b_lib.test.mjs` i stari P6 harness-i sa povučenim workflow-om | Proveriti stvarnu punu putanju u novom checkout-u pre poziva; rebase na aktuelnog CI caller-a ili istorijski pin. Obrišeni `.github/workflows/ex06b-alias-proof.yml` ne oživljavati radi starog testa. |
| EX05 S01 renderer i slični wrapperi | Vezati tačan runId, source/hash i obavezne nonempty checks; poslednji isti basename ili `result=PASS` nije dovoljno. RECORDED reprodukcija ostaje reprodukcija. |
| Frozen AI manifest; EX07/S06 byte check | Zastareo FROZEN_SOURCE_CHANGED označiti kao neupotrebljiv trenutni dokaz. Razdvojiti normalizovan CRLF check od stvarne raw-byte jednakosti; generator koji normalizuje CRLF ne daje bajtno identičan dokaz. |
| EX07/S03 native/provider i near-miss probe | E12 recovery, P14 opoziv i OS zadržavanje URL-a ostaju OBSERVATION dok se ne izvedu. Trigger koji izostavlja src promene ne pokriva novu izmenu klijenta. Prazna accepted lista iz pogrešne EXACT/FOREIGN_ECHO transformacije nije negativni dokaz; proveriti raw variants. |
| RLS-components/world-guard dijagnostika | Ukloniti ponavljanje istog PK uzorka po fazama i bare SQL echo umesto stvarnog psql poziva, tek nakon čitanja konkretne skripte. To su kvarovi alata, ne dokaz kvara današnjeg proizvoda. |

Šire porodice dokaza čuvaju sledeće granice: P6 direktni replica fixture-i nisu pravi publish; 30k/720 SQL uzoraka ili do 40k zadataka i 32 petlje nisu isto toliko korisnika, native dokaz ili produkcioni SLA. Repeatability može proći uz neuspešan performance screening. B24 stand-in trigger/istorijski deadlock nije tekući poslovni gate. B3c lokalne Auth/websocket/CDC expiry/revoke/closure provere imaju vrednost, ali ne dokazuju uređaj ili punu sadašnju erasure/export spremnost. AF22/Auth/Storage canary nije pravna sertifikacija. B1b Media Edge Auth je emuliran; stari roster ne zatvara F19. Provider mock, 12-byte JPEG ili stable ID nije prava slika, živi model ili izvršena konkurencija.

Čuvati stvarne holder/waiter, RLS, lock, receipt i negativne kontrole gde ostaju važeće. Stari ACL/pin drift proveriti prema tekućem telu i nameri, ne označiti svaku razliku regresijom. D03/promocija push-a i kasniji D12 već imaju istorijske primene; stale naslov SOURCE_ONLY/NOT APPLIED ne poništava kasniji dokaz. Inbox postoji sa aktivnim caller-om; CRLF i ACL delta vode se odvojeno. Već primenjenu zaštitu ne proglašavati nepostojećom.

Pre istorijskog harness-a proveriti prvu mutaciju, environment guard, sopstveni fixture scope i finally/rollback. p0d03/ru1 mogu DROP, pkg010/EX06 menjati cron ili prekidati backend; takve skripte idu samo na potvrđeno sopstveno izolovano okruženje, sa guard-om pre mutacije, ograničenim rokom i vraćanjem stanja. Prazan/NULL rezultat, optional assertion ili fallback ne mogu dati završni PASS. Ne izvršavati stari kontrolni patch koji menja lock redosled preko novijeg advisory → conversation → asset ugovora i ponovljenog owner čitanja.

#### R11h — Demo izolacija i ciljano povlačenje; X05

**Vlasnik:** `src/data/lazniIzvor.ts`. Izdvojiti početni fixture i pri reset-u obnoviti sve promenljive kandidate i povezane kolekcije, uključujući prijavom dodate elemente. Proveriti ponovljeni reset i nezavisnost testova. Ovo je demo/test izolacija, ne produkcioni upis.

C01–C19 primenjivati po tačnoj putanji/simbolu: odluka, trenutni caller, aktivna zamena, kompatibilnost, prevezivanje i dokaz. Ne dodavati novu funkciju da bi se opravdao nepovezan prototip. Za requester izbor čuvati memorijski `session.pending`, zamrznutu komandu, isti ključ i `readSelectedAgreement`; ne predstavljati ga kao postojeći trajni journal preko gašenja procesa. Odvojeni trajni `applicationCommandJournal` pripada radnikovoj prijavi. Sačuvati `publicTrustFacts`/`memberSincePhrase` i aktivne formattere kada se povlače stats/registry/manual alternative.

Pravilo **Samo poruke (A25)** zatvoriti kroz server/API i podržane stare klijente: `src/data/contactClientService.ts`, `src/data/ports.ts`, `src/ui/agreements/AgreementContactPlace.tsx`, `rpc_set_contact_grant`, `rpc_reveal_contact`, `grant_is_ownable`. Nova PHONE saglasnost/reveal se povlači uz istorijsku revokaciju i receipt kompatibilnost; EXACT_LOCATION i phone OTP prijava su drugi ugovori. Ne dodavati zabranu slobodnog teksta broja u poruci bez posebne poslovne odluke.

#### Zajedničke postojeće provere i završetak R11

| Postojeća provera | Kako je koristiti i šta još mora da dokaže |
|---|---|
| `src/ui/reviews/__tests__/use-given-ratings.test.tsx` | **Ispraviti očekivanje keša; sačuvati scenario.** Čitanje/greške i postojeće pravilo da isti Dogovor ID-jevi ne čitaju nove ocene. 51–55 treba dopuniti stvarnom novom ocenom uz iste ID-jeve i očekivanim invalidiranjem, ne samo remount-om iste liste. |
| `src/data/__tests__/worker-profile-read.test.ts` | **Popraviti proveru.** Mapiranje profila i odbijanje stranog/kasnog Auth rezultata. Negativni no-query assertion proverava mockFrom iako aktivni port koristi mockRpc. |
| `src/ui/support/__tests__/SupportScreens.test.tsx` | **Sačuvati i dopuniti.** Privatan support formular i retained callback/command guard. Dopuniti unsent tekst kroz blur/focus/remount prema odobrenoj nameri, ne pretpostavljati da ga drugi editor čuva. |
| `src/data/__tests__/urgent-hidden-in-v1.test.tsx` | **Sačuvati.** V1 build bez flag-a nema HITNO, čak i ako legacy podaci postoje. Jest setup globalno uključuje legacy flag; ovaj poseban test ga namerno uklanja. |

Za ostale imenovane vlasnike dopuniti njihov stvarni postojeći test ili najmanji potreban slučaj posle čitanja aktuelnog koda; ne izmišljati da već postoji test pod proizvoljnim novim nazivom. Konkretno proveriti medijski restart, neposlat support/Dogovor tekst, delimično ime, safety recovery, stvarnu zonu, map drag i nevidljivu kontrolu. Uspeh jednog editora ne dokazuje drugi.

Posle povlačenja proveriti import/require, package skripte, CI eksplicitne ulaze, Jest glob, TypeScript includes, postinstall i asset generatore. Archive ime samo ne isključuje izvršavanje. Dependency se uklanja tek kada nema potrebnog runtime/build/test potrošača. Meriti stvarne putanje, selekciju/broj testova, trajanje u istom okruženju i install/type/build; native resursi traže uređaj. Ne obećavati APK uštedu iz broja repo bajtova.


### R12 — Stvarna celina, native kandidati i objavljivanje

#### Cilj i dokazna granica

R12 povezuje rezultate relevantnih obaveznih zadataka od prve popravljene celine. Njegov završetak je jedna poznata isporučena kombinacija source-a, SQL/ACL-a, Edge sadržaja, konfiguracije, native build-a i učitanog OTA-a, na kojoj oba korisnika završavaju posao. Zeleni offline CI, isti broj verzije ili stara fotografija nisu taj dokaz. Ovo je izvršni plan; novi model/uređaj/izdanje nisu izvršeni njegovim pisanjem.

#### Podzadaci R12a–j i veza sa istim izdanjem

Ovo su radne jedinice postojeće R12, ne novi paralelni backlog. Svaka čuva dokaznu granicu R12 i status iz jedinstvene tabele kapija u odeljku 10.5. Android i iOS mogu napredovati različitim tempom; dokaz jedne platforme ne zatvara drugu. Produkcijske, preview i proof zaštite ostaju delotvorne dok novi nameravani ugovor nije odobren, izveden i proveren.

| Podzadatak | Konkretan posao i zavisnost | Mesto detaljnog ugovora i minimalan izlaz |
|---|---|---|
| **R12a — Presek i opseg** | Poznat source/lock, SQL/ACL, Edge, javna konfiguracija, native/potpis, OTA i obećane funkcije po platformi; bez tajni. | §10.2: jedan identitet kandidata, sa primenljivim kapijama i jasno označenim nepoznatim podacima. |
| **R12b — Produkcioni backend i obnova** | Odvojen potvrđen projekat, izolovan bootstrap i upgrade, stvarna prava/Auth/Storage/Realtime/cron i lifecycle bindings; veza R01/R09/R10/SV. | §10.3: reprodukcija i oporavak uz očuvane podatke, klijente i izričit izlaz iz DEV TEST sveta. |
| **R12c — Profili, build zaštite i servisni identitet** | Uskladiti postojeći production guard, globalni EAS preinstall i odobrene platformne profile; backend/package/runtime/channel, Firebase/FCM/APNs i odgovarajuće zastavice. | §10.3.1–10.3.2: izvršna pozitivna/negativna matrica, bez globalnog gašenja guard-a ili pretvaranja DEV URL-a u produkciju. |
| **R12d — Android artefakt** | Potpisan AAB, stvaran target/compile SDK, native biblioteke, primenljiva 16 KB podrška, dozvole i paket koji Play isporučuje. | §10.7: artefakt i uređajski dokaz; versionCode, Expo verzija i lokalni APK nisu zamena za target/native proveru. |
| **R12e — iOS artefakt i funkcije** | Bundle ID/provisioning/capabilities/APNs, odobren build profil i stvarni native tokovi. Aktivni AI capture je sada Android-only; puni obećani iOS opseg traži implementaciju i dokaz govora. | §10.8: poseban iOS artefakt/uređajski prolaz. Uži opseg zahteva izričitu odluku; Dogovor glasovni prilozi imaju zasebnu proveru. |
| **R12f — Privatnost, brisanje i sadržaj** | Stvarna AI obrada/saglasnost, podaci i SDK deklaracije, funkcionalan lifecycle i obavezni in-app/web ulazi, prijava/blokiranje i obrada sadržaja. | §10.6: izvršen ciljni tok sa dopuštenim retention granicama; nespreman binding se sadržajno zatvara, ne zaobilazi. |
| **R12g — Obe uloge, prekidi i nadogradnja** | Dva naloga/telefona, svi primarni tokovi, restart/dozvole/prekidi, podržana nadogradnja i očuvanje dozvoljenih nacrta/komandi. | §10.4: isti merodavan rezultat kod obe uloge; nema duplog efekta, gubitka potvrđenog sadržaja ili tuđeg čitanja. |
| **R12h — Materijal za pregled** | Izdavački identitet/kontakti, stvarni snimci, listing, podaci/uzrast, javni linkovi, review pristup i reprezentativan sadržaj. | §10.6–10.8: pregledljiv paket koji odgovara stvarnom kandidatu i omogućava obe uloge. |
| **R12i — Predaja i javno izdanje** | Odvojeni statusi spremno/podneto/odobreno/objavljeno/provereno posle objave; track, odgovorni izdavač, rollout i povratak/kompenzacija. | §10.9–10.10: stvarni status konzole i važeće ovlašćenje za predaju/objavu. Sam plan to ne odobrava. |
| **R12j — Operativni rad** | Odgovorni za podršku, privatnost/brisanje, sadržaj, queue/provider greške, trošak i incident; poznati pragovi i način reakcije. | §10.3.3 i §10.9: vlasnik/status/datum/dokaz spoljnih zavisnosti i stvaran proces reakcije bez privatnih payload-a u logu. |

#### Konkretni vlasnici

- `app.config.js`
- `app.json`
- `eas.json`
- `scripts/build-contract.cjs`
- `scripts/build-identity.cjs`
- `supabase/migrations/20261021101527_staged_task_replacement_noop_guard.sql`
- `supabase/migrations/20261023210000_matching_work_areas_and_public_grants.sql`
- `README.md`
- `STATUS.md`
- `package.json`
- `.github/workflows/ci-clean.yml`
- `scripts/check-eas-preview.cjs`
- `scripts/verify-native-patches.cjs`
- `src/data/nativePushDevice.ts`
- `src/features/voice/useHoldToTalk.ts`
- `src/features/voice/nativeSpeechAdapter.ts`
- `src/features/voice/expoPcmCapture.ts`
- `modules/uskoci-voice/expo-module.config.json`
- `supabase/migrations/20261021101159_staged_task_replacement.sql`
- `supabase/migrations/20260901105922_clean_completion_and_writer_authenticated_proof.sql`
- `supabase/migrations/20260901113333_clean_ai_interview_turn_authenticated_proof.sql`
- `supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql`

Pripadaju mu i tačni stvarno izmenjeni SQL/Edge/native vlasnici prethodnih R zadataka; konačni manifest ne može se svesti samo na četiri konfiguraciona fajla.

#### Jedan identitet isporuke i osvežavanje

R12 popunjava jedan zapis identiteta izdanja iz odeljka 10.2 ovog plana. Svi slojevi moraju pripadati stvarno proverenom kandidatu; u zapis ne ulaze tajne ni privatni payload-i.

Istorijski a969 izvor, fcef803 oznaka sa telefona, NEED151/WORKER104/post-save5 razlike i push37 parity ostaju presek revizije 7 dok se ne osveže. About oznaka nije izvučen ceo APK; 69 commit-a nije 69 popravki. Ne tražiti ponovo iste tri slike; novi dokaz tražiti samo za novu verziju ili nedostajući native/flag/request podatak. Screenshot i test moraju pripadati istoj proveravanoj kombinaciji.

Pročitati tadašnje README/STATUS/governance i deltu pre izmene/integracije. Ne vraćati staru granu/backend ili nepročitan Downloads masterplan iz memorije. Pre nego što se zameni/povlači server ugovor definisati podržani minimum klijenta i proveriti stare aktivne ulaze. Kritična privatnost se ne odlaže zbog stare verzije.

#### Prazan bootstrap, nadogradnja i oporavak

R12 sprovodi dva odvojena puta: bootstrap novog izolovanog okruženja i upgrade postojećeg. Jedinstvena tabela tri fixture migracije, tačni preduslovi i granice dokaza nalaze se u odeljku 8.4; podaci o ledger/source poreklu i tri CRLF razlike u odeljku 7.4. Proveriti stvarne funkcije, potpise, ACL/default prava, RLS, triggere, indekse i referentne podatke, uz odvojeno dokumentovanje snimljenih statements, originalnih bajtova i današnjih tela.

Široki `service_role` grant proveriti kao efektivnu dozvolu, ne zaključiti iz samog zapisa primene. Primenjenu istoriju ne prepravljati niti ponavljati tri promene radi usklađivanja broja. Stvarni upgrade čuva podatke i podržane klijente. Postupak oporavka iz odeljka 10.3 mora biti izvediv za pogođeni sloj: OTA rollback ne vraća šemu i poslovne podatke; stari rollback.preimage bez SQL terminatora ostaje evidencija, a ne automatska revert komanda.

#### Cela upotreba i merenje

R12 izvršava celovit dvostrani scenario iz odeljka 10.4, prihvatne slučajeve A01–A25 i dokaznu matricu ekrana iz odeljka 3.5. Zapis provere sadrži polja iz odeljka 8.5. Pogođena platforma dobija svoj fizički uređajski dokaz, uz kontrolisane prekide i potvrđen rezultat druge uloge. A24 čuva atomsku zamenu, a A25 server/starog klijenta i zasebnu lokacijsku dozvolu.

Zasebno potvrditi da opoziv account/session pristupa deluje i na već otvorenim odgovarajućim kanalima. Sam Data API hook ne potvrđuje Storage/Realtime granicu; stare lokalne lock/Auth/WebSocket probe zadržavaju svoj stvarni obim. Vreme, trošak, hladno/toplo stanje i kapacitet mere se po jedinstvenoj metodologiji iz odeljka 8.6, bez sabiranja neuporedivih istorijskih rezultata.

#### Postojeće provere i nivo rezultata

| Postojeća provera | Kako je koristiti i šta još mora da dokaže |
|---|---|
| `.github/workflows/ci-clean.yml` | **Sačuvati aktivni CI uz tačan nivo dokaza.** npm ci/native patch; tsc; Deno check bez izvršavanja; Jest; izabran Node; Python source integrity. Nema izvršavanja stvarnog modela, migrirane baze, build/deploy ili telefonske putanje. To je namerni offline gate, ne release-ready dokaz. |
| `supabase/proofs/ai/clean_ci_coverage.test.mjs` | **Sačuvati; dopuniti relevantan manifest.** Regex proverava Deno komandu i sedam izričitih Node puteva; odbija secrets/deploy/continue-on-error. Ne proverava sav relevantni Node test korpus ni produkcijski ishod; dopuniti samo zadatkom odabrane neophodne testove. |
| `supabase/proofs/d12/d12_proof.mjs` | **Sačuvati stvarni osnovni tok; popraviti završni kriterijum.** Stvarni poslovni P5 i jasne istorijske gap beleške imaju vrednost. Konačni result zavisi od failures/skipped, ne svih gaps/notVerified; kompletna readiness tvrdnja zahteva obavezne grane bez fallback-a. |
| `scripts/check-eas-preview.cjs` | **Uskladiti konfiguracionu proveru.** Sadašnji globalni EAS preinstall prihvata samo tačan Android preview. R11g zatvara namenski proof/plugin nesklad, a R12c uvodi i dokazuje sve namerno podržane profile/platforme; ne isključuje postojeću ogradu. |
| `src/data/__tests__/pkg002-app-config.test.ts` | **Sačuvati i dopuniti samo relevantan rizik.** Trenutno proverava permission copy, map/location konfiguraciju i overlay zabranu; nije potpuna EAS/production matrica. |
| `src/data/__tests__/build-identity.test.tsx` | **Sačuvati.** Bounded javni identitet, prikaz native/OTA podataka i neizmišljanje backend release-a; mock podaci ne dokazuju šta je stvarno instalirano ili objavljeno. |
| `src/data/__tests__/ex04-test-page-limit-guard.test.ts` | **Sačuvati proizvod/test granicu.** Obavezni paged reader flagovi ostaju, a test page instrument ne ulazi u release profile. Ne oslabiti proveru pri širenju build ugovora. |
| `src/data/__tests__/native-push-device.test.ts` | **Sačuvati saglasnost i scope provere.** Sintetički token/native portovi proveravaju lokalne odluke; ne dokazuju FCM/APNs, registraciju na živom serveru ili uređajsku isporuku. |
| `src/features/voice/__tests__/nativeSpeechAdapter.test.ts`; `src/features/voice/__tests__/holdToTalk.test.ts` | **Sačuvati relevantne postojeće kontrole.** Android/sintetički adapter i controller nisu iOS mikrofon dokaz. Pri implementaciji iOS-a proširiti stvarne platformne odluke, a native capture/interruption/permission završiti na uređaju. |

Pozitivne i negativne profile proveriti kroz stvarni izvršni validator, ne kopiranjem njegovih stringova u test. Proširiti postojeće vlasničke provere; mali novi config-contract test opravdan je kada postojeći ulazi ne mogu obuhvatiti konkretan rizik. Osam minimalnih grupa slučajeva iz §10.3.2 ne zamenjuje uređajsku proveru.

Izvršne CI komande i selekcija vode se u zajedničkoj sekciji provera ovog plana i osvežavaju iz aktuelnog workflow-a. Ne dodavati tajne/deploy ili stvarni model offline CI-ju samo da bi se nazvao E2E. Deno check nije izvršenje, source parser nije migracija, mock provider nije živi model, a PASS karakterizacije nije popravka. Potrebne Node post-save/finish-mode provere uključiti prema stvarnoj promeni i selekciji, bez automatskog pretpostavljanja da svaki `.mjs` ulazi u Jest.

Svi obavezni završni scenariji moraju imati stvarne nonempty rezultate, tačan decoder i proverene grane; PARTIAL/SKIP/NOT VERIFIED i fallback ne daju PASS cele situacije. Širi regresioni prolaz ponoviti kada zajednički promenjeni vlasnik ili obavezni gate to zahteva, ne radi povećanja zbirnog broja testova.

#### Produkcija, platforme i konačan izlaz

Sačuvati README uslov odvojenog proverenog produkcionog backenda i build zaštitu. Ne objavljivati DEV cilj kao produkciju niti kopirati privatne razvojne/testne naloge. Eksplicitan izlaz OWNER_PERSONAL/OWNER_BUSINESS iz namernog DEV TEST sveta proveriti kada se priprema stvarno izdanje. Proveriti Auth redirect/SMTP, Storage, Realtime, Edge, push, prava, konfiguraciju i stvarni paket/kanal. Nativne SDK/permission promene zahtevaju native build; sam OTA JavaScript nije dovoljan.

Za Android i iOS pratiti zasebne kandidate i uslove prodavnice iz njihove sekcije ovog plana. Android/AAB rad ne čeka Apple pristup. Pripremiti funkcionalne postupke brisanja, podrške/moderacije, deklaracije podataka, javne dokumente, store prikaze i namenski pregled obe uloge. Nedovršena obavezna funkcija ne postaje završena skrivanjem dugmeta. Statusi spremno za prijavu, podneto, odobreno, objavljeno i provereno posle objave ostaju odvojeni.

Konačni izlaz sadrži jednu važeću mapu aktivnih komponenti/pravila, popunjene ekrane/radnje, izvršni manifest stvarnih izmena/povlačenja, tačnu isporučenu kombinaciju, relevantne dokaze, poznata ograničenja i postupak oporavka. Manifest za svaki stvarno promenjen server objekat navodi identitet, zavisnosti, zamenu, kompatibilnost, redosled i rezultat; puni izvorni SV JSON je priložen i čuva se; novi izvršni status vezati za osveženi objekt i stvarni rezultat, bez prepisivanja istorijskog dokaza. Source review ili plan retirement-a nije dokaz da je objekat povučen.

Za svaki završen R zadatak izvestiti problem/posledicu, promenu postojećeg vlasnika, pozitivne i negativne kontrole, stvarni nivo provere i ono što ostaje nepoznato. Ne sabirati istorijske PASS brojeve u oznaku gotovog proizvoda. Ne zahtevati provider cache, sređivanje svake arhivske putanje ili svaku perf preporuku kao uslov objave ako nisu stvarna prepreka dogovorenom izdanju.

## 7. Čišćenje aktivnog izvora i servera

### 7.1. Obuhvat i granice

Čišćenje ima konkretnu svrhu: ukloniti zaista napuštenu aktivnu putanju, zadržati jedan odgovarajući vlasnički izvor i sprečiti da istorijski test vrati povučeno pravilo. Naziv legacy, odsustvo običnog caller-a ili star datum nisu sami uslov brisanja.

Priloženi [izvršni registar Z10](dokazi/izvrsivost/readiness_review.json), `cleanup.normalized_path_index`, razvrstava svih 3.434 putanje; 912 ima status `NEEDS_TARGETED_ADJUDICATION`. To nije 912 fajlova za brisanje. C01–C19 ispod sadrže 180 jedinstvenih eksplicitno navedenih putanja, uključujući aktivne vlasnike i testove koji se moraju sačuvati ili prevezati. Ni taj broj nije broj fajlova za uklanjanje. Svaki paket ostaje CONDITIONAL / NOT EXECUTED; `destructive_action_ready=false` ne menja se samim prenosom u ovaj plan. Za konkretnu promenu popuniti postojeći `cleanup.required_per_change_record` i dokazati aktivnu zamenu i potrošače.

| Odluka | Vlasnik/podskup | Dokaz i uslov |
|---|---|---|
| Sačuvati | `useOwnedEditor`, request journal-i, signed review/digest, idempotent Save/publish i readback | Aktivne rute ih koriste. To su ograde od kasnih rezultata i nepoznatih ishoda, ne suvišna administracija. |
| Objediniti ugovor | Dual BG naspram explorer/shadow/direct/research putanja | Isti smisao, mode, cena, nova grana i obračun moraju biti provereni u aktivnoj putanji. Ne dodavati treći klasifikator radi sakrivanja razlika. |
| Sačuvati aktivne formatere | `src/data/aiNeedV2Ui.ts` | `pregled-zadatka` koristi factLabel/priceAmountRowValue; `reviewFacts` factLabel/factReviewValue/slotLabel; review client slotLabel; Intake safetyMessage; SupportReferenceView factLabel. Ceo modul nije mrtav. |
| Uslovno povući manual helper podskup | `factEditorKind`, `factChoices`, `editorCorrection`, `correctionFromText`, timestamp/list helpers, `amountDigits` | Non-test src pretraga nalazi definicije/interne pozive, ne aktivni obični editor. Proveriti podržane stare potrošače pre uklanjanja. |
| Uslovno povući dormant explicit-mode API | `prepareConfirmed`, `explicitWorkerModes`, `workerExplicitModeReviewEnabled`; `src/data/workerAiClientService.ts:36–45,280–305` | Non-test src self-reference; aktivni route test očekuje odsustvo dodatne mode forme. SQL kompatibilnost starog klijenta je poseban uslov. |
| Odvojiti demo namenu | `WorkerAiCard` | Jedini pronađen mount `src/designLab/dizajn-ai.tsx:177`; worker aktivni chat daje card()=>null. Demo nije razlog za vraćanje parcijalnih kartica; aktivni `WorkerAiReviewDetails` iz istog fajla ostaje. |
| Uslovno povući | `capturedParts`, `capturedSpeech`; `src/ui/workerProfile/workerProfileFacts.ts:64–78` | Nema spoljnog non-test src caller-a u obuhvaćenoj pretrazi. To nije autoritativni signal završetka. |
| Sačuvati aktivnu kompatibilnost | `src/app/(app)/profil/radnik.tsx`, `src/ui/workerProfile/workerProfileDraft.ts`, `src/ui/workerProfile/WorkerProfilePresentation.tsx:159–193` | Stara manual forma je povučena, ali name-adoption i uncertain-write recovery ostaju aktivni (`radnik:282–323`). Ime legacy nije dokaz za brisanje fajla. |
| Uskladiti copy i ulaze | `src/data/reviewFactProblem.ts:10`; `src/app/(app)/pregled-zadatka.tsx:343–352,517–533`; saved work-area/pin ulazi | Prošao termin se menja u razgovoru, ne u starom lokalnom editoru. Uskladiti ton i oblast/pin značenje bez novog obaveznog koraka. |
| Sačuvati istoriju, jasno indeksirati | Primenjene migracije, candidate/proof materijal, operativne beleške | Istorijska SQL funkcija ili dokaz nisu mrtav UI. CURRENT/HISTORICAL/REJECTED razdvajanje treba da spreči korišćenje starog candidate-a kao sadašnjeg ugovora. |

Legacy `inferWorkerExecutionModes` jeste keyword/city heuristika, ali aktivna worker ruta je poziva samo kada classificationState nedostaje (`src/app/(app)/profil/razgovor.tsx:282–285`). Signed READY/PENDING put je preskače. Ne opisivati sve današnje modove kao telefonsko nagađanje po ključnim rečima.

Za ekrane sa mapom treba sačuvati razliku prikaza i potvrde: MapLibre/OpenFreeMap, native/web varijanta, scene/focus owner i pin revision. GPS dozvola za „Moja lokacija” nije opšti uslov svakog prikaza mape. Prazan discovery rezultat sam po sebi ne gasi geografiju; F15/F16 su konkretniji razlozi dostavljenih stanja. S03 identifikuje About ekran, ali ne predstavlja pregled svih ostalih ekrana.

**Pojedinačni registar je priložen:** [consolidated_read_register.json](dokazi/registar/consolidated_read_register.json), `files[]` po tačnoj `path`, sadrži svrhu, ulogu, obrazloženi disposition i izvorne caller/read dokaze. [Z10](dokazi/izvrsivost/readiness_review.json), `cleanup.normalized_path_index`, daje trenutnu operativnu projekciju, uslove i C/R veze; izvorna istorija ostaje sačuvana. Ranija napomena da drugi razgovor nije dobio registar ne važi za ovaj ZIP. Tu su i ranije pojedinačne beleške o objašnjenju mikrofona, zajedničkom voice formatteru, neprimenjenom Text.balance i uskim ListSkeleton/RadarIcon/brand kandidatima. Aktivni textWidth/TITLE_SIZE i sheet konfiguracija ostaju. Pre takve dodatne promene otvoriti tačan zapis i proveriti sadašnji simbol i potrošače; prisutan registar nije dozvola za široko uklanjanje niti tvrdnja o novom čitanju celog izvora.

#### Pojedinačne poznate granice

`SelectionRequestRegistry` u `src/lib/selectionIdempotency.ts:31` nema non-test caller-a. Sačuvati stvarni izbor u `src/app/(app)/potrebe/[id]/kandidati.tsx`: memorijski `session.pending`, zamrznutu komandu, isti ključ i `readSelectedAgreement`. Odvojeni trajni `applicationCommandJournal` pripada prijavi radnika. Izbor nije time proglašen trajnim preko gašenja procesa; to je korekcija preciznosti, ne nov dokazan kvar. Stari `workTrustModel.statsView` nema običnog potrošača, dok `publicTrustFacts` služi javnom profilu i detalju zadatka. `manualAvailability`, `BrandScene`, `useBrandClock`, `useEntryIntro` pripadaju designLab-u; aktivna dostupnost je AI tok, a ulaz koristi tri premium PNG-a. To su pojedinačne preporuke za izolovanje ili povlačenje, bez vraćanja ručnih UI-ja iz testova.

`supabase/candidates/temporal-conflict-freezing-v1.sql` je nepovezan prototip sa starim schedule/resource/team poljima; terminalni aggregate SELECT nema INTO/RETURN u PL/pgSQL. Funkcija `private.candidate_projection(uuid)` ne postoji u current680inventaru niti ima current qualified caller. Aktivni `need_candidate_states_v5`/candidate RPC vlasnici ostaju. Ovaj prototip ne dokazuje kvar trenutnog kalendara.

Current legacy `rpc_delete_abandoned_intake_conversation` (`5829cbb6998255adae020793dd18ff33`) ima širok EXECUTE uz auth.uid/owner provere, ali prve referencirane tabele `public.need_facts_v2` i `public.ai_conversation_messages` ne postoje. Ne može se dokazati validan napad ignorisanjem te činjenice; izvršenje zapinje pre kasnijeg statusnog rizika. Nema source caller-a. Uslovno povlačenje zahteva proveru starih klijenata i zavisnosti, bez izvršavanja brisanja nad korisničkim podacima.

Stare rollback.preimage.sql kopije više funkcija ponegde spajaju `pg_get_functiondef` izlaze bez SQL terminatora. To je preimage evidencija, ne spremna revert komanda. Stare široke grantove i anon SECURITY DEFINER navode proveravati po objektu i unutrašnjem guard-u; ne menjati ACL/RLS da se samo umanji broj advisor upozorenja. Izvori i pojedinačni uslovi: Z01–Z06.

#### Precizna jedinica povlačenja

Za `workerProfileDraft.ts` uski kandidati su `foldTerm`, `hasTerm` i `toggleTerm`; `workerDraft`, `workerCommand`, `workerReadbackMatches`, `nameForSave` i povezani recovery/name-adoption ostaju. Za `workTrustModel` kandidat je `statsView`, dok `publicTrustFacts` i `memberSincePhrase` imaju stvarne javne potrošače. Za dormant worker explicit-mode podskup odsustvo non-test src caller-a ostaje uslovna preporuka: stari APK i serverski ugovor proveravaju se pre retirement-a. Primenjene SQL migracije čuvaju istoriju; kandidat, rollback preimage i demonstracioni ekran imaju zasebnu namenu. Poreklo ove odluke je opisani rev7 pregled; sadašnje potrošače proveriti u konkretnoj radnoj kopiji.

### 7.2. Konkretni paketi C01–C19

Za svaki paket očuvati sva navedena polja. Putanje su tačno prenete iz dostupne analize, relativno prema repozitorijumu; njihov status i sadržaj proveravaju se pre promene.

#### C01 — Nereferencirani template resursi

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Ukloniti 21 označeni template/placeholder resurs iz aktivnog stabla zajedno sa eventualnim suvišnim asset unosima.

**Ostaje:** Aktivne app-icon/premium-entry/reference-entry resurse, fontove, njihove manifeste i install generisanje.

**Preduslov:** Osvežiti referenciranje u app/EAS/Metro/native konfiguraciji, generatorima i dinamičkim putanjama; isti basename u drugom folderu nije isti asset.

**Tačne poznate putanje:**

```text
assets/entry-splash-empty.xml
assets/images/android-icon-background.png
assets/images/android-icon-foreground.png
assets/images/android-icon-monochrome.png
assets/images/expo-badge-white.png
assets/images/expo-badge.png
assets/images/expo-logo.png
assets/images/favicon.png
assets/images/icon.png
assets/images/logo-glow.png
assets/images/react-logo.png
assets/images/react-logo@2x.png
assets/images/react-logo@3x.png
assets/images/splash-icon.png
assets/images/tabIcons/explore.png
assets/images/tabIcons/explore@2x.png
assets/images/tabIcons/explore@3x.png
assets/images/tabIcons/home.png
assets/images/tabIcons/home@2x.png
assets/images/tabIcons/home@3x.png
assets/images/tutorial-web.png
```

**Dokaz posle promene:** Nema nepostojeće require/import/config putanje. Install/build proverava aktivne ulazne resurse. Novi native izgled ikone/ulaza odgovara cilju; veličina APK-a meri se zasebno.

#### C02 — Stari ručni izbor veština

**Veza:** R08, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Povući foldTerm, hasTerm i toggleTerm i test koji postoji samo radi tog quick-pick editora.

**Ostaje:** workerDraft, workerCommand, workerReadbackMatches, nameForSave i aktivni recovery/name-adoption; AI izmena profila.

**Preduslov:** Potvrditi tačne simbole, import-e i podržane ugovore; ne brisati ceo workerProfileDraft.ts.

**Tačne poznate putanje:**

```text
src/ui/workerProfile/workerProfileDraft.ts
src/ui/workerProfile/__tests__/worker-profile-terms.test.ts
src/app/(app)/profil/radnik.tsx
```

**Dokaz posle promene:** Nema mrtvih exporta/importa starog quick-pick-a. Ime, readback i neizvestan Save čuvaju važeće ponašanje. Testni skup više ne zahteva ukinuti ručni editor.

#### C03 — Ručni editor činjenica pored aktivnih AI formattera

**Veza:** R08, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Povući factEditorKind, factChoices, editorCorrection, correctionFromText, amountDigits i njihove isključivo interne manual helper-e kada se testovi prevežu.

**Ostaje:** factLabel, priceAmountRowValue, factReviewValue, slotLabel i safetyMessage sa svim aktivnim pregled/support potrošačima.

**Preduslov:** U svakom testu odvojiti zaštitu aktivnog prikaza od očekivanja ukinutog ručnog unosa; sačuvati korekciju kroz isti razgovor.

**Tačne poznate putanje:**

```text
src/data/aiNeedV2Ui.ts
src/data/__tests__/aiNeedV2Ui.test.ts
src/data/__tests__/ru2-ai-v2-ui.test.ts
src/data/__tests__/w02-capability-terms.test.ts
```

**Dokaz posle promene:** Pregled, podrška i AI prikaz imaju iste važeće labele i novčano značenje. Nema novih lokalnih writer-a činjenica. Relevantne pozitivne i negativne provere ostaju.

#### C04 — Stari card i layout podskupovi

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Povući nekorišćene CardHead/CardDecision/CardFoot/CardBriefFoot/CardRequirement/CardPerson/CardPlaces/CardNext/CardNote/CardWaitingLine/CardFootLine; uz njih stari headBeside/wrapTitle/titleColumn i test-only requesterPrijava podskup.

**Ostaje:** Aktivne task/status/capacity/rating/spoken helper-e, CardStatus/CardStatusLine/CardTitle/WaitingDot, textWidth/font tabelu/TITLE_SIZE i stvarno odvojene requester/worker kompozicije.

**Preduslov:** Povezati svaki uklonjeni export sa testom i aktivnom zamenom; ne spajati različite uloge samo radi manjeg broja komponenti.

**Tačne poznate putanje:**

```text
src/ui/v2/TaskFace.tsx
src/ui/v2/cardHeadFit.ts
src/ui/v2/CandidateFace.tsx
src/ui/v2/PrijavaCard.tsx
```

**Dokaz posle promene:** Sve aktivne kartice i koraci Dogovora čuvaju iznos, broj ljudi, status i pristupačnost. Testovi ne zahtevaju više napuštenu vizuelnu implementaciju. Type/build nema preostalih import-a.

#### C05 — Nepovezani selection registry i privatna stats alternativa

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Povući SelectionRequestRegistry sa isključivo njegovim testom, te statsView/reliabilityNeeds podskup gde je bez običnih potrošača.

**Ostaje:** Stvarni requester izbor u kandidati ruti: memorijski session.pending, frozen command, isti ključ i readSelectedAgreement; odvojeni trajni applicationCommandJournal radnika; publicTrustFacts/memberSincePhrase.

**Preduslov:** Rekoncilovati noviju odluku u registru i proveriti sve tip/export potrošače; ne izjednačiti memorijsko pending stanje i trajni journal.

**Tačne poznate putanje:**

```text
src/lib/selectionIdempotency.ts
src/lib/__tests__/selectionIdempotency.test.ts
src/ui/profile/workTrustModel.ts
src/ui/profile/__tests__/work-trust-model.test.ts
```

**Dokaz posle promene:** Prijava i izbor ostaju zaštićeni od ponavljanja u svom stvarnom obimu. Javni profil i poverenje zadržavaju autoritativne podatke. Uklonjeni test ne umanjuje pokriće stvarnog ruta/servis toka.

#### C06 — Duplikat identičnog testa

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Ukloniti jednu od dve identične provere prvog dolaska redova (588–604 i 606–622 na analiziranom izvoru).

**Ostaje:** Jednu kompletnu proveru: najviše šest prvih animiranih redova; topla lista i promena filtera bez ponovljene animacije.

**Preduslov:** Pre izmene osvežiti tačne granice testa; nema potrebe menjati proizvod radi uklanjanja duplikata.

**Tačne poznate putanje:**

```text
src/data/__tests__/agreement-collection-presentation.test.tsx
```

**Dokaz posle promene:** Ostaje jedna identična smislena provera i svi ostali različiti slučajevi. Broj slučajeva se smanji za jedan tek nakon stvarnog runner izveštaja.

#### C07 — Stari ulazni motion i design-only reference

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Iz aktivnog izvora i default suite-a povući isključivo napuštenu BrandScene/V49/useEntryIntro referencu sa njenim testovima i starim token allowance-om; design scenu ukloniti ili prevezati u jednom zahvatu.

**Ostaje:** Aktivni EntryWelcome, premium PNG, BrandAssets/BrandRaster, potrebni brandParts/BRAND_PARTS i postinstall generisani font/reference-entry ulazi dok ih potrošači koriste.

**Preduslov:** Sačuvati jedan jasno označen dizajn dokaz samo ako služi aktuelnom vizuelnom cilju; proveriti install/build i putanju potrebnog fonta.

**Tačne poznate putanje:**

```text
src/ui/entry/BrandScene.tsx
src/ui/entry/BrandSceneReview.tsx
src/ui/entry/entryV49Math.ts
src/ui/entry/entryV49Notes.ts
src/hooks/useEntryIntro.ts
src/data/__tests__/entry-brand-scene-clock.test.tsx
src/data/__tests__/entry-v49-reference.test.ts
src/data/__tests__/entry-intro-hook.test.tsx
src/ui/system/__tests__/one-token-source.test.ts
src/designLab/dizajn-profil.tsx
scripts/sync-entry-reference-assets.cjs
```

**Dokaz posle promene:** Aktivni welcome/splash ostaje tačan na uređaju. Jest više ne zahteva staru animaciju. Install iz čistog checkout-a ne zavisi od obrisanog izvora.

#### C08 — V1 AI portovi i fake AI

**Veza:** R04, R08, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Povući legacy V1 intake/confirm/publish port i njegove override-e kao zajedničku celinu; izdvojiti fixture-e koje još trebaju tekućim testovima.

**Ostaje:** Aktivni V2 razgovor, signed review/Save/publish, aktivne ne-AI komande/readere centralnog Izvor porta i smislen reset demo stanja.

**Preduslov:** Prvo ukloniti/rebindovati legacy članove porta i test potrošače. Proveriti konfiguracije koje mogu izabrati test/dev izvor.

**Tačne poznate putanje:**

```text
src/data/aiCommandOverrides.ts
src/data/aiProductionOverrides.ts
src/data/productionAuthorityOverrides.ts
src/data/lazniAi.ts
src/data/index.ts
src/data/ports.ts
src/data/lazniIzvor.ts
```

**Dokaz posle promene:** Nema V1 slanja ili objave iz aktivne kompozicije. Postojeći V2 put i ostale Izvor funkcije rade. Retired-only testovi ne vraćaju ručne V1 činjenice.

#### C09 — Nepovezani owner-review builder i eksplicitni CI ulaz

**Veza:** R04, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Premestiti ili povući source-only Gate A builder i isključivo njegov synthetic test zajedno sa eksplicitnim CI pozivom, posle prenosa važećih scenarija.

**Ostaje:** Aktivni potpisani review/prepare/Save/binder, revalidaciju identiteta i kompletan BOTH; ne smanjiti potrebnu zaštitu samo uklanjanjem CI reda.

**Preduslov:** R04 mapira svaku korisnu proveru na aktivnog vlasnika i proverava stvarni Edge bundle; CI izmenu prikazati sa zamenom.

**Tačne poznate putanje:**

```text
supabase/functions/_shared/classificationOwnerReview.mjs
supabase/proofs/dynamic_taxonomy/classification-owner-review.test.mjs
.github/workflows/ci-clean.yml
```

**Dokaz posle promene:** Nema dangling CI putanje. Istovetne važeće invariants proverava aktivni put. Synthetic istorijska projekcija se više ne predstavlja kao dokaz stvarnog Save-a.

#### C10 — Aktivne i alternativne AI strategije

**Veza:** R04, R06, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Posle odabira i dokaza ciljnog postojećeg toka povući nepodržane alternativne flag grane, njihove izvozove i retired-only testove.

**Ostaje:** Puni semantički ugovor, nove grane, isti ID, oba moda, stvarnu saglasnost i postojeće granice potrošnje/timeout-a; foreground razgovor i pozadinski posao mogu imati različite potrebne uloge.

**Preduslov:** Isti korpus, merena tačnost/latencija/trošak, kompatibilnost starog podržanog build-a i usklađeni source/Edge deploy.

**Tačne poznate putanje:**

```text
supabase/functions/_shared/classificationExplorer.mjs
supabase/functions/_shared/classificationGeminiShadow.mjs
supabase/functions/_shared/taxonomyScopedShadow.mjs
supabase/functions/uskoci-ai-interview/index.ts
supabase/functions/uskoci-worker-interview/index.ts
```

**Dokaz posle promene:** Jedan dokumentovan aktivan ugovor i popis dozvoljenih konfiguracija. Neaktuelna strategija nema runtime/CI ulaz. Svi R04/R06 slučajevi imaju dokaz preko aktivnog puta.

#### C11 — Messages-only povlačenje PHONE delova

**Veza:** R11, R12. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Povući PHONE metode/portove i positive-feature testove koje važeći proizvod više ne podržava; povezati sa posebnom kompatibilnom serverskom migracijom.

**Ostaje:** Poruke, važeći tačan lokacijski grant i njegove privatnosne provere; istorijski negativni test da stari klijent ne može vratiti povučenu PHONE mogućnost.

**Preduslov:** Proveriti stare native/OTA klijente i server grantove, current source ugovor i namenu svake testne tvrdnje.

**Tačne poznate putanje:**

```text
src/data/contactClientService.ts
src/data/ports.ts
src/data/__tests__/m04-privatnost-kontakt.test.ts
src/ui/agreements/AgreementContactPlace.tsx
STATUS.md
```

**Dokaz posle promene:** Aktivan i podržani stari klijent poštuju messages-only ugovor. Tačna lokacija ostaje zasebno autorizovana. Nema nove zabrane teksta poruke bez posebne poslovne odluke.

#### C12 — Nepovezane buduće GPS i permission putanje

**Veza:** R09, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Iz aktivnog opsega povući controller/prototip i testove koji samo dokazuju nezakačenu buduću mogućnost; potrebno generičko GPS/permission ponašanje zadržati kod aktivnog vlasnika.

**Ostaje:** Aktivni exact-location grant, native location helpers i postojeći push enrollment/permission tok.

**Preduslov:** Inženjerska preporuka je izolovati neaktivnu buduću referencu; aktiviranje nove GPS SHARE funkcije bio bi poseban proizvodni opseg.

**Tačne poznate putanje:**

```text
src/data/agreementCurrentLocationService.ts
src/ui/agreements/AgreementLocationController.ts
src/data/__tests__/v5-agreement-current-location-controller.test.ts
src/data/__tests__/v5-agreement-current-location-service.test.ts
src/ui/permissions/notificationAsk.ts
src/ui/permissions/__tests__/permission-sites.test.ts
```

**Dokaz posle promene:** Default produktni testovi ne zahtevaju nezakačen prototip. Aktivni permission i lokacijski tokovi zadržavaju svoju proveru. Nema dangling import-a ni izgubljenog native helper-a.

#### C13 — Javni komentari: ugovor pre povlačenja čitača

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Odluku o starom prikazu doneti zajedno sa SB09: povezati potvrđen javni komentar ili uskladiti obećanje i izdvojiti neaktivni public-list podskup.

**Ostaje:** Aktivni context/submit servis, ocene i stvarna privatnost publikovanja; ne izbrisati ceo reviewComments servis.

**Preduslov:** Utvrditi važeću publiku komentara; ako se menja obećanje proizvoda, prikazati korisniku konkretnu odluku, ne sakriti je pod cleanup.

**Tačne poznate putanje:**

```text
src/ui/reviews/ReviewCommentsSection.tsx
src/ui/reviews/__tests__/review-comments-section.test.tsx
src/data/reviewCommentsClientService.ts
```

**Dokaz posle promene:** Tekst pri slanju i stvarna dostupnost komentara saglasni. Submit/context i rating tok ostaju. Retired-only testovi ne nameću drugu publiku.

#### C14 — Testovi povučenih pravila i istorijski oracle

**Veza:** R04, R07, R08, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Razdvojiti stare 11-stem/fee/HITNO/equipment/license i kopirane oracle pretpostavke; povući retired-only pozitivna očekivanja iz default acceptance-a.

**Ostaje:** Važeće privacy/ownership/canonical identity/budget granice i korisne sintetičke slučajeve prevezane na sadašnji ugovor.

**Preduslov:** Za svaku tvrdnju navesti aktuelni izvor pravila, ili da je istorijska kompatibilnost; otkriti optional/skip/NULL slučajeve koji mogu lažno proći.

**Tačne poznate putanje:**

```text
src/data/__tests__/ex06-corpus-contract.test.ts
supabase/proofs/pkg051/pkg051_proof.mjs
supabase/proofs/match_category_fallback/source.test.mjs
```

**Dokaz posle promene:** Test više ne vraća ukinutu funkciju. Neophodan safety invariant ostaje u tekućoj proveri. Istorijski PASS ima označen stari source/runtime i nije release gate.

#### C15 — Aktuelni kvar kao zelena karakterizacija

**Veza:** R02, R06, R07, R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Posle konkretne popravke promeniti završno očekivanje sa ponavljanja kvara na ispravan rezultat; zadržati precizan ulaz/prekid koji je kvar reprodukovao.

**Ostaje:** Reprodukciju stare RSD potvrde, neuspešnog capture-a, MAP failure posle uspešne liste i nove ocene uz iste ID-jeve.

**Preduslov:** Test i popravka u istom pregledljivom radu, uz pozitivnu kontrolu; ne menjati assertion samo da trenutni kod prođe.

**Tačne poznate putanje:**

```text
supabase/proofs/ai/currency_correction_characterization.test.mjs
supabase/proofs/ai/background_capture_receipt.test.mjs
src/data/__tests__/discovery-v1-route-lifecycle.test.tsx
src/ui/reviews/__tests__/use-given-ratings.test.tsx
```

**Dokaz posle promene:** Isti slučaj sada dokazuje željeno ponašanje. Uspešan redovni tok i relevantni neuspeh ostaju. CI rezultat ima jasnu semantiku.

#### C16 — Dokazi, kandidati i zamrznuti generatori

**Veza:** R01, R11, R12. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Za svaku historical/candidate grupu zadržati minimalan manifest sa commitom, hash-em, namenom i zamenom, a nepotrebne kopije izbaciti iz aktivne grane kada nisu input tekućeg build/test/replay-a. Ne održavati drugu arhitekturu u kandidatima.

**Ostaje:** Primenu i poreklo stvarno korišćenog SQL-a, nužne fixtures i dokazive rollback preimage reference, te aktuelne minimalne canary/replay alatke.

**Preduslov:** Za frozen generator prvo utvrditi da li se koristi kao rekonstrukcija/potpisni dokaz; ne regenerisati primenjeni bundle. Prevezati putanje u current kontrolama na minimalan potreban izvor.

**Tačne poznate putanje:**

```text
README.md
STATUS.md
supabase/candidates/ex04a_own_tasks_page.sql
supabase/candidates/temporal-conflict-freezing-v1.sql
supabase/proofs/push_single_target/promotion/expected-prelocation-surface.json
```

**Dokaz posle promene:** Default build/test/deploy nema staru install/apply/revert putanju. Jedan manifest vodi do tačnog starog izvora i aktuelne zamene. Izolovan replay/current bootstrap radi bez uklonjenih slučajnih kopija.

#### C17 — Test i build katalog posle čišćenja

**Veza:** R11, R12. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Uskladiti package scripts, eksplicitne CI putanje, Jest selekciju, TypeScript includes i generisanje sa odlukama o aktivnom/istorijskom sadržaju. Premeštanje u archive samo po sebi ne isključuje __tests__ glob ni **/*.ts include.

**Ostaje:** Obavezne tekuće safety/regression/integrity provere i pouzdan install/build iz zaključanih zavisnosti.

**Preduslov:** Svaki uklonjeni test ili CI ulaz mora imati razlog RETIRED_RULE/DUPLICATE/REPLACED_BY_CURRENT/EXPLICIT_HISTORICAL_ONLY; nikakvo opšte isključivanje na osnovu sporosti ili failure-a.

**Tačne poznate putanje:**

```text
package.json
jest.config.cjs
tsconfig.json
.github/workflows/ci-clean.yml
scripts/sync-entry-reference-assets.cjs
supabase/migrations/check_migration_integrity.py
```

**Dokaz posle promene:** Runner list/count pre-posle, zbir trajanja i relevantno pokriće uz isti environment. Nema neselektovanog obaveznog testa ni testnog fajla koji štiti samo napušteni UI. Dependency lock i install/build su koherentni; paket se uklanja samo kad nema potrebnog runtime/build/test potrošača.

#### C18 — Potpuno identične premium slike i njihove kopije

**Veza:** R11. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Konsolidovati tri potvrđena byte-identical para na aktivni premium-entry vlasnički put i prevezati ostale potrošače/provenance; zatim ukloniti višak kopija iz aktivnog stabla.

**Ostaje:** Isti pikseli/izgled i sve stvarne upotrebe; canonical premium-entry put se predlaže zato što je aktivni ulazni vlasnik.

**Preduslov:** Proveriti literalne/dinamičke import-e, asset manifest/generator i dizajn galerije; ne ukloniti putanju pre rebind-a.

**Tačne poznate putanje:**

```text
assets/brand/premium-entry/discover.png
assets/brand/premium-entry/logo.png
assets/brand/premium-entry/publish.png
assets/brand/uskoci-dimensional-20261003.png
assets/illustrations/uskoci-discover-v3.png
assets/illustrations/uskoci-task-launch-v2.png
```

**Dokaz posle promene:** Izgled aktivnog ulaza i svih drugih potrošača ostaje isti. Install/build proverava novi jedinstveni izvor. Saopštiti stvarne repo byte rezultate; APK veličina se zasebno meri.

#### C19 — Identični SQL i proof blizanci

**Veza:** R11, R12. **Status:** uslovni kandidat, nije izvršeno.

**Jedinica promene:** Kod byte-identical candidate/migration i ponovljenih proof kopija izabrati primenjenu migraciju ili jasno određen evidencioni vlasnički zapis; prevezati aktuelne testove i manifest linkove, pa ukloniti suvišnu aktivnu kopiju kada nema nezavisnu funkciju.

**Ostaje:** Primenjene migracije i njihov originalni hash; tačan istorijski run/commit identitet i sadržaj potreban za audit/replay/rollback.

**Preduslov:** Za svaku grupu zabeležiti canonical source i sve putanjske zavisnosti. Frozen istorijski runner ne prepraviti da glumi tadašnji drugačiji izvor; sačuvati istorijski manifest ili commit referencu.

**Tačne poznate putanje:**

```text
supabase/candidates/ai-location-01-20261002/before-edge/src/contracts/needFactsV2.ts
supabase/candidates/ai-location-01-20261002/before-edge/supabase/functions/_shared/aiTestBudget.ts
supabase/candidates/ai-location-01-20261002/before-edge/supabase/functions/_shared/geminiTaskStream.ts
supabase/candidates/ai-location-01-20261002/location_reply_candidate.sql
supabase/candidates/ai-location-01-20261002/src/contracts/needFactsV2.ts
supabase/candidates/ai-location-01-20261002/supabase/functions/_shared/aiTestBudget.ts
supabase/candidates/ai-location-01-20261002/supabase/functions/_shared/geminiTaskStream.ts
supabase/candidates/ai-location-01-20261002/supabase/functions/_shared/locationReply.ts
supabase/candidates/ai-location-01-20261002/supabase/functions/uskoci-ai-interview/index.ts
supabase/candidates/closure-current-20261021/helpers.sql
supabase/candidates/closure-current-20261021/migration-with-proof.sql
supabase/candidates/closure-taxonomy-20261018/helpers.sql
supabase/candidates/dynamic-taxonomy-20261011/ai-catalog-context-deep-ancestry-v2.sql
supabase/candidates/dynamic-taxonomy-20261011/create-child-v2-forward-dev.sql
supabase/candidates/dynamic-taxonomy-20261011/create-new-branch-v3-forward-dev.sql
supabase/candidates/dynamic-taxonomy-20261011/need-binder-selection-hotfix-dev-v1.sql
supabase/candidates/dynamic-taxonomy-20261011/need-review-versioned-optin-dev-20261016.sql
supabase/candidates/dynamic-taxonomy-20261011/signed-binding-requeue-dev-v1.sql
supabase/candidates/ex05-rc02-20261002/rc02_candidate.sql
supabase/candidates/pkg023j_home_attention.sql
supabase/candidates/published-edit-guard-20261021/candidate.sql
supabase/candidates/worker-personal-profile-edge-20261003/proof/dialogue_fixture.mjs
supabase/candidates/worker-personal-profile-edge-20261003/task/after/src/contracts/needFactsV2.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/after/supabase/functions/_shared/aiTestBudget.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/after/supabase/functions/_shared/geminiTaskStream.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/after/supabase/functions/_shared/locationReply.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/before/src/contracts/needFactsV2.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/before/supabase/functions/_shared/aiTestBudget.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/before/supabase/functions/_shared/geminiTaskStream.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/before/supabase/functions/_shared/locationReply.ts
supabase/candidates/worker-personal-profile-edge-20261003/task/before/supabase/functions/uskoci-ai-interview/index.ts
supabase/candidates/worker-personal-profile-edge-20261003/worker/after/supabase/functions/_shared/aiTestBudget.ts
supabase/candidates/worker-personal-profile-edge-20261003/worker/after/supabase/functions/_shared/geminiTaskStream.ts
supabase/candidates/worker-personal-profile-edge-20261003/worker/before/supabase/functions/_shared/aiTestBudget.ts
supabase/candidates/worker-personal-profile-edge-20261003/worker/before/supabase/functions/_shared/geminiTaskStream.ts
supabase/functions/_shared/pushNotificationCopy.mjs
supabase/migrations/20260907100000_clean_n08_notification_preferences.sql
supabase/migrations/20260907110000_clean_d03_message_retry.sql
supabase/migrations/20260907120000_clean_ai_need_draft_safety_authority.sql
supabase/migrations/20260908120000_clean_p0e_completion_guards.sql
supabase/migrations/20260908130000_clean_p1_legal_consent_ledger.sql
supabase/migrations/20260908140000_clean_p4_processor_map_registry.sql
supabase/migrations/20260908150000_clean_p3_retention_schedule_registry.sql
supabase/migrations/20260908160000_clean_p2_data_export_requests.sql
supabase/migrations/20260908170000_clean_d0140a_policy_bundle_registration.sql
supabase/migrations/20260910153005_clean_p2_export_delivery_authority.sql
supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql
supabase/migrations/20261016172724_dev_need_review_taxonomy_versioned_20261016.sql
supabase/migrations/20261016185402_dev_signed_taxonomy_binding_requeue_20261016.sql
supabase/migrations/20261016185727_dev_signed_need_binder_selection_20261016.sql
supabase/migrations/20261017223855_create_child_v2_signed_review_dev_20261018.sql
supabase/migrations/20261017230303_taxonomy_root_branch_v3_20261018.sql
supabase/migrations/20261017230429_taxonomy_deep_ancestry_v2_20261018.sql
supabase/migrations/20261021095622_published_task_edit_containment.sql
supabase/migrations/20261021104455_closure_taxonomy_archive_copy_coverage.sql
supabase/operations/dev-alpha/ledger/20260919221214_dev_alpha_pkg023j_home_attention.sql
supabase/operations/dev-alpha/ledger/20261002172532_dev_alpha_ex05_rc02_media_cancel_lock_order.sql
supabase/operations/dev-alpha/ledger/20261002185306_dev_alpha_ai_location_01_contextual_map_dialogue.sql
supabase/proofs/ai/ai_draft_authority_candidate.sql
supabase/proofs/ai/dialogue_fixture.mjs
supabase/proofs/completion/p0e_completion_guards_candidate.sql
supabase/proofs/legal/p1_legal_consent_candidate.sql
supabase/proofs/legal/p2_data_export_candidate.sql
supabase/proofs/legal/p2_export_delivery_candidate.sql
supabase/proofs/legal/p3_retention_execution_candidate.sql
supabase/proofs/legal/p3_retention_schedule_candidate.sql
supabase/proofs/legal/p4_processor_map_candidate.sql
supabase/proofs/notifications/d03_message_retry_candidate.sql
supabase/proofs/notifications/n08_preferences_candidate.sql
supabase/proofs/policy/d0140a_bundle_registration_candidate.sql
supabase/proofs/push_single_target/promotion/edge-before/functions/_shared/pushNotificationCopy.mjs
supabase/proofs/push_single_target/promotion/edge-candidate/functions/_shared/pushNotificationCopy.mjs
supabase/proofs/push_single_target/promotion/edge-candidate/functions/uskoci-push-transport/index.ts
supabase/proofs/push_single_target/promotion/live-certificate-checked.json
supabase/proofs/push_single_target/promotion/live-edge-capture.json
supabase/proofs/push_single_target/promotion/live-preflight-capture.json
supabase/proofs/push_single_target/promotion/live-surface-capture.json
supabase/proofs/push_single_target/promotion/recapture-20261009/capture.json
supabase/proofs/push_single_target/promotion/recapture-20261009/cert.json
supabase/proofs/push_single_target/promotion/recapture-20261009/edge.json
supabase/proofs/push_single_target/promotion/recapture-20261009/surface.json
supabase/proofs/push_single_target/supabase/functions/_shared/pushNotificationCopy.mjs
supabase/proofs/push_single_target/supabase/functions/uskoci-push-transport/index.ts
```

**Dokaz posle promene:** Current kontrole i isolated bootstrap ne zavise od uklonjene kopije. Istorijski run/commit ostaje proverljiv. Nema slepog izvršavanja starog apply/revert kandidata.


### 7.3. Svih 14 serverskih izvršnih zapisa SV01–SV14

Svih 14 izvornih zapisa sada je priloženo u [serverskom manifestu](dokazi/server_final/change_manifest.json), ključ `proposed_changes`, a ispod su njihova puna izvršna polja izložena čitljivo. Ovo je prenos već pregledane analize u jedinstven plan; nije novi upit bazi, novo čitanje deploy-a ili izvršena popravka. Ranije ograničenje drugog razgovora — da manifest nije dobio — ostaje istorijska činjenica i više nije ograničenje ovog paketa.

**Zajednički dokaz E1.** Izvor je `a9692e11942609bab9406215c3e407d79589dafa`, DEV projekat `leqcwgzvjsxugfgzdmth`, prema postojećem dokumentovanom preseku od 27.10.2026. Svaki SV zapis sadrži `current_evidence` sa tim identitetima i referencama na [schema_review.json](dokazi/server_final/schema_review.json), [edge_review.json](dokazi/server_final/edge_review.json), [operations_review.json](dokazi/server_final/operations_review.json) i [migration_performance.json](dokazi/server_final/migration_performance.json). Njihovi zabeleženi query, UTC, hash i nivoi dokaza ostaju u tim fajlovima. Postojeći manifest ima SHA256 `1b1c7b8baa8335c8cdf6bd888686a9ab0f111da2289bb2d45fefd2983d0e4ade`; hash novog paketa proverava se u njegovom MANIFEST-u, bez menjanja istorijskih receipt-a.

**Kada se otvara puni inventar.** Isti manifest sadrži svih 3.037 zapisa u `object_inventory`, tačan `identity`/`kind`, dokaze i obrazložene statuse, uz povezane schema/operations/Edge inventare. Pre izmene ili povlačenja konkretnog objekta čitaju se njegov zapis, odgovarajuća SV grupa, zavisnosti i sadašnji stvarni potrošači. Neki SV predmeti su grupe/ulazi, a ne unapred napisana migracija; tačna jedinica promene zatvara se kod tih vlasnika. Inventar nije potpun dinamički runtime call graph; `pg_depend`, kvalifikovane reference i literalni RPC pozivi imaju navedena ograničenja. Odsustvo pozivaoca nije samo po sebi dozvola za brisanje.

Svaka grupa zadržava svih **12 izvršnih polja**. Veze ka R zadacima i uslov `destructive_action_ready=false` dodatno su navedeni. Oznaka završene analize znači da je namera promene zapisana; ne znači da su implementacija, release dokaz ili svako uslovno povlačenje već odobreni. Potpuna Auth management konfiguracija, efektivne tajne/zastavice, produkcioni projekat i ponašanje svih starih klijenata ostaju ranije navedene granice.

#### SV01 — Privatne Need kolone i buduće podrazumevane dozvole

**Veza:** R01, R12. **Izvorni zapis:** `proposed_changes[0]`, `id=SV01`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
public.needs
postgres default ACL for public schema
effective public table/function/sequence grants
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[0].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

F21: sačuvati poverljivost Need kolona i urediti minimalna prava novih objekata. RLS politika redova i table/column grantovi predstavljaju odvojene granice.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Sve sadašnje public politike i efektivni grantovi tabele/kolona.
- Pomoćnici vidljivosti u rls_private.
- Podrazumevana prava šeme.
- Čitanja podržanih starih klijenata.
- Namerno javni paket pravnih dokumenata.

**5. Odluka — `decision`**

Popraviti F21; suziti nepotrebne TRUNCATE/TRIGGER/REFERENCES i podrazumevane privilegije, uz izričito očuvane namerne grantove. Ne raditi opšti REVOKE bez analize.

**6. Vlasnik zamene — `replacement_owner`**

Postojeće javne/sopstvene projekcije, owner/world politike i potpisane RPC granice.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Zabeležiti tačan sadašnji ACL i podržane klijente.
2. Uskladiti source i dodati novu usku migraciju minimalnih prava.
3. Ponovo proveriti stare/nove klijentske prikaze i policy binding.
4. Isporučiti kompatibilne klijente i Edge pakete.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Dva sintetička naloga dokazuju sopstvenu, javnu, tuđu i world vidljivost.
- Sve tri zabranjene kolone odbijene su i kroz wildcard, alias, filter i sortiranje.
- Namerno javni pravni metapodaci ostaju dostupni.
- Novi testni objekat dobija samo predviđena podrazumevana prava.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV02 — Potpun katalog, verna hijerarhija i uslovni snapshot

**Veza:** R04, R06, R12. **Izvorni zapis:** `proposed_changes[1]`, `id=SV02`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
public.rpc_taxonomy_fetch_snapshot_v1(p_generation integer)
public.rpc_taxonomy_query_catalog_service(p_query jsonb)
supabase/functions/_shared/backgroundTaxonomyArchitect.mjs
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[1].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Model mora dobiti ceo važeći katalog sa izričito tačnim roditeljskim vezama; keš mora dokazati potpunost i svežinu.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Pisci kategorija, modova i aliasa i fingerprint kataloga.
- Prefetch i builder oba AI handlera.
- Potpisani admission/capture.
- Razlike sadašnjeg source-a i stvarnog deploy-a.

**5. Odluka — `decision`**

Popraviti hijerarhiju prompta, potpun fallback i uslovni snapshot; objediniti istovremeno učitavanje u ograničenoj memoriji instance. Materijalizovani stamp/payload razmatrati tek kada pokrivenost svih pisaca i merenje to opravdaju.

**6. Vlasnik zamene — `replacement_owner`**

Postojeći snapshot/query vlasnik i stroga explorer validacija; jedan kanonski DB katalog.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Ispraviti serijalizaciju parent/path i aliasa.
2. Verzionisati uslovni odgovor bez dvosmislenih RPC overload-a.
3. Sačuvati kompatibilnost sadašnjeg full-snapshot pozivaoca.
4. Uvesti single-flight, ograničenu memoriju i atomsku zamenu potpunog rezultata.
5. Meriti pre eventualnog trajno pripremljenog snapshot-a.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Zabeleženo stablo od 153 čvora predstavljeno je potpuno i sa tačnim roditeljima.
- Obuhvaćeni su cursor, rast sibling skupa i batch granice.
- Potpun rezultat zamenjuje parcijalan i pri istom stamp-u.
- Paralelni cache miss i otkazan jedan waiter ne kvare zajedničko učitavanje.
- Promena aliasa/moda menja relevantan identitet; ne nastaje slučajna duplirana grana.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV03 — Semantička odluka, ograničen provider transport i trajan prvi plan

**Veza:** R04, R06. **Izvorni zapis:** `proposed_changes[2]`, `id=SV03`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
backgroundTaxonomyArchitect.mjs classifiers and caches
geminiTaskStream.ts
taxonomyProviderBudget.ts
Both interview handlers
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[2].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Za stvarno izmenjen ulaz postoji jedna kanonska semantička odluka, uz zaseban provider trošak i trajan nastavak kada prvi plan nedostaje.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- F04–F08.
- Worker modelski poziv nad celim spiskom usluga.
- cachedNovelDecisions i clarification mape.
- Tačan model/API ugovor provajdera.
- Post-save outbox, koji zahteva već postojeći plan.

**5. Odluka — `decision`**

Ujednačiti REUSE/new/clarification rezultat, obavezni ceo skup modova, ograničen i obračunat transport i trajan posao. Javni stabilni prefiks zadržati odvojeno od uslovne odluke o eksplicitnom provider kešu.

**6. Vlasnik zamene — `replacement_owner`**

Postojeći semantic admission/review/capture/binder i provider transport; ne uvoditi treći klasifikatorski servis.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Popraviti semantički rezultat i sačuvati važeću odluku kroz nepovezan turn.
2. Ograničiti i zasebno obračunati BG pozive.
3. Definisati trajnog vlasnika nedostajućeg prvog plana.
4. Vezati ograničeni keš za version/fingerprint/model/prompt/input.
5. Izmeriti tokene, ponovno korišćenje i TTL; tek zatim odlučiti o cachedContent.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Turn bez bitne promene čuva spremnost.
- BOTH ne postaje READY iz podskupa.
- Sinonim koristi isti kanonski ID uz validiran admission.
- Restart/izgubljen ACK ne dupliraju korisničku poruku ili upis.
- Istek keša/nepoznat provider rezultat imaju ograničen ishod; trošak se ne računa dvaput.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV04 — Objavljeni post-save worker i retry pri čitanju odgovora

**Veza:** R06, R12. **Izvorni zapis:** `proposed_changes[3]`, `id=SV04`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
Edge uskoci-taxonomy-postsave-worker v5/index.ts
current source boundedJson catch
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[3].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Nepoznat ishod čitanja body stream-a ili UTF-8 dekodiranja mora sačuvati mogućnost ponovnog dovršavanja istog logičkog commit-a.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Post-save cron 3.
- work_taxonomy_review_outbox_v1.
- claim/commit/finalize/binder lanac.
- Granica od pet pokušaja.

**5. Odluka — `decision`**

Preneti pregledanu razliku od četiri reda u catch grani kroz kontrolisanu kompatibilnu isporuku; sačuvati zajednički worker.

**6. Vlasnik zamene — `replacement_owner`**

Sadašnji a969 boundedJson → Unavailable(true) i postojeći retry/lease/receipt put.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Proveriti poslednju tačnu source/deploy razliku.
2. U izolovanom dokazu proći transport-failure receipt put.
3. Isporučiti tačno odobrenu verziju.
4. Potvrditi retry sa istim request key-em i završni readback.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Neuspešan stream/UTF-8 ostaje retryable.
- Postojeće terminalno odbijanje ostaje terminalno.
- Izgubljen commit odgovor ne stvara dupliran plan ili granu.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV05 — Cron, push red i dokaz stvarne isporuke

**Veza:** R09, R12. **Izvorni zapis:** `proposed_changes[4]`, `id=SV05`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
private.edge_worker_tick_v5(p_at timestamp with time zone)
private.marketplace_tick(p_batch integer, p_at timestamp with time zone)
cron.job:1:uskoci_marketplace_tick
cron.job:2:uskoci_edge_workers
cron.job:3:uskoci_taxonomy_postsave_tick_dev
uskoci-push-transport v37
private.push_runtime_readiness
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[4].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Uspeh zakazanog SQL posla razlikuje se od sadašnje spremnosti workera, provider receipt-a i isporuke uređaju.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Minutni rasporedi.
- Zabeležen zastareo TICK_OK.
- Privatne postavke i service feature gates čije efektivne vrednosti nisu pročitane.
- F20 suppression posle ručne prijave.
- Tačno odredište uz IN_APP off/PUSH on.
- Put događaja grupne poruke.

**5. Odluka — `decision`**

Najpre razjasniti uzrok zastarelog opažanja/dozvoljene konfiguracije; zatim urediti ograničen SEND/RECEIPT kapacitet, suppression već prijavljenog i tačno push odredište.

**6. Vlasnik zamene — `replacement_owner`**

Postojeći push leases, token/session ograde, UNKNOWN ishodi i merodavni notification/target vlasnici.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Proveriti efektivnu dozvoljenu konfiguraciju bez otkrivanja tajni.
2. Sačuvati stale/unknown status dok ne postoji opaženi rezultat.
3. Popraviti admission/target i ograničen kapacitet.
4. Posmatrati zasebno SQL, HTTP, claim, provider i device faze.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Namerno isključen push ostaje isključen.
- Postoji svež uspešan dokaz rada workera.
- Već prijavljen radnik iste revizije ne dobija nepotrebnu prvu ponudu.
- Izgubljen ACK slanja ne uzrokuje slepo ponovno slanje nepoznatog pokušaja.
- PUSH-only odredište i dolazak grupnog događaja rade.
- Opterećenje i starost reda provereni su na kontrolisanim podacima.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV06 — Izvoz, sve životne kopije i zatvaranje naloga

**Veza:** R10, R11, R12. **Izvorni zapis:** `proposed_changes[5]`, `id=SV06`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
private.closure_erasure_binding_v5()
private.data_export_policy_binding()
private.retention_ai_source_ready()
workAreas export/archive projectors
Storage media/export lifecycle
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[5].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Tačni sopstveni podaci moraju opstati u izvozu i svim životnim kopijama; aktivacija ostaje blokirana dok sadašnji source/policy/projection binding nije istinit.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- F19 workAreas.
- Inventar snapshot-a i redakcije podataka.
- Sva tri privatna Storage bucketa i njihove politike.
- Ishod brisanja u Auth-u.
- Efektivne feature zastavice koje nisu potvrđene.

**5. Odluka — `decision`**

Popraviti tačno izostavljena polja i zavisnosti i dokazati binding; ne uključivati mogućnost na silu niti prepisivati očekivane digest-e radi prolaza.

**6. Vlasnik zamene — `replacement_owner`**

Postojeći owned export i closure generation/lease/readback protokoli.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Uskladiti sadašnje projektore i inventar kopija.
2. Pregledati potreban sadržaj retention/privacy pravila.
3. Izolovano dokazati scope izvoza i redakcije.
4. Ponovo izračunati tek validirane binding-e.
5. Aktivirati samo dokazanu i odobrenu mogućnost.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- COUNTRY/CITY/RADIUS ostaju u sopstvenom izvozu/arhivi.
- Nema tuđih profilnih bajtova.
- Nepoznat upload/closure ishod ostaje pošteno prikazan kroz readback.
- Nespreman izvoz odbija pre nastanka zahteva.
- Sve predviđene kopije obuhvaćene su pre konačnog zatvaranja.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV07 — Stari intake delete RPC i njegovi grantovi

**Veza:** R11, R12. **Izvorni zapis:** `proposed_changes[6]`, `id=SV07`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
public.rpc_delete_abandoned_intake_conversation(p_conversation_id uuid)
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[6].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Legacy delete ima owner ograde, ali poziva odsutne stare tabele; PUBLIC EXECUTE je i dalje efektivan.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Odsutne public.need_facts_v2 i public.ai_conversation_messages.
- PUBLIC i pojedinačni role EXECUTE grantovi.
- Odsustvo sadašnjeg literalnog pozivaoca nije dokaz odsustva starog klijenta.
- Account closure hook-ovi.

**5. Odluka — `decision`**

Uslovno povući ili zameniti kompatibilnim izričitim odbijanjem tek po razrešenju podržanih klijenata i zavisnosti.

**6. Vlasnik zamene — `replacement_owner`**

Sadašnja statusna komanda napuštanja i pregledani retention životni ciklus, bez ad hoc hard delete-a.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Utvrditi granicu podržanih klijenata.
2. Povezati ispravnog sadašnjeg vlasnika statusa/oporavka.
3. Novom migracijom kompatibilno povući/zameniti legacy endpoint i njegov PUBLIC grant.
4. Ukloniti samo povučene testove i source reference.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Stari endpoint ne pokušava pristup odsutnim tabelama.
- Sopstveno napuštanje ostaje proverljivo posle izgubljenog ACK-a.
- Tuđ pristup je odbijen; ne tvrdi se ranije opaženo tuđe brisanje.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV08 — Samo poruke uz istorijski PHONE opoziv i zasebnu lokaciju

**Veza:** R11, R12. **Izvorni zapis:** `proposed_changes[7]`, `id=SV08`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
private.grant_is_ownable(p_agreement_id uuid, p_channel text, p_granter uuid)
public.rpc_reveal_contact(p_agreement_id uuid, p_channel text)
public.rpc_set_contact_grant(p_agreement_id uuid, p_channel text, p_granted boolean)
public.access_grants::access_grants_channel_check
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[7].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Sprovesti smer proizvoda „Samo poruke” uz očuvanu zasebnu dozvolu za tačnu lokaciju.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Grant/reveal/read funkcije.
- Sadašnji klijentski portovi i testovi pozitivne PHONE mogućnosti.
- Podržani stari klijenti.
- Zajednička permissions tabela i lokacijske politike.

**5. Odluka — `decision`**

Povući PHONE mogućnost jednim kompatibilnim prelaskom servera i klijenta; očuvati nezavisan EXACT_LOCATION.

**6. Vlasnik zamene — `replacement_owner`**

Poruke i aktivni vlasnik tačnog lokacijskog granta.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Popisati tačne PHONE grane i simbole.
2. Zatvoriti serverski admission pre nego što nepodržani klijenti mogu vratiti mogućnost.
3. Uskladiti UI, portove i testove.
4. Povući nekorišćene grane posle definisane kompatibilnosti.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati opoziv istorijskih PHONE grantova i kompatibilnost receipt-a, uz potrebnu istoriju izvoza/zatvaranja. EXACT_LOCATION, prijava pomoću phone OTP-a i dobrovoljno navođenje broja u slobodnom tekstu su odvojeni ugovori i ostaju nepromenjeni.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Stari klijent ne može ponovo uključiti PHONE deljenje.
- Opoziv istorijskog PHONE granta radi, uključujući posle završenog Dogovora.
- Istorijski receipt-i se dekodiraju bez ponovnog uključivanja PHONE deljenja.
- Poruke rade.
- EXACT_LOCATION saglasnost/opoziv i privatna vidljivost ostaju tačni.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV09 — Namerno odbijajući zastareli taxonomy wrapper

**Veza:** R04, R11, R12. **Izvorni zapis:** `proposed_changes[8]`, `id=SV09`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
public.rpc_taxonomy_ensure_path_service(p_path text[], p_execution_location_mode text, p_related_labels text[])
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[8].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Namerno odbijajući wrapper sprečava zastareli automatski upis kategorija.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Stari pozivaoci čije izvršavanje nije iscrpno opaženo.
- Sadašnja aktivna klasifikacija.
- Telo wrappera je odbijanje, ne drugi funkcionalni klasifikator.

**5. Odluka — `decision`**

Sačuvati kompatibilno odbijanje dok svi dinamički/stari pozivaoci ne budu dokazano povučeni; uklanjanje tek potom ostaje uslovno.

**6. Vlasnik zamene — `replacement_owner`**

Sadašnji potpisani semantic proposal/admission/commit vlasnik.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Potvrditi da podržanom pozivaocu više nije potrebno kompatibilno odbijanje.
2. Sačuvati negativni admission dokaz.
3. Ukloniti tačan wrapper i grantove tek kada je zamenski ugovor proveren.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Nijedan stari pozivalac ne vraća nekontrolisani upis kategorija.
- Sadašnji potpisani new/reuse/mode put uspeva.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV10 — Tačno sedam DEV tabela bez PK; strukturisani reset arhiv ostaje

**Veza:** R10, R11, R12. **Izvorni zapis:** `proposed_changes[9]`, `id=SV10`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
private.dev_phase1_20261014_catalog_snapshot
private.dev_phase1_20261014_dispatch_snapshot
private.dev_phase1_20261014_needs_snapshot
private.dev_phase1_20261014_opportunity_snapshot
private.dev_phase1_20261014_worker_capabilities_snapshot
private.dev_test101_owner_profile_backup_20261014
private.dev_test101_owner_worker_profile_backup
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[9].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

DEV kopije mogu i dalje biti ulaz zatvaranja/redakcije ili potreban dokaz migracije/povratka.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Šest od sedam tabela bez PK nalazi se u sadašnjem closure inventaru/redakciji.
- needs_snapshot se čita u guard SELECT-u i dinamičkom NEED scope-u.
- Odsustvo kvalifikovane reference za catalog_snapshot nije potpun dokaz da je nepotreban.

**5. Odluka — `decision`**

Uslovno povlačenje tek kada se razreše svrha, retention i konkretne sadašnje zavisnosti. Ne dodavati PK samo da bi advisor prestao da upozorava.

**6. Vlasnik zamene — `replacement_owner`**

Sadašnji merodavni podaci, minimalan potreban dokaz i usklađen lifecycle inventar.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Prema postojećim pravilima odrediti potreban dokaz i retention.
2. Preseliti ili sačuvati nužnu kopiju.
3. Prevezati inventory/guard/scope/projection.
4. Dokazati da nije ostao poziv uklonjene relacije.
5. Tek novom migracijom ukloniti tačno odobren višak.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati aktivne podatke i potrebne istorijske dokaze. private.dev_worker_profile_reset_snapshots_v1 je zaseban strukturisani lifecycle arhiv: nije jedna od ovih sedam tabela bez PK i ne pripada njihovom spisku za povlačenje. Njegova workAreas projekcija rešava se pod SV06; arhiv ostaje KEEP u ovom obimu.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Izvoz/zatvaranje imaju potpun sopstveni scope.
- Nijedan guard ne poziva odsutnu tabelu.
- Potrebe istorijskog replay-a i dokaza ostaju ispunjene.
- Čišćenjem se ne uklanjaju aktivni korisnički podaci.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV11 — Samo redundantni scope lookup indeks

**Veza:** R11, R12. **Izvorni zapis:** `proposed_changes[10]`, `id=SV11`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
private.work_taxonomy_service_scopes_lookup
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[10].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Neunikatni lookup indeks tačno duplira btree pokriće primarnog ključa.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Potvrđeni isti ključevi, opclass, kolacije, redosled, predicate, include i tablespace.
- Lookup nije vezan za constraint.
- Eksplicitni index hint-ovi i operativne reference i dalje zahtevaju proveru.

**5. Odluka — `decision`**

Uslovan uski DROP samo lookup indeksa; primarni ključ ostaje.

**6. Vlasnik zamene — `replacement_owner`**

private.work_taxonomy_service_scopes_pkey.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Proveriti tačan preimage i zavisnosti.
2. Dodati novu usku source migraciju.
3. Sačuvati primarni indeks i ugovor unikatnosti.
4. Proveriti reprezentativni lookup plan.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- PK i dalje odbija dupliran par.
- Lookup vraća iste podatke.
- Uklanjanje 8.192 bajta nije samo po sebi dokaz merljivog ubrzanja.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV12 — DEV dijagnostički 410 endpoint-i i debug tabela

**Veza:** R11, R12. **Izvorni zapis:** `proposed_changes[11]`, `id=SV12`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
public.gemini_debug_log
Edge sbfenv
Edge uskoci-gemini-provider-probe-dev
Edge uskoci-gemini-schema-smoke
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[11].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Tri objavljena DEV endpoint-a su HTTP 410 stubovi; to ne dokazuje rok čuvanja ili dozvolu brisanja istorijske debug tabele.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- Nije pronađen sadašnji Edge/migration ili public/private body potrošač debug tabele.
- RLS bez politike odbija relevantne klijente po podrazumevanom pravilu.
- Spoljni dijagnostički/istorijski potrošači nisu isključeni.

**5. Odluka — `decision`**

Uslovno povući endpoint-e i debug skladište tek nakon dokaza vlasnika, životnog ciklusa podataka i kompatibilnosti. Sadržaj poslovnih redova nije čitan u ovoj analizi.

**6. Vlasnik zamene — `replacement_owner`**

Sadašnje minimalne operativne metrike bez ličnog sadržaja i očuvan potreban audit dokaz.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Utvrditi retention vlasnika i potreban dokaz.
2. Proveriti odsustvo podržanog potrošača.
3. Obraditi zadržane podatke kroz odobren lifecycle.
4. Ukloniti tačno zastarele artefakte.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Aktivna dijagnostika ostaje funkcionalna.
- Privatni sadržaj ne dodaje se u zajedničke keševe/logove.
- Odgovor povučenog endpoint-a i životni ciklus podataka dokazani su odvojeno.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV13 — Precizno bezbednosno ojačanje bez cilja nula upozorenja

**Veza:** R01, R11, R12. **Izvorni zapis:** `proposed_changes[12]`, `id=SV13`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
private.notification_copy_v5(p_text text)
pg_net extension schema placement
leaked-password protection advisory
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[12].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Sadašnja hardening upozorenja razrešavati prema stvarnom potrošaču i konfiguracionom riziku, ne radi broja nula u advisor-u.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- notification_copy_v5 je invoker sa literalnim CASE-om i EXECUTE samo za postgres.
- Cron koristi net.http_post reference.
- Potpuna Auth management konfiguracija nije dostupna kroz korišćeni konektor.

**5. Odluka — `decision`**

Gde odgovara postaviti bezbedan izričit search_path; proceniti premeštanje ekstenzije prema net potrošačima; proveriti primenljivu Auth zaštitu lozinki kroz podržan management pristup.

**6. Vlasnik zamene — `replacement_owner`**

Postojeći prevodni CASE, zakazani HTTP transport i sadašnji Auth tok.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Samo advisor upozorenje nije dokaz trenutno dostižnog napada. Koristiti podržan put administracije ekstenzije i Auth-a.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Najpre rešavati primarne propuste privatnosti.
2. Pregledati tačne postavke, podršku ekstenzije i pogođene pozivaoce.
3. U odobrenoj implementaciji napraviti minimalnu kompatibilnu promenu.
4. Dokumentovati namerno zadržana upozorenja.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Prevod ostaje isti.
- Cron HTTP put ostaje funkcionalan.
- Primenljiva password politika je potvrđena, uz očuvan OTP/session tok.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

#### SV14 — Poreklo migracija, čist bootstrap i zaseban upgrade

**Veza:** R12. **Izvorni zapis:** `proposed_changes[13]`, `id=SV14`, u [serverskom manifestu](dokazi/server_final/change_manifest.json).

**1. Tačan identitet — `exact_object_identity`**

```text
193 source SQL migrations
314 database migration ledger records
```

**2. Postojeći dokaz — `current_evidence`**

Zajednički dokaz E1 iznad: pun source SHA, DEV projekat i sva četiri priložena dokazna skupa. Pojedinačna veza je `proposed_changes[13].current_evidence`; pri budućoj implementaciji proveriti relevantni delta prema tom preseku.

**3. Svrha i ciljno pravilo — `role_and_target_rule`**

Ponovo izgraditi sadašnju šemu i nadograditi postojeći deploy uz očuvano stvarno istorijsko poreklo.

**4. Ulazne i izlazne zavisnosti — `incoming_and_outgoing_dependencies`**

- 219 ledger zapisa ima NULL statements.
- Tri najnovija preimenovana ID-ja razlikuju se samo završnim CRLF-om.
- Preduslovi istorijskih proof fixture-a.
- Svi schema/ACL/RLS/trigger/index/Edge i old-client ugovori.

**5. Odluka — `decision`**

Sačuvati primenjenu istoriju; pripremiti izolovan čist bootstrap i odvojen upgrade. Ne pokretati ponovo 100 verzija samo zato što se ID-jevi ne poklapaju.

**6. Vlasnik zamene — `replacement_owner`**

Verzionisano poreklo sadašnje šeme i referentnih podataka, uz posebno imenovane potrebne fixture-e.

**7. Kompatibilnost podržanih klijenata — `supported_client_compatibility`**

Pre povlačenja ili izmene ugovora proveriti podržane stare klijente i pozivaoce iz stvarno objavljenih Edge paketa.

**8. Redosled promene i isporuke — `change_and_deployment_order`**

1. Mapirati tačne dokaze bajtova, imena i verzija.
2. Razrešiti nedostajuće originalne izjave ili alternativnu sadašnju baseline osnovu bez izmišljanja istorije.
3. Pripremiti izolovan bootstrap i upgrade.
4. Izvršiti ih tek u narednom odobrenom okruženju.
5. Uporediti puno efektivno stanje i podržane klijente.

**9. Očuvanje podataka i prava — `data_and_access_preservation`**

Sačuvati postojeće vlasništvo, saglasnost, privatnost redova i kolona i korisničke podatke. Aktivni zapisi se ne brišu pod nazivom čišćenja.

**10. Povratak i granice oporavka — `rollback_or_recovery_limits`**

Koristiti pregledanu dopunu unapred ili kompatibilan povratak tek posle dokaza stvarnog prethodnog stanja. Istorijski SQL nije automatski spremna komanda za izvršavanje.

**11. Pozitivno i negativno prihvatanje — `positive_and_negative_acceptance`**

- Deterministička čista izgradnja.
- Kontrolisana nadogradnja postojećeg DEV-a.
- Nema dupliranih efekata migracija.
- Stvarni preimage i granice oporavka su poznati.
- Nema prinudnog ledger repair-a radi poklapanja brojeva.

**12. Stvarni status — `actual_status`**

Analiza i plan su zapisani; implementacija nije izvedena: `ANALYSIS_AND_PLAN_COMPLETE_IMPLEMENTATION_NOT_PERFORMED`. `destructive_action_ready=false`. Status ostaje vezan za postojeći dokaz, bez novog runtime PASS-a u ovoj reviziji.

### 7.4. Poreklo migracija, indeksi i granice statistike

Sledeći brojevi i definicije preneti su iz rev7 serverskog pregleda; u ovoj reviziji nisu ponovo upitani iz baze.

Z15 beleži svih 193 source migracija i 314 tadašnjih ledger zapisa. Isti ID postoji za 93 source fajla; 100 source ID-jeva nema isti DB ID, a 221 DB ID nema isti source ID. Po imenu se poklapa 94 source migracije; 97 nema ni isto ime ni verziju. Od 314 DB zapisa, 219 ima NULL statements. Samo 39 source fajlova je bajtno identično sačuvanim statements spojenim novim redom. Ovi brojevi označavaju poreklo, ne 100 unapplied migracija i ne zahtev za ledger repair.

| Source ID | DB ID | Naziv | Potpuno pročitana razlika |
|---|---|---|---|
| 20261026145430 | 20261026145706 | worker_ai_signed_work_areas | Samo dodatni završni CRLF; sva tri funkcijska tela ista. |
| 20261026150020 | 20261026150106 | worker_ai_area_source_continuity | Samo dodatni završni CRLF; telo funkcije isto. |
| 20261026150523 | 20261026150745 | classification_hint_revision_fence | Samo dodatni završni CRLF; sva četiri funkcijska tela ista. |

F14 zahteva odvojena dva puta: determinističku izgradnju novog izolovanog okruženja i kontrolisanu nadogradnju postojećeg DEV-a. Porediti definicije, grantove, policy/default izraze, triggere, indekse i potrebne referentne podatke. Ne izvoditi restore/repair na živom sistemu radi usklađivanja broja. Tri istorijske proof migracije sa fixture preduslovima ostaju poseban bootstrap problem iz odeljka 8.4 ovog plana; njihova pročitana prisutnost nije dokaz neuspeha svake obnove.

**Savetnici:** 325 security stavki u šest grupa i 136 performance stavki u pet grupa su presek rev7 pregleda, dok ranijih 322 ostaje istorijski. Svih 136 performansnih preporuka dobilo je zapis i vezu sa konkretnom tabelom, trenutnim indeksima i pronađenim funkcijskim referencama. 93 FK bez pokrivajućeg indeksa traže stvaran relevantan query/delete plan; 18 ponovljenih auth/current_setting poziva u RLS može se optimizovati samo uz očuvanu semantiku; pet permissive preklapanja može namerno predstavljati OR dozvoljenih publika. Trinaest indeksa sa nula evidentiranih scan-ova nije automatski za brisanje. Sedam snapshot tabela bez PK prvo zahteva odluku o životu i zavisnostima podataka.

Statistika je sa DEV-a: 167 public/private tabela, oko 25 MB sa njihovim indeksima/TOAST-om, ne veličina celog projekta. `n_live_tup`/`n_dead_tup` su procene. PostgreSQL je 17.6; zabeleženi globalni reset statistike je 20.08.2026. u 19:53:32 UTC, ali pojedinačni reset nije isključen. `track_functions=none`, pa nema osnove da se funkcija proglasi mrtvom na osnovu odsutnog broja poziva. Ovaj teret rada nije reprezentativan produkcioni benchmark.

**Dokazivo preklapanje indeksa:** `private.work_taxonomy_service_scopes_lookup` i `work_taxonomy_service_scopes_pkey` imaju btree nad `(category_id, normalized_scope)`, iste kolacije, klase, smer, broj ključnih/ukupnih atributa, tablespace i reloptions, bez izraza/predikata. Lookup je nonunique/nonprimary, bez constraint-a; PK je unique i vezan za primarni ključ. Lookup je validan/ready, 8.192 bajta, nula scan-ova. Povlačenje obuhvata novu migraciju, source kontrolu, proveru eksplicitnih index/hint zavisnosti i očuvanu unikatnost/lookup; PK ostaje. To nije nalog da se uklone ostali indeksni kandidati.

**Stare tabele sa sadašnjim potrošačima:** šest od sedam DEV snapshot/backup tabela je u `closure_taxonomy_inventory_v1`, `closure_redaction_relations_v5` i `closure_redaction_patch_v5`. `dev_phase1_20261014_needs_snapshot` dodatno čitaju `closure_taxonomy_snapshot_guard_v1` i dinamički `closure_taxonomy_scope_v1`. Za `dev_phase1_20261014_catalog_snapshot` nije pronađena qualified referenca u trenutnim telima; to nije dokaz odsustva istorijske/operativne potrebe. Povlačenje mora prvo promeniti kodirane inventare, guard i scope, sačuvati nužan audit/rollback dokaz i ponovo proveriti export/closure, pa tek potom ukloniti tabelu.

`pg_depend` ima 6.168 relevantnih veza; dodatni indeks iz svih 680 prethodno pročitanih, sveže identičnih tela sadrži kvalifikovane reference. U src/ i Edge source-u nađeno je 95 literalnih `.rpc` mesta u 87 imena. To nije potpun pozivni graf: generički transport, string tela, nekvalifikovani i dinamički nazivi, stari klijenti i operativni pozivi imaju posebnu proveru. [PostgreSQL dokumentacija](https://www.postgresql.org/docs/current/ddl-depend.html) izričito opisuje granicu praćenja zavisnosti u tekstualnim telima. Z16 zato čuva i nerešeni uslov umesto lažne dozvole za brisanje.

## 8. Prihvatanje, testovi i merenja

### 8.1. Kako se bira dovoljna provera

Za svaku promenu birati najkraći dokaz koji prelazi stvarnu rizičnu granicu. Promena wire ugovora traži stvarni odgovor kroz pravi decoder; promena prava pozitivni i negativni autorizovani zahtev; promena native geometrije stvarni prikaz i gest na uređaju. Izmena nekoliko reči sama ne zahteva novi veliki testni sistem.

Sačuvati korisne postojeće provere i dopuniti konkretno odsutni slučaj. Ne uvoditi hiljade testova koji samo preslikavaju implementaciju. Broj testova, source snapshot ili PASS pogrešne karakterizacije nisu dovoljan kriterijum. Istorijskih 14.143 testa i raniji CI uspeh nisu novo izvršenje ove revizije.

Pre starog harness-a pročitati njegov početni mutirajući rad, environment guard, obuhvat podataka i cleanup/rollback. `SELECT` koji poziva mutirajuću funkciju nije read-only. Destruktivni helper za DROP, repliku, cron ili prekid backend-a pripada potvrđenoj izolovanoj bazi sa odgovarajućim zadatkom, nikada nepoznatom DB_URL-u. Ovo pravilo ne sprečava rutinske lokalne i bezbedne read-only provere.

**Proverivač mora moći da padne:** tražiti stvarne obavezne grane, NULL-safe uslove i kardinalnost, neprazan fixture/oracle, pravi stage, aktuelno telo i pravi decoder. Neoznačeni fallback, izostali slučaj ili `notVerified` ne postaju PASS. D12 ima validan stvarni P5 dokaz, ali završni status ne zatvara sve dodatne gap grane. EX06 PARTIAL/SMOKE_ONLY ostaje ograničen dokaz. Istorijski equipment/fee/PHONE/11-stem test nije izvor sadašnje poslovne politike. Jake lock/RLS/receipt provere ostaju.

### 8.2. Zajednički prihvatni slučajevi A01–A25

Sledeći slučajevi su merila završnog ponašanja, a ne tvrdnja da svi danas padaju. Za SB/X se dodatni konkretan uslov nalazi u odgovarajućem R11 podzadatku ili R09/R10. Svaki scenario koristi postojeće smisleno pokriće i samo potreban dodatni dokaz. Rezultat se vezuje za tačan klijent/server i ne prenosi automatski na drugo izdanje.

| Scenario | Očekivano ponašanje i potrebna granica |
|---|---|
| **A01 Korekcija valute** |5.000 RSD→„mislio sam evre”: stara cena gubi status važeće saglasnosti; nema izmišljenog kursa/OFFERS. F03 guard→writer→signed review→accept/objava. |
| **A02 MY_PRICE satnica / OFFERS** |Jedinica ostaje ista kroz podržan domen; OFFERS zaseban izbor. F02 validator/Edge/application writer i stari podržani decoder. |
| **A03 Sinonim i tekstualni writer** |„Oprati prozorska stakla” za postojeće „Pranje prozora” bez upisanog alias-a: isti ID i isti scope, bez fasade/novog duplikata. F05 model→provera→review→binding; proveriti i Need text-trigger, canonical/registrovan/neupisan alias, pogrešnu parent putanju i ID-only binder. |
| **A04 Stvarno nova usluga** |Opravdan parent ili potrebna nova grana/path, konkretan smisao i stvarni DB ID; jasnoća ne zavisi od razmaka u nazivu. Predlog nije aktivna sposobnost pre potvrde. F05. |
| **A05 BOTH** |Časovi online i kod polaznika: oba moda, isti ID; kontrolisano izostavljanje REMOTE ne daje lažno potpun rezultat. F08 builder→review→Save. |
| **A06 Radionica/predaja** |Popravka računara kod izvršioca, donošenje/preuzimanje u Novom Sadu: REMOTE sa tim handoff-om, bez ON_SITE/kurira/svetske isporuke po pretpostavci. F08/F10. |
| **A07 Bogat profil** |Osam usluga: ukloniti jednu, dodati jednu, promeniti jedan mode; sve nepogođene usluge i handoff ostaju. Biografija se menja samo gde postaje netačna. Rename/sync ne gubi postojeći ID zbog neupisanog sinonima; nepoznato dodavanje uz staru uslugu ne ukida sve; izričito povlačenje ostaje delotvorno. F05/F06/F08. |
| **A08 Više područja** |Novi Sad 30 km ostaje, Subotica CITY→Beograd CITY; bez izmišljenog radijusa/GPS adrese. Stvarni resolver→workAreas→signed Save/readback/matching; ne tiho legacy svođenje. |
| **A09 ACTIVE + pending** |Pokazati konkretno čekanje nove promene, ne pripisati joj autoritet iz ACTIVE i ne ugasiti nezavisne stare potvrđene izbore bez server pravila. F06/F10. |
| **A10 Izgubljen Save/publish ACK** |Isti command/owner/digest, canonical readback, bez novog modela/evaluacije/objave pri samom povratku. DRAFT Save i aktivacija/objava ostaju odvojeni izbori. |
| **A11 Izgubljen abandon ACK** |ABANDONED+Proveri potvrđuje napuštanje bez novog prepare/write; OPEN kontrola ne daje lažan uspeh. F11. |
| **A12 Moji zadaci** |Svih 5 scope-ova, counts, prazna/neprazna prva i naredna strana/cursor, pravi task oblik kroz pravi decoder. F01. |
| **A13 Parcijalan katalog** |Neuspeli CHILDREN na malom stablu i nextCursor slučaj; potpun kasniji snapshot zamenjuje parcijalno. Nema lažnog „usluga ne postoji”. F04. |
| **A14 Dovršavanje klasifikacije** |Tehnički BG/capture prekid dobija bounded trajni nastavak. Uspešan BG zatim vreme→područje→„to je to” čuva tačan plan; stvarna usluga/mod promena odbacuje stari. F06/F07; per-attempt obračun. |
| **A15 Jedno pitanje** |Satnica + ponavljane subote: zadržati jasan posao, tražiti jednu sledeću odluku, sačuvati drugu nejasnoću. F12. |
| **A16 A→B→A/fokus** |Kasni turn/review/Save i F13 sporedni upis ne ožive samo zbog istog account ID-ja; ne brišu novi unos niti tuđu/noviju listu. |
| **A17 Tačna isporuka** |Source/Edge/SQL/flags/APK/OTA/device zabeleženi; obe uloge završe dogovorene tokove uz pravi readback. Kvalitet modela, latencija i trošak zahtevaju stvarno ograničeno merenje. F14. |
| **A18 Prirodan završetak** |Routing poznat +„to je to” vodi jednom pregledu bez obaveznog bio/kalendar/mode formulara; zaista obavezno nepoznato daje jedno pitanje. F09 i requester readiness. |
| **A19 Instalirani discovery ugovor** |Matrica podržani stari native/OTA × ciljni novi klijent × stvarni backend: cold onsite PAGE+MAP, prazno/popunjeno, pan/next page, PLACES, forMe/minimum budget, EXACT_PUBLIC, HOURLY politika i REMOTE bez MAP zahteva. F15/F02, uz očuvane ACL/anchor/cancel granice. |
| **A20 Greške u raspoloživom prostoru** |Isti failure na prvom ulazu i retry; PAGE uspeh/MAP failure; HALF/FULL/PEEK, mali ekran/veliki font, native map failure odvojeno. Objašnjenje i akcija vidljivi, lokacijsko dugme smisleno. F16. |
| **A21 Bezbedna dijagnostika** |Auth/permission/contract/network/deadline imaju razlikovljiv interni razlog, prikladan kratak korisnički tekst i retry; nema literalnog true ni privatnog provider/SQL sadržaja. F17. |
| **A22 Buduća dostupnost i izuzetak** |Izričita dostupnost od budućeg datuma ili jedan kalendarski izuzetak menja pravi kalendar/matching samo u traženom opsegu; druga pravila ostaju. Zona, lokalni datum i instant ostaju tačni, uključujući promenu sata. Nije novo obavezno pitanje u intervjuu niti nov dokaz kvara. |
| **A23 Privatnost, izvoz i zatvaranje** |Autorizovani izvoz, opoziv granta, javna privatnost i završetak zatvaranja imaju potvrđen status/readback. Kasni pokušaj ne obnavlja povučeni pristup; važeće zadržavanje podataka nije isto što i javna dostupnost. Sačuvan raniji kriterijum, bez tvrdnje da je ceo tok sada izvršen. |

Za SB/X slučajeve uslov zatvaranja je u njihovom redu, kod konkretnog vlasnika. Cilj je proverljiv poslovni i korisnički rezultat kroz tačno utvrđenu granicu. Dodatni nepovezani PASS, promenjen tekst bez popravljenog stanja ili sama jednakost hash-a ne zatvaraju nalaz.

#### Dodatne zajedničke granice

F21 prvo traži obnovljenu granicu privatnih kolona uz funkcionalne javne/sopstvene čitače. F18 traži istu listu dozvoljenih parova područje/topologija/vreme u retrieval→matcher→Za mene→dispatch, uz ručni submit/select koji zadržava svoje granice. F19 traži workAreas u svakoj živoj/arhivskoj projekciji i potpunu novu proveru izvoza/zatvaranja pre aktivacije. F20 traži kapacitet reda, same-revision response suppression i stvarni cilj pri PUSH on/IN_APP off. Pozitivne kontrole su običan prvi kandidat, validna stara sačuvana usluga, oba moda istogID-a, namerno isključen push i opravdano odbijena tuđa/istekla radnja.

Globalna provera čuva trenutne signed service-scope consent, saved review/request identitet, reviziju, account/world i kalendar. Current TOTAL je srazmeran covered/original slots; stare testove koji traže all-slots politiku prevoditi na važeći ugovor. Availability testovi sa New York uređajem često namerno očekuju Europe/Belgrade poslovnu politiku; nisu sami dokaz buga vremenske zone ili globalne podrške. OWNER_PERSONAL/OWNER_BUSINESS trenutno pripadaju TEST svetu kao namerna DEV izolacija; release izlaz je izričit preduslov, ne tiha data promena.

#### A24/A25 — dve izričite regresione granice celog toka

**A24, zamena javne objave:** `pregled-zadatka.tsx:201–210` i replacement decoder opisuju odvojenu novu objavu. Aktuelni `rpc_publish_need_canonical` odgovara telu u `20261021101159_staged_task_replacement.sql:812`, a `cancel_replaced_task` telu na `:639`; trenutni `finalize_task_replacement` dodatno odbija `NO_MATERIAL_CHANGE`. U istom publish pozivu finalizacija zatvara staru objavu i prijave pre potvrde nove, uz transakcioni rollback pri kasnijoj grešci. Nema prenosa tuđe prijave na nove uslove. To je SOURCE ugovor potvrđen aktuelnim body tragom i novim poređenjem otisaka, ne nov runtime PASS. R07/R08/R12 treba da sačuvaju uspešnu, odbijenu, neizmenjenu i prekinutu zamenu, bez gašenja prethodne objave pre uspeha. Četiri opisana body odnosa pripadaju rev7 dokazu; nisu novo izvršavanje ove revizije.

**A25, samo poruke:** STATUS već određuje povlačenje PHONE mogućnosti iz Dogovora. Aktivni `AgreementContactPlace` vodi u Poruke i odvojeno čuva lokacijsku dozvolu. Završni dokaz R11/R12 mora obuhvatiti server i podržane stare klijente; slobodno kucanje broja u poruci nije automatski nova moderaciona zabrana. To je zatvaranje važeće namere, bez vraćanja stare opcije iz istorijskih testova.

### 8.3. Tačno pročitani CI ulazi na a969

Sledeće su **stvarne komande workflow-a na a969**, prenete iz pročitane konfiguracije `package.json` / `.github/workflows/ci-clean.yml` i potvrđene lokalnim poređenjem pri dokumentnom pregledu. To nije njihovo novo izvršenje niti novi CI PASS. [Z09 je sada priložen](dokazi/namena_i_testovi/intent_review.json): `ci_selection` beleži stvarni izbor, `test_matrix` raspored i granice dokaza, a `test_command_review` preduslove i bezbednost komandi. Ranija nedostupnost Z09 drugom razgovoru više nije ograničenje ovog paketa. Workflow koristi Node 24, Python 3.11 i Deno 2.5.6, uz 30-minutni job timeout i read pristup repozitorijumu.

```bash
npm ci
npx tsc --noEmit

deno check --no-config --no-lock --no-npm --no-remote \
  supabase/functions/uskoci-ai-interview/index.ts \
  supabase/functions/uskoci-worker-interview/index.ts \
  supabase/functions/uskoci-taxonomy-postsave-worker/index.ts

npm test -- --maxWorkers=2 --silent

node --test --test-concurrency=2 --test-reporter=dot supabase/proofs/ai/*.test.mjs

node --test --test-reporter=dot \
  supabase/proofs/dynamic_taxonomy/worker-interview-question-policy.test.mjs \
  supabase/proofs/taxonomy/published_need_category_gate.test.mjs \
  supabase/proofs/taxonomy/live_writer_characterization.test.mjs \
  supabase/proofs/dynamic_taxonomy/classification-owner-review.test.mjs \
  supabase/proofs/dynamic_taxonomy/worker-signed-review-source.test.mjs \
  supabase/proofs/dynamic_taxonomy/need-review-signed-source.test.mjs

node --test --test-reporter=dot \
  supabase/proofs/dynamic_taxonomy/classification-gemini-shadow.test.mjs \
  supabase/proofs/dynamic_taxonomy/service-handoff.test.mjs \
  supabase/proofs/dynamic_taxonomy/worker-existing-identity-recovery.test.mjs \
  supabase/proofs/dynamic_taxonomy/classification-direct-reply.test.mjs \
  supabase/proofs/dynamic_taxonomy/classification-verified-alias.test.mjs \
  supabase/proofs/dynamic_taxonomy/classification-turn-feedback.test.mjs \
  supabase/proofs/dynamic_taxonomy/classification-gemini-shadow-source.test.mjs

python supabase/migrations/check_migration_integrity.py
python -m unittest discover -s supabase/migrations -p test_migration_integrity.py
```

Izvršavati iz korena stvarne radne kopije uz postojeći lock i pročitana repo uputstva. `npm ci` pokreće postojeći postinstall: `patch-package --error-on-fail --error-on-warn`, `scripts/verify-native-patches.cjs` i `scripts/sync-entry-reference-assets.cjs`. Ne rešavati neuspeh preskakanjem tih zaštita. Instalacija može zahtevati dostupnu mrežu i odgovarajući runtime; odsutan preduslov beleži se kao blokada, ne kao prolaz. Plan ne nalaže nasumično ažuriranje zavisnosti.

Jest selekcija iz analize je `**/__tests__/**/*.test.ts?(x)`. `.mjs` nije Jest test samo zato što u imenu ima `test`; gornji Node izbor obuhvata AI glob i 13 imenovanih taxonomy testova. `taxonomy-postsave-worker.test.mjs` i `worker-finish-mode-completeness.test.mjs` nisu u toj Node selekciji. `v5_media_deno_runtime.test.ts` nije deo prikazanog izvršavanja. Njihov konkretan R zadatak određuje potreban zaseban poziv posle provere setup-a, bez uključivanja svih istorijskih mutirajućih alatki.

Globalni Jest setup koristi UTC i legacy HITNO flag; `urgent-hidden-in-v1` uklanja taj flag da sačuva odsustvo opcije u V1. To ne menja kanon proizvoda. Zasebna provera vremenskih zona mora koristiti drugi TZ i jasno poslovno pravilo.

`currency_correction_characterization.test.mjs` reprodukuje staru potvrđenu cenu/satnički nesklad, a `background_capture_receipt.test.mjs` odsustvo automatskog nastavka. Oba mogu biti zelena uz postojeći kvar. Posle popravke sačuvati reprodukcioni ulaz, a završni uslov uskladiti sa željenim ishodom. Prompt-string test `interview_voice_one_question.test.mjs` i SQL-string test `worker_signed_areas_sql.test.mjs` ostaju source zaštite; ne predstavljaju dokaz stvarnog odgovora ili Save-a.

Deno `check` ne pokreće model/server, Python integritet ne dokazuje primenu migracija, a ceo navedeni CI ne zamenjuje native build, živi SQL/API decoder, pravi model, push isporuku ili dve uloge na telefonima. Tačne preuzete testne putanje i nedostajući scenariji raspoređeni su uz R01–R12 u ovom dokumentu.

### 8.4. Bootstrap, nadogradnja i poreklo šeme

R12/F14 mora odvojeno dokazati podizanje novog izolovanog okruženja i kontrolisanu nadogradnju postojećeg. Broj source migracija i ledger zapisa sam ne određuje šta je primenjeno. Porediti stvarne funkcije, ACL, RLS, default/grant izraze, triggere, indekse i neophodne referentne podatke.

Tri istorijske proof migracije imaju posebne fixture preduslove:

| Migracija u `supabase/migrations/` | Potreban prethodni sadržaj |
|---|---|
| `20260901105922_clean_completion_and_writer_authenticated_proof.sql` | Potpuno pokriven aktivni Dogovor; inače `AUTH_PROOF_FIXTURE_REQUIRED`. |
| `20260901113333_clean_ai_interview_turn_authenticated_proof.sql` | Otvoren NEED_INTAKE; inače `AI_TURN_PROOF_FIXTURE_REQUIRED`. |
| `20260901114029_clean_ai_fact_supersession_and_human_correction.sql` | Otvoren razgovor sa aktivnom činjenicom; inače `AI_SUPERSESSION_PROOF_FIXTURE_REQUIRED`. |

Nije izvršen ceo izolovani replay koji bi dokazao da prethodni koraci zadovoljavaju ove uslove. Zato nisu dokazani ni neuspeh svake prazne instalacije ni potpuna reproduktivnost. Potreban je konkretan bootstrap/fixture plan i izvršen rezultat. Primenjena istorija ostaje neizmenjena; stare proof upise ne pokretati na živom sistemu samo zato što su smešteni u migrations folder.

Ranija sumnja da živo telo ne čuva samostalni `priceBasis` ostaje povučena: preuzeto živo telo ga ima, dok ga stariji source prethodnik nema. Otvoren je dokaz porekla i reproduktivne isporuke, a ne ponovo proglašen isti poslovni kvar. Detaljne brojeve i ograničenja porekla koristi odeljak 7.4.

### 8.5. Cele situacije i uređajski dokaz

Jedinstveni izvršni scenario je u odeljku 10.4, sa dva fizička telefona, odvojenim nalozima i zasebnim dokazom svake ciljane platforme. Prihvatni A slučajevi dodaju tačne rizične granice, a R matrice postojeće testne ulaze. Uključiti i offline povratak gde je relevantan; ni zastareo pregled ni neizvestan odgovor ne opravdavaju novu poslovnu radnju ili lažan uspeh.

Ovaj odeljak određuje sadržaj zapisa tog izvršenja. Svaka značajna promena koja poništava određeni dokaz ponavlja samo pogođeni scenario i potreban gate. Uspeh druge verzije, drugog naloga ili druge platforme ne popunjava nedostajući rezultat.

U zapis uređajskog dokaza uneti: scenario J/A/F, uloge, uređaj/OS/font, mrežu, source SHA, native build, OTA/runtime/kanal, backend/Edge/SQL presek, vreme radnje, očekivano, opaženo i granicu. Screenshot/video prati taj zapis; ne predstavlja samostalni dokaz nevidljivog serverskog upisa.

### 8.6. Pravi model, latencija, trošak i kapacitet

Determinističke ugovorne testove odvojiti od ograničenog živog korpusa. Semantička provera traži sačuvanu nameru, činjenice, sigurnu granicu i dozvoljen završetak; ne traži identičnu rečenicu pri svakom odgovoru. Pre živog rada odrediti korpus, broj pokušaja i ukupan budžet u odobrenom opsegu. Beležiti sve foreground/BG/STT pokušaje, retry, timeout, UNKNOWN, provider usage i ograničenja obračuna. Jedan logički posao može imati više stvarnih naplativih pokušaja.

Meriti korisnikov doživljaj i potvrđeni rezultat:

| Mera | Obavezan kontekst |
|---|---|
| Dodir → vidljiv lokalni odziv | Stvaran uređaj, tip radnje i stanje UI-ja. |
| Dodir → prvi koristan sadržaj | Hladno/toplo stanje, mreža, stream politika i verzija. |
| Dodir → potvrđen ishod/readback | Sve relevantne serverske faze i redovi, ne samo provider trajanje. |
| AI ukupni pokušaji i trošak | Korpus, model, tokeni, cache/BG/STT, UNKNOWN i retry. |
| Push čekanje i isporuka | Veličina reda, starost najstarijeg posla, claim/send/receipt/device faza. |
| Recovery posle restarta | Isti identitet radnje, podaci i konačan autoritativni rezultat. |

`PROVIDER` meri modelski stream, a `NEED_COMPLETE`/`WORKER_COMPLETE` SQL completion. Analizirani put zadržava tekst do prihvaćenog completion-a; nijedan taj timer sam nije vreme do korisnog rendera ili pregleda. Ubrzavanje mora sačuvati ovu granicu ili imati jednako jasan novi ugovor.

Uz p50/p95 navesti broj uzoraka i uslove. Četiri ranija realGemini poziva od oko 2,9–7,2 s nisu dokaz p95, odziva ispod sekunde ili uštede od 75%. `realSpendUsd:null` i istorijski koeficijenti nisu stvarna faktura ni dokaz čvrstog ukupnog limita. Cache tokeni uključeni u provider prompt ukupno ne sabiraju se još jednom kao dodatni tokeni.

**Početni predlozi za planiranje, bez tvrdnje da su odobreni ili izmereni:** približno 250 ms za lokalni odziv, do 3 s za tipično mrežno čitanje u dogovorenim uslovima i do 8 s za prvi koristan AI odgovor u p95 reprezentativnog uzorka. Pre release-a granice potvrditi ili obrazloženo promeniti na osnovu merenja; ne pomerati ih tiho radi prolaza. Postojeći discovery deadline od 15 s i stari prozor od 90 s nisu ciljevi normalnog korisničkog čekanja.

Kapacitet reda dokazati ograničenim očekivanim talasom i konkurentnim događajima. Deklarisan batch, uspešan SQL cron ili provider acceptance nisu dokaz uređajske isporuke. Broj sintetičkih profila nije broj istovremenih korisnika. Izmerena tehnička optimizacija prihvata se samo uz sačuvano značenje, prava, potpunost i korisnički rezultat.

## 9. Otvorene odluke i šta može napredovati odmah

Poznata ispravnost, interni tehnički izbor i promena poslovnog obećanja imaju različit postupak. Vlasniku se pokazuje konkretan, pregledljiv predlog samo gde odluka menja proizvod. Izbor klase, retry vlasnika, cache invalidacije ili rasporeda programerskog rada rešava izvršni tim u okviru važeće namere.

### 9.1. Satnica kroz broj ljudi i trajanje — R07b
<!-- EXECUTION-UPDATE-BEGIN: decision-d06-20261028 -->

**Odluka vlasnika 28.10.2026 — Z10/D06 `CONFIRMED`: satnica je po osobi.** Korisnik je u razgovoru potvrdio osnovicu; ovo zamenjuje otvoreni izbor iz sačuvanog REV10 teksta ispod. Ista osnovica mora biti jasno prikazana i sačuvana kroz razgovor, pregled, objavu, prijavu, izbor i Dogovor: RSD po osobi po satu. Primer: dve osobe × tri sata × 1.200 RSD = 7.200 RSD kada su broj osoba i trajanje poznati. Kada trajanje nije poznato, prikazuje se satnica bez izmišljene konačne sume. Ova odluka ne uvodi novu valutu ili automatsku naplatu. R07b implementacija, kompatibilnost postojećih čitača i povezane pozitivne/negativne provere ostaju otvorene; poslovna osnovica više ne čeka odluku.

<!-- EXECUTION-UPDATE-END: decision-d06-20261028 -->

Potrebno je zaključiti da li HOURLY označava cenu po osobi, sat cele ekipe ili izričitu podršku oba značenja. **Dve osobe × tri sata × 1.200 RSD = 7.200 RSD** kada je satnica po osobi; **tri sata × 1.200 RSD = 3.600 RSD** kada je to cena sata cele ekipe. Primer objašnjava ugovor, ne tvrdi da aplikacija već obračunava konačan račun.

Predlog najmanjeg jasnog ugovora jeste satnica po osobi, vidljivo označena kroz razgovor, review, objavu, prijavu, izbor i Dogovor. Kada trajanje nije poznato, prikazati ugovorenu satnicu bez izmišljene ukupne sume. Podrška oba značenja može biti odluka proizvoda, ali se ne izvodi iz enum-a. Pred odluku pripremiti povezane prikaze i tabelu posledica, uključujući kompatibilnost decoder-a.

**R07a korekcija zastarele RSD potvrde, F11 abandon i F13 zaštita paralelnog profila ne čekaju ovu odluku.** Korekcija „mislio sam evre” povlači staru nevažeću saglasnost, ali sama ne uvodi EUR, kurs ili automatski OFFERS.

### 9.2. Područje posla sa više lokacija — deo R05
<!-- EXECUTION-UPDATE-BEGIN: decision-d08-20261028 -->

**Odluka vlasnika 28.10.2026 — Z10/D08 `CONFIRMED`: povezivanje ide prema mestu početka posla.** Za posao sa više lokacija područje radnika proverava se prema polazištu/mestu preuzimanja, uz vidljivu celu rutu. Odredište, usputne stanice i tranzit van sačuvanog područja sami po sebi nisu razlog za isključivanje kandidata po ovom prostornom kriterijumu. Primer: posao Novi Sad–Beograd prostorno se povezuje po početku u Novom Sadu. Za posao na jednoj lokaciji ta lokacija je i mesto početka. Mesto početka mora biti deo potvrđenog posla, a ne pretpostavljeno iz stare profilne tačke ili trenutnog GPS-a.

Odluka zatvara raniji izbor iz REV10 teksta ispod. Ne menja pravila ručne prijave, vreme/raspoloživost i druge uslove podobnosti, niti uvodi automatski izbor izvršioca umesto postojećeg korisničkog izbora. R05 tek treba povezati isti kriterijum kroz pronalaženje kandidata, prostorno filtriranje i slanje preporuka, uz provere za podržane tipove poslova i kontrolisano ponašanje kada potvrđeno polazište nedostaje. Odluka je potvrđena; implementacija i dokaz nisu završeni.

<!-- EXECUTION-UPDATE-END: decision-d08-20261028 -->

Za Novi Sad–Beograd razlikovati rad na lokaciji, mesto preuzimanja, odredište i tranzit. Uporediti najmanje prevoz između gradova, dostavu sa više stanica i stvaran rad na dve lokacije.

| Predlog | Posledica koju treba prikazati |
|---|---|
| Sve stvarne radne tačke u sačuvanom području | Jasniji uslov višelokacijskog rada; može suziti preporuke prevozniku koji dobrovoljno vozi izvan svog polazišnog područja. |
| Polazište/preuzimanje u području uz vidljivu celu rutu | Širi izbor za prevoz; potrebno jasno odrediti za koje topologije važi i šta se obećava primaocu preporuke. |

Nijedan predlog nije ovim planom proglašen prihvaćenim. Ne zahtevati pokriće svakog tranzitnog kilometra i ne menjati ručni `responseAllowed` kao nuspojavu preporuka. Za POINT_TO_POINT/MULTI_STOP/AREA_BASED odluka mora imati tipizovan predicate, primere i pozitivne/negativne parove.

**Popravka stare profilne tačke, već određenog STATIONARY područja, izgubljenog COUNTRY/CITY/RADIUS kandidata i TODAY raspoloživosti napreduje nezavisno.**

### 9.3. Vizuelni pravac, dve mape i platforme

Pripremiti povezane reprezentativne ekrane na postojećim komponentama, sa uspešnim, praznim i neuspešnim stanjima. Potvrda pravca odnosi se na stvaran prikaz; ne tražiti od korisnika da unapred osmisli svaki razmak, naziv klase ili unutrašnje stanje.

Jasno označavanje trajnosti obe mape je obavezno odmah. Promena redosleda pregleda/mape ili mehanike potvrde je zaseban konkretan predlog: `ConversationPointAsk` sada čuva svaku potvrđenu tačku, a `NeedLocationForm` lokalni skup primenjuje kroz novi review. Vizuelno ujednačavanje ne sme neprimetno promeniti njihove writere.

Brojač „0 od 2 → 1 od 2 → 2 od 2” koristiti tek kada je potvrđeno da li model broji osobe, mesta ili timski kapacitet; klik nije autoritativni broj. Redosled Android/iOS objave određuje se prema stvarnom stanju i odluci vlasnika, uz zaseban dokaz za svaku platformu. Postojeće Android APK iskustvo daje početnu osnovu, ne automatsko odricanje od iOS cilja.

### 9.4. Šta nije skriveni deo ovog rada

Nove valute, monetizacija, HITNO, pretplate, ukidanje administrativnog grada, nova GPS SHARE funkcija, promena publike već obećanog javnog komentara ili zabrana brojeva u porukama imaju poseban razlog i odluku ako se uopšte predlažu. Povezivanje već obećane funkcije i ispravka potvrđenog tehničkog kvara ne čekaju izmišljenu novu poslovnu dilemu.

Puni Z09 je priložen, uključujući sedam istorijskih zapisa u `target_decisions.decisions`. Njegove D oznake pripadaju tom izvornom registru i nisu iste kao petnaest odluka u kasnijem Z10 (`decisions.decisions`). U ovom planu otvorene D06 i D08 znače **Z10/D06: osnovica satnice** i **Z10/D08: više lokacija**. Na primer, Z09/D06 znači već određeno „Samo poruke”, dok Z10/D06 znači otvorenu satnicu; ne mešati ih po samom broju. Ostala pravila i preporuke prenete su u odgovarajuće zadatke, a istorijski zapisi ostaju dostupni za proveru porekla.

## 10. Produkcija, dokaz izdanja, prodavnice i podrška

### 10.1. Cilj, važenje i status

Cilj je potpuno dovršena aplikacija sa svim postojećim aktivnim funkcijama i potvrđenim obećanjima, proverena u stvarnoj upotrebi i pripremljena za Google Play i Apple App Store. Redosled platformskih izdanja može biti različit. Nezavršena aktivna funkcija ne uklanja se iz obima samo da bi izdanje dobilo zelenu oznaku; namerna promena proizvoda ima konkretnu odluku i usklađene posledice.

**Ovaj odeljak je izvršni plan, a ne potvrda da su produkcija, build, testeri, dokumenti, nalozi ili prijave već završeni.** Zvanični uslovi prodavnica preneti su iz ranije proverenog preseka od **27. oktobra 2026.** Ovo objedinjavanje ne predstavlja novu proveru store pravila. Pred predaju proveriti njihove tada važeće verzije i konkretne poruke konzole. Izvor aplikacije, stanje prodavnice i stvarno instalirani paket imaju zasebne dokaze.

Pročitani [README analiziranog izvora](https://github.com/uskocibusiness-boop/USKOCI-EAN/blob/a9692e11942609bab9406215c3e407d79589dafa/README.md) zahteva odvojen, proveren produkcioni backend. U istom preseku [eas.json](https://github.com/uskocibusiness-boop/USKOCI-EAN/blob/a9692e11942609bab9406215c3e407d79589dafa/eas.json) još sadrži DEV cilj u produkcionom profilu, a build contract namerno sprečava takvu objavu. **Sadašnja zabrana production profila/OTA cilja je bezuslovna; promena backend URL-a sama je ne uklanja.** Zaštita ostaje do eksplicitnog odobrenog i proverenog novog ugovora iz R12c. Stanje ponovo proveriti pre izmene; ne prenositi istorijski podatak kao novu runtime potvrdu.

R12 prikuplja dokaz od prve završene vertikale R01–R11. Konačni pregled povezuje tačne rezultate u jedno izdanje; nije prvo mesto na kome se proverava da li se delovi međusobno uklapaju.

### 10.2. Jedan proverljiv identitet izdanja

Za svakog kandidata voditi jedan zapis u ovom planu ili postojećem projektnom registru. Nema novog paralelnog sistema sertifikata. Ako je podatak nepoznat, označiti ga kao nepoznat i navesti kako se zatvara.

| Sloj | Obavezan sadržaj zapisa |
|---|---|
| Izvor | Repozitorijum, grana, commit, radno stablo, relevantni dependency lock i datum preseka. |
| Baza | Projekat/okruženje, stvarna šema, funkcije, ACL/RLS, primenjene migracije i poznate razlike. |
| Edge | Stvarno objavljene verzije i sadržaj pogođenih funkcija, ugovori i bezbedno proverene efektivne zastavice. |
| Native | Android/iOS, package/bundle ID, javna verzija, build broj, artefakt i bezbedni potpisni metapodaci. |
| OTA | Runtime, kanal, tačan update identitet i dokaz učitanog sadržaja gde je dostupan. |
| Konfiguracija | Auth, redirect-i, mejl, Storage, Realtime, push i ostali potrebni ugovori pravog okruženja; bez tajni u izveštaju. |
| Uređaji | Model, OS, način instalacije/nadogradnje, nalog/uloga, mreža i početno stanje scenarija. |
| Provere | Komanda ili scenario, vreme, rezultat, obuhvat, log bez privatnog sadržaja i relevantan screenshot/video. |
| Otvorene stavke | Vlasnik, razlog, posledica i da li blokira konkretno izdanje ili samo određenu platformu. |

Commit, SQL presek, Edge, native i OTA moraju odgovarati kombinaciji koja je zaista proverena. Zeleni CI drugog commita, stari About ekran ili istorijski telefon ne potvrđuju ovaj zapis. Native SDK, dozvole, potpis i druge native promene zahtevaju odgovarajući novi build; JavaScript OTA nije zamena za njega.

### 10.3. Produkcioni prelaz i obnova

1. **Potvrditi stvarni cilj.** Proveriti trenutno važeći produkcioni projekat, naloge izdavača i dozvoljene deploy radnje. Ne koristiti DEV kao produkciju i ne kopirati razvojne privatne podatke/testne naloge u javno okruženje. OWNER_PERSONAL/OWNER_BUSINESS izlaz iz namernog TEST sveta mora biti izričito projektovan i proveren.
2. **Dokazati bootstrap.** U sopstvenom izolovanom okruženju napraviti bazu iz dokumentovanih ulaza. Razdvojiti potrebni seed od dokaznih fixture-a; stara proof migracija može zahtevati ranije postojeći Dogovor ili AI razgovor. Proveriti stvarne funkcije, šemu, ACL/RLS, trigere i indekse. Uspešan zapis migracije nije dokaz njihove potpune semantičke jednakosti.
3. **Dokazati upgrade.** Nadograditi reprezentativan postojeći presek uz očuvanje podataka, prava i podržanih klijenata. Razlika broja ledger zapisa i source migracija nije sama kvar. Ne ponavljati primenjenu migraciju ili prepravljati istoriju radi lepšeg broja.
4. **Pripremiti kompatibilan redosled.** Najpre dodati i proveriti potrebne ugovore, zatim kompatibilnog klijenta, pa povući stari put kada prestane da bude potreban. Kritična privatnost se ne odlaže radi stare verzije; rešava se odgovarajućom kompatibilnom granicom ili eksplicitnim ograničenjem nepodržanog klijenta.
5. **Proveriti kompletnu konfiguraciju.** Auth/session, validni linkovi, aktivacioni mejl, dozvole, Storage, Realtime, Edge, push, ograničenja i potrebne zastavice moraju pripadati istom okruženju. Puna Auth management podešavanja i efektivne tajne koje nisu viđene ostaju neproverene; ne pretpostavljati njihove vrednosti.
6. **Uskladiti identitet aplikacije.** Paket, potpis, runtime/OTA i native dozvole pripadaju istom nameravanom izdanju. Analizirani [app.config.js](https://github.com/uskocibusiness-boop/USKOCI-EAN/blob/a9692e11942609bab9406215c3e407d79589dafa/app.config.js) navodi Android store paket `rs.uskoci`; stvarni identitet i vlasništvo u Play Console tek treba potvrditi.
7. **Proveriti oporavak.** R12g/R12i za aplikaciju, Edge i bazu odvojeno određuju stvaran povratni ili kompenzacioni postupak. OTA rollback ne vraća šemu niti poništava već nastale poslovne podatke. Pre probne nadogradnje ili deinstalacije zabeležiti lokalne nacrte i nerešene komande, njihovog vlasnika i bezbedan nastavak; odvojeni preview/store identiteti ne garantuju prenos lokalnih podataka. Čista instalacija nije zamena za upgrade/recovery dokaz. Dokaz obnove izvodi se u odgovarajućem izolovanom okruženju, uz očuvanje potrebnih preimage/backup podataka.
8. **Pripremiti pristup recenzentu.** Namenski nalozi i reprezentativan sadržaj moraju omogućiti pregled obe uloge i važnih funkcija bez privilegija nad stvarnim tuđim podacima. Potreban backend ostaje dostupan tokom pregleda.

Pre starih harness-a proveriti prve mutacije, environment guard, obuhvat podataka i oporavak. SELECT nad mutirajućom funkcijom nije read-only. Bootstrap, destructive helper-i, masovni retry i proof upisi ne pokreću se na živom sistemu samo zato što postoje u istoriji. Primenjene migracije i stvarno potrebni dokazi porekla ostaju sačuvani.

#### 10.3.1. R12c — stvarni build vlasnici i namerne zabrane

Sledeće granice potiču iz neposredno pročitanog lokalnog izvora `a9692e11942609bab9406215c3e407d79589dafa` i ranijeg release pregleda, ne iz novog neuspešnog build-a ili današnje udaljene konfiguracije. [Dokazni registar build/native granica](dokazi/provera_plana/release_review.json) čuva opsege, hash-eve i ograničenja. Pre implementacije proveriti relevantnu deltu. Ove zaštite nisu kvarovi koje treba samo isključiti.

| Postojeći vlasnik | Tačno pročitano ograničenje | Potrebna promena i očuvana granica |
|---|---|---|
| `scripts/build-contract.cjs:18–33`; `app.config.js:16–24` | `EAS_BUILD_PROFILE=production` ili `USKOCI_OTA_TARGET=production` bezuslovno odbija `assertProductionTarget`. DEV ugovor čuva tačan projekat i obavezne zastavice. | Eksplicitno odobren ugovor po okruženju/profilu/platformi, sa proverom backend-a, runtime-a i kanala. Novi URL sam ne omogućava production. Ne ukloniti proveru globalno. |
| `package.json:66`; `scripts/check-eas-preview.cjs:45–87`; `eas.json` | Globalni EAS preinstall poziva preview validator; jedini pregledani profil je Android/internal/APK/preview sa tačnim identitetom. | Uskladiti postojeći hook i validatore odobrenih Android/iOS profila. Nova baza ili Apple nalog sami ne stvaraju dozvoljen build put. Sačuvati odbijanje nepoznatih/pogrešnih kombinacija. |
| `app.config.js:35–36,75–91`; `scripts/check-eas-preview.cjs:83–86` | Namenski push proof uklanja inertni plugin koji validator i dalje zahteva. To je već SB14/R11g; običan preview namerno ostaje inertan. | Zatvoriti proof/plugin ugovor bez prebacivanja proof postavki u obično ili store izdanje i bez automatske registracije uređaja radi prolaza. R11g i R12c menjaju iste vlasnike, ne grade dve konkurentske konfiguracije. |
| `app.config.js:7,25–30,82–90`; `scripts/check-eas-preview.cjs:30–43` | `googleServicesFile` se dodaje samo za `rs.uskoci.preview`, a uklanja za ostale pakete; validator traži upravo preview Firebase klijent. Predviđeni store paket je `rs.uskoci`. | Odobren production Android Firebase/FCM identitet i odgovarajuća konfiguracija, uz iOS Bundle ID/APNs/EAS vezu. Ne preimenovati preview fajl niti oslabiti proveru projekta/paketa. Stanje udaljenih naloga/ključeva nije utvrđeno ovim tekstom. |

Obavezne signed/paged zastavice i zabrane test/fake/proof režima moraju pratiti odobren profil. U izlaz ne unositi tajne, tokene ili privatne payload-e. Promena javne build konfiguracije ne potvrđuje sama koji SQL/Edge trenutno radi. R12d/R12e potvrđuju konačan native artefakt i platformne funkcije nakon konfiguracionog prolaza.

#### 10.3.2. Minimalna pozitivna i negativna config/native matrica

Ovo je osam grupa budućih slučajeva, ne već izvršena provera niti svaka moguća kombinacija. Svaka dobija tačan kandidat, ulaz, očekivanje, stvarni rezultat i dokaz. Dopušteni profil ne otvarati pre nego što je njegov ugovor odobren; nedozvoljeni slučaj mora biti stvarno odbijen.

| Slučaj | Pozitivni ili negativni uslov | Granica potrebnog dokaza |
|---|---|---|
| 1. Običan Android preview | Tačan DEV/internal/APK identitet i namerno inertno enrollment ponašanje ostaju dozvoljeni; nepoznata konfiguracija se odbija. | Izvršni validator/config i stvaran odgovarajući APK. Config PASS nije push dostava. |
| 2. Namenski Android push proof | Odobren proof identitet, saglasnost i plugin/validator ugovor; proof postavke ne cure u običan preview/store. | SB14/R11g konfiguracioni slučaj, pa stvaran namenski uređajski scenario. |
| 3. Android production | Odobren poseban backend, package/Firebase/potpis, runtime/kanal i zastavice. DEV cilj, fake/test instrument ili neodobren proof odbijaju se. | R12c prolaz, zatim R12d konkretan AAB i instalacija koju Play isporučuje. |
| 4. iOS interni kandidat | Odobren platformni profil, Bundle ID/provisioning, callback i native capabilities. Android preview ograda ne zaobilazi se. | R12c profil i R12e zaseban iOS artefakt/uređaj; nema pozajmljenog Android PASS-a. |
| 5. iOS production | Produkcijski ugovor i stvarno dokazani iOS opseg, permissions/privacy/APNs i native funkcije. | Svi obavezni iOS izlazi, uključujući AI govor ako je obećan; nedostajuća funkcija ne skriva se bez odluke. |
| 6. Pogrešan OTA/backend/runtime/kanal | Odbiti neusklađen ili neodobren projekat/profil/platformu/paket, runtime ili kanal, kao i nedostajuću obaveznu zastavicu. | Stvarni izvršni negativni slučajevi; validan OTA stiže samo kompatibilnom binary-ju. |
| 7. Odbijena dozvola, opozvana sesija ili odsutan provider | Pošten DENIED/UNCONFIGURED/UNSUPPORTED ishod, bez kasne registracije/snimanja/upisa; ostale dozvoljene funkcije ostaju upotrebljive. | Lokalni port test i potreban fizički provider/uređajski scenario su različiti nivoi. |
| 8. Pogrešan SDK/native artefakt | Neodgovarajući target, arhitektura, biblioteka, potpis, capability ili dozvola obara odgovarajuću obaveznu kapiju iako je offline CI zelen. | Stvarni AAB/IPA, resolved/native podaci i potrebna platformna proba; dependency verzija nije taj dokaz. |

Postojeći testni ulazi i njihove granice navedeni su u R12. Test izvršava stvarni validator sa važećom i nevažećom konfiguracijom; ne piše drugi validator koji samo ponavlja željeno očekivanje. Native push mock ne potvrđuje FCM/APNs; Android speech mock ne potvrđuje iOS mikrofon. Završni dokaz registracije, događaja/reda, provider-a, prikaza i tačnog odredišta ostaje odvojen po fazama iz R09/R12g.

#### 10.3.3. Sedam spoljnih zavisnosti i odgovorni za njihov dokaz

Za svaki red u istom registru izdanja upisati osobu/ulogu, relevantni kod, okruženje/platformu, datum, POTVRĐENO/NEPOZNATO/BLOKIRANO, dokaz i uslov za dogovoreno prvo izdanje. Tabela ne tvrdi da su udaljeni nalozi, kvote ili konfiguracija provereni. Nepoznata uslovna zavisnost ne zaustavlja nepovezanu autorizovanu popravku; potrebna release zavisnost ostaje otvorena kapija.

| Zavisnost | Zadatak i konkretan izlaz |
|---|---|
| Supabase produkcija | R12b: vlasništvo projekta, kompatibilan source/SQL/Edge, Auth/Storage/Realtime/cron, efektivne potrebne zastavice, izlaz TEST sveta i stvaran lifecycle binding. DEV katalog ili istorijski false/true nisu današnji production dokaz. |
| Expo/EAS i prodavnice | R12c/d/e/h: projekat, izdavački nalog, package/bundle ID, signing/provisioning i ovlašćeni operativni pristup. Beležiti bezbedne metapodatke, bez privatnih ključeva u planu. |
| Obaveštenja | R09/R12c: odgovarajući Android Firebase/FCM, iOS APNs/EAS i korisnička saglasnost. Posebno dokazati registraciju, događaj/red, provider, uređaj i dozvoljeno odredište; IN_APP ostaje zaseban izbor. |
| Model i govor | R04/R06/R12e/j: odobren provider/model/projekat, potrebna konfiguracija, kvote, troškovni limit, saglasnost i stvaran input/output. Budžet odrediti pre stvarnih poziva. DEV pristup ne potvrđuje production billing ili kapacitet. |
| Mapa i pretraga mesta | R02/R12g/j: `src/ui/location/ResolvedPinMap.types.ts:29–31` koristi OpenFreeMap style, a `src/data/productionLocationResolver.ts:5–14` LocationIQ put preko sopstvenog Edge-a. Proveriti dostupnost, ograničenja, dozvolu upotrebe i attribution. Uspeh Supabase-a ne dokazuje tiles/geocoder; ne uvodi se automatski novi plaćeni servis. |
| Auth email i javni linkovi | R12b/h: stvarna email isporuka, recovery/redirect i native scheme, dozvoljeni linkovi i preview/production koegzistencija, funkcionalni policy/deletion/support URL-ovi i domen. Ista planirana šema sama nije dokaz opaženog kvara. |
| Podrška i moderacija | R10/R11/R12f/j: stvaran prijem, odgovorna osoba, obrada, status i završetak slučaja, uz stvarne javne kontakte. Postojanje forme ili email stringa nije operativna usluga. |

Jedinstveni dokazni izlaz R12 predviđen je kao `dokazi/izdanje/release_readiness.json`, sa kandidatom, config/native matricom, platformnim artefaktima, spoljnim zavisnostima i operativnim statusom. Plan ostaje operativni ulaz i upućuje na taj dokaz; ne održavati dve neusaglašene činjenice. Ovaj tekst određuje budući izlaz, ne tvrdi da je matrica popunjena ili da je izdanje prošlo.

### 10.4. Dokaz sa dva telefona i stvarnim korisničkim tokom

Završni dvostrani dokaz koristi **dva fizička telefona, dva odvojena testna naloga i stvaran kandidat aplikacije**. Korisnici moraju videti stvarne posledice radnje druge strane. Emulatori, izolovani SQL, mock i jednostrani screenshot ostaju korisni prethodni dokazi, ali ne zamenjuju završni prolaz. Za iOS objavu potreban je stvarni iOS dokaz; dve Android instalacije ga ne daju.

Proći celu priču: opis potrebe → ispravka → pregled → privatni nacrt i ponovno otvaranje → objava → pronalaženje → prijava → izbor → Dogovor → poruke/izmena/završetak → ocena. Odvojeno proveriti profil izvršioca, njegove oblasti i načine rada, Save/Save+activate, izmenu aktivnog profila i nepotvrđeni novi deo bez gašenja nepogođenih potvrđenih usluga.

Obavezne granice završnog prolaza:

- Stvaran model i stvarni upis/readback; nepromenjena usluga ostaje ista kroz novu reviziju, a stvarna promena odbacuje zastareli rezultat.
- Izgubljen odgovor, dupli dodir, restart, zastareo pregled i promena naloga ne stvaraju dupli efekat ili tuđi sadržaj. Nepoznat ishod proverava istu radnju.
- Oba načina iste usluge i relevantna REMOTE predaja imaju potpun i potvrđen smisao; nema lažne fizičke mape.
- Sačuvano područje i vreme prolaze retrieval, fit, „Za mene” i dispatch, uz odvojeno očuvanu ručnu prijavu. Buduća dostupnost i pojedinačni izuzetak menjaju samo traženi opseg; datum, zona i instant ostaju dosledni.
- Lista, mapa i filteri rade sa pravim objavljenim odgovorom i decoder-om; parcijalna greška ne skriva korisne rezultate.
- Push se prati kroz događaj, SQL/HTTP buđenje, claim, provider, uređaj i dodir. Stari TICK_OK, uspešan cron ili provider acceptance nisu svež uređajski dokaz. IN_APP/PUSH preference i autorizacija odredišta proveravaju se odvojeno.
- Poruke i prilozi imaju proverenu vidljivost, nacrt, oporavak i status; PHONE povlačenje pokriva server i podržane stare klijente, uz očuvanu zasebnu preciznu lokaciju.
- Tuđi nalog ne čita privatno; važeći pravni dokument, ponovljena potvrda, izvoz, opoziv download prava i završetak zatvaranja imaju pravi rezultat.
- Instalacija i nadogradnja sa minimalne podržane verzije čuvaju dozvoljene podatke i rešavaju stare komande. Pre deinstalacije proveriti lokalne nacrte; odvojeni preview/store identiteti ne garantuju njihov prenos.
- Mali ekran, uvećan tekst, tastatura, safe areas, Back/gest, čitač ekrana i reduced motion provereni su na odgovarajućoj platformi.

Merenje ovog prolaza koristi jedinstvene definicije, uzorkovanje i budžet iz odeljka 8.6. Zapis konkretnog izvršenja popunjava odeljak 8.5; nema druge paralelne metodologije ili zbirnog PASS-a bez poznatog kandidata.

### 10.5. Artefakti, izlazne kapije i odgovornost

Za svaki red u istom planu upisati **konkretnu odgovornu osobu**, datum i vezu do stvarnog rezultata. Uloge ispod su predlog raspodele odgovornosti, ne tvrdnja da je neko već preuzeo posao. Status počinje kao **UNPROVEN** dok izvršni dokaz ne postoji; konkretna prepreka dobija **BLOCKED**, a **PASS** važi samo za imenovani opseg. „Nije primenljivo” zahteva razlog koji odgovara stvarnom izdanju.

| Kapija / veza | Pregledljiv artefakt | Uslov izlaza | Odgovorna uloga | Početni status |
|---|---|---|---|---|
| Identitet; R01/R12a | Zapis source/SQL/Edge/native/OTA/uređaja | Svaki sloj stvarno potvrđen ili jasno ograničen; kandidat nije mešavina nepoznatih verzija. | Integrator izdanja | UNPROVEN za novi kandidat |
| Privatnost; R01/R10/R12f | ACL/RLS, javne projekcije i negativne probe | Tri privatne kolone zaštićene; dozvoljeni čitači rade; nema prelaska naloga/sveta. | Vlasnik baze i bezbednosti | UNPROVEN |
| AI i potvrde; R04/R06/R08/R12g | Semantički korpus, receipt/readback, attempt/usage rezultati | Potpuni očekivani skup, stabilan ID, pravi Save i ograničen nastavak/trošak. | Vlasnik AI ugovora | UNPROVEN |
| Povezivanje i posao; R03/R05/R07/R12g | Ceo dvostrani scenario | Tačni uslovi, područja/vreme, prijava, izbor, Dogovor i završetak. | Vlasnik poslovnog domena | UNPROVEN |
| Poruke/push; R09/R11/R12g | Svež trag do dva uređaja i autorizovanog odredišta | Potrebni događaji, preference, vidljivost, oporavak i kapacitet reda potvrđeni. | Vlasnik komunikacije | UNPROVEN |
| UI/UX; R02/R08/R11/R12g | Matrica tok–ekran–radnja–vlasnik–test–telefon | Sve aktivne površine imaju konačna potrebna stanja i native dokaz. | Vlasnik UI/UX i mobilne provere | UNPROVEN |
| Podaci i pravni tok; R10/R12f | Verzije dokumenata, consent, export i closure rezultati | Pravi dokument, potrebne kopije, autorizacija i stvaran završetak; binding kapije nisu zaobiđene. | Vlasnik podataka i izdavač | UNPROVEN |
| Reprodukcija/obnova; R11/R12b/R12g | Bootstrap, upgrade, parity i restore/kompenzacija | Potrebna šema/prava reprodukovani; podaci i podržani klijenti sačuvani. | Vlasnik baze i isporuke | UNPROVEN |
| Čist aktivni izvor; R11/R12g | Stvarni manifest izmena/povlačenja i zavisnosti | Uklonjen samo dokazani višak; potrošači prevezani, obavezne provere očuvane. | Integrator i vlasnici domena | UNPROVEN |
| Produkcija; R12b/R12c | Potvrđena ciljna konfiguracija i build contract | Zaseban proveren backend; nema DEV/TEST curenja; zaštita ostaje delotvorna. | Vlasnik isporuke | BLOCKED prema analiziranom preseku; osvežiti |
| Profili i native konfiguracija; R12c | Izvršna matrica §10.3.2 i odobren target/profile/platform ugovor | Važeći profili prolaze, pogrešne kombinacije se odbijaju; preview/proof/production i provider identiteti ostaju odvojeni. | Vlasnik mobilne izgradnje | BLOCKED za nove production/iOS profile prema analiziranom source-u; nije novi build rezultat |
| Android; R12d | Potpisan AAB, Play probe i popunjena prijava | Ispunjene primenljive Android/Play obaveze iz sledećeg odeljka. | Android vlasnik i izdavač | UNPROVEN |
| iOS; R12e | Potpisan iOS kandidat, uređaj/TestFlight i prijava | Ispunjene primenljive iOS/Apple obaveze iz sledećeg odeljka. | iOS vlasnik i izdavač | UNPROVEN |
| Operacije; R12j | Kontakti, obrada prijava, nadzor i postupak incidenta | Neko stvarno prima i obrađuje zahteve; postoji postupak za neispravno izdanje. | Operativni vlasnik | UNPROVEN |
| Konačna predaja; R12h/R12i | Potpun pregled kandidata i otvorenih rizika | Sve obavezne primenljive kapije imaju dokaz; važeće ovlašćenje pokriva predaju/puštanje. | Vlasnik proizvoda i izdavač | Nije odobreno ovim dokumentom |

Za svaki R zadatak završni zapis sadrži problem i posledicu za korisnika, promenjenog postojećeg vlasnika, pozitivnu i negativnu kontrolu, stvarni nivo dokaza i preostalo ograničenje. Ukupan broj PASS testova ne nadoknađuje nedostajući ključni dokaz. Proverivači moraju odbiti nedostajući/NULL/pogrešan rezultat, praznu fixture granu i neoznačen fallback.

### 10.6. Zajednički uslovi proizvoda za prodavnice

**Izdavač i podrška.** Potvrditi stvarni identitet/tip izdavača i obavezne kontakte. Podrška mora primati zahteve sa objavljenih adresa i iz aplikacije. Pravila i politika privatnosti moraju biti javno dostupni i odgovarati stvarnom izdanju; ne ostaviti nacrt, nepopunjeno polje ili link bez sadržaja.

**Mapa podataka.** Popisati nalog, profil, lokaciju, poruke, fotografije/glas, AI obradu, push identifikatore i dijagnostiku, kao i stvarne primaoce/SDK-ove, svrhu, prenos i rokove zadržavanja. Prijave privatnosti ne prepisuju se iz generičkog obrasca. Google Data safety obuhvata i prikupljanje/deljenje kroz ugrađene SDK-ove. [P3]

**AI i saglasnost.** Jasno objasniti koje podatke spoljašnji AI prima i zašto. Apple zahteva jasno otkrivanje i izričitu dozvolu pre deljenja ličnih podataka sa spoljnim AI-jem. Proveriti konkretan tok, verziju obaveštenja i potvrde; postojanje opšte politike samo po sebi nije dokaz ispravne izričite dozvole. Ne uvoditi dodatno pitanje pri svakom pozivu bez razloga iz stvarnog ugovora. [P10]

**Korisnički sadržaj i zaštita.** Potrebni su odgovarajuće prijavljivanje neprimerenog sadržaja/korisnika, blokiranje gde je primenljivo i stvaran proces obrade. Google zahteva odgovarajuću stalnu moderaciju, a Apple obuhvata zaštite za UGC u 1.2. Dugme bez obrade ne završava tok. Definisati odgovornog primaoca, način provere, dozvoljenu meru i obaveštavanje po važećim pravilima; ovaj plan ne izmišlja novu kaznenu ili moderacionu poslovnu politiku. [P4] [P10]

**Dozvole i brisanje.** Mikrofon, fotografije, lokacija i push traže se kada korisnik razume njihovu svrhu. Odbijanje ima smislen nastavak gde je moguć. Brisanje mora stvarno obuhvatiti potrebne podatke, kopije i integracije, uz objašnjena primenljiva zadržavanja. Neispravan retention/export/closure binding popravlja se sadržajno; ne menja se očekivani hash/certifikat samo radi prolaza. Blokirano brisanje nije konačan prihvatljiv korisnički ishod. [P5] [P9]

**Materijal za prijavu.** Naziv, ikona, opis, uzrast/sadržaj, screenshotovi i uputstvo moraju odgovarati funkcijama proverenog kandidata. Pokriti obe uloge i važne dozvole. Ako nema naplate platforme, ne vraćati stare naknade radi popunjavanja listinga ili dokumentacije. Eventualna buduća monetizacija ima zasebnu poslovnu odluku i proveru tada primenljivih store pravila.

### 10.7. Android i Google Play

APK služi Android instalaciji/probi. Za novu Play aplikaciju pripremiti odgovarajući **potpisan Android App Bundle (AAB)** i proveriti aplikaciju koju Play stvarno isporučuje. Uspeh lokalnog APK-a nije dokaz tog paketa. [P1]

R12d beleži hash artefakta, resolved/native config i build podatke: stvarni package ID, target/compile SDK, arhitekture i native biblioteke, potpisne metapodatke, dozvole, runtime i kanal. U ranije pregledanom praćenom source-u nije ustanovljen eksplicitan aplikacijski targetSdk/compileSdk override; to nije tvrdnja o vrednosti generisanog paketa. `android.versionCode=36` nije `targetSdk=36`, a Expo/RN verzija nije 16 KB dokaz. Konfiguracija za `rs.uskoci` i production Firebase/FCM prati R12c; nijedna od tih stavki nije potvrđena novim build-om u ovom dokumentacionom objedinjavanju.

| Stavka | Potreban konkretan rezultat |
|---|---|
| Nalog i paket | Potvrđen vlasnik/tip Play naloga, potrebna verifikacija, aplikacija u konzoli, package ID i ovlašćen pristup. |
| Potpis i artefakt | AAB, odgovarajući ključevi/potpis i bezbedno čuvani potpisni podaci; proverene Play instalacije. [P1] |
| Target nivo | Prema proveri 27.10.2026, nova telefonska aplikacija ili update cilja Android 16 / API 36 ili viši; ne oslanjati se na raniji API 35 prag. Pred predaju potvrditi aktuelni primenljivi zahtev. [P2] |
| Native biblioteke | Proverene potrebne 64-bitne biblioteke i 16 KB kompatibilnost stvarnog paketa, uz primenljivi rok/obaveštenje konzole. [P6] |
| Privatnost | Data safety, politika, dozvole i SDK ponašanje međusobno odgovaraju konačnom build-u. [P3] |
| Brisanje naloga | Put u aplikaciji i javna veb mogućnost za zahtev brisanja naloga i pripadajućih podataka; stvarni postupak iza oba ulaza. [P5] |
| Testiranje | Internal/closed proba kandidata. Za lični nalog otvoren posle 13.11.2023. primenjuje se najmanje 12 prijavljenih testera neprekidno 14 dana pre zahteva za production pristup; potvrditi da li važi za ovaj nalog. [P7] |
| Pregled | Pristup recenzentu, podaci za obe uloge, ispravan listing, sadržajni upitnici i odgovarajuća provera pre objave. |
| Puštanje | Kandidat i primenljive kapije provereni; predaja i javno puštanje pokriveni važećim ovlašćenjem. |

Nalog, testeri, završeni dani testiranja i deklaracije nisu ovim dokumentom potvrđeni. Ispunjenih 14 dana nije automatska garancija production pristupa ili prihvatanja aplikacije. Store paket i preview paket mogu imati različite identitete i lokalne podatke.

### 10.8. iOS i Apple App Store

iOS dobija sopstveni build, potpis, native provere i prijavu. Zajednički Expo/React Native izvor može deliti poslovni kod, ali Android dokaz ne potvrđuje iOS dozvole, tastaturu, navigaciju, medije, linkove ili push.

**R12e ima i konkretan preostali source posao.** U pregledanim `app.json:16–18` i `app.config.js:31–33` nije ustanovljen `ios.bundleIdentifier`; stanje udaljenog Apple/EAS naloga nije iz toga izvedeno. Odrediti odobren Bundle ID, Team/provisioning, build number, capabilities/entitlements, native callback, APNs/EAS i potrebne privacy/permission deklaracije; proveriti stvaran IPA/build podatke i uređaj.

Aktivne AI rute koriste `src/features/voice/useHoldToTalk.ts:32–40`, koji vezuje `createNativeSpeechAdapter`. `src/features/voice/nativeSpeechAdapter.ts:24–42` inicijalizuje capture samo za Android i za iOS vraća `unavailable`; Expo alternativa u `src/features/voice/expoPcmCapture.ts:19–20,116–119` takođe odbija ne-Android. `modules/uskoci-voice/expo-module.config.json:1–4` navodi samo Android. Novi iOS build ili microphone opis zato ne implementira AI govor.

Za puni obećani iOS opseg implementirati i proveriti capture/permission/audio-interruption tok, uz postojeći account/focus/audio-arbiter, ograničenja, otkazivanje i tačnu nameru slanja/transkripta. Dokaz obuhvata dozvolu i odbijanje, background/prekinut zvuk, restart, promenu naloga i sprečavanje kasnog snimanja ili neželjenog slanja. Tekstualni nastavak mora ostati smislen. Uži prvi iOS opseg moguć je samo posle izričite odluke i poštenog UI/store opisa; nije ovim planom odobren. Ovaj nalaz se ne prenosi automatski na zaseban sistem glasovnih priloga u Dogovoru, koji dobija svoj iOS scenario.

| Stavka | Potreban konkretan rezultat |
|---|---|
| Nalog i aplikacija | Potvrđen Apple Developer/App Store Connect pristup, identitet izdavača, bundle ID, potpis i potrebne capabilities. |
| Toolchain | Prema proveri 27.10.2026, minimum za predaju uključuje Xcode 26 ili noviji i iOS 26 SDK ili noviji. To nije tvrdnja da minimalno podržani telefon mora imati iOS 26. [P8] |
| Uređaj i TestFlight | Provereni stvarni iOS tokovi, instalacija, dozvole, back/gest, tastatura, mediji, linkovi i push; odgovarajuća TestFlight proba kandidata. |
| Brisanje naloga | Pokretanje brisanja iz aplikacije. Sama deaktivacija ili obavezan običan mejl podršci nisu dovoljan opšti tok za ovu vrstu aplikacije. [P9] |
| App Privacy i SDK-ovi | Tačni App Privacy odgovori, potrebni privacy manifests i razlozi za obuhvaćene API-je prema stvarnim zavisnostima/build-u. [P11] [P12] |
| Spoljni AI | Jasno objašnjenje i izričita dozvola pre deljenja ličnih podataka sa spoljnim AI-jem. [P10] |
| Način prijave | Ako postoje obuhvaćene društvene prijave, proveriti odgovarajuću alternativu prema pravilu 4.8. Email/password sam po sebi ne znači automatsku obavezu Sign in with Apple. [P10] |
| Korisnički sadržaj | Funkcionalne zaštite i obrada prema 1.2, zajedno sa pravilima proizvoda. [P10] |
| Predaja | Opis, screenshotovi konačnog kandidata, uzrast/sadržaj, support/privacy linkovi, nalozi i napomene za pregled obe uloge. |

Nedostajući iOS dokaz ostaje otvorena iOS stavka. Ne zaustavlja nepovezani Android rad, ali se ne prikriva tvrdnjom da je „aplikacija spremna za obe prodavnice”.

### 10.9. Podrška, nadzor i oporavak posle puštanja

Pre javnog izdanja odrediti stvarnu odgovornu osobu i postupak za kvar glavnog toka, privatnost, zastale pozadinske poslove, porast AI troška, neuspešno brisanje i prijavu neprimerenog sadržaja. Koristiti postojeće instrumente i vlasnike; nova administrativna aplikacija nije automatski potrebna.

Pratiti verziju uz crash/grešku, uspeh ključnih radnji, vreme do potvrđenog ishoda, starost najstarijeg posla, zaostatak reda, nepoznate provider ishode, stvarne neuspehe dostave i zaostatak podrške. Log ne sadrži tajne, sirove privatne razgovore ili nepotrebne lične podatke. Za svaku metriku unapred odrediti vlasnika, značaj i konkretan uslov koji pokreće reakciju; cilj se ne pomera prećutno radi prolaza.

Postupak incidenta obuhvata: potvrdu pogođene verzije i opsega, bezbedno zaustavljanje daljeg štetnog efekta kroz postojeće kontrole, očuvanje potrebnog dokaza, popravku ili kompatibilan povratak, proveru integriteta podataka i proveru obnovljenog korisničkog toka. Klijentski rollback ne označava bazu automatski vraćenom. Radnje nad živim podacima i javnom isporukom moraju ostati u važećem odobrenom obimu.

Pre svake naredne verzije sačuvati konkretne izmene, pogođene granice, provere i postupak za zaustavljanje ili popravku lošeg izdanja. Prva objava i update nemaju svuda iste opcije postepenog puštanja; odabrati dostupnu kontrolu publike prema konkretnoj konzoli. Ne obećavati da se već instalirana loša verzija svuda trenutno uklanja.

### 10.10. Konačna potvrda R12 i nastavak rada

Završni paket u jedinstvenom planu sadrži stvarni manifest promena i povlačenja, postojeće vlasnike i njihove zavisnosti, izvršene provere, poznatu isporučenu kombinaciju, konačna stanja ekrana, dokaze obnove i preostala ograničenja. Analitički manifest nije potvrda izvršenog povlačenja. Istorijski dokazi čuvaju svoje vreme; novi status se zasniva na novom rezultatu.

Pre konačne odluke imenovati tačan Android/iOS kandidat, potvrditi sve primenljive obavezne kapije i navesti svaku preostalu stavku sa posledicom. Nerešena privatnost, gubitak podataka, lažan uspeh, neprohodan osnovni tok, nedostupno obavezno brisanje, nepoznata produkcija ili neispunjen primenljivi store uslov blokiraju odgovarajuće izdanje. Manja prihvaćena nepravilnost ima vlasnika i plan popravke; nečitljivo ili zaklonjeno glavno dugme nije takva sitnica.

Pripremiti sve što je potrebno da predaja bude konkretna i pregledljiva pre završne odluke o puštanju. Postojanje ovog plana ne predstavlja novu dozvolu za javnu objavu, plaćanje ili destruktivnu produkcionu radnju. Već važeća korisnikova ovlašćenja ostaju važeća; rutinske nezavisne pripreme i provere ne zahtevaju ponovljeno odobrenje.

Rok za objavu određuje se nakon svežeg preseka, procene konkretnih zadataka, platformskih uslova i stvarnih dokaza. Broj testova ili dužina izveštaja ne određuju datum. Posle svakog završenog dozvoljenog koraka nastaviti sledeći relevantni korak, ažurirati iste R/J/F/SB/X veze i kratko prijaviti rezultat i preostalu prepreku. Ne proglašavati background rad nakon završetka aktivne sesije.

### Zvanični izvori prodavnica za ovaj odeljak

- **P1:** [Google Play, Android App Bundle](https://support.google.com/googleplay/android-developer/answer/9844279)
- **P2:** [Google Play, target API nivo](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- **P3:** [Google Play, Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- **P4:** [Google Play, korisnički sadržaj](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB)
- **P5:** [Google Play, brisanje naloga](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- **P6:** [Android Developers, 16 KB kompatibilnost](https://developer.android.com/guide/practices/page-sizes)
- **P7:** [Google Play, testiranje novih ličnih naloga](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- **P8:** [Apple, aktuelni zahtevi predaje](https://developer.apple.com/news/upcoming-requirements/)
- **P9:** [Apple, brisanje naloga u aplikaciji](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- **P10:** [Apple App Review Guidelines, posebno 1.2, 4.8 i 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/)
- **P11:** [Apple, privacy manifests i SDK obaveze](https://developer.apple.com/news/?id=3d8a9yyh)
- **P12:** [Apple, App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

[P1]: https://support.google.com/googleplay/android-developer/answer/9844279
[P2]: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en
[P3]: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
[P4]: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB
[P5]: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
[P6]: https://developer.android.com/guide/practices/page-sizes
[P7]: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
[P8]: https://developer.apple.com/news/upcoming-requirements/
[P9]: https://developer.apple.com/support/offering-account-deletion-in-your-app/
[P10]: https://developer.apple.com/app-store/review/guidelines/
[P11]: https://developer.apple.com/news/?id=3d8a9yyh
[P12]: https://developer.apple.com/app-store/app-privacy-details/

## 11. Kontinuitet: ažurira se ovaj isti plan

### 11.1. Jedan operativni ulaz

`CODEX_PLAN_RADA.md` ostaje dokument iz kojeg se nastavlja rad. Novi nalaz, odluka ili izvršeni rezultat unosi se uz odgovarajući postojeći R/J/F/SB/X/C zapis. Ne praviti još jedan „master”, paralelni backlog ili dopunu koju korisnik mora ručno da spaja. Kada veća izmena promeni prioritet, ažurirati ovaj redosled i obrazložiti promenu.

Kod, testovi, slike, build i sirovi rezultati prirodno ostaju stvarni projektni artefakti. U planu se čuva kratak indeks njihovog identiteta i značenja. Oni dokazuju zapis; nisu alternativni planovi sa drugačijim instrukcijama. Nedostupni dokaz ne dobija izmišljenu putanju, sadržaj ili PASS.

Svaka sesija počinje čitanjem poslednjeg statusa ovog plana i uskim osveženjem relevantnog izvora, deployment-a i korisničkih odluka. Nije potreban novi potpuni audit pre svakog malog zadatka. Uloga osveženja je da se sačuvaju novije izmene, postojeći dobri vlasnici i stvarna kompatibilnost.

### 11.2. Početni operativni status ove revizije

| Celina | Trenutno dostignuto | Sledeći stvarni izlaz |
|---|---|---|
| Jedinstveni plan | Objedinjene obe rev9 verzije, svi precizniji uslovi, putanje, scenariji, UI/UX, release poslovi i puni dokazni prilozi. | Ažurirati isti dokument i njegove PDF prikaze posle stvarnog rada. |
| R01–R12 | Izvršno razrađeni zadaci sa postojećim vlasnicima i kriterijumima. | Konkretna implementacija i odgovarajuća provera u odobrenom opsegu. |
| J01–J14 i pomoćni ulazi | Definisane povezane korisničke priče i inventar grupa. | Route/stanje mapa stvarne verzije, razrađeni prikazi i uređajski dokaz. |
| F/SB/X | Sačuvano svih 42 nalaza i primarno R mapiranje. | Zatvarati pojedinačno stvarnim ishodom; preneti dokaz nije nov incident ni popravka. |
| C01–C19 | Sačuvana konkretna jedinica promene, svih 180 putanja, očuvano i preduslovi. | Proveriti sadašnje potrošače i sprovesti samo opravdano povlačenje. |
| SV01–SV14 | Svih 14 punih izvršnih zapisa i izvorni inventar dostupni su u ZIP-u. | Osvežiti relevantne objekte i dokazati zavisnosti pre konkretne promene. |
| Satnica i više lokacija | Konkretni izbori i njihove posledice pripremljeni u odeljku 9. | Odluka za zahvaćeni ugovor; nepovezane popravke napreduju. |
| Konačni izgled | Uslovi i proces razrade uključeni u plan. | Stvarni nacrti potrebnih stanja, implementacija i snimci kandidata. |
| Produkcija i prodavnice | Poznate kapije i materijal koji treba završiti. | Ispunjen stvarni produkcioni cilj i provereni Android/iOS kandidati. |

Izraz „definisano” nije „nacrtano”, „nacrtano” nije „implementirano”, a „implementirano” nije „dokazano na telefonu”. U završnom statusu nijedna od tih kolona ne popunjava drugu automatski.

<!-- EXECUTION-UPDATE-BEGIN: ledger-20261028 -->

### 11.2a. Aktuelni izvršni status — 28.10.2026.

Ovaj zapis obuhvata prethodnu R07b satnicu i završeni source krug C03/C04/C07/C08/C09/C12, uz stvarno izvršenu R01 inicijalizaciju bez dodatnog CLI webhook SQL-a. Source `b98ef389fe65bd19ffa047edbb82c4ff0c1aee5a` ima puni CI `40734402563` SUCCESS (614 suite-a / 14.115 testova). Schema CI `40734402209` završio je sve capture-e: strict razlike 13→8, supplemental 62→49, uz tri zasebne razlike native helper hash-eva; konačan ishod ostaje FAIL, bez Auth/HTTP/kandidata. Ukupno 11/19 C paketa ima source promene; osam C i svih 14 SV ostaju otvoreni. Od 12 R paketa pet je IN_PROGRESS (R01/R02/R07/R11/R12), sedam DEFINED; nijedan nije u celini zatvoren do isporuke. Završni checkpoint menja samo dokumentaciju i zadržava provereni kod. Odgovoran za rad i ažuriranje: Codex u ovoj sesiji. Dokazni prilozi nisu konkurentni planovi.

#### Identitet potvrđenog preseka

| Sloj | Identitet i stvarni nivo potvrde |
|---|---|
| Repo / početna osnova | `uskocibusiness-boop/USKOCI-EAN`; izvorna grana `feature/uskoci-cisto`; osnova `a9692e11942609bab9406215c3e407d79589dafa`. |
| Aktivna radna kopija | `uskoci-implementation`; grana `work/rev14-review-f17`; F17 `264d12d`, preflight `936e1e2`, R01 kandidat `1959064`, plan `9527e2f`, SB11 PLACES `6f349ee`, recent `117a143`, fit `e878667`, bootstrap metadata `82ff498`, F16 PAGE/MAP recovery `f831591`. Puni identiteti i nivo isporuke su u izvršnom dnevniku. |
| Zavisnosti | `package-lock.json` SHA-256 `af0dd7c3ebcee931de0304d74efbbbb5385177d1dfea20cca6c60046379b41e0`; Node 24.18.0; postojeći `node_modules` korišćen preko junction-a bez instaliranja ili menjanja zavisnosti. |
| DEV | `leqcwgzvjsxugfgzdmth`, PostgreSQL 17.6. Poslednji metadata capture formata 3: 28.10.2026. u 08:45:32 UTC; `transaction_read_only=on`. `authenticated` i dalje ima efektivni SELECT nad sva tri privatna polja. Katalog beleži 42 Need kolone; 680/680 aplikacionih funkcijskih tela i navedeni provereni atributi bez delte prema REV10. Nisu čitani poslovni ili Auth korisnički redovi. |
| Closure | `source_ready=false`, `erasure_binding_ready=false` pre kandidata; postojeći sertifikati nisu prepisani. Export binding nije potvrđen ovom vertikalom. |
| Edge / migracije | Metadata iz prethodnog preseka postoji; broj verzije i migration ledger nisu dokaz jednakosti deployed tela sa kodom. Nije izvršen Edge deployment niti primena R01 migracije. |
| GitHub / CI | Novi cleanup `abc0f70`, ispravljen TS/Bun start `86deb1e` i poslednji runtime source `b98ef389fe65bd19ffa047edbb82c4ff0c1aee5a` su u [draft PR #43](https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43). [Puni CI 40734402563](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402563) SUCCESS: TypeScript/Deno, 614 mobilnih suite-ova / 14.115 testova / 3 snapshot-a, F13 SDK/SQL 9/9, hourly SQL 25/25, AI/taxonomy, integritet migracija i izolovani SQL. [Schema CI 40734402209](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402209) FAIL: 8 strict / 49 supplemental / 3 native-hook hash razlike; svih 56 checker testova, build/start/bootstrap/capture/cleanup PASS. Merge checkout `552984f47ba514f1d3f2408b0e2945d607176f86`. Nema merge-a, DEV migracije/deployment-a ili novog klijenta. Završni docs-only checkpoint ne ponavlja CI. |
| Izolovano Supabase okruženje | Run `40734402209`: PG17.6, Storage v1.80.0, Realtime v2.148.3, osam ekstenzija, 15+15 servisnih migracija, četiri Auth indeksa i ceo application DDL/capture PASS. Strict 8: Storage ACL (1), hosted login role/membership (2), supabase_admin search_path missing/added (2), extension owners (3). Supplemental 49: samo extension routine owner/ACL hash-evi; nijedan poređeni effective boolean ne odstupa. Dodatna legacy schema odsutna, oba pg_net HTTP postupka INVOKER; native helper owner/SECINV/ACL i event ugovor jednaki DEV-u, ali helper config/body/definition hash-evi nisu. Stroga jednakost i zaseban hook gate ostaju false; Fixture/Auth/PostgREST/kandidat nisu izvršeni. |
| Native / OTA / uređaj | Završni Android/iOS Metro/Hermes export novog cleanup klijenta PASS, 848 runtime source/asset/config hash-eva nepromenjeno i ponovo upoređeno posle test-only ispravke. Ovo nije native build, OTA ili telefonski prolaz; instalirani kandidat i podržana kompatibilnost ostaju `UNPROVEN`. |

#### Status R paketa

| Paket | Status u ovom radu | Tačno dostignuto i prvi sledeći posao |
|---|---|---|
| R01 / F21 / F14 | `IN_PROGRESS`; kandidat `IMPLEMENTED`, lokalni SQL nivo `VERIFIED`; integraciona verifikacija `IN_PROGRESS` | Eksplicitna 38-kolonska granica i atomske postprovere su pripremljene. Nedostaje stvarna Auth/PostgREST proba tekuće šeme u disposable okruženju i kompatibilnost podržanih klijenata. Privatnosni nalaz nije zatvoren na DEV-u. Širi R01 pregled default/service/PUBLIC prava, PHONE metoda, Auth konfiguracije i identiteta izdanja nije proglašen završenim. |
| R02 / F15–F17 / SB11 | `IN_PROGRESS` | F17/SB11 i F16 klijentski PAGE/MAP partial failure/retry imaju lokalni i CI dokaz; novi skup je potvrđen run-om `40652955784`. F15 PAGE/MAP/PLACES serverski ugovor i stvarni HALF/FULL/PEEK/native-style/insets dokaz ostaju otvoreni. Serverski deo nastaviti po usklađenom R01 ugovoru. |
| R03 / F01 | `IN_PROGRESS`; prva klijentska keyset zaštita `IMPLEMENTED`, CI/uređaj još otvoreni | Decoder sada odbija neispravno/ponovljeno ili neuređeno keyset kretanje (Postgres mikrosekunde i UUID tie-break); pet server scope-ova, counts, stvarni RPC output, Auth/HTTP i kompletan R03 acceptance ostaju otvoreni. |
| R04 | `IN_PROGRESS`; kompletno fallback listanje `IMPLEMENTED`, CI/real-provider još otvoreni | Existing BG katalog loader sada iscrpljuje ROOTS/CHILDREN cursor-e, proverava identitet/verziju svakog odgovora i ne prihvata parcijalni cache; semantic REUSE, hijerarhija, BOTH/handoff, Save/binder i stvarni uređaj/AI ostaju otvoreni. |
| R05 | `DEFINED`; D08 `CONFIRMED`; bez nove implementacije | Vlasnik 28.10.2026. određuje povezivanje po mestu početka posla (§9.2). Primena istog kriterijuma kroz pronalaženje, prostorno filtriranje i preporuke, kao i ostale provere područja/vremena, ostaju otvorene. |
| R06 | `DEFINED`; bez nove implementacije | Trajni nastavak i potpuni rezultat ostaju otvoreni prema odeljku 6. |
| R07 | `IN_PROGRESS`; D06 `CONFIRMED`; R07a kandidat `IMPLEMENTED`, ograničene provere `VERIFIED` | R07a povlačenje stare cene pri korekciji valute povezano je kroz Edge i kandidata postojećeg writer-a; stvarni upis/pregled, owned completion i odbijanje zastarelog pripremljenog pregleda provereni su u izolovanom SQL modelu. Normalizacija novih AI prezentacionih vrednosti i klijentski prikaz RSD implementirani su i lokalno provereni. Potpuni signed review/Save/publish, Auth/HTTP i isporuka ostaju otvoreni; istorijski potpisi i sirove kopije nisu prepisivani. F11 provera odustajanja implementirana je kroz postojeći lifecycle reader i lokalno dokazana; native/live dokaz ostaje otvoren. F13 ograničeni CAS dodatak i originalna namera implementirani su i lokalno provereni; stvarni Auth/HTTP i uređajski prolaz ostaju otvoreni. R07b satnica po osobi sada je povezana u Edge/klijentu i guarded SQL kandidatu; stvarni izolovani submit/read/select/Agreement lanac je izvršen. Pre isporuke ostaju Auth/HTTP, signed Save/publish/replacement, usklađena migracija i podržani klijent, uključujući izlaz za stari Discovery decoder. |
| R08 | `DEFINED`; bez nove implementacije | Završetak razgovora, spremnost i konkretna UI stanja ostaju otvoreni prema odeljku 6. |
| R09 | `DEFINED`; bez nove implementacije | Queue, preference, receipt i uređajska isporuka nisu ponovo izvršeni u ovom radu. |
| R10 | `DEFINED`; bez nove implementacije | workAreas/export/closure i saglasnosti nisu popravljeni; poznati false binding ostaje otvoren. |
| R11 | `IN_PROGRESS`; 11 C paketa source promena izvedeno: C01–C09, C12, C18 | Uklonjen potvrđeni višak i objedinjene identične slike uz očuvane aktivne potrošače. Satnica je jasno označena u postojećim ekranima. Nova navigacija, potpuna REV14 geometrija/izgled i uređajski dokaz ostaju otvoreni. |
| R12 | `IN_PROGRESS` u prikupljanju i izvršavanju dokaza | Postoje poznati source/lock/metadata preseci, lokalni rezultati i GitHub CI prolazi sa tačnim SHA. F16 je dobio pre/post regresije i nezavisan pregled; novi bootstrap capture ima stvarno PG17 read-only izvršenje. Nema završenog integracionog, build/native/OTA/store ili produkcionog dokaza. |

#### Odvojeni statusi proizvoda i dokaza

| Konkretan rezultat | Definisano | Vizuelno razrađeno | Implementirano | Dokazano |
|---|---|---|---|---|
| F17 bezbedna poruka read greške | Da, ograničene kategorije i formalno obraćanje | Tekst mapiran u postojeći list state; nova native geometrija nije rađena | Da, `264d12d` | 347 ciljnih klijentskih testova + TypeScript; native/deployed tok `UNPROVEN` |
| SB11 PLACES/recent/fit recovery | Da, tri konkretne granice i očuvanje novijeg naloga/upita | Postojeći UI i ponovni pokušaj, bez novih native nacrta | Da, `6f349ee`, `117a143`, `e878667` | Ciljani prepatch FAIL/postpatch PASS za sva tri uzroka; PLACES 152 različita testa, recent 20 + jedan postojeći presentation scenario, fit/projection 80; native/live backend `UNPROVEN` |
| F16 dostupna PAGE lista pri MAP grešci | Da, zasebni read status, seed/viewport retry i očuvana selekcija | Kompaktna poruka u postojećem list header-u, formalni CTA, busy/disabled i 48 dp cilj; bez promene native geometrije | Da, `f831591` | 503 različita testa kroz 11 relevantnih suite-ova, završni TypeScript i pregled; pravi F15 backend i native HALF/FULL/PEEK ostaju `UNPROVEN` |
| R01 privatna kolonska granica | Da, 38 izričitih javnih kolona; ostale uskraćene | Nije primenljivo na sam ACL kandidat | SQL kandidat `1959064`, van migracionog inventara | 14 SQL testova u ograničenom modelu, 271 klijentski i 15 integritet testova + TypeScript; Auth/PostgREST/puna šema `BLOCKED` |
| R07a povlačenje zastarele cene | Da, povlačenje aktivnog načina/iznosa/osnovice bez konverzije ili izmišljene ponude | Jasna poruka o nepotvrđenoj ceni; bez novog ekrana | Edge kontrola i `r07_price_retraction.sql`, van migracionog inventara | 27 SQL/guard testova uključujući stvarni prepare/accept, negativni Save/publish i normalizovan novi prikaz cene; zajedno sa Edge handler testovima 183 PASS i 1 integracioni TODO. Pozitivni accept zaustavljen pre upisa; potpuni signed Save/publish i isporuka `UNPROVEN` |
| F11 provera izgubljenog abandon odgovora | Da, isti razgovor i OPEN/ABANDONED/nepotvrđen ishod | Postojeći Proveri i StateView sa povratkom; poruka ne obećava fizičko brisanje | Da, postojeći readIntakeLifecycle i review route, bez novog server ugovora | 4 suite-a / 235 testova PASS, TypeScript i nezavisan pregled; puni GitHub CI c2e132f: 623 suite-a / 14.275 testova PASS. Live Auth/HTTP i native tok UNPROVEN |
| F13 dodavanje veštine posle prijave | Da, jedna zamrznuta namera i postojeći profilni autoritet | Postojeći opt-in; neuspeh ne poništava prijavu i poruka ne tvrdi da neizvestan upis nije uspeo | Da, postojeći workerProfileClientService sa text[] CAS uslovom, bez migracije | 4 ciljana suite-a / 112 testova i TypeScript PASS; ponovljen route posle copy ispravke 48/48 PASS. SDK/PGlite 8 scenarija + parent: 9/9 PASS; puni CI source 5704fd2: 624 suite-a / 14.326 testova PASS; live Auth/HTTP/native UNPROVEN |
| R07b satnica po osobi | Da, potvrđen D06 | Postojeći prikazi sada navode RSD po osobi po satu; ne izmišljaju ukupnu cenu | Da: Edge/klijent i disposable kandidat 9 postojećih SQL funkcija / 2 nullable kolone | Fokusirani client 26 suite-ova / 1.239 testova, TypeScript; konačni Edge guard 74 testa, writer/review 29 SQL testova; stvarni candidate lanac 25 SQL testova. Android/iOS bundle i puni CI 40718314704 PASS. Live/native isporuka UNPROVEN |
| C01/C02/C05/C06/C18 čišćenje | Da, puni Z10 zapisi pročitani | C18 zadržava iste PNG bajtove; nema novog izgleda | Da, 24 asset fajla i tačno određeni retired helperi/testovi povučeni | 12 suite-a / 372 testa; reference/config/manifests PASS; 4.578.117 bajtova manje u repo resursima. Native build/APK razlika nije izmerena |
| REV14 navigacija, Dogovor, ikone i obraćanje | Usklađene navedene suprotnosti | Nema novih potvrđenih nacrta svih stanja | Ne, osim izdvojene F17 poruke | Samo dokumentacioni pregled; nema novog UI/native dokaza |

#### Izvršni dnevnik i konkretni dokazi

**2026-10-27 — ulazi, R01/R11/R12 i UX polazište.** Provereno svih 138/138 REV10 payload fajlova prema veličini i SHA-256; [zapis prenosa](../../../evidence/input-verification.json). To potvrđuje integritet paketa, ne runtime tačnost svih istorijskih nalaza. Glavni operativni plan i REV14 opšti odeljci/77 ugovora su pregledani; obimni tehnički prilozi čitani su ciljano prema zadacima, bez tvrdnje da je svaki istorijski dokaz ponovo izveden. REV13 koji REV14 navodi nije dostavljen niti pronađen ciljanim traženjem. [Usklađenje REV14](../../../USKOCI_REV14_USKLADJENJE.md) beleži konkretne protivrečnosti; ne predstavlja novu implementaciju. D06 i D08 ostaju otvorene poslovne odluke.

**2026-10-27 — F17, deo R02/J09.** Commit `264d12dcc73d58cb33b33dfed873bf2be730c784`. Putanja `focusedResource → zadaci → DiscoveryPresentation → DiscoveryListState` sada prenosi ograničen tip razloga umesto teksta boolean vrednosti `true`. Nema raw provider/SQL poruke u UI-ju; unknown greška ne pripisuje se automatski internetu. Očuvani su boolean kompatibilnost, account/revision/focus/generation granice, retry i prethodni učitani rezultat pri dozvoljenom refresh neuspehu. Negativne kontrole obuhvataju zakašnjele greške, A→B→A nalog, odbijeni RPC, neispravan odgovor i curenje internih detalja. Izvršeno je 8 disjunktnih Jest suite-ova, **347/347 PASS**, plus `node node_modules/typescript/bin/tsc --noEmit` i diff provere. Tačne komande, ulazi i trajanja (62 testa / 64.732 s; 285 / 69.974 s) su u [potvrdi F17](../../../evidence/f17-tests.json); [repo zapis](../rev14/EXECUTION_20261027.md). Native raspored i isporučena aplikacija nisu provereni. Status: `IMPLEMENTED`, `VERIFIED` na lokalnom klijentskom nivou.

**2026-10-27 — R01 read-only preflight.** Commit `936e1e26202cc4bbd48d1450bdec7a6c951fd6fa`. Dodat je [ponovljivi metadata upit](../../supabase/proofs/privacy/r01_read_preflight.sql), izvršen na potvrđenom DEV-u bez poslovnih redova ili upisa. Snimljena su prava, politike, 21 imenovana funkcija i bezbedne API postavke; [izvorni preflight](../../../evidence/live-r01-preflight.json), [closure status](../../../evidence/live-closure-status.json). Ovaj dokaz potvrđuje polazište, ne uklanja F21.

**2026-10-28 — R01/F21 kandidat.** Commit `1959064da4d5dbf2e479f747368539f959c8e688`; početna osnova ovog koraka `936e1e26202cc4bbd48d1450bdec7a6c951fd6fa`. [Atomski SQL kandidat](../../supabase/candidates/r01_needs_column_privileges.sql) ukida SELECT izvore za PUBLIC/anon/authenticated i ponovo dodeljuje izričitih 38 javnih kolona u istoj DO naredbi. Sve druge kolone, uključujući kasniji `category_id`, nisu automatski javne. Efektivne postprovere odbijaju nasledna prava i poništavaju celu naredbu pri neuspehu. Ne menja RLS, funkcije, pisanje, service_role ni sertifikate. Kandidat zahteva `uskoci.r01.disposable=LOCAL_ONLY` i nije migracija za DEV; ne postavljati taj flag na DEV-u.

Stvarna provera: `node supabase/proofs/privacy/r01-column-boundary.test.mjs` → **14/14 PASS**, 1598.9991 ms u sačuvanom root izvršenju. Isti test prvo reprodukuje privatni actor/reason na stranom sintetičkom SELECTION redu, pa potvrđuje 42501 za projekciju, alias, filter, order/group, wildcard, ceo red/JSON i whole-row computed argument. Pozitivne kontrole pokrivaju 38 kolona, owner/participant, direktni `remaining_search_closed_at`, tekuće snimljene detail/owner funkcije i dozvoljeno close-search pisanje. Provereni su drugi svet, anon, zatvoren nalog, krivotvoreni owner kompozit, nova kolona, dodatna/nasleđena prava i atomic rollback. **271 klijentski test u 8 suite-ova**, **15 testova integriteta**, TypeScript i sintaksa su PASS. Provereno 193 migracionih fajlova, bez izmene primenjenih migracija. Nezavisni pregled nije našao konkretan prolaz ili uvedenu regresiju i sam je ponovio 14 SQL testova. Komande i sirovi izlazi su indeksirani u [R01 izveštaju sa dokazima](C:/Users/user/.codex/state/plugins/codex-security/scans/uskoci-implementation/artifacts-9be0429af3e45ad335d49b22a24513c3767a2f932bfda75c32443ddc86be2941/artifacts/r01/USKOCI_R01_2026-10-28.md); lokalni managed-artifact link zahteva ovu radnu stanicu. U repou ostaju [izvršivi dokaz](../../supabase/proofs/privacy/r01-column-boundary.test.mjs), [fixture sa hashovima](../../supabase/proofs/privacy/r01_fixture.mjs) i [tačni preduslovi promocije](../../supabase/proofs/privacy/README.md).

**Granica R01 dokaza:** PGlite 0.5.8 izvršava PostgreSQL 18.3, a DEV je 17.6. Identitet je ubrizgan umesto Auth prijave; geography je inertan tekst; pojedini closure/classification/candidate-state/audit/event delovi su jasno označene zamene; većina triggera i ograničenja nije instalirana. Test nije PostgREST, Storage, Realtime, PostGIS, puni closure ili native/OTA dokaz. Lokalno provereni alatni preduslovi tada nisu uključivali Docker/Podman, PostgreSQL CLI, Supabase CLI, PostgREST ili WSL; instalacija nije pokušana u tom koraku. Zato je **konačna integraciona verifikacija `BLOCKED` zbog nedostajućeg okruženja**, dok su konkretni lokalni prolazi važeći samo na svom nivou. Raniji R03 owner-page wire i Discovery MAP/PLACES nesklad nisu popravljeni ACL kandidatom.

**2026-10-28 — isti plan i preduslov R01 integracije.** Ovaj fajl je radna kopija izvornog REV10 plana, sa jasno označenim izvršnim dopunama; `STATUS.md` i istorijski zapis REV14 upućuju na njega. Izvorni ZIP-ovi nisu menjani. Proveren je postojeći Supabase projekat i pokušano otvaranje izolovane grane `r01-privacy-proof-20261028`. Prvi zahtev završio je tehničkom greškom `Invalid or expired requestState`; posle provere da grana ne postoji, jedan ponovljeni zahtev vratio je `PaymentRequiredException: Branching is supported only on the Pro plan or above`. Završni read-only spisak ponovo potvrđuje samo `main`. Nema novog projekta, grane, nadogradnje plana, primene ACL-a ili isporuke aplikacije. R01 HTTP provera ostaje `BLOCKED` konkretnim nedostatkom izolovanog okruženja. Stari P6 HTTP harness nije prihvaćen kao dokaz tekuće šeme; njegove stare pretpostavke i certifikati ne odgovaraju aktuelnom stanju. Nezavisan sledeći korak je objava postojećeg kandidata i plana kao draft PR-a prema `feature/uskoci-cisto` radi pregleda i CI provere.

**2026-10-28 — GitHub pregled i početak udaljene provere.** Uspešan `git push --set-upstream origin work/rev14-review-f17` sačuvao je iste lokalne commit identitete, uključujući dokumentacioni `9527e2f3e8562922b4e604768c2a91cc0d314abb`. GitHub dodatkom otvoren je [draft PR #43](https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43), sa ciljnom granom `feature/uskoci-cisto`; PR je priložen ovoj sesiji. Pokrenut je workflow `USKOCI clean branch checks`, run `40642057248`, za taj source SHA. Sam push i pokretanje CI-ja ne potvrđuju uspešan CI, R01 integraciju ili isporuku aplikacije. Sledeći nezavisan klijentski korak po R02/SB11 je oporavak PLACES nastavka: decode izuzetak mora završiti busy stanje i ostati lokalna greška mesta uz očuvane PAGE/MAP rezultate; taj korak u ovom zapisu još nije potvrđen testom.

**2026-10-28 — prvi udaljeni CI: PASS za `9527e2f`.** [Run 40642057248](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40642057248), job `122662210779`, završio je `success`. Stvarni izlaz: **623 Jest suite-a, 14.155 testova i 3 snapshot-a PASS**; prošli su exact dependency install/native patch check, TypeScript, tri Deno Edge type/import provere, AI/taxonomy ugovori, provera 193 migraciona fajla i 15 integritet testova, kao i 14 izričito ograničenih R01 SQL testova. Sirovi job log sačuvan je kao managed artefakt `artifacts/r01/20261028-github-ci-40642057248.log`, SHA-256 `39b90bd8bbb60a95030c2d84bd6d63ead56e7c2321c857ba452d3b866db22ec7`. Nema Auth/PostgREST ili native izvršenja u ovom workflow-u. Novi SB11 commit zahteva novi prolaz.

**2026-10-28 — R02/SB11: oporavak nastavka liste mesta.** Commit `6f349ee88e76f98dd96c3d06cdbb07e26f715b03`. `src/data/discoveryV1SearchOwner.ts` sada završava pokušaj i kod transport i kod decode greške, čuva prihvaćena mesta/PAGE podatke/anchor/cursor i proverava konkretnog vlasnika kontrolera pored generacije. `src/ui/v2/discovery/DiscoveryV1Screen.tsx` objavljuje busy stanje i lokalni `facetError`, bez postavljanja ili brisanja nezavisne PAGE/MAP greške. Dugme za nastavak ponovo je dostupno posle neuspeha. Prepatch ciljane owner/route kontrole `--testNamePattern 'R02 SB11'`: **8 FAIL, 5 PASS, 46 skipped** (20.671 s). Posle popravke četiri suite-a `discovery-v1-search-owner`, `discovery-v1-route-lifecycle`, `discovery-v1-city-places`, `discovery-search-panel`: **151/151 PASS** (19.881 s); zatim dodata CTA kontrola i ponovljen samo promenjeni panel: **88/88 PASS** (5.5 s). To je **152 različita proverena testa**, ne zbir preklopljenih izvršenja. Komanda: `node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --silent --runTestsByPath` sa navedenim fajlovima iz `src/data/__tests__/`. TypeScript i diff provera PASS. Pokrivene su promene upita/naloga, suspend/retire, obrnuti odgovori i retry istog zahteva. Route test ima kontrolisan transport i zamenjen presentation bridge; panel dokaz nije native geometrija. Status: `IMPLEMENTED`, lokalni klijentski nivo `VERIFIED`; živ PLACES/MAP, F15, širi F16 i recent/fit delovi SB11 ostaju otvoreni.

**2026-10-28 — R02/SB11: nedavne pretrage posle neuspelog čitanja.** Commit `117a1436df5c110876c690a46d5882d96873499e`. `src/ui/v2/discovery/recentSearches.ts` označava nalog učitanim tek kada prihvati rezultat skladišta. Zatvaranje pre odgovora ili odbijeno/sinhrono neuspešno čitanje dozvoljavaju novi pokušaj pri otvaranju; novija lokalna pretraga ostaje pri spajanju. Prikaz i callback pripadaju punom account/revision scope-u, a postojeći trajni storage ključ i dalje pripada nalogu. Zastareli odgovor/callback ne može pisati u novi nalog; skriven panel ne zadržava tuđi vidljivi rezultat. Ista komanda `node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --silent --runTestsByPath src/data/__tests__/recent-searches.test.tsx`: prepatch **5 FAIL / 15 PASS** (1.217 s), posle **20/20 PASS** (1.111 s). Postojeći scenario `discovery-presentation.test.tsx --testNamePattern 'what was searched is kept'`: **1 PASS / 244 namerno preskočena** (10.52 s), ne ceo presentation suite. Status: `IMPLEMENTED`, lokalni klijentski nivo `VERIFIED`; novi udaljeni CI i preostali fit korak slede.

**2026-10-28 — R02/SB11: važeći fit rezultat za tekući zadatak.** Commit `e8786672c028811a8f582bae06f3634b7a52f536`. `src/ui/v2/detail/useTaskFit.ts` vezuje lokalni rezultat za account/revision, task ID/revision, schedule kind/start/end, oba javna pin koordinata i način rada. Promena relevantnog ulaza, null detalj ili prazan/neuspešan opcioni read uklanja raniji hint; odgovor koristi snimljen zadatak i proverava važeći ključ/nalog pre objave. Nema globalnog cache reset-a niti promene pravila prijave. `src/contracts/projections.ts` ima opcionu revision, a `src/data/supabaseIzvor.ts` prenosi samo pozitivan bezbedan celobrojni revision koji postojeći RPC već vraća; nepoznata/nevažeća vrednost ostaje `undefined`, bez gubitka legitimnog legacy detalja. Ista pre/post komanda `node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --silent --runTestsByPath src/ui/v2/detail/__tests__/useTaskFit.test.tsx src/data/__tests__/task-detail-read.test.ts`: prepatch **13 FAIL / 67 PASS**, posle **80/80 PASS**, dva suite-a. Provereni su end/kind/pin/REMOTE/revision, A→null→A sa praznim ili neuspešnim čitanjem i zakasneli task/account odgovori. Status: `IMPLEMENTED`, lokalni klijentski nivo `VERIFIED`; promena ne potvrđuje novi serverski ili native tok.

**2026-10-28 — ceo završeni klijentski skup objavljen i CI potvrđen.** `git push --set-upstream origin work/rev14-review-f17` poslao je `6f349ee`, `117a143` i `e878667` u isti draft PR #43. Source SHA je `e8786672c028811a8f582bae06f3634b7a52f536`; base ostaje `a9692e11942609bab9406215c3e407d79589dafa`. [CI run 40644094293](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40644094293), job `122668770328`, završio je `success`: **623 Jest suite-a / 14.199 testova / 3 snapshot-a PASS**, uz exact dependencies/native patch, TypeScript, Deno Edge import/type, AI/taxonomy, 193-file migration integrity, 15 integritet testova i izolovani R01 SQL dokaz. Root završni lokalni `node node_modules/typescript/bin/tsc --noEmit` takođe je exit 0; uski React/hook pregled nije našao novu grešku u ovim promenama. Sirovi job log: managed artefakt `artifacts/r01/20261028-github-ci-40644094293.log`, SHA-256 `243ecf8c077e6e88a0954e397e7af6bf2a1856c61ba29925e3b1a595eaf63e76`. PR opis sada obuhvata stvarni završeni F17/SB11/R01-kandidat skup. Ova dopuna plana prati već provereni kod; ne uvodi dodatnu implementaciju. R01 HTTP ostaje `BLOCKED` izolovanim okruženjem, F15/širi F16 i uređajska/serverska isporuka ostaju otvoreni. Nema merge-a, DEV upisa, deployment-a, novog build-a ili OTA-a.

**2026-10-28 — R01/F14: izvršiv metadata preduslov za verno disposable okruženje.** Commit `82ff4984844cf747abd633777601a8a5dae4aae0` dodaje [read-only capture](../../supabase/proofs/privacy/r01-capture-bootstrap-metadata.sql), SHA-256 `d0f0c9cbbf7c47dfcaebbb806e94a90933190850ed79bd782dfd4c16f125a406`, i opis granice u privacy README-u. Upit koristi samo kataloge, `BEGIN TRANSACTION READ ONLY`, `search_path=pg_catalog`, ograničene timeout-e i `ROLLBACK`. Ne poziva aplikacione funkcije, ne čita Auth/poslovne redove, tokene, lozinke, vrednosti sekvenci ni izvršne cron poslove. Lokalna prazna i sintetička PGlite 18.3 provera prošle su, uključujući potvrdu da funkcija koja bi bacila grešku nije pozvana; zatim je root stvarno izvršio isti source na identifikovanom DEV PostgreSQL 17.6, 07:36:50 UTC, `transaction_read_only=on`.

Sačuvan [metadata rezultat](C:/Users/user/.codex/state/plugins/codex-security/scans/uskoci-implementation/artifacts-9be0429af3e45ad335d49b22a24513c3767a2f932bfda75c32443ddc86be2941/artifacts/r01/20261028-bootstrap-metadata.json), SHA-256 `a9323bb6051327d35d7f8db1c961bdfd255d5768c390086ac6a9f6007dcc0685`, sadrži 11 section digest-a, 176 aplikacionih relacija (167 tabela i 9 sekvenci), 686 funkcija (680 public/private, 2 RLS helper-a i 4 Auth helper-a), ekstenzije, sequence options/ownership, event trigger-e, membership flags i managed Auth metadata. Unsupported aplikacione shape liste su prazne. Potvrđeni su PostGIS `3.3.7` u `extensions` i stvarni `authenticator` pre-request `public.rpc_closure_api_guard`. Sva tri privatna Need polja i dalje imaju `authenticated effective_select=true`; kandidat nije primenjen.

Root [poređenje funkcija](C:/Users/user/.codex/state/plugins/codex-security/scans/uskoci-implementation/artifacts-9be0429af3e45ad335d49b22a24513c3767a2f932bfda75c32443ddc86be2941/artifacts/r01/20261028-bootstrap-function-comparison.json), SHA-256 `82c932f4be586f28489ac558e7c782fcb7147f42a611b97cdd81cdc5fd8fe786`, potvrđuje **680/680** jedinstvenih potpisa i nula dodatih/nestalih funkcija ili promena `body_md5`, owner, security-definer, volatility, ACL i proconfig prema REV10. Normalizacija uklanja samo public/extensions kvalifikatore argumentnih tipova i proverava da nema sudara ključeva. **Nije proverena puna jednakost DDL-a ili cele šeme**; novi definition/expression digest-i imaju izričito novi pinned-path format. Nezavisan pregled lokalnih SQL/JSON izvora pronašao je svih 680 tela po tačnom MD5, uključujući prvobitnih 22 sa zastarelim `/workspace` referencama u drugom lokalnom snimku. Sledeći bootstrap koristi izvorne `schema_review.json` (`9d629e6f78d223fd7f4de8a013600a5201f42a51b918dbe52918e53f842a0cbc`), `migration_performance.json` (`4b066c7d4b28c9eb2bb3257dd90523fd59b29e217b0263ed6caa36ebda6edd23`) i `function_body_review.json` (`5c04374627c441a68463c9f4a50dacdae7a9f619e9a82c8aaf488ba15148ba66`) iz REV10, a ne slepo izvršavanje 193 istorijske migracije. Sačuvani podaci ostaju lokalni managed dokaz, nisu objavljeni kao raw GitHub prilog. Status ovog koraka: source capture `IMPLEMENTED`, izvršenje i navedeno poređenje `VERIFIED`; generator/puna schema parity/pravi Auth/PostgREST ostaju otvoreni.

**2026-10-28 — R02/F16: uspešna lista ostaje dostupna kada MAP ne uspe.** Commit `f8315910b644226aafbcae1bf3b3261093d22fa7`. `discoveryV1ScreenSession` odvaja `mapRead.loading/error`, retry plan i map generation/sequence od list scope sequence-a. Cold open, retry i pan zadržavaju prihvaćen PAGE pri transport/decode MAP neuspehu; oba pan ishoda se sačekaju pre prihvatanja nove liste. World seed retry prolazi seed → wholeBounds → završni MAP. Near-bounds optimizacija ne preskače failed retry; zastareo seed/odgovor/nalog/upit ne preuzima noviji pokušaj. Neuspeh mape ne znači nestanak izabranog bucket-a. Coordinator i `DiscoveryV1Screen` daju MAP-u zaseban retry, čuvaju jedan reanchor, `FOR_ME_REFUSED` switch-off/readback i PAGE grešku dok pravi PAGE ne uspe. Saved izbor može da se obnovi posle MAP oporavka; neuspešan opcioni EXACT van PAGE čisti neobnovljenu selekciju bez skrivanja liste. Noviji izbor/dismissal ostaje merodavan.

`discoveryV1PresentationBridge` prenosi odvojeno stanje. `DiscoveryPresentation` pokazuje malu poruku „Oznake zadataka na mapi nisu učitane.“ ili, uz sačuvane markere, „nisu osvežene.“; radnja je „Pokušajte ponovo sa mapom“, sa busy/disabled semantikom i najmanje 48 dp preko shared tokena. Prihvaćene kartice/filteri/native renderer ostaju; ne prenosi se raw SQL/provider tekst. Native style failure zadržava svog postojećeg vlasnika. Nisu menjani SQL ugovor, wire decoder, rollout flag, migracije, paket-zavisnosti niti HALF/FULL/PEEK geometrija.

Prepatch su reprodukovani **5 session, 10 UI/bridge i 2 mikroturn FAIL** slučaja. Objedinjeni prolaz 11 suite-ova pre završnih preglednih dopuna: **488/488 PASS**, 54.005 s. Nezavisan pregled je reprodukovao dva preostala slučaja: noviji MAP je sprečavao prihvatanje uspešnog AREA PAGE-a i MAP retry nije obnavljao sačuvan izbor. Oba su potvrđena i popravljena; root je dodatno zahtevao očuvanje `FOR_ME_REFUSED` i neuspešnog opcionog EXACT toka. Završni ponovljeni skup svih šest suite-ova pogođenih kasnijim izmenama: **202/202 PASS**, 17.899 s. Zbir pokrivenosti završnog obuhvata je **503 različita testa u 11 suite-ova**, ne zbir preklopljenih izvršenja. Komanda je `node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --silent --runTestsByPath` sa `src/data/__tests__/discovery-v1-screen-session.test.ts`, `discovery-v1-route-coordinator.test.ts`, `discovery-v1-route-lifecycle.test.tsx`, `discovery-v1-for-me.test.tsx`, `discovery-v1-screen-warm.test.tsx` i `discovery-v1-screen-pin.test.tsx` za završnih šest; puni raniji skup dodaje `discovery-v1-presentation-bridge.test.ts`, `discovery-presentation.test.tsx`, `discovery-v1-owner.test.ts`, `discovery-v1-warm-return.test.ts` i `discovery-v1-client-transport.test.ts` iz istog direktorijuma. Završni `node node_modules/typescript/bin/tsc --noEmit` i `git diff --check`: PASS. Route test koristi stvarni route/session/coordinator i kontrolisan transport, sa zamenjenim bridge-om; presentation ima odvojen test. To nije uređajska provera. Status: F16 navedeni klijentski obuhvat `IMPLEMENTED`, lokalno `VERIFIED`; F15, fizički panel/native i širi R02 ostaju otvoreni. GitHub/CI nove verzije nisu izjednačeni sa ovim lokalnim prolazom.

**2026-10-28 — GitHub potvrda novog F16 i R01 metadata skupa.** `git push --set-upstream origin work/rev14-review-f17` poslao je `82ff498`, `f831591` i plan `6be13b064ec1c04341ef224876d772a565794954` u isti draft PR #43; cilj i base SHA ostali su nepromenjeni. [CI run 40652955784](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40652955784), job `122697126248`, završio je **SUCCESS**: **623 Jest suite-a / 14.253 testa / 3 snapshot-a**, exact dependency install/native patch, TypeScript, tri Deno Edge type/import provere, AI/taxonomy ugovori, 193-file migration integrity i 15 integritet testova, kao i 14 ograničenih R01 SQL testova. Svaki workflow korak završio je `success`. Sirovi log sačuvan je kao managed artefakt `artifacts/r01/20261028-github-ci-40652955784.log`, SHA-256 `768cef925b0064934faf77ef6d66ebac382e21be5359405fc39338cfd7ee45d1`. Ova naknadna dopuna plana ne menja provereni aplikacioni/SQL source. Nema merge-a, DEV upisa, migracije, Edge deployment-a, novog APK/OTA-a ili native dokaza.

**2026-10-28 — R01/R12: tekuća šema za izolovanu proveru, još bez runtime prolaza.** Polazište `0803d06338ec0860b999005b486eb3700d561dc9`. Metadata capture je proširen na pune normalizovane kataloge i tačan DDL, i stvarno izvršen na DEV-u u read-only transakciji u **08:45:32.196966 UTC**. Format 3 prenosi int64 opcije sekvenci kao decimalni tekst; format 2 je odbačen za bootstrap zato što je JSON/JavaScript transport mogao zaokružiti velike brojeve. Svih 11 digest-a kataloga ostalo je identično ranijem capture-u; nema novih poslovnih/Auth redova u snimku niti DEV upisa. Autoritativni privatni artefakt `artifacts/r01/20261028-bootstrap-metadata-v3.json`: SHA-256 `c222414ac222f2beee07f954165abf61ad4bf8b8ba4eebea91e0143784b1a36e`.

[Generator](../../supabase/proofs/privacy/bootstrap/generate.py) iz tog tačno pinovanog ulaza priprema 167 tabela, 9 sekvenci, 682 aplikacione/helper funkcije, 1.099 ograničenja (šest preko constraint triggera), 364 indeksa, 91 politiku, 173 hooka i jedan aplikacioni event trigger. Čuva i četiri obrisana ordinalna mesta kolona. Ne kopira poslovne, referentne, Auth, Vault, cron ili sertifikacione redove. Aplikacioni default ACL obnavlja samo za `postgres` u tri aplikaciona namespace-a; managed uloge/šeme ostaju odgovornost izolovanog platformskog sloja. [Izvedeni SQL izvor](../../supabase/proofs/privacy/bootstrap/current-application.sql) ima SHA-256 `9d58bc5c8f5f2e057767b52e2467dbe4c700838755b438646e1cabafdb33fc7e`; sirovi capture nije objavljen. Pregled publikacije nije našao secret blokere; devet označenih dinamičkih/HTTP/Vault/URL mesta ne izvršava se generisanjem ili samim kreiranjem funkcija. Strogi pregled repo porekla našao je 518/682 tela u Git-tracked izvorima; preostala imaju tačan tekući metadata izvor i pregled, bez tvrdnje da su već bila javna.

[Nezavisna provera kataloga](../../supabase/proofs/privacy/r01-bootstrap-parity.mjs) poredi 16 grupa objekata i odbija nepotpun, neusaglašen ili numerički neprecizan snimak. Pregled je našao dva propusta u samoj proveri — int64 zaokruživanje i neproverene duplirane Auth metapodatke — i oba su popravljena. **33/33 Node testa PASS**; na stvarnom capture-u potvrđeni su self-match i tri namerne negativne promene: isključen Need RLS, promenjen poslednji bit int64 maksimuma i uklonjeno ograničenje. To su kontrole alata, ne jednakost sa probnom bazom. Sirovi rezultat: `artifacts/r01/20261028-bootstrap-parity-actual-mutations.log`, SHA-256 `3e737401df8721102c1c931f8574ca06dba476e53730b561d4996f5b665d7207`. Generator ima **10/10 Python testova PASS**, osam dodatnih odbijanja namerno oštećenog stvarnog ulaza i deterministički isti izlaz; ograničene PGlite sintaksne probe nisu PG17 runtime dokaz. Nezavisan pregled nije našao novi konkretan blokator u generatoru za ovaj capture.

[Izolovani workflow](../../.github/workflows/r01-disposable-schema.yml) i [runner](../../supabase/proofs/privacy/runtime/run.mjs) pripremaju Ubuntu 24.04, CLI 2.116.0 i pinovane PostgreSQL 17.6/Auth/PostgREST/Storage/Realtime servise, bez hosted veze ili kredencijala. Namenjeni su samo bootstrap-u i strogoj proveri strukture; ne primenjuju R01 kandidat niti stvaraju sintetičke korisnike. Lokalni source-admission proverava tačne SQL bajtove; posebna `.gitattributes` stavka čuva 277 CRLF sekvenci i završne razmake unutar snimljenih funkcijskih tela. Poslednja lokalna provera runner-a mora proći pre commit-a. **U ovom zapisu još nisu pokrenuti na GitHubu; bootstrap/parity/HTTP ostaju UNPROVEN.** Prvi naredni korak je stvarno izvršenje, pregled svake razlike i zapis stvarnog ishoda u ovom istom dnevniku. GitHub isporuka izvora nije isporuka aplikacije.

**2026-10-28 — stvarni prvi disposable run i ispravka prijema.** Source `a2a6b70f683fc1e70fc4171d0dcaa1c4a08c30bd` je na GitHubu. [Run 40663233017](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40663233017), job `122731191644`, izvrsio je 38/38 comparator/runtime testova, source admission, pokretanje zdravog Supabase stack-a i proveru svih sest image tagova/digest-a. Stao je na `PG_ADMISSION`: runner i generator pogresno su trazili naziv privilegovane uloge `postgres`, dok je stvarni naziv `supabase_privileged_role`. Cleanup je uspeo; nisu pokrenuti extension/application DDL, fixture, kandidat ili HTTP proba. Sacuvan log `artifacts/r01/20261028-disposable-ci-40663233017.log`, SHA-256 `f581431f634f6ef1597cfc8aeb810408f4b87dee51bddd2c2b86631e22943a66`.

Dve dopunske read-only DEV provere potvrdile su isti naziv, registrovani `pg_settings.context=sighup`, `postgres` NOSUPERUSER i efektivni `pg_has_role(...,'USAGE')=true`. Dokazi: `20261028-supautils-contract.json` SHA `b9c00a694fc8b02108f7539fb57f5117797570ee757199795678ebc6e8087b96` i `20261028-supautils-registered-setting.json` SHA `c227ea8780d5a088f69280990e6f439c12c68ce8b231dc675773f492d943361b` u managed `artifacts/r01/`. [Pinned Supautils v3.4.0](https://github.com/supabase/supautils/blob/v3.4.0/src/supautils.c#L1375-L1386) koristi istu semantiku efektivno nasledjenih prava; samo `MEMBER` nije dovoljan. Ispravka odbija odsutan/nepoznat GUC/ulogu, pogresan context, neaktivno nasledjivanje i SUPERUSER. Nema izmene konfiguracije ili privilegija DEV-a.

Generator takodje ispravlja tip podrazumevanog ACL-a za sekvencu sa `S` na PostgreSQL oznaku `s`. Nova SQL/provenance datoteka regenerisana je dvaput identicno iz istog neizmenjenog v3 capture-a: SQL SHA-256 `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f`; 277 originalnih CRLF sekvenci je sacuvano. Artefakti su u `artifacts/r01/bootstrap-v3-supautils-corrected/`. **7/7 runtime testova i 10/10 generator testova PASS**, source hash admission i `git diff --check` PASS. In-memory PG18 proba potvrdjuje SELECT/UPDATE/USAGE podrazumevani sequence ACL; nije PG17 integracioni dokaz. Javna SQL dijagnostika sada moze navesti broj reda izvora uz SQLSTATE/hash, bez raw SQL ili korisnickih podataka.

Odvojeni [puni CI 40663232942](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40663232942) za `a2a6b70` je zavrsen `SUCCESS`: 623 suite-a / 14.253 testa / 3 snapshot-a i svi ostali koraci, ukljucujuci 33 comparator i 10 generator testova. Log `artifacts/r01/20261028-full-ci-40663232942.log` SHA-256 `e9e6cfedfac850d5bf65e27dbe3990e970904e863d8177d57692715ff39d1f6c`. To ne pretvara neuspesan disposable run u PASS. Ispravljen prijem je lokalno proveren; slede novi commit/push na istu draft granu i stvarni novi schema run. R01 privatnosni nalaz, Auth/PostgREST i native kompatibilnost ostaju otvoreni.

**2026-10-28 — ispravljen prijem radi; aplikacioni bootstrap izvrsen, 25 razlika ostaje otvoreno.** Commit `b5d60008e90d735897c988bf6298fa6817cd783e` poslat je na istu radnu granu i draft PR. [Run 40665648494](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40665648494), job `122739314451`, koristi GitHub merge source `f91dfef2048299aed6dca5ca0efb0ace0fa373ce`. Provereni SQL ima SHA-256 `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f`. **40/40 comparator/runtime testova PASS**; `PG_ADMISSION`, `PLATFORM_EXTENSIONS`, `EXTENSION_ADMISSION`, `APPLICATION_SCHEMA` i `CURRENT_CATALOG_CAPTURE` stvarno su uspesno izvrseni. Ovo zatvara raniju gresku prijema i potvrdu da se generisani DDL moze izvrsiti na pinovanom PG17 stack-u, ali ne zatvara R01.

`STRICT_PARITY` je ispravno vratio neuspeh: `metadata_equal=false`, **25 razlika**. Raspodela: managed relacije 2, indeksi 9, schema ACL 1, memberships 2, default ACL 4, bezbedna role podesavanja 3, roles 1 i vlasnici ekstenzija 3. Nema prijavljenih razlika u `application_relations`, `function_inventory`, `constraints`, `policies`, `triggers`, `sequences`, `event_triggers` ili `needs_column_select`; to su tacno uporedjene grupe, ne HTTP/device tvrdnja. Cleanup je `SUCCESS`. Log `artifacts/r01/20261028-disposable-ci-40665648494.log` SHA-256 `37e2109e884bef8cbde15fbba544cfe96971a5b7da173ff0ee2605f41785e449` ostaje managed dokaz.

Ocekivane identitete razlika povezuju SHA-256 kljucevi: `realtime.messages` (ACL/kolone), `storage.objects` (ACL), cetiri `auth.users/idx_users_*` indeksa, cetiri Storage versioning indeksa, Realtime schema/default ACL, hosted `cli_login_postgres` uloga i membership, operativna podesavanja, te vlasnici `pg_stat_statements`/`pgcrypto`/`uuid-ossp`. Dodatni index `storage.objects.bucketid_objname` i nekoliko dodatnih operativnih/default ACL kljuceva povezani su tacnim hash-om. **Storage razlike ukljucuju jedinstvenost podataka, ne samo brzinu**: `idx_objects_current_version`, `idx_objects_null_version` i `objects_bucket_id_name_version_key` ne smeju biti preskoceni kao performance odstupanje. Sama imena/hash-evi nisu dovoljni da se ACL, grantor, options ili Realtime kolone proglase bezopasnim. Sledeci korak je ogranicen prikaz konkretnih bezbednih managed metapodataka i poreklo verzija/konfiguracije; katalog se ne menja naslepo niti se strict gate razvodnjava.

[Puni CI 40665648508](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40665648508), job `122739314718`, je **SUCCESS za isti b5d6000 source**: 623 suite-a / 14.253 testa / 3 snapshot-a i svi ostali koraci, ukljucujuci integritet migracija i izolovane SQL/comparator/generator provere. Log `artifacts/r01/20261028-full-ci-40665648508.log` SHA-256 `838caed3bb55fc3f69f411c2d3f5789bf4c620d44f2411fbbfc74bdf8b3d685b`. Nezavisan pregled ispravke nije nasao novi konkretan blokator. **DEV nije menjan; R01 kandidat, stvarni Auth/PostgREST, native kompatibilnost i isporuka aplikacije ostaju neizvrseni.** Ovaj zapis je dokumentacioni checkpoint posle stvarnih rezultata.

**2026-10-28 — precizna dijagnostika 25 managed razlika, priprema novog izvrsenja.** Polaziste `e622d784fb62b9352665f1473e21fe8465cf02a0`. Privatni pregled `artifacts/r01/20261028-disposable-parity-classification-40665648494.json` (SHA-256 `a2e698fe3cbea762edfb6e3809208722a95549dccd3311bc437100dd5f0a4870`) povezuje svih 25 identiteta tacnim hash-om; nijedan nije prihvacen kao izuzetak. Novi `runtime/managed-diagnostics.mjs` na validiranom capture-u izdvaja per-field/per-column hash-eve i ACL tuple: hash grantee/grantor-a, kod privilegije i grant option. NULL i prazan ACL ostaju razliciti; redosled se normalizuje samo za dijagnostiku, bez promene strogog comparator-a. Raw identiteti, default izrazi, SQL tela, konfiguracione vrednosti i nepoznata imena polja ne izlaze u javni izvestaj. Posebni redovi loga izbegavaju prevelik pojedinacni zapis.

**11/11 runtime/dijagnostickih testova PASS**, ukljucujuci uklanjanje grant option-a, promenu grantor-a, PUBLIC, nepoznat ACL format, redosled i privatni marker. Na stvarnom V3 capture-u potvrdjeni su self-match, promena jedne kolone, redosled ACL-a i stvarna promena grant option-a; izmene i dalje daju strict parity FAIL. Dokaz `artifacts/r01/20261028-managed-diagnostics-validation.log`, SHA-256 `4856a0323e325d84a1ddd84aa7be8f406be993ce5f911d0ed45c018266ee4e92`. Source admission i diff provera PASS. Runtime receipt sada razdvaja dozvoljeni dijagnosticki exit od uspesnog exit-a, tako da STRICT_PARITY exit 1 vise nema oznaku `passed=true`. Nijedna platform privilege/schema postavka nije menjana. Sledi novi izolovani run radi stvarnog ocitavanja; priprema izvestaja sama ne razresava 25 razlika.

**2026-10-28 — stvarna dijagnostika i dokazano zastareli service pinovi.** Source `f728ecf82e503f03b1d0d9a305db70d78d40e04d`; [schema run 40668304552](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40668304552), job `122748366139`, source merge `507ef525f17c5f952c2612eba036e708d3051d1b`. **44/44 testova PASS** i pun bootstrap/capture opet izvrsen. Izvestaj obuhvata svih 25 razlika bez preskocenih; parity ostaje FAIL. Log `20261028-disposable-ci-40668304552.log` SHA `78bfaa268221c5fbde0f10b7b451482250b6015265313f59c3f122c4a9430ac3`; privatno tumacenje `20261028-managed-diagnostic-interpretation.json` SHA `338deff1a42ae8cf9a231fb6cdc13cfb08ed62a0b842fb0ecba121cab98ee554`, oba u managed `artifacts/r01/`.

Potvrdjene su stvarne razlike, ne samo redosled ACL-a: stari Realtime nema `skip_broadcast`, koristi `now()` umesto UTC `clock_timestamp()` i nema snimljena grant option prava; stari Storage zadrzava dodatne TRUNCATE/REFERENCES/TRIGGER/MAINTAIN privilegije za anon/authenticated i staru unique index strukturu. Tri ekstenzije imaju owner `supabase_admin`, a DEV `postgres`; to se ne prepisuje radi prolaza. U 09:59:32 UTC procitana je samo sistemska evidencija servisnih migracija u read-only transakciji: Storage zakljucno sa 73, Realtime sa `20261009120000`. Dokaz `20261028-service-migration-metadata.json` SHA `12463dbcc82d91cc993cf6e47fedd759182707bc07d7c8604f0957edcd4e98e2`. Nema poslovnih/Auth korisnickih redova ili upisa.

Za novu probnu bazu pinovi su promenjeni na **Storage v1.80.0 / Realtime v2.148.4**. Storage tag sadrzi tacno potrebnu granicu do migracije 73, a poslednjih 15 source hash-eva (59–73) identicno je DEV evidenciji po stvarnom algoritmu biblioteke `SHA1(basename + SQL)`. Pocetna proba samo `SHA1(SQL)` nije bila validno poredjenje i sa ispravnim algoritmom svih 15 prolazi; nijedan ledger hash nije menjan. Source bundle `20261028-storage-v1.80.0-official-migrations.json` SHA `244df83244d4926e460fc451389105ee20c5e453038dba12f739e73c067c4db0`; verifikacija `20261028-storage-migration-hash-verification.json` SHA `42d74e7a69ef81cd3839fb99cd5f41674127967ae74d76b74cbbcc2d09c99775`. Poslednjih 15 Realtime identifikatora se takodje poklapa; `20261028-realtime-v2.148.4-migration-frontier.json` cuva izvor. To su kandidati kompatibilni sa snimljenom granicom, ne tvrdnja o tacnoj deployovanoj verziji servisa. Noviji Storage tagovi uvode migraciju 74 i nisu izabrani. Runner sada proverava ovih 15+15 stvarnih ledger zapisa na novoj probnoj bazi pre aplikacionog DDL-a. Lokalno **12/12 testova PASS**, source admission i diff PASS; runtime novih pinova tek sledi.

[Puni CI 40668304464](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40668304464) za `f728ecf` je SUCCESS: 623 suite-a / 14.253 testa / 3 snapshot-a i svi ostali koraci. Log `20261028-full-ci-40668304464.log` SHA `628496ce878c11cc9ac3ba7ffe8ca3dfbf04a8e892f68a39f0aa2ebdc8820ecd`. R01 privatnosni kandidat i stvarni Auth/PostgREST ostaju neizvrseni.

**2026-10-28 — nedostupna Realtime slika, ispravka izbora uz isti migration source.** Source `8f18ece`; [schema run 40669742035](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40669742035), job `122753196996`, merge source `6c1c7ec0e37f4d467cbd4f49bc8c2f02541f0583`: **45/45 testova PASS**, ali `START_STACK` exit 1 pre aplikacionog SQL-a. Cleanup je izvrsen. Log `artifacts/r01/20261028-disposable-ci-40669742035.log` SHA `1f698c7a8f748d285efeb4bdf1790e300ff257bfca3257019fa154c40c2bb314`. Prethodnih 25 razlika ovim run-om nije ponovo mereno.

Direktna read-only provera javnih image registara utvrdila je HTTP 404 za `supabase/realtime:v2.148.4` i na ECR i na Docker Hub-u. `v2.148.3` je dostupna za Linux amd64; svih **91 tenant migration path/blob identiteta jednako je v2.148.4**, ukljucujuci poslednjih 15 DEV identifikatora. Storage v1.80.0 je takodje dostupna. Dokaz `artifacts/r01/20261028-realtime-v2.148.3-available-image.json` SHA `6850b77d7f53993b2060dc03e83c514d78fb0199105073babf8d14f2f04bbcaa`. Runtime pin je ispravljen na v2.148.3 bez promene ledger ocekivanja. Startup dijagnostika sada daje samo fiksne kategorije i hash izlaza, bez raw loga. **13/13 lokalnih runtime/dijagnostickih testova PASS**, source admission i diff PASS. Novo stvarno pokretanje jos nije potvrdeno; ovo ne zatvara R01.

[Puni CI 40669741878](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40669741878), job `122753196905`, za `8f18ece` je **SUCCESS**: 623 suite-a / 14.253 testa / 3 snapshot-a i svi ostali koraci. Log `artifacts/r01/20261028-full-ci-40669741878.log` SHA `9ef9f6142d7a0b48f6d1cf4b2a559622e81a976b666232e4e8515a37416ce511`. DEV i kandidat nisu menjani.

**2026-10-28 — runtime popravljen; 25 razlika svedeno na 17 bez izuzetaka.** Source `265774203e0f010add40538b46405aa9953e019f`; [schema run 40670930091](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40670930091), job `122757192001`, merge source `a6e25faa6404b050e286354aee2db6eacb9d102c`. **46/46 testova PASS**, startup/pinovi/PG/15+15 ledger/ekstenzije/aplikacioni DDL/capture PASS; strict parity FAIL sa **17** razlika, svih 17 dijagnostikovano. Cleanup SUCCESS. Log `artifacts/r01/20261028-disposable-ci-40670930091.log` SHA `a4dc71e3f13d07ae45ac1499be1c7f6f8b4ff1b10672efcd3a648f00fb6bce3a`; tacna mapa napretka `artifacts/r01/20261028-parity-progress-40670930091.json` SHA `be4db4bfb1d15e41f7f78d8e50bd1a8e64b00a742230abd032b249684b5ac375`.

Uklonjeno je osam celih razlika: Realtime messages ugovor, pet Storage index razlika (ukljucujuci unique/nulls-not-distinct), Realtime schema ACL i Realtime default ACL. Storage anon/authenticated visak privilegija takodje je nestao; u tom jednom preostalom redu razlikuje se samo eksplicitni grant-option zapis postojeceg vlasnika. To nije automatski prihvacen izuzetak. Preostali identiteti i raw tumacenje ostaju u privatnom dokazu; comparator i dalje odbija sve razlike.

Cetiri nedostajuca Auth indeksa identifikovana su u zvanicnom Auth v2.196.0 `internal/indexworker/indexworker.go`; config `EnsureUserSearchIndexesExist=false`, `MaxUsersThreshold=0` ne pokrece worker. Tacne definicije podudaraju se sa V3 capture-om. Novi `runtime/auth-search-indexes.sql` ih rekonstruise atomski kao postojeci `supabase_auth_admin`, samo kroz lokalni socket na praznoj PG17 bazi pre aplikacionog DDL-a. Ne menja ACL, owner-e, roles ili tabele. Source dokaz `artifacts/r01/20261028-auth-search-index-source.json` SHA `91298abe8ceaf788760aebe93c78079617e5c3b777f37b64cdb3195a4ec8bfd0`. **13/13 runtime/dijagnostickih testova i source admission PASS**; stvarni PG17 prolaz dodatnog SQL-a tek sledi. Ocekivani manifest nije menjan.

[Puni CI 40670930277](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40670930277), job `122757192809`, za `2657742` je SUCCESS: 623 suite-a / 14.253 testa / 3 snapshot-a i svi koraci. Log `artifacts/r01/20261028-full-ci-40670930277.log` SHA `7c9f1d621387ef08f0af2c3154a3dd25084bdc3e440b7a29b13d671595bb6452`. Nema DEV upisa, kandidata, Auth/HTTP fixture-a ili isporuke aplikacije.

**2026-10-28 — prvi Auth-index run stao na konekciji; ogranicena ispravka sesije.** Source `b53ba9963eeedb3e31a6462312079cef4e3e7d61`; [schema run 40671897876](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40671897876), job `122760493379`, merge source `9e40db5c9df8aefd38b26a2cebedf8d0dc633881`. Startup, pinovi, PG i 15+15 ledger PASS; `AUTH_SEARCH_INDEXES` vraca psql exit 2, bez SQL source line/SQLSTATE/guard-a, pre aplikacionog DDL-a. Strogi parity nije ponovo izvrsen; prethodnih 17 ostaje poslednji izmeren broj. Log `artifacts/r01/20261028-disposable-ci-40671897876.log` SHA `0792448b57b5b4af9bb8950b245469c489aea7581d0a89b987c9671b62b88c36`.

Ispravka koristi vec dokazanu lokalnu `supabase_admin` socket sesiju i `SET LOCAL ROLE supabase_auth_admin` unutar iste transakcije. Guard zahteva oba identiteta: session_user i current_user; Auth lozinka se ne cita i nikakve role privilegije se ne menjaju. Sva cetiri indeksa i strogi expected manifest su nepromenjeni. Source admission i diff PASS; stvarni runtime korekcije tek sledi.

Izvor pet preostalih webhook razlika mapiran je na zvanicni CLI v2.116.0 `webhook.sql` (membership, tri default ACL-a i search_path). PostgreSQL 17 dokumentuje implicitne grant option-e vlasnika; to objasnjava mogucu reprezentacionu Storage ACL razliku, ali nije runtime dokaz niti dozvola da se ona preskoci. Dokaz `artifacts/r01/20261028-platform-difference-source-review.json` SHA `051bb298cb1fc0fe25d08cf65ca08af7d668150534d751498550a740785da3e0`. Slede efektivni role/privilege putevi i ugovori koriscenih managed extension funkcija; nijedna managed razlika jos nema izuzetak.

[Puni CI 40671897844](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40671897844), job `122760492667`, za `b53ba99` zavrsio je SUCCESS: 623 suite-a / 14.253 testa / 3 snapshot-a i svi koraci. Log `artifacts/r01/20261028-full-ci-40671897844.log` SHA `4b7be0bd67ffeb321f8518f0703f102e62bd9d8a997cb811a1ce303a637598d9`. Ovaj full CI nije dokaz izvrsenja dodatnog Auth-index SQL-a; njegov neuspeh i korekcija sesije su odvojeno zabelezeni iznad.

**2026-10-28 — cetiri Auth indeksa stvarno potvrdjena; poslednji rezultat 13 razlika.** Source `72bc3d8d5a0ce8035fe2ad48e56073e2ffd3ac2c`; [schema run 40672709481](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40672709481), job `122763263088`, merge source `f7bd6c6e0b1f753311cae3cca0b6f09e45f955d6`. **46/46 testova PASS**. START_STACK, svi image/digest prijemi, PG17, service history 15+15, AUTH_SEARCH_INDEXES, ekstenzije, APPLICATION_SCHEMA i CURRENT_CATALOG_CAPTURE su PASS. Sva cetiri Auth indeksa sada su jednaka DEV capture-u; nijedan indeks nema razliku. Preostalih **13 razlika** nepromenjeno je u odnosu na prethodnih 17: nema novih identiteta, field ili observed hash delti. Strict parity je i dalje FAIL; svih 13 ima dijagnostiku, bez preskocenih. Cleanup SUCCESS. Log `artifacts/r01/20261028-disposable-ci-40672709481.log` SHA `0fe33e1f467eb9896fd728c8c77514b8c02cc9f4f896e5ccae790c1e8548e7d8`. Poredjenje 17 prema 13 sa istim preostalim hash-evima: `artifacts/r01/20261028-auth-index-runtime-progress.json` SHA `233c94252c0a6441912a1504e6b0258aea2b84f1abbfa0f71d28f30da3410a95`.

Ovim su reseni dostupnost Realtime slike, servisne migracije koje su stvarale osam razlika i cetiri Auth search indeksa. Nisu prihvaceni blanket izuzeci, nisu menjani expected fingerprints ni managed prava/owner-i. DEV je ostao neizmenjen. R01 ostaje IN_PROGRESS: prava Auth/PostgREST sesija, privatnosni kandidat i native/OTA kompatibilnost jos nemaju integracioni dokaz.

[Puni CI 40672709474](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40672709474), job `122763262887`, za `72bc3d8` je **SUCCESS**: 623 suite-a / 14.253 testa / 3 snapshot-a, TypeScript, Edge/AI ugovori, migration integrity i izolovani SQL/comparator/generator koraci. Log `artifacts/r01/20261028-full-ci-40672709474.log` SHA `dd112ffc4e9625ed9291be0fee37180359c469289665ccdff31454d2ca2d7daa`. Ovo je dokumentacioni checkpoint posle stvarnih rezultata; testirani runtime source se ne menja. Izvorni REV10 plan i generisani aplikacioni SQL ponovo su provereni po nepromenjenim SHA-256 vrednostima. Sve dopune ovog nastavka ogranicene su na postojeci `ledger-20261028` blok.

**2026-10-28 — dopunski capture stvarnih platformskih prava, bez DEV upisa.** Sa source osnove `7dfa28940fd623e8101db4ea79a3371a5e95c7cf` u 10:43:46 UTC procitan je sistemski katalog istog DEV projekta, u read-only transakciji sa `search_path=pg_catalog`. `runtime/platform-effective.sql` vraca 80 efektivnih Storage privilege/grant-option redova, 100 role reachability redova, 50 schema privilege redova, 61 rutinu iz pgcrypto/uuid-ossp/pg_stat_statements/pg_net i 3 namespace presence provere. Ne cita korisnicke/poslovne redove i ne poziva aplikacione ili extension funkcije. DEV Storage owner za svih osam privilegija ima `grantable=true`; medju ovih 61 DEV rutina nema SECURITY DEFINER funkcije. To je jedna strana poredjenja, ne tvrdnja jednakosti sa lokalnim runtime-om.

Privatni dokaz `artifacts/r01/20261028-platform-effective-dev.json` SHA `8b19367d1a2ed5d22f708a6b6dad4016221798e28947459cc2280e976c7eca69`. Javni `platform-effective-expected.json` sadrzi samo hash-eve identiteta/vrednosti i validirana boolean prava. Query bytes su vezani SHA-256 hash-om. Novi comparator odbija nepoznata polja, duple identitete, nedostajuce principal-e, promenu PG/read-only konteksta i hash/query drift. Promene owner grant option-a, nasledjivanja, SECURITY DEFINER, EXECUTE prava, tela i ACL-a ostaju vidljive. **17/17 lokalnih runtime/dijagnostickih testova PASS** i source admission/diff PASS. Istovetni query je prikljucen izolovanom runtime-u posle bootstrap-a; stvarni CI rezultat tek sledi. Ovaj diagnostic ne menja strogi comparator, 13 otvorenih razlika, ocekivani schema manifest ili pristup kandidat/fixture koracima.

**2026-10-28 — izvrseno poredjenje efektivnih prava: uzrok lokalne webhook razlike.** Source `442b1cb3df42c28079757d3efdebf382eed92a7b`; [schema run 40674981454](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40674981454), job `122770968154`. **50/50 testova PASS**, svi prethodni bootstrap/admission koraci i novi PLATFORM_EFFECTIVE_CAPTURE PASS; cleanup SUCCESS. Strict comparator zadrzava istih **13 razlika**. Dopunski comparator prikazuje **62 razlicita reda**: 1 role reachability, 10 schema access i 51 extension routine. Ovo su detaljniji razliciti zapisi o platformi, ne 62 nova aplikaciona nalaza. Svih 80 Storage privilege/grant-option provera i tri namespace presence provere se poklapaju. Za svih 61 obuhvacenih rutina nema promene body hash-a niti proveravanih EXECUTE boolean prava. Razlike vlasnistva i ACL-a ipak ostaju vidljive i nisu automatski prihvacene.

Tacna razlika: lokalni `postgres` ima USAGE/SET pristup `supabase_functions_admin`, a DEV nema; schema `supabase_functions` postoji samo lokalno. Od 51 razlicite rutine, 49 ima razlicit owner/ACL otisak. Preostale dve su `net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer)` i `net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer)`: lokalno SECURITY DEFINER, na DEV-u SECURITY INVOKER, uz razlicite config/definition/ACL hash-eve. To je stvarna razlika bezbednosnog konteksta, iako su tela i proverena EXECUTE prava jednaki.

Potvrdjeno poreklo: pinovani [CLI start.go v2.116.0](https://github.com/supabase/cli/blob/v2.116.0/apps/cli-go/internal/db/start/start.go) za PG > 14 ukljucuje `webhookSchema` u pocetnu semu. Njegov [webhook.sql](https://github.com/supabase/cli/blob/v2.116.0/apps/cli-go/internal/db/start/templates/webhook.sql) dodaje navedenu schemu, membership/default ACL/role setting i event trigger koji menja pg_net funkcije. Samo odsustvo literalne aplikacione reference na `supabase_functions` nije dokaz potpune nezavisnosti: aplikacioni DDL sadrzi poziv `net.http_post`. Nijedna aplikaciona funkcija nije pozvana ovom proverom. Nisu kopirane hosted uloge, menjana platforma na DEV-u ili prepisivani vlasnici/prava radi prolaza.

Pregled svih 13 strict razlika: (1) Storage zapis ima potvrdu jednakih 80 efektivnih provera, ali strict razlika ostaje; (2) tri extension owner razlike imaju proverena ista tela i EXECUTE prava, bez tvrdnje jednakog DDL autoriteta; (3) pet webhook razlika ima konkretan izvor i dodatni SECURITY DEFINER dokaz; (4) hosted CLI role i incoming membership nisu kopirani; (5) dva admin search-path zapisa imaju samo tri ogranicene namespace presence provere, ne opsti dokaz razresavanja svih imena. Nijedna grupa nije proglasena R01 prihvacenom na osnovu samog ovog diagnostic-a.

Privatni dokazi u istom managed evidence prostoru: `artifacts/r01/20261028-disposable-ci-40674981454.log` SHA `a69a6dc172a26dc3131cb987c10783e1da57a3563583d35c08837997a67f122a`; `20261028-platform-effective-interpretation.json` SHA `9db70a53ecef249cfccd3298a9a999f3cbc63dc963400f2a30f18d7c91aa54ce`; `20261028-remaining-13-effective-review.json` SHA `fe71bde73e795088d0b6aa737f84237b473c964005c8e6d8345b445e5918004a`. Query SHA `659c33eaae7d84d4b35ca0a9aef0135928a7fa505c997cc94c34706073f870ad`; expected capture canonical SHA `5c1b02cb10b4380cc643822ee1197b14034e3dbea2fb9feeb775505ccca2612c`, observed `02cacbf1ca225f23e7338c7f0390470a7c13240dabdada08da1606517ba486ae`.

[Puni CI 40674981672](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40674981672), job `122770968864`, za isti source je **SUCCESS**: 623 suite-a / 14.253 testa / 3 snapshot-a, TypeScript, Edge/AI ugovori, migration integrity i izolovani SQL korak. Log `artifacts/r01/20261028-full-ci-40674981672.log` SHA `c4530e6b6e3c29d6d264e3f0e3f9403c506c7fbeb593bc429470d5444404ba22`. R01 ostaje `IN_PROGRESS`; stvarni Auth/PostgREST, kandidat i native kompatibilnost jos nisu dokazani. Ovaj checkpoint dokumentuje izvrsen rezultat; ne pretvara ga u integracioni prolaz.

**2026-10-28 — potvrđene D06 i D08.** Vlasnik u razgovoru potvrđuje satnicu po osobi i povezivanje prema mestu početka posla. Tačan važeći ugovor upisan je uz §9.1–9.2 i u aktuelne R05/R07 redove. Istorijski zapisi o otvorenim odlukama ostaju dokaz ranijeg stanja, ali nisu važeća blokada. Ovo je dokumentaciona primena korisničke odluke; kod, Supabase i status implementacije nisu promenjeni. Pri nastavku R05/R07 koristiti ove odluke bez ponovnog traženja iste potvrde.

**2026-10-28 — R07a/F03: konkretna popravka zastarele potvrđene cene.** Nastavak sa source osnove `b863f4e8f79c5ffdf1d9a17094dbd348a10c1d7b`, nezavisno od otvorene R01 platform parity prepreke. Pre izmene postojeća karakterizacija je izvršena: **10/10 PASS reprodukuje kvar**, ne popravku. Read-only DEV provera potvrđuje trenutna tela writer-a (`14ace04bd1895f4d230d41baf13dd6d6`), review-a, confirm-a, source-a, fact-write trigger-a i owned completion/context/status funkcija. Dokaz `artifacts/r07/20261028-current-function-hashes.json`, SHA `c786e08490815497c8f471cddbc4f70b6889971ed7de9811433cb4db27443830`; nisu čitani poslovni redovi niti menjani DEV objekti.

Edge sada šalje tačno definisanu internu kontrolu `INVALIDATE_PRICE` u istom owned completion zahtevu kada korisnik ispravlja aktivnu cenu nepodržanom ili nerazjašnjenom valutom. Model ne može sam da doda tu kontrolu. [Lokalni SQL kandidat](../../supabase/candidates/r07_price_retraction.sql) menja samo postojeći service writer, uz identična prava/vlasnika/potpis/search_path i zaštitu od neočekivanog izvornog tela. Atomski povlači aktivni price mode, iznos i osnovicu, uz očuvanu istoriju i druge jasne činjenice. Novi iznos u RSD traži novu potvrdu; ponude se ne izmišljaju. Stari DB odbija novi kontrolni zapis, pa Edge ne sme biti samostalno isporučen pre odgovarajućeg SQL-a.

**19/19 ciljnih testova PASS** u ograničenom PGlite modelu: stvarni writer/review/source/confirmation, fact-write trigger i owned completion/context/status; pogrešan nalog/zatvoren razgovor, neispravne/duple/konfliktne kontrole, rollback pri kasnijoj grešci, nezavisna naknadna poruka, nova potvrda RSD, eksplicitan OFFERS, replay posle nove cene, istekao pokušaj, zastareo kontekst, pogrešan attempt, otkazivanje i nedispatched zahtev. Zajedno sa stvarnim Edge handler-om uz sintetički transport: **166 PASS, 1 integracioni TODO, 0 FAIL**. TypeScript je prošao. Closure admission/exemption su u SQL modelu stubovi; nema Auth/HTTP, paralelnih sesija, punog signed accept/Save/publish, native ili deployment dokaza. R07a/F03 zato nije zatvoren kao isporučena popravka. [Ugovor i preostala provera kandidata](../../supabase/candidates/r07_price_retraction.md) pripadaju ovom istom planu; ne predstavljaju drugi plan.

Sledeći posao u R07a: kompletan signed review/accept/Save/publish tok sa ranije pripremljenim pregledom, važećom novom RSD cenom i OFFERS, stvarnim Auth/HTTP i location completion putem; zasebno obraditi protivrečan `displayValue`. Tek zatim SQL migracija i usklađena Edge isporuka. R07b/D06 i R05/D08 ostaju potvrđene korisničke odluke, ne ponovo otvorena pitanja. Nezavisni F11/F13 mogu napredovati uz sopstvene provere bez čekanja pune jednakosti platforme.

**2026-10-28 — R07a potvrđen GitHub/CI presek.** Implementacioni commit `14d89038c724b99fb78855330b545b55eb6474ad` je push-ovan na istu granu/draft PR #43. [Puni CI 40682141912](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40682141912), job `122795261854`, završen je kao **SUCCESS**, uključujući TypeScript, Deno Edge proveru, 623 mobilna suite-a / 14.253 testa / 3 snapshot-a, AI/taxonomy i izmenjenu R07a regresiju, migration integrity i izolovani SQL. Dokaz `artifacts/r07/20261028-full-ci-40682141912.log`, SHA `94c9e504a5fe5340b4d28037bf9c60f420d166c86edaee77c61c441bfe0d149b`.

[Schema run 40682141796](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40682141796), job `122795261540`, ponovo potvrđuje bootstrap/capture, 50 checker testova i cleanup, ali ostaje FAIL sa 13 strict / 62 dopunske razlike. Dokaz `artifacts/r07/20261028-schema-ci-40682141796.log`, SHA `7a55c528a45a659b668a4e3fcdd0c9276e66a387e9c345ea8c5cffc3b3604e0a`. Taj workflow ne primenjuje R07a kandidata i nije R07a Auth/HTTP dokaz. Izvorni REV10 i generisani aplikacioni bootstrap zadržavaju ranije SHA-256 vrednosti. R07a je konkretno implementiran i proveren u navedenom obimu; širi F03/R07 i isporuka ostaju otvoreni. DEV baza nije menjana.

**2026-10-28 — R07a: provera ranije pripremljenog pregleda.** Nastavak sa `f5b4a0382a3a7db5ca38b03e6d6650ae2639b0b0`, bez izmene aplikacionog koda ili SQL kandidata. Novi [SQL boundary fixture](../../supabase/proofs/ai/price_review_boundary_fixture.mjs) poziva stvarna tekuća tela `rpc_prepare_ai_task_review`, `rpc_accept_ai_task_review`, `rpc_save_need_draft_from_review`, `rpc_publish_accepted_ai_task_review` i media/source helper-a. Sedam review/media body hash-eva potvrđeno je read-only na DEV-u; dokaz `artifacts/r07/20261028-review-boundary-function-hashes.json`, SHA `0547aca89742d291e9c53831bb16974c12eae7d745f0ee680876e7ef4ff83afa`. Nema poslovnih čitanja ili DEV upisa.

**26/26 ciljnih testova PASS; zajedno sa Edge handler-om 173 PASS, 1 integracioni TODO, 0 FAIL.** Stvarno pripremljen pregled potvrđene cene postaje `TASK_REVIEW_STALE` posle povlačenja, i ostaje zastareo posle naknadnog ALLOW i povratka na isti iznos. Novi pregled bez cene ima `canAccept=false`; accept ga odbija. Direktni draft writer odbija tačno nedostajući `need.price_mode`. Nova RSD cena i izričit OFFERS stvaraju nov prihvatljiv pregled, sa novim identitetima i digest-om; stari digest ne može biti zamenjen. Publish bez accepted komande odbijen je pre upisa. Dokaz `artifacts/r07/20261028-review-boundary-local-tests.log`, SHA `a8d596cee9ca75e0ad04af6ce7bd024ba7ead2e902799df1f65b13ad727691c3`.

Granica dokaza ostaje izričita: Auth/closure su prethodni stubovi, geografija i policy su fiksni sintetički fixtures. Pozitivni accept namerno staje na sentinel-u **pre** čuvanja lokacije/potvrde činjenica; nijedan draft ili objava nije uspešno napravljen. Media/source tela su stvarna, uz praznu asset tabelu. Ovo potvrđuje odbijanje starog pregleda i uslove ulaska u čuvanje, ne puni Auth/HTTP, Save/publish, geografsku/policy ispravnost, paralelne sesije ili isporuku. R07 ostaje `IN_PROGRESS`; pun pozitivan tok, location completion i `displayValue` ostaju sledeći posao. Satnica po osobi i povezivanje po mestu početka ostaju potvrđene odluke. Dopuna je commit-ovana i push-ovana kao `89c2b3d2280349cc89aae47874324f3ce3a2d193` na istu granu/draft PR #43.

[Puni CI 40685721287](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40685721287), job `122807429788`, **SUCCESS** za taj source: TypeScript, Deno, 623 mobilna suite-a / 14.253 testa / 3 snapshot-a, AI/taxonomy (uključujući proširenu R07a regresiju), migration integrity i izolovani SQL. Log `artifacts/r07/20261028-review-boundary-full-ci-40685721287.log`, SHA `e0220841559323a56749a606e30877f0ae89cc50dc96edf3d143d814be02de48`. [Schema CI 40685721274](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40685721274), job `122807430181`, ostaje **FAIL** na istih 13 strict / 62 dopunske razlike; 50 checker testova, bootstrap/capture i cleanup prošli. Log `artifacts/r07/20261028-review-boundary-schema-ci-40685721274.log`, SHA `2dc927863f0441c714e53236944783411155b6b2ae529bb652249f3436434b34`. Ovaj dokumentacioni checkpoint ne menja testirani runtime/test source i ne proglašava R01 ili ceo R07 završenim.

**2026-10-28 — R07a: tačan RSD prikaz i nove AI prezentacione kopije.** Nastavak sa `6e2ab02551fcfbba36f4dee1bc0716b7d810aa22`. Pristup za upis/testove vraćen je kroz konkretna odobrenja aplikacije; prethodni read-only nastavci nisu menjali fajlove. `parseV2Output` sada normalizuje `need.price_rsd.displayValue` iz već validiranog broja u RSD pre upisa. Prvobitna provera obaveznog/ograničenog display teksta ostaje; null, prazan i predugačak prikaz se odbijaju. Guard i dalje traži stvarni RSD unos i odbija EUR/nejasnu valutu. Iznos, evidence i status potvrde nisu promenjeni.

Pomoćni `factReviewValue` više ne bira EUR iz AI teksta. `SupportReferenceView` prikazuje istorijski tipizovani iznos u RSD, a null kao „Iznos nije sačuvan”, bez oslanjanja na zastarelu oznaku. **Glavni `reviewRowValue` već je bio ispravan i nije menjan**; dodata je regresija koja to čuva. Ovo nije dokaz da je glavni pregled ili objavljeni zadatak ikada uživo pokazao pogrešnu valutu. Zajednički money formatter zadržava izričitu valutu Dogovora. Nepromenjene istorijske review/support kopije, digest-i i izvoz ostaju izvorni; direktni correction RPC i proizvoljni servisni upisi nisu ovim proglašeni globalno normalizovanim. SQL kandidat/migracije/DEV nisu menjani.

**Lokalno: 4 UI suite-a / 212 testova PASS; 27 ciljnih SQL/guard testova; ukupno Edge/SQL 183 PASS, 1 integracioni TODO, 0 FAIL; TypeScript PASS.** Novi dokaz prolazi kroz stvarni parser, guard, kandidat writer-a, reader i prepare: korisnikovih 100 RSD uz AI „100 EUR” upisuje/prikazuje 100 RSD; stara sačuvana review kopija ostaje identična. Sintetički HTTP i ograničeni SQL fixtures ne postaju puni Auth/Save/publish dokaz. Nezavisan pregled nije našao blokirajuću grešku; predložene tri provere neispravnog display polja su dodate i prošle. Prvi UI pokušaj imao je jedan postojeći test teme podrške sa timeout-om od 5 s; ponovljen isti skup bez izmene koda ili timeout-a prošao je 212/212. Ranija sandbox EPERM odbijanja nisu testni pad aplikacije; testovi su ponovljeni tek uz odobrenje. Dokaz `artifacts/r07/20261028-price-display-local-verification.json`, SHA `fce563ed4ceb2b6e54f51cf1d69c223853203e75fe9913ee79ab5685cf077bb9`.

R07 ostaje `IN_PROGRESS`: pre isporuke ostaju pun pozitivan Auth/HTTP review/accept/Save/publish i location completion. R07b satnica po osobi i nezavisni F11/F13 slede po istom planu. Ovaj korak zatvara lokalnu implementaciju prikaza/new-AI-copy normalizacije, ne celu vertikalu ili izdanje. GitHub/CI ishod se beleži posle stvarnog izvršenja.

**2026-10-28 — R07a prikaz: potvrđen GitHub/CI ishod.** Commit `564bb169bc97ee7caf722c3da711118771ef57e0` je na istoj grani/draft PR #43. [Puni CI 40696458669](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40696458669), job `122844418647`, je **SUCCESS**: TypeScript, Deno, 623 mobilna suite-a / 14.263 testa / 3 snapshot-a, Edge/AI/taxonomy, integritet migracija i izolovani SQL. Dokaz `artifacts/r07/20261028-price-display-full-ci-40696458669.log`, SHA `733877dd8abd1d8a65d8da596c3240bf6e6a50a50ff94c56b8420f7e45f6af87`. [Schema CI 40696458714](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40696458714), job `122844418229`, ostaje **FAIL** sa istih 13 strict / 62 dopunske razlike; 50 checker testova, bootstrap, capture i cleanup su prošli. Testirana PR merge projekcija je `ac2fe48d36693a74968b3c0d9d566dd0eef6cd3a`. Dokaz `artifacts/r07/20261028-price-display-schema-ci-40696458714.log`, SHA `2f1085f0c5c63d1a9000898d988a2c42009cab51037a8f20d9d04021ff866926`. Nema promocije kandidata, migracije, deploy-a ili spajanja PR-a.

**2026-10-28 — R07/F11: oporavak odustajanja od nacrta.** Pregled sada odvojeno pamti neizvestan abandon iste konverzacije. Proveri prvo koristi postojeći strogi metadata reader `readIntakeLifecycle`: ABANDONED bez vezanog zadatka potvrđuje zatvoren razgovor i daje povratak na početnu, bez readLatest/location/prepare/accept/publish ili ponovnog abandon upisa. OPEN sam ne ponavlja radnju; novi pokušaj traži postojeću izričitu potvrdu. Greška ili nevažeći/nedostajući red ne postaju uspeh. COMPLETED/vezan zadatak oporavlja stvarnu postojeću komandu; bez nje zatvoren razgovor ne ide u novi prepare. Provera pre prepare pokriva i ponovno otvaranje kada se lokalni pending izgubi. Očuvane su accountRevision/focus/route granice, A→B→A i zaseban lifecycle brisanja već sačuvanog nacrta. Poruka za abandon sada kaže „Razgovor je napušten”; terminalni prikaz jasno kaže da podaci nisu trajno obrisani.

**Lokalno: 4 suite-a / 235 testova PASS, TypeScript PASS i diff check PASS.** Dvanaest novih slučajeva obuhvata izgubljen ACK, OPEN, nedostupno čitanje i kasniji oporavak, već sačuvanu komandu, kontradiktorne/zatvorene statuse bez komande, remount/refocus i kasni odgovor posle blur/A→B→A/promene rute. Prvi prolaz imao je samo netačan očekivani tekst novog testa; usklađen je sa postojećom porukom o sačuvanom nacrtu. Nezavisan pregled našao je COMPLETED+bound bez komande koji bi ušao u prepare; uslov je popravljen, dodata regresija i pregled potvrdio uklanjanje. Završni dokaz `artifacts/r07/20261028-f11-abandon-local-final.json`, SHA `b2a9ea507808b15745765f903d23bd84998392abce8be690988ce3a9c32e99d6`; prethodni lokalni zapis izričito je imao TypeScript još u radu i nije završni PASS. Ovo je klijentski i decoder dokaz, bez novog live Auth/HTTP ili native izvršenja. F11 implementacija je završena na ovom nivou; ceo R07 i isporuka ostaju otvoreni. GitHub ishod ovog koraka biće dodat po stvarnom završetku.

**R07b sledeći konkretan obim.** Read-only source pregled potvrđuje da satnica po osobi još zahteva povezan kandidat: Edge je odbija, application validator ne prihvata HOURLY, pojedini prikazi prijave je označavaju „ukupno”, a snapshot/reader Dogovora ne čuva potrebnu osnovicu. Zato se ne uklanja samo PER_HOUR guard niti menja karakterizacioni PASS u dokaz popravke. Sledeći dokaz treba da prati 1.200 RSD po osobi po satu × 2 osobe × 3 sata, kao i nepoznato trajanje, kroz prijavu, izbor, Dogovor i podržani stari Discovery decoder. D06 ostaje potvrđen; ne traži se ista poslovna odluka ponovo. F13 paralelni profilni upis ostaje sledeći nezavisni R07 posao.

**2026-10-28 — F11 potvrđen GitHub/CI presek.** Implementacioni commit `c2e132fafee521a6dd4d2d4759d6adff67a8f67b` je push-ovan na postojeći draft PR #43. [Puni CI 40699306225](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40699306225), job `122854465627`, završio je **SUCCESS**: 623 mobilna suite-a / 14.275 testova / 3 snapshot-a, TypeScript, Deno, AI/taxonomy, integritet migracija i izolovani SQL. Log `artifacts/r07/20261028-f11-full-ci-40699306225.log`, SHA `c5ccdc1601cfbe3e8c922990e3e1afd9420153c407e11654d52a0df2dc304489`. [Schema CI 40699306268](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40699306268), job `122854466994`, ponovo je **FAIL** sa 13 strict / 62 dopunske razlike; 50 checker testova, application bootstrap/capture i cleanup su prošli. Testirana PR merge projekcija `48d25fe8fec152cecd07a2d3a7ab5e83d99f4172`. Log `artifacts/r07/20261028-f11-schema-ci-40699306268.log`, SHA `e88b5ff609e9bbd56386410f029d05b7143368aaa2018a1f6cb2aa7998dae713`. Ovaj naknadni checkpoint menja samo isti plan, ne testirani aplikacioni/SQL/Edge kod. Izvorni REV10 SHA i kanonski bootstrap SHA ostaju nepromenjeni. R01 nije zatvoren, nema migracije, Supabase isporuke, native/OTA build-a ili merge-a.

**F13 precizan sledeći korak (samo source pregled, nije implementirano).** `prilike/[id]/prijava.tsx` posle uspešne prijave i await čišćenja journala šalje ceo stari `pending.profile.vestine` niz bez nove current provere. Postojeći `workerProfileClientService` čuva account granicu tokom svog poziva, ali hvata nalog tek na ulazu i nema atomarni merge/CAS za veštine; capacityRevision nije verzija veština. Sledeći rad zamrzava samo izričitu nameru za jednu veštinu, početni accountId/accountRevision/profileId i proverava generaciju posle oba await-a. Ograničena operacija u postojećem profilnom servisu mora koristiti potvrđen server merge/CAS, čuvajući paralelnu dopunu; sveže čitanje pa upis celog niza nije dovoljna popravka. Testirati paralelnu veštinu, A→B→A tokom slanja i journal.clear, route/focus, duplikat/granicu liste i uspešnu prijavu uz neuspešan dodatak. Važeći backend autoritet proveriti pre implementacije. Postojeći opt-in test pokriva prikaz, a composer trenutno očekuje stari problematični ceo niz; te testove izmeniti uz stvarnu popravku.

**2026-10-28 — R07/F13: bezbedna sporedna dopuna veštine.** Nastavak sa `4423e0d`, direktno po prethodnom F13 nalazu. Route zamrzava saglasnost za jednu veštinu, početni accountId/accountRevision/profileId i originalnu focus/read generaciju pre prvog await-a. Posle uspešne prijave i journal.clear ponovo proverava tu nameru. Oporavak prijave iz trajnog journala nema novu skill saglasnost; optional namera se troši jednom. Servis sveže čita tačan postojeći skills niz, dodaje samo novu stavku i upisuje uz atomski `WHERE skills = pročitani text[]` i id/account/kind filtere. Pročitane stavke, razmaci, redosled i duplikati ostaju sačuvani. Samo potvrđeni odgovor sa nula redova dopušta jedno novo čitanje/spajanje; druga kolizija, greška, timeout ili neispravan odgovor ne pokreću novi pokušaj. Nema insert/aktivacije profila, migracije ili nove matching saglasnosti. Uspeh prijave ostaje uspeh i kada dopuna nije potvrđena.

**Backend granica proverena bez izmene DEV-a.** Read-only metadata potvrđuje postojeći `skills text[]`, SELECT/UPDATE prava i own-account RLS; svih osam direktnih trigger body hash-eva poklapa se sa sačuvanim bootstrap-om. Dokaz `artifacts/r07/20261028-f13-profile-metadata.json`, SHA `db39e42b08a52a3f02ae0f896e949041adcd0a78ac77528c20f3a002cd690e78`. Nisu čitani poslovni/Auth korisnički redovi. Ova zaštita sprečava da F13 pregazi već sačuvanu paralelnu izmenu; ne tvrdi da je svaki drugi kasniji opšti profilni writer postao CAS writer.

**Lokalno: 4 suite-a / 112 testova PASS; TypeScript PASS.** Pokriveni su opt-out, zamrznuta namera, A→B→A/focus/route tokom prijave i journal.clear, fresh read i cold restore, izgubljena potvrda bez replay-a, konkurentna dopuna, duplikati, granica 50 stavki, sirovi niz/specijalni znaci, owner/profile receipt i uspešna prijava uz neuspešnu dopunu. Nezavisan pregled našao je netačnu poruku „nije dodata” pri neizvesnom upisu; zamenjena je sa „dodavanje nije potvrđeno”, a route suite ponovljen: 48/48 PASS. Jest je uz exit 0 prijavio upozorenje pri završavanju test procesa; nije predstavljeno kao novi native ili live dokaz. R07 i isporuka ostaju otvoreni.

**F13 SDK/SQL dokaz:** [ponovljivi test](../../scripts/f13-skill-cas.test.mjs) transpajlira stvarni servis, receipt guard i validator, koristi instalirani Supabase SDK i prosleđuje njegove dekodirane filtere sintetičkom SQL adapteru u PGlite. Osam scenarija + parent, **9/9 PASS**: tačan text[] filter sa quote/backslash/newline/zarez/braces/NULL/srpskim tekstom, prazan niz, paralelna dopuna, drugi konflikt, pogrešan owner/profile/kind, promena vlasništva i server greška bez replay-a. Korak je dodat postojećem CI-u. To nije stvarni PostgREST parser/RLS/Auth, puna šema sa trigger-ima niti dokaz paralelnih server sesija. Završni lokalni zapis `artifacts/r07/20261028-f13-local-final.json`, SHA `c936dac91d632734b8e36a1850a5e5b7fe83f85217baa8e97ebf257bc151bf95`, vezuje proverene source hash-eve i rezultate. Izvorni REV10 i kanonski bootstrap ostaju na ranije zabeleženim SHA vrednostima.

**2026-10-28 — F13 potvrđen GitHub/CI ishod.** Implementacija `5704fd2900de28ab4546552bf0e399e031a36735` je push-ovana na postojeću granu i draft PR #43. [Puni CI 40707340154](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40707340154), job `122882890877`, **SUCCESS**: TypeScript, Deno, 624 mobilna suite-a / 14.326 testova / 3 snapshot-a, nova F13 SDK/SQL provera 9/9, AI/taxonomy, integritet migracija i izolovani SQL. Log `artifacts/r07/20261028-f13-full-ci-40707340154.log`, SHA `5d3b371b202b4af9f877f1ebef446687aebc8aa64af21991f51fbca542f529f7`.

[Schema CI 40707340115](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40707340115), job `122882890652`, ostaje **FAIL**: 13 strict / 62 dopunske razlike; 50 checker testova, application bootstrap/capture i cleanup su prošli. Testirana PR merge projekcija `0273c2eed1a25bc80030af67dda6fb36f6c019d8`. Log `artifacts/r07/20261028-f13-schema-ci-40707340115.log`, SHA `c8d1f89e25a5dacbffa784a5030b37b5070b5e241ac131bf9ff21b0dee220372`. Kandidati nisu promovisani; nema DEV upisa, migracije, deployment-a, native/OTA build-a ili merge-a. F13 klijentska popravka i ograničeni SQL dokaz su završeni; live Auth/HTTP/native i ceo R07 ostaju otvoreni. Dokumentacioni checkpoint beleži ove završene rezultate, bez promene testiranog izvora i bez ponavljanja CI-a za sam dnevnik.

**2026-10-28 — veći povezani korak R07b/D06 i C01/C02/C05/C06/C18.** Rad polazi od `15c346a`. Standardna satnica 1.200 RSD čuva se kao 1.200 po osobi po satu, od AI činjenice i pregleda preko prijave i kandidata do Dogovora, liste, kalendara, predloga izmene i podrške. Prijava za dve osobe ne pretvara jedinični iznos u 2.400 ili 7.200. Za poznata tri sata matematičko značenje ostaje 1.200 × 2 × 3 = 7.200 RSD; vremenski prozor nije dokaz stvarno odrađenih sati i nije automatski konačni račun. Nepoznato trajanje nema izmišljenu ukupnu sumu.

SQL kandidat [r07_hourly_pricing.sql](../../supabase/candidates/r07_hourly_pricing.sql), reproduktivan kroz generator, dodaje nullable `price_basis` u response i response_versions i menja devet postojećih funkcija uz prehash i atomsko očuvanje OID/owner/ACL/security/config. Nema novog javnog endpoint-a ni rewrite-a istorijskih redova. `TOTAL`/`PER_PERSON` Need zadržavaju raniji obračun aggregate application iznosa; application/Agreement jedinica je `TOTAL|HOURLY`, istorijski NULL je legacy TOTAL. `applicationPriceBasis` je odvojen od trenutne Need osnovice na stranici mojih prijava; Agreement je čuva u `terms.priceBasis`. Novi version hash uključuje jedinicu; postojeći request hash/receipts ostaju i replay prethodi čitanju novog Need-a. KEEP ne može zadržati isti broj uz promenjenu jedinicu; UPDATE zahteva novu potvrdu. Edit-conversation HOURLY seed više ne tvrdi „Ukupno”. Devet relevantnih live body MD5 vrednosti potvrđeno je uskim read-only metadata upitima; DEV poslovni/Auth redovi nisu čitani.

Klijent čuva jedinicu u zamrznutoj nameri/journal metadata, proverenom receipt-u i readback poređenju. Kasnija izmena Need-a ne menja značenje stare prijave; prepoznata pogrešna/missing HOURLY potvrda ostaje neizvestan ishod umesto lažnog uspeha. Stari journal bez metadata ne šalje prvi RPC ako sveža ista Need revizija sada označava drugu jedinicu; ostaje sačuvan bez lažnog uspeha i nudi stvarni izlaz „Otvori moje prijave”, bez pogrešnog slanja na dopunu profila. Različita Need revizija zadržava postojeći replay-first/stale tok. Kandidati sa različitim jedinicama se ne rangiraju kao uporedive cene. Edge prihvata standardnu satnicu po osobi, a izričita ili nejasna timska satnica traži razjašnjenje. Naknadna korekcija „za celu ekipu” povlači staru potvrđenu cenu preko dodatnog ograničenog `UNSUPPORTED_PRICE_BASIS` razloga u postojećem R07a kandidatu. Kasnija nepovezana poruka ne vraća staru spremnost; istorijski potpisani pregledi ostaju netaknuti. Dnevnica, ponavljane smene, RSD saglasnost, currency correction i OFFERS zaštite ostaju.

**Konkretno čišćenje (commit `4401fbd`):** [obavezni zapis po promeni](../cleanup/20261028-c01-c02-c05-c06-c18.json) sadrži sva Z10 required polja, inventar, potrošače i rezultate. C01 uklanja 21 nekorišćeni template resurs; C18 tri hash-identične PNG kopije i prevezuje JS/SVG/provenance/manifeste na aktivni premium-entry. Ukupno 24 fajla / 4.578.117 bajtova manje u repozitorijumu, bez tvrdnje o APK uštedi. C02 uklanja samo quick-pick helper podskup, C05 nepovezani selection registry i privatni stats podskup, C06 tačno jedan identičan test-blok. Aktivni name-adoption, profil, recovery, selection command/readback/journal i public trust ostaju. Uklonjeno je tačno 19 retired/duplih testova; nisu brisane zaštite da bi CI prošao. Pre-change 4 suite-a / 92 testa i post-change 12 suite-a / 372 testa PASS; 61 literal asset import, 12 Expo config putanja i 19 manifest/provenance unosa postoje, generator prolazi.

**Granica isporuke:** ništa iz ovog paketa nije primenjeno na Supabase niti poslato korisnicima. Redosled mora biti compatible schema expand, R07a writer i odgovarajući klijent uz dokazan izlaz za stare klijente, pa aktivacija HOURLY writer-a. Novi klijent traži novu SQL kolonu; stari Discovery decoder može odbiti celu stranu, a stari Agreement prikaz satnicu nazvati ukupnom cenom. Sam Edge deploy nije prihvatljiva isporuka. R01 strict 13 / supplemental 62 razlike ostaju ranije dokumentovan integracioni problem; ne ponavlja se ista istraga. Pun API/uređajski prolaz, migration promotion i native/OTA identitet ostaju otvoreni.

**R07b SQL dokaz završen lokalno:** [scripts/r07b-hourly-chain.test.mjs](../../scripts/r07b-hourly-chain.test.mjs) izvršava tačan candidate, 23 stvarna table shape-a/defaulta/PK-UNIQUE-CHECK i devet menjajućih plus 11 supporting funkcija iz pinovanog bootstrap-a. **25/25 PASS**: submit → oba svoja i candidate čitača → select → Agreement → replay; TOTAL/PER_PERSON/null/OFFERS regresije; stari rows/receipts/verzije nepromenjeni; unit-bound content hash; KEEP/UPDATE u oba smera; auth/owner/revision/price/basis odbijanja; source drift, rollback i metadata guard. Poznati interval 09–12h čuva se uz rate 1.200 i covered_slots=2; 7.200 je proverena računica, ne stored price. Poseban null/null tok dokazuje da se trajanje ne izmišlja. Edit-conversation proverava HOURLY/TOTAL/PER_PERSON seed kroz stvarni četvoroslojni fact validator, odbija tuđi nalog i izmenu posle Dogovora. Eksplicitni fixtures/stubs za lokalni auth identitet, svet, vreme/matching, kalendar, obaveštenja/public profile i strogi REMOTE geography ulaz nisu stvarni RLS/Auth/PostgREST/PostGIS/trigger/concurrency dokaz. Generator `--check` i diff provera PASS. Metadata dokaz `artifacts/r07/20261028-hourly-live-metadata.json`, SHA `e9349dad60f29e67a96215f70db6c0ce510a394bce72ec7c4a06ce5aa677b16a`. Izvorni REV10 SHA `8d74ed652900937b6fa865d1df08246a7769d5a09a4092e571b187f966fb813b` i bootstrap SHA `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f` ostaju nepromenjeni.

**2026-10-28 — source predaja i stvarni bundle dokaz.** Cleanup commit `4401fbd` i pricing commit `ce2b95a770fbe0e2bd7bdfe5e3fd1a510e80952a` push-ovani su na istu granu/draft PR #43. Konačni client focused zbir je 26 suite-ova / 1.239 testova PASS, TypeScript i diff-check PASS. Poslednji composer ima 52/52 i candidate 59/59. Composer je nakon PASS emitovao worker/handle upozorenje; novi journal-negative slučaj zasebno je prošao sa `--detectOpenHandles` bez upozorenja. Upozorenje cele suite nije predstavljeno kao razrešeno.

Android i iOS Metro/Hermes export konačnog source-a imaju exit 0; 1.471 hash-ovana source/asset/config stavka ostala je nepromenjena nakon izvoza. Android bundle SHA `ce518d3b692adf09208907dcd3f952e950c68164a7b0dfe55b9c6ced25605898`, iOS `43477d8e0abd6a07e0520e7427daf12d2259077c515888bf1f89f574981d9a1e`. Receipt `artifacts/r07/20261028-hourly-bundle-receipt.json`, SHA `171421e0a11aaca1c68532fe29e8156c6d2a24745914cb1391f5d4bac04974a8`, vezuje logove, assetmap, metadata i source manifest. Ovo dokazuje lokalno sastavljanje bundle-a/asset-a, ne instalaciju, native runtime, izgled na telefonu ili prodaju u prodavnici. C01/C18 native prihvat ostaje otvoren.

[Schema CI 40718314171](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40718314171), job `122921960955`, za novi source ostaje **FAIL** sa tačno 13 strict / 62 supplemental razlike; 50 checker testova, application schema/capture i cleanup PASS. PR merge projekcija je `83882308d783e2120d337ea130830b8e0cbe23a4`. Log `artifacts/r07/20261028-hourly-schema-ci-40718314171.log`, SHA `76377fcd306fa816eea5bfd39a6a6f02cc4902bb52e70280de1b3a00dfda2fd5`. Nije uveden izuzetak niti ponovljena ranija dijagnostička istraga; fixtures/Auth/PostgREST/kandidati nisu izvršeni u tom okruženju. Puni source CI je zasebno potvrđen ispod.

**2026-10-28 — konačan CI rezultat većeg paketa.** [Puni CI 40718314704](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40718314704), job `122921963716`, za source `ce2b95a770fbe0e2bd7bdfe5e3fd1a510e80952a` je **SUCCESS**: 622 mobilna suite-a / **14.352 testa** / 3 snapshot-a, TypeScript/Deno, F13 SDK/SQL 9/9, R07b actual candidate SQL 25/25, AI/taxonomy, migration integrity i izolovani privacy/bootstrap testovi. Log `artifacts/r07/20261028-hourly-full-ci-40718314704.log`, SHA `792da3e20c8adb1dafc5dc90d586b67eeaed3e1a72c8855667c044447d542d42`. Smanjenje broja suite-ova odgovara tačno dva povučena retired test fajla iz C02/C05; aktivne zaštite ostaju i ukupan broj testova je porastao. Posle uspešnog CI-a menja se samo ovaj zapis rezultata, sa skip-ci oznakom i bez novog izvršavanja nepromenjenog koda. Nema Supabase upisa/migracije, Edge deploy-a, native build-a, OTA, merge-a ili tvrdnje da je ceo R07/R11 zatvoren. Sledeći posao je stvarni integracioni i kompatibilni rollout dokaz naveden ispod, uz preostale nezavisne C pakete po njihovim preduslovima.

**2026-10-28 — drugi veći krug čišćenja C03/C04/C07/C08/C09/C12 i R01 inicijalizacija.** Polazni source `17c58fc`. C03 povlači neaktivni ručni fact editor; aktivni prikaz, satnica i korekcija u istom razgovoru ostaju. C04 povlači neupotrebljene delove kartica i rasporeda, uz odvojene aktivne requester/worker kompozicije. C07 povlači napušteni BrandScene/V49/intro; aktivni EntryWelcome, rasteri i font generator ostaju. Ciljane provere izmenjenih UI delova: 182/182 PASS; šire aktivne zamene: 385/385 PASS; 37 aktivnih deklaracija sadržajno nepromenjeno. Ove brojke nisu zbir nezavisnih suite-ova.

C08 uklanja V1 AI portove/override/fake lanac i jedinu preostalu V1 implementaciju u centralnom izvoru; aktivni V2 review/Save/publish, druge komande i demo reset ostaju. C12 povlači nepovezani GPS i notification prototip, uz očuvan native GPS, exact-location grant i push. Zajedno 13 uklonjenih fajlova, 97 isključivo zastarelih test slučajeva; **24 suite-a / 1.046 aktivnih testova PASS**, TypeScript PASS. [Obavezan C08/C12 zapis](../cleanup/20261028-c08-c12.json) sadrži izvorne hash-eve, tačne retirane slučajeve, zamene i granice.

C09 uklanja pomoćni klasifikacioni builder bez produkcionog potrošača, njegovih 12 sintetičkih testova i zamenjuje eksplicitni CI poziv. [Nova provera](../../supabase/proofs/dynamic_taxonomy/classification-active-review.test.mjs) izvršava tri funkcije i četiri table deklaracije doslovno iz neizmenjenog tekućeg bootstrap-a: **13/13 PASS**, bez SQL function stub-ova. Uz 19 direct-reply i 11 alias provera, **43/43 PASS**. Svaki stari slučaj mapiran je u [C09 zapis](../cleanup/20261028-c09.json); postojeći registrovani aliasi ostaju dozvoljeni, novi predlog nije postojeći identitet, BOTH zadržava oba para. Izolovana SQL proba nije Auth/HTTP/Save/binder ili dokaz konkurentnog redosleda objave; R04 nije zatvoren.

R01 sada ima hash-guarded izgradnju tačno pinovanog CLI upstream source-a sa izostavljenom samo jednom konkatenacijom legacy webhook template-a **pre stvaranja prazne baze**. Nema naknadnog DROP-a, izmene managed owner/ACL-a, promene originalnog bootstrap-a ili očekivanih fingerprint-a. Runner proverava poreklo binarnog fajla, odsustvo dodatih hook objekata i stvarni SECURITY INVOKER pg_net status. **53 checker testa i source admission PASS**. GitHub workflow gradi taj binary i tek potom izvodi isti bootstrap/strict/supplemental pregled; novi runtime rezultat još nije potvrđen. Ne proglašavati samu pripremu rešavanjem preostalih platformskih razlika.

**2026-10-28 — prvi zajednički CI novog kruga i završni bundle dokaz.** Source `abc0f70e6d10c0c4b295fc75f71b0c195c1fcae9` objavljen je u istom draft PR #43. [Puni CI 40730103171](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40730103171) završio je FAIL: TypeScript/Deno PASS, mobilni testovi **613 suite-a / 14.114 PASS i jedan FAIL** od ukupno 614/14.115. Jedini neuspeh je `glyph-import-guard`: reviewed adapter spisak još navodi `TaskFace.tsx`, iako njegov uklonjeni interni CardNext više ne uvozi Phosphor. Ispravka uklanja zastarelu stavku iz spiska, bez širenja izuzetaka. Testovi posle tog koraka nisu izvršeni u ovom run-u. Sačuvan log `artifacts/cleanup/20261028-second-full-ci-40730103171.log`, SHA `d16010bd0ca5ca663bccd9389a0ab6092e0af806294105a5488451bcbac923e2`.

[Schema CI 40730103178](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40730103178) nije stigao do baze: hash-guarded Go build je prošao, ali `CLI_START_HELP` nije, jer stvarni pinovani v2.116.0 start/stop/services put vodi kroz TypeScript/Bun shell; sam Go sidecar nema start komandu. Prvi izbor vlasnika bio je pogrešan. Ovaj run nije novo parity, Auth/HTTP ili candidate izvršenje i ne menja poslednji validan 13/62 nalaz. Sačuvan log `artifacts/cleanup/20261028-second-schema-ci-40730103178.log`, SHA `01e6b2c6556bd7e3a65e3e8de9d29a490864c56d33e97611a201a807dbb27f57`. Sledeća izmena cilja stvarni startup i dokazuje komandni put pre pokretanja baze; isti neuspešan ulaz se ne ponavlja.

Završni Android/iOS Metro/Hermes izvozi novog klijenta su **PASS**: 50,443 s / 49,212 s; svih **848 runtime source/asset/config hash-eva** ostalo je nepromenjeno. [Potvrda izvoza](../../../verification-output/cleanup-second-20261028-165150/CLEANUP_SECOND_BUNDLE_RECEIPT.json), SHA `0fe776822818c754c3f3758e782255ca1765e8a57a473b37bc7fb47f077d2206`; Android HBC `ef2639a75159864fb99d1dfded11da9c5c078ab0713fa8fee69fc6868bdf78be`, iOS `8df32394e1a3785aa2ab6862f527f6e67daa658f2d33e2729902d732a7e0c283`. Ovo potvrđuje bundle/asset rezoluciju; native build, telefon i OTA nisu izvedeni. [C03/C04/C07 zapis](../cleanup/20261028-c03-c04-c07.json) dopunjuje C08/C12 i C09 zapise. Zajednički Edge import graf: 12 ulaza, 46 lokalnih fajlova, 71 veza, nijedan nedostajući import ili potrošač povučenog builder-a.

**2026-10-28 — ispravke prema stvarnim CI neuspesima.** Glyph guard sada uklanja samo zastarelu `TaskFace` stavku; **78/78 glyph/token i 49/49 auth-scale testova PASS**. Konačna razlika mobilnih slučajeva je 237: C03/C04/C07 138, C08 23, C12 74 izričita i dva automatska `auth-scale` slučaja za uklonjeni `notificationAsk.ts`. Sam dinamički guard je nepromenjen; izvorni inventar 24→23 daje 51→49 slučajeva. Per-change zapisi beleže oba tipa, pa 97 označava izričite, a 99 celokupnu C08/C12 razliku. Nema uklanjanja padajućeg aktivnog testa.

R01 priprema sada koristi stvarni put `legacy/main.ts → cli/main.ts → legacyRoot → start.command.ts → legacyStart → legacyStartDatabase → legacyBuildPostgresStartContainerSpec`. U pinovanom `postgres.service.ts` izostavlja se samo 41-bajtna konkatenacija webhook template-a; Go source je nepromenjen sidecar. Bun 1.4.0/pnpm 11.4.0/toolchain i source hash-evi su pinovani. Build mora izvršiti originalni i popravljeni stvarni Docker spec, potvrditi da je jedina razlika izostavljeni webhook SQL, zatim proći `start/stop/services --help` pre rezultata BUILT. **54 checker testa i source admission PASS**; stvarni Linux build i nova baza još čekaju novi CI. Izvorni bootstrap i strict/supplemental comparator ostaju isti. U [uslovima uskog R01 dokaza](../../supabase/proofs/privacy/runtime/r01-relevance.md) ostaje `NOT ADMITTED` uz novi read-only dokaz hosted uloge; taj dokument nije waiver niti zatvoren Auth/HTTP dokaz.

**2026-10-28 — kompletan klijentski prolaz i stvarni TS/Bun runtime.** Source `86deb1eddeece755021d5f8907f85ae29c4579c3` ima [puni CI 40732062408](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40732062408) **SUCCESS: 614 suite-a / 14.115 testova / 3 snapshot-a**, uz TypeScript/Deno, F13 SDK/SQL 9/9, hourly candidate SQL 25/25, AI/taxonomy uključujući novi C09, integritet migracija i izolovane privacy/bootstrap provere. Log `artifacts/cleanup/20261028-second-full-ci-40732062408.log`, SHA `52c71ad3d6e62ffcbe90a24a7a5070afb8d9b4dba99be0e94367c3ff2aff151d`. Svih 848 export-manifest runtime hash-eva ponovo odgovara završnom klijentu posle test-only ispravki.

[Schema CI 40732062562](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40732062562) potvrđuje aktivni TS/Bun build, stvarni Docker spec pre/posle, `start/stop/services --help`, ceo stack i pinovane servisne migracije. Zaustavio se pre application DDL-a na prejakom `NO_LEGACY_WEBHOOK` guard-u: tekući DEV legitimno ima `extensions.grant_pg_net_access` i `issue_pg_net_access`, pa njihovo obavezno odsustvo nije stvarni ugovor. Raniji kod nije sačuvao booleans pre assert-a; njihove konkretne disposable vrednosti nisu poznate i ne izvode se iz neuspeha. Log `artifacts/r01/20261028-cli-active-shell-ci-40732062562.log`, SHA `356054a93c8ba2e8a49e69010a90cbd929b6ffa4b3c1b8de82a58f76d14ce9ef`. Ovaj run nije novi strict/supplemental rezultat.

Sledeća uska korekcija poredi stvarnu read-only snimljenu managed helper/trigger definiciju i pg_net režim, zapisuje opaženo pre odluke i dozvoljava da se neizmenjeni strict/supplemental dijagnostički capture završi pre finalnog FAIL-a. To nije waiver ili dozvola za fixture/Auth/HTTP: svaka relevantna razlika i dalje ostaje neuspeh, a nijedan managed objekat se ne menja. Posle ovog ograničenog dijagnostičkog prolaza nastaviti prema konkretnim dokazima, bez nagađanja novih očekivanih vrednosti.

**2026-10-28 — konačan ishod većeg cleanup/runtime kruga.** Source `b98ef389fe65bd19ffa047edbb82c4ff0c1aee5a` i PR merge checkout `552984f47ba514f1d3f2408b0e2945d607176f86` imaju [puni CI 40734402563](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402563) **SUCCESS**: 614 suite-a / 14.115 testova / 3 snapshot-a, TypeScript/Deno, F13 9/9, hourly SQL 25/25, AI/taxonomy uključujući C09, migration integrity i privacy/bootstrap. Sirov log `artifacts/cleanup/20261028-second-full-ci-40734402563.log`, SHA `37dfe325e97457a86aa3f427d0dff86e319d4fa9bd56d2063ee4694233a741cf`. C03/C04/C07/C08/C09/C12 imaju source, ciljane provere, kompletan CI, per-change zapise i Android/iOS bundle dokaz; native/release prihvat nije zatvoren. Ovaj krug povlači 24 fajla i 237 isključivo napuštenih mobilnih test slučajeva; korisne provere ostaju ili su prevezane na stvarne vlasnike. C09 posebno zamenjuje 12 sintetičkih slučajeva sa 13 provera stvarnog SQL/Edge koda.

[Konačni schema CI 40734402209](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402209), job `122978935160`, izvršio je 56 checker testova, poreklo/build stvarnog CLI-a, kompletan stack, application DDL, strict/supplemental/native-hook capture i cleanup. Završni rezultat ostaje **FAIL**: strict **8** umesto 13; supplemental **49** umesto 62; zaseban native hook ima tri različita polja `helper.config_md5`, `helper.body_md5`, `helper.definition_md5`. Legacy schema je odsutna i oba pg_net HTTP postupka su INVOKER. Nema novih application strict razlika; supplemental 49 odnosi se isključivo na owner/ACL hash-eve 49 extension routine-a, bez razlike poređenih effective boolean prava. Preostalih osam strict identiteta razvrstano je u aktuelnoj tabeli iznad. Log `artifacts/r01/20261028-cli-native-hook-ci-40734402209.log`, SHA `d8067ec26695f600e5810569298e1cab37869b28956f3413dc4517a65c431212`.

Native helper sada ima dokazano poreklo u pinovanoj Postgres migraciji; tekstualna razlika verzijskog literala `'0.8'` prema `'0.8.0'` odgovara opaženim body hash-evima, a config je native NULL prema DEV eksplicitnom praznom search_path. To objašnjenje nije prihvat relevantnosti niti dozvola za prepisivanje managed funkcije. [R01 relevance zapis](../../supabase/proofs/privacy/runtime/r01-relevance.md) čuva precizne sledeće preduslove. Strogi comparator, originalni bootstrap SHA `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f` i postojeći fingerprint-i nisu menjani. Fixture/Auth/HTTP/candidate/live access ostaju neizvršeni; DEV je samo čitan kroz metadata upite, bez promene poslovnih/Auth redova, migracije ili Edge deployment-a. PR ostaje draft. Završni docs-only checkpoint sa skip-ci oznakom čuva ovaj provereni kod.

#### Sledeći dozvoljeni korak i pravilo nastavka

1. Poslednji stvarni runtime `40734402209` ima 8 strict / 49 supplemental / 3 native-hook hash razlike. CLI startup je sada izvršen i ne ponavlja se njegova završena popravka. Sledeći vlasnik je postojeći native Postgres CREATE EXTENSION helper: dokazati poreklo i izvršne zavisnosti verzijskog literala/search_path delte, zatim upariti hosted-role dependency i efektivni admin search_path sa disposable podacima prema `r01-relevance.md`. Dopuniti usku R01 relevantnost svakog preostalog identiteta; ne uvoditi blanket waiver, prepisivati managed objekte ili closure sertifikate, niti menjati očekivani hash radi prolaza. Sačuvati strict FAIL ako se kasnije dozvoli samo ograničena granica. Ne ponavljati iste startup/audit pokušaje bez novog ulaza. Tek posle dokazane relevantne granice napraviti sintetičke naloge i fixtures: dva naloga istog sveta, drugi svet i zatvoren/anon/nevažeći/istekli slučaj, bez DEV poslovnih podataka. Plaćeni branching se ne ponavlja bez promene uslova; metadata capture nije HTTP PASS.
2. Izvršiti R01 negativne i pozitivne API kontrole i stvarne čitače/dekodere prema [privacy README-u](../../supabase/proofs/privacy/README.md), uključujući legitiman owner/participant, Home, Discovery, legacy/exact i close-search. Zabeležiti pre/post ACL i closure posledice bez prepisivanja očekivanog digest-a radi prolaza. Razrešiti podržane native/OTA čitače ili kontrolisano odbijanje nekompatibilnog čitača.
3. Tek sa relevantnim dokazom promovisati usku promenu kroz `supabase migration new`, sačuvati novu migraciju i poznat kandidat za GitHub/CI/DEV proveru. Za svaki push, PR, CI, migraciju, build ili OTA posebno upisati stvarni identitet i ishod; lokalni commit nije isporuka aplikacije. Preostali širi R01 ugovori ostaju vidljivi i ne zatvaraju se samim F21 prolazom.
4. Nastaviti R02 i R03 prema njihovim zavisnostima, koristeći postojeće vlasnike; F17 ne zatvara celokupan R02. R12 skuplja dokaz od svake završene vertikale. Posle svakog stvarno završenog ili blokiranog koraka dopuniti **ovaj odeljak**, status odgovarajućeg R/F/J/SB/X/C zapisa i sledeći korak. Ne stvarati novi master plan, ne prepisivati istorijski rezultat i ne označavati neizvršeno kao PASS.
5. F13 i R07b source rad ne ponavljati. Sledeći R07 korak je kompletan signed review/accept/Save/publish i replacement dokaz, uz R07a i R07b candidate u relevantnom izolovanom Auth/HTTP okruženju, pa koordinisan schema/client/Edge rollout i uređajski prolaz. D06 i D08 ostaju potvrđene odluke. Održati razliku između ukupnog application iznosa i hourly rate-a; ne uvoditi automatski račun iz procenjenog trajanja.
6. C01–C09/C12/C18 imaju source promene (11/19); novi krug ima završene bundle i pune CI provere, pa se njegovo čišćenje ne ponavlja. Preostaju C10/C11/C13/C14/C15/C16/C17/C19 (8) i SV01–SV14 (14), uz zaseban native/release prihvat prethodnih izmena. To uključuje aktivne AI strategije, PHONE kompatibilnost, javne komentare, preostale stare testne ugovore, proof/kandidat katalog i build katalog; nisu svi preostali ciljevi slobodni za brisanje. Birati povezane pakete po tačnim preduslovima, bez povlačenja istorije ili server objekata samo radi čišćenja. Već popravljene R07 currency/hourly provere pod C15 ne ponavljati.

### Prenos za nastavak bez starog računara — 28.10.2026.

- U `docs/continuation/payload/` sačuvana su oba neizmenjena originalna ZIP-a i 155 dodatnih izvršnih dokaznih fajlova; ukupno 305 fajlova unutar tri arhive. Manifest beleži SHA-256/veličinu svakog člana i arhive. Ovo je prenos dokaza, ne dodatno završena R/C/SV grupa.
- `docs/continuation/NASTAVAK_RADA.md` sadrži tačan repo/granu/PR, obnavljanje, mapu istorijskih putanja, potvrđene odluke, proverene rezultate, otvorene granice i detaljnu komandu za nastavak. Jedini master plan ostaje ovaj dokument.
- Objavljeno na radnoj grani u commitu `b097e3d58224721117b4ce688391cc9f7803009b`; zatim novi GitHub clone bez lokalnih Git objekata uspešno preuzeo paket i obnovio svih 305 fajlova. Dokaz dopunjen u `docs/continuation/VERIFICATION.json`.
- Provera prenosa: PASS u nezavisnom privremenom folderu, svih 305 fajlova; ponovni poziv 0 upisa; konflikt/oštećenje/traversal odbijeni. Izveštaj: `docs/continuation/VERIFICATION.json`. Aplikacioni CI nije ponavljan zbog pakovanja dokaza; prethodni runtime rezultat ostaje odvojen.
- `restore.py` proverava sve bajtove pre pisanja, odbija izlazak iz ciljnog foldera i različite postojeće fajlove. Nalozi/secrets se povezuju zasebno; node_modules i generisani Hermes/asset izlazi nisu arhivirani. Njihovi receipts, source manifesti i logovi jesu. Ne tvrdi se da je prenet ceo računar ili instalaciono izdanje.
- Repozitorijum je javan; opseg pregleda mogućih tajni i izuzeci zapisani su u manifestu. SQL kandidati nisu deployovani, PR nije spojen, postojeći strict schema FAIL ostaje FAIL. Sledeći implementacioni korak ostaje uska R01 native helper provenance/dependency provera iz prethodnog zapisa.


### Izvršni dodatak R01 — native pg_net provenance/dependency, 28.10.2026.

- **Owner/status:** R01/F21 — `IN_PROGRESS`. Ovo je uska read-only DEV provera i proverljiv izvor za parni disposable dokaz, ne R01 admission, R/C paket DONE, migracija ili popravka aplikacije. Potvrđeni početak rada je HEAD `7be5a6485bd134a8f91aa48efc230579d129f1ed`; izmenjeni source na `work/rev14-review-f17` je commit [`6315732660ca790a47bd1bdc56202af90984cb96`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/6315732660ca790a47bd1bdc56202af90984cb96), povezan sa draft PR #43. GitHub je potvrdio novi remote HEAD; osnovna grana i originali paketa nisu menjani.
- **Promena:** dodati `supabase/proofs/privacy/runtime/native-net-provenance.sql` (isključivo `BEGIN TRANSACTION READ ONLY` i katalog), `native-net-provenance-expected.json` (tačno zabeležen DEV baseline), `native-net-provenance.mjs` (strogi schema/izvorni hash i fail-closed comparator) i `native-net-provenance.test.mjs` (pozitivna i adversarial pokrića). Postojeći `runtime/run.mjs` čita i emituje scrubbed native dokaz, proverava očekivani SQL SHA i upoređuje ga **posle** postojeće strict/supplemental/managed-hook dijagnostike. Provera ne menja dozvole ni owner-e; odbija nepoznate/missing polja, izvornu funkciju, verziju, event, dependency, invoker i config drift. `.github/workflows/r01-disposable-schema.yml` uključuje novi test i izdvojene artefakte; originalni strict comparator i njegov FAIL gate nisu oslabljeni.
- **DEV metadata-only izvršenje:** projekat `leqcwgzvjsxugfgzdmth`, PostgreSQL 17.6 / `server_version_num=170006`. Izvršen upravo novi read-only SQL preko povezanog Supabase naloga, bez poslovnih/Auth redova, migracije ili Edge. Izvor `extensions.grant_pg_net_access()` ima SHA-256 `754e58111dbe32030af4d91591dfd78cb3cf8e8f4f56a5fcc199bb0cf7f4ac2b`; nakon **jedne** zamene verzijskog literala `'0.8.0'`→`'0.8'`, SHA-256 `55abda380efd46b37b26d3c6e4f3b514e28b7c7c1df44f5ae0315ece4052370d` (raniji native MD5 `53257458358d6f67987b20099abdb9d4` potvrđen). `pg_net` je `0.20.4`, nijedan stari legacy ogranak nije aktivan, helper je `SECURITY INVOKER`; event trigger je isključivo `ddl_command_end`/tag `CREATE EXTENSION` i pokazuje na helper. Tačno jedna zabeležena `pg_depend` veza je taj event trigger. DEV helper `config_kind=EMPTY_SEARCH_PATH` naspram predviđenog native `INHERITED`; ovo nije automatska dozvola za izjednačavanje putanje. Baseline čuva tačan novi SQL SHA-256 `f3e58d5bd6fc69628fcf7b17fbdaf95900d4ac7db6f24a44588ed279e6a512f1`.
- **Dodatna uska DEV provera:** namespace `supabase_admin`, `$user` i literalni `\\$user` nisu prisutni; `supabase_admin` ima postojeći all-database role `search_path="$user", public, auth, extensions`; nije nađen zaseban database-specific override. Ovo je samo DEV opažanje; parni disposable proof/effective-path tvrdnja nije još uspostavljena, niti sama `pg_depend` pretraga isključuje dinamički SQL.
- **Uloga hosted-login — naknadni read-only katalog DEV:** `cli_login_postgres` ima jedino jedno članstvo u `postgres` (NOINHERIT, SET dopušten, bez admin option), bez direktnih shared-object zavisnosti (`pg_shdepend=0`). `anon`, `authenticated`, `authenticator`, `service_role`, `postgres` i ostale neprivilegovane servisne uloge nemaju `USAGE` niti `SET` prema hosted-login ulozi; četiri stvarna request principala imaju 0 SET putanja. **Važan izuzetak:** `supabase_admin` je DEV superuser i `pg_has_role(...,'USAGE'/'SET')` za hosted-login vraća true, iako nema direktnog admin membership zapisa. Zato dokaz o nerelevantnosti login uloge mora biti ograničen na stvarne request principale; ne sme tvrditi da hosted login nije dostupan nijednom administratoru. Nepostojanje `pg_shdepend` nije samo po sebi dokaz da ne postoji dinamički SQL. Disposable uparivanje, stvarni effective-path i ownership/ACL ostaju neizvršeni.
- **Provere/ograničenja:** lokalna izolovana `node --test` provera novog checkera: **4/4 PASS** (pozitivna, izvorna SHA-binding i negativna kontrola). To nije puni checkout `npm ci`, jer u ovom izvršnom okruženju nema direktnog GitHub/Docker pristupa potrebnog za restore/runtime. GitHub PR je pokrenuo `R01 current disposable schema parity` [run 40740337781](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40740337781) i full CI [run 40740337761](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40740337761); oba su u trenutku ovog zapisa `IN_PROGRESS`, pa se ne tvrdi PASS. Raniji strict **8 / supplemental 49 / native-hook 3 = FAIL** ostaje poslednji završen runtime nalaz; Auth/PostgREST/fixtures/candidate/uređaj/prodavnica ostaju `UNPROVEN`. Canonical bootstrap i njegove raw CRLF bajtove, očekivane fingerprints, postojeće closure receipts i originalne REV10/REV14 dokaze ovaj commit nije dirao.
- **Prvi sledeći vlasnik/korak:** pročitati novi CI ishod i odvojeni `R01_NATIVE_NET_PROVENANCE_COMPARISON` dokaz; tek zatim dokazati stvarnu *effective* `search_path` vezu i runtime zavisnosti na disposable strani (bez blanket waivers), upariti DEV hosted-login role dependency, 8 storage grant-option owner bitova i 49 extension-routine owner/ACL uz tačan izvorni/body/config/EXECUTE obuhvat prema `r01-relevance.md`. Ne otvarati synthetic Auth/HTTP dok R01 boundary prerequisites nisu dokazani. Ako strict i dalje pada, ostaviti originalni FAIL i zasebno zabeležiti eventualni uski rezultat; nijedan source-only PASS ne sme ga preglasati.


### Izvršni dodatak R01 — uparivanje hosted-login zavisnosti, 28.10.2026.

- **Polazište i potvrda prethodne celine:** prethodni native provenance source `6315732660ca790a47bd1bdc56202af90984cb96`; [full CI 40740337761](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40740337761) je **SUCCESS**. [Schema CI 40740337781](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40740337781) je **FAIL**, sa istih 8 strict / 49 supplemental / 3 native helper field razlika. **Novi zasebni `R01_NATIVE_NET_PROVENANCE_COMPARISON` je `provenance_verified=true`, 0 razlika** (pinned native source, verski uslov, event i jedina katalogizovana zavisnost). Ovo nije `METADATA_EQUAL` ni dozvola za Auth/HTTP; kompletan R01 i strict gate ostaju otvoreni.
- **Nova konkretna celina:** commit [`6acaa90b3578e323ef6ea2914788ad44b454b4b8`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/6acaa90b3578e323ef6ea2914788ad44b454b4b8), `work/rev14-review-f17` / draft PR #43. Dodati `supabase/proofs/privacy/runtime/hosted-login-dependency.sql` (read-only PG katalog), `hosted-login-dependency-expected.json` (tačno opažen DEV ugovor), `hosted-login-dependency.mjs` (strogo odvajanje DEV role-present i disposable role-absent slučaja, obavezna lista request principala), i `hosted-login-dependency.test.mjs` (pozitivne i adversarial kontrole). Postojeći `run.mjs` izvršava novu proveru **posle application bootstrap i potpunog strict/supplemental capture**, zato literal scan uključuje aplikaciona tela. Poseban rezultat `R01_HOSTED_LOGIN_DEPENDENCY_COMPARISON` je u runneru i artefaktima; originalni strict comparator, metapodaci, canonical bootstrap i existing managed hook checks nisu menjani.
- **DEV čitanje stvarnim novim SQL bajtovima iz commita:** konekcija `leqcwgzvjsxugfgzdmth`, `transaction_read_only=on`, PG17.6, SQL SHA-256 `5eef1e82ea40ba6365608182b923f408863f9976ed48ae8123f5e386410cede1`. `cli_login_postgres` je prisutan, `LOGIN=true`, sve ostale privilegovane flags false, `NOINHERIT`. Postoji jedino članstvo `cli_login_postgres`→`postgres` sa `SET=true`, `INHERIT=false`, `ADMIN=false`. `pg_shdepend=0`, role-settings za hosted-login=0, eksplicitni literalni pomeni u pregledanim rutinskim izvorima=0. Svi `anon/authenticated/authenticator/service_role/postgres` i ostale neprivilegovane registrovane servisne uloge imaju `USAGE=false` i `SET=false` prema hosted-login; **`supabase_admin` ima `USAGE=true/SET=true`** kao privilegovani administrator. Stari opšti iskaz „niko ne može preuzeti hosted-login” nije dozvoljen. Sken literalnih pomena i `pg_shdepend` ne isključuju dinamički SQL/posrednu runtime zavisnost.
- **Provera:** lokalno `node --test hosted-login-dependency.test.mjs`: **5/5 PASS** (DEV contract i query binding, pozitivna disposable hipoteza, JSONB key-order, negativni privileges/membership/dependencies i fail-closed schema). Ovo je lokalni izolovani test, ne reprodukovan runner/HTTP rezultat. U GitHubu pokrenuti [Schema CI 40742373148](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40742373148) i [full CI 40742372980](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40742372980) za source `6acaa90b3578e323ef6ea2914788ad44b454b4b8`; oba su pri ovom zapisu `IN_PROGRESS`. Ne proglašavati njihov rezultat unapred. Sva live/DEV business/Auth tela, migracije, dozvole i Edge ostali su netaknuti.
- **Naredni korak i granica dokaza:** sačekani CI završetak pročitati po stvarnim `R01_HOSTED_LOGIN_DEPENDENCY_COMPARISON` poljima, upisati njegov ishod i korekciju ako treba. Čak i PASS je samo upareno odsustvo neoperativne hosted-login uloge u disposable okolini, nije waiver. Sledeća uska R01 grupa: dokazati stvarni effective `supabase_admin` search_path i preostale Storage owner grant-option / 49 extension-routine owner/ACL zavisnosti. Nakon toga zaseban `R01_BOUNDARY_PREREQUISITES` po `r01-relevance.md`, uz neizmenjen strict FAIL, pre sintetičkog Auth/PostgREST prolaza. Ako nema admissible granice, zabeležiti tačan blocker i nastaviti nezavisne R/C poslove.


### Izvršni dodatak R01 — admin search_path granica, 28.10.2026.

- **Završeni prethodni CI:** source `6acaa90b3578e323ef6ea2914788ad44b454b4b8`: [full CI 40742372980](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40742372980) **SUCCESS**; [schema CI 40742373148](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40742373148) **FAIL** sa istih **strict 8 / supplemental 49 / native helper 3** razlika, bez Auth/HTTP, bez kandidata i bez live pristupa. Međutim, zasebni read-only `R01_HOSTED_LOGIN_DEPENDENCY_COMPARISON` je **`provenance_verified=true`, 0 razlika** nakon uparenog DEV i disposable izvoda; `R01_NATIVE_NET_PROVENANCE_COMPARISON` ostaje `true`, 0. To potvrđuje samo uska dva preduslova, **ne** R01, metadata equality ili generičku sigurnost svih dynamic-SQL putanja.
- **Nova source celina:** commit [`acdc421c725509b43821dc64323597972e82584b`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/acdc421c725509b43821dc64323597972e82584b) na `work/rev14-review-f17`, postojeći PR #43. `admin-effective-path.sql` radi isključivo read-only metadata capture, **ne radi SET ROLE ni SET search_path** i koristi kvalifikovane `pg_catalog` reference. DEV se čita preko postojećeg read-only kataloškog principala; disposable ga izvršava kroz postojeći `sql(...,'supabase_admin')` da dobije stvarni `current_schemas(false)`, sa očekivanjem tačnog reda `public/auth/extensions`. Dodati uski `admin-effective-path-expected.json` i fail-closed `admin-effective-path.mjs`, testovi, receipt i odvojeni workflow artefakti. Strict comparison i managed object/hash/fingerprint guard nisu menjani.
- **Tačan DEV metadata upit iz commita:** `leqcwgzvjsxugfgzdmth`, `transaction_read_only=on`, `server_version_num=170006`, role `supabase_admin` postoji kao superuser, ima 2 role config zapisa (1 `search_path`), uključuje `$user` i redosled `public, auth, extensions`, 1 all-DB setting, 0 database-specific overrides, sve tri šeme postoje i admin ima USAGE; 0 potencijalnih shadow namespaces. Query SHA-256 `1c0509fc0ec559b35b3fdfb89d2b70a9f572fa2d76ffccd34d374c81ef4046f9`. **DEV effective path pod stvarnom hosted `supabase_admin` sesijom nije izvršen** jer povezani read-only izvršilac nije taj principal. Izolovani runtime proverava stvarnu admin sesiju, ne izjednačava sirove stringove.
- **Izolovane provere/limit:** `node --test admin-effective-path.test.mjs` **4/4 PASS** sa pogrešnim redosledom/extra schemom/role/config negativnim kontrolama. Pokrenuti [schema CI 40743573733](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40743573733) i [full CI 40743573685](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40743573685) za `acdc421c...`; oba su u trenutku ovog zapisa `IN_PROGRESS`. Nema nove migracije, publikacije, Auth/HTTP testiranja, DEV poslovnih redova ni izmene managed roles/ACL/closure. Preostaje tačna parna provera runtime-a i dalje stvarni Auth/PostgREST prove.
- **Naredni korak:** iz završnog CI pročitati `R01_ADMIN_EFFECTIVE_PATH_COMPARISON` i reagovati samo na stvarnu novu deltu (bez ponavljanja prošlih diagnostika). Zatim za Storage owner grant-option i 49 extension rutina proveriti precizne ACL/grantor/grantee tuple i održati jednakost izvršnih privilegija i source/SECURITY INVOKER obuhvata. Direktni DEV metadata pregled 49 rutina: pgcrypto 36, uuid-ossp 10, pg_stat_statements 3; 0 SECURITY DEFINER; to nije parni acceptance niti dozvola za blanket waiver. Pre R01 `BOUNDARY_PREREQUISITES` i sintetičkog Auth/HTTP prolaza potrebno je izričito razrešiti sve preostale identitete i dynamic-SQL rizike, uz zadržavanje originalnog strict FAIL u receipts.


### Potvrda R01 admin putanje i ACL istrage — 28.10.2026.

- [Schema CI 40743573733](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40743573733) za source `acdc421c725509b43821dc64323597972e82584b`: overall **FAIL** zbog nepromenjenih 8 strict / 49 supplemental / 3 native helper polja. **Odvojeni `R01_ADMIN_EFFECTIVE_PATH_COMPARISON` je `effective_disposable_path_verified=true`, 0 razlika**; stvarna izolovana sesija `supabase_admin` ima samo `public/auth/extensions` u utvrđenom redosledu. Prethodni native-hook i hosted-login uski preduslovi su ponovo **true/0**. DEV podaci admin putanje jesu kataloški, ne stvarna hosted admin sesija. Nisu kreirani Auth nalozi, fixture, HTTP, kandidat, migracija niti live deployment; originalni schema FAIL ostaje.
- [Full CI 40743573685](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40743573685) je pri ovom zapisu **IN_PROGRESS**; ne tvrdi se završni PASS. Svi prethodni testovi za `6acaa90b...` imali su [full CI 40742372980](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40742372980) **SUCCESS**.
- Nova read-only DEV analiza preostalih 49 extension-routine ACL razlika obuhvata `pgcrypto` 36, `uuid-ossp` 10 i `pg_stat_statements` 3, bez SECURITY DEFINER; eksplicitne ACL stavke po tim grupama su 108/30/8. Za sve 49 postoje privatnosti bezbedni normalizovani request-grant fingerprinti; `pg_stat_statements` ima jednu rutinu bez PUBLIC direktnog EXECUTE. To su **samo DEV podaci** i ne impliciraju parni disposable prolaz. Sledeći owner je provereni per-routine owner/grantor/grantee/EXECUTE pregled uz očuvanje strogog kataloškog neuspeha, ne generičko odobravanje svih managed ACL razlika.


### Izvršni dodatak R01 — normalizovani ACL per-routine dokaz, 28.10.2026.

- **Owner/status:** R01/F21 `IN_PROGRESS`. Ova celina **ne menja** application SQL, Postgres managed roles/grants/owners, RLS, canonical bootstrap/fingerprints, migracije, Auth sesije ni Edge/native izdanje. Server schema strict ostaje **FAIL**. `R01_NATIVE_NET_PROVENANCE`, `R01_HOSTED_LOGIN_DEPENDENCY` i `R01_ADMIN_EFFECTIVE_PATH` su odvojeni, ograničeni nalazi; poslednji je u [run 40743573733](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40743573733) imao `effective_disposable_path_verified=true`, 0 razlika dok je strict i dalje 8/49/3 **FAIL**. Njegov DEV deo je kataloški, ne stvarna hosted admin sesija.
- **Nova izvršna promena:** commit [`7305d79456aa0f6de69ba3817a2adb11210f02f3`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/7305d79456aa0f6de69ba3817a2adb11210f02f3), grana `work/rev14-review-f17` i postojeći draft PR #43. Dodati `supabase/proofs/privacy/runtime/extension-acl-scope.sql` (read-only, bez funkcijskog izvršavanja), `extension-acl-scope-expected.json` (nov, per-routine DEV metadata-only baseline od 49 redova), `extension-acl-scope.mjs` i `extension-acl-scope.test.mjs`. `run.mjs` poziva proveru posle complete application bootstrap i svih strict/supplemental/ostala uska poređenja, a workflow sakuplja odvojeni `R01_EXTENSION_ACL_SCOPE_COMPARISON` receipt. **Originalni** strict comparator, očekivani hash-evi i guard ostali su neizmenjeni.
- **DEV poreklo i obuhvat:** `leqcwgzvjsxugfgzdmth` read-only katalog; SQL SHA-256 `d630cc5a096ea03cb77668b7d1a27c644b369913a3a2554a165d0f40014cd6a3`. Svih 49 rutina je obuhvaćeno pojedinačno: 36 `pgcrypto`, 10 `uuid-ossp`, 3 `pg_stat_statements`. Fajl sa očekivanim dokazima čuva samo imena tri sistemske ekstenzije, numeričke/booleanske podatke i hash-eve rutina/tela/ACL-ova/uloga, bez poslovnih/Auth redova ili tajni. Pored zasebnih full-ACL i owner hash-eva upoređuju se *grantor-independent* pravo/privilege/grant-option tuple za `PUBLIC/anon/authenticated/authenticator/service_role`, kao i izvršni metadata/body/config i stvarna EXECUTE booleanska prava. ACL uređivanje među serverima normalizovano je po hash-evima identiteta uloga, ne po lokalnim OID vrednostima.
- **Granica prihvatanja:** check `caller_scope_verified` može biti true samo ako sve 49 rutine imaju identične relevantne request grantove, EXECUTE i source/SECURITY INVOKER a nema promene broja full-ACL tuple; `owner_acl_metadata_equal` i potpune vlasničke/ACL razlike ostaju zaseban rezultat i ne postaju waiver. Nepoznat ključ/red, promenjen source ili SECURITY DEFINER odbijaju proveru. Bez actual Auth/HTTP, dinamičkog SQL pregleda, Storage lifecycle i admin grantor/gant rights ova provera **nikada ne znači** `R01 DONE` ili `METADATA_EQUAL`.
- **Test/CI:** izolovano `node --test extension-acl-scope.test.mjs` **4/4 PASS** (49 identiteta, owner vs caller, request grant/source i fail-closed). DEV SQL izvršen read-only i upisan je novi (ne prepisani canonical) baseline. [Schema CI 40744630746](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40744630746) i [full CI 40744630716](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40744630716) za `7305d794...` bili su `IN_PROGRESS/PENDING` u trenutku zapisa; njihov ishod nije proglašen unapred. Nije korišćen stari node_modules, nisu objavljeni binaries ili deployment.
- **Sledeći korak:** pročitati upareni `R01_EXTENSION_ACL_SCOPE_COMPARISON` iz novog serverskog CI, klasifikovati pune owner/grantor razlike i eventualnu dodatnu privilege/count deltu bez menjanja managed ACL. Preostaje Storage owner grant-option 8-bit scope i ceo request/role authorization dependency review iz `r01-relevance.md`. Tek odvojeni `R01_BOUNDARY_PREREQUISITES` (strogi FAIL zadržan) može razmatrati otključavanje sintetičkih Auth/PostgREST testova; nikakvo live proširenje SELECT prava nije uvedeno.


### Izmereni ACL rezultat i precizna sledeća zavisnost — 28.10.2026.

- [Schema CI 40744630746](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40744630746) (source `7305d79456aa0f6de69ba3817a2adb11210f02f3`) je **FAIL**, kao i ranije, zbog **strict 8 / supplemental 49 / managed net hook 3**. Cleanup i odvojene uske provere nisu waiver. **`R01_EXTENSION_ACL_SCOPE_COMPARISON`: `caller_mismatch_count=0`**, relevantni request grants, actual EXECUTE i routine code/settings su bez promene u svih 49 posmatranih funkcija. Ali `caller_scope_verified=false` jer se broj **full** ACL tuple razlikuje na **46** rutina. Vlasnički hash je različit na 49, puni ACL hash na 49, full ACL broj na 46. `owner_acl_metadata_equal=false`. Ne tretirati nula caller mismatch-eva kao `ACL PASS` dok nije dokazano značenje dodatnih 46 tuple i granica admin uloge.
- Nova read-only DEV katalog provera pokazuje da `dashboard_user` ima po jedan eksplicitan EXECUTE grant nad svih 49 rutina (pgcrypto 36 / uuid-ossp 10 / pg_stat_statements 3), a `anon/authenticated/authenticator/service_role` i ostali redovni principi ne mogu tu ulogu nasleđivati ili `SET`; privilegovani `supabase_admin` može, te **nije** tačno da niko može. Ovo daje hipotezu za razliku broja stavki na 46 rutina, ali **još nema per-ACL tuple poređenja protiv disposable-a koje bi dokazalo da je to baš jedini uzrok**. Ne menjati managed grants da bi se izjednačio broj. Traženo je uparivanje grantee/grantor/privilege/grant-option sa tačno 49 identiteta i vlasničkim pravima, uz kontrolu dinamičkih funkcijskih zavisnosti i administrativne putanje.
- Nezavisan DEV Storage katalog potvrđuje `storage.objects` ima 32 eksplicitne ACL tuple, osam vlasničkih sa grant-option=true, osam drugih grant-option=true i osam efektivno grantable owner prava. To je početni read-only dokaz; izvorni disposable iz prethodnog poređenja govori o osam vlasničkih owner-bit razlika, ali zahteva parnu *tuple*-verifikaciju pre bilo kakve odluke o relevantnosti.
- **Granica i naredni korak:** `R01` ostaje `IN_PROGRESS/BLOCKED` za celokupnu SQL/Auth boundary, čak iako tri manja provenance preduslova imaju PASS i request-relevant ACL polja imaju 0 mismatch. Sledeći owner: per-ACL dokaz za `dashboard_user` i Storage sa potvrdom da su jedine razlike poznate administrativne tuple, uz izolovano protivničko testiranje bez granta/owner popravki. Tek potom odvojeni `R01_BOUNDARY_PREREQUISITES` (koji mora zadržati strict FAIL) može da otključa synthetic Auth + PostgREST; objava i klijenti i dalje nisu odobreni. [Full CI 40744630716](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40744630716) u trenutku zapisa još `IN_PROGRESS`, ishod nije pretpostavljen.


### R01 Storage vlasnički ACL — izvršen uski dokaz (28.10.2026)

- **Source i vlasnik:** `work/rev14-review-f17`, commit [`1d3f638c753fee21415807f3d38299a33a3d7345`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/1d3f638c753fee21415807f3d38299a33a3d7345); R01/F21 `IN_PROGRESS`. Dodati `supabase/proofs/privacy/runtime/storage-owner-acl.sql`, `storage-owner-acl-expected.json`, `storage-owner-acl.mjs`, `storage-owner-acl.test.mjs`, povezani `run.mjs` i R01 workflow. Nijedan managed ACL/owner ili funkcija nije menjan. SQL radi `BEGIN TRANSACTION READ ONLY` i poredi samo Postgres katalog; DEV baseline je vezan za query SHA-256 `dc98d5e7c3fd4da27c4c5d2bdc1627f693712f12ac45685cf2057778c817c7d5`.
- **Potvrđen parni CI:** [R01 Schema CI 40747142824](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40747142824), CI source `1d3f638...`: `R01_STORAGE_OWNER_ACL_COMPARISON.owner_grant_representation_verified=true`, `changed_owner_entries=8`, `effective_privileges_equal=true`, `difference_count=0`. Poređeno je tačno 32 normalizovane grantee/grantor/privilege tuple i 80 efektivnih table privilege/grantability/owner kontrola. Jedina dozvoljena reprezentaciona razlika u ovom dokazu su eksplicitni grant-option bitovi na osam owner tuple (`supabase_storage_admin`, DEV true / disposable false); svaka druga promena odbijena. PG17 owner pravilo daje implicitnu mogućnost daljeg dodeljivanja vlasničkih prava; to **ne** ukida strogu evidenciju raw ACL delte. Lokalni izolovani JS testovi za ovu celinu `4/4 PASS`; dokaz CI je jači od lokalnog.
- **Ukupni rezultati nisu menjani:** ista šema je **overall FAIL**: 8 strict, 49 supplemental, 3 native helper hash razlike, `failure_stage=STRICT_PARITY`. Odvojeni `native_net_provenance_verified=true`, `hosted_login_dependency_verified=true`, `admin_effective_path_verified=true`, `storage_owner_acl_verified=true` su samo ograničeni preduslovi. Originalni canonical bootstrap, fingerprints, closure/export i R01 kandidat ostali su neizmenjeni; Auth/HTTP/fixtures/actual client/production nisu pokrenuti niti proglašeni kao PASS.
- **Naredni korak:** upariti **sve** ACL tuple za 49 extension-routine razlika, po grantee/grantor/privilege/grant-option, uključujući svaku direktnu `dashboard_user` dodelu i owner/grantor varijante; potpuni `extension_acl_caller_scope_verified=false` ostaje otvoren jer na 46 rutina broj full ACL stavki nije jednak, iako `caller_mismatch_count=0`. Tek posle izričitog dokazivanja odgovornosti dodatnih prava i dinamičkih zavisnosti može se razmotriti zaseban `R01_BOUNDARY_PREREQUISITES`, bez ikakve promene strogog FAIL-a. Puni aplikacioni [CI 40747142257](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40747142257) je bio `IN_PROGRESS` u trenutku ovog zapisa; njegov ishod se ne pretpostavlja.


### R01 — detaljno uparivanje svih 49 ACL funkcija (28.10.2026)

- **Završene prethodne potvrde:** full CI [40747142257](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40747142257) za `1d3f638c753fee21415807f3d38299a33a3d7345` je **SUCCESS**. Schema [40747142824](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40747142824) je **FAIL** kao i ranije: 8 strict, 49 supplemental, 3 native helper hash razlike. U istom stvarnom runtime-u `R01_STORAGE_OWNER_ACL_COMPARISON` je **uski PASS (0 razlika izvan osam dozvoljenih vlasničkih grant-option bitova)**, 32/32 tuple i 80/80 efektivnih prava bez druge delte. Nema Auth/HTTP/fixture/candidate prolaza, niti produkcionog deploy-a. Ranije `native_net`, `hosted_login` i `admin_effective_path` ograničene provere i dalje su `true/0`; ukupni schema FAIL nije ukinut.
- **Nova tehnička celina:** commit [`6a2b9afcae8a3ffb1df622686b7f815d039e8cee`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/6a2b9afcae8a3ffb1df622686b7f815d039e8cee), ista grana `work/rev14-review-f17` i draft PR #43. `extension-acl-tuples.sql` je samo read-only sistemski katalog sa tačno 49 identiteta, svaku `grantee/grantor/EXECUTE/grant-option` tuple pretvara u hash sa booleanskim owner/dashboard indikatorima. `extension-acl-tuples-expected.json` čuva novi DEV baseline vezan za query SHA-256 `4b0a368affd9616268cb92c13bee5753df51bbedd828120af09ac1f8766ab419`; `extension-acl-tuples.mjs` strogo proverava izvor/uloge/49-sortiranih identiteta i javno objavljuje samo klasifikovane diferencije. `extension-acl-tuples.test.mjs`: lokalno **4/4 PASS** (pozitivni DEV ugovor, negativni schema/privilege i tuđa uloga). Postojeći `run.mjs` zahteva da novi capture ima iste identitete, owner i full ACL count kao prethodno upareni `extension-acl-scope` capture iz istog disposable runtime-a; sirove detaljne tuple ostaju u privatnom job direktorijumu, javni receipt je agregat. Strogi katalog/bootstrap/zaštita/role/managed ACL nisu menjani.
- **Konkretan DEV katalog:** svih 49 rutina (36 pgcrypto, 10 uuid-ossp, 3 pg_stat_statements) imaju tačno jednu direktnu `dashboard_user` EXECUTE dodelu. `dashboard_user` je NOLOGIN, nije SUPERUSER i ne zaobilazi RLS, ali ima CREATEROLE i predstavlja stvarnu administrativnu ulogu; nijedan request principal ne može je nasleđivati niti `SET`, dok `supabase_admin` može. Izvorna DEV provera `pg_shdepend` pronašla je **123 ACL zavisnosti** za tu ulogu (40 relacija, 1 baza, 6 default ACL, 3 namespace i 73 `pg_catalog` rutine), bez literala u posmatranim PL/SQL telima. Ovo **nije** tvrdnja da su svih 123 unutar R01 ni dokaz da su administrativne zavisnosti nebitne: zabrana globalnog waiver-a ostaje.
- **CI identitet i status:** novi source `6a2b9af...` pokrenuo je [schema CI 40748319264](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40748319264) i [full CI 40748319165](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40748319165). U trenutku unosa oba su `IN_PROGRESS`, zato `R01_EXTENSION_ACL_TUPLES_DIAGNOSTIC` nije proglašen kao izvršeni disposable rezultat.
- **Sledeći konkretan korak:** pročitati stvarni novi tuple comparator i odvojiti (a) promenu vlasnika/grantora, (b) nedostajuće/različite `dashboard_user` grantove, (c) ostale dodele ili grant-option promene. Ako postoji neki dodatni grant ili zavisnost, ne praviti izuzetak na osnovu nule caller mismatch-eva. Završiti usko dokazivanje izvršnih i administrativnih zavisnosti svih preostalih polja prema `r01-relevance.md`; `R01_BOUNDARY_PREREQUISITES` je i dalje **NOT_ADMITTED** dok se zasebno ne dokaže. Tek tada sintetički Auth/PostgREST. Produkcija, migracije, native/OTA i klijenti nisu promenjeni.


### R01 — izvršeni tuple dokaz, nova potvrđena razlika (28.10.2026)

- **GitHub source:** [`6a2b9afcae8a3ffb1df622686b7f815d039e8cee`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/6a2b9afcae8a3ffb1df622686b7f815d039e8cee), `work/rev14-review-f17`; isti plan / draft PR #43. Izolovani [Schema CI 40748319264](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40748319264) završio je sa **overall FAIL** zbog i dalje striktnih 8 / dodatnih 49 / helper 3 razlika; nijedna klijentska funkcija niti live ACL nisu menjani. Novi `R01_EXTENSION_ACL_TUPLES_DIAGNOSTIC` iz *stvarnog* disposable runtime-a izvršen je i upoređen sa read-only DEV baseline-om; on **nije** admission.
- **Novi merljivi nalaz:** na 49 rutina ukupan full ACL se razlikuje, vlasnik se razlikuje na svih 49, izvorni scope provere i dalje ima **0 caller/source mismatch-eva** i ostaje `caller_scope_verified=false`. DEV ima 146 normalizovanih ACL tuple ukupno, disposable 192; **46 dodatnih tuple je na disposable strani** (36 pgcrypto + 10 uuid-ossp; za tri pg_stat_statements je broj tuple jednak). Poravnanje stroge identične tuple još je 0 zbog različitih vlasnika/grantora, zato `dev_only=146` i `native_only=192` ne treba pogrešno čitati kao broj samostalno dodatih različitih grantova. `dashboard_user` je **prisutan u oba** okruženja, suprotno ranijoj hipotezi o njegovom odsustvu; ima direktan EXECUTE grant nad 49 DEV rutina, a nad 46 disposable rutina. Njegova uloga u aplikacionom/administrativnom izvršavanju i razlike grantora zahtevaju dalje usko uparivanje; ne postoji automatsko blanket odobrenje.
- **Šira DEV bezbednosna ograničenja:** `dashboard_user` je NOLOGIN, nije SUPERUSER niti BYPASSRLS, ali jeste CREATEROLE, i samo privilegovani `supabase_admin` među kontrolisanim principalima ima `USAGE/SET` do te uloge. `pg_shdepend` read-only katalog registruje ukupno 123 ACL-zavisnosti te uloge: 40 relacija, 1 baza, 6 default ACL, 3 namespace i 73 `pg_catalog` rutina. To nisu 123 dodatna R01 problema niti dokaz da je uloga administrativno nebitna. PostgreSQL `pg_shdepend` je cluster-wide katalog. Sva 49 extension-routine tela su native `C` i `SECURITY INVOKER`, na DEV-u bez SECURITY DEFINER; ovo nije Auth/HTTP dokaz.
- **Očuvani dokaz/provere:** `R01_NATIVE_NET_PROVENANCE`, `R01_HOSTED_LOGIN_DEPENDENCY`, `R01_ADMIN_EFFECTIVE_PATH` i `R01_STORAGE_OWNER_ACL` ostaju ograničeni PASS nalazi (poslednji 32 normalized Storage tuple, osam vlasničkih grant-option razlika, 80 efektivno jednakih prava). **Originalni strict FAIL se zadržava**. Canonical bootstrap `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f` nije menjan, nema novih migracija, fixture-a, stvarne Auth sesije, PostgREST klijentskog prolaza, OTA ili deploy-a.
- **Prvi sledeći tehnički korak:** kao novu proverljivu hipotezu dokazati *po primaocu prava* zašto local ima 46 više full ACL tuple, zatim razlikovati grantor-only, owner grant-option i stvarno novi grantee. Novu ciljanu, bezbednu agregaciju bazirati na istim već izvršenim raw katalog zapisima i vezati za postojeći `extension-acl-tuples` comparator; ne pokretati novi široki audit niti prepravljati managed ACL, owner ili očekivane strict hash-eve. Nakon toga pregledati dokazne granice administrativne uloge i dynamic SQL pre ikakvog `R01_BOUNDARY_PREREQUISITES` acceptance. [Full CI 40748319165](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40748319165) u trenutku unosa nije imao završen ishod.


### R01 — potpuno objašnjen grantee/grantor inventar (28.10.2026)

- **Kodni identitet:** `work/rev14-review-f17`, commit [`204cd80736e30a225c7b8f6005dbe0c0451cbc32`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/204cd80736e30a225c7b8f6005dbe0c0451cbc32), postojeći draft PR #43. U `extension-acl-tuples.mjs` dodata je deterministička klasifikacija već prikupljenih MD5 identiteta sistemskih grantee/grantor uloga, bez ponovnog prikupljanja korisničkih redova i bez menjanja izvorne SQL query/baseline. Negativni test i kontrola klasifikacije su vezani za postojeći `extension-acl-tuples.test.mjs`; lokalno kompletan pripremljeni skup `25/25 PASS`. Samo nazivi poznatih sistemskih uloga, brojevi i hash identiteti izlaze u javni CI receipt.
- **Pravi serverski dokaz:** [Schema run 40749357597](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40749357597) iz izvršenog SQL/current-schema portable PostgreSQL-a imao je **overall FAIL** i dalje na `STRICT_PARITY` (8 strict/49 supplemental/3 native net-hook hash razlike). `R01_EXTENSION_ACL_TUPLES_DIAGNOSTIC` je uspešno izvršen i detaljno razdvojio sve 49 funkcija po ulogama; nema `UNCLASSIFIED` grantee/grantor identiteta i `caller_mismatch_count=0`, ali `exact_acl_equal=false`, `changed_routines=49`. `R01_STORAGE_OWNER_ACL` ostaje odvojeni uski **PASS**, bez promene overall FAIL-a.
- **Tačna klasifikacija, bez pretpostavke:** Na DEV-u sve 49 funkcije imaju owner=`postgres`, svi eksplicitni grantovi dolaze od `postgres`; po funkciji je tipično PUBLIC + `dashboard_user` + owner `postgres` (na pg_stat_statements samo 2 PUBLIC grantova među 3 funkcije). Na disposable-u svih 49 vlasnika i svih 192 grantee/grantor tuple dolaze od owner/grantor=`supabase_admin`. Za `pgcrypto` (36) i `uuid-ossp` (10) postoje četiri direktna EXECUTE primaoca po funkciji: `PUBLIC`, `dashboard_user`, `postgres` i `supabase_admin`. Zato je na tih **46 rutina po jedna dodatna eksplicitna tuple**, ukupno +46 naspram DEV-a. Za `pg_stat_statements` (3), lokalno nema `dashboard_user` grantova, ali postoje `postgres` grantovi umesto njih; broj tuple ukupno ostaje osam. I na DEV i na disposable `dashboard_user` uloga postoji, nasleđivanje `USAGE/SET` običnih request principala nije registrovano; samo privilegovani admin može do nje. Na DEV-u funkcije su `C` i SECURITY INVOKER, bez SECURITY DEFINER.
- **Granica koja nije dokazana:** ovo potvrđuje uzrok i raspored svih raw ACL identiteta, **ne** ekvivalentnost administratorove mogućnosti da menja/dodeljuje prava niti automatski bezbedan izuzetak od strict katalog razlika. Efektivni request EXECUTE/schema prava su izmereno jednaki, ali admin/ALTER/GRANT/reachability i dinamičke zavisnosti nisu kompletno obuhvaćene. Na DEV-u `dashboard_user` dodatno ima 123 kataloške ACL zavisnosti (bez direktnih aplikacionih public relacija; 40 tabela u auth/realtime/extensions, 73 pg_catalog rutina, 3 schema, 6 default ACL i 1 DB) koje se ne smeju jednostavno ignorisati. `R01_BOUNDARY_PREREQUISITES` i dalje **NOT_ADMITTED**, nema synthetic Auth, stvarnog PostgREST-a, kandidata, DEV migracije/deploy-a niti telefonskog prolaza.
- **Sledeći tačno dozvoljen posao:** definisati i upareno proveriti ograničenu administrativnu i dinamičku relevantnost ovih konkretnih owner/grantor/`dashboard_user` promena za R01 request path (svih 49 C/INVOKER rutina, grant/reachability, pravila testiranih request principala i primenjeni net hook). Ne uvoditi prećutni blanket waiver, ne prepisivati očekivane stroge hash-eve i ne promovisati R01 kandidat dok se svi acceptance preduslovi ne izvrše. [Full CI 40749357819](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40749357819) je pri ovom zapisu `IN_PROGRESS`; konačan status nije pretpostavljen.


### R01 — read-only CREATE EXTENSION / role boundary dopuna (28.10.2026)

- Ovaj deo je **DEV metadata-only provera** `leqcwgzvjsxugfgzdmth` sa `transaction_read_only=on`. PostgreSQL `pg_net=0.20.4` helper trigger izvršava se za DDL `CREATE EXTENSION` event prema ranije uparenom native hook ugovoru; ne tvrdi se da se on izvršava pri običnom PostgREST SELECT zahtevu. Proverom `has_database_privilege(...,'CREATE')`, `has_schema_privilege(...,'CREATE')` i `pg_has_role(...,'SET')` utvrđeno je da `anon`, `authenticated`, `authenticator` i `service_role` nemaju ni DB CREATE ni CREATE na `net/extensions` šemama niti SET do `supabase_admin`; privilegovani `postgres` i `supabase_admin` imaju DB CREATE, a `supabase_admin` ima CREATE na obe navedene šeme. Ovo ograničava obične request principale; samo po sebi **ne** dokazuje da privilegovana SECURITY DEFINER putanja ne može izvršiti DDL.
- Uski leksički katalog pregled 7 šema (`auth, extensions, net, private, public, realtime, storage`) ima 550 funkcija označenih SECURITY DEFINER; među njihovim telima **0 direktnih `CREATE EXTENSION` i 0 direktnih `SET ROLE`/set_config(role) obrazaca** po konkretnom regexu. Jedan literal `CREATE EXTENSION` postoji među svim pregledanim funkcijama, ne među SECURITY DEFINER. **Ovo nije potpuno pokriće dinamičkog SQL, indirektnih RPC poziva, C implementacija ili identiteta live Auth/PostgREST**. Ne koristiti broj 0 kao blanket permission waiver.
- Nije izvršen DDL, promena role, SQL kandidat ili fixture; izvorni checksum-i i existing strict FAIL su očuvani. Sledeće dozvoljeno sužavanje R01 je pregled stvarnih request-call path/policy/definer zavisnosti i kompletan testni runtime principal pre `R01_BOUNDARY_PREREQUISITES`, a ne automatski prelazak na live schema migraciju. Kodna i API granica R01 ostaje `IN_PROGRESS`.


### Potvrda celog source CI i nepromenjene release kapije — 28.10.2026.

- Za najnoviji izvršni source `204cd80736e30a225c7b8f6005dbe0c0451cbc32` [USKOCI clean branch checks 40749357819](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40749357819) završen je **SUCCESS**, sa `614/614` Jest suite-a, `14.115/14.115` mobilnih i ugovornih testova, `3/3` snapshot-a, TypeScript, Deno import/type, R07 hourly/Agreement SQL, AI/taxonomy, migration integrity i R01 izolovanim SQL/test graničnim kontrolama. Test iz ovog job-a **nije** stvarni Auth/HTTP, native build, uređaj, OTA ili store submission.
- Upari ga sa posebnim [schema CI 40749357597](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40749357597), koji je i dalje **FAIL** na 8 strict/49 supplemental/3 native net-helper raw razlike, sa odvojenim dokazanim Storage ACL, native hook provenance, hosted-login i admin path uskim kontrolama. Novi `R01_EXTENSION_ACL_TUPLES_DIAGNOSTIC` potvrđuje objašnjenu podelu svih 49 grantee/grantor tuple, ali `exact_acl_equal=false`, i zato **ne** otključava synthetic Auth/PostgREST.
- Originalne REV10/REV14 dokaze, njihov byte hash, dosadašnju migracionu istoriju, canonical bootstrap, privacy guard i closure evidenciju sačuvati. Nisu primenjeni SQL kandidati ni live Supabase promene. Nema razloga ponavljati full CI nad ovim identičnim source-om bez nove promene ili hipoteze. Sledeći korak ostaje bounded stvarni request-call path/definer/dependency dokaz za R01, a kada nije ispunjen — nastavak nezavisnih R/C prema postojećim zavisnostima.


### R01 — ograničen request-call-path katalogski dokaz (28.10.2026)

- **Kod i grana:** commit [`d4ac487cb5c5f536f1f02c50344e0194bd02a55a`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/d4ac487cb5c5f536f1f02c50344e0194bd02a55a) na `work/rev14-review-f17`, isti draft PR #43. R01 ostaje `IN_PROGRESS`, bez promene aplikacionog SQL-a, managed objecta, DEV/live privilegija, migracija, stvarnih naloga ili klijentskog bundle-a. Canonical `bootstrap/current-application.sql` i strict comparator/fingerprints nisu menjani. Izvršen je samo read-only DEV PostgreSQL katalogski upit.
- **Precizan izvor:** dodati `supabase/proofs/privacy/runtime/request-call-graph.sql`, `request-call-graph-expected.json`, `request-call-graph.mjs`, `request-call-graph.test.mjs`, povezani `runtime/run.mjs` i izolovani GitHub workflow. Baseline se vezuje za SHA-256 SQL teksta `a9842f833fbe5578a234abd6d5ea8aa85d6a8f122ae78a2087249eaf217479c9`; umesto SQL tela ili poslovnih redova sadrži samo sistemske metadata, hash-eve, RLS policy hash-eve i potvrđene request role EXECUTE booleane. Upari DEV i disposable nakon punog strict/supplemental capture-a, ali pre konačne strict FAIL ograde. Isti izvorni SQL i njegove pozive strogi source checker proverava pre izvršenja.
- **Zatečena stvarnost DEV:** 11/11 ulaznih funkcija (Need read/list/discovery/owner-page, account guard, close-search i odgovarajući RLS/visibility helperi) razvijeno je u ograničeni **tekstualno prepoznat** graf od 66 funkcija i 92 kvalifikovane međufunkcijske veze. Obuhvaćeno je svih šest `public.needs` RLS policy metapodataka. Povezivanje je izvršeno do dubine 8 sa `frontier_unvisited=0`; u tom obuhvatu 0 direktnih leksičkih obrazaca `EXECUTE` dinamičkog SQL-a, `CREATE EXTENSION` ili `SET ROLE`. Katalog uključuje `SECURITY DEFINER` pomoćnike i native C funkcije, a ne samo klijentske RPC ulaze. SQL je read-only, bez poslovnih/Auth redova, bez pozivanja aplikacionih funkcija.
- **Granice dokaza:** ovo je **konzervativno tekstualno prepoznavanje schema-qualified poziva**, ne Postgres parser niti potpuna dokazna izvršna putanja. Overloads, nekvalifikovani pozivi, komentari, indirektni dispatch, privilegovane uloge i C implementacije nisu automatski razrešeni. Novi `R01_REQUEST_PATH_CATALOG_COMPARISON` zato razdvaja `qualified_source_equal` od `raw_metadata_equal`, prijavljuje vlasnički/ACL drift i **ne** izdaje `R01_BOUNDARY_PREREQUISITES` ili `METADATA_EQUAL`. Svaka promena tela/konfiguracije, SECURITY DEFINER vlasnika, RLS policy-ja ili efektivnog EXECUTE prava blokira njegov ograničeni source rezultat. Preostale managed ext owner/ACL i dinamičke zavisnosti se ne prećutkuju.
- **Provera/dostava:** GitHub je pokrenuo [R01 schema CI 40754299960](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40754299960) i [full application CI 40754299972](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40754299972). Pri upisu su oba `IN_PROGRESS`; početne proverе izvora, novi adversarial testovi i pinovani CLI start su prošli pre početka izolovanog runtime-a, ali se overall status unapred ne proglašava PASS. Poslednji završeni application source CI `40749357819` je PASS; poslednji završeni R01 strict Schema CI `40749357597` je FAIL.
- **Prvi sledeći posao:** nakon završetka novog CI pregledati `qualified_source_equal` i sve `administrative_differences` u stvarnom disposable reportu. Ako ovo ne može dokazati efektivnu R01 request ulogu zbog indirektnih zavisnosti, ostaviti `R01_BOUNDARY_PREREQUISITES NOT_ADMITTED` i nastaviti nezavisni R03 ugovor (sadašnji `rpc_list_my_needs_page` je dokumentovano nekompatibilan sa pager/decoder-om; stari EX04A kandidat je istorijski i ne sme se primeniti preko novijih vlasnika niti uz false closure readiness). Bez Auth HTTP i podržanih native/OTA čitača R01 nije završen.


### R03 / F01 — bezbedno keyset listanje sopstvenih zadataka (28.10.2026)

- **Nezavisan kodni korak:** commit [`57d768c139ea5bd45315f87b9685aaeb5137e1e6`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/57d768c139ea5bd45315f87b9685aaeb5137e1e6), isti `work/rev14-review-f17` / draft PR #43. Promenjeni su samo `src/data/ownTasksPage.ts` i `src/data/__tests__/own-tasks-page-client.test.ts`. `decodeOwnTasksPage` sada validira `limit=1..100` i oblik nastavnog cursora i zahteva strogo opadajući serverski ključ `(created_at, uuid)`, uključujući kretanje *od prethodne stranice*. Vremena se porede preko celih sekundi i šest mikrosekundnih mesta posebno (bez milisekundnog zaokruživanja ili BigInt zavisnosti), sa UUID tie-break redom. Stara validacija counts/dokumenata i mapiranje kroz isti `mapNeed` nisu oslabljeni.
- **Negativni testovi:** dopunjeni slučajevi za ponovljenu/napredujuću stranicu, obrnuto sortiranje, istu UTC instancu sa različitim offset-om, razlikovanje `123456` / `123455` mikrosekundi, UUID tie i neispravan limit/cursor. Postojeći dokument fixture sada ima realan DESC sortAt umesto ranijeg testnog ASC rasporeda; očekivani RPC argumenti usklađeni su sa tim stvarnim cursorom. U trenutku ovog zapisa novi [full CI 40754779065](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40754779065) nije završen; ne tvrdi se PASS na uređaju ni u GitHub runneru.
- **Server i integracija:** nema izmene live Supabase-a ni migracije. Sadašnji `rpc_list_my_needs_page` i dalje vraća nepotpun camelCase format, nedostaju pet scope-ova i counts koje ciljna stranica očekuje; paged čitač je iza build-flag ograde. Nije opravdano aktivirati paged režim samo zbog klijentske provere, koristiti stari EX04A kandidat protiv novijih vlasnika ili zaobići closure `source_ready=false` dokaz. Tek nakon ciljnog serverskog ugovora, stvarnog Auth/PostgREST izlaza i starog/novog klijentskog decoder testa R03 može dobiti potpuno prihvatanje.
- **Status i sledeći rad:** R03 `IN_PROGRESS`, samo jedan klijentski fail-closed deo implementiran. R01 request-call-path DEV graf ima 11 roots, 66 reachables, 92 kvalifikovane veze i šest Need RLS politika, ali je leksički, ne stvarni HTTP/Auth dokaz. Njegov [schema CI 40754299960](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40754299960) i [full CI 40754299972](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40754299972) pokrenuti su za `d4ac487`; kasniji `57d768c` source ima zasebne [R01 40754779100](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40754779100) i full CI 40754779065. Nastaviti samo na novim dokaznim deltama i nakon pozitivnog CI rezultata. Ne mešati izolovani test sa stvarnim native/OTA izdanjem.


### R03 — aktuelni helper sačuvan, uski page-only kandidat i CI (28.10.2026)

- **Završena klijentska celina:** `57d768c139ea5bd45315f87b9685aaeb5137e1e6` (mikrosekundni `created_at/id` DESC keyset validation) i korekcija istorijskog ASC testnog fixture-a `3a46bcf81bfb82025c7032e48f801bbad9d897ed`. Nakon prvog CI FAIL (samo neusklađen `need-ending-client` fixture), završni [full CI 40755608109](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40755608109) je **PASS: 614/614 Jest suite-a, 14.118/14.118 testova, 3/3 snapshota**, TypeScript/Deno i svi preostali izabrani koraci. Ovo dokazuje source/test nivo, **ne** native/OTA ni aktivaciju stare paged build-flag funkcije. Poslednji odgovarajući [R01 schema CI 40755608168](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40755608168) ostaje **FAIL** na strict katalogu; u zasebnom source R01 grafu je 66 odabranih funkcija i 92 kvalifikovane veze uz `qualified_source_equal=true`, `raw_metadata_equal=false` (dve SECURITY INVOKER `extensions.digest` owner/ACL delte). Nema Auth/HTTP/fixture ili migration dokaza.
- **Novi stvarni DEV R03 katalogski nalaz (isključivo `BEGIN TRANSACTION READ ONLY`):** `public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)` ima staro telo MD5 `dad1de3234e72d4e2f44be5e920eda61` i i dalje samo `ALL/ACTIVE/HISTORY`, camelCase izlaz bez pet counts i bez kanonskog `rpc_read_task` dokumenta. Međutim, `private.own_task_counts(uuid)` **već postoji**, sa tačnim ciljnim MD5 `01d695467d5fa39dec180086cb07de40`, vlasnik postgres, `STABLE SECURITY DEFINER`, search_path=pg_catalog, ACL samo `postgres=X/postgres`, bez client EXECUTE. Stari EX04A kandidat je zato nevažeći kao celina (odbija postojeći helper). Od osam njegovih starih source pinova sedam se poklapa, ali sadašnji `private.need_candidate_states_v5(uuid)` ima MD5 `0d2156f39520b49da48d3eabf14bfffe` naspram ranijeg `6d65...`; njegovo novo telo čuva aktuelno schedule fit i pricing/selection ponašanje i ne sme biti vraćeno na stari pin. Uočena indirektna veza vodi iz selectable count helpera do njega. Closure readiness ostaje zaseban preduslov.
- **Uska source-only implementacija:** commit [`3b0cae983f5111ec33202bbcc284d9f8b2756c19`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/3b0cae983f5111ec33202bbcc284d9f8b2756c19), ista radna grana i draft PR #43. Dodati `supabase/proofs/ex04/build_r03_existing_helper.py`, `test_r03_existing_helper.py`, deterministički generisani `supabase/candidates/r03_owner_page_existing_helper.sql` i CI source-only `--check`/unittest korak. Generator uvozi telo čitača iz **postojećeg** neizmenjenog `build_ex04a.py` (ciljni MD5 `509d6c345c84cc6a597bde46d9ae6b75`) umesto druge ručne SQL kopije. Novi kandidat zahteva lokalni GUC i postgres owner, tačan stariji reader precondition, već postojeći helper i njegov nepromenjeni privatni ACL, aktualne proverene šest zavisnosti uključujući novi selection state pin, closure `source_ready=true` + sertifikat, čuvanje svih drugih funkcija/ACL, atomski rollback na drift i očuvan `service_role` reader EXECUTE. Ne kreira/ne briše helper niti menja novi selection authority. Nije nova migracija niti primenjen SQL na DEV/live.
- **Izvršeni CI i trenutna blokada (potvrđeno):** [full CI 40756877836](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40756877836) na source `3b0cae9` je **SUCCESS**: 614/614 Jest suite-a, 14.118/14.118 testova, 3/3 snapshot-a, TypeScript, Deno, AI/taxonomy, hourly Agreement i integritet migracija. Novi **R03 source-only** korak je zasebno **PASS**: deterministički generator `--check` proverio je tačne SQL bajtove, četiri negativna/pozitivna unittest-a PASS; **nije izvršen DDL**. Odvojeni [R01 schema CI 40756877823](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40756877823) je overall **FAIL** (strict 8, na istim metapodacima, bez Auth/HTTP). Kanonski bootstrap SHA `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f` ostao je nepromenjen. Nova read-only DEV provera baš preduslova za kandidata utvrdila je **`private.retention_ai_source_ready()=false` i nejednakost closure source digest-a i sertifikata**; stari page MD5 i noviji helper MD5 ostaju potvrđeni. Zato je kandidat **SOURCE_VERIFIED, BLOCKED_FOR_EXECUTION**; ni u DEV ni live nije primenjen. Ne revidirati closure sertifikat zbog prolaza. Sledeći korak: dokazati i uskladiti closure autoritet i R01 privatnost u izolovanom current-schema/auth svetu, zatim stvarni Auth/PostgREST pet scope-ova/counts/cursor + podržani klijentski decoder, rollout/rollback i uređaj. R03 ostaje `IN_PROGRESS`, R01 `IN_PROGRESS`, release neodobren.


### R10/R12 — read-only closure roster i razjašnjenje source drifta (28.10.2026)

- **Izvor, bez promene baze:** commit [`7966b026df4d89a01cc5783a5ac31a4c875836d3`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/7966b026df4d89a01cc5783a5ac31a4c875836d3) na `work/rev14-review-f17` dodao je `supabase/proofs/ex04/r03-closure-roster.sql`, validator `r03-closure-roster.mjs`, 4 source testa i odgovarajući CI korak. Provera je stvarno izvršena **read-only** nad DEV `leqcwgzvjsxugfgzdmth`: oba očekivana `pg_proc` source MD5 su usaglašena, **148/148** signatura je jedinstveno pronađeno, 124 su SECURITY DEFINER, digest pokriva **168** relacija i roster aggregate MD5 je `29b998de47c1dc86e28898ec378ac5f1`. Stvarni source digest `0c03679b287ed6d726b0b6845bedf54c1463d3fe0efcaf9cd8a947997e160b56` ostaje različit od postojećeg sertifikata `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`; `retention_ai_source_ready=false`. Ni jedan certifikat nije dodirnut, status `BLOCKED_NOT_ADMITTED`.
- **Dekompozicija preduslova:** proverena stvarna polja za 5 AI/retention relacija, obe AI kolonske projekcije, FK/on-delete ugovori, svih **13** očekivanih triggera sa oblikom i konfiguracijom i **3** closure pomoćne funkcije — svi pojedinačni ugovori trenutno su jednaki očekivanim. Još je lažan zbirni source digest/fiksni stari pin i jednako tako certifikat. Upoređeno svih 38 definisanih `CREATE OR REPLACE FUNCTION` tela u **stvarno primenjenom** kandidatu `closure-current-20261021/candidate.sql` sa trenutnim `pg_proc.prosrc`: **38/38 exact body MD5**, bez naknadnih promena tih konkretnih F01 funkcija. Stari `functions.readback.json` je snimak **pre primene** i 24/34 odstupanja su očekivane zamene tog istog paketa, ne novi incident. Preostale uzroke hash promene pripisivati ostalim izvorima/šemi i kasnijem odobrenom radu, ne prepisivati `closure_source_v5.sha256`, fixed ready pin niti zaključivati da je izmena F01 pogrešna.
- **Nivo dokaza/CI:** [full CI 40762193532](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40762193532) za closure-only izvor je otkazan zbog sledećeg PR commita; [R01 schema CI 40762193541](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40762193541) je i dalje **FAIL** na postojećoj strict granici. Prvi zajednički [full CI 40763030492](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40763030492) pokrenut je sa kasnijim R04 kodom, u trenutku unosa `IN_PROGRESS`. Nema izvršenja closure external adaptera, pravne politike, Auth/Storage brisanja, export/erasure provere, certifikacije ili DEV DDL.
- **Naredni korak:** pregled exact current-schema izvornih razlika **van** 38 već potvrđenih funkcija, uz puni katalog relacija/programa i nezavisan eksterni Auth/Storage/retention acceptance; R03 guarded kandidat ostaje `BLOCKED_FOR_EXECUTION` dok se pravi source i sertifikat ne usaglase po postojećem pravnom/tehničkom procesu, ne izmenom hash-a.

### R04 — paginacija celog AI kataloga bez lažnog „potpun” stanja (28.10.2026)

- **Kodni commit:** [`a9554d5cf47cfa8a9ff9ade172b520a26e6c1421`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/a9554d5cf47cfa8a9ff9ade172b520a26e6c1421), isto PR #43. `supabase/functions/_shared/backgroundTaxonomyArchitect.mjs` zadržava postojeći foreground/Save/proposal autoritet, ali menja `loadFullCatalogTree`: snapshot mora imati kompletan `count=categories.length` i unikatne ID-jeve; novi kompletan snapshot zamenjuje staru delimičnu memoriju čak pri istoj version/fingerprint. Fallback iz `rpc_taxonomy_query_catalog_service` iscrpljuje **svaki** ROOTS/CHILDREN `nextCursor`, proverava `operation/scope/count`, version/fingerprint, roditeljstvo i unikatne ID-jeve, odbija ponovljeni/stali cursor, promenjenu verziju i prekoračene resource granice umesto tihog šest-batch presecanja. `indexFullCatalog` cache dobija eksplicitnu `verifiedComplete` oznaku i nepotpune/pale operacije ne mogu ga zagrejati.
- **Testovi i bezbednost:** dodat je `supabase/proofs/ai/background_catalog_completeness.test.mjs` sa pet sintetičkih slučajeva: potpuni snapshot obnavlja cache, >100 ROOTS+CHILDREN redova (**251**), >6 batch-eva (**421**), ciklus/greška/cursor/version drifta i nepotpun snapshot odbijen bez fallback-a. Četiri postojeća mock snapshot testa ažurirana su stvarnim poljem `count`, bez promene provider modela, SQL ili korisničkog pristanka. Stvarna DEV katalogska read-only provera: **153/153 ESTABLISHED/root reachable** čvorova imaju direktan mode; trenutno nema mode-less structural ancestors, ali ovo nije budući globalni maksimum niti model accuracy dokaz.
- **Granica dokaza:** [CI 40763030492](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40763030492) za novi source bio je `IN_PROGRESS` u trenutku upisa; ne tvrditi PASS unapred. [R01 schema CI 40763030467](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40763030467) je odvojeni strict SQL gate, bez veze sa uspehom katalogskog učitavanja. Ovo zatvara samo problem *nepotpunog fallback čitača*, ne R04 u celini: semantic REUSE, hijerarhija, BOTH/handoff, potpisani pregled, save/binder/readback, real Gemini, uređaj i deployment ostaju `UNPROVEN`.
- **Sledeći korak:** uzeti stvarni full CI ishod, popraviti samo potvrđenu regresiju ako postoji; zatim upariti fallback complete node count sa server META/semantic ancestor pravilom i nastaviti R04 po postojećem §6, bez treće AI strategije ili dupliranja master plana.

### Provera potpunosti prenosa i pravilo nastavka — 28.10.2026.

Na udaljenoj grani do `d980c2f82c09ef968ea4c5de4fcb038d4387f98d` ponovo su provereni Git bajtovi sva tri paketa: REV14 11 fajlova, REV10 139 fajlova i izvršni paket 155 fajlova. Oba originalna ZIP-a su bajt-po-bajt identična dostavljenim prilozima; sva tri odgovaraju SHA-256 manifestu, a provera 305 članova prolazi. Izvršni paket je istorijski presek prenosa, ne automatski arhiv svake buduće CI sesije. Noviji kod i izvršne dopune postoje u istoj grani i ovom planu; novije CI rezultate čitati preko konkretnih run linkova iz tih zapisa.

`docs/continuation/NASTAVAK_RADA.md` sada izričito daje prednost najnovijem izvršnom zapisu nad svojim starijim statusima i prvim korakom. Za nastavak koristiti postojeće nalaze, cilj, pogođene putanje, zavisnosti i acceptance iz ovog plana i njegovih punih izvora. Ne ponavljati opšti audit ZIP-ova ili završene popravke; ponovnu proveru ograničiti na promenu izvora/okruženja, nedostajući dokaz ili novu regresiju i upisati razlog. Ova dopuna ne zatvara R/C/SV zadatke niti potvrđuje deployment.


### R04 — autoritativan parent-first katalog za oba AI toka (28.10.2026)

- **Owner/source:** R04/F04, `IN_PROGRESS`, commit [`b0e8748a1d210ce55bae220c59de8d1e325a7b25`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/b0e8748a1d210ce55bae220c59de8d1e325a7b25), postojeći `work/rev14-review-f17` i draft PR #43. Dopuna `supabase/functions/_shared/backgroundTaxonomyArchitect.mjs` poziva isti čisti `formatFullCatalogHierarchy(catalog)` u **oba** modela (requester/worker), umesto prvobitnog abecednog `catalog.categories.map` prikaza sa indeksom dubine. Svaka kategorija ide stabilno u parent-first redosledu, sa eksplicitnim `id`, `parentId`, `pathIds`, tekstualnim `path`, `aliases`, `modes` i `isLeaf` u JSON-kodiranoj liniji. Originalni identiteti, model, handoff/consent, Save/binder, RPC/DB i poslovni autoritet ne menjaju se.
- **Nove negativne kontrole:** `supabase/proofs/ai/background_catalog_hierarchy.test.mjs` proverava nestabilan red ulaznog snapshot-a, višeslojnu granu, dva korena, strukturalnog pretka bez sopstvenog mode-a, alias/Unicode/escaped model-like vrednosti, ciklus, nedostajućeg roditelja, duplikat ID, lažni isLeaf i preveliki model unos. Formatter zahteva `verifiedComplete=true`, sprečava dvostruko/neodređeno roditeljstvo, koristi ograničenje dubine 32 i budžet 350 KB (radije odbijanje nego pogrešan AI smisao). Test je source-only: ne pokreće Gemini provider niti dokazuje kvalitet semantike ili API izvršavanje.
- **Provereni zatečeni server ugovor:** od ranije potvrđeni [full CI 40764294407](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40764294407) je `SUCCESS`; [R01 Schema 40764294393](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40764294393) ostaje `FAIL`. Izvor `rpc_taxonomy_fetch_snapshot_v1` daje `categoryId, parentId, aliases, modes, path, pathIds, isLeaf` za sopstveno mode-enabled ESTABLISHED čvorove. Mode-less structural ancestors u tom izvornom JOIN-u nisu garantovano emitovani; trenutno DEV 153/153 root-reachable čvora imaju sopstveni mode, ali ako kasnije postoji mode-less posrednik, puni formatter ga mora odbiti kao orphan i nije dozvoljeno izmišljati njegov ID. To je budući uslov usaglašavanja snapshot SQL-a / semantičkih predaka, ne razlog za tiho nepotpun katalog.
- **Novi izvršni CI:** [full CI 40773006988](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40773006988) i [R01 Schema 40773007042](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40773007042) pokrenuti su na identičnom `b0e8748...` source-u; u trenutku ovog zapisa su `IN_PROGRESS`. Ne tvrditi da je nova formatter implementacija već verifikovana punim CI-jem. Nema Supabase migracije, AI Edge deploy-a, native/OTA APK-a ni produkcionog prikaza.
- **Prvi sledeći korak:** pročitati stvarne GitHub job rezultate i ispraviti samo potvrđenu novu deltu. Potom nastaviti R04 po postojećem §6: semantički REUSE i verna hijerarhija, kompletan BOTH/mode/handoff, stari/novi katalog pod stvarnim servisnim API-jem, stvarni Gemini izlaz kroz signed review/Save/worker + requester binder i uređajski dokaz. R01 privatnost i R03 closure ostaju zasebno blokirani i ne smeju biti preskočeni.


### R04/F04–F08 — proverena struktura pre cache-a i eksplicitno nedovršen BOTH/semantic reuse (28.10.2026)

- **Stvaran početni CI nalaz:** [full CI 40773006988](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40773006988), source `b0e8748a1d210ce55bae220c59de8d1e325a7b25`, završio je **FAIL** u `AI intake and taxonomy contracts`, dok su **614/614 Jest suite-a, 14.118/14.118 testova, TypeScript i Deno prošli**. Tačan novi uzrok: istorijski sintetički snapshot u `background_taxonomy_failures.test.mjs` i `background_taxonomy_scope.test.mjs` nije imao serverova stvarna obavezna `parentId`/`isLeaf` polja, pa je novo fail-closed formatiranje sprečilo provider poziv (test je očekivao jedan). [R01 schema CI 40773007042](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40773007042) je očekivani zaseban **FAIL**; ne menja R04 poslovni rezultat.
- **Zaokružena prva implementacija:** commit [`2c4b781b87fafd317558c0c60c079f6dce419038`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/2c4b781b87fafd317558c0c60c079f6dce419038), na istoj `work/rev14-review-f17`/draft PR #43. Bez oslabljivanja formattera, popravljena su oba fixture-a na realnu SNAPSHOT strukturu; `loadFullCatalogTree` **pre cache-a** proverava kompletnu parent-first hijerarhiju, i na SNAPSHOT i na paged ROOTS/CHILDREN grani. Nedostajući eksplicitni `parentId`, orphan, ciklus, leaf-koji-ima-decu, nekompletan/pogrešan format ili budžet odbijaju potpuni rezultat i ne zagrevaju cache. `background_catalog_hierarchy.test.mjs` dodatno prolazi kroz oba prava BG model buildera sa presretnutim Gemini transportom; proverava iste parent/pathIds/aliases/modes, isti model ulaz nezavisno od server sort reda, i odbijanje malformed snapshot-a bez provider poziva i sa kasnijim ispravnim oporavkom. Ovo je source/synthetic transport dokaz, ne stvarni Gemini modelski kvalitet.
- **Zaokružena druga implementacija R04/BOTH:** commit [`2b509ac10049ccc242b0aacadb9000c710d039a8`](https://github.com/uskocibusiness-boop/USKOCI-EAN/commit/2b509ac10049ccc242b0aacadb9000c710d039a8), na istoj grani. `buildWorkerFullTreeTaxonomyProposals` sada čuva `unresolvedServices` i kad je jedan od dva izričito potvrđena mode-a nerazjašnjen, kad validna `NEEDS_CLARIFICATION` postoji ili kad model pokušava neupisani semantički `REUSE_EXISTING` umesto dozvoljenog pisanog alias-a/ID-a. Sačuvan validan drugi mode predlog ostaje samo **neautoritativan hint**, bez default handoff-a i bez lažnog READY. Četiri nova negativna/pozitivna testa pokrivaju potpuni ON_SITE+REMOTE sa USER-quoted consent i potpisanim handoff-om, delimičan odgovor, odbijeno semantičko REUSE i razjašnjenje samo jednog mode-a. Nijedna postojeća SQL funkcija, review/binder/Save grant ili AI provider ugovor nije prepravljena.
- **Potvrđena preostala serverska granica (DEV read-only katalog):** `private.taxonomy_review_exact_projection_v1` (MD5 `68eea7a2a923f558f2c27cc6c58f7073`) priznaje samo *stvarni canonical naziv ili registrovan alias*; `private.taxonomy_review_candidate_projection_v2` (MD5 `f9318f476e32a8233fbb07ccf5d22aeb`) ne daje READY za neupisan model-predložen sinonim bez dodatnog server/owner postupka. `public.rpc_taxonomy_prepare_admission_service` (MD5 `8fb67af44c4de3bc93cf2144fd6629c6`) zahteva plan doslovno prikazan u potpisanom tekućem user review-u. `rpc_taxonomy_capture_gemini_turn_hints_service` može čuvati partial hints sa `authority:NONE`, ali server review mora odbiti nepotpuni worker mode skup. Ovo je eksplicitni **R04 semantic REUSE blocker**, ne dozvola da model sam stvori ili dodeli identitet. Za dozvoljeni nastavak zahteva se odvojeno reviewed server contract/prepare/Save/binder i signed acceptance, ne neprovereni `REUSE_EXISTING` shortcut.
- **Nova provera i granica:** source `2c4b781...` pokrenuo je [full CI 40774711153](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40774711153) i [R01 schema 40774711156](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40774711156), dok `2b509ac...` pokreće [full CI 40775347177](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40775347177) i [schema 40775347181](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40775347181). U trenutku zapisa novi CI je `PENDING/IN_PROGRESS` — njegov finalni PASS se **ne pretpostavlja**. Stari R01 strict FAIL se ne menja. Nema live Supabase migracije, Edge deploy-a, native/OTA ni store release.
- **Naredni owner po istom §6 R04:** preuzeti stvarni CI ishod i precizno popraviti samo novu regresiju ako je ima. Zatim kompletan `BOTH` i semantic `REUSE` dokaz kroz aktivan capture/READY review/owner Save/binder/readback, uz strogo odvojeno source-only model proveravanje; po potrebi **poseban** zatvoren server kandidat tek nakon aktuelnih source pinova i legitimnog sadržinskog admission-a. R06 je zaseban trajni retry/transport/price owner; partial BG output za sada nije sam po sebi trajni dovršeni posao. R01/R03 ostaju blokirani realnim Auth/PostgREST i closure uslovima. Ne otvarati novu master dokumentaciju.


### R04 model size i R05 saved-area / TODAY source polazište (28.10.2026)

- **R04 DEV current-format bound — isključivo read-only kategorije, bez poruka ili profila:** 153 `ESTABLISHED` root-reachable kategorije, 152 podkategorije, 1 root, 17 aliasa, maksimalna dubina 5, 0 mode-less čvorova i 0 nedostajućih roditelja. PostgreSQL `jsonb_build_object` procena celog strukturisanog parent/pathIds/model ulaza je **64.826 bajtova** (najveća linija 507 bajtova), ispod 350.000-byte ograničenja `formatFullCatalogHierarchy`. Ovo je **PROCENA na stvarnom DEV katalogu**, ne tačan JS runtime bajt-otpis, Gemini poziv ili futura katalogska garancija. Potvrđuje da postojeći R04 strukturni problem nije opravdanje da se cache pusti parcijalno.
- **R05/F18 potvrđen trenutni DEV source ugovor, bez izvršavanja matchera nad nalazima korisnika:** `private.candidate_profile_ids(uuid,integer)` MD5 `5414fa5a122e2055c71dd37993a6ad83` i `candidate_profile_ids_v1b(uuid,integer,integer)` MD5 `9a2437fd9d6bed07c8338d12501e5cba` oba selektuju samo radnike sa starim `worker_match_preferences.approximate_geog` na udaljenosti do 300 km ili potpuno bez stare profilne tačke pre konačne `dispatch_cheap_candidate_admitted` provere. To može izazvati lažno negativan COUNTRY/CITY/RADIUS *saved workAreas* rezultat, jer se merodavno sačuvano područje tek kasnije čita. `worker_saved_areas_v1(uuid)` MD5 `f8bf79ee54bd283d226e607d51e89291` čita `{profile,workAreas}` iz poslednjeg potvrđenog `worker_ai_saves`/review envelope, a ne iz samostalne geografski indeksirane work-area tabele. `worker_area_fit_v1(jsonb,text,text,text,numeric,numeric)` MD5 `4dd025df4d3d4092a13e06329837ae58` trenutno dopušta geografski mode samo za `STATIONARY` u `RS`. `worker_need_fit_v1` MD5 `9db80655bfbc9719440bd26459904ab0` koristi to potvrđeno područje pre service/time-tier-a. `worker_need_time_tier_v1` MD5 `a845d98b624ae4ac8ec33159beb8bb17` još nema zasebnu TODAY_FLEXIBLE null/null dostupnost iz plana.
- **R05 acceptance i zabrane:** korisnička odluka D08 je *start location* za povezivanje. Ne menjati postojeće matcher/filter/time/dispatch hard gate niti širiti all-profile scan bez indeksiranog i budžetiranog izvora, per-pair SQL/Auth prefilter→fit→match→dispatch matrice, ručne prijave i WORLD/consent provere. Ne inferirati rutu, drugi servisni pin, radijus ili ETA. Ovo je `R05 INVESTIGATED/NOT_IMPLEMENTED`; priprema scoped candidate treba da sledi iz važećih Z10/F18/SB12/Z09 i ovih DEV pinova, ne iz starog nepovezanog testa.
- **Nova R04 test granica:** [full CI 40775347177](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40775347177) je pri ovom zapisu `IN_PROGRESS`; `R01 Schema 40775347181` je **FAIL** sa 8 strict odstupanja, bez promene kanonskog SHA `1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f`, bez fixtures/DEV write/live kandidata. Ne upisivati R04 PASS pre završnog job loga.

<!-- EXECUTION-UPDATE-END: ledger-20261028 -->
### 11.3. Zapis jednog završenog ili blokiranog koraka

| Polje | Sadržaj koji se ažurira u ovom planu |
|---|---|
| Identitet | Datum; R/J/F/SB/X/C; tačna namera i obuhvat. |
| Polazište | Repo/branch/SHA; relevantni backend/Edge/native/OTA; korisnička odluka ako je promenjen ugovor. |
| Promena | Postojeći vlasnici, konkretne putanje i efekat koji korisnik dobija. |
| Očuvano | Granice naloga/revizije, prava, saglasnosti, idempotentnost i podržani čitači. |
| Provera | Stvarna komanda ili uređajski scenario, ulazi, vreme, rezultat i nivo dokaza. |
| Negativna kontrola | Koji pogrešan, tuđ, zastareo ili nepoznat ishod je zaista odbijen/rešen. |
| Status | DEFINED / IN_PROGRESS / IMPLEMENTED / VERIFIED na navedenom nivou; BLOCKED sa konkretnim razlogom; REJECTED uz razlog. |
| Isporuka | Commit/diff/build/OTA identitet gde postoji; bez tvrdnje o neizvršenom deploy-u. |
| Ograničenje i nastavak | Preostali posao, njegov vlasnik/zavisnost i prvi sledeći dozvoljeni korak. |

Statusi mogu biti jednostavniji u postojećem repo registru, ali značenje mora ostati isto. Ne održavati dve neusaglašene verzije činjenice. Ako je rezultat istorijski, navesti tadašnji presek i relevantnu razliku.

### 11.4. Izvršni nalog za narednu odobrenu implementacionu sesiju

Sledeći tekst je sastavni deo ovog plana i može se koristiti kao početni nalog uz korisnikovo zaduženje za implementaciju:

> Nastavi USKOČI iz aktuelnog fizičkog repozitorijuma prema ovom jedinstvenom `CODEX_PLAN_RADA.md`. Pročitaj stvarno dostupna važeća repo uputstva, README i STATUS; proveri relevantnu deltu od `a9692e11942609bab9406215c3e407d79589dafa`, stvarne pogođene server/klijentske ugovore i poslednje korisničke odluke. Sačuvaj novije izmene i postojeće dobre vlasnike. Ne rekonstruiši stari projekat iz memorije.
>
> Prvo zatvori R01 privatnu kolonsku granicu i tačan kompatibilni ugovor. R02 i R03 mogu zatim napredovati nezavisno gde ne menjaju istog vlasnika. R04/R06 povezuju potpun semantički rezultat i trajni nastavak; R05/R07/R08 dovršavaju stvarni poslovni i korisnički rezultat. Nezavisne R09/R10/R11 popravke izvodi po njihovim stvarnim zavisnostima. R12 prikuplja integracioni i uređajski dokaz od prve završene celine, a konačni release prolaz dolazi posle relevantnih kapija.
>
> Za svaku vertikalu poveži korisničku radnju, postojeći reader/writer, UI stanje, tačnu proveru i gde je potrebno telefon. Sačuvaj account/focus/revision granice, journal pre slanja, signed review, stvarnu saglasnost, stabilan identitet i readback. Predlog, Save, aktivacija, objava i matching autoritet ostaju različiti. Ne uvodi treći AI sistem, parcijalne kartice, dodatne obavezne formulare ili stare PHONE/HITNO/naknade iz istorijskih testova.
>
> Izaberi najmanju povezanu promenu koja rešava potvrđeni uzrok. Sačuvaj relevantne postojeće provere i dodaj samo nedostajući dokaz stvarnog rizika. CI i izolovana proba ne predstavljaju sami native/server/model PASS. Zastareo karakterizacioni PASS promeni tek zajedno sa stvarnom popravkom i odgovarajućom kontrolom. Stare SQL kandidate ne primenjuj kao celinu preko novijih funkcija.
>
> UI/UX razradi u istom radu: stvarni prikazi, nazivi, glavni i sporedni koraci, loading/empty/error/partial/offline/unknown, povratak, tastatura, veliki font i pristupačnost. Novi prikaz mora biti povezan sa pravim stanjem; screenshot ne zamenjuje readback. Ne traži ponovo ista tri stara snimka. Za nedostajuće aktuelne prikaze pripremi konkretnu malu grupu scenarija i nastavi sve što ne zavisi od njih.
>
> Satnicu i višelokacijsko područje razreši konkretnim prikazom opcija iz odeljka 9 kada zahvaćeni ugovor dođe na red. Nepovezane poznate popravke ne zaustavljaj. Tehničke izbore rešavaj samostalno unutar važeće namere; korisniku ostavi stvarne poslovne i veće vizuelne odluke.
>
> Čišćenje sprovedi po C paketima tek uz potvrđene potrošače, zamenu i potreban dokaz. Primenjene migracije, neophodni rollback/audit izvori i aktivni delovi mešovitih modula ostaju. Puni SV manifest je u paketu; njegov istorijski plan nije automatski DROP nalog. Proveri sadašnje objekte, sve izvršne preduslove i kompatibilnost. Production guard, izvoz/closure binding i privatnosna ograničenja se sadržajno zadovoljavaju, ne zaobilaze.
>
> Posle svakog završenog dozvoljenog koraka ažuriraj ovaj isti plan: šta je promenjeno, zašto, kako je provereno, na kojoj verziji, šta ostaje i koji korak sledi. Nastavi sledeći relevantan dozvoljeni korak bez rutinskog traženja nove potvrde. Ako postoji stvarna prepreka, precizno je navedi i završi nezavisan rad. Produkcionu predaju pripremi kao konkretan pregledljiv kandidat; izvrši je kada važeće korisničko ovlašćenje pokriva tu radnju.

### 11.5. Prvi pregledljiv izlaz nastavka

Prvi izlaz nije novi opšti izveštaj. To je osvežen zapis relevantnog izvora i ugovora, konkretna popravljena R01 granica sa pozitivnim/negativnim dokazom kada je implementacija odobrena, pa prva završena R02/R03 vertikala prema zavisnostima. Uz to nastaje početna matrica stvarnih ekrana i nedostajućih prikaza, sa poznatim identitetom telefonske verzije. Potreban dokaz i blokade beleže se ovde.

Rok se određuje prema stvarnom izvršnom preseku, obimu zahvata, uređajima i uslovima prodavnica. Dužina dokumenta, broj fajlova ili veliki broj starih testova nisu osnov za datum. Konačan pregled R12 mora pokazati stvaran proizvod koji korisnik može proći, a ne samo zbir zatvorenih tehničkih kartica.

## 12. Izvori, način korišćenja i obuhvat objedinjavanja

### 12.1. Šta je u jednom ZIP-u i kojim redom se čita

| Fajl ili skup | Uloga u radu | Kada se koristi |
|---|---|---|
| [PROCITAJ_PRVO.md](PROCITAJ_PRVO.md) | Kratak ulaz, identitet paketa, redosled čitanja i granice. | Prvi ulaz u novi razgovor ili radno okruženje. |
| [CODEX_PLAN_RADA.md](CODEX_PLAN_RADA.md) i [CODEX_PLAN_RADA.pdf](CODEX_PLAN_RADA.pdf) | Jedan operativni plan u dva formata; zadaci, kompletni SV uslovi i mapa izvora. | MD za Codex i izmene, PDF za pregled. PDF nije drugi plan. |
| [USKOCI_IZVESTAJ.md](USKOCI_IZVESTAJ.md) i [USKOCI_IZVESTAJ.pdf](USKOCI_IZVESTAJ.pdf) | Jednostavnije objašnjenje stanja, uzroka i pravca dovršavanja. | Da se razume smisao zahvata i celokupno ponašanje. |
| [TEHNICKI_DOKAZI.md](TEHNICKI_DOKAZI.md) | Tehnička referenca; tačan izvor, nalaz i nivo dokaza. | Relevantan odeljak pre izmene konkretnog vlasnika. |
| [MANIFEST.json](MANIFEST.json) | Tačan spisak sadržaja, veličine i SHA-256 otisci finalnih fajlova. | Provera da je ZIP potpun i da sadržaj nije pomešan sa drugim revizijama. |
| `dokazi/` | Izvorni registri, sačuvane SQL definicije, Edge poređenja, probe/rezultati, slike i trag provere. | Ciljano prema tabeli ispod; bez slepog izvršavanja istorijskih skripti. |

**Glavni dokumenti jesu dovoljni da se razume cilj i redosled, ali nisu dovoljni za svaki tehnički zahvat.** Za povlačenje serverskog objekta trebaju njegove stvarne zavisnosti i pun SV zapis; za čišćenje tačna putanja i njeni potrošači; za izmenu testa potrebno je znati šta je raniji rezultat zaista dokazivao. Zato su dokazi uključeni i povezani sa zadacima. Ne čitaju se svih 120 prvobitnih priloga pri svakom koraku, ali se ne uklanjaju iz predaje.

Pre rada: otvoriti ovaj plan i relevantni zapis u tehničkoj referenci; iz mape izabrati dokaz; proveriti verziju izvora; osvežiti pogođeni kod/server; tek zatim izmeniti i dokazati konkretan rezultat. Zapis novog rezultata unosi se uz isti zadatak. Novi dokaz ne prepisuje istorijski log ili potvrdu.

### 12.2. Mapa zadataka i potrebnih dokaza

### Mapa rada do priloženog dokaza

Dokazi navedeni ovde priloženi su uz plan. Nema potrebe da se pri svakom malom zahvatu ponovo čita ceo paket: prvo otvoriti zapis zadatka, zatim konkretan nalaz/objekat i njegove potrošače. Pre promene proveriti relevantno sadašnje stanje prema zabeleženom source/deploy preseku. Prisutan JSON, istorijski PASS ili isti hash sami ne predstavljaju novo izvršenje.

**Osnovni lokatori:**

- [Z10 — izvršni registar](dokazi/izvrsivost/readiness_review.json): `execution_matrix.tasks[]` po `id=R01…R12`; `execution_matrix.findings[]` po F/SB/X oznaci; `execution_matrix.r11_subtasks`; `decisions`; `cleanup`. F03 važeća operativna polja su u nalazu; raniji tekst ostaje pod `operational_reconciliation_history`.
- [Z09 — namera i testovi](dokazi/namena_i_testovi/intent_review.json): `test_matrix.work_items[]` po R oznaci, `ci_selection`, `test_command_review`, `journey_matrix_markdown`, `target_decisions`. `existing_checks` govori šta postojeća provera zaista pokriva; nedostajući acceptance i dokaz izvršenja čitaju se zasebno.
- [Pojedinačni registar izvora](dokazi/registar/consolidated_read_register.json): `files[]` po tačnoj `path`, zatim `purpose`, `runtime_role`, `disposition`, `caller_evidence` i vezani read/hash/diff dokazi. Za tekuću odluku o povlačenju prvo pogledati i normalizovani Z10 zapis iste putanje.
- [Z16 — serverski manifest](dokazi/server_final/change_manifest.json): `proposed_changes[]` po `id=SV01…SV14`; `object_inventory[]` po tačnom `identity` i `kind`; `schema_semantic_object_dispositions`, `operational_object_dispositions`, `edge_deployment_inventory` i `schema_role_default_acl_dispositions`. Inventar sadrži 3.037 zapisa, ali se konkretna izmena ne odobrava samo na osnovu prisustva zapisa ili odsustva literalnog pozivaoca.

U serverskim dokaznim JSON fajlovima `files[]` je spisak **ugrađenih dokaza**, a polje `path` bira unutrašnji zapis. Na primer, `files[path="schema_review.json"].data.objects` znači: u spoljašnjem [schema_review.json](dokazi/server_final/schema_review.json) naći element čiji je `path` baš `schema_review.json`, pa otvoriti njegov `data.objects`. To nije nedostajuća druga datoteka. Sirov capture zadržava query, UTC i nivo dokaza u svojim `data` poljima; istorijski nazivi i hash-evi ostaju proverljivi.

| Rad | Prvi obavezni dokaz i JSON ključ | Šta se iz njega proverava |
|---|---|---|
| R01 | Z10 `execution_matrix.tasks[id=R01]` / nalazi F21,F14; Z16 SV01,SV13; [schema](dokazi/server_final/schema_review.json) `files[path="schema_review.json"].data.table_acl_ledger`, `function_acl_ledger`, `schema_roles_default_acl_settings_ledger`, `objects` | Tri privatne kolone, dozvoljene projekcije, RLS/helper/default prava, Auth granice; aktuelan API dokaz se tek izvodi. |
| R02 | Z10 R02 i F15–F17/SB11; [discovery read ledger](dokazi/discovery/read_ledger.json), [baseline poređenje](dokazi/discovery/live_baseline_comparison.json), [karakterizacije](dokazi/discovery/characterization_results.json) `testResults`; Z09 R02 | Stvarni wire/decoder, MAP/PAGE/PLACES i odvojeni ishodi, prvi ulaz/retry, HALF/FULL/PEEK i dijagnostika. Karakterizacija starog kvara nije popravljen proizvod. |
| R03 | Z10 R03/F01; Z09 `test_matrix.work_items[id=R03]`; Z16 `object_inventory` za `rpc_list_my_needs_page`; [pročitana funkcijska tela](dokazi/zavrsni_pregled/function_body_review.json) `complete_body_coverage` | Pet scope-ova/counts, prazna/neprazna i naredna strana, pravi decoder i očuvani kompatibilni baseline helper-i. |
| R04 | Z10 R04/F04/F05/F08; Z16 SV02,SV03,SV09; [Edge](dokazi/server_final/edge_review.json) `files[path="classification_cache_report.json"].data`, `files[path="read_ledger.json"].data`; Z09 R04 | Potpun katalog, roditelji/aliasi, reuse/nova grana, očekivani ceo skup modova, aktivan source/deploy put i očuvani ID. |
| R05 | Z10 R05/F18/SB12; Z09 R05; Z16 `object_inventory` i [funkcijska tela](dokazi/zavrsni_pregled/function_body_review.json) `complete_body_coverage` za retrieval/area-fit/time-tier/dispatch vlasnike | Saved-area nadskup kandidata, TODAY/null/zona, podržana topologija, granica ručne prijave i zasebna D08 odluka. |
| R06 | Z10 R06/F06/F07; Z16 SV02–SV04; [Edge](dokazi/server_final/edge_review.json) `classification_cache_report.json`, `read_ledger.json`, `source_deployed_parity.json` unutar `files[]`; [semantički probe](dokazi/ai/semantic_completion_probe.json) `cases`, `definitionParity`, `limitations` | Trajan prvi plan, post-save razlika, revision continuity, provider pokušaji/budžet/UNKNOWN, STOP/body limit i odvojen STT slučaj. |
| R07 | Z10 R07/F02/F03/F11/F13 i `operational_reconciliation_history`; Z09 R07, `target_decisions` i `root_recheck`; [istorijska price-basis preciznost](dokazi/prethodna_etapa/price_basis_material_parity.json) | RSD/OFFERS bez nove valute, zasebna D06 satnica, abandon readback, CAS sporednog profila, A24 i povučena priceBasis sumnja. |
| R08 | Z10 R08/F09/F10/F12; Z09 R08 i `journey_matrix_markdown`; Z16 SV02/SV03 prema pogođenom vlasniku | Autoritativan završetak, jedno stvarno pitanje, per-service saved prikaz, potpisani izbor Save/Save+activate i zasebna spremnost za povezivanje. |
| R09 | Z10 R09/F20/SB08/SB10; Z16 SV05; [operacije](dokazi/server_final/operations_review.json) `files[path="chain_matrix.json"].data.chains`, `files[path="object_inventory.json"].data.objects`, `files[path="final_operational_aggregate_capture.json"].data` | Cron/HTTP/claim/provider/device su različiti nivoi; stale readiness, kapacitet, suppression, PUSH-only target i group visibility. |
| R10 | Z10 R10/F19/SB03; Z16 SV06/SV10; [operacije](dokazi/server_final/operations_review.json) `object_inventory.json` i `chain_matrix.json` unutar `files[]`; [schema](dokazi/server_final/schema_review.json) `findings.json` / `schema_review.json` unutar `files[]` | workAreas u svim kopijama, consent recovery, Storage/Auth lifecycle i istinit binding pre aktivacije. Strukturisani reset arhiv nije višak za opšte brisanje. |
| R11 | Z10 `execution_matrix.r11_subtasks`, odgovarajući SB/X i C paket; Z09 R11; pojedinačni izvorni registar po `path`; Z16 SV07–SV13 gde postoje server veze | Tačan simbol/test-blok, aktivna zamena, podržani potrošači, safety/revision granice i relevantan native dokaz. |
| R12 | Z10 R12/F14; Z09 R12 i `live_freshness`; Z16 SV14; [migration/performance](dokazi/server_final/migration_performance.json) `files[path="migration_provenance.json"].data`, `files[path="recent_migration_diffs.json"].data`; [server receipt](dokazi/server_final/server_review.json) `coverage`, `remaining_limits`, `execution` | Čist bootstrap i zaseban upgrade, stvarno poreklo, source/SQL/Edge/flags/native/OTA/device tuple; ranija analiza nije release PASS. |

**C01–C19:** svaki pojedinačni paket ima pun zapis u Z10 `cleanup.retirement_batches[]` po `id`. Pre promene otvoriti `targets`, `remove_or_rebind_sr`, `preserve_sr`, `before_edit_sr` i `acceptance_sr`; zatim za pogođenu putanju `cleanup.normalized_path_index[]`. `cleanup.exact_duplicate_groups` čuva 41 grupu/91 putanju i hash poređenje, a `cleanup.required_per_change_record` obavezna polja odluke. Broj 180 putanja i 912 uslovnih razvrstavanja ne označava broj odmah obrisivih fajlova. C06 je jedan duplirani test-blok; C11 se usklađuje sa SV08; C17 zahteva build/CI rebind; C19 ne briše primenjenu SQL istoriju.

| SV grupa | Puni zapis i njegov zadatak | Dopunski dokaz koji se otvara pre promene |
|---|---|---|
| SV01 | Z16 `proposed_changes[id=SV01]`; R01/R12 | Schema `schema_review.json` unutar `files[]`: objekti i svi relevantni table/function/schema/default ACL registri. |
| SV02 | Z16 `proposed_changes[id=SV02]`; R04/R06/R12 | Edge `classification_cache_report.json` i `read_ledger.json`; katalog i odgovarajući funkcijski identitet u Z16. |
| SV03 | Z16 `proposed_changes[id=SV03]`; R04/R06 | Edge isti klasifikacioni/keš dokaz, oba handlera i provider ugovor; Z10 F04–F08. |
| SV04 | Z16 `proposed_changes[id=SV04]`; R06/R12 | Edge `files[path="notes/diff_uskoci-taxonomy-postsave-worker_index_ts.diff"].data` i `source_deployed_parity.json`; operations post-save lanac. |
| SV05 | Z16 `proposed_changes[id=SV05]`; R09/R12 | Operations `chain_matrix.json`, poslednji operativni agregat i source/worker inventar; Z10 F20. |
| SV06 | Z16 `proposed_changes[id=SV06]`; R10/R11/R12 | Schema `findings.json`; operations `object_inventory.json` i lifecycle lanci; svi workAreas projektori i potrebne kopije. |
| SV07 | Z16 `proposed_changes[id=SV07]`; R11/R12 | Tačan funkcijski `identity` u `object_inventory`; schema `auth_function_read_ledger.json` i grantovi; podržani stari klijenti. |
| SV08 | Z16 `proposed_changes[id=SV08]`; R11/R12 | Tri navedena potpisa i `access_grants_channel_check`; schema ACL/constraint/body dokaz, C11, istorijska revokacija i receipt kompatibilnost. |
| SV09 | Z16 `proposed_changes[id=SV09]`; R04/R11/R12 | Namerno odbijajući wrapper i njegove reference; dokaz da kompatibilno odbijanje više nije potrebno pre povlačenja. |
| SV10 | Z16 `proposed_changes[id=SV10]`; R10/R11/R12 | Tačno sedam meta, operations closure inventory i schema objekti; explicit KEEP izuzetak reset arhiva pod SV06. |
| SV11 | Z16 `proposed_changes[id=SV11]`; R11/R12 | Migration/performance `files[path="captures/taxonomy_scope_index_equivalence.json"].data` i `performance_adjudications.json`; PK ostaje. |
| SV12 | Z16 `proposed_changes[id=SV12]`; R11/R12 | Edge `files[path="bundle_manifest.json"].data.functions` i deployovani sadržaji; debug tabela, spoljni potrošači i retention. |
| SV13 | Z16 `proposed_changes[id=SV13]`; R01/R11/R12 | Schema nalazi/ACL; migration/performance `captures/security_advisors.json`; stvarna Auth management ograničenja i net potrošači. |
| SV14 | Z16 `proposed_changes[id=SV14]`; R12 | Migration/performance `migration_provenance.json`, `recent_migration_diffs.json`, `captures/catalog_dependencies.json`; source baseline i posebni fixture preduslovi. |

Za serverske veze `migration_performance.json` sadrži `files[path="captures/catalog_dependencies.json"].data`. Za tačnu semantiku šeme koristiti i `schema_review.json` unutrašnje `objects`, `dependency_manifest`, ACL registre i `limitations`. Time su dostupni postojeći dokazi; još se ne tvrdi potpun dinamički pozivni graf, potpuna Auth management konfiguracija ili spremnost produkcije.

### 12.3. Poreklo konsolidacije i očuvanje materijala

Priloženi dokument sa oznakom rev9 nastao je iz naše rev7 osnove i spoljne rev8 dopune. Kao ulaz D3 navodi SHA `6415f2b7ddf2f95e4f087d69898e8594ff5d9745988c6caf183468f46058ce4b`, što nije naš poslednji rev9 plan. Zato su dve isto nazvane verzije upoređene sadržajno i objedinjene u nedvosmislenu reviziju 10.

| Ulaz | Identitet | Uloga |
|---|---|---|
| [Priloženi rev9 plan](dokazi/objedinjavanje_rev10/ulazi/prilozeni_plan_rev9.md) | SHA `53e33f95e00c5685092042ce77fc717209baf07064c5c646a457df7fb82c9164`. | Organizacija samostalnog priručnika, detaljni zadaci/cleanup/testovi i korisnička završnica. Istorijski ulaz, ne važeći nalog. |
| [Naš poslednji rev9 plan](dokazi/objedinjavanje_rev10/ulazi/nas_plan_rev9.md) | SHA `ebaecbe70397d567ba2da322ed331ac26fd039dcc666041d6cff9c12c812b674`. | Precizniji review/Save/publish, release/native poslovi i veze sa punim dokazima. Istorijski ulaz, ne paralelni plan. |
| [Manifest prethodnog paketa](dokazi/objedinjavanje_rev10/ulazi/manifest_rev9.json) | Svih 130 payload zapisa provereno pre konsolidacije. | Kontrola da nijedan prethodni dokazni fajl nije ispao; stare interne vrednosti ostaju istorijske. |
| [Zapis objedinjavanja](dokazi/objedinjavanje_rev10/merge_review.json) | Ulazi, primenjene korekcije, pokrivenost, završni pregled i granice. | Proverljiv trag za reviziju 10. |
| [Provera finalnog paketa](dokazi/VERIFIKACIJA.json) | Tekuća provera sadržaja i prethodne potvrde u istoriji. | Razdvaja dokumentacioni prolaz od neizvršenog aplikacionog/server/uređajskog dokaza. |

Ranija izjava drugog četa da 120 dokaza nije dostavljeno opisuje tadašnje priloge, ne ovaj paket. Ovde su dostupni ceo prethodni paket, puni Z09/Z10, registar svih putanja, svih 14 SV zapisa i originalne slike. Ne izmišljaju se izgubljeni podaci i ne nalaže se ponavljanje celog audita samo zbog tada nepotpunog priloga. Referentne putanje unutar neizmenjenih istorijskih ulaza tumače se prema njihovom tadašnjem korenu; za aktuelnu navigaciju koriste se linkovi ovog plana i MANIFEST.

### 12.4. Granice koje objedinjavanje ne može da pretvori u dokaz

Paket nije ceo Git repozitorijum niti prenos pristupnih ključeva. Za implementaciju je potreban pristup potvrđenom repozitorijumu i odgovarajućem okruženju. Zabeleženi source je `a9692e11942609bab9406215c3e407d79589dafa`; pred rad se proverava stvarni noviji HEAD i pogođena serverska delta. Nema novog GitHub/live Supabase/model/device/build/deploy prolaza u reviziji 10.

Originalni Downloads masterplan ostaje nedostupan; kompletna Auth management konfiguracija, stvarne Edge secret vrednosti, udaljeni Firebase/Apple/izdavački nalozi i konačni native/OTA sadržaj nisu ovim dokumentima potvrđeni. UI inventar, popunjene specifikacije svakog ekrana, novi nacrti, modelski/telefonski prolazi i rollout ostaju budući imenovani rezultati, sa četiri odvojena statusa.

Sačuvani su svi 42 nalazi, 12 R paketa, R11a–h, R12a–j, J01–J14, A01–A25, C01–C19 i SV01–SV14. Aktivne formulacije usaglašene su sa poslednjim preciznim ugovorima. D06 satnica i D08 više lokacija nisu rešeni umesto korisnika. Za svaku promenu koristi se postojeći vlasnik, najmanji opravdan zahvat i dokaz koji odgovara stvarnoj granici. Aktuelni dokument za nastavak je ovaj plan; izveštaj, PDF formati i dokazi služe istoj celini.
