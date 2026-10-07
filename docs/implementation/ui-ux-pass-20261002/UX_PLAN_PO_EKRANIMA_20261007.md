# USKOČI — UX plan po ekranima (dizajn tim, 7.10.2026)

> **Ispravke vlasnika (7.10., posle plana) — imaju prednost nad tekstom ispod:** (1) **Poruke su četvrti tab** dole i obavezne su; dodir na poruku vodi pravo u taj Dogovor ili grupni razgovor (plan predlaže suprotno u 2.4/2.8 i odluci 6 — ne važi). (2) **Reč „posao/poslovi“ se ne koristi nigde**, samo „zadatak“ (npr. „Posao je gotov“ u 2.6 postaje izraz sa „zadatak“). (3) Kratke potvrde idu u dijalog na sredini ekrana (odluka 13: da).

## Šta je ovo

Ovo je glavni plan dizajn tima za završni vizuelni i upotrebni nivo cele aplikacije. Napravljen je samo čitanjem koda u `USKOCI-CLEAN-spoj-20261006` (glava `825c8e16`). Na DEV-u i u repozitorijumu ništa nije menjano. Plan je predlog, a ne novo odobrenje. Serverski delovi traže tvoje „PRIMENI <ime>“, a novi paketi tvoje posebno „da“.

## Kako je provereno

Sedam čitača (model Opus 5.5) je pročitalo sve rute i zajedničke slojeve. Ja sam lično pročitao:
- Početnu, Dogovore, Dogovor i kalendar;
- životni ciklus zadatka;
- sve zajedničke slojeve (`ProductSheet`, `ConfirmSheet`, `ActionSheet`, `PeekSheet`, `PublicProfileSheet`, `StateView`, `Disclosure`, `PermissionRecovery`, `V2Action`, `ScreenChrome`, `Appear`, `SuccessMark`, `LottieArt`, `motion.ts`);
- novi kod pinova (`825c8e16`);
- redosled stranica u `rpc_discovery_v1`.

Brojevi linija se odnose na `src/`, osim kad je navedena druga putanja.

## Pravila koja važe za svaki predlog (AGENTS.md §3.5–3.6)

- **Izgled:** bele površine; crn glavni tekst, siv prateći; FactArt za činjenice.
- **Glavna radnja:** jedna zelena glavna radnja, sa razlogom pored sive.
- **Tekst:**
  - bez „eyebrow“ i orijentacionih rečenica;
  - tekst najmanje 12 px;
  - „ti“ bez gramatičkog roda;
  - bez reči „server“;
  - vreme „po vremenu u Srbiji“;
  - kategorija se ne prikazuje ljudima;
  - cena koja nedostaje nikad ne liči na iznos.
- **Obim V1:** HITNO je van V1. Lottie se koristi samo za likove i trenutke. Bez novih paketa bez odobrenja.
- **Navigacija:** zaključan raspored ekrana (Početna | Zadaci | Dogovori, plus Poruke iza prekidača); donja traka samo na glavnim ekranima.
- **Push:** tekst i cilj dizajniramo odmah, a slanje se uključuje poslednje.

## Oznake

- **Prioritet:** P1 = obavezno za prodavnicu; P2 = treba; P3 = lepo bi bilo.
- **Trud:** S, M ili L.
- **Vrsta posla:**
  - [klijent] = samo aplikacija;
  - [server] = serverski paket na jednokratnoj bazi, pa tvoje „PRIMENI“;
  - [sertifikat] = pomera sertifikat zatvaranja i traži ponovno overavanje;
  - [odluka] = traži tvoju reč.

---

## 1. Sažetak — 17 izmena koje najviše podižu kvalitet

1. **Jedna porodica za zadatak: pin → kartica na mapi → kartica u listi → detalj → prijava.** Isti redosled činjenica i iste reči na svih pet mesta, a pokret pri otvaranju vodi oko od jednog ka drugom (2.11).
   - Danas se ista stvar kaže na tri načina:
     - kapacitet: „0/2“, „2 osobe · 0/2 popunjeno“, „Traži 2 osobe“;
     - cena: „Ponude“, „Tražim ponude“;
     - ocena: „4,8 (12)“, „Ocena 4,8“.
   - Mesta u kodu: `TaskCard.tsx:99-100`, `TaskDecision.tsx:86-87`, `ApplicationComposerPresentation.tsx:140`, `marketplaceView.ts:397`.
   - P1 · M · [klijent].
2. **Prijava kao nepogrešiv objekat:** jedna kartica prijave za radnika (Moje prijave) i za naručioca (kandidati), sa zadatkom, terminom, ponudom, ljudima i stanjem (2.12). P1 · M · [klijent]; „Nije izabrana“ zavisi od servera.
3. **„Moj plan“: jedno mesto za sve moje.** Gradi se od postojećeg kalendara: zadaci, prijave i Dogovori po danima, ono što je bez termina i arhiva. Ulaz je sa Početne i iz Dogovora, bez četvrtog taba (2.7). P1 · M · [klijent].
4. **Jedan sistem stanja i arhiva.** Danas klijent četiri različita serverska kraja zadatka (završen, otkazan, istekao, arhiviran) svodi na jedno „Zatvoren“ (`data/needClientService.ts:21-45`). „Čeka prijave“ znači suprotno od onoga što piše (`NeedPresentation.tsx:25`). P1 · M · [klijent].
5. **Opseg „Svi zadaci / Za mene“** kao prvi element trake filtera; „Gde“ sa „Svuda / Ova oblast / U blizini / mesto“; sopstveni zadaci nikad kao ponuda (2.13). Prekidač P1 · M · [server] G4; ostalo [klijent].
6. **Lista svih zadataka po vremenu objave, sa starošću** („pre 2 dana“). Redosled sa servera je već najnovije prvo (`supabase/candidates/p6_discovery_rollout_v3.sql:288-290`), a vreme objave već stiže u odgovoru (`:293`). P1 · S · [klijent].
7. **Zvezdica „Sačuvaj za kasnije“** na kartici, kartici na mapi i detalju, sa listom „Sačuvano“. Tabela za to ne postoji, pa treba serverski paket koji dira izvoz i zatvaranje naloga (2.15). P2 · M · [server][sertifikat].
8. **Zelena glavna radnja svuda.** Sledeće glavne radnje se crtaju crno, iako pravilo §3.6.4 kaže zeleno: radni profil (`app/(app)/profil/radnik.tsx:226-229`), razgovor za profil (`razgovor.tsx:289-290`), „Pregledaj i objavi“ u AI razgovoru (`ui/v2/IntakePresentation.tsx:220,404`). P1 · S · [klijent].
9. **Dogovor: traka koraka na vrhu, retke radnje u „···“ i ishod otkazivanja koji se vidi.**
   - „Tok Dogovora“ uvek ima samo „Dogovor kreiran“ (`data/agreementClientService.ts:128`).
   - Otkazan Dogovor ne kaže ko, kada i zašto (`ui/agreements/AgreementWorkspace.tsx:58`).
   - P1 · M · [klijent].
10. **Jedna kratka traka „Poruka“ za uspeh, sa „Vrati“ gde postoji obrnuta radnja.** Takve komponente danas nema; svaki ekran radi svoju liniju. P1 · M · [klijent].
11. **Jedan obrazac za nepovratne radnje.** Danas:
    - otkazivanje zadatka ide bez razloga (`ui/needs/NeedLifecycleActions.tsx:127`);
    - nacrt nudi i „Obriši nacrt“ i „Otkaži zadatak“ (`:37`);
    - odblokiranje ide bez potvrde (`ui/safety/SafetyScreen.tsx:70`);
    - odjava ide bez potvrde (`app/(app)/profil.tsx:65-80`);
    - „Blokirati korisnika?“ ne kaže koga (`SafetyScreen.tsx:77`).

    P1 · M · [klijent].
12. **Obaveštenja vode na mesto reakcije.**
    - Dodir na push uvek otvara spisak (`ui/notifications/PushRuntime.tsx:57-61`).
    - „Potvrdi završetak“ otvara pregled Dogovora, a ne potvrdu (`app/obavestenja.tsx:60-62`).
    - Push za prijavljen problem kaže „Oporavak naloga“ (`supabase/functions/_shared/pushNotificationCopy.mjs:25`).

    P1 · M · [klijent] + tekst u push paketu.
13. **Početna koja zna u kom si stanju:** prvi ulazak, „ništa ne čeka“, „Danas/Sutra“ i ulaz u Moj plan. `firstRun` se računa, ali se nigde ne koristi (`data/homeSnapshot.ts:145`). P1 · S · [klijent].
14. **Ulaz koji vodi novu osobu u registraciju, a ne u prijavu.**
    - Izbor namere otvara „Zdravo. / Prijavi se“ (`app/auth.tsx:200`).
    - „Napravi nalog“ je pilula od 32 px sa tekstom od 12 px (`ui/entry/EntryWelcome.tsx:275,325`).
    - Eyebrow „JEDAN NALOG · OBE MOGUĆNOSTI“ krši tvoje pravilo (`ui/auth/AuthPresentation.tsx:7`).

    P1 · S · [klijent], uz poštovanje zaključanog V4.9 ulaza.
15. **Brzina pri rastu.**
    - Pretraga čita sve otvorene zadatke pri svakom pozivu (ZAVRSNA §2: oko 330 ms na 2.000 zadataka).
    - Početna čita četiri pune liste.
    - Kalendar čita do 2.000 redova (`ui/calendar/AgendaScreen.tsx:57`).
    - Lične liste se u prodavničkom buildu ne straniče (prekidači EX-04 nisu u `eas.json`).

    Vidi 2.16. P1 · L · [server] + [klijent].
16. **Pretraga kao Airbnb panel.** Gore ostaje jedna sažeta pilula „Gde · Kada“ umesto polja za kucanje. Panel otvara odeljke Gde → Kada → Šta → Cena → Ljudi → Način rada, na zamućenoj pozadini, sa automatskim prelaskom na sledeći odeljak. „Svi / Za mene“ stoji na vrhu (2.19). P1 · M · [klijent]. Tekst bez kvačica (č, ć, š, ž, đ) traži [server].
17. **Prozori odozdo, dijalozi i ikone:**
    - jedno pravilo za mesto svakog prozora;
    - jedan miran izgled: spring bez odskoka, brže zatvaranje, isto ponašanje pri smanjenom pokretu;
    - kratke potvrde idu u dijalog na sredini ekrana, a ne kao drugi prozor odozdo;
    - 58 fajlova sa starim ikonama ide na jedan sistem (Glyph za kontrole, FactArt za činjenice) (2.20).

    P1 · M · [klijent].

### Pogled profesionalnog tima: jedan korisnik i mnogo njih, radnik i naručilac

| | Šta | Gde u planu |
|---|---|---|
| **Očistiti** | `/mesto-zadatka` bez ulaza; nekorišćeni `ReferenceEntryHero` i `AgreementLocationController`; ostaci HITNO-a: oznaka bez prekidača (`UrgentActivationActions.tsx:277-288`) i ikonica munje; `BuildIdentity` u prodavničkom buildu; tekst o kategoriji (`aiNeedV2Production.ts:80`); stara putanja Zadataka kada P6 bude dokazan na telefonu; `V2Icon` zadržati kao sačuvan crtež, ali ga ne crtati | 2.17, 2.20, talas 0 |
| **Poboljšati** | jedna porodica zadatka; kartica prijave; traka koraka Dogovora; obaveštenja vode na radnju; zelena glavna radnja | 2.11, 2.12, 2.6, 2.8, 2.18 |
| **Dopuniti** | prvi ulazak; prazna stanja po tabu; Moj plan i Arhiva; zvezdica; starost zadatka; „Za mene“; razlozi otkazivanja; objašnjenje pre dozvole; linija „Nema veze“; kontakt za ograničen nalog | 2.1, 2.2, 2.7, 2.13–2.15 |
| **Ubrzati** | serverska pretraga; zbir za Početnu; straničenje ličnih lista; prepiska kao lista; topao povratak bez skeleta | 2.16 |
| **Prilagoditi** | **jedan korisnik / malo zadataka:** Zadaci se otvaraju na „Svuda“, najnovije prvo; mapa obuhvati sve tačke; prazna stanja pozivaju da objaviš. **Mnogo korisnika:** filteri, „Za mene“, pilula „N novih“, straničenje. **Radnik:** „Za mene“, Moje prijave, Plan sa dostupnošću. **Naručilac:** „Bira se“, kandidati kao tabela, jedan sledeći korak Dogovora | 2.13, 2.14, 2.7, 2.12 |
| **Pripremiti** | pravni tekstovi i 18+; nov PROD projekat (R04); prekidači u `eas.json` (Poruke, glas, link lozinke); push poslednji; TalkBack i veliki tekst 1,3; proba na dva uređaja | talas 4 |

---

## 2. Sistemi

### 2.1 Prvi ulazak, uvod i dozvole u kontekstu

**Sada**

- **Ulaz:** uvod brenda traje 4,38 s, uz „Preskoči“ (`ui/entry/EntryWelcome.tsx`, `useEntryIntro.ts:7,18`). Ispod su dve kolone („Objavi zadatak“, „Uskoči i zaradi“) i dve pilule: „Prijavi se →“ (min. 48) i „Napravi nalog“ (pilula 32 px, tekst 12 px, `EntryWelcome.tsx:269-276,325`).
- **Izbor kolone:** posle 760 ms „vrata“ otvara se panel u stanju **PRIJAVA** („Zdravo.“), a ne registracija (`app/auth.tsx:200`).
- **Panel za prijavu:**
  - eyebrow „JEDAN NALOG · OBE MOGUĆNOSTI“ ili „… · ISTI NALOG“, pa „Jedan nalog.“ još jednom na dnu (`AuthPresentation.tsx:7`, `auth.tsx:333,566-569`);
  - dupli naslovi „Proveri email“ (`auth.tsx:280,549`) i „Unesi kod“ (`:275,496`);
  - nema pokreta ni zatvaranja prevlačenjem (`ui/auth/AuthSheet.tsx`).
- **Prvi ulazak posle prijave:** sa sačuvanom namerom ideš na `/zadaci` ili `/nova` (`app/_layout.tsx:94-99`), inače na Početnu. Početna ne zna da je ovo prvi put.
- **Dozvole:**
  - Push se traži samo u Profil › Obaveštenja (`ui/notifications/PushPreferences.tsx:246`). Rečenica pre dozvole je u zatvorenom delu ispod kategorija i kaže „Dugme ispod“, a dugme je iznad (`:286,352-353,395-396`).
  - Mikrofon se traži usred držanja, pa se prvi snimak izgubi (`features/voice/holdToTalk.ts:215`).
  - Glasovna poruka u Dogovoru, posle odbijanja dozvole, nema dugme za podešavanja (`ui/media/AgreementVoiceControls.tsx:141`).
  - „Koristi gde sam“ isto nema dugme za podešavanja (`ui/location/LocationPointEditor.tsx:515`).
  - Na jednom mestu je muški rod „da bi snimio“ (`voiceCopy.ts:9`).

