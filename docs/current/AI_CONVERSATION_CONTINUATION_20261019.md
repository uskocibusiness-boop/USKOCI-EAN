# AI razgovori — nastavak 19.10.2026.

## Polazni presek

Grana `feature/unified-qa-master-20261017`, osvežena na `69be6fde` (docs child funkcionalnog `f18ea85d`). Radno stablo bilo čisto. Prethodni emulator build **39172584706** za `f18ea85d` je SUCCESS: TypeScript, puna regresija i APK. To nije dokaz instalacije novih izmena iz ovog paketa.

## Povezana celina

- **Task Edge:** dnevnica/satnica i ponovljene smene više ne odbacuju nezavisno navedene odgovore. Broj ljudi i mesto mogu da se zabeleže dok se problematičan uslov razjašnjava. Cena, zavisni termini i sintetisani naslov/opis se ne predstavljaju kao potvrđeni. Svi postojeći guard-ovi datuma, vremenske zone, promene posla i safety ostaju. Pet novih slučajeva prvo je palo na starom kodu.
- **Worker razgovor:** nastavljen otvoreni nacrt je označen; sačuvani profil nije izmenjen samim ulaskom. Jedna akcija „Izmeni kroz razgovor“ zamenjuje dugmad uz svaku sekciju pregleda. Isti conversationId, server nacrt i neposlat tekst ostaju; nema automatskog slanja/čuvanja.
- **Zajednička AI tastatura:** Android `KeyboardAvoidingView` meri preklapanje tastature pomoću padding ponašanja, kao i iOS. Na zatečenom emulatoru je dokazano da tastatura pokriva input/send i da tap može pogoditi slovo tastature. Nova ispravka zahteva proveru novog APK-a; unit test ne dokazuje native geometriju.
- **Profil:** vrednost dostupnosti ide ispod naslova kako veliki tekst ne bi lomio sam naziv.
- **Testovi:** istorijski zahtev za „Izmeni“ uz svaki deo i tačan redosled dekorativnih sekcija zamenjen je proverom jednog dostupnog ulaza, sačuvanih podataka, veličine dodira, zabrane nedozvoljenog pisanja i istog razgovora.

## Provere pre primene

TypeScript PASS. Posle konačnih izmena: 6 ciljanih Jest grupa / 209 testova PASS, 137 Node Edge provera PASS. Pre toga dodatno 7 grupa / 245 testova PASS na ranijem preseku paketa. To nisu dva odvojena ukupna zbirna rezultata. Pun CI/APK i DEV readback beleže se posle objave.

## Stvarni razgovori i granice

Emulator, postojeći testni nalog Milos. Budžet najviše 12 poziva / 3 USD rezervacije; nema objave zadatka, čuvanja profila ili push probe u ovoj rundi. Zatečeni AI nacrt (krečenje) razlikuje se od sačuvanog profila (3D). Prvi stvarno poslati upit zadržao je krečenje u Novom Sadu do 30 km i dodao 3D figurice koje se izrađuju kod izvršioca pa šalju. AI i potpisani pregled su pokazali ON_SITE za krečenje i REMOTE za 3D. Prethodni tap preko tastature nije poslao poruku; broje se stvarni server pozivi, ne UI pokušaji. Nastavak i stvarna potrošnja dopunjuju se iz server evidencije.

## Otvoreno — nije predstavljeno kao završeno

1. Regionalna pokrivenost (Vojvodina/cela Srbija/više oblasti) kroz AI → profil → matching/dispatch i sve tačke rute. Postojeći grad/radijus nije taj model.
2. Ponovljene smene i složeni termini. Ovaj paket čuva ostale odgovore i jasno traži podržan termin; ne dodaje novi serverski kalendar.
3. Preostala ručna potvrda načina rada u nepotvrđenom worker pregledu i obična polja u location toku zahtevaju posebnu migraciju na AI uz očuvanje ljudske potvrde mape i signed review ugovora.
4. Potpun tok dva naloga: objava → matching → isporučen push → ispravan deep-link → Dogovor → završetak.
5. Sažeci Home zadataka/Dogovora i nezavisno učitavanje osnovnih sekcija.
6. Novi povezani vizuelni talasi, grupni media/voice, strukturisano deljenje lokacije/kontakta, production/store priprema.

Nastavak prati postojeći LIVE plan: prvo pouzdanost i jasnoća oba AI toka, zatim globalni sistem/Početna, Zadaci, prijave, Dogovori/čet i profil. Nema novog paralelnog glavnog plana niti tvrdnje da je ceo proizvod prihvaćen.
