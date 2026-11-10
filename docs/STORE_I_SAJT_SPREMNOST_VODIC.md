# 🚀 VODIČ ZA ZVANIČNI SAJT I PUŠTANJE NA GOOGLE PLAY & APPLE APP STORE

> **Datum tehničke revizije:** 10. novembar 2026.\
> **Status:** RADNI NACRT — NIJE ZA OBJAVU ILI PREDAJU PRODAVNICAMA.

Ovaj dokument čuva radni materijal za sajt i buduću prijavu u **Google Play Console** i **Apple App Store Connect**. Predloženi URL-ovi, tekstovi i inventar podataka nisu potvrda javne dostupnosti, odobrene politike ili spremnosti aplikacije. Ne prepisivati ih kao konačne odgovore u konzole.

Važeći izvršni status i dokazi nalaze se u [CODEX_PLAN_RADA.md](plan/CODEX_PLAN_RADA.md), posebno R10/R12 i odeljcima 10.5–10.7. Ovaj vodič nije poseban izvršni plan. Postojeći pravni HTML fajlovi su označeni kao nacrti; konačno pravno odobrenje, retention/export/erasure kapije i korisnički prihvat ostaju otvoreni.

---

## 1. ZVANIČNI SAJT (uskoci.rs) — STRUKTURA I LINKOVI

Veb izvori se nalaze u folderu `docs/`. Tabela navodi **predložene** javne putanje; postojanje HTML fajla ne potvrđuje hosting, HTTPS, ispravnu rutu ili stvaran postupak podrške i brisanja.

| Stranica | Putanja u repozitorijumu | Predloženi URL — dostupnost nije potvrđena | Svrha i status |
| :--- | :--- | :--- | :--- |
| **Početna strana (Landing)** | [docs/index.html](index.html) | `https://uskoci.rs` | Izvor prezentacije; javna stranica i veze do prodavnica nisu potvrđeni ovim vodičem. |
| **Uslovi korišćenja** | [docs/legal/uslovi-koriscenja.html](legal/uslovi-koriscenja.html) | `https://uskoci.rs/uslovi-koriscenja` | Nacrt; identitet operatera i konačan sadržaj čekaju proveru. |
| **Politika privatnosti** | [docs/legal/politika-privatnosti.html](legal/politika-privatnosti.html) | `https://uskoci.rs/politika-privatnosti` | Nacrt; obrada, primaoci i život podataka moraju odgovarati stvarnom izdanju. |
| **Brisanje naloga** | [docs/legal/brisanje-naloga.html](legal/brisanje-naloga.html) | `https://uskoci.rs/brisanje-naloga` | Nacrt javnog ulaza; dostupnost i celokupna obrada zahteva nisu potvrđeni. |
| **Podrška i kontakt** | [docs/legal/podrska.html](legal/podrska.html) | `https://uskoci.rs/podrska` | Kontakt je potvrđen u nacrtu; javna ruta i operativni postupak nisu time dokazani. |

> [!NOTE]
> **Tehnički predlog za kasniji hosting, nije izvršena objava:**\
> Tek posle potvrde sadržaja, javnih ruta i odgovarajućeg odobrenja za objavu proveriti podešavanja hostinga. Za GitHub Pages primer je:\
> U podešavanjima GitHub repozitorijuma (`Settings -> Pages`):\
> - Source: `Deploy from a branch`\
> - Branch: izabrana i odobrena grana / folder `/docs`\
> - Custom domain: `uskoci.rs`\
> Posebno proveriti DNS/HTTPS i mapiranje predloženih URL-ova bez `.html` na fajlove u `docs/legal/`. Sam izbor `/docs` ne dokazuje te rute niti spremnost pravnih stranica.

---

## 2. GOOGLE PLAY CONSOLE — RADNI PODACI ZA PROVERU

### Radni opis aplikacije (Store Listing):

Opis uskladiti sa funkcijama konačnog Android kandidata i stvarnim rezultatima provere. Ovaj tekst nije odobren listing.

- **Naziv aplikacije (App Name, max 30 karaktera):**\
  `USKOČI`
- **Kratak opis (Short Description, max 80 karaktera):**\
  `USKOČI — Vaš partner za svaki zadatak.`