**Predlog**

1. **Ulaz (tvoj zaključani V4.9 raspored ostaje):**
   - **Ponašanje:** izbor namere otvara **registraciju**, osim ako ovaj uređaj već zna nalog (postoji ranija sesija ili namera), pa tada otvara prijavu. Link „Već imaš nalog? Prijavi se“ ostaje.
   - **Pilula „Napravi nalog“:** dobija dodirnu površinu od 48 dp. Crtež može da ostane isti; povećava se samo nevidljiva površina dodira (`hitSlop`).
   - **Tekst:** brišu se eyebrow-i, a „Jedan nalog.“ ostaje samo jednom, na dnu.
   - **Dupli naslovi:** drugi naslov se uklanja.
   - P1 · S · [klijent].
2. **Panel prijave dobija ulaz i izlaz sa `sheetSpring`** (pri smanjenom pokretu nema animacije) i zatvaranje strelicom. P2 · S.
3. **Početna, samo dok je `firstRun`:** red od tri koraka sa FactArt sličicama 32 px, bez naslova iznad: „Opiši posao“ · „Izaberi prijavu“ · „Dogovor i ocena“. Nestaje sam sa prvim nacrtom, prijavom ili Dogovorom. Bez vodiča i ekrana za uvod. P1 · S.
4. **Kratko objašnjenje pre dozvole** (obrazac `PermissionAsk` = `ConfirmSheet` sa zelenim „Dozvoli“ i tihim „Ne sada“; sistemski prozor se otvara tek na zelenu radnju):
   - **Push, posle prve objave:** naslov „Da ti javimo kad stigne prva prijava?“, telo „Javljamo samo za tvoje zadatke, prijave i Dogovore. Isključuješ u Profilu.“
   - **Push, posle čuvanja radnog profila:** „Javljamo o zadacima koji odgovaraju tvojim veštinama, području i vremenu.“ (ista rečenica kao na pregledu profila).
   - **Mikrofon, pre prvog držanja:** naslov „Drži da govoriš, pusti da pošalješ.“, telo „Za to nam treba mikrofon.“ Posle dozvole držanje počinje ispočetka, pa se ništa ne gubi.
   - **Kamera:** u `PhotoAttachSheet` dozvola se traži tek na red „Kamera“. Galerija ne traži dozvolu (`features/media/nativePhotoPicker.ts:37`).
   - **Lokacija:** samo na „U blizini“ i „Koristi gde sam“, uz jednu rečenicu pre sistemskog prozora: „Jednom koristimo lokaciju da centriramo mapu. Ne čuvamo je.“
   - **Posle odbijanja**, uvek isti `PermissionRecovery` sa „Podešavanja telefona“ i zamenom:
     - „Kucaj umesto govora“;
     - „Izaberi iz galerije“;
     - „Upiši mesto“ / „Pomeri mapu“.

   P1 · S · [klijent]. Pravo slanje push-a ide u poslednji talas.

### 2.2 Jedan sistem stanja, aktivno i istorija, arhiva

**Sada**

- **Zadatak:**
  - `needClientService.ts:21-45` pravi stanja NACRT / OBJAVLJENA / CEKA_PRIJAVE / DELIMICNO_POPUNJENA / POPUNJENA / ZATVORENA, a COMPLETED, CANCELLED, EXPIRED i ARCHIVED postaju jedno ZATVORENA.
  - Reči na detalju: „Privatan nacrt“, „Objavljen“, „Čeka prijave“ (znači „ima prijava za izbor“), „Popunjen“, „Zatvoren“ (`NeedPresentation.tsx:25-26`).
  - Tabovi: Aktivni | Nacrti | Istorija (`ui/v2/ownTaskTabs.ts:34-36`).
  - Prazni Nacrti ili Istorija dobijaju prazno stanje filtera i „Obriši uslove“ (`MarketplacePresentation.tsx:119,154-155`).
- **Prijava:**
  - Reči: Poslata · Pregledana · U užem izboru · Izabrana · Potrebna nova provera · Povučena · Zatvorena (`ui/v2/ApplicationFace.tsx:48-57`).
  - „Zatvorena“ spaja „nije izabrana“, „istekla“ i „zadatak zatvoren“ (`:39-41`).
  - Izabrana prijava je pod „Završene“ (`data/myApplicationsView.ts:12`).
- **Dogovor:**
  - Reči: „Čeka se potvrda završetka / Završeno / Otkazano“ (`ui/v2/AgreementPresentation.tsx:27-29`).
  - Ista stanja se drugde zovu „Važeći Dogovor / Završen / Otkazan“ (`ui/groups/GroupConversationPresentation.tsx:23`) i „Potvrđen Dogovor“ (`ui/calendar/agenda.ts:31`).

**Predlog: komponenta `StatusChip` i jedan rečnik**

`StatusChip` je tačka od 6 px + reč, tip `label` 12. Nikad samo ikonica. Boje imaju jedno značenje:
- zelena = ide;
- narandžasta = čeka tebe;
- siva = završeno ili zatvoreno;
- crvena = problem.

| Objekat | Reč | Izvor (postojeće) | Gde živi |
|---|---|---|---|
| Zadatak | **Nacrt** | DRAFT | Moji zadaci › Nacrti |
| | **Objavljen** | PUBLISHED, bez prijava za izbor | Aktivni |
| | **Bira se · N** (narandžasto) | ima prijava za izbor | Aktivni, na vrh; Početna „Čeka te“ |
| | **Delimično popunjen · 1 od 2** | SELECTION, deo popunjen | Aktivni |
| | **Popunjen** | sva mesta dogovorena | Aktivni dok Dogovori traju |
| | **Završen** | COMPLETED | Istorija / Arhiva |
| | **Otkazan** | CANCELLED | Istorija / Arhiva |
| | **Istekao** | EXPIRED | Istorija / Arhiva |
| | **Arhiviran** | ARCHIVED | Arhiva |
| | (obrisan) | nacrt obrisan, nema reda | nigde; samo traka „Nacrt je obrisan“ |
| Prijava | **Poslata · Viđena · U užem izboru** | SUBMITTED / VIEWED / SHORTLISTED | Moje prijave › Aktivne |
| | **Zadatak je izmenjen** (narandžasto) | STALE_REVIEW_REQUIRED | Moje prijave › Čeka te |
| | **Izabrana → Dogovor** | SELECTED | Aktivne (premestiti iz „Završene“) |
| | **Nije izabrana · Povučena · Istekla · Zadatak zatvoren** | CLOSED i drugi | Završene / Arhiva |
| Dogovor | **Dogovoreno** | CONFIRMED | Dogovori › Aktivni |
| | **Termin je sada** | CONFIRMED, a sada je u prihvaćenom terminu | Aktivni › Danas |
| | **Čeka potvrdu** | AWAITING_REQUESTER (narandžasto kod naručioca) | Aktivni |
| | **Završeno · oceni** | COMPLETED, ocena čeka | Aktivni, dok se ne oceni |
| | **Završeno** | COMPLETED, ocenjeno | Istorija / Arhiva |
| | **Otkazano** | CANCELLED (+ ko, kada i razlog) | Istorija / Arhiva |

**Napomene uz tabelu**

- **Kraj zadatka** (završen, otkazan, istekao, arhiviran): server te razlike već šalje, a klijent ih briše. Čuvanje originalnog stanja je samo [klijent].
- **„Nije izabrana“ i ostala završna stanja prijave:** proveriti da li ih server razlikuje. Događaj `RESPONSE_NOT_SELECTED` danas nema izvor. Ako ih ne razlikuje, to je [server]. Do tada piše „Zatvorena“.
- **„Termin je sada“** je činjenica iz prihvaćenog vremena, a ne novo stanje (UX_NACRT §9). **[odluka]** Da li ti odgovara ta reč?
- **Prazni tabovi** dobijaju svoje rečenice:
  - Nacrti: „Nemaš nacrt.“
  - Istorija: „Ovde su završeni, otkazani i istekli zadaci.“

  Uvek bez „Obriši uslove“.

**Arhiva** je jedan ekran iz „Moj plan“ (2.7). Ima čipove „Sve · Završeno · Otkazano · Isteklo“ preko zadataka, prijava i Dogovora, i jednu sivu rečenicu na dnu: „Obrisani nacrti se ne čuvaju.“ Tabovi Istorija u Mojim zadacima i Dogovorima ostaju kao brz pogled.

P1 · M · [klijent].

### 2.3 Jedan obrazac za nepovratne radnje

**Sada**

- **Šta je dobro:**
  - `ConfirmSheet` ima jednu potvrdu, tiho „Odustani“ i crvenu boju za nepovratno (`ui/system/ConfirmSheet.tsx:36-89`).
  - `ActionSheet` stavlja crvene redove poslednje (`ActionSheet.tsx:29-32`).
  - `Alert.alert` se više nigde ne koristi.
- **Šta ne valja:**
  - **Brisanje i otkazivanje zadatka:** brisanje nacrta traži da prvo sam ukloniš slike (`NeedLifecycleActions.tsx:23`). Otkazivanje zadatka nema razlog (`:127`). Nacrt nudi oba („Obriši“ i „Otkaži“, `:37`).
  - **Otkazivanje Dogovora:** razlog je samo slobodan tekst (`ui/agreements/AgreementActionsScreen.tsx`).
  - **Radnje bez potvrde:**
    - „Pošalji prijavu problema“ i „Podeli svoj broj“ rade odmah (`app/dogovor/[id].tsx:425,490`);
    - odblokiranje na Bezbednosti ide bez potvrde, a u listi Blokirani sa potvrdom (`SafetyScreen.tsx:70`, `app/(app)/profil/blokirani.tsx:66-68`);
    - odjava ide bez potvrde.
  - **Posle uspeha:**
    - posle otkazivanja ili brisanja ekran pokazuje staro stanje pod sivom radnjom (`NeedLifecycleActions.tsx:178`);
    - „Prikaži aktuelni Dogovor“ posle otkazivanja ne otvara Dogovor (`ui/agreements/AgreementActionsPresentation.tsx:155`).

**Predlog: četiri koraka, isto za sve**

1. **Ulaz:** crveni red na dnu menija „···“ ekrana na koji se radnja odnosi. Nikad kao dugme pored glavne radnje.
2. **Potvrda** (`ConfirmSheet`):
   - naslov je glagol sa upitnikom i sa imenom ili naslovom;
   - jedna rečenica posledice: šta vidi druga strana i gde ćeš ovo posle naći;
   - gde server prima razlog, ispod idu čipovi razloga + „Drugo“ sa poljem. Dok razlog nije izabran, potvrda je siva sa razlogom „Izaberi razlog.“
3. **Posle potvrde sa servera:**
   - traka „Poruka“ sa ishodom i linkom na mesto u Istoriji ili Arhivi;
   - ekran se odmah osvežava ili zatvara.
4. **Neizvestan ishod:** ostaje postojeće „Proveravamo potvrdu…“ + „Proveri ishod“, nikad lažan uspeh.

| Radnja | Naslov | Posledica | Razlog | Posle |
|---|---|---|---|---|
| Obriši nacrt | „Obriši nacrt?“ | „Nacrt i njegove fotografije se brišu. Ovo ne možeš da vratiš.“ | ne | „Nacrt je obrisan“ |
| Povuci prijavu | „Povući prijavu za {naslov}?“ | „Naručilac više ne vidi tvoju ponudu. Dok zadatak prima prijave, možeš poslati novu.“ | ne | „Prijava je povučena · Moje prijave“ |
| Otkaži zadatak | „Otkazati {naslov}?“ | „Zadatak više ne prima prijave, a poslate prijave se zatvaraju. Ostaje u Arhivi.“ | čipovi: „Više mi ne treba“ · „Rešeno je drugačije“ · „Promenio se termin“ · „Drugo“ | „Zadatak je otkazan · Arhiva“ |
| Otkaži Dogovor | „Otkazati Dogovor sa {ime}?“ | „{Ime} dobija obaveštenje i razlog u Porukama. Deljeni kontakt i tačna lokacija se opozivaju.“ (postojeća rečenica) | obavezan; čipovi + polje | „Dogovor je otkazan · Arhiva“ |
| Blokiraj osobu | „Blokirati {ime}?“ | postojeća rečenica (`SafetyScreen.tsx:80-92`), ali uvek sa imenom | ne | „Blokiranje je sačuvano“ · **Vrati** |
| Odblokiraj | „Odblokirati {ime}?“ | „Odblokiranje ne vraća ranije deljen kontakt ni lokaciju.“ | ne | „Blokiranje je uklonjeno“ · **Vrati** |
| Podeli broj ili lokaciju | bez potvrde | — | — | „Broj je podeljen sa {ime}“ · **Vrati** (= opozovi) |
| Prijavi problem | „Poslati prijavu problema?“ | „{Ime} je vidi u Porukama. Automatski završetak se zaustavlja.“ | tekst | „Problem je prijavljen“ |
| Odjavi se | „Odjaviti se sa ovog telefona?“ | „Podaci ostaju na nalogu.“ | ne | — |

- **Nacrt:** nudi samo „Obriši nacrt“; „Otkaži zadatak“ se ne nudi za nacrt.
- **Brisanje nacrta sa fotografijama:** klijent sam uklanja slike redom, pa briše nacrt, uz jedan oporavak. Pre toga se mora proveriti na jednokratnoj bazi da to ne krši zaključavanje slika iz RC02.
- **Razlog otkazivanja zadatka:** proveriti da li server čuva `reason` [server proveriti].

P1 · M · [klijent].

### 2.4 Paneli, prozori i iskačući elementi

**Pravilo**

| Šta | Mesto | Izgled |
|---|---|---|
| Odluka ili rad sa više koraka (objava, prijava, izmena Dogovora, ocena) | ceo ekran | glavna radnja u `FlowFooter` |
| Brz izbor, filter, kratak unos, javni profil, odgovor na pitanje | panel `ProductSheet` | naslov + ×, radnja zakačena dole |
| Retke radnje | meni „···“ (`ActionSheet`) | sličica + glagol; crveno poslednje |
| Pitanje pre nepovratne radnje | `ConfirmSheet` | jedna potvrda, tiho „Odustani“ |
| Kartica tačke na mapi | `PeekSheet` | bez zatamnjenja |
| Uspeh, ishod | traka „Poruka“ (nova) | dole, iznad donje trake, 4 s (6 s kad ima radnju) |
| Stanje veze, nalog u zatvaranju | linija u sadržaju | ne prozor |
| Slika preko celog ekrana | `PhotoViewer` | crna pozadina je izuzetak |

