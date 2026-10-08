# USKOČI — istraživanje R2: premium potrošačke aplikacije, jasnoća i zanat (8. 10. 2026)

Samo čitanje i web; kod, server, DEV, telefon i emulator nisu dirani, ništa nije komitovano, ovo je jedini novi fajl. Radio: istraživač dizajna (Sonnet 5.5, nasleđeno od roditelja). Zadatak vlasnika: tražiti rešenja u poznatim aplikacijama, nebitno koja im je svrha, uzeti IDEJU (ne 1:1), unaprediti je i kombinovati (Airbnb, Airtasker…). Pročitano pre početka: naši snimci `scratchpad/lab/out` (f1, f2, f3, f5, f6 „posle“), `KOMPOZICIJA_I_RITAM_SPEC_20261007.md`, `POTREBE_KORISNIKA_20261007.md`, `src/ui/system` (FactArt, SuccessMark, Arrive, LottieArt). Predlozi su ideje za pregled, ne novo odobrenje.
**Oznake dokaza:** **[V]** video sam u Browser oknu u ovoj sesiji (stranicu ili ekran; „izmereno“ = JS izmera stila na veb verziji apps.apple.com, ne u aplikaciji) · **[Z]** zvanični izvor, pročitan · **[T]** članak ili analiza treće strane (nije zvanično potvrđeno) · **[O]** „nisam video, iz opisa:“ (iz opšteg poznavanja, nije proveravano) · **isečak** = stranicu nisam otvorio celu (403, preusmerenje ili je nisam ni pokušao), oslanjam se na isečak pretrage koji je citira. Pokret nisam video nigde (sve su statične stranice): svaka tvrdnja o pokretu je iz teksta. Odluke i zavisnosti: **[OD]** vlasnik · **[SRV]** traži server ili paket · **[ZAV]** traži novu zavisnost · **[MAPA]** zavisi od biblioteke mape.
**Zaključano i poštovano (AGENTS.md 3.5–3.6):** bele površine, crn glavni tekst, jedna ZELENA radnja po ekranu, narandžasta samo akcenat, „ti“ bez roda, „zadatak“ nikad „posao“, ulaz V4.9 i potpis Početne (dve velike pločice) netaknuti, FactArt „nalepnice“ i likovi su potpis, tekst ≥ 12 px, nema nove zavisnosti, nema izmišljenih podataka, nema „server“ u tekstu za ljude.

## 1. Deset saznanja: šta ove aplikacije rade da ne bi izgledale generički

1. **Biraju JEDNOG heroja i prave ga 2–4× većim.** App Store traka činjenica: oznaka 11 px/600 VELIKA SLOVA (56 % crne), vrednost 22 px/700, opis 11 px/400; u odeljku ocena broj ima 50 px/700 uz opis 13 px [V, izmereno]. Flighty stavlja vreme i stanje ispred naslova leta [T]. Kod nas su skoro svi redovi iste težine: „ritam bez vrhunca“.
2. **Stanje je rečenica o sledećem potezu, ne čip.** Flighty menja šta piše po fazi puta [T]; Uber šalje niz delotvornih obaveštenja o preuzimanju (minuti, mesto sastanka, kako stići) [Z]; Domino's ima četiri faze, a poslednja je emocija („Mmm!“), ne administracija [T, isečak].
3. **Ista kartica menja najveći podatak sa vremenom do događaja.** Flighty: daleko unapred potvrda, dan pre kapija, ~3 h pre polazak za aerodrom, ukrcavanje, u letu preostalo vreme [T]. Android 16 „Live Updates“: jedna kartica koja se prepisuje, ne niz obaveštenja [Z].
4. **Jedan predmet kao potpis, u tri veličine.** Airbnb: tri 3D ikone (kuća, balon, zvonce) u izboru Homes/Experiences/Services i veliki predmet iznad naslova na ekranima prodavnice [V]; Duolingo: najmanje detalja, jasna silueta na maloj veličini [Z]; Things: ceo brend je jedna 3D tacna sa kvačicom [V].
5. **Slavlje je predmet koji menja stanje, i retko.** Duolingo na prekretnici fizički pretvara lika (feniks) i daje karticu za deljenje; ritam animacije se doteruje u više prolaza [Z]. Apple za Live Activities traži da animacija traje najviše 2 s [Z]. Bez konfeta za svaki dodir.
6. **Pokret ima tri uloge: saopštava, orijentiše, daje ličnost** (Wolt) [T]; Material 3 Expressive uvodi fiziku opruge i morfovanje oblika [Z]. Naš `sys.motion` ima prve dve; ličnost fali u trenucima.
7. **Veličina, boja i mesto glavne radnje daju više od dekora.** Google (46 studija, 18.000+ ispitanika): ključni element se nalazi do 4× brže kad je veći, drugačije boje i blizu mesta radnje; ljudi preko 45 godina jednako brzo kao mlađi [Z].
8. **Poverenje je dokaz sa pragom, a „nema podatka = nema broja“.** Thumbtack „Top Pro“: ≥ 10 angažovanja u 12 meseci, ocena ≥ 4,8, ≥ 5 verifikovanih recenzija, samo 4 % profesionalaca [T, isečak]; Airbnb „Guest favorite“ traži ≥ 5 recenzija u 4 godine [Z, isečak]; Intercom ne obećava vreme odgovora ako je manje od 5 razgovora u 7 dana [Z, isečak]; Uber: 4-cifreni PIN koji putnik izgovori [Z, isečak].
9. **Jedno pitanje, jedan odeljak, jedan rezultat.** Typeform: jedno pitanje po ekranu, prosečan završetak 57 % [Z, isečak]; Apple: prefill, biranje umesto kucanja, „Dalje“ tek kad je tačno [Z]; Stripe: jedna kolona, provera tek kad je polje završeno [Z, isečak]; Monzo: primer na teškom koraku (lična karta, selfi) [T].
10. **Tekst je proizvod: prvo napiši obaveštenje, pa ekran.** Hero sajta Flightyja su same poruke sa imenom i minutima [V]; Monzo govori „kao osoba“ [T]; Apple: ne skraćuj ručno, do 4 radnje, generički tekst za skrivene preglede [Z].

**Recept 1-1-1-1 (provera svakog ekrana):** 1 heroj (broj ili rečenica, 2–4× veći) · 1 predmet (nalepnica 48–96 dp) samo kad priča · 1 rečenica stanja („ko je na potezu“) · 1 pokret koji nosi značenje; sve ostalo tiho.

## 2. Gde smo (naši snimci f1, f2, f3, f5, f6 „posle“; web laboratorij, ne telefon)

- Sistem reda radi: ivica, odeljci, zapisi sa senkom, jedna zelena radnja; Dogovor ima korake, razgovor ima „Nije poslato“, ocena ima čipove. Ali nijedan ekran nema vrhunac: najveće je svuda isti crn naslov 18–28 px; stickeri su mali ili srednji i stoje kao ikone uz tekst, nijedan „ne priča“ ekran.
- Stanje je mali čip i tačka (f5_posle_dogovori_list); vreme, najvažnije za Dogovor, stoji u istoj sivoj liniji kao mesto, a podebljan je iznos. Koraci Dogovora su četiri kruga i linija bez vremena i bez kretanja; „ko je na potezu“ živi tek u sivom podnožju, a rečenica ispod naslova je opšta (f5_posle_detalj_1na1).
- Razgovor: crni i beli baloni i dobar „Nije poslato“, ali nema događaja u toku razgovora (dogovor, predlog izmene) ni „pročitano“ (f5_posle_razgovor). Ocena: pet narandžastih zvezdica i čipovi (f5_posle_ocena); posle čuvanja samo mali krug sa kvačicom i „Ocena je sačuvana.“ (f5_posle_ocena_sacuvana): trenutak postoji, ali je najmanji mogući. Prazna stanja: po jedna nalepnica 80–96 dp levo uz naslov, rečenicu i zeleno dugme, isti raspored svuda (f5_posle_dogovori_empty, f1_posle_obavestenja_prazno, f3_posle_mz_prazno); nijedno nema trenutak koji se menja.
- Detalj zadatka ima činjenice u stubu i veliko prazno ispod „Objavio“ (f2_posle_detalj). Mapu nisam video ni na jednom snimku (laboratorij piše „Mapa je dostupna u mobilnoj aplikaciji“, f2_posle_lista_1).