- **Puni opis (Full Description):**\
  > USKOČI povezuje ljude kojima je potrebna pomoć sa ljudima koji nude odgovarajuće usluge.\
  >
  > Objavi zadatak\
  > • Opišite zadatak tekstom ili glasom i pregledajte nacrt pre objave.\
  > • Pregledajte prijave zainteresovanih izvršilaca.\
  > • Izaberite saradnika na osnovu ocena i dogovorite se direktno.\
  > • Tačna lokacija dostupna je samo učesnicima kojima je odobrena u Dogovoru.\
  >
  > Uskoči i zaradi\
  > • Pripremite radni profil i potvrdite usluge koje nudite.\
  > • Pregledajte odgovarajuće zadatke i njihove uslove pre prijave.\
  > • U prvom izdanju nema naknade platformi za objavu, prijavu ili potvrdu Dogovora.\
  >
  > USKOČI — Vaš partner za svaki zadatak.

### Predloženi linkovi — proveriti javnu dostupnost pre unosa:

- **Privacy Policy URL:** `https://uskoci.rs/politika-privatnosti`
- **App Content -> Account Deletion URL:** `https://uskoci.rs/brisanje-naloga`

### Data Safety — tehnički inventar, bez konačnih odgovora:

Pre unosa u upitnik potrebno je potvrditi stvarni tok podataka u konačnom build-u, uključujući SDK-ove i spoljne primaoce. Sledeći inventar ne određuje pravni osnov, rok čuvanja ili konačnu klasifikaciju „collected/shared“. Lokalno sačuvan podatak nije samim tim dokaz da je poslat serveru.

| Podatak / tok | Potvrđeno u izvoru | Šta odvojeno proveriti pre deklaracije |
|---|---|---|
| Privatni tekstualni nacrt i red slanja | `agreementOutbox.ts` čuva tekst nacrta, trajne komande i ograničen keš potvrđenih poruka u lokalnom AsyncStorage-u, po nalogu i Dogovoru. | Obično kucanje ne poziva slanje poruke. Razdvojiti lokalnu kopiju, izričito slanje, nepoznat ishod i serversku istoriju. |
| Grupni nacrt | `groupConversationDraft.ts` trajno čuva tekst i, dok je potrebno za oporavak, originalni sadržaj prethodne komande uz njen identitet. | Ponovno otvaranje ne predstavlja novo slanje. Potvrda stare komande ne sme izbrisati noviji nacrt, čak i kada mu je tekst identičan. |
| Foto/glasovni upload journal i glasovni red slanja | `agreementPhotoJournal.ts` čuva identitete upload zahteva; glasovni outbox čuva referencu medija i identitet poruke. Audio bajtovi nisu sadržaj tih journal-a. | Upload medija proveriti odvojeno od konačnog slanja poruke; journal sa identitetima nije dokaz odsustva već poslatog priloga na serveru. |
| Lokalni audio fajlovi | `nativeVoiceFiles.ts` koristi privatni keš aplikacije za snimke i preuzete glasovne poruke. | Native snimanje/reprodukcija, prekid, čišćenje i nova sesija imaju zaseban lifecycle i zahtevaju uređajsku proveru. Brisanje AsyncStorage zapisa nije brisanje audio fajla. |
| Podaci poslati servisima | Inventar obuhvata nalog i email/ime, telefon kada se koristi, profil, zadatke/Dogovore, privatne i grupne poruke, fotografije, audio, lokaciju, AI ulaze, push identifikatore i tehničke zapise. | Za svaki stvarni prenos potvrditi svrhu, primaoca/SDK, zaštitu u prenosu i ponašanje konačnog kandidata. Ne pretpostavljati da svaki tok šalje iste podatke ili da nema spoljnog primaoca. |