**Odstupanja koja se ispravljaju**

- **Panel u panelu:** potvrda izbora i javni profil se crtaju unutar panela ponude (`ui/v2/ApplicationSelectionPresentation.tsx:375-376`). Panel ponude se zatvara, pa se otvara potvrda.
- **Ručni prozori sa sopstvenim izgledom:**
  - pregled završetka je ručni `Modal` (`ui/agreements/AgreementCompletionReview.tsx`) i postaje `ProductSheet` sa istim tekstom;
  - uvećana mapa koristi ručni `Modal` koji ne poštuje smanjen pokret (`LocationPointEditor.tsx:429`);
  - zatvaranje naloga je ručni `Modal` preko celog ekrana (`ui/closure/ClosureDialog.tsx:29`), što je prihvatljivo kao tok.

**Nova komponenta „Poruka“**

- **Izgled:** bela kapsula sa senkom `sheetLift`, crn tekst 15 px i jedno zeleno tekstualno dugme („Vrati“, „Otvori“). Stoji 16 dp od ivica.
- **Pokret:** ulazi pomerajem +8 dp i providnošću za 240 ms, izlazi za 160 ms; pri smanjenom pokretu se samo pojavi.
- **Ponašanje:**
  - čitač ekrana je čuje (`announceForAccessibility`);
  - u isto vreme postoji samo jedna;
  - haptika „uspeh“ samo za ishod potvrđen sa servera (pravilo R5).
- **Tehnika:** RN `Animated` na native drajveru, bez Reanimated `exiting` (B22).
- **Zamenjuje** oko 10 rasutih linija i najava, na primer „Dostupnost je sačuvana.“ (`ui/calendar/AvailabilityForm.tsx:366`) i „Podešavanja su sačuvana.“ (`PushPreferences.tsx:374`).

P1 · M · [klijent].

### 2.5 Početna

**Sada** (`ui/home/HomePresentation.tsx`)

1. Gornja traka: znak, zvonce, avatar.
2. Dva jednaka uzdignuta dugmeta sa crtežom 96 dp (64 pri velikom tekstu) (`:37-67`).
3. Skelet od dva reda.
4. „Čeka te“: najviše 3 reda (`data/homeSnapshot.ts:67`) i red ocena (`:220-234`). Kad ništa ne čeka, cela sekcija nestaje (`:192`).
5. „Sledeći Dogovor“ ili „Aktivni Dogovor“ (samo jedan, vreme je siva linija, `:106-109`).
6. „Moji zadaci“ i „Moje prijave“ posle velikog razmaka (`:243-246,304`).

`firstRun` se ne koristi.

**Kritika**

- Nalogu koji radi dva velika dugmeta guraju „Čeka te“ ispod polovine ekrana pri fontu 1,15.
- Tišina kad ništa ne čeka je dvosmislena.
- Nema „danas“.
- Do planera ne može da se dođe.

**Predlog** (dva jednaka dugmeta ostaju)

- **Novi nalog:** dva dugmeta, pa red „Kako radi“ (2.1).
- **Nalog koji radi:**
  1. Dva dugmeta u sažetoj visini: crtež 64 dp, jedan red podnaslova, oko 88 dp. **[odluka]** Ti si 6.10. potvrdio 96 dp.
  2. **„Čeka te“ uvek postoji** kad su čitanja uspela. Kad je prazno, piše jedan sivi red sa `check` sličicom: „Ništa ne čeka tvoju odluku.“
  3. **„Moj plan“** umesto „Sledeći Dogovor“:
     - prvi red je dan napred, crno: „Danas · 14:00–16:00“ ili „Sutra“ ili dan u nedelji;
     - zatim naslov i osoba sa slikom 32 dp;
     - ispod jedna siva linija: „Ove nedelje još 2 Dogovora · 1 zadatak bez tačnog termina“;
     - tihi link „Ceo plan“ vodi u 2.7.
     - „Danas“ i „Sutra“ se računaju iz prihvaćenog početka po vremenu u Srbiji, nikad iz teksta.
  4. **„Moji zadaci“ i „Moje prijave“** odmah ispod, u jednoj grupi bez velikog razmaka. Treći red je „Sačuvani zadaci · N“ kad 2.15 postoji.
- **Pokret:** nov red u „Čeka te“ ulazi kao danas (samo novi ID). Bez animacije brojki.

P1 · S/M · [klijent]. Brojke na Početnoj pri rastu: vidi 2.16.

### 2.6 Dogovori — lista i detalj

**Lista sada** (`ui/v2/AgreementCollectionPresentation.tsx`)

- Tabovi Aktivni | Istorija sa brojkama (`:222-226`).
- Kalendar je samo ikonica, bez reči (`:270`).
- Čip „Čeka moju potvrdu“ (`:256-261`). U njemu je glas u prvom licu, a prazno stanje istog čipa kaže „ne čeka tvoju potvrdu“ (`:250`).
- Kartica (`:130-178`):
  - naslov 18;
  - osoba sa slikom, ulogom i stanjem (osim kod CONFIRMED);
  - termin i zona;
  - mesto;
  - ljudi + „{iznos} ukupno“ ili „Iznos nije sačuvan“;
  - narandžasta noga sa radnjom.
- Redosled je po prihvaćenom početku (`:204-215`).
- Poslednja poruka i nepročitano se ne vide.

**Predlog za listu**

- **Grupe u Aktivnima:** „Čeka tebe“ (sve sa narandžastom nogom, uvek prvo) · „Danas“ · „Sutra“ · „Ove nedelje“ · „Kasnije“ · „Bez tačnog termina“.
- **Sažeta kartica** (oko 4 reda):
  1. slika 40 + naslov (crno, 2 reda) + ime · uloga;
  2. „Danas 14:00 · Novi Beograd“ (sivo);
  3. `StatusChip` + iznos desno;
  4. narandžasta noga samo kad nešto čeka tebe.
- **„Nova poruka“ sa zelenom tačkom:** samo ako čitač Poruka ima nepročitano po Dogovoru. Danas ima samo za grupe (`ui/messages/ConversationInboxPresentation.tsx:131-133`), pa za lične razgovore treba [server proveriti].
- **„Plan“ pilula sa rečju** (`caption`) vodi u Moj plan.
- **Čip** dobija ime „Čeka tvoju potvrdu“.
- **Istorija:** čipovi „Sve · Završeni · Otkazani“; otkazan pokazuje ko je otkazao i kada.

P1 · M · [klijent].

**Detalj sada** (`app/dogovor/[id].tsx`)

1. Traka sa osobom, pa tabovi Pregled | Poruke (`:454-456`).
2. Veza ka zadatku (`:458-464`).
3. `NextStepCard`.
4. „Dogovoreni uslovi“.
5. Grupa.
6. Zatvoreni „Kontakt“ (`:485-491`) i „Lokacija i pristup“ (`:494-498`).
7. Redovi:
   - „Tvoja prijava“;
   - „Izmene i otkazivanje“;
   - „Bezbednost i prijava“ (`:499-515`).
8. „Tok Dogovora“, sa jednim događajem.
9. Na samom dnu „Nešto nije u redu? / Prijavi problem“ (`:414-418`).
10. Zelena radnja dole: „Posao je gotov“ / „Potvrdi završetak“ / „Odgovori na predlog“ / „Oceni saradnju“, a inače „Otvori poruke“, što duplira tab (`:389-392`).

Uz ovo:
- pri povratku iz pozadine ceo ekran postaje skelet (`:284`);
- tekst se ne slaže: korak kaže „označi završetak“ i „48h“ (`AgreementWorkspace.tsx:64`), dugme „Posao je gotov“, a pregled „Javi da je posao gotov“ (`AgreementCompletionReview.tsx:24`).

**Predlog za detalj**

- **Traka koraka `AgreementSteps`** odmah ispod tabova, računata iz stanja (ne iz hronologije):
  - koraci: „Dogovoreno“ → „Posao je gotov“ → „Potvrđeno“ → „Ocena“;
  - trenutni korak je puna zelena tačka, prošli zelena kvačica, budući siva kontura;
  - otkazano: cela traka siva + „Otkazano {datum} · {ko} · {razlog}“;
  - rok automatskog završetka ide kao siva linija ispod drugog koraka, sa stvarnim rokom umesto zakucanog „48h“.

  P1 · M.
- **„···“ u traci, redom:**
  1. „Izmeni uslove“;
  2. „Podeli svoj broj“ / „Opozovi deljenje broja“;
  3. „Podeli lokaciju“ (kod naručioca);
  4. „Prijavi problem“;
  5. linija;
  6. „Otkaži Dogovor“ (crveno);
  7. „Prijavi ili blokiraj osobu“ (crveno).

  Redovi u sadržaju ostaju. P1 · S.
- **Kad nema koraka za tebe**, zelenog dugmeta nema. Siva rečenica stanja kaže na primer „Čeka da {ime} potvrdi završetak.“ P2 · S.
- **„Kontakt i mesto“** postaje jedan otvoren odeljak: broj, adresa po dozvoli, „Otvori u mapama“ (`ui/location/locationMapLinks.ts`). P2 · S.
- **Problem:** dok Dogovor čeka tvoju potvrdu, „Potvrdi završetak“ (zeleno) i „Prijavi problem“ (tiho) stoje jedno pored drugog. U ostalim stanjima problem je u meniju.
- **Povratak iz pozadine:** ostaje poslednji sadržaj sa linijom „Osvežavamo…“, umesto skeleta. P2 · S.
- **Rečnik završetka:** „Posao je gotov“ (radnik) i „Potvrdi završetak“ (naručilac) na svim mestima.
- **Izmene:** „Cena“ nikad ne sme da bude „0 RSD“ (`AgreementActionsPresentation.tsx:56`); ide „Iznos nije sačuvan“. P1 · S.

### 2.7 „Moj plan“ — jedan planer za sve moje (od postojećeg kalendara)

**Sada**

- „Kalendar obaveza“ (`ui/calendar/AgendaScreen.tsx`) ima:
  - nedelju sa strelicama i „Danas“;
  - 7 dana sa tačkom: zelena = aktivno, siva = završeno;
  - dan sa satnicom;
  - „Svi Dogovori · N bez tačnog termina“ i „Moja dostupnost za rad“.
- Pokazuje samo Dogovore. Otkazani se nikad ne prikazuju (`ui/calendar/agenda.ts:72-75`).
- Ulazi: ikonica u Dogovorima, Profil i savet u prijavi. Sa Početne se ne ulazi.
- Mešaju se vremenske zone: dani se seku po zoni telefona, a satovi po vremenu u Srbiji (`agenda.ts:135-137` naspram `:146-155`).

**Odluka o mestu:** „Moj plan“ je ekran koji se otvara, a ne četvrti tab, jer je raspored ekrana zaključan.
- Ulazi:
  - Početna („Moj plan“ / „Ceo plan“);
  - Dogovori (pilula „Plan“);
  - Profil.
- Tab Dogovori ostaje lista Dogovora. Plan je pogled kroz vreme preko svega mog.
- **[odluka]** Ime: „Moj plan“ ili „Raspored“.

**Sastav ekrana**

1. **Nedelja i dani:**
   - tačka po danu:
     - zelena = Dogovor;
     - narandžasti prsten = nešto čeka tebe;
     - siva = završeno;
     - isprekidana kontura = moja otvorena prijava na taj dan;
   - za radnika: senka slobodnih sati 4 dp ispod broja, iz postojeće dostupnosti;
   - prevlačenje levo i desno menja nedelju (strelice ostaju);
   - dodir na naslov nedelje otvara mesec u panelu (`DateRangeGrid` iz pretrage).
2. **Čipovi:** „Sve · Dogovori · Moji zadaci · Moje prijave“.
3. **Dan, redom po satu, svaki red sa `StatusChip`:**
   - Dogovori sa tačnim terminom (kao danas);
   - **moji objavljeni zadaci** sa tačnim vremenom („Bira se · 3“, „Objavljen“);
   - **moje poslate prijave** sa terminom (isprekidana ivica, „Prijava poslata“). Ovo je informacija, a ne obaveza.
   - Preklapanje dva termina dobija narandžastu liniju „Preklapa se sa {naslov}“.
4. **„Bez tačnog termina“:** zadaci i Dogovori sa „fleksibilno / ove nedelje“, sa svojom rečju vremena.
5. **Na dnu:** „Moja dostupnost za rad“ i **„Arhiva“** (2.2).

**Zone:** dani i satovi idu po vremenu u Srbiji, uz postojeću oznaku „Po vremenu u Srbiji“ kad telefon nije u toj zoni.

**Podaci:** postojeća čitanja `mojePotrebe`, `mojePrijave`, `mojiDogovori` i `workerCalendar` (Početna već čita prva tri).

P1 · M · [klijent]. Za veliki broj stavki treba serversko čitanje po periodu (2.16) [server] P2.

### 2.8 Obaveštenja i Poruke

**Sada**

- **Spisak obaveštenja:**
  - filter „Sve | Moji zadaci | Moje prijave“, grupe po danu, zelena tačka za nepročitano, „Označi sve kao pročitano“ (`ui/notifications/InboxPresentation.tsx:27-29,47-62,189-193`);
  - tekst u spisku i tekst push-a se razlikuju za šest događaja (na primer push „Status Dogovora je promenjen“, a spisak „Dogovor je završen“).
- **Push:**
  - dodir uvek vodi na spisak (`PushRuntime.tsx:57-61`);
  - push sa „Izabran si“ je u muškom rodu (`publicInboxCopy.ts:14`, `pushNotificationCopy.mjs:10`);
  - za prijavljen problem push kaže „Oporavak naloga“ (`pushNotificationCopy.mjs:25`).
- **Dodir u spisku:**
  - „Potvrdi završetak“, ocena i problem otvaraju pregled Dogovora;
  - otkazan zadatak otvara Moje prijave bez prijave (`app/obavestenja.tsx:57-62`).
- **Zvonce:**
  - nema ga na Zadacima ni na Mojim prijavama;
  - broj nestaje pri svakom napuštanju ekrana (`data/inboxModel.ts:111`);
  - njihanje zvonca ne može da se pokrene (`ui/InboxBell.tsx:43`).
