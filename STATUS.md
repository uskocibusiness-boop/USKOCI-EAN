# USKOČI — stvarno stanje čistog foldera (26.10.2026)

> **Nastavak od 28.10.2026:** aktuelni R01–R12 status, stvarni rezultati i sledeći korak vode se u jednom [CODEX_PLAN_RADA.md](docs/plan/CODEX_PLAN_RADA.md#112a-aktuelni-izvršni-status--28102026). Odeljci ispod čuvaju istorijski presek izvornog foldera od 26.10.2026; njihove stare potvrde nisu novi prolaz radne grane `work/rev14-review-f17`.

Ovaj folder je jedini lokalni checkout za `feature/uskoci-cisto`. Stari
`USKOCI ZAVRSAVANJE/USKOCI-EAN` nije menjan. Više hiljada starih izveštaja,
workflow-a i pomoćnih skripti iz udaljene grane nije deo ovog izvornog foldera;
zadržani su kod aplikacije, resursi, migracije, dokazi i provere potrebne za
instalaciju i rad. Izbrisani fajlovi ostaju u Git istoriji.

## Potvrđeno

- `npm ci` u ovom folderu kreira sopstveni `node_modules`, primenjuje i proverava
  nativnu Reanimated zakrpu i proverava ulazne grafičke resurse.
- `npx tsc --noEmit`, svih 621 Jest paketa (14.131 test), provera integriteta
  190 lokalnih migracija i odabrani AI ugovorni testovi prolaze.
- Brzi Gemini je na DEV-u ranije meren oko 2,9–7,2 s za četiri konkretna
  poziva. To nije dokaz odziva ispod sekunde niti 75% uštede tokena.
- Dva razgovora i dva pozadinska toka nisu četiri istovremena modela koji
  ubrzavaju jedan odgovor. Za tvrdnju o keširanju prompta nedostaju metrike.

## Ispravljeno u ovom preseku

- Javna lista zadataka ne prenosi opis u UI kao zamenu za javni sažetak.
- Javno približno područje na mapi govori samo dve decimale i ograničava zum.
- Pregled zadatka ima jedno centralno uređivanje običnih činjenica, uz
  namensku kontrolu za medije.
- Neproverena zastavica za ime u bezbednosnom ekranu uklonjena je iz EAS
  profila; nepostojeći deadline RPC nije uključen pogrešno nazvanom zastavicom.
- Po odluci vlasnika „Samo poruke za sad“, aktivni Dogovor i njegov meni više
  ne nude deljenje/opoziv/pozivanje telefonom. Kontaktni odeljak vodi u Poruke;
  broj iz starije projekcije se ne prikazuje. Odvojena dozvola za tačnu
  lokaciju ostaje. Testovi ekrana i menija sada proveravaju ovaj ugovor.

## Nije završeno

- Serverski Supabase RPC za postojeće `PHONE` grantove i starije klijente nije
  menjan niti je DEV baza migrirana u ovoj izmeni. Zato ovo jeste ugovor
  aktuelnog UI-ja, ali još nije server-side zabrana razmene telefona.
  Slobodan tekst u Porukama takođe može da sadrži broj; za njegovu zabranu
  bila bi potrebna posebna, jasno definisana moderacija.
- Produkcioni build/OTA je namerno blokiran dok postoji samo potvrđeni DEV
  backend. Nema dokaza za store release ili pun tok na fizičkom telefonu iz
  ovog novog foldera.
- Sledeće: zatvoriti telefonske grantove i za starije klijente na serveru u
  zasebnoj migraciji; dokazati AI latenciju i prompt-cache na reprezentativnom
  uzorku, pa uraditi native instalaciju i tokove na testnom nalogu pre odluke
  o produkciji.

## Odluka vlasnika — 26.10.2026: privatnost kontakta

- **POTVRĐENA NAMERA:** telefonski broj se ne deli kroz Dogovor; komunikacija
  i dogovor odvijaju se u Porukama unutar aplikacije. Aktuelni UI je usklađen,
  ali stariji klijenti i server ostaju otvorena bezbednosna granica.
- Ranijih 6 neuspešnih Jest paketa / 33 testa pregledano je i usklađeno sa
  ovom odlukom; puna regresija i TypeScript sada prolaze.
- Sledeća provera: AI ugovori, migracije, zatim ARM64 preview APK i test na
  fizičkom telefonu.
- Produkciona objava ostaje blokirana dok nisu potvrđeni zaseban produkcioni backend, bezbednosne provere i realan end-to-end test.