**Lokalno brisanje:** posle uspešne izričite odjave aplikacija pokušava da ukloni pripadajuće privatne i grupne tekstualne nacrte, privatne tekstualne/glasovne redove slanja i foto/glasovne upload journal-e. Zasebni grupni journal sa identitetima i hash-om nije obuhvaćen ovim brisanjem teksta. Granicu rezerviše pre Auth čekanja; neuspešna odjava ne briše nacrte. Aktuelni autoritativni `CLOSED` readback pokreće čišćenje navedenih lokalnih tekstualnih zapisa i privatnih journal-a i povlači prethodne kontrolere. Greška diska može ostaviti podatke na uređaju. Zatvaranje na drugom uređaju bez odgovarajućeg readback-a ne dokazuje lokalno brisanje ovde. Kada je glasovni modul uključen, odjava i isti autoritativni `CLOSED` readback rezervišu i native audio granicu: stari snimači/reproduktori se oslobađaju pre pokušaja brisanja keša, a novi fajlovi i nova sesija čekaju tu granicu. Kodni i izolovani testovi pokrivaju ovaj tok; stvarno ponašanje Android diska i native uređaja ostaje za acceptance. Neuspešno oslobađanje native resursa ili brisanje keša ne predstavlja uspešno brisanje; `CLOSED` tada prikazuje nepotpuno čišćenje, a novo audio korišćenje ostaje blokirano do uspešnog čišćenja.

Ove lokalne zaštite ne potvrđuju kompletan serverski izvoz/brisanje, niti javni kanal za zahteve. Retention/export/erasure i pravne kapije ostaju otvorene prema izvršnom planu. Za publiku, sadržaj, finansijske funkcije i ostale delove konzole pripremiti odgovore prema stvarnom prvom izdanju; ovde nema konačno odobrenog obrasca.


### Google Play — pravila proverena 10.11.2026.

Ovo je poređenje aktuelnih zvaničnih zahteva sa dokazima USKOČI projekta. Play Console nalog, tip i datum njegovog otvaranja, podneti obrasci, testeri i production access nisu provereni. Pravila prodavnice ne potvrđuju zakonitost konkretnog poslovnog modela u Srbiji.

| Zahtev | Zvanično pravilo | Stanje USKOČI / potreban dokaz |
|---|---|---|
| Brisanje naloga | Putanja iz aplikacije i funkcionalna spoljašnja web putanja za zahtev. Javna stranica može ponuditi podršku/email ili formular; poseban automatizovan portal nije obavezan. Korisnik ne sme morati ponovo da instalira aplikaciju. [Google — account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) | Source CLOSED/lokalno čišćenje ne dokazuju ceo serverski postupak niti prijem spoljašnjeg zahteva. Potvrditi javnu rutu, identitet podnosioca, obradu, povezane podatke i jasno saopštene opravdane izuzetke. |
| Politika privatnosti | Veza u konzoli i veza ili tekst u aplikaciji; aktivan javni URL, bez geografskog ograničenja, PDF-a i javnog uređivanja. Politika objašnjava obradu, primaoce, zaštitu, čuvanje i brisanje. [Google — User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) | HTML je nacrt, ne efektivna politika. Potrebni su stvarno objavljen i važeći sadržaj i potvrđena usklađenost sa aplikacijom; trenutno nema efektivnih internih pravnih verzija. |
| Data Safety | Tačna obrada aplikacije i SDK-ova deklarisana je i za closed/open/production track. Samo aplikacija isključivo na internal testing track-u ima izuzeće od tog obrasca. [Google — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) | Gornji inventar je priprema, ne popunjen/odobren obrazac. Samo lokalni nacrt razlikovati od prenosa van uređaja; angažovanje pružaoca usluge nije automatski dokaz ni odsustva ni prisustva „sharing“-a. |
| Target API | Od 31.08.2026. nove mobilne aplikacije i update moraju ciljati Android 16 / API 36 ili više. [Google — Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) | Poznati target 36 ispunjava brojčani uslov. Konačni AAB, produkcioni potpis i ostala usklađenost nisu potvrđeni QA APK-om. |
| Personal nalog i closed test | Za personal naloge otvorene posle 13.11.2023. potrebno je najmanje 12 testera neprekidno opted-in najmanje 14 dana, zatim zahtev za production access. [Google — Personal testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) | Prvo utvrditi primenljivost na stvarni nalog. GitHub CI i direktno podeljen QA APK ne predstavljaju Google Play closed test ili odobrenje produkcije. |