- **Poruke:**
  - ugašene u prodavničkom profilu (`eas.json:29-41`);
  - lični razgovori nemaju oznaku nepročitanog.

**Predlog**

- **Spisak:**
  - redovi koji traže radnju dobijaju narandžastu tačku i isti glagol kao na Početnoj;
  - gore stoji red „Čeka te · N“ koji filtrira samo njih;
  - spisak ide ispod.

  P1 · S.
- **Cilj po događaju** (isti za red i za push; tabela UX_NACRT §6):

  | Događaj | Vodi na |
  |---|---|
  | `COMPLETION_REQUIRED` | Dogovor sa otvorenim pregledom završetka |
  | `REVIEW_RECEIVED` | profil, ocene |
  | `RECOVERY_OPENED` (problem) | Dogovor, kod prijave problema |
  | `AGREEMENT_CHANGE_PROPOSED` | izmene (već tako) |
  | `NEED_CANCELLED` | ta prijava |
  | `MESSAGE_RECEIVED` | ta poruka (već tako) |

  P1 · M · [klijent].
- **Tekst, „ti“, bez roda:** isti u spisku i u push-u.
  - „Tvoja prijava je izabrana · {zadatak}“
  - „Nova prijava za {zadatak}“
  - „Posao je označen kao gotov. Potvrdi završetak.“
  - „{Ime} je prijavio problem“ ne ide, jer ima rod. Ide: „Prijavljen je problem u Dogovoru“.
  - „Dogovor je otkazan. Razlog je u Porukama.“
  - „Stigao je odgovor na tvoje pitanje“
  - „Zadatak je izmenjen. Proveri svoju prijavu.“

  Na zaključanom ekranu nema teksta zadatka (A20). Tekst push-a ide u paket za jedan uređaj (ZAVRSNA §5.4). P1 · S.
- **Zvonce:**
  - na svim glavnim ekranima, uključujući Zadatke (umesto stavke u „···“) i Moje prijave;
  - broj se ne briše pri napuštanju ekrana, nego se drži dok ne stigne nov.

  P1 · S.
- **Podešavanja obaveštenja:**
  - na vrhu red stanja telefona sa jednim dugmetom („Uključi obaveštenja na telefonu“) i rečenicom iznad dugmeta, ne u zatvorenom delu;
  - imena skupova svuda ista: „Moji zadaci“ i „Poslovi“ ili „Moje prijave“, jedno od ta dva;
  - jedan način čuvanja: telefon i kategorije čuvaju se odmah, uz traku „Sačuvano“.

  P2 · M.
- **Poruke:** u prvom izdanju samo kroz tab „Poruke“ u Dogovoru; četvrti tab posle tvoje odluke. **[odluka]**

### 2.9 Sistem pokreta

**Sada**

- Pravila R1–R8 (`ui/system/tokens.ts:205-227`).
- Prelaz ekrana je `shift` od 280 ms (cilj 240), a tabovi su bez animacije (`app/(app)/_layout.tsx:30-31,179`).
- `Appear`: novi redovi, 240 ms, korak 40 ms, najviše 6.
- `SuccessMark`: spring + haptika.
- Kvačica u dugmetu traje 1,2 s.
- Kamera ide 360 ms do pina, a pri smanjenom pokretu skače.
- Paneli koriste `sheetSpring`. Izuzetak je mapa, koja još koristi stari `springSheet` (`ui/v2/DiscoveryMap.tsx:463`).
- Lottie je odobren, ali nema poziva.
- Trenutak „Objavljeno“ se verovatno ne vidi: odmah sledi prelaz na Zadatke (`app/(app)/pregled-zadatka.tsx:297-299`).
- Posle izbora kandidata piše „Dogovor je sklopljen.“, pa sledi zamena ekrana (`ApplicationSelectionPresentation.tsx:342-343`). „Dogovoreno!“ ne postoji.

**Predlog** (RN `Animated` na native drajveru, bez Reanimated `exiting` i layout animacija, B22)

| Trenutak | Pokret | Vreme | Smanjen pokret |
|---|---|---|---|
| Ekran napred | `shift` + easeOut | **240** | bez |
| Tab | ostaje trenutno | — | — |
| Dodir | 0,97 dugme / 0,985 red, spring nazad | 120 | bez skaliranja, haptika ostaje |
| Panel | `sheetSpring` (i mapa prelazi na njega) | ~300 | 0 |
| Red stiže | `Appear`, samo nov ID | 240 + 40 | bez |
| Traka „Poruka“ | +8 dp + providnost | 240 / 160 | pojava |
| **Objavljeno** | `SuccessMark` 64 + „Zadatak je objavljen“ ostaje 1,2 s, pa prelaz na Zadatke sa tvojim pinom izabranim | 1,2 s | znak + haptika |
| **Dogovoreno!** | ceo ekran: lik (tvoj Lottie kad stigne; do tada `SuccessMark` 96) + „Dogovoreno!“ + osoba, termin i iznos, pa dugme „Otvori Dogovor“ | ~1,2 s, pa ostaje miran | prvi kadar + haptika |
| Prijava poslata, ocena poslata | `SuccessMark` 64 (postoji) | spring | znak |
| Kamera na pin | 360 easeOut, pin u čistu traku | 360 | skok |
| Kartica → detalj | vidi 2.11 | 240 | bez |
| Fotografije | uklapanje 180 ms kad stignu (R6) | 180 | odmah |
| Korak u traci Dogovora | tačka 0,6 → 1 kad se stanje promeni dok gledaš | 240 | odmah |
| Zvezdica | punjenje 0,8 → 1 + haptika `select` | 180 | odmah |

Nikad se ne animiraju cena, broj, vreme ni reč stanja.

P2 · M · [klijent]. „Objavljeno“ i „Dogovoreno!“ su P1, jer su to dva najvažnija trenutka.

### 2.10 Šta bi profesionalni tim dodao (redom koristi, prema tvojim pravilima)

1. **„Za mene“** (odlučeno 7.10.) — 2.13. P1 · [server] G4.
2. **Traka „Poruka“ i doslednost ishoda** — 2.4. P1.
3. **„Moj plan“ i Arhiva** — 2.7. P1.
4. **Zvezdica „Sačuvaj“** — 2.15. P2 · [server][sertifikat].
5. **Savet sledećeg koraka u istom obliku na svakom „mom“ ekranu** (zadatak, prijava, Dogovor). Rečenice samo iz stvarnog stanja, na primer:
   - „Imaš 3 prijave. Uporedi ih i izaberi.“
   - „Čekaš odgovor naručioca. Javićemo ti.“

   P1 · S.
6. **„Objavi ponovo“ iz Arhive:** novi AI razgovor sa predlogom starih činjenica (opis, mesto, način cene). Vreme i cena se uvek pitaju ponovo. Treba proveriti postoji li komanda „nacrt iz zadatka“. P2 · M · [server proveriti].
7. **Znaci poverenja svuda isti:**
   - ocena: „4,8 · 12 ocena“ / „Još nema ocena“;
   - „N završenih Dogovora“;
   - „Identitet je potvrđen“ (postoji u `PublicProfileSheet.tsx:88-111`);
   - jedan red na kartici prijave, kartici zadatka i detalju.

   P2 · S.
8. **Linija „Nema veze“** iz neuspelih čitanja, uz poslednje učitano (bez NetInfo, U19). P2 · M.
9. **Brzi odgovori u Dogovoru:** „Krećem“, „Stižem za 10 min“, „Kasnim malo“. To su obične poruke, a ne novo stanje. P3 · S.
10. **Primeri rečenica na praznom AI razgovoru:** komponenta to već podržava (`openings`, `ui/aiFirst/AiConversationShell.tsx:60-63`), ali ih niko ne prosleđuje (`IntakePresentation.tsx:142`). To su primeri rečenica, nikad kategorije. P3 · S.
11. **„Podeli zadatak“:** sistemski `Share`, bez paketa, a link ne otkriva adresu. P3 · S.
12. **„Pozovi istu osobu ponovo“:** traži novi serverski koncept. P3 · L · [server][odluka].

Namerno izostavljeno:
- podsetnik pred termin (A22);
- HITNO;
- sačuvane pretrage sa obaveštenjem (posle „Za mene“);
- slika zadatka na kartici (U13: „ne za sada“);
- cena na pinu (U17: kasnije, kao A/B).

### 2.11 Jedna porodica: pin → kartica na mapi → kartica u listi → detalj → prijava

**Sada**

- **Pin** (`825c8e16`): bela kapsula sa znakom (jedan zadatak) ili brojem (grupa, do 999+); izabran je na vrhu, 1,06×, sa narandžastom ivicom, oreolom i brojem (`ui/v2/discovery/DiscoveryV1ServerMarkerLayer.tsx:31-32,70-82`). Pin nema cenu.
- **Kartica na mapi** (`DiscoveryPeek.tsx`): stanje, naslov, vrednost + „0/2“, mesto, vreme, objavljivač; bez slike (`:47-48`).
- **Kartica u listi** (`TaskCard.tsx`, `TaskFace.tsx`): red stanja, naslov, vrednost + „0/2“, mesto, vreme, jedan uslov, objavljivač „4,8 (12)“.
- **Detalj** (`ui/v2/PublicNeedPresentation.tsx`): fotografije, naslov, cena („Ukupno za ceo zadatak“ / „Tražim ponude“ + „Ukupan iznos predlažeš u prijavi.“), „2 osobe · 0/2 popunjeno“, mesto, vreme, „O zadatku“, „Važno“, objavljivač „Traži pomoć · Ocena 4,8“, mapa, „Pitanja i odgovori“; dole „Sastavi prijavu →“.
- **Prijava** (`ApplicationComposerPresentation.tsx`): „Tvoja prijava“, naslov + „Tražim ponude“ + mesto, pa cena, ljudi („Traži 2 osobe“ / „Još 1 od 2 mesta“), termin i poruka.

**Kritika**

- Isti zadatak menja reči na svakom koraku.
- „Tražim ponude“ je glas naručioca, a čita ga radnik.
- Vreme se formira na dva načina (`TaskDecision.tsx:91` naspram `TaskCard.tsx:69`).

**Predlog: jedna anatomija `TaskFacts`, pet gustina, isti redosled i iste reči**

Redosled je uvek isti:
> [stanje] → **naslov** → **vrednost** → mesta → mesto · vreme → starost · objavljivač

| Gustina | Pre dodira (šta se vidi) | Dodir → šta se otvara i kako |
|---|---|---|
| **Pin** | kapsula: znak ili broj (danas); cena u kapsuli kasnije kao A/B (U17, treba [server] ZAVRSNA §5.3) | kamera klizi 360 ms dok pin ne bude u čistoj traci; izabran 1,06× sa narandžastom ivicom; odozdo ulazi kartica na mapi (`sheetSpring`) |
| **Kartica na mapi** | naslov (crno, 2 reda) · vrednost · „1 od 2 mesta slobodno“ · mesto · vreme · „pre 2 dana · {ime} ★4,8“ · zvezdica · × | cela kartica je jedan dodir → detalj (prelaz 240 ms); kartica ostaje ispod za Nazad |
| **Kartica u listi** | isto kao kartica na mapi + jedan uslov kao informacija („Treba vozilo“) + `StatusChip` samo za odnos („Tvoj zadatak“, „Prijava poslata“, „Sačuvano“) | prelaz 240 ms; vrh detalja ponavlja istu glavu, pa oko ne traži |
| **Detalj** | 1) traka fotografija 16:9 sa „1/4“ (ako ih ima) 2) **ista glava** kao kartica 3) „Šta treba uraditi“: 4 reda + „Prikaži ceo opis“ 4) „Važno“ 5) „Ko objavljuje“ → javni profil 6) „Mesto“ (približna mapa) 7) „Pitanja i odgovori · N“; dole zeleno „Sastavi prijavu“ ili sivo sa razlogom | glava je odmah tu, iz podataka liste (EX-03); fotografije se uklapaju za 180 ms kad stignu; ostali odeljci se jednom pojave (providnost 160 ms) kad stigne puno čitanje; opis se otvara kroz `Disclosure` |
| **Prijava** | gore sažeta glava zadatka (naslov · vrednost · mesto · vreme) kao „priznanica“; ispod moja ponuda | posle slanja `SuccessMark` + „Prijava je poslata“ + šta je poslato |

**Rečnik**

- **Vrednost:**
  - za radnika: „6.000 RSD ukupno“ / „3.000 RSD po osobi“ / „Prima ponude“ / „Cena nije navedena“;
  - za naručioca: „Tražiš ponude“.
- **Mesta:** „Treba 2 osobe · 1 slobodno mesto“; na kartici kraće: „1 od 2 slobodno“.
- **Ocena:** „★ 4,8 · 12 ocena“ / „Još nema ocena“ / „Ocena trenutno nije dostupna“.
- **Vreme:** jedan formator (`needScheduleText`) svuda.
- **Starost:** 2.14.

**Bogatstvo bez buke**

- Boju i karakter nose fotografije (samo u detalju), 2.5D FactArt sličice od 24 dp u redovima činjenica i lice objavljivača. Površine su bele.
- P3: fotografije u vrhu detalja se blago pomeraju pri skrolu (`translateY`, odnos 0,5, `Animated.event` na native drajveru). To je samo transform, pa je dozvoljeno po R1.
- Pravi „kartica raste u detalj“ (prelaz sa zajedničkim elementom) se **ne predlaže**: Reanimated shared transitions krše B22, a efekat se ne može pouzdano proveriti na telefonu. Kontinuitet daje ista glava.

P1 · M · [klijent].

### 2.12 Prijava kao jasan objekat (radnik i naručilac)

**Sada**

- **Moje prijave:**
  - tabovi „Sve / Čeka te / Aktivne / Završene“;
  - kartica: stanje, naslov, mesto, vreme, „Tvoja ponuda“, ljudi, poruka i jedna noga („Otvori Dogovor“ / „Povuci prijavu“ / „Pregledaj izmene zadatka“) (`ApplicationFace.tsx`);
  - izmena je moguća samo posle promene zadatka (`app/(app)/moje-prijave.tsx:214`);
  - granice poruke se razlikuju: 4.000 znakova pri slanju i 1.200 pri izmeni (`:221`).
- **Kandidati:**
  - kartica: slika, ime, ocena, linija stanja, ukupno · ljudi, termin, poruka (`CandidateFace.tsx`);
  - panel ponude, pa potvrda „Jedan izbor sklapa Dogovor.“;
  - „prijava“ i „ponuda“ se mešaju na istom ekranu („Prijave“ / „Prikaži ponude“).