## (a) Lista zapisa sa statusom koji se dodiruju

Naš ekran: Dogovori, Moji zadaci, Moje prijave, Raspored, Poruke · `AgreementListCard`, `OwnTaskCard`, `PrijavaCard`, `AgendaRow`, `Surface record`, `StatusChip`, `FactArt`.

**a1 · Flighty, lista letova** [V·T] flighty.com · apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008 · blakecrosley.com/guides/design/flighty
- Šta radi: jedan red po letu po uzoru na aerodromsku tablu; stanje je boja + reč (na vreme, kasni, otkazan), vreme u monospace ciframa (veličine 18–24 su iz treće strane, nisam ih potvrdio); Apple Design Award 2023 piše na samom sajtu [V]; hero sajta su obaveštenja koja imenuju osobu i minute („22m early“) [V].
- Zašto radi: oko prvo hvata ono što se menja i što se proverava (vreme, stanje); naslov samo potvrđuje.
- Ideja: u zapisu je najveće vreme i stanje, ne naslov.
- Kod nas: `AgreementListCard`: prvi red „Danas · 14:00–16:00“ u `heading` 18/24 sa tabularnim ciframa, naziv zadatka silazi na `bodyStrong` 16, ime i uloga `note`, iznos `priceRow` desno (proveriti budžet stilova iz spec D/E). Kombinujemo sa a3 (grupe vremena) i b2 (faza).

**a2 · Uber „Activity Hub“, Wolt, DoorDash, Booking** [Z·O] uber.com/us/en/newsroom/were-redesigning-the-uber-app-just-for-you/
- Šta radi: Uber: prošle i predstojeće vožnje i porudžbine na jednom mestu [Z]. [O: nisam video, iz opisa:] Wolt, DoorDash i Booking daju svakoj prošloj stavci jednu sporednu radnju („naruči ponovo“) i grupišu predstojeće, završeno i otkazano.
- Zašto radi: jedan model „aktivnosti“ umesto više ekrana; ponavljanje je jedan dodir.
- Ideja: „šta me čeka“ i „šta je bilo“ su jedno mesto sa dve zone, a završena stavka nudi „opet“.
- Kod nas: Dogovori Aktivni/Istorija već jesu to; red „Danas“ iznad liste kad ima termina; u Istoriji tiha radnja „Objavi ponovo“ (plan P2). Kombinujemo sa a1; Početna „Raspored“ koristi istu karticu (spec 4.1).

**a3 · Things 3, „Danas“ i „Ovo veče“** [T] macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/
- Šta radi: zadaci su obični redovi teksta; na dodir se šire u karticu dok ostatak liste bledi; odeljak za veče odvaja deo dana na istom ekranu; bela površina, podebljan tip, tek poneka boja.
- Zašto radi: zapis miruje dok ga ne dodirneš; vreme dana je zaglavlje, ne polje.
- Ideja: grupiši po vremenu, ne po vrsti.
- Kod nas: `Section` „Danas · Sutra · Ove nedelje · Bez tačnog termina“; Istorija bez senke (samo `ListRow` redovi), jer je prošlo; pokret pri dodiru je postojeći pritisak zapisa (skala 0,986, spec N6). Kombinujemo sa a1.

**a4 · Airbnb „Trips“** [Z] news.airbnb.com/airbnb-2025-summer-release/
- Šta radi: itinerar sa rasporedom puta, detaljima doma i uslugama koje si rezervisao, u jednom tabu.
- Zašto radi: sve što me čeka je na jednom mestu, po vremenu.
- Ideja: raspored dana je lista, ne kalendar.
- Kod nas: Raspored je isti `record` kao u Dogovorima; Početna „sledeći Dogovor“ kao heroj (a1). Kombinujemo sa a3.

**Kreativni obrt (a): „nalepnica stanja“.** Levo na zapisu 48 dp 2.5D predmet koji JESTE stanje, umesto monograma i čipa: `agreements` (Dogovoreno), `alert` narandžasto (Čeka tebe), `clock` (termin još nije određen), `star` (Oceni), `check` (Završeno), `send` (Poslata prijava), `users` (Bira se). Čip ostaje samo za izuzetke (Istekao, Otkazan). Pravilo FactArt ostaje: kvačicu smeju samo `check`, `agreements`, `shield`. Nijedna nova slika. Lice ostaje gde je osoba glavna stvar (Poruke, Istorija; spec C). [OD: probati na emulatoru, lice naspram nalepnice.]

## (b) Praćenje statusa kroz korake

Naš ekran: Dogovor, detalj (`AgreementSteps`: Dogovoreno → Zadatak je gotov → Potvrđeno → Ocena), status prijave (Poslata → Viđena → Izabrana), push.

**b1 · Domino's Pizza Tracker (i Wolt, FedEx)** [T·O] entrepreneur.com/buying-a-franchise/how-dominos-20-year-old-pizza-tracker-shaped-nearly-every-delivery-app-you-use-today (isečak)
- Šta radi: od 2008; četiri faze (primljeno, napravljeno, dostavljeno ili preuzeto, „Mmm!“); preko 2,5 milijardi praćenih porudžbina; „iluzija rada“: kad vidiš da se radi, poverenje raste, a čekanje se čini kraće. Wolt prikazuje procenu vremena i stanje porudžbine vizuelno, uz kurira na mapi [T, isečak]. [O: FedEx daje vertikalnu istoriju događaja sa vremenom, nisam video.]
- Zašto radi: neizvesnost postaje događaj sa imenom.
- Ideja: poslednja faza je emocija; faza je glagol u sadašnjem vremenu.
- Kod nas: koraci dobijaju rečenicu u 2. licu („Čekaš Marka“, „Potvrdi da je gotovo“) umesto imenice; „Tok Dogovora“ (`Disclosure`) je vertikalna istorija: vreme + događaj; poslednji korak „Ocena“ postaje „Hvala“ sa nalepnicom (vidi h). Kombinujemo sa b3.

**b2 · Flighty, pametna stanja i linija puta** [T] blakecrosley.com/guides/design/flighty
- Šta radi: 15 stanja (ime i broj iz treće strane); kartica prikazuje najvažnije za TU fazu; linija rute sa markerom koji napreduje; broj se menja glatko; „nema ukrasnog pokreta“.
- Zašto radi: u svakom trenutku najveće je ono što ti sad treba.
- Ideja: sadržaj faze je važniji od fiksnog rasporeda.
- Kod nas: Dogovor sa terminom: dan pre „Sutra u 10:00 · Liman“; pod 3 h „Za 2 h 15 min“ + „Poruka“; posle početka „Da li je gotovo?“; bez termina „Dogovorite vreme“ (R02). Vreme i iznos se ne animiraju (pravilo P5), menja se samo rečenica. Kombinujemo sa a1 i b4.

**b3 · Duolingo „Learning Path“** [Z] blog.duolingo.com/new-duolingo-home-screen-design/
- Šta radi: linearna staza sa okruglim čvorovima; završeni su zlatni i dodirljivi (pregled); plutajuća strelica vraća na trenutni čvor; zaglavlja jedinica su opisna.
- Zašto radi: „ovde si“ je očigledno, a prošlo može da se otvori. (Citymapper, naprotiv, ostavlja prošlu fazu istaknutom, pa se prošlo/tekuće/buduće ne razlikuje [T, ixd.prattsi.org/2026/09/design-critique-citymapper/].)
- Ideja: tri stanja čvora moraju da se razlikuju bez čitanja.
- Kod nas: `AgreementSteps`: prošlo = popunjeno + vreme ispod („pon 14:05“), tekuće = prsten + meki puls (`sys.motion.loop.breath`) + nalepnica, buduće = svetlosivo bez teksta; dodir na završeni vodi u pravi deo (Uslovi, Poruke). Kombinujemo sa b1.