**Native 16 KB provera:** [Android vodič](https://developer.android.com/guide/practices/page-sizes) razdvaja ELF poravnanje, RELRO, ZIP pakovanje i izvršavanje na 16 KB uređaju. QA131 ima pozitivan statički LOAD/ZIP-offset nalaz za svih 28 biblioteka, uz dve izdvojene RELRO varijante bez zatečenog writable preseka. Nije izvršen `zipalign`, 16 KB uređajski test ili pregled Play AAB/split paketa; broj SDK-a i ovaj ograničeni nalaz ne zatvaraju R12d. [Tačan QA131 dokaz](plan/proofs/qa131-summary.json).

Pokušaj javnog čitanja četiri predložene privacy/deletion/terms/support putanje 10.11.2026. nije uspeo kroz dostupni web alat. To nije pouzdan nov HTTP 404 dokaz niti potvrda dostupnosti; URL-ovi ostaju **nepotvrđeni**. Nije podnet obrazac, kreiran nalog, poslat mejl ili promenjena javna konfiguracija.

---

## 3. APPLE APP STORE CONNECT — RADNI PODACI ZA PROVERU

Ovaj deo ne potvrđuje iOS build, uređajski prihvat ili odobrenje za predaju. Predložene URL-ove iz prvog odeljka proveriti zasebno.

### Osnovni podaci o aplikaciji (App Information):

- **Name (max 30 karaktera):** `USKOČI`
- **Subtitle (max 30 karaktera):** `Pomoć i poslovi u blizini`
- **Category:** Primary: `Productivity` (ili `Lifestyle`), Secondary: `Business`.
- **Privacy Policy URL:** `https://uskoci.rs/politika-privatnosti`
- **Support URL (Obavezno polje po Apple pravilima):** `https://uskoci.rs/podrska`
- **Marketing URL:** `https://uskoci.rs`

### Pristup recenzenta — nije pripremljen ovim vodičem:

Potrebni su odobren test nalog, stvarno proverena prijava i uputstvo za obe uloge na tačnom kandidatu. Ne unositi izmišljeni telefonski broj ili univerzalni OTP, ne aktivirati Auth zaobilaznicu i ne stavljati važeće pristupne podatke u repozitorijum. Odgovarajući pristup i uputstvo proveravaju se pre predaje u konzolu. Ovaj dokument ne potvrđuje da test nalog postoji ili da recenzent može da se prijavi.

Opis usluga mora obuhvatiti i podržani rad na daljinu. Primenljivost pravila plaćanja proverava se prema stvarnom modelu izdanja; ovaj vodič ne daje opšte izuzeće.

### App Privacy — nije popunjen konačan obrazac:

Koristiti isti provereni inventar podataka, uz stvarne iOS SDK-ove i dozvole konačnog kandidata. Odgovori o praćenju i povezivanju podataka sa korisnikom nisu potvrđeni ovim dokumentom. Android/source testovi ne potvrđuju iOS obradu, lokalne fajlove ili mrežne primaoce.

---

## 4. CHECKLISTA PRE ZVANIČNOG PUŠTANJA

Sledeće stavke ostaju otvorene dok izvršni plan ne poveže svaku sa stvarnim dokazom. Promena teksta ili njegovog hash-a ne aktivira pravnu verziju niti zatvara release kapiju.

- [ ] Konačan identitet operatera, uslovi i politika privatnosti odobreni i povezani sa stvarnom obradom.
- [ ] Trajni lokalni nacrti, mediji, serverske kopije, izvoz i brisanje provereni u odgovarajućim lifecycle tokovima.
- [ ] Javni ulaz za zahtev brisanja dostupan; prijem, obrada i konačan rezultat zaista provereni.
- [ ] Javni privacy/support URL-ovi i stvarni postupak podrške provereni.
- [ ] Landing i listing odgovaraju konačnom kandidatu, bez nepotvrđenih obećanja.
- [ ] Važeće pravne/policy verzije i sve potrebne retention/export/erasure kapije stvarno potvrđene; ne zaobilaziti ih promenom očekivanog digest-a.
- [ ] Source/CI, DEV i uređajski dokazi vezani za tačan kandidat, uz odvojenu potvrdu store artefakta i potpisa.
- [ ] Konačne deklaracije i pristup recenzenta provereni u odgovarajućoj konzoli; predaja i javna objava zasebno odobrene.