- **Reč „prijava“ znači tri stvari:**
  - prijavu na zadatak;
  - prijavu problema i bezbednosnu prijavu;
  - ulaz u nalog („Prijava“).

**Predlog: `PrijavaCard`, jedna anatomija, dva pogleda**

| Red | Radnik (Moje prijave) | Naručilac (Kandidati) |
|---|---|---|
| 1 | `StatusChip`: Poslata / Viđena / U užem izboru / Izabrana / Nije izabrana / Povučena / Zadatak je izmenjen | `StatusChip` iste reči, iz ugla naručioca: „Nova“, „Viđena“, „Povučena“, „Izabrana“ |
| 2 | **„Za: {naslov zadatka}“** (dodir → zadatak) | **osoba:** slika 48, ime, „★4,8 · 12 ocena · 7 završenih Dogovora“ |
| 3 | Termin: „sub 12. okt · 14:00–16:00“ ili „Termin zadatka“ | isto |
| 4 | **„Tvoja ponuda: 6.000 RSD ukupno · 2 osobe“** | **„Ponuda: 6.000 RSD ukupno · 2 osobe“** |
| 5 | poruka, 2 reda + „Prikaži celu“ | isto |
| 6 | sledeći korak: „Otvori Dogovor“ / „Pregledaj izmene“; „Izmeni prijavu“ i crveno „Povuci prijavu“ u „···“ | zeleno „Izaberi“ u panelu ponude; „Pogledaj profil“ |

- **Rečnik:**
  - „prijava“ = ono što radnik pošalje;
  - „ponuda“ = samo iznos u njoj;
  - prijava problema = „Prijavi problem“;
  - bezbednost = „Prijavi osobu“ / „Bezbednosna prijava“;
  - na ulazu „Nastavi do Prijava, Zadataka i Dogovora.“ postaje „Nastavi do svojih zadataka i Dogovora.“ (`auth.tsx:332`).
- **Izabrana prijava** prelazi iz „Završene“ u „Aktivne“, sa „Otvori Dogovor“. [klijent]
- **Izmena prijave dok čeka** (cena, ljudi, poruka) samo ako server to dozvoljava van stanja STALE [server proveriti]. Granica poruke se usklađuje na jednu vrednost [klijent].
- **Kandidati:**
  - poređenje kao tabela sa istim poljima u istom redu;
  - redosled je vidljiv čip („Redom pristizanja / Najniža cena“);
  - potvrda izbora: „Izaberi {ime}?“ + „Prihvataš: 6.000 RSD ukupno · 2 osobe · sub 14:00 po vremenu u Srbiji. Dogovor odmah važi za obe strane.“;
  - posle toga trenutak „Dogovoreno!“ (2.9);
  - interni tekst se uklanja: „oznaka viđenosti“, „paralelni zadaci“ (`app/(app)/potrebe/[id]/kandidati.tsx:209`, `ApplicationSelectionPresentation.tsx:265`).

P1 · M · [klijent].

### 2.13 Filteri mape i opseg „Svi zadaci / Za mene“

**Sada**

- **Traka pretrage:** pilula sa dva reda („Svi zadaci / Ova oblast / mesto …“ i „Bilo kada · …“), „Filteri“ (u sažetom prikazu samo ikonica) i „···“ (`ui/v2/discovery/DiscoverySearchBar.tsx:85-128`).
- **Čipovi:** „U blizini · Na daljinu · Na licu mesta · Danas · Sutra · Ove nedelje · Navedena cena · Tražim ponude · 2+ mesta“. Prvo mesto je ostavljeno za „Za mene“ (`DiscoveryPresentation.tsx:777-792`).
- **Panel:** „Gde“ (mesta sa brojem), „Kada“, „Kako se radi“, „Koliko vas dolazi“, „Cena“ i jedno zeleno „Prikaži N zadataka“ (`DiscoverySearchPanel.tsx`).
- **Bez „+“:** „Objavi zadatak“ je samo u „···“ (`DiscoverySearchBar.tsx:93-97`).
- **Sopstveni zadaci** se vide sa „Tvoj zadatak“ i otvaraju sopstveni detalj (`app/(app)/zadaci.tsx:202-211`).

**Predlog**

1. **Opseg kao prvi element trake:** kapsula sa dva dela „Svi zadaci | Za mene“ (U16: kapsule za segmente).
   - „Za mene“ prikazuje samo zadatke po vrsti posla, području i vremenu (odluka 7.10.). Isključeno znači sve.
   - Uključeno pokazuje broj „Za tebe: N“.
   - Dok paket G4 nije primenjen, kapsula se **ne prikazuje** (nema lažnog sivog dugmeta).
   - Ako radni profil ne postoji, „Za mene“ otvara kratak panel „Za ovo treba radni profil“ + „Napravi radni profil“.
   - P1 · M · [server] G4.
2. **„Gde“ dobija jasna imena** (da se ne sudara sa „Svi zadaci“):
   - **„Svuda“**: ceo spisak, i zadaci bez tačke;
   - **„Ova oblast“**: okvir mape;
   - **„U blizini“**: jednom, po dozvoli;
   - **pretraga mesta**: grad ili deo grada, sa brojem;
   - **„Na daljinu“**.

   Prvi red pilule uvek kaže izabrano („Svuda“, „Novi Sad“, „Ova oblast“). P1 · S · [klijent].
3. **Ostali filteri ostaju u panelu.** Primenjeni uslovi su čipovi sa × iznad liste (postoje). Dugme „Filteri“ uvek ima reč i broj („Filteri · 2“). Jedno ime: „Filteri“ (ne „Uslovi pretrage“ ni „Pretraga“). P1 · S.
4. **Sopstveni zadaci:**
   - u „Svi zadaci“ ostaju vidljivi, sa sivim `StatusChip` „Tvoj zadatak“ i bez „Sastavi prijavu“ (postoji);
   - u „Za mene“ se nikad ne pojavljuju (deo paketa G4).

   **[odluka]** Da li ih potpuno sakriti iz Zadataka? Tada treba serverski ključ filtera, da brojevi ostanu tačni.
5. **„+ Objavi“** se vraća kao dugme sa rečju u traci (UX_NACRT §3), a „···“ zadržava Profil. Zvonce ide u traku (2.8). P1 · S.
6. **Reči:**
   - čip „Tražim ponude“ postaje „Prima ponude“;
   - čip „2+ mesta“ postaje „Za 2 i više“.

### 2.14 Lista svih zadataka: najnovije prvo i starost

**Sada**

- Stranica (PAGE) se ređa `section, published_at desc, id desc` (`supabase/candidates/p6_discovery_rollout_v3.sql:288-290`). `section` deli zadatke bez tačke samo u opsegu „oblast“ (`:285`). U opsegu „sve“ to je čisto **najnovije prvo, uključujući zadatke bez tačke**. **Promena servera za redosled nije potrebna.**
- Vreme objave (`publishedAt`) već stiže u svakom redu (`:293`; `data/discoveryV1Contract.ts:18`).
- Stranica je snimak do trenutka prvog čitanja (`through_at`). Nov zadatak se vidi tek posle osvežavanja.

**Predlog**

1. **Starost na kartici, kartici na mapi i detalju** (sivo, uz objavljivača):
   - „Upravo“ (do 5 min);
   - „pre 25 min“;
   - „pre 3 sata“;
   - „juče“;
   - „pre 2 dana“, „pre 5 dana“, „pre 21 dan“;
   - „pre 3 nedelje“;
   - „pre 2 meseca“.

   Dani se računaju po kalendaru u vremenu Srbije, uz postojeći pomoćnik za množinu. P1 · S · [klijent].
2. **Iznad liste** jedna siva reč reda: „Najnovije prvo“ (bez drugih sortiranja u V1; udaljenost traži server).
3. **Nov zadatak na vrhu:**
   - osvežavanje od vrha pri povratku na Zadatke, posle povlačenja i posle sopstvene objave (postoji);
   - pilula „3 nova zadatka · Prikaži“ na vrhu liste traži jeftino serversko brojanje „novije od X“. Do paketa brzine (2.16) se ne pravi ni kao periodično čitanje cele stranice, jer bi to opteretilo server. P2 · S · [server].

### 2.15 Zvezdica — sačuvaj za kasnije

**Sada:** ne postoji. Pretraga koda i serverskih šema za saved, favorite i bookmark ne nalazi ništa.

**Predlog**

- **Gde se vidi:**
  - **kartica u listi:** gore desno, 44 dp, siva kontura, a sačuvano je zeleno puno;
  - **kartica na mapi:** pored ×;
  - **detalj:** u gornjoj traci, pre „···“;
  - nije na sopstvenom zadatku.
- **Pokret:** punjenje 0,8 → 1 za 180 ms + haptika `select`.
- **Traka posle dodira:** „Sačuvano · Prikaži“, a uklanjanje daje „Uklonjeno · Vrati“.
- **Gde je lista:**
  - čip „Sačuvano · N“ u traci Zadataka, posle opsega;
  - red „Sačuvani zadaci · N“ na Početnoj, u grupi „Moje“.
- **Zatvoren sačuvan zadatak:** ostaje u listi kao siv sa „Više ne prima prijave“ i nestaje posle 7 dana (to pravilo određuje server). Blokirane osobe se ne prikazuju.
- **Zašto server:** zvezdica mora da važi po nalogu, posle ponovne instalacije i na drugom telefonu, pa treba tabela po nalogu sa RLS, komanda za uključi/isključi i stranični spisak. Tabela ulazi u **izvoz podataka i brisanje pri zatvaranju naloga**, a to pomera sertifikat zatvaranja (AGENTS §3.1.4).
- **Samo lokalna verzija** (na telefonu) se ne predlaže: posle ponovne instalacije bi „izgubila“ zvezdice.

P2 · M · [server][sertifikat] + [klijent] S.

### 2.16 Razmera i brzina (mnogo korisnika, mnogo zadataka)

| Mesto | Danas | Šta treba | Gde |
|---|---|---|---|
| Zadaci, mapa i lista | `rpc_discovery_v1` čita SVE otvorene zadatke pri svakom PAGE i MAP pozivu, bez prostornog indeksa (oko 330 ms na 2.000, ZAVRSNA §2); klijent je posle `825c8e16` pao sa 400 na 50 pretvaranja po pomeranju | filter oblasti kroz GiST indeks u prvom koraku; dani samo uz filter vremena; jeftino brojanje „novijih“; cena za grupu sa jednim zadatkom | [server] P1 pre rasta |
| Zadaci, prvo otvaranje P6 | greška ili učitavanje prekriju ceo ekran, bez pretrage (`DiscoveryV1Screen.tsx:240-246`) | skelet unutar liste; pretraga i traka ostaju | [klijent] P1 · S |
| Početna | 4 čitanja pune liste za brojke i sledeći Dogovor (`homeSnapshot.ts:16-18`) | serverski zbir brojki + sledeći Dogovor | [server] P2 |
| Moji zadaci, kandidati, Moje prijave | prekidači straničenja (EX-04) postoje, ali nisu u `eas.json` | uključiti posle provere na emulatoru | [klijent] P1 · S |
| Dogovori, Moj plan | `mojiDogovori` u celosti; kalendar do 2.000 redova (`AgendaScreen.tsx:57`) | čitanje po periodu (nedelja ± 1) i stranice istorije | [server] P2 |
| Dogovor, prepiska | ScrollView bez straničenja ponovo crta sve pri kucanju (MASTER_PLAN indeks 170) | `FlatList` sa obrnutim redom, izmereno na telefonu | [klijent] P2 · M |
| Dogovor, povratak iz pozadine | ceo ekran postaje skelet (`dogovor/[id].tsx:284`) | zadrži sadržaj + linija „Osvežavamo…“ | [klijent] P2 · S |
| Obaveštenja | strane od 30 (dobro); zvonce se briše pri napuštanju ekrana | drži poslednji broj | [klijent] P2 · S |
| Slike | `expo-image` keš | sličice manje rezolucije za liste (posle U13) | — |
| Ponude radnicima | talasi do 40 po izmeni, staje na 3 odgovora (ZAVRSNA G7) | po tvojoj odluci | [server][odluka] |

Pravilo za svaki ekran:
- skelet samo pri prvom čitanju;
- topao povratak bez skeleta;
- osvežavanje u pozadini;
- greška bez gubitka prikazanog.

### 2.17 Jedan rečnik i jedan glas

Ovo su ispravke teksta koje se ponavljaju na mnogo ekrana i rade se kao jedan prolaz kroz tekst. P1 · M · [klijent].

- **Gramatički rod:**

  | Sada | Postaje |
  |---|---|
  | „Izabran si“ | „Tvoja prijava je izabrana“ |
  | „Već si se prijavio“ (`PricePill.tsx:12`) i „…ili si se već prijavio.“ (`PublicNeedPresentation.tsx:125`) | „Prijava je već poslata“ |
  | „koje si isključio“ (`data/applicationSelectionClientService.ts:60`) | „isključeno“ |
  | „da bi snimio“ (`voiceCopy.ts:9`) | „za glasovnu poruku“ |
  | „onaj ko je objavio/uskočio“ (`data/agreementCompletion.ts:17-18`) | „naručilac“ / „radnik“ |

- **Glas aplikacije je uvek „mi“:**

  | Sada | Postaje |
  |---|---|
  | „Šaljem…“ | „Šaljemo…“ |
  | „Čuvam izbor…“ | „Čuvamo…“ |
  | „Proveravam tvoj status…“ | „Proveravamo…“ |
  | „Čekam dozvolu mikrofona“ | „Čekamo…“ |
  | „Ne mogu da očitam gde si“ | „Ne možemo da očitamo“ |
  | „Prikazujem…“ | „Prikazujemo…“ |

- **Velika slova:** „zadatak“ i „prijava“ se pišu malim slovom u rečenici. „Dogovor“ ostaje veliko kao ime funkcije (tvoja odluka).
- **Jedno ime za jednu stvar:**
  - „Pokušaj ponovo“ (ne „Probaj ponovo“);
  - „Odbaciti izmene?“ (ne „Odbaci izmene?“);
  - „Osoba“ (ne „korisnik“) na Bezbednosti;
  - „Suspendovan“ (ne „obustavljen“);
  - jedna reč za opis o sebi: „O meni“ (danas ih ima pet).
- **Bez internog jezika:**
  - „verzija {n}“, „Ponovi isti zahtev“, „oznaka viđenosti“, „transkript“, „Pokušaj se ipak računa…“ postaju jednostavne rečenice;
  - „Ponovi isti zahtev“ postaje „Pošalji ponovo“ (isti zahtev, bez dupliranja).