**b4 · Android 16 „Live Updates“ i Apple „Live Activities“** [Z] developer.android.com/develop/ui/views/notifications/progress-centric · developer.apple.com/design/human-interface-guidelines/live-activities
- Šta radi: Android: jedno obaveštenje za ceo put koje se prepisuje; traka od segmenata (stanje, trajanje) i tačaka (prekretnice), zaglavlje + naslov + tekst + najviše jedna radnja; zabranjeno za promocije. Apple: margina 14 pt, ugao 44 pt, tekst srednje debljine ili deblji, animacija ≤ 2 s, aktivnost se završava čim se događaj završi, jedan interaktivni element.
- Zašto radi: ceo put je na zaključanom ekranu bez otključavanja.
- Ideja: Dogovor je jedna živa kartica, ne pet obaveštenja.
- Kod nas: „Dogovor · danas u 14:00“ sa 4 tačke i radnjom „Otvori“, završava se posle „Potvrđeno“; nikad naslov zadatka na zaključanom ekranu (odluka A20), generički tekst. [ZAV] proveriti da li `expo-notifications` 57 nudi ProgressStyle; ako ne, ostaje običan push. Kombinujemo sa b2 (isti redosled faza).

**Kreativni obrt (b): „nalepnica putuje“.** FactArt `agreements` 32 dp sedi na tekućem čvoru; kad stanje napreduje, klizi do sledećeg (jedna opruga bez preskoka, ~280 ms), čvor koji je ostavila se popuni i dobije vreme; pod smanjenim pokretom samo skoči. Na kraju („Ocena“) nalepnica postaje pečat (h). Samo `transform`, native driver (R1); treba novi token pokreta za put.

## (c) Mapa + panel odozdo + lista

Naš ekran: Zadaci (`DiscoveryPresentation`, `TaskCard`, `DiscoveryPeek`, `PeekSheet`); pin zaključan (beli kapsul, narandžasti halo, 6 %).

**c1 · Apple Maps / HIG „Sheets“** [Z] developer.apple.com/design/human-interface-guidelines/sheets · [O: Maps sa karticom mesta nisam video]
- Šta radi: srednji detent ≈ 50 % visine, veliki puna visina; rukohvat uvek kod promenljivih panela, dodir kruži kroz detente; „non-modal“ panel na iOS dozvoljava rad sa sadržajem iza (mapom); nikad dva panela odjednom; dug tok ide na ceo ekran.
- Zašto radi: mapa ostaje živa, a lista je uvek na dohvat.
- Ideja: panel ima tačke zaustavljanja, a mapa se i dalje dodiruje.
- Kod nas: tri tačke: „viri“ (jedna kartica), pola, ceo; kamera ostavlja izabrani pin vidljiv iznad panela; rukohvat uvek; pokret panela je postojeća opruga panela iz `sys.motion` (bez odskoka). Kombinujemo sa c4.

**c2 · Zillow** [T] screensdesign.com/showcase/zillow-real-estate-rentals · raw.studio/blog/using-maps-as-the-core-ux-in-real-estate-platforms/
- Šta radi: cene na pinovima; klasteri sa brojem koji se razdvajaju pri zumu; crtanje sopstvene oblasti; opcioni slojevi; „sačuvaj pretragu“ sa obaveštenjima; na mobilnom prekidač mapa/lista.
- Zašto radi: cena na mestu odmah daje geografiju cene; sopstvena oblast je lična.
- Ideja: oblast koju JA određujem je filter.
- Kod nas: „Tvoje područje“ iz Radnog profila („Novi Sad · do 20 km“) kao meko polje na mapi [MAPA][OD]. Kombinujemo sa j3 (sačuvana pretraga).

**c3 · Airbnb, približno mesto** [Z] airbnb.com/help/article/2141 · airbnb.tech (rangiranje za mapu: većina klikne samo nekoliko pinova, preuzeto iz spec 5)
- Šta radi: pre rezervacije lokacija može biti „mali krug u osenčenom krugu“ (oblast), tačna adresa tek posle potvrde.
- Zašto radi: privatnost se vidi, ne samo čita.
- Ideja: privatnost kao oblik na mapi, ne rečenica.
- Kod nas: javno „približno mesto“ u detalju kao krug, ne kao pin; rečenica „Tačnu adresu dobijaš kad se dogovorite“ (već postoji u Dogovoru). Kombinujemo sa d2.

**c4 · Citymapper i Uber, filter koji preuređuje, mehurić na pinu** [T·O] ixd.prattsi.org/2026/09/design-critique-citymapper/
- Šta radi: Citymapper: opcije puta su kartice sa bojom po vrsti prevoza; jedan dodir na filter („bez stepenica“, „manje pešačenja“) odmah preuredi listu [T]. [O: nisam video, iz opisa:] Uber stavlja na pin preuzimanja mehurić sa minutima.
- Zašto radi: efekat filtera se vidi odmah, a pin nosi jedan broj.
- Ideja: filter se vidi odmah u listi; izabrani pin nosi jedan podatak.
- Kod nas: čipovi „Danas / Na licu mesta / Na daljinu“ preurede listu i mapu bez zatvaranja panela, broj u zaglavlju („N zadataka“); izabrani pin može da nosi „12 min“ kad je lokacija odobrena (`expo-location` je uslovno odobren, R15). Kombinujemo sa c1.

**Kreativni obrt (c): „tvoje područje i šta sam već video“.** Meko polje tvog radnog područja na mapi; zaglavlje panela „7 zadataka u tvom području“; pinovi koje si već otvorio postaju tiši (siva ivica, ne nova boja). Drugi deo je naša ideja, kod referenci ga nisam potvrdio. Pin ostaje po odluci vlasnika.

## (d) Detalj stranica sa jednom glavnom radnjom

Naš ekran: Detalj zadatka (`PublicNeedPresentation`), kandidat, Dogovor · `FlowFooter`.

**d1 · Apple App Store, traka činjenica** [V, izmereno] apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008
- Šta radi: pet ćelija u jednom redu, bez okvira: oznaka 11 px/600 VELIKA SLOVA siva → vrednost 22 px/700 → opis 11 px/400 (Ocene · Priznanja · Uzrast · Rang · Razvijač); u odeljku ocena broj 50 px/700 uz opis 13 px; priznanje je okruženo lovorovim vencem.
- Zašto radi: pet odluka u jednom pogledu; mala oznaka, krupna vrednost.
- Ideja: činjenice kao traka, ne kao stub.
- Kod nas: ispod naslova `FactStrip` (predlog novog primitiva N7, izuzetak za tim S): UKUPNO 6.000 RSD · TERMIN 12. okt · LJUDI 0/2 · MESTO Liman; oznaka 12 px (naš minimum), vrednost `bodyStrong`/`priceLarge`; `FactRow` ostaje za duže činjenice. Kombinujemo sa d2 (podnožje) i f3 (statistika).

**d2 · Airbnb stranica smeštaja** [O: nisam video, iz opisa]
- Šta radi: lepljivo podnožje: cena (krupno) i datumi levo, jedno veliko dugme desno; tri „highlights“ reda (ikona + naslov + siva rečenica); kartica domaćina; ocena sa lovorom; približno mesto. Rečenica o besplatnom otkazivanju ispod dugmeta poboljšala je stranicu (goodui.org, analiza iz 2018) [T].
- Zašto radi: ono što odlučuje (cena, termin) nikad ne nestane sa ekrana.
- Ideja: cena i termin su uvek uz dugme.
- Kod nas: `FlowFooter` levo „6.000 RSD · 12. okt 10–12“, desno zeleno „Sastavi prijavu“; razlog iznad kad je neaktivno (pravilo F). Kombinujemo sa d1 i c3.

