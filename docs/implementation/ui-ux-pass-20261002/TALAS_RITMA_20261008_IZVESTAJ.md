# Talas ritma i reda — izveštaj (8. oktobar 2026)

Stanje: SOURCE + web laboratorija (lažni podaci) + testovi. NIŠTA od ovoga nije proveravano na telefonu ni emulatoru; nijedan APK nije pravljen od ovog koda do trenutka pisanja. Svi agenti su radili na Sonnet 5.5 (server na Opus 5.5). Provera integracije: `npx tsc --noEmit -p tsconfig.json` 0 grešaka; pun Jest 568 grupa / 12.523 testa, 0 palih.

## Zašto talas
Vlasnikov utisak o probnoj gradnji od 7.10. uveče: „izdeljeno, isprekidano, složeno bez reda“. Dizajn-vođa je izmerio uzrok (`KOMPOZICIJA_I_RITAM_SPEC_20261007.md`): ivica ekrana imala četiri vrednosti (16/20/22/24), razmak sedam, razdelnik 104 mesta u dve debljine, šest vrsta kontejnera, a isti red/naslov/podnožje imao je varijantu na svakom ekranu. Lek: jedan ritam (ivica 20, razmak 4/8/12/16/24/32/48, odeljci razdvojeni prostorom, redovi inset linijom 1 dp, kartica samo za zapis koji se dodiruje) i šest primitiva koji ga nose.

## Šta je gotovo (po porodicama)
- **F8 sistem.** `src/ui/system/layout.ts` (`sys.layout`, `sys.rule`); primitivi `Screen`, `Section`, `ListRow` (+ `value`, `expanded`), `FactRow` (2.5D slika 28 dp, vraćeno na zahtev vlasnika), `KeyValueRow`, `Surface`; `Segmented` bez odsecanja (≤3 jednake širine, ≥4 `chips`), `FlowFooter` sa razlogom iznad dugmeta; stanja: `StateView` (centrirano, slika 96, jedna zelena + jedna tiha radnja), `OutcomeUncertain` (jedno dugme „Proveri“), `OfflineLine`, `outcomeCopy.ts`, `stateRules.ts`; `Skeleton` iste geometrije kao red/zapis/činjenica; zaštitni testovi koji se samo smanjuju. Galerija `/dizajn-sistem`.
- **F7 ulaz i prijava.** Forma uvek radi (i kad provera načina prijave padne); polje „Lozinka“ prati tastaturu; jedno ime „Oporavak lozinke“; grad se sređuje („NovI SAD“ → „Novi Sad“); „Možda već imaš nalog“; dozvole u kontekstu. Nije urađeno: „Otvori email“ (traži novu zavisnost).
- **F1 Početna, Obaveštenja, Poruke.** Početna: dve velike pločice ostaju, „Čeka te“ i „Raspored“ kao odeljci/redovi, R02 „Predloži termin“, R06 „Slobodan sam sada“, R18 „Nastavi nacrt“, R20 „Podesi radni profil“, R31 „Nema veze“; Obaveštenja i Poruke kao `ListRow`; podešavanja obaveštenja kao tri izbora + „Napredno“ (R33).
- **F2 Zadaci.** Kartica zadatka kao jedan zapis (jedno telo za listu i pin), detalj (T3, bez linija, FlowFooter), pretraga kao redovi jedne liste, „Za mene“ (R28) i lista GRADOVA (DISCOVERY-GRAD `groupBy CITY`), R25/R27/R35, pitanja i odgovori.
- **F3 Moji zadaci, Prijave, Kandidati.** Jedna kontrola „Filteri“ u traci, tri jednaka taba, kartica ≈200 dp, R12 „Čekaš prijave. Vidiš ih ovde i u zvoncu.“, kandidati (lice 56, „Ima: Kombi · Trake“, „Najbolje ocenjeni“), forma prijave bez linija. R16 klijentski deo iza prekidača (isključen).
- **F4 Objava.** AI razgovor: „Na primer“ + tri rečenice kao redovi (R18), jedna iskrena rečenica + „Proveri“ za nepoznat ishod, R19; pregled/nacrt na istom okviru i FlowFooter; „Objavljeno“; fotografije i mesto na tokenima.
- **F5 Dogovori, Raspored, razgovor, ocena.** Lista Dogovora (dva taba + ikona Raspored, kartica ≈150 dp), pregled Dogovora (T3: koraci → Uslovi → Kontakt i mesto → komande; R01a/R02/R03/R04, CANCEL-INFO), Raspored bez šine i isprekidane ivice, razgovor bez pokreta, „Ne znamo da li je stigla“ + „Proveri“, ocena kao tok (R29).
- **F6 Profil, nalog, podrška, privatnost, pravno.** Identitet bez kartice, odeljci i redovi na jednoj ivici, „Moja statistika“ i „Primljene ocene“ (R30, PROFILE-TRUST), „Promeni lozinku“ (R22), „Prijava greške“ (R23), „Najčešća pitanja“ (R09 nacrt), podekrani na istim primitivima.
- **B0 pokret i haptika.** Prelaz ekrana 240 ms sa `easeOut`, `Appear` (8 dp, `easeOut`), `haptics.ts` `tick(kind)` sa lancem rezervi, `Press` ide kroz njega; mrtvi tokeni obrisani.
- **Serverski paketi (po stalnoj naredbi za dokazane pakete):** MATCH-V1B (dnevnik 233) i DISCOVERY-GRAD (234); priznanice u `supabase/operations/dev-alpha/ledger/`.