- **Bez eyebrow-a:**
  - „JEDAN NALOG · OBE MOGUĆNOSTI“, „BEZBEDAN POVRATAK“;
  - „Ovako će drugi videti zadatak“ (`ui/objava/ReviewPresentation.tsx:47`);
  - uvodne rečenice na Privatnosti, Izvozu, Pravnim dokumentima i Bezbednosti;
  - oznaka 12 px „Radni profil“ (`WorkerAiPresentation.tsx:45`).
- **Kategorija:** greška „Kategorija može imati najviše 120 znakova.“ (`data/aiNeedV2Production.ts:80`) ne sme da stigne do ljudi.
- **Tehnički podaci na ekranu:** `BuildIdentity` (commit, „OTA runtime“, „radno stablo“) na Profilu, O aplikaciji i oporavku lozinke (`ui/BuildIdentity.tsx:7-34`) se u prodavničkom buildu skriva, a ostaje samo „Verzija 1.0.0“.

### 2.18 Zelena glavna radnja i stanja dugmadi

**Sada:** radnje sa `tone="neutral"` + `brandAction` crtaju se crno (`ui/v2/V2Action.tsx:148`). To je slučaj na:
- radnom profilu (`radnik.tsx:226-229`);
- AI razgovoru za profil (`razgovor.tsx:289-290`);
- „Pregledaj i objavi“ i „Pokaži mesto na mapi“ u AI objavi (`IntakePresentation.tsx:220,404`).

Neaktivni redovi u `ActionSheet` i podršci su izbledeli na 0,45 (`ActionSheet.tsx:86`, `SupportPresentation.tsx:149,286`), suprotno pravilu „siva sa razlogom“.

**Predlog:**
- svaka glavna radnja je zelena sa belim slovima;
- crno ostaje samo za kontrole koje nisu glavna radnja;
- neaktivno je siva podloga sa razlogom, nikad prozirno.

P1 · S · [klijent].

### 2.19 Pretraga i filteri — odluka

**Sada**

- **Gore stoji pilula u dva reda:**
  - prvi red: „Svi zadaci“, „Ova oblast“, mesto ili „reč“;
  - drugi red: „Bilo kada · …“.
- **Pored pilule** su „Filteri“ i „···“, a ispod traka čipova.
- **Panel je već uradio dosta dobrog:**
  - otvara se preko zamućene pozadine (RN `Modal` + blur);
  - ima odeljke koji se otvaraju: Gde, Kada, Kako se radi, Koliko vas dolazi, Cena (`ui/v2/discovery/DiscoverySearchPanel.tsx:28-60`);
  - ima jedno zeleno „Prikaži N zadataka“ i „Obriši uslove“.
- **Šta ne valja:** u odeljku „Gde“ jedno polje služi za dve stvari, „Mesto ili reč iz zadatka“.
- **Pretraga na serveru već postoji za** tekst, cenu, način rada, broj ljudi, vreme, datume i mesto (`p6_discovery_rollout_v3.sql:155-180`).
- **Kako se traži tekst:**
  - traži se u naslovu, delu grada i potrebnim veštinama, alatu i vozilima, ali ne u opisu (`:277`);
  - poređenje razlikuje slova sa kvačicama: „ciscenje“ ne nađe „čišćenje“.

**Šta ljudi zaista traže**

- **Radnik** (najveći deo pretrage): pre svega **gde** (grad, deo grada, u blizini) i **kada** (danas, vikend). Zatim **vrsta posla svojim rečima** („selidba“, „farbanje“, „košenje“), a tek onda cena i broj ljudi.
- **Naručilac** pretragu koristi retko: da vidi kako izgleda tržište ili svoj objavljen zadatak.
- **Jedan korisnik i malo zadataka:** dovoljni su mapa, „Svuda“ i lista najnovijih. Polje za kucanje nema šta da nađe.
- **Mnogo zadataka:** „Gde“ i „Šta“ postaju glavni alat, a „Za mene“ zamenjuje polovinu filtera.

**Odluka**

- Na mapi **nema stalnog polja za kucanje**. Ostaje **jedna sažeta pilula** sa lupom, koja pokazuje izabrano („Svuda · Bilo kada“ ili „Novi Sad · Ovaj vikend · selidba“).
- Pored nje ide **„Filteri · 2“** (reč + broj), a ispod traka čipova.
- **Zašto:**
  - polje za kucanje na mapi otvara tastaturu preko mape;
  - takmiči se sa čipovima;
  - na 361 dp guta mesto;
  - najčešća namera („gde i kada“) se brže bira nego kuca.
- **Reč iz zadatka** dobija svoj odeljak „Šta“ u panelu.

**Panel (Airbnb obrazac, prilagođen):** otvara se dodirom na pilulu ili na „Filteri“, preko zamućene pozadine (`expo-blur`, odobren; na slabijem Androidu umesto zamućenja ide zatamnjenje 0,3). Bela površina, gornji uglovi 28, rukohvat.

1. **Na vrhu:** kapsula „Svi zadaci | Za mene“, isto stanje kao čip na mapi. „Za mene“ se vidi tek posle paketa G4.
2. **Odeljci**, uvek je otvoren samo jedan. Zatvoren odeljak pokazuje izbor desno („Novi Sad“, „Ovaj vikend“, „Bilo koja cena“):

   | Red | Odeljak | Izbori | Podrazumevano | Server |
   |---|---|---|---|---|
   | 1 | **Gde** | „Svuda“ · „Ova oblast“ (okvir mape) · „U blizini“ · polje „Grad ili deo grada“ sa predlozima i brojem („Novi Sad · 23“) · „Na daljinu“ | Svuda | postoji (`place`, oblast, PLACES sa brojem) |
   | 2 | **Kada** | Bilo kada · Danas · Sutra · Ove nedelje · Ovaj vikend · Narednih 7 dana · „Izaberi datume“ | Bilo kada | postoji (`when`, `dates`) |
   | 3 | **Šta** | polje „Npr. selidba, farbanje, košenje“ i poslednje 3 pretrage (samo na ovom telefonu) | prazno | postoji (`text`); bez kvačica i u opisu [server] P2 |
   | 4 | **Cena** | Sve · Navedena cena · Prima ponude | Sve | postoji (`price`); raspon cene [server] P3 |
   | 5 | **Koliko vas dolazi** | 1–10 (−/+) | 1 | postoji (`places`) |
   | 6 | **Način rada** | Bilo gde · Na licu mesta · Na daljinu | Bilo gde | postoji (`where`) |

3. **Kretanje kroz odeljke:**
   - Izbor u odeljku sa jednim izborom (Gde, Kada, Cena, Način rada) **sam zatvara taj odeljak i otvara sledeći**. Panel klizi do njegovog naslova za 240 ms; pri smanjenom pokretu odmah.
   - „Šta“ se zatvara na „Gotovo“ na tastaturi.
   - **Spisak mesta raste do celog ekrana** kad ga skroluješ (dve tačke zaustavljanja: ~85% i 100%), a × u njegovom zaglavlju ga vraća.
4. **Dno, uvek vidljivo:**
   - levo tiho „Obriši sve“;
   - desno zeleno **„Prikaži 23 zadatka“**. Broj se osvežava 300 ms posle poslednje promene. Dok čita, piše „Brojimo…“. Kad nema ništa, sivo „Nema zadataka za ove uslove“ sa razlogom ispod: „Probaj širu oblast ili drugi dan.“
5. **Posle primene, na mapi:**
   - pilula pokazuje sažetak;
   - u traci posle „Svi | Za mene“ idu primenjeni uslovi kao čipovi sa ×;
   - kad su primenjena dva ili više uslova, na kraju trake je čip „Obriši“.
   - Brzi čipovi (Danas, Na licu mesta, Prima ponude, Sačuvano) **upisuju u isto stanje** i primenjuju se odmah, bez panela. Panel uvek pokazuje isto što i čipovi, pa nikad nema dva izvora istine.
6. **Pokret:**
   - pozadina se zamuti i otvaranje ide uz `sheetSpring` (oko 280 ms), a zatvaranje za 180 ms;
   - strelica odeljka se okreće za 180 ms, a telo odeljka se pojavi za 160 ms (bez animacije visine, pravilo R1);
   - pri smanjenom pokretu nema zamućenja u pokretu: pozadina je odmah zatamnjena, a panel je odmah tu.

**Server (odvojeni paketi):**
- „Za mene“ (G4);
- pretraga bez kvačica i u opisu;
- raspon cene i udaljenost (P3);
- brzina (S3).

Sve ostalo je [klijent].

P1 · M.

### 2.20 Prozori odozdo, dijalozi i ikone

**(a) Ne mora sve odozdo. Pravilo po upotrebi:**

| Upotreba | Oblik | Zašto |
|---|---|---|
| Meni „···“ | **prozor odozdo**, bez naslova, sa rukohvatom | nadohvat palca; kratka lista |
| Kratka potvrda nepovratne radnje (obriši, povuci, odblokiraj, odjavi se) | **dijalog na sredini ekrana**: bela kartica, uglovi 24, meka senka, pozadina zatamnjena 0,35 | pitanje nije sadržaj; prozor odozdo preko menija odozdo pravi „skok“ |
| Potvrda sa razlogom ili poljem (otkaži Dogovor ili zadatak) | **prozor odozdo** visine po sadržaju | treba mesto za čipove i tastaturu |
| Birač (datum, vreme, država, grad) | **prozor odozdo**; spisak grada raste do celog ekrana | dugačke liste |
| Filteri i pretraga | **visok prozor odozdo** preko zamućene pozadine (2.19) | puno izbora, i dalje „iznad mape“ |
| Kartica na mapi | **PeekSheet** bez zatamnjenja | mapa ostaje živa |
| Javni profil, ponuda kandidata | **prozor odozdo** | sadržaj iznad ekrana iz kog je otvoren |
| Pitanje pre dozvole | **dijalog na sredini ekrana** sa FactArt 48 | jedno pitanje, mirno |
| Uspeh, „Vrati“ | **traka „Poruka“** | ne prekida |
| Rad u više koraka (objava, prijava, izmena, ocena) | **ceo ekran** | odluka zaslužuje ekran |
| Detalji u ekranu (opis, kontakt) | **otvaranje u mestu** (`Disclosure`) | bez sloja preko ekrana |

**Jedan izgled:**

| | Prozor odozdo | Dijalog na sredini |
|---|---|---|
| Površina | bela, gornji uglovi 28 | bela kartica, uglovi 24 |
| Rukohvat 36×4 | samo kad se prevlači | — |
| Pozadina | zatamnjenje 0,3; zamućenje samo za filtere | zatamnjenje 0,35 |
| Otvaranje | `sheetSpring` (krut, bez odskoka) | razmera 0,96 → 1 i providnost za 200 ms |
| Zatvaranje | 160–180 ms | 140 ms |

- Nikad dva prozora jedan na drugom. Iz menija se prvo zatvori meni, pa se otvara sledeće (`ActionSheet` to već radi, `ActionSheet.tsx:47-48`).
- **Smanjen pokret:** pojava i nestanak bez pokreta; zatamnjenje odmah.
- **Kandidati za „treskanje“ koje vlasnik vidi** (to je odvojena istraga, ovde su samo pretpostavke):
  - P6 lista na Androidu pomera tačke zaustavljanja za 0,01 px u periodu od 0,4 do 12 s (`ui/v2/DiscoveryPresentation.tsx:124,700-709`);
  - `ProductSheet` meri podnožje i posle prvog crtanja menja visinu (`ProductSheet.tsx:34,89,146`);
  - prozor u prozoru (`ApplicationSelectionPresentation.tsx:375-376`);
  - mapa i dalje koristi stari spring (`DiscoveryMap.tsx:463`).
- `ConfirmSheet` zadržava isti API, pa zamena oblika za kratke potvrde menja jednu komponentu, a ne 30 ekrana.

P1 · M · [klijent].

**(b) Ikone: šta je staro i šta ga menja**

- **Danas:**
  - **58 fajlova** i dalje uvozi `phosphor-react-native` direktno (`ui/system/__tests__/glyph-import-guard.test.ts:37-96,123`).
  - Najčešće su `CaretRight` (21), `Check` (14), `X` (12), `Plus` (6), `CaretDown` (6), `PaperPlaneTilt`, `ArrowRight`/`ArrowLeft` (po 5), `MagnifyingGlass` (4), `SlidersHorizontal`, `DotsThree`, `ArrowClockwise`, `Info` (po 3), `Lightning`, `GearSix`, `Bell`, `User`, `DownloadSimple`, `CalendarBlank` (po 2).
  - **Debljine su izmešane:** 32 puta `bold`, 10 puta `fill`, ostalo `regular`.
  - **Zatvaranje izgleda različito:** × u prozorima odozdo je Phosphor 22 u sivom krugu (`ProductSheet.tsx:7,155`), a u traci Glyph `close` 24 u belom krugu.
  - **Stari i dodatni izvori:**
    - stara kapsula pina sa `CheckCircle`, `Lightning` i `User` (`PricePill.tsx:2`);
    - munja HITNO (`NeedUrgencyBadge.tsx:3`), a HITNO je van V1;
    - Catalog27 PNG slike na Privatnosti i Pravnim dokumentima (`PrivacyPresentation`, `LegalDocuments`), koje se povlače po U09;
    - kvačica kao znak „✓ “ u tekstu (`ConversationPointAsk.tsx:383`);
    - `Pictogram` (prelivi) samo u biraču (`PickerTile`);
    - `V2Icon` se nigde ne crta.
- **Pravilo:**
  - **Glyph** (`ui/system/Glyph.tsx`, 35 imena) je *jedini* izvor za kontrole: nazad, ×, strelica desno, plus, kvačica u čipu, slanje, pretraga, filteri, „···“, mikrofon, osveži, kamera, kalendar, zvonce, izmeni.
    - Veličine: 24 u traci, 20 uz reč, 16 u čipu.
    - Debljina po pravilu registra: `regular`; kratki znaci (`check`, `close`, `plus`, `minus`) `bold`; izabrano `fill`.
  - **FactArt** je za činjenice u redovima (mesto, vreme, novac, ljudi, alat, vozilo, ocena, dokument) na 24 i 32.
  - **Dimenzionalni crteži** (`HomeLaunchArt`, `AiAssistantArt`, `ConversationArt`, `WorkProfileArt`, FactArt ≥ 48) su za trenutke, prazna stanja i Početnu.
  - U jednom redu se ne mešaju dve vrste.
