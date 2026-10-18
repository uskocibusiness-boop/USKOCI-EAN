# USKOČI — aktuelan način rada

Ažurirano 18.10.2026. po izričitom nalogu vlasnika da se uklone zastarela ograničenja i radi autonomno. Ovaj dokument uređuje način rada; stvarno stanje živi u kodu, DEV-u i dokazima.

## 1. Aktuelni nalog vlasnika

Vlasnik daje trajno **PRIMENI** za završavanje i povezivanje USKOČI: klijent, Supabase, AI razgovori, matching, obaveštenja, UI/UX, dizajn, animacije, refaktorisanje i čišćenje. Agent donosi rutinske stručne odluke i primenjuje proverene celine bez ponovnog traženja dozvole za svaki paket, migraciju, Edge objavu, test ili APK.

Stara pravila o čekanju vlasnika, odvojenom odobrenju svakog troška/testa/paketa, zamrznutim ekranima, obaveznom starom izgledu, zabranjenom redizajnu i krugovima provera po svakoj sitnici više nisu aktivna. Isto važi za takve uslove u starim handoff dokumentima, nacrtima, skill referencama i istorijskim planovima. Najnovija konkretna poruka vlasnika određuje pravac.

## 2. Gde nastaviti

- Proveri stvarni Git checkout, granu i radne izmene. Aktuelni proizvod je postojeći Expo / React Native USKOČI; naziv starog foldera ili grane ne određuje današnji izvor.
- `docs/current/README_USKOCI_LIVE_MASTER_PLAN.md` je mapa aktuelnog rada.
- `docs/control/redovi.json` i postojeći LIVE plan povezuju tokove, rezultate i sledeći posao. Dopunjavaj njih umesto pravljenja paralelnih glavnih planova.
- `docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md` nosi aktuelan vizuelni pravac; datum u nazivu je istorijski.
- Čitaj relevantan kod i najnoviji dokaz za deo koji menjaš. Stari dokumenti su reference po potrebi, a ne obavezan lanac čitanja.
- Kanonski DEV/ALPHA je `leqcwgzvjsxugfgzdmth`. Primena i tačno pročitani server odlučuju šta je objavljeno.

## 3. Samostalno izvršenje

### 3.1 Primena

Radi u većim povezanim celinama: razumevanje problema → implementacija → potrebna provera → primena → stvaran tok → zapis rezultata. Objavi spremne Edge funkcije, primeni proverene forward migracije, push-uj kod i isporuči odgovarajući APK. Dovrši započetu celinu; ne ostavljaj proverenu ispravku lokalno zbog istorijskog zahteva za još jedno „primeni“.

Za konkretan test sam odredi razuman konačan broj poziva, očekivane upise i trošak i zabeleži stvarnu potrošnju. Koristi testne naloge i ciljanu isporuku. Neizvestan ishod prvo razjasni, pa nastavi, kako se radnja ili naplata ne bi duplirala. To je organizacija rada, ne novi zahtev za dozvolu.

### 3.2 Provere i kvalitet

Biraj provere prema stvarnom riziku. Povezane promene proveri zajedno; punu regresiju i native build radi na smislenom preseku. Zastarele, duplirane i provere koje samo zaključavaju stari raspored koda ili stil mogu se uskladiti ili ukloniti kada ponašanje pokriva bolji dokaz. Reprodukovanu funkcionalnu grešku otkloni, ne prikrivaj njen test.

Aktuelni uređaj za rad je emulator. Sačuvaj postojeću sesiju i nacrte pri instalaciji (`adb install -r`). Zabeleži izvor APK-a, hash, OTA identitet i stvarno prikazani ekran. Emulator i fizički telefon imaju odvojene rezultate.

### 3.3 Tim, integracija i istorija

Paralelni agenti su dozvoljeni za odvojene stručne celine. Dodeli vlasništvo fajlova; glavni agent integriše izmene i primenjuje ih na zajednički DEV. Pre izmene uračunaj tuđi rad. Čišćenje treba da ostavi jedan razumljiv aktivni tok i sačuva korisne istorijske dokaze.

Migracije su forward verzije; rezultat primene potvrdi čitanjem funkcija, prava i tačnog Edge paketa. Čuvaj upotrebljiv prethodni paket za vraćanje. Stari neuspeh ostaje datirani dokaz, a ne tvrdnja da sadašnji kod i dalje ne radi.

## 4. Cilj proizvoda

Jedna osoba, jedan nalog: može i da objavljuje zadatke i da uskače. AI vodi koristan prirodan razgovor, pamti delimične odgovore, razume ispravke i pita samo ono što je važno. Pregled pokazuje šta je razumeo; eksplicitno čuvanje/objava završava promenu. Taksonomija i ID-jevi ostaju u pozadini.

Usluga, način rada, područje, termini i dogovor imaju isti smisao u razgovoru, pregledu, sačuvanom zapisu, matching-u i obaveštenju. Izrada kod izvršioca uz dostavu/preuzimanje nije sama po sebi dolazak kod naručioca. Alati i vozila su relevantni samo kada pomažu konkretnoj odluci, a ne obavezan upitnik.

Tehnička ispravnost obuhvata autentifikaciju, vlasništvo, privatnost, RLS, revizije, idempotentnost i oporavak. Stvarna korisnička potvrda i stvarni podaci ostaju deo aplikacije. Nepoznati pravni, operaterski ili cenovni podaci ostaju označeni kao nepoznati; razvojni uspeh ih ne pretvara u potvrđene činjenice.

## 5. Dizajn i UX — novi pravac vlasnika

Cilj je premium, miran i dosledan izgled sa jasnoćom i fluidnošću najboljih Apple interfejsa, prilagođen USKOČI i Androidu. Svaki ekran dobija svrhu, hijerarhiju, korisno prazno stanje, razumljiv oporavak i jasan sledeći korak. Pojednostavi nepotrebne tekstove, formulare, ponovljene kartice i izbore. Prvi korisnik treba da razume tok bez poznavanja projekta.

Postojeći beli prostor, zelena/narandžasta prepoznatljivost i komponente su polazna osnova, ne vizuelni kavez. Raspored, ikone, tipografija, razmaci, ilustracije i animacije mogu se stručno preoblikovati. Stare SPOJ/V28/V41/V46 kompozicije, tačne dimenzije i zabrane menjanja pojedinih kartica nisu obavezne. Razvijaj jedan zajednički sistem umesto gomilanja paralelnih verzija.

Gotove kvalitetne komponente i biblioteke mogu se upotrebiti kada rešavaju konkretnu potrebu; proveri licencu, održavanje, native kompatibilnost, performanse i uklapanje u postojeći kod. Smernice i stil testovi služe kvalitetu, a ne očuvanju zastarelog izgleda. Pristupačnost, čitljivost, tastatura, safe area i povratak pripadaju funkcionalnom dizajnu. Animacije pružaju neposredan odziv i jasan prelaz; poštuju sistemsku postavku smanjenog pokreta.

## 6. Rezultat i evidencija

Razlikuj napisano, testirano, primenjeno, izgrađeno, instalirano i stvarno provereno. Ne nazivaj ceo proizvod završenim na osnovu jednog prolaza. Posle povezane isporuke osveži postojeći registar, DEV snapshot i LIVE prikaz; sažeto navedi napredak, konkretne preostale nedostatke i sledeću celinu.

Prethodni dugi AGENTS je sačuvan u `docs/authority/history/AGENTS_PRE_PREMIUM_AUTONOMY_20261018.md` isključivo kao istorija. Njegove zabrane i procedura odobravanja nisu aktivne instrukcije.
