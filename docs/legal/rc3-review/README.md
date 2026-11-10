# USKOČI — pravni paket RC3 (review only)

**Status:** NEAKTIVAN NACRT / PREPUBLICATION REVIEW. Pripremljeno 10.11.2026. Prvi planirani tržišni obuhvat: Srbija; korisnici 18+; platforma inicijalno besplatna. Ovaj direktorijum **ne aktivira** Uslove, ne daje saglasnost za javno izdanje i ne menja postojeće aktivne putanje niti backend. Dokumenti su izvedeni iz kompleta `USKOCI_PRAVNI_PAKET_RC3_2026-11-10.zip` (autorski pregled u Library) i održavaju četiri izvorna otvorena polja.

## Šta sadrži

Devet samostalnih HTML stranica i indeks. Na svim stranicama su vidljivi status NACRT, datum pripreme i <meta name="robots" content="noindex,nofollow">. Ovo je samo uputstvo pretraživačima, a ne pristupna kontrola. Ne deploy-ovati ove datoteke kao javnu pravnu politiku dok ne budu odobrene.

## Podaci koje NIKADA ne izmišljati

- `{{DATUM_PRIMENE}}`: stvarni početak primene, posle provere javnih URL-ova.
- `{{ADRESA_ZA_PISMENA}}`: zakonit i proverljiv formalni kontakt koji ne otkriva privatnu kućnu adresu mimo obaveznih pravila.
- `{{TELEFON_OPERATERA}}`: stvaran telefon ako je pravno neophodan za određeni model.
- `{{REGISTAR_PRENOSA_I_GARANCIJA}}`: potvrđene strane, zemlje, podobrađivači i pravni mehanizmi.

Poznati podaci: Miloš Šljivić, fizičko lice (pravna kvalifikacija javnog modela otvorena), Novi Sad, Srbija; `uskoci.support@gmail.com` (potvrđeni kontakt); Srbija kao inicijalno tržište; platforma 0 RSD; buduće pretplate pružaocima nisu deo prvog izdanja.

## Preduslovi pre bilo kakvog pravnog aktiviranja

1. **Pravni model:** proveriti sa kvalifikovanim pravnikom komercijalnu svrhu/fizičko lice naspram registracije, i granicu posredovanja u radnom angažovanju; ne tretirati poslate upite organima kao saglasnost.
2. **Kontakt:** potvrditi adekvatnu adresu za pismena i obavezni telefon prema stvarnom statusu. Privatna kućna adresa nije odobrena za javno prikazivanje.
3. **Privatnost:** potvrditi zaista aktivne Supabase, Gemini, LocationIQ, OpenFreeMap, Expo/FCM, Gmail i druge procesore; ugovore, prenose, rokove, bezbednosne kontrole; ocenu potrebe za DPIA.
4. **Rokovi i brisanje:** dokumentovati po kategoriji podatka, svrsi, pravnom osnovu, početku roka i izuzetku; dokazati automatizovano izvršenje uključujući rezervne kopije, izvoz, poruke, medije i aktivne Dogovore.
5. **Funkcije:** funkcionalno proveriti 18+, prijave i blokiranje, ljudski pregled odluka, prijavljivanje AI sadržaja, status pružaoca usluge, obaveštenja o rangiranju, potrošačko obaveštenje i izričit zahtev za raniji početak usluge tamo gde se primenjuje.
6. **Pravne verzije:** po odobrenju izraditi konačne neizmenljive verzije dokumenta, kontrolne zbirove, javne HTTPS putanje, usaglasiti tačno ta izdanja sa Supabase registrom i proveriti čitljivost bez prijave. Prihvatanje mora imati zaseban serverski dokaz o korisniku, verziji i vremenu; privatnost ne tretirati kao univerzalnu saglasnost.
7. **End-to-end:** registracija emailom i stvarno omogućeni dodatni načini; navigacija Profil preko avatara; predugovorno obaveštenje pre potvrde Dogovora; korisnički zahtev bez aplikacije; testovi otkaza i povlačenja; Google Play brisanje i Data safety; nakon svega poseban release GO.

## Pravila integracije

- Ne ažurirati stare `docs/legal/*.html` automatski, niti potajno povezivati ovaj nacrt u ekran registracije.
- Ne postavljati `is_active=true`, `legal_ready=true` ili lažne oznake advokatskog odobrenja; prethodni nepouzdani bundle je povučen namerno.
- Ne tvrdite da je zahtev za brisanje završen dok nema pouzdanog serverskog rezultata.
- Proveriti svih devet HTML stranica lokalno i dva serverska pogleda: pravna spremnost i povezane retention/closure/export politike. Sačuvati dokaz i ponoviti posle implementacije.
- Nakon pravnog pregleda urediti ove nacrte i tek tada promovisati u postojeći kanonski legal sistem kroz verzionisanu i testiranu izmenu. Ne praviti paralelni produkcioni pravni registar.

**Nema promena u Supabase-u, Vercel-u, Google Play-u, aplikacionom runtime-u ili aktivnim pravnim registrima u ovom PR-u.**