- **Nova imena u registru:**
  - `star` (zvezdica);
  - `locate` (u blizini);
  - `settings`;
  - `download`;
  - `sign-out`;
  - `stop` (snimanje);
  - `chevron-left`.

  `Lightning` se briše zajedno sa HITNO ostacima.
- **Prelazak:** po timovima iz talasa (svaki tim svoje fajlove), uz brisanje reda iz `PHOSPHOR_IMPORTERS` i smanjenje broja u testu. Cilj je 0, osim zaključanog ulaza (`EntryWelcome.tsx`).

P1 · M · [klijent].

---

## 3. Ekrani

### 3.1 Ulaz i prijava

| Ekran | Sada (ključno) | Kritika | Predlog | Tag |
|---|---|---|---|---|
| Učitavanje (`app/_layout.tsx:114-127`) | znak, točkić, posle 2,5 s „Otvaramo aplikaciju…“ | dobro | zadržati | — |
| Greška ekrana (`ui/system/AppErrorBoundary.tsx:26-31`) | „Ovaj ekran se nije otvorio“ + „Pokušaj ponovo“ / „Na početak“ | dobro | zadržati | — |
| Ulaz V4.9 (`EntryWelcome.tsx`) | uvod 4,38 s, dve kolone, „Prijavi se“, „Napravi nalog“ 32 px | izbor vodi u prijavu; „Napravi nalog“ je najslabiji; beleške su 10 px pri velikom tekstu (`:316`) | izbor vodi u registraciju (2.1); dodir „Napravi nalog“ 48 dp | P1 · S |
| Prijava / registracija (`auth.tsx`) | „Zdravo.“; eyebrow; „Jedan nalog.“ dvaput; dupli naslovi; dva Nazad | ponavljanje i šum | bez eyebrow-a; jedan „Nazad“ (gornja strelica); jedan naslov; ostaju „Zaboravljena lozinka?“ i telefon kad je dozvoljen | P1 · S |
| Kod (OTP) | „Unesi kod“ dvaput; strelica vraća na email | — | jedan naslov; strelica = „Promeni broj“ | P2 · S |
| Oporavak (`app/oporavak.tsx`) | drugačija traka (21/700); dva zelena dugmeta u grešci; vidljiv `BuildIdentity` | nedosledno | ista traka kao prijava; jedno glavno dugme „Zatraži novi link“; bez `BuildIdentity` | P1 · S |
| Ograničen nalog (`ui/auth/RestrictedAccountPanel.tsx`) | posebna poruka, „Nazad na prijavu“ | nema puta do pomoći (`:12`) | tiho „Piši podršci“ (email ili link na javnu stranicu) | P1 · S [odluka: kontakt] |
| Nalog se zatvara (`ui/auth/AccountClosingState.tsx`) | sopstveni ekran, „Proveri stanje“, podrška, odjava | dobro | zadržati | — |

Pet imena za oporavak („Zaboravljena lozinka?“, „Oporavak pristupa“, „Oporavak naloga“, „Vrati pristup nalogu.“, „BEZBEDAN POVRATAK“) svode se na dva: link „Zaboravljena lozinka?“ i naslov „Nova lozinka“.

### 3.2 Početna

Vidi 2.5. Dodatno:
- „Pronađi posao.“ / „Nađi posao blizu.“ i tekst ulaza („Pronađi zadatak koji ti odgovara.“) svode se na jednu rečenicu po vratima: „Opiši šta ti treba.“ / „Nađi posao u blizini.“ P2 · S.

### 3.3 Objava zadatka

**AI razgovor (`/nova`)**

| Stavka | Sada | Predlog | Tag |
|---|---|---|---|
| Traka | strelica, „Novi zadatak“, „···“ tek posle prve reči | zadržati | — |
| Kartica nacrta | „Nacrt / Spremno za pregled“ 12 px kao oznaka; „Još treba: …“; „Izmeni“, „Pregledaj i objavi“ (crno) i meni „Pregledaj zadatak“ otvaraju isti pregled (`IntakePresentation.tsx:210-221,311`) | jedan ulaz: zeleno „Pregledaj i objavi“ kad je spremno, a dok nije, sive pilule „Fali: vreme · cena · mesto“ (dodir vodi u ispravku); bez „Izmeni“ koje vodi u pregled; oznaka stanja kao `StatusChip` | P1 · S |
| Prazan razgovor | robot, „Reci šta ti treba.“; komponenta podržava primere, ali ih niko ne prosleđuje | 2–3 primera rečenica (ne kategorije) | P3 · S |
| Nazad | bez pitanja, i sa nenapisanim tekstom (`app/(app)/nova.tsx:174`) | tekst u polju: „Sačuvati kao nacrt?“ → „Sačuvaj nacrt“ / „Izađi bez čuvanja“ | P1 · S |
| Glas | drži da govoriš; dozvola usred držanja | kratko objašnjenje pre dozvole (2.1) | P1 · S |
| „Napusti razgovor“ | potvrda „Napustiti razgovor?“ | zadržati; ime „Odbaci nacrt“ ako server to briše, inače „Napusti razgovor“ | — |
| Mesto u razgovoru | ugrađena mapa, „Kasnije“, četiri potvrde; uvećana mapa ne poštuje smanjen pokret | zadržati tok; uvećana mapa poštuje smanjen pokret; „Da, ovo je …“ zeleno | P2 · S |
| `/mesto-zadatka` | ruta postoji, ali do nje se ne može doći (`app/(app)/_layout.tsx:234`) | ukloniti | P2 · S |

**Fotografije (`/fotografije-zadatka` i u razgovoru)**
- Postoje dva puta.
- Ekran bez razgovora ima sivo „Dodaj fotografije“ bez razloga (`fotografije-zadatka.tsx:39-41`).
- Predlog:
  - jedan `PhotoAttachSheet` (rad započet 7.10.);
  - mreža sa „+“ kao prvom pločicom;
  - status na pločici;
  - uklanjanje dugim dodirom → `ActionSheet`;
  - sivo dugme uvek sa razlogom.
- P1 · M.

**Pregled zadatka (`/pregled-zadatka`)**

| Stavka | Sada | Predlog | Tag |
|---|---|---|---|
| Oznaka iznad kartice | „Ovako će drugi videti zadatak“ | ukloniti; kartica sama to pokazuje | P1 · S |
| „Još treba“ | redovi sa narandžastom tačkom; „Nedostaje: Naslov, Cena.“ | zadržati; bez velikih slova u nabrajanju | — |
| Cena i vreme | čipovi i polje za broj (42a2a5fa) | zadržati | — |
| Glavna radnja | „Objavi zadatak“ zeleno + rečenica; „Sačuvaj nacrt“ samo kad je spremno | „Sačuvaj nacrt“ uvek kao tiha radnja | P1 · S |
| Ručna provera | „Podrška još nema dežurnog operatera…“, a dugme „Zatraži pregled podrške“ je odmah ispod (`pregled-zadatka.tsx:317` naspram `:469-471`) | ili samo izmena, ili samo zahtev podršci, ne oba **[odluka]**: dok nema operatera, samo „Izmeni zadatak“ | P1 · S |
| Uspeh | `SuccessMark` se odmah zamenjuje prelazom | trenutak „Objavljeno“ (2.9), pa Zadaci sa izabranim pinom i traka „Zadatak je objavljen“; posle toga molba za push (2.1) | P1 · S |
| Mesto u pregledu | izlaz odbacuje bez pitanja (`:346-348`) | pita kao u razgovoru | P2 · S |

### 3.4 Zadaci (mapa + lista), detalj, pitanja, bezbednost, prijava

**Zadaci (`/zadaci`)**
- Po 2.11, 2.13, 2.14 i 2.19:
  - opseg „Svi zadaci | Za mene“;
  - sažeta pilula sa lupom umesto polja za kucanje;
  - „Gde: Svuda / Ova oblast / U blizini / mesto“;
  - „+ Objavi“ sa rečju;
  - zvonce;
  - starost na kartici;
  - „Najnovije prvo“.
- Prvo otvaranje P6 bez pretrage preko celog ekrana → skelet u listi (2.16).
- Dve različite poruke greške liste („Zadatke trenutno nije moguće učitati“ / „Zadaci trenutno nisu dostupni“) postaju jedna.
- Pin, oblast liste i čipovi su ispravljeni u `825c8e16`, ali to još nije viđeno na uređaju.

P1.

**Kartica na mapi (`DiscoveryPeek`)**
- Postaje gustina iz 2.11.
- Kartica za više zadataka na istoj tački („N zadataka na ovom mestu“, do 3 reda + „Prikaži sve u listi“) zadržava isti rečnik.

P1 · S.

**Detalj tuđeg zadatka (`/prilike/[id]`)**
- Redosled iz 2.11.
- Donji deo po odnosu se zadržava (`PublicNeedPresentation.tsx:115-135`), uz izmene:
  - „Tvoja prijava na ovaj zadatak je već poslata.“ ostaje;
  - „Nismo uspeli da proverimo da li je zadatak tvoj ili si se već prijavio.“ postaje „Nismo uspeli da proverimo tvoj odnos sa ovim zadatkom.“
- **Radnik bez aktivnog profila:** danas ulazi u prijavu i tek tada vidi razlog (`app/(app)/prilike/[id].tsx:162`). Predlog: na detalju sivo „Sastavi prijavu“ + „Prvo aktiviraj radni profil“ + tiho „Dopuni radni profil“. P1 · S.
- **„Zadatak nije dostupan.“** kaže „Vrati se na Zadatke“, ali dugme ne postoji (`:84-85`). Dodati „Nazad na zadatke“. P1 · S.
- **„···“:** „Postavi pitanje“, „Podeli“ (P3), crveno „Prijavi ili blokiraj osobu“; zvezdica u traci (2.15).

**Pitanja (`/pitanja-zadatka`)**
- Radnik ne vidi svoje pitanje dok ne stigne odgovor (`ui/qa/TaskQaPresentation.tsx:101-104`). Predlog: „Tvoja pitanja · čeka odgovor“, vidljivo samo tebi. Treba proveriti da li server vraća sopstvena pitanja. P2 · S [server proveriti].
- Ulaz na detalju dobija broj („Pitanja i odgovori · 2“). P2 · S.
- Kod naručioca nepovratno „Preskoči pitanje“ dobija crvenu boju (`:43`). P2 · S.

**Bezbednost (`/bezbednost`)**
- Ime osobe je uvek u naslovu: „Bezbednost · {ime}“, „Blokirati {ime}?“ (danas samo iza prekidača, `SafetyScreen.tsx:77`).
- Odblokiranje dobija potvrdu.
- Učitavanje ima skelet.
- „Korisnik“ postaje „osoba“.
- „Privatna prijava“ postaje „Bezbednosna prijava podršci“.

P1 · S.

**Sastavi prijavu (`/prilike/[id]/prijava`)**
- Gore sažeta glava zadatka (2.11).
- Za „Prima ponude“: „Tvoja ukupna ponuda“, polje sa grupisanim ciframa (isti `AmountField` kao kod naručioca, danas su tri različita polja).
- Ljudi: „Koliko vas dolazi · Treba 2 · 1 slobodno mesto“.
- Termin.
- Poruka, sa jednom granicom.
- Pregled „Ovo šalješ“ ostaje.
- Uspeh: `SuccessMark` + „Prijava je poslata.“ + zeleno „Moje prijave“, tiho „Nazad na zadatke“.

P1 · S.

**Moje prijave**
- Po 2.12.
- „Pregledaj aktuelnu prijavu“ danas samo zatvara panel (`moje-prijave.tsx:275-277`). Predlog: da otvara prijavu.
- Zvonce u traci.

P1 · M.

### 3.5 Moji zadaci, moj zadatak, kandidati

**Moji zadaci (`/potrebe`)**
- Traka sa avatarom i zvoncem se nikad ne crta, jer pobeđuje `ProductHeader` (`MarketplacePresentation.tsx:164-165`). Ovo je ekran koji se otvara, pa ostaje traka sa strelicom i dodaje se zvonce.
- `StatusChip` na kartici.
- „Bira se · N“ na vrhu.
- Prazna stanja po tabu (2.2).
- Istorija pokazuje čipove kraja i link „Arhiva“.
- Na kartici iz Istorije stoji „Objavi ponovo“ (2.10.6).

P1 · M.

**Moj zadatak (`/potrebe/[id]/pregled`)**

| Stavka | Sada | Predlog | Tag |
|---|---|---|---|
| Reč stanja | „Čeka prijave“ kad ima prijava za izbor; delimično popunjen zadatak piše „Objavljen“ | 2.2: „Bira se · 3“, „Delimično popunjen · 1 od 2“ | P1 · S |
| Glavna radnja | „Pregledaj prijave · N“ i red „Prijave“ zajedno; „Otvori moje Dogovore“ vodi na celu listu (četiri ulaza) | po stanju, samo jedna radnja: Nacrt → „Nastavi nacrt“; Objavljen bez prijava → bez zelene radnje, uz sivu rečenicu „Čekaš prve prijave. Javićemo ti.“; Bira se → „Izaberi prijavu“; Dogovoren → „Otvori Dogovor“ (tačan ID; ako ih je više, spisak ovog zadatka, ne svih); kraj → „Objavi ponovo“ | P1 · M |
| Nacrt koji ne može da se objavi | uvek „Otvori razgovor i dopuni“, i kad piše „Sačekaj…“ ili „Nije do tebe…“ (`needPublicationReadiness.ts:70-78`) | radnja prati razlog („Sačekaj“ = bez zelene radnje + „Osveži“) | P1 · S |
| „···“ | izmena; HITNO (sakriveno); „Ne traži više nikoga“ (objašnjenje samo za čitač ekrana); obriši; otkaži | pod „Ne traži više nikoga“ vidljiv podnaslov „Dogovoreno 1 od 2. Zatvara potragu za ostala mesta.“; nacrt nudi samo „Obriši nacrt“; otkazivanje po 2.3 | P1 · S |
| Posle otkazivanja ili brisanja | staro stanje ispod sive radnje | traka + povratak na Moje zadatke › Arhiva | P1 · S |
| Pitanja | bez broja | „Pitanja · 2 čekaju odgovor“ (narandžasto) | P2 · S |
| Gramatika | „Nedostaje još 2 ljudi“ (`pregled.tsx:271`) | „Nedostaju još 2 osobe“ (pomoćnik za množinu) | P1 · S |
| Rok potrage prošao | „Novi termin se ne određuje automatski.“ bez puta dalje | ponuditi „Otkaži zadatak“ ili „Objavi ponovo“ | P2 · S |

