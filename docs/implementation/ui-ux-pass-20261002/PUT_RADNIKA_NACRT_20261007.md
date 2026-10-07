# Put radnika — NACRT za odobrenje vlasnika (7.10.2026)

**Status: NACRT.** Ovo je opis kako radnik prolazi kroz aplikaciju, napisan običnim rečima, da ga vlasnik pročita, ispravi i odobri pre nego što se menja kod. Opisuje (A) **šta postoji sada** u kodu i na DEV-u i (B) **šta predlažemo** tamo gde još nije odlučeno. Ništa ovde nije novo odobrenje za server, plaćanje ili obaveštenja. Tehnička osnova: `WORKER_PERSONAL_PROFILE_20261003.md` (lični profil, primenjen na DEV 3.10.), `WORKER_V2_CONTRACT_20261003.md` (predlog „v2“, nije primenjen), prompt `supabase/functions/uskoci-worker-interview/index.ts`. Mesta označena **[P02]** potvrđuju se proverom na pravom serveru u fazi P02 plana R2.

## ODLUČENO — vlasnik 7.10.2026 („Nećemo da pravimo previše ograničenja u sistemu“)

1. **Mapa i lista uvek pokazuju SVE zadatke** svakom korisniku; profil ništa ne sakriva. Ručna prijava je moguća na sve, osim retkih izuzetaka (sopstveni zadatak, blokirana osoba, nalog u zatvaranju, postojeća tvrda isključenja).
2. **Prekidač „Za mene“** na mapi i listi prikazuje samo zadatke koji odgovaraju profilu; isključen = opet sve. Ostali filteri ostaju.
3. **Profil služi pre svega za obaveštenja:** „novi zadatak za tebe“ stiže samo za zadatke koji odgovaraju profilu, po **istom pravilu** kao „Za mene“.
4. **„Odgovara mi“ = vrsta posla + područje + kad sam slobodan.** Samo ta tri.
5. **Alat i vozilo NISU uslov** ni za obaveštenje ni za prijavu — samo informacija koju naručilac vidi kad bira. Radnik bez vozila dobija obaveštenje i za zadatak koji traži vozilo (odgovor vlasnika na pitanje „a“: da).

6. **Nema liste „ne nudi mi ove poslove“** (odgovor na pitanje 1 iz sekcije 7: ne).
7. **AI ne pita da li da javljamo nove zadatke** (pitanje 4: ne). Umesto toga, **na kraju razgovora** jasno se kaže: *ovaj razgovor (radni profil) koristimo da ti javimo nove zadatke, i obaveštenja dobijaš za zadatke koji odgovaraju tvom radnom profilu.* Predlog izvedbe: stalna rečenica na pregledu profila pre „Sačuvaj“ (bez dodatnog AI poziva i bez promene servera).
8. **Bez posebnog HITNO u prvom izdanju** (potvrđeno 7.10.): zadatak „treba mi odmah“ je običan zadatak sa tim vremenom i prvo stiže radnicima sa uključenim „Dostupan sam“. Pitanja 3 iz sekcije 7 i HITNO pravila zato otpadaju.
9. Pitanje 5 (objašnjenje „Na šta ovo utiče“ na profilu) nije posebno odgovoreno; ostaje predlog „da“, osim ako vlasnik kaže drugačije.

Posledica za kod: server za automatske ponude danas traži i alat/vozilo kada ih zadatak navodi; to se uklanja serverskim paketom (primena tek na vlasnikovo „PRIMENI <ime>“). Prekidač „Za mene“ je posao na ekranu. Da li mapa danas već prikazuje sve zadatke proverava se u P02. Odluke iz sekcije 7 ispod koje još nisu odgovorene ostaju otvorene.

---

## 1. Šta je radni profil

- **Jedan profil po osobi.** Opisuje šta ta osoba ume i hoće da radi, čime raspolaže (alat, vozilo), gde radi i kada je slobodna.
- **Nema licenci ni stalnog tima** (odluka 3.10.). Ako radnik dovodi još ljudi, to se navodi **u prijavi na konkretan zadatak**, ne u profilu.
- Isti nalog može biti i naručilac i radnik (dva „lica“).

## 2. Prvi ulazak

**Sada:** sa Početne „Uskoči i zaradi“ → ako profil ne postoji, ekran kaže **„Radni profil još nije podešen. Bez njega ne možeš da se prijaviš na zadatak.“** i nudi **jedno dugme za razgovor**. Ako je profil započet a nije završen: „Radni profil je još nacrt. Dok je nacrt, zadaci ti se ne nude.“

**Predlog:** ostaje tako — jedan jasan ulaz, razgovor. Ispod dugmeta jedna rečenica šta dobija: „Opiši šta radiš, a mi ti šaljemo zadatke koji ti odgovaraju.“

## 3. Razgovor sa AI (kako ide i šta pita)

**Pravila koja važe sada:**
- Govori kratko, na „ti“, **jedno pitanje odjednom**, bez ponavljanja onoga što je već rečeno i bez traženja potvrde za svako polje.
- Ne izmišlja ništa: ne dodaje posao koji osoba nije rekla, ne obećava proveru, ocene, HITNO ni aktivaciju.
- Kad osoba kaže „to je to“, „gotovo“ ili „sačuvaj“, razgovor staje i vodi na **pregled profila**. Pregled se čuva **jednim dugmetom**.

**Redosled pitanja (sada):**
1. **Šta radiš i koje poslove hoćeš da uzimaš?** Ako je odgovor širok, jedno konkretno potpitanje. Primer: „pomoć oko selidbe“ → „Da li je to nošenje, pakovanje ili prevoz?“
2. **Alat ili vozilo** — samo ako je bitno za te poslove (npr. prevoz → ima li vozilo).
3. **Gde radiš** — grad i koliko daleko ideš (1–200 km).
4. **Kada si slobodan** — dani i sati, ili „mogu odmah“.
5. Kraj → **pregled** → „Sačuvaj“.

