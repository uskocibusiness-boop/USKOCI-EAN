# USKOČI — stvarno stanje čistog foldera (26.10.2026)

Ovaj folder je jedini lokalni checkout za `feature/uskoci-cisto`. Stari
`USKOCI ZAVRSAVANJE/USKOCI-EAN` nije menjan. Više hiljada starih izveštaja,
workflow-a i pomoćnih skripti iz udaljene grane nije deo ovog izvornog foldera;
zadržani su kod aplikacije, resursi, migracije, dokazi i provere potrebne za
instalaciju i rad. Izbrisani fajlovi ostaju u Git istoriji.

## Potvrđeno

- `npm ci` u ovom folderu kreira sopstveni `node_modules`, primenjuje i proverava
  nativnu Reanimated zakrpu i proverava ulazne grafičke resurse.
- `npx tsc --noEmit`, provera integriteta 190 lokalnih migracija i odabrani AI
  ugovorni testovi prolaze.
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

## Nije završeno

- Puna Jest regresija: 615/621 paketa i 14.129/14.162 testova prolazi.
  Preostalih 6 paketa / 33 testa su u Dogovorima i dalje očekuju svesno,
  dvosmerno deljenje telefona. Trenutni ekran dozvoljava samo Poruke u
  aplikaciji. To je odluka o proizvodu i privatnosti koja čeka vlasnikov izbor.
  CI namerno pokreće celu regresiju i neće biti zelen dok se očekivanja ne
  usklade sa odobrenim proizvodnim ponašanjem. Ne zaobilaziti padove samo da
  provera pozeleni.
- Produkcioni build/OTA je namerno blokiran dok postoji samo potvrđeni DEV
  backend. Nema dokaza za store release ili pun tok na fizičkom telefonu iz
  ovog novog foldera.
- Sledeće: pregledati preostale testove po ugovoru privatnosti, dokazati AI
  latenciju i prompt-cache na reprezentativnom uzorku, pa uraditi native
  instalaciju i tokove na testnom nalogu pre odluke o produkciji.