**d3 · Airtasker, stranica zadatka** [O: nisam video, iz opisa; sajt je blokiran Cloudflare-om, odobrena je samo mehanika]
- Šta radi: naslov, ko je objavio, mesto, kada, budžet, jedno dugme za ponudu; ispod detalji, ponude i javna pitanja.
- Zašto radi: budžet i radnja su susedi, a pitanja su javna pa se ne ponavljaju.
- Ideja: iznos i jedina radnja stoje jedno uz drugo.
- Kod nas: već tako; pitanja i odgovori postoje; iznos je u traci i u podnožju, ne samo u naslovu. Kombinujemo sa d1 i d2.

**d4 · Vinted, stranica artikla** [Z] vinted.co.uk/help/258
- Šta radi: primarno „Buy now“, sporedno „Make an offer“ (do 40 % niže), „Ask seller“; naknada zaštite je stavka u razloženoj ceni.
- Zašto radi: sporedna radnja postoji, ali ne konkuriše glavnoj.
- Ideja: sporedna radnja je vidljiva, a tiha.
- Kod nas: zeleno „Sastavi prijavu“ + tiho „Postavi pitanje“, ništa više. Kombinujemo sa d3.

**Kreativni obrt (d): „Objavio“ kao kartica poverenja.** Lice 56, ime, `FactStrip` od 3 ćelije (OCENA 4,7 · OCENA 3 · ČLAN OD, samo ako podatak postoji i samo kad ima ≥ 3 ocene, pravilo već važi) + približno mesto kao krug (c3). Prazan donji deo detalja (f2_posle_detalj) dobija smisao, ne razmak.

## (e) Forme i čarobnjaci bez zamora

Naš ekran: AI razgovor „Nova“ i nacrt, Prijava, Radni profil, Izmena Dogovora, Zatvaranje naloga · `PillComposer`, `FlowFooter`.

**e1 · Typeform** [Z, isečak] typeform.com/help/whats-the-average-completion-rate-of-a-typeform
- Šta radi: jedno pitanje po ekranu, krupan tip; prosečan završetak 57 % (centar za pomoć); u primeru 23 % → 41 % (sekundarni izvor, nije proveravano).
- Zašto radi: manje opterećenja, ličniji ton, „kao poruke od prijatelja“.
- Ideja: razgovor umesto obrasca.
- Kod nas: to je naš AI tok; isti princip za Radni profil (tri pitanja: šta radiš, gde, kada). Kombinujemo sa e2.

**e2 · Airbnb, uvođenje domaćina** [T, isečak] uxdesign.cc/how-airbnb-attracted-close-to-a-million-new-hosts-in-2022-4a7811b24b3d
- Šta radi: tri velika zadatka umesto liste koraka („pseudo-set framing“), traka napretka, „Sačuvaj i izađi“, uglavnom izbor umesto pisanja; posle koraka 2 ekran o „sređivanju fotografija“ (iluzija rada).
- Zašto radi: tri cilja deluju dostižno; izlaz je uvek tu.
- Ideja: tri koraka i uvek izlaz.
- Kod nas: „Još treba“ kao tri grupe; nacrt se čuva i vraća (R18); `FlowFooter` ima jednu zelenu i jednu tihu radnju. Kombinujemo sa e1 i obrtom.

**e3 · Monzo i Revolut** [T] goodux.appcues.com/blog/monzos-fast-friendly-finance · raw.studio/blog/how-revolut-uses-4-onboarding-ux-tactics/
- Šta radi: Monzo: oko 12 ekrana, jezik „kao osoba“, na teškim koracima (lična karta, selfi) vizuelni primer; testovi su pokazali odustajanje baš na selfiju. Revolut: jedan zadatak po ekranu, potvrda broja u trenutku, direktne greške, dozvole u kontekstu, povratna informacija o dokumentu uživo (zamućena slika) [T, isečak].
- Zašto radi: teški koraci dobijaju pomoć tamo gde ljudi odustaju.
- Ideja: na teškom koraku dodaj primer, ne objašnjenje.
- Kod nas: polje cene nudi tihu pilulu „Cena zadatka: 6.000 RSD“ (podatak postoji, nije izmišljen); termin nudi „Termin zadatka“ (već postoji); dozvole sa slikom već postoje. Kombinujemo sa e4.

**e4 · Stripe Checkout + Apple „Entering data“** [Z, isečak·Z] stripe.com/resources/more/mobile-checkout-ui · developer.apple.com/design/human-interface-guidelines/entering-data
- Šta radi: jedna kolona; provera tek kad je polje završeno, ne tokom kucanja; labele iznad ili plutajuće; numerička tastatura; Apple: prefill, birati umesto kucati, validirati odmah, „Dalje“ tek kad je tačno.
- Zašto radi: greška se hvata na polju, dok je čovek još tu.
- Ideja: provera i rezultat su na istom mestu.
- Kod nas: preklapanje termina javiti odmah (sada tek posle slanja, POTREBE); dugme ponavlja rezultat „Pošalji prijavu · 4.500 RSD“ [O: obrazac dugmeta sa iznosom znam iz opšteg poznavanja, nisam ga čitao]; polje cene 72 dp (spec 4.7). Kombinujemo sa e3.