**Obavezno da bi profil bio aktivan:** ime, bar jedna veština, država i grad. Alat, vozilo i raspored nisu beskrajan upitnik.

**Predlog dopune (traži tvoju odluku, sekcija 7):** posle tačke 1 jedno pitanje **„Ima li poslova koje NE želiš da ti nudimo?“** i, ako HITNO uđe u V1, **„Hoćeš li da ti javljamo i hitne zadatke?“**

## 4. Ekran profila i izmene

**Sada:**
- Gore **razgovor** („Uredi kroz razgovor“), ispod čitljiv **sažetak**: ime i opis, veštine, alat i vozila, područje, raspored.
- Svaka grupa ima svoje dugme za ručnu izmenu; **uređuje se jedno po jedno**.
- Ručne izmene **AI ne prepisuje** (popravljeno 6.10.).
- Ako izađeš usred izmene, aplikacija **pita da li da odbaci**; nesačuvano se ne gubi slučajno, a odbačeno se ne vraća.

**Predlog:** ispod sažetka jedan red **„Na šta ovo utiče“** koji otvara objašnjenje iz sekcije 5, da radnik razume zašto mu stižu (ili ne stižu) zadaci.

## 5. Na šta šta utiče

| Stavka profila | Šta radi | Vrsta |
|---|---|---|
| **Veštine / vrste posla** | Automatski ti se nude samo zadaci iz vrsta posla koje radiš. | uslov za ponude **[P02]** |
| **Alat i vozilo** | ~~Ako zadatak traži alat ili vozilo koje nemaš, ne nudi ti se.~~ **Odlučeno 7.10.: nije uslov** — samo informacija za naručioca. | samo informacija |
| **Područje i udaljenost** | Nude ti se zadaci u tvom krugu. | uslov |
| **Raspored / „mogu odmah“** | Automatske ponude prate kad si slobodan; zauzet termin (drugi Dogovor) se ne nudi. | uslov za automatske ponude **[P02]** |
| **Opis (biografija)** | Vidi ga naručilac kad gleda tvoju prijavu. Ne utiče na to šta ti se nudi. | samo informacija |
| **Ocene** | Vide se uz tvoje ime; utiču na redosled tek ako je tako u pravilima rangiranja. | **[P02]** |
| **Isključenja (postojeće)** | Tvrda zabrana: ni automatska ponuda ni ručna prijava. | tvrdi uslov |

**Važno:** ručna prijava na zadatak koji sam nađeš na mapi ili listi ostaje moguća i kad ti ga sistem nije sam ponudio, osim kod tvrdih zabrana.

## 6. Prilike, prijava, otkazivanje

**Sada:**
- **Zadaci** (mapa + lista): vidiš tuđe zadatke u blizini i otvaraš detalj.
- **Prijava:** predlog cene (ako je zadatak „na ponudu“) i **koliko ljudi dovodiš za taj zadatak**. Sve se odnosi samo na tu prijavu.
- **Moje prijave:** vidiš status (čeka, izabran, odbijen, zatvoren).
- **Izbor:** kad te naručilac izabere, nastaje **Dogovor** (chat, termin, izmene, završetak, ocena).
- **Otkazivanje:** povlačenje prijave dok nisi izabran; otkaz Dogovora po pravilima Dogovora. Kad radnik javi „gotovo“, naručilac više ne može da otkaže (pravilo PKG-031).

**Treba proveriti i dovršiti (faze P04 i P06):**
- **Ponovno stavljanje zadatka na mapu** kad se Dogovor otkaže ili mesto oslobodi — da se zadatak vrati drugim radnicima, bez duplih ponuda.
- **Obaveštenja (push):** nov odgovarajući zadatak, izbor, nova poruka, otkaz. Od 7.10. obavezno za V1.

## 7. Odluke koje su potrebne od tebe (uz predlog)

1. **„Ne želim ove poslove“:** da li radnik može da kaže šta mu se NE nudi? *Predlog: da; to utiče samo na automatske ponude, a ručna prijava ostaje moguća.*
2. **„Želim samo ove poslove“:** posebna lista ili je dovoljno ono što ume (veštine)? *Predlog: dovoljne su veštine; posebna lista tek ako se pokaže potreba.*
3. **HITNO:** ako uđe u V1 — da li radnik bira da prima hitne zadatke? *Predlog: da, posebno „da/ne“ u razgovoru i u podešavanjima.*
4. **Obaveštenja u razgovoru:** da li AI na kraju pita „Hoćeš li da ti javljamo nove zadatke?“ *Predlog: da, a samo dozvola telefona ostaje u sistemskom prozoru.*
5. **Objašnjenje „Na šta ovo utiče“** na ekranu profila. *Predlog: da, kratko, po tabeli iz sekcije 5.*

Tačke 1, 3 i 4 traže serverski paket „v2“ (`WORKER_V2_CONTRACT_20261003.md`), koji pomera sertifikat zatvaranja i traži tvoje „PRIMENI“. Tačke 2 i 5 su samo tekst i ekran.

## 8. Šta sledi kad odobriš

1. Upišem tvoje odgovore ovde i u registar.
2. Uskladim pitanja AI-ja (prompt) i ekrane sa odobrenim.
3. P02: na pravom serveru, sa test nalozima, proverim tabelu iz sekcije 5 — svaka stavka mora da utiče tačno kako piše.
4. Provera na emulatoru, pa na telefonu po tvom „sad“.