## Merljivo (laboratorija, FAKE podaci)
Početna: 6 različitih levih ivica → 4, 3 vrste kontejnera → 2; kartica zadatka ≈275–300 → ≈200 dp; Moji zadaci: 172 dp kontrola pre sadržaja → 1 kontrola; kartica Dogovora ≈174 → ≈150 dp; font 1,15/1,3 i dalje nije merljiv u webu (lab ne skalira tekst).

## Otvoreno i traži odluku vlasnika
1. Zum (+/−) i „U blizini“ iznad mape: 4 plutajuća objekta u mirovanju (spisak traži ≤ 3).
2. „Otvori email“ posle registracije (expo-intent-launcher) i „Kopiraj broj“ (expo-clipboard): nove zavisnosti.
3. `profile_trust_visibility` (OWN_ONLY) i `received_reviews_detail` (COMMENTED_ONLY): javna pouzdanost i „sve ocene“ ostaju isključene dok on ne kaže.
4. R16 (pomoć kad nema prijava) traži `publishedAt` i broj fotografija u čitanju potrebe pa uključivanje prekidača; R29 za niske ocene traži katalog oznaka; R11/R15 traže `taskTitle` u `rpc_list_inbox`; R17 traži `closed` i `memberCount` u projekciji razgovora.
5. FAQ (R09) čeka njegov pregled; tekstovi R07/R08/R10/R34 su njegovi (pravo, novac, bezbednost).
6. DISCOVERY-GRAD: „d“ bez kvačice da nađe „đ“? primeniti deo S3 (ubrzanje)? kad se spoje dva pisanja mesta, prikazati poslednje objavljeno?
7. Produkcioni Supabase (nov projekat) mora prvo dobiti MATCH-V1, ZAMENE, GRAD i B24 kandidate, ili klijentski prekidači `FOR_ME_SWITCH_EXISTS`, `TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY`, `DISCOVERY_V1_PLACES_BY_CITY` idu na false.

## Tehničke napomene
- Lab (Expo web na 8081, FAKE izvor) pada od memorije kad mnogo agenata menja fajlove: pokretač `scratchpad/web-smoke.cjs` sada daje 8 GB, 5 radnika i sam ga ponovo diže; snimak koji pokazuje samo logo i spinner nije ekran.
- Pokretač izgleda: `scratchpad/lab/cdpl.cjs` (korak `{"lint":"ime"}`: leve ivice, fontovi, senke, linije, odsečen tekst, male mete).
- Zajednički ratchet testovi menjani su u više porodica; držati ih samo-smanjujućim.
- Otvoreni jezički prolazi koji nisu rađeni: „Osveži prikaz“ ×31, „Nalog je promenjen“ ×12, „Učitaj sačuvano stanje“; ekrani porodica još ne uvoze `outcomeCopy` (224 poruke, 36 dugmadi): prolaz za sve odjednom.

## Sledeće (po vlasnikovim rečima 8.10.)
Vlasnik: vrati 2.5D ikonice (urađeno), od Airbnb-a uzeti samo izgled/lepotu/jasnoću, izvesti svaki ekran iz svrhe i potrebe korisnika, odlučiti kartice ili ne i pokret po ekranu, tražiti svetska rešenja i biti KREATIVAN (ne generički), odobrio Fable 5.1 za sintezu i varijante. Istraživanja: `ISTRAZIVANJE_R1..R4_*.md`, `AIRBNB_OSECAJ_SPEC_20261008.md`; zatim kreativni pravac i 2–3 varijante ključnih ekrana u laboratoriji; zatim primena.