**Kreativni obrt (e): „nalepnice se lepe na nacrt“.** U AI razgovoru kad AI razume činjenicu, odgovarajuća nalepnica (`pin`, `calendar`, `users`, `money`) doleti u karticu nacrta (kratak luk 8–12 dp, nagib 3° → 0, kao postojeći `Arrive`), a nepoznate činjenice su tihe sive siluete koje čekaju: „Još treba“ postaje vidljivo kao prazna mesta. Čovek VIDI šta je shvaćeno (iluzija rada + prozirnost, Airbnb i Domino's), bez dodatnog teksta. Bez nove zavisnosti.

## (f) Profil/hub i podešavanja

Naš ekran: Profil (`ProfileHubPresentation`), Radni profil, javni profil, Podešavanja, Privatnost, Podrška.

**f1 · Airbnb, Profil 2025** [Z·T] news.airbnb.com/product-releases/airbnb-2025-winter-release/ · techradar.com (isečak)
- Šta radi: „Past trips“ i „Connections“ su tabovi profila; „pasoš“ sa sjajem koji prati pomeranje telefona kao kartica u Apple Wallet-u [T, isečak]; značke gradova u stilu pasoških pečata [Z]; vidljiva potvrđenost identiteta [Z].
- Zašto radi: profil je predmet koji se drži i pokazuje, ne lista podešavanja.
- Ideja: istorija kao pečati.
- Kod nas: gornji blok Profila (vidi obrt), lice 96 po spec; pečati kao nalepnice. Kombinujemo sa i2 (prag) i b3 (završeno se može otvoriti).

**f2 · Apple HIG „Settings“** [Z] developer.apple.com/design/human-interface-guidelines/settings
- Šta radi: minimizuj broj podešavanja; razumne podrazumevane vrednosti; ono što se često menja drži se u kontekstu, ne u podešavanjima; ne dupliraj sistemska.
- Zašto radi: manje redova, manje straha da nešto pokvariš.
- Ideja: podešavanje živi tamo gde se koristi.
- Kod nas: obaveštenje se utišava u samom obaveštenju („···“), u Podešavanjima grupe od ≤ 5 redova (`ListRow`, jedna ivica teksta); mirne nalepnice u grupi „Privatnost“ (spec 4.14). Kombinujemo sa k1.

**f3 · Spotify Wrapped** [T, nisko poverenje, isečak] designcompass.org/en/2023/02/23/2022-wrapped-behind-story/
- Šta radi: statistika je niz kartica u formatu priče, podebljan tip i boja; dizajneri su izbegavali estetiku kontrolne table; svaka kartica može da se deli.
- Zašto radi: lični broj u krupnom tipu deluje kao poklon, ne kao izveštaj.
- Ideja: lični broj zaslužuje krupan tip.
- Kod nas: „Moja statistika“ (9 završenih, 90 % dolazi kako je dogovoreno) kao `FactStrip` (d1) umesto 4 reda tabele; deljenje nije u V1 [OD]. Kombinujemo sa d1.

**Kreativni obrt (f): „pasoš uskakača“.** Profil počinje karticom: lice, ime, grad, ocena; ispod red pečata: jedan pečat po završenom Dogovoru (nalepnica `agreements` 32 + mesec i godina), poslednja tri vidljiva + „Svi pečati“; broj završenih i „Dolazi kako je dogovoreno 90 %“ u traci. Samo stvarni podaci; bez pečata tiha silueta „Prvi pečat te čeka“; ne prikazuje se druga strana Dogovora. Sjaj: SVG gradijent koji sa skrolom prelazi preko kartice (naginjanje traži `expo-sensors` [ZAV], ne radimo). Nema serija ni pritiska. [OD: da li je broj pečata javan]

## (g) Razgovor/poruke i stanje poruke

Naš ekran: razgovor u Dogovoru (`AgreementChat`, `AgreementThreadPresentation`), lista Poruka.

**g1 · WhatsApp i iMessage, stanje poruke** [Z, isečak] faq.whatsapp.com/665923838265756/ · support.apple.com/guide/iphone/turn-read-receipts-on-or-off-iph5e713a045/ios
- Šta radi: WhatsApp: sat = nije poslato; jedna siva kvačica = poslato; dve sive = isporučeno; dve plave = pročitano; u grupi druga kvačica kad svi prime. iMessage: reč „Delivered“ ili „Read“ ispod poslate poruke [O: samo ispod poslednje poslate poruke u nizu]. [O: izgled balona, datum na sredini nisam video.]
- Zašto radi: stanje je znak uz vreme, na samoj poruci, bez reči; iMessage ga drži samo na poslednjoj.
- Ideja: stanje je znak, a rečenica tek kad je greška.
- Kod nas: već tačka/kvačica i „Nije poslato → Pošalji ponovo“; znak ostaje samo uz poslednju moju poruku; „pročitano“ NE obećavamo dok server ne čuva čitanje za lične razgovore [SRV] (POTREBE). Kombinujemo sa g2.

**g2 · Vinted, ponuda u razgovoru** [Z] vinted.co.uk/help/258
- Šta radi: ponuda cene (do 40 % niže) i protivponuda žive U razgovoru kao posebni elementi; prodavac prihvata ili odbija; posle prihvatanja „Buy now“ u samom razgovoru.
- Zašto radi: razgovor je ujedno dnevnik odluka.
- Ideja: događaji su kartice u toku poruka.
- Kod nas: „Dogovoreno · 26. sep 17:00–19:00 · 5.500 RSD“ (nalepnica `agreements`), „Predlog izmene: 18:00“ sa [Prihvati] [Predloži drugo], „Marko je javio da je zadatak gotov“ sa [Potvrdi]; jedna zelena po ekranu, ostalo tiho; kartice u razgovoru ne pokreću ništa (postojeći test i odluka D1 u MOTION_I_POLISH_SPEC). Kombinujemo sa g1 i b1.

**g3 · Airbnb, poštansko sanduče** [Z] airbnb.com/help/article/3558
- Šta radi: „Priority“ (potvrde, hitno) gore, „Recent“, „Past“; brzi filteri (Hosting, Support, Traveling); pretraga poštuje filter.
- Zašto radi: važno je prvo, ostalo ne smeta.
- Ideja: važno prvo.
- Kod nas: Poruke: „Čeka te“ odeljak, pa Aktivni/Završeni (R17, plan 2.8); red `ListRow` sa licem 56. Kombinujemo sa k2.

**g4 · Intercom Messenger, obećanje vremena** [Z, isečak] intercom.com/help/en/articles/732436-share-your-expected-response-time
- Šta radi: prikazuje očekivano vreme odgovora; „dinamički“ = medijana prvog odgovora u poslednjih 7 dana; ako je razgovora manje od 5, piše samo „odgovara čim može“, bez broja.
- Zašto radi: obećanje je tačno ili ga nema.
- Ideja: obećanje o vremenu samo uz dovoljno podataka.
- Kod nas: „Obično odgovara za oko 1 h“ tek posle ≥ 5 Dogovora, iz stvarnih podataka [SRV][OD]; do tada ništa. Kombinujemo sa i2 (isti prag).

**Kreativni obrt (g): „brze poruke koje nose događaj“.** Ispod polja za dan izvršenja tri tihe pilule: „Stižem za 10 min“ · „Evo me“ · „Kasnim 15 min“ (bez roda). Svaka šalje poruku I događaj-karticu u razgovoru; „Kasnim“ predlaže novi termin kao karticu [Prihvati]. Zelena samo kad čeka odluka. Uber i Wolt imaju brze odgovore za susret [O]; plan P3 već navodi „Krećem / Kasnim“ (POTREBE).

## (h) Prvi susret, prazna stanja i trenuci slavlja

Naš ekran: „Dogovoreno!“, „Objavljeno“, ocena sačuvana, prazna stanja · `StateView`, `SuccessMark`, `Arrive`, `LottieArt`; prvi susret posle V4.9 ulaza.

**h1 · Duolingo, prekretnica serije** [Z·V] blog.duolingo.com/streak-milestone-design-animation/
- Šta radi (2022): lik se FIZIČKI menja (feniks umesto balona), jer metafora vatre nije svuda razumljiva; ritam i energija animacije doterani u više grubih prolaza; jednostavna kartica za čuvanje i deljenje; rani podaci: više ljudi čuva seriju. Slika na stranici: ravna zasićena boja, debeli zaobljeni oblici bez kontura [V].
- Zašto radi: nagrada je preobražaj predmeta koji već volimo.
- Ideja: slavlje je predmet koji menja stanje, jednim potezom.
- Kod nas: vidi obrt („pečat pada“); deljenje nije u V1 [OD]. Kombinujemo sa h2.

**h2 · Things 3** [T·V] macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/ · culturedcode.com/things/
- Šta radi: završetak je tih i fizički (čekiranje oko pola sekunde, taktilna povratna informacija; trajanje iz sekundarnog izvora); prazan „Danas“ miran; brend je jedan predmet.
- Zašto radi: tiho i brzo deluje sigurno.
- Ideja: tiho je premium.
- Kod nas: „Potvrdi završetak“ je kratko, bez prozora, uz haptik `success` (`SuccessMark` već ima `fresh`). Kombinujemo sa h1.

**h3 · Superhuman, „Inbox Zero“** [T, isečak] blog.superhuman.com/how-superhuman-chooses-inbox-zero-images/
- Šta radi: kad isprazniš poštu, ceo ekran dobija sliku koja se menja; kriterijumi izbora: pažljivo izabrani motivi, utisak uronjenosti, tehnička savršenost; ideja „radost i iznenađenje“ iz dizajna igara.
- Zašto radi: promenljiva nagrada ne dosadi.
- Ideja: prazno stanje je nagrada, i menja se.
- Kod nas: „Čeka te“ prazno na Početnoj rotira 6–8 nalepnica (nikad ista dva puta zaredom) uz jednu toplu rečenicu; `Arrive` već postoji. Kombinujemo sa l4.

**h4 · Apple „Onboarding“ i Headspace** [Z·T, nisko poverenje] developer.apple.com/design/human-interface-guidelines/onboarding · blakecrosley.com/guides/design/headspace
- Šta radi: Apple: brzo, zabavno, opciono; uči kroz radnju; saveti u kontekstu; odloži nebitna podešavanja; zahtev za ocenu tek kad je čovek angažovan. Headspace: zaobljeni oblici bez oštrih uglova, lice od dve tačke i linije, emocija kroz držanje i boju, bez konfeta (brojke nisu zvanične).
- Zašto radi: ljudi uče radeći, a mirna ilustracija ne traži pažnju.
- Ideja: prvi susret je prva korisna radnja, ne predavanje.
- Kod nas: Početna već ima „Kako radi“ kao tri nalepnice sa „Sakrij“ (f1_posle_pocetna_empty): to je opciono i u kontekstu, dakle po Apple pravilu; ostaje, a posle prvog Dogovora se sama sklopi; nikakav „tour“ preko ekrana; dozvole se traže kad zatrebaju (već tako); likovi iz V4.9 ostaju u trenucima, nove likove ne uvodimo bez vlasnika. Kombinujemo sa e1.

**Kreativni obrt (h): „pečat pada“.** „Dogovoreno“ = nalepnica `agreements` 96 dp (3D lanac) spusti se na karticu uz blag „tup“ haptik (`tick('success')` već postoji), kratak sjaj prelazi preko (SVG gradijent ~400 ms), pa rečenica „Dogovoreno. Sutra u 10:00 · Marko stiže.“ Bez konfeta i zvuka; ponovno otvaranje je mirno (`fresh` pravilo); smanjen pokret = prvi kadar + haptik. Isto manjim obimom za „Objavljeno“ (`publish`) i „Ocena sačuvana“ (`star`). Zamenjuje krug sa kvačicom (`SuccessMark`) u ključnim trenucima; krug ostaje za sitne potvrde. Lottie samo za lik ili trenutak (pravilo), a PNG/SVG je dovoljan.

## (i) Poverenje i sigurnost

Naš ekran: javni profil i ocene, kartica „Objavio“, Kandidati, Dogovor („Bezbednost i prijava“), ocena (`AgreementReviewPresentation`), `PublicProfileSheet`.

**i1 · Uber, sigurnosni alati** [Z, isečak] uber.com/us/en/newsroom/ubers-new-safety-toolkit/
- Šta radi: pre vožnje ime vozača, tip vozila i tablica; 4-cifreni PIN koji putnik izgovori, a vozač pokreće vožnju samo tačnim unosom; RideCheck javlja nepredviđeno zaustavljanje; deljenje vožnje uživo; sigurnosne funkcije na mapi (štit).
- Zašto radi: poverenje je radnja sa dokazom u trenutku susreta.
- Ideja: dokaz u trenutku, ne obećanje unapred.
- Kod nas: opciono „kod dolaska“ (4 cifre) kao poslednja provera na vratima [OD][SRV: novi tok]; do tada „Podeli adresu kad budete spremni“ (već postoji). Kombinujemo sa g (brze poruke).

**i2 · Thumbtack „Top Pro“** [T, isečak] pro-center.thumbtack.com
- Šta radi: bedž ima brojčani prag: ≥ 10 angažovanja u 12 meseci, ocena ≥ 4,8, ≥ 5 verifikovanih recenzija; ima ga samo 4 % profesionalaca; bedž provere pozadine donosi 44 % više angažovanja.
- Zašto radi: bedž je veran jer mu je kriterijum javan.
- Ideja: oznaka poverenja nosi svoj prag.
- Kod nas: „Dolazi kako je dogovoreno“ (server 7.10.) kao „9 od 10 Dogovora“ + tihi prag („Prikazuje se posle 5 završenih“); nikad procenat bez imenioca. Kombinujemo sa i3 i g4.

**i3 · Airbnb „Guest favorite“ i ocene** [Z, isečak] airbnb.com/help/article/3495 · airbnb.com/help/article/13
- Šta radi: kriterijumi (ocena, recenzije, komunikacija, otkazivanja, incidenti; ≥ 5 recenzija u 4 godine, ≥ 1 u poslednje 2); šest kategorija po 1–5; potkategorije i beleška domaćinu vide SAMO domaćin i Airbnb, javno su ukupna ocena i recenzije; lovorov venac (isti motiv i u App Store „Editors' Choice“ [V]).
- Zašto radi: javno i privatno su razdvojeni, pa su ljudi iskreniji.
- Ideja: razdvoji javno od privatnog i reci to na licu mesta.
- Kod nas: ocena: oznake (javne, zbirne) naspram komentara koji nije javan, nego ga vidi ocenjena osoba sa maskiranim licem autora (A09–A12): komentar dobija bravu i rečenicu koja kaže ko ga vidi (tačan krug potvrditi prema A09–A12, ne pisati „samo“ unapred); nikad obećanje anonimnosti (A10). Kombinujemo sa i2.

**i4 · TaskRabbit i BlaBlaCar** [Z·T, isečak] support.taskrabbit.com (Happiness Pledge; Elite) · blog.blablacar.com/blog/inside-story/in-trust-we-trust
- Šta radi: TaskRabbit: zadaci plaćeni preko platforme pokriveni su do 10.000 USD po zadatku; „Elite“ bedž = gornjih 35 % po skoru performansi, vidi se u rezultatima. BlaBlaCar: profil se gradi potvrdama (lična karta, telefon, e-pošta), vidljivim pre rezervacije; tvrdnja da 88 % ljudi više veruje članovima sa punim profilom (nije proveravano, nisko poverenje).
- Zašto radi: zaštita i potvrde stoje na mestu odluke.
- Ideja: „pun profil“ je merljiv napredak, zaštita se vidi na mestu odluke.
- Kod nas: dok zaštite nema (besplatan lansman, 0 RSD) ne obećavamo je; poštena rečenica i red „Bezbednost i prijava“ sa štitom su dovoljni, bez bedža dok nema pravila [OD]; Radni profil „3 od 4 gotovo“, svaka stavka kaže zašto. Kombinujemo sa i2.

**Kreativni obrt (i): „dokaz sa pragom“.** Svaka oznaka poverenja nosi rečenicu-kriterijum, a dok kriterijum nije ispunjen prikazuje tihu siluetu sa uslovom („Još 2 ocene do ukupne ocene“; pravilo „ocena tek posle 3“ već važi). Nijedan broj bez podatka, nijedan bedž bez javnog prava na njega.

## (j) Pretraga i filteri

Naš ekran: pilula „Svi zadaci · Bilo kada“, panel pretrage (Gde/Kada/Šta/Cena/Ljudi/Način), čipovi, `SearchSheet`.

**j1 · Airbnb, pretraga** [T] ixd.prattsi.org/2023/09/design-critique-airbnb-ios-app-2/ · getdesign.md/design-md/airbnb (analiza veb sistema, ne aplikacije)
- Šta radi: pilula (po analizi visine 64 px, potpuno okrugla, hairline) sa Gde/Kada/Ko; na malom ekranu jedna pilula koja se otvara; polja imaju primer vrednosti („Any week“); ograničenja mogu da se preskoče.
- Zašto radi: prazno polje već kaže šta se dešava ako ga ne popuniš.
- Ideja: svako polje ima podrazumevanu reč.
- Kod nas: već „Bilo kada“ (snimak); isto „Cela Srbija“ i „Bilo koja cena“; odeljci se otvaraju jedan po jedan (plan 4.3). Kombinujemo sa obrtom.

**j2 · Apple HIG „Searching“** [Z] developer.apple.com/design/human-interface-guidelines/searching
- Šta radi: nedavne pretrage pre kucanja, predlozi tokom kucanja, vidljiv opseg pretrage, filtriranje po atributima (tokeni), način da se istorija obriše.
- Zašto radi: manje kucanja i uvek se zna šta se pretražuje.
- Ideja: nedavno i opseg su uvek na vidiku.
- Kod nas: „Nedavno“ red u „Gde“; opseg uvek vidljiv u pilulji; „Obriši nedavne“. Kombinujemo sa j1.

**j3 · Vinted, sačuvane pretrage** [Z] vinted.com/help/435-save-your-searches
- Šta radi: pretragu sačuvaš iz nedavnih; pored nje broj „+N“ novih od poslednjeg pogleda, resetuje se kad je otvoriš; neograničeno; nestaje posle 6 meseci neotvorena.
- Zašto radi: ne moraš da pamtiš da proveriš.
- Ideja: pretraga postaje mala stalna lista sa brojačem.
- Kod nas: „Sačuvaj pretragu“ → na Početnoj u „Čeka te“: „3 nova zadatka u ‘Selidbe u Novom Sadu’“ [SRV: broj][OD]; push ne obećavamo. Kombinujemo sa c2.

**j4 · Panel filtera sa živim brojem** [T, nisko poverenje, isečak] screensdesign.com/articles/mobile-app-filter-sort-ui-examples/
- Šta radi: prilepljeno dugme „Prikaži N zadataka“ sa živim brojem, „Obriši sve“, sklopive grupe (sažetak više izvora).
- Zašto radi: vidiš cenu izbora pre nego što ga potvrdiš.
- Ideja: dugme pokazuje posledicu filtera.
- Kod nas: plan 4.3 već ima podnožje (`FlowFooter`); dodati živi broj [SRV: brojanje]. Kombinujemo sa j3.

**Kreativni obrt (j): „pretraga kao rečenica“.** Stanje filtera piše se kao rečenica sa dodirljivim delovima: „Zadaci u **Novom Sadu**, **ove nedelje**, do **5.000 RSD**, za **1 osobu**.“ Podvučen deo otvara svoj odeljak, nepopunjen je tih („bilo gde“). Apple spominje „tokene“ u polju pretrage [Z], Airbnb sažima zatvorena polja u kartice [T]. To je naš AI-first glas (Gemini pilula) preveden u filter, ne forma.

## (k) Obaveštenja i inbox

Naš ekran: Obaveštenja (`InboxPresentation`), zvonce, push, Početna „Čeka te“.

**k1 · Apple HIG „Notifications“** [Z] developer.apple.com/design/human-interface-guidelines/notifications
- Šta radi: kratko; naslov koji se čita u hodu; ne skraćuj ručno; do 4 radnje, nikad radnja koja samo otvara aplikaciju; značka = samo broj nepročitanih; generički tekst za skrivene preglede („Nova poruka“, „Prijava“); greške se ne šalju kao obaveštenja.
- Zašto radi: obaveštenje je sažeto i bezbedno na zaključanom ekranu.
- Ideja: manje reči, generički tekst gde je privatnost.
- Kod nas: tekst bez naslova zadatka na zaključanom ekranu (A20) = generički; radnje samo bezopasne. Kombinujemo sa b4.

**k2 · Linear, Inbox** [Z] linear.app/docs/inbox
- Šta radi: dve zone: „Priority“ (traži tvoju pažnju) i „Other“; opcija „nepročitano prvo“; odlaganje i brisanje; skup ograničen na 2.000.
- Zašto radi: pažnja ide prvo na ono što traži odluku.
- Ideja: inbox je trijaža, ne arhiva.
- Kod nas: „Čeka te“ (ima odluku) na vrhu, „Ostalo“ ispod; „Označi sve“ ostaje u zaglavlju (spec 4.13). Kombinujemo sa g3.

**k3 · Flighty, tekst kao proizvod** [V] flighty.com
- Šta radi: hero prikazuje sama obaveštenja sa imenom i brojkom (stigao pre vremena, promena kapije, „danas je let na vreme“).
- Zašto radi: obaveštenje je ono što korisnik stvarno vidi najčešće.
- Ideja: napiši push pre ekrana.
- Kod nas: svaki tekst iz `TEKSTOVI_REVIZIJA` mora da kaže ko + šta + kada u ≤ 2 reda. Kombinujemo sa k1.

**Kreativni obrt (k): „kartica koja se sklopi“.** U Obaveštenjima odluka ima karticu sa jednom zelenom radnjom (npr. „Potvrdi završetak“); posle radnje kartica se SKLOPI u tih red (visina i senka nestaju, 200–240 ms) i prestaje da se broji; ništa se ne briše, samo utihne. Uz to jedna živa kartica Dogovora (b4) umesto pet obaveštenja.

## (l) Kartice sa ilustracijom, 2.5D i 3D predmetima

Naš ekran: `FactArt` (30 vrsta, veličine 16–64; „mark“ do 24, „art“ iznad), `Surface record`, `StateView`, kartice Početne.

**l1 · Airbnb, 3D ikone** [V·Z·T] apps.apple.com/us/app/airbnb/id401626263 · news.airbnb.com/airbnb-2025-summer-release/
- Šta radi: izdanje se oslanja na dimenzionalan i animiran interfejs [Z]; u izboru Homes/Experiences/Services tri 3D ikone (kuća, balon, zvonce) sa značkom „NEW“; na ekranima prodavnice (kuća, balon) po jedan veliki 3D predmet iznad centriranog naslova od dva reda, na toploj bež pozadini [V].
- Zašto radi: predmet je opipljiv, skoro igračka, i odmah kaže o čemu je ekran.
- Ideja: jedan veliki predmet po ekranu, a animacija samo u izboru.
- Kod nas: FactArt 64–96 iznad naslova u stanjima i ključnim trenucima; donja traka ostaje po pravilu (tri korena). Kombinujemo sa l4.

**l2 · Duolingo, „shape language“** [Z] blog.duolingo.com/shape-language-duolingos-art-style/
- Šta radi: zaobljeni oblici, preterivanje do karikature, najmanje detalja koliko treba, jasne siluete na malim veličinama, bela negativna površina, vektori.
- Zašto radi: predmet se prepoznaje i kad je sitan.
- Ideja: test siluete.
- Kod nas: već `FACT_MEANING` test (jedna slika = jedno značenje) i „mark“ ≤ 24; dodati ručnu proveru „silueta se prepoznaje u jednoj boji“ na emulatoru. Kombinujemo sa l4.

**l3 · Material 3 Expressive** [Z] design.google/library/expressive-material-design-google-research
- Šta radi: veći i drugačije obojen ključni element (u primeru: dugme „Send“ veće, odmah iznad tastature, u sekundarnoj boji), biblioteka oblika sa morfovanjem, fizika opruge; uz upozorenje: zadrži poznate obrasce, funkcija pre dekora.
- Zašto radi: veličina i mesto vode oko, ne dekor.
- Ideja: umerena ekspresija sa dokazom (4×).
- Kod nas: zelena radnja 56 dp pune širine u podnožju (već), a „ekspresija“ ide u art i pokret, ne u boju. Kombinujemo sa e4.

**l4 · Things i Apple Activity rings, predmet i integritet znaka** [V·Z] culturedcode.com/things/ · developer.apple.com/design/human-interface-guidelines/activity-rings
- Šta radi: Things: ikona je jedna sjajna 3D tacna sa kvačicom, stranica je skoro prazna [V]. Apple: prstenovi uvek na crnoj pozadini, boje se nikad ne menjaju, nikad kao ukras ni brend [Z].
- Zašto radi: jedan jasan predmet i znak koji nikad ne znači nešto drugo grade poverenje.
- Ideja: jedan predmet po značenju, i nikad ukras.
- Kod nas: lanac `agreements` je „predmet Dogovora“: isti na listi, u koraku i u trenutku; pravilo „nijedna slika ne izmišlja potvrđeno stanje“ (FactArt) je isti princip. Kombinujemo sa l1.

**Kreativni obrt (l): „kalup nalepnice“.** Svaka velika slika na isti kalup: bela ivica 2 dp (die-cut), isto svetlo odozgo levo, kontaktna senka, tri veličine (24 znak, 48 red ili kartica, 96 stanje); na dodir se „odlepi“ 2 dp i nagne 2° (`usePressLift`); oživi samo u trenutku, inače je statična; najviše jedna slika od 96 po ekranu.

## Kombinacije koje je tražio vlasnik (Airbnb × Airtasker × ostalo)

- **Detalj zadatka = Airbnb podnožje × Airtasker budžet × App Store traka:** iznos je heroj u traci i u podnožju (cena + termin levo, zelena radnja desno); „Objavio“ kao kartica poverenja (Thumbtack prag); približno mesto kao krug; pitanja javno ispod (Airtasker [O]).
- **Dogovor = Flighty faze × Domino's iluzija rada × Android Live Updates:** jedna kartica koja menja najveći podatak po fazi, put sa nalepnicom, jedna živa notifikacija.
- **Profil = Airbnb pasoš × Duolingo staza × Thumbtack prag:** pečati sa datumom, završeno se može otvoriti, tihe siluete do praga.
- **Razgovor = WhatsApp stanja × Vinted događaji × Intercom poštena obećanja:** znak samo uz poslednju poruku, kartice događaja, vreme odgovora tek uz podatke.
- **Nacrt = Typeform × Airbnb uvođenje domaćina × naš AI:** razgovor + tri grupe + nalepnice koje se lepe.
- **Pretraga = Airbnb pilula × Apple tokeni × Vinted sačuvano:** rečenica sa tokenima, „Sačuvaj +N“, dugme sa živim brojem.

## Šest ideja koje bih prve probao (redom uticaja na „nije generički“)

1. **Heroj-vreme + nalepnica stanja** na zapisima (a), veličina S–M: najmanji rad, najveća vidljivost, postojeća umetnost.
2. **Putanja Dogovora** (b), M: rečenica „ko je na potezu“ gore, vremena ispod čvorova, nalepnica putuje.
3. **Traka činjenica `FactStrip`** na detalju zadatka i u Profilu (d, f), M: novi primitiv + cena i termin u podnožju.
4. **Događaj-kartice u razgovoru + brze poruke** (g), L: poklapa se sa planom P3.
5. **„Pečat pada“ + pasoš pečata** (h, f), M: naš potpis, bez konfeta.
6. **Nalepnice se lepe na nacrt** u AI razgovoru (e), M–L: AI-first potpis koji nijedna referenca nema.
Rezerva: pretraga kao rečenica (j), „Čeka te / Ostalo“ + kartica koja se sklopi (k), „tvoje područje“ na mapi (c).

## Tabela: naš ekran → reference → ideja

| Naš ekran | Reference | Ideja |
|---|---|---|
| Početna ispod pločica | Things (Danas/Veče), Uber hub, Superhuman | „Čeka te“ i „sledeći Dogovor“ kao heroj; prazno = promenljiva nalepnica |
| Zadaci, mapa + panel | Apple sheets, Zillow, Airbnb krug, Citymapper, Uber [O] | tri tačke panela, „tvoje područje“, filter koji preuređuje, minuti na pinu |
| Pretraga i filteri | Airbnb, Apple Searching, Vinted, filter sa brojem | pretraga kao rečenica, „Sačuvaj +N“, dugme sa živim brojem |
| Detalj zadatka | App Store traka, Airbnb podnožje, Airtasker [O], Vinted | `FactStrip`, cena + termin uz dugme, približno mesto kao krug |
| Prijava (ponuda) | Stripe, Apple Entering data, Monzo, Typeform | provera na polju, dugme sa rezultatom, prefill „cena zadatka“ |
| Kandidati | Thumbtack, TaskRabbit, Airtasker [O] | kartica ≤ 4 reda, bedž sa javnim pragom |
| Moji zadaci, Moje prijave | Flighty, Things | heroj-vreme, nalepnica stanja, grupe po vremenu |
| Dogovori, lista | Flighty, Uber hub, Wolt/DoorDash [O] | isto + red „Danas“, „Objavi ponovo“ u Istoriji |
| Dogovor, koraci | Domino's, Flighty, Duolingo staza, Android/Apple Live | nalepnica putuje, vremena ispod čvorova, rečenica sledećeg poteza gore |
| Razgovor | WhatsApp, iMessage, Vinted, Airbnb inbox, Intercom | događaj-kartice, znak samo uz poslednju poruku, brze poruke, vreme odgovora tek uz podatke |
| Ocena | Airbnb (javno/privatno), Duolingo | javne oznake naspram komentara sa bravom; „pečat“ posle čuvanja |
| Trenutak „Dogovoreno!“ | Duolingo, Things, Headspace | „pečat pada“: jedna nalepnica, jedan haptik, bez konfeta |
| Profil | Airbnb pasoš i pečati, Apple Settings, Spotify | pasoš uskakača, `FactStrip` statistika, manje redova |
| Radni profil | Airbnb uvođenje domaćina, BlaBlaCar, Typeform | 3 grupe, „3 od 4 gotovo“, tri pitanja |
| Obaveštenja | Apple Notifications, Linear, Flighty | „Čeka te / Ostalo“, kartica koja se sklopi, tekst pre ekrana |
| Push, zaključan ekran | Android Live Updates, Apple Live Activities | jedna živa kartica Dogovora bez teksta zadatka [ZAV] |
| AI razgovor i nacrt | Typeform, Airbnb uvođenje, Monzo | nalepnice se lepe na nacrt, prazna mesta = „Još treba“ |
| Prazna stanja | Superhuman, Headspace, Things | promenljiva nalepnica + `Arrive`, jedna topla rečenica |
| Raspored | Airbnb Trips, Flighty | itinerar dana, heroj-vreme |
| Javni profil, poverenje | Thumbtack, Airbnb Guest favorite, TaskRabbit | dokaz sa pragom, tihe siluete umesto praznih brojeva |
| Bezbednost i prijava | Uber PIN i deljenje | opciono „kod dolaska“ [OD] |
| Nalepnice (FactArt) | Airbnb 3D, Duolingo oblici, Things, Apple rings | kalup nalepnice, test siluete, jedna slika od 96 po ekranu |

## Šta ne uzimamo i šta nisam mogao da vidim

- **Ne uzimamo:** konfete i pritisak serija (Duolingo), svetleći gradijent pozadine (Gemini, Cash App neon), društvene funkcije (Airbnb „Connections“), staklo u sadržaju (Apple: staklo je za kontrole), veštačku oskudicu (Monzo „golden ticket“).
- **Nisam video ekrane** (samo opis ili članak): Airtasker, Wolt, Uber, Booking, WhatsApp, iMessage, Revolut, Monzo, Typeform, Stripe, Linear, Apple Maps/Settings/Mail, Citymapper, Zillow, Headspace, Spotify. **Video sam:** App Store stranice Flightyja i Airbnb-a (prva tri snimka ekrana Airbnb-a), hero flighty.com, stranicu i sliku Duolingo bloga, culturedcode.com/things; izmereni stilovi su sa veb verzije apps.apple.com.
- **Nisam mogao:** da vidim pokret (sve je statično), mapu u našoj aplikaciji, ni jedan snimak telefona (naši snimci su web laboratorij); Browser okno je bilo 800×460 i ne učitava lenje slike (Airbnb newsroom bez slika). Pet izvora vratilo je 403, preusmerenje ili prazan sadržaj (uxdesign.cc, Domus, Superhuman help, Baymard, TechRadar tekst), a nekoliko zvaničnih stranica nisam ni pokušao da otvorim celo, pa se oslanjam na isečke pretrage, označeno „isečak“. Brojke iz `blakecrosley.com` (Flighty, Headspace) i `screensdesign.com` nisu zvanične.
- **Proveriti pre rada:** `FactStrip` traži izuzetak od „šest primitiva“; novi tokeni pokreta (put nalepnice, pad pečata, sklapanje kartice) idu kroz `sys.motion` i ratchet test; „Live Updates“ i naginjanje su [ZAV], zato ih ovde samo beležim.
