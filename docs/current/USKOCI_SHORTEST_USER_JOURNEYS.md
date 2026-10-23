# USKOČI — 20 najkraćih korisničkih puteva (Shortest User Journeys)

Ažurirano: 23.10.2026.  
Status: Optimizovani korisnički tokovi sa minimalnim brojem koraka  
Cilj: Airbnb jednostavnost + Apple brzina (bez suvišnih formulara i prepreka)

---

## 1. Matrica najkraćih tokova

| # | Naziv toka | Početna tačka | Broj koraka (Taps) | Koraci i interakcije | Ciljno stanje |
|---|---|---|---|---|---|
| **J01** | **Objavljivanje zadatka glasom** | Početna (`/`) | **3 koraka** | 1. Dodir na `+` (Nova) <br>2. Pritisak na 64dp mikrofon i govor: *„Treba mi krečenje sobe 20 kvadrata sutra u Novom Sadu za 6000 dinara“* <br>3. Dodir na morfovano dugme `Pošalji` → pregled → `Potvrdi objavu` | Zadatak objavljen i poslat u matching |
| **J02** | **Objavljivanje zadatka sa mapom** | AI Razgovor (`/nova`) | **3 koraka** | 1. Korisnik kaže lokaciju <br>2. Dodir na karticu mesta <br>3. Prevlačenje 2.5D pina na tačnu zgradu sa thumb-liftom → `Potvrdi mesto` | Tačna lokacija trajno usvojena |
| **J03** | **Prijava radnika na zadatak (1-tap)** | Zadatak (`/prilike/[id]`) | **2 koraka** | 1. Dodir na `Uskoči` <br>2. Potvrda predložene cene i vremena → `Pošalji prijavu` | Prijava poslata naručiocu |
| **J04** | **Prihvatanje radnika i popunjavanje slota** | Zadatak (`/potrebe/[id]/kandidati`) | **2 koraka** | 1. Pregled kandidata (ocena, cena) <br>2. Dodir na `Prihvati radnika` | Popunjen slot (npr. `1/2` prelazi u `2/2`), kreiran Dogovor |
| **J05** | **Deljenje broja telefona u dogovoru** | Dogovor (`/dogovor/[id]`) | **2 koraka** | 1. Dodir na `Podeli telefon` <br>2. Potvrda u dijaloškom prozorčiću | Broj telefona vidljiv radniku u četu |
| **J06** | **Deljenje tačne adrese za dolazak** | Dogovor (`/dogovor/[id]`) | **2 koraka** | 1. Dodir na `Podeli tačnu adresu` <br>2. Potvrda kućnog broja i sprata | Radnik dobija navigacioni pin i adresu |
| **J07** | **Potvrda završetka zadatka** | Dogovor (`/dogovor/[id]`) | **2 koraka** | 1. Dodir na `Zadatak je završen` <br>2. Potvrda realizacije | Status prelazi u `Čeka potvrdu druge strane` |
| **J08** | **Ocenjivanje radnika / naručioca** | Modal ocene (`/oceni-dogovor`) | **2 koraka** | 1. Dodir na zvezdicu (1-5) <br>2. Dodir na `Ostavi utisak` | Ocena upisana u profil i javni rejting |
| **J09** | **Aktivacija radnog profila** | Radni profil (`/profil/radnik`) | **1 korak** | 1. Dodir na prekidač `Aktiviraj radni profil` | Radnik postaje vidljiv za matching i pretragu |
| **J10** | **Podešavanje instant dostupnosti** | Radni profil (`/profil/dostupnost`) | **1 korak** | 1. Prekidač `Dostupan odmah za poslove` | Uključen instant zeleni bedž za klijente |
| **J11** | **Izmena područja rada na mapi** | Lokacija radnika (`/profil/lokacija`) | **2 koraka** | 1. Izbor matičnog grada (npr. Beograd) <br>2. Slajder za radijus (npr. 30 km) → `Sačuvaj` | Baza ažurira krug matching-a |
| **J12** | **Pretraga zadataka po mapi** | Zadaci (`/zadaci`) | **2 koraka** | 1. Prebacivanje na tab `Mapa` <br>2. Dodir na klaster ili pin → pregled kartice | Prikazana brza kartica sa cenom i slotovima |
| **J13** | **Filtriranje zadataka na daljinu (Remote)** | Zadaci (`/zadaci`) | **1 korak** | 1. Dodir na brzi filter čip `Rad na daljinu` | Lista prikazuje samo online zadatke |
| **J14** | **Postavljanje javnog pitanja pre prijave** | Zadatak (`/pregled-zadatka`) | **2 koraka** | 1. Dodir na `Pitaj naručioca` <br>2. Unos pitanja i slanje | Pitanje vidljivo svima ispod opisa |
| **J15** | **Odustajanje od prijave pre prihvatanja** | Moje prijave (`/moje-prijave`) | **2 koraka** | 1. Dodir na opciju `Povuci prijavu` <br>2. Potvrda | Prijava obrisana bez penala |
| **J16** | **Otkazivanje dogovora uz razlog** | Dogovor (`/dogovor/[id]`) | **3 koraka** | 1. Dodir na `Problem sa dogovorom` <br>2. Izbor razloga (viša sila, odlaganje) <br>3. `Otkaži dogovor` | Dogovor arhiviran, slot ponovo otvoren |
| **J17** | **Izmena objavljenog zadatka kroz AI** | Pregled nacrta (`/pregled-nacrta`) | **2 koraka** | 1. Dodir na `Izmeni kroz razgovor` <br>2. Izgovor ispravke: *„Promeni budžet na 9000 dinara“* | Nacrt automatski osvežen na novu cenu |
| **J18** | **Prijava greške ili neprimerenog sadržaja** | Zadatak / Profil (`/profil/prijava-greske`)| **2 koraka** | 1. Dodir na `Prijavi` <br>2. Izbor kategorije i slanje | Formiran tiket korisničkoj podršci |
| **J19** | **Preuzimanje ličnih podataka (GDPR)** | Podešavanja (`/profil/izvoz`) | **1 korak** | 1. Dodir na `Izvezi sve moje podatke` | Generisan JSON arhivski fajl |
| **J20** | **Pregled arhiviranih završenih poslova** | Profil (`/arhiva`) | **1 korak** | 1. Dodir na `Istorija završenih poslova` | Hronološki spisak sa zaradom i ocenama |

---

## 2. Principi eliminacije koraka

- **Bez olovaka uz svaku reč**: Nema mikro-formulara za svaku sitnicu — razgovor i jedna objedinjena kartica rešavaju unos.
- **Bez duplih ekrana**: Svaka akcija ima direktan odziv na istom ekranu uz optimisticki UI i toast potvrdu.
- **Back navigacija čuva stanje**: Povratak sa detalja zadatka na mapu ili listu zadržava isti viewport, nivo zumiranja i poziciju skrolovanja.