**Kandidati (`/potrebe/[id]/kandidati`)**
- Po 2.12.
- Panel ponude bez panela u panelu.
- Posle izbora: „Dogovoreno!“, pa Dogovor.
- Prelaz `replace` sa taba na Dogovor u glavnom navigatoru (`kandidati.tsx:199,212`) prvo treba reprodukovati na emulatoru, pa tek onda menjati.

P1 · M.

### 3.6 Dogovori, Dogovor, izmene, grupa, ocena

**Dogovori i Dogovor:** vidi 2.6.

**Izmene i otkazivanje (`/dogovor/[id]/izmene`)**
- Dva koraka (unos → pregled) ostaju.
- Otkazivanje dobija čipove razloga + polje (2.3).
- Posle uspeha „Prikaži aktuelni Dogovor“ zaista otvara Dogovor (`AgreementActionsPresentation.tsx:155`).
- Cena se nikad ne prikazuje kao „0 RSD“.
- Isti rečnik promene: „sada → novo“ svuda (danas negde „umesto …“).
- Sitne oznake iznad naslova („Dogovor koji otkazuješ“, „Prihvaćeni uslovi“) se uklanjaju.

P1 · S.

**Potvrda završetka (`AgreementCompletionReview`)**
- Prelazi na `ProductSheet`.
- Dobija i tiho „Nazad“.
- Ista reč „Posao je gotov“ / „Potvrdi završetak“.

P2 · S.

**Prepiska**
- „···“ sa „Pregled Dogovora“ i crvenim „Prijavi ili blokiraj osobu“.
- Prijava poruke ide dugim dodirom u oba razgovora (danas je u grupi običan dodir, `GroupConversationPresentation.tsx:127`).
- Brzi odgovori (P3).
- „Pročitano“ samo kad postoji podatak.
- Nazad iz grupe otvorene iz Poruka kaže „Nazad na Poruke“.

P1 (blokiranje) / P2.

**Ocena (`/oceni-dogovor`)**
- Zadržati: zvezdice, oznake, komentar iza prekidača D12, `SuccessMark`.
- Stanje „nije dostupno“ za Dogovor kome je istekao rok ocene kaže „Rok za ocenu je prošao.“, umesto „Oceni saradnju kad Dogovor bude završen.“ (`ui/reviews/AgreementReviewPresentation.tsx:152`).

P2 · S.

### 3.7 Obaveštenja, Poruke, podešavanja obaveštenja

Vidi 2.8. Dodatno:
- Prazno stanje: „Nove prijave, poruke i važne promene stižu ovde.“ (malo „p“ umesto „Nove Prijave“).
- Na vrhu i na dnu koristi se ista reč: „Moji zadaci / Poslovi“ ili „Moji zadaci / Moje prijave“. **[odluka]** Predlog: „Moje prijave“.

### 3.8 Profil i podekrani

| Ekran | Sada | Predlog | Tag |
|---|---|---|---|
| Profil | ikona olovke za ime; grupe „Kako mogu da uskočim“, „Nalog i pomoć“, „Privatnost“; „Odjavi se“ bez potvrde; `BuildIdentity` | identitet sa „Izmeni“ rečju; grupe „Rad“ (radni profil, područje, dostupnost, **Moj plan**), „Nalog“ (ime i fotografija, obaveštenja, privatnost, izvoz, blokirani), „Pomoć“ (podrška, pravna dokumenta, o aplikaciji); odjava sa potvrdom; bez `BuildIdentity` u prodavničkom buildu | P1 · S |
| Radni profil | crna glavna radnja; kartica razgovora i dugme u dnu se takmiče; naslov „Radni profil“ menja se u „Tvoj radni profil“ | zelena glavna radnja; jedan ulaz u razgovor; red „Na šta ovo utiče“ (PUT_RADNIKA, predlog 5); „Mogu odmah · pogledaj raspored“ vodi na Dostupnost, pa tekst postaje „Mogu odmah · dostupnost“ | P1 · S |
| AI razgovor za profil | „···“ krije ručno uređivanje, ali je ono vidljivo u pregledu | ostaje; crne radnje postaju zelene | P1 · S |
| Područje rada | dobro; atribucija LocationIQ 13 px bez površine za dodir | atribucija sa dodirnom površinom 48 dp | P2 · S |
| Dostupnost | dobro; brisanje posebnog datuma kaže „Ukloniti termin?“ (`AvailabilityForm.tsx:378`) | „Ukloniti datum?“; traka „Dostupnost je sačuvana“ | P2 · S |
| Ime i fotografija | izlaz sa izabranom fotografijom ne pita | pita „Odbaciti izabranu fotografiju?“ | P2 · S |
| Privatnost, Izvoz | uvodne rečenice; „Verzija: …“ | bez uvoda; verzija samo u pravnim dokumentima | P2 · S |
| Zatvaranje naloga | dva koraka, potvrda „Da li sigurno zatvaraš nalog?“ | zadržati | — |
| Blokirani | podnaslov „…i privatne prijave“ vara (lista ima samo blokirane) | „Osobe koje si blokirao“ ima rod, pa ide „Blokirane osobe“; sa „Vrati“ | P1 · S |
| Pravna dokumenta | iskren tekst dok nisu objavljena | zadržati; Catalog27 slike se povlače (U09) | P1 · S |
| O aplikaciji | znak, rečenice, `BuildIdentity` | bez `BuildIdentity` u prodavničkom buildu | P2 · S |

### 3.9 Podrška

- **Spisak:** `StatusChip` „Otvoren · Odgovoreno · Zatvoren“; „Novi zahtev“ kao jedina zelena radnja; „inbox“ → „Zahtevi“.
- **Novi zahtev:** teme ostaju; uvodna rečenica se uklanja; `SuccessMark` posle slanja ostaje.
- **Predmet:** operatersko „Zatvori obrađeni predmet“ dobija potvrdu (`ui/support/SupportDetailScreen.tsx:180-181`); „Žalba“ i „ponovni pregled“ se svode na jednu reč („ponovni pregled“).
- **Neaktivni redovi:** bez prozirnosti 0,45.

P2 · S.

---

## 4. Redosled rada — talasi za paralelne timove

### Timovi i fajlovi (jedan pisac po fajlu)

- **T0 — Sistem** (`src/ui/system/*`, `src/ui/v2/V2Action.tsx`, `src/app/(app)/_layout.tsx`, rečnik). Vlasnik zajedničkih komponenti, pa ide prvi.
- **T1 — Zadaci i radnik** (`src/ui/v2/discovery/*`, `DiscoveryPresentation`, `DiscoveryMap`, `TaskCard`, `TaskFace`, `PublicNeedPresentation`, `ProductDetails`, `prilike/*`, `ApplicationComposerPresentation`, `MyApplicationsPresentation`, `ApplicationFace`).
- **T2 — Naručilac** (`potrebe*`, `NeedPresentation`, `MarketplacePresentation`, `ui/needs/*`, `ApplicationSelectionPresentation`, `CandidateFace`, objava: `nova`, `IntakePresentation`, `pregled-zadatka`, `ReviewPresentation`, foto). Kartice zadataka koristi od T1, a ne menja ih.
- **T3 — Dogovori i plan** (`dogovori`, `AgreementCollectionPresentation`, `dogovor/*`, `ui/agreements/*`, `AgreementChat`, `ui/calendar/*`, `oceni-dogovor`, `ui/reviews/*`).
- **T4 — Obaveštenja, ulaz i nalog** (`obavestenja`, `ui/notifications/*`, `InboxBell`, `auth`, `oporavak`, `ui/entry/*` (samo dozvoljene sitnice), `ui/auth/*`, `profil/*`, `ui/settings/*`, `ui/safety/*`, `ui/support/*`).
- **S — Server** (sve na jednokratnoj bazi; svaki paket čeka tvoje „PRIMENI <ime>“):
  - **S1** pravilo uparivanja (G1–G3, G6);
  - **S2** „Za mene“ (G4);
  - **S3** brzina pretrage + brojanje „novijih“ + cena grupe;
  - **S4** sačuvani zadaci [sertifikat];
  - **S5** zbir za Početnu + čitanje plana po periodu;
  - **S6** push za jedan uređaj (TTL, tekst bez roda, ispravan tekst za problem) [sertifikat].
- **QA** — emulator (1264×2728, 560 dpi, font 1.15) posle svakog talasa: UX i vizuelna kritika odvojeno; telefon samo u tvom „sad“ prozoru.

### Talas 0 (T0, 3–4 dana; ostali timovi čitaju i pripremaju)

- **Sadržaj:**
  - komponente `Poruka` (snackbar), `StatusChip`, `PermissionAsk` i `TaskFacts` (anatomija, bez ekrana);
  - **jedan izgled prozora** (2.20a): dijalog na sredini za kratke potvrde iza istog API-ja `ConfirmSheet`, i isti × u svim prozorima;
  - prozori odozdo: brže zatvaranje, bez prozora u prozoru;
  - provera kandidata za „treskanje“, zajedno sa istragom koja već traje;
  - **nova imena u Glyph registru** (2.20b);
  - zelena glavna radnja (2.18);
  - prelaz 240 ms; mapa prelazi na `sheetSpring`;
  - zvonce koje drži broj;
  - rečnik (2.17) kao jedna datoteka sa rečima, ako postoji zajednički rečnik; inače spisak za timove.
- **Šta vidiš:**
  - zelene glavne radnje svuda;
  - ista traka posle radnje;
  - potvrde su mirni dijalozi na sredini ekrana;
  - prozori ne skaču;
  - prelazi su kraći.

### Talas 1 (paralelno T1, T2, T3, T4; oko 1 nedelja)

- **T1:**
  - porodica pin → kartica → detalj → prijava (2.11);
  - starost i „Najnovije prvo“ (2.14);
  - **pretraga i filteri po 2.19** (sažeta pilula, odeljci sa automatskim prelaskom, „Šta“ odvojeno, spisak mesta preko celog ekrana);
  - „+ Objavi“ i zvonce;
  - `PrijavaCard` u Mojim prijavama (2.12);
  - radnik bez profila na detalju.
- **T2:**
  - stanja zadatka i Arhiva podaci (raw status) (2.2);
  - moj zadatak, jedna radnja po stanju;
  - nepovratne radnje za zadatak (2.3);
  - kandidati sa `PrijavaCard` i „Dogovoreno!“;
  - objava: jedan ulaz u pregled, „Sačuvaj nacrt“, trenutak „Objavljeno“.
- **T3:**
  - Dogovori po danima;
  - traka koraka, „···“ i otkazano sa razlogom (2.6);
  - izmene (bez 0 RSD, otkazivanje sa čipovima);
  - **Moj plan** + Arhiva ekran (2.7).
- **T4:**
  - ulaz → registracija;
  - bez eyebrow-a;
  - dozvole u kontekstu (tekst i obrazac);
  - obaveštenja: cilj po događaju, „Čeka te“ red, tekst bez roda;
  - Profil grupe, odjava, Bezbednost sa imenom, Blokirani.
- **Svi timovi:** svoje fajlove sa liste `PHOSPHOR_IMPORTERS` prevode na Glyph i FactArt (2.20b).
- **QA:** emulator, ceo put A i B na DEV test nalozima, samo čitanje i radnje koje si već odobrio.
- **Šta vidiš:**
  - zadatak izgleda isto od pina do prijave;
  - svaka prijava kaže za šta je, kada, koliko i u kom je stanju;
  - jedan plan za sve tvoje;
  - otkazano i isteklo imaju svoje mesto u Arhivi.

### Talas 2 (server paralelno sa talasom 1; svaki paket: jednokratna baza → tvoje „PRIMENI“)

- S1 + S2 („Za mene“), pa T1 uključuje kapsulu opsega.
- S3 (brzina, „N novih zadataka“, cena grupe), pa T1 uključuje pilulu „novi zadaci“ i A/B cenu na pinu (U17).
- S5, pa T2 i T3 prebacuju Početnu i Plan na nova čitanja; uključuju se prekidači straničenja EX-04 posle provere.
- **Šta vidiš:** „Za mene“ radi; mapa ostaje brza i sa mnogo zadataka.

### Talas 3 (T1 + T3 + T4; oko 4 dana)

- zvezdica (posle S4, uz overavanje sertifikata);
- „Objavi ponovo“ (ako komanda postoji);
- brzi odgovori i blokiranje iz prepiske;
- senka dostupnosti i mesec u Planu;
- linija „Nema veze“;
- zamena preostalih ručnih prozora;
- Catalog27 slike se povlače;
- Lottie „Dogovoreno!“ kad stignu tvoje datoteke.
- **Šta vidiš:** zvezdica i lista sačuvanih; bogatiji, a miran pokret.

### Talas 4 (poslednji; T4 + S6 + QA)

- **Push, uz tvoje korake:**
  - Firebase `rs.uskoci`;
  - FCM ključ (`eas credentials`);
  - S6 sa ponovnim overavanjem sertifikata;
  - kanal sa iskačućim prozorom;
  - ikonica u statusnoj traci.
- **Proba na telefonu:** u tvom „sad“ prozoru, put A i B na dva uređaja (HONOR = osoba A, emulator = osoba B).
- **Šta vidiš:** obaveštenje stiže i vodi tačno tamo gde reaguješ.

---

## 5. Tvoje odluke iz ovog plana

1. „Termin je sada“ umesto „U toku“.
2. Sažeta vrata (64 dp) na Početnoj kad nalog već radi.
3. Ime planera: „Moj plan“ ili „Raspored“.
4. Sopstveni zadaci u „Svi zadaci“: vidljivi sa oznakom (predlog) ili potpuno skriveni (traži server).
5. Zvezdica sa serverskom tabelom i ponovnim overavanjem sertifikata (predlog: da, u talasu 3).
6. Četvrti tab Poruke u prvom izdanju (predlog: ne, nego kroz Dogovor).
7. Ručna provera objave dok nema operatera: samo „Izmeni zadatak“ (predlog).
8. Kontakt za ograničen nalog na ekranu za prijavu (email ili javna stranica).
9. Imena skupova obaveštenja: „Moje prijave“ ili „Poslovi“.
10. Beleške ulaza od 10 px pri velikom tekstu: ostaju ili rastu.
11. „Pozovi istu osobu ponovo“ i `expo-calendar` (predlog: ne sada).
12. Na mapi nema stalnog polja za kucanje, nego sažeta pilula sa lupom i panel sa odeljcima (predlog: da, 2.19).
13. Kratke potvrde idu u dijalog na sredini ekrana, a ne u prozor odozdo (predlog: da, 2.20).
14. Pretraga bez kvačica (č, ć, š, ž, đ) i pretraga u opisu zadatka kao serverski paket (predlog: da, posle paketa brzine).
