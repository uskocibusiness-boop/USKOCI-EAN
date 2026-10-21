# Prijave — osvežavanje iz obe uloge, 21.10.2026.

## Završeno u klijentu
- Vlasnik: lista kandidata ostaje montirana tokom osvežavanja. Kratka poruka objašnjava proveru; otvaranje i izbor kandidata privremeno su onemogućeni, uključujući dostupno disabled stanje.
- Ne mešaju se novija stranica prijava i starija revizija/kapacitet zadatka: zadržava se poslednji usklađen prikaz dok oba čitanja ne završe.
- Izvršilac: postojeće „Moje prijave” ostaju vidljive tokom osvežavanja; izmena/povlačenje čekaju novi read. Prvo učitavanje ili prelazak na drugi skup ostaju poseban loading.
- Pull indikator prati stvarno pokrenuto osvežavanje. Pozadinsko čitanje ne glumi korisnikov pull gest.
- Paginacija pauzira tokom osvežavanja. Prazno, prvo učitavanje, odbijeno čitanje i uspešno osvežavanje ostaju različita stanja.
- Gubitak fokusa, pozadina i promena naloga čuvaju ranije zaštite privatnosti. Pri odbijenom read-u stari kandidati se uklanjaju i nudi se novi pokušaj.

## Dokazi
Šest ciljnih Jest paketa: 226/226 PASS. TypeScript PASS. git diff --check PASS.
Nova regresija: owner refresh zadržava redove, odbija staru akciju, čeka usklađen task/page read; greška → retry; worker refresh zadržava red i odbija povlačenje; obe kartice i poređenje imaju disabled oznake; paginacija miruje.
React review: očuvani memoizovani redovi i stabilan callback, bez dodatnog fetch efekta ili biblioteke; snapshot ograničen na session; indikator koristi postojeće tokene i tipografiju.

## Veza sa Master zahtevima
Doprinos REQ-05F-01 i REQ-05F-07: vlasnička ponuda i izbor; prijave izvršioca i međustanja iz faza 5E/6/11. Ove široke stavke nisu ovim proglašene u celini završenim.

## Izvori
- src/app/(app)/potrebe/[id]/kandidati.tsx
- src/app/(app)/moje-prijave.tsx
- src/ui/v2/ApplicationSelectionPresentation.tsx
- src/ui/v2/CandidateFace.tsx
- src/ui/v2/MyApplicationsPresentation.tsx
- src/data/__tests__/{candidates-paged-screen,candidates-paging-presentation,candidate-face,application-selection-native,own-applications-paging-presentation,my-applications-native}.test.tsx

## Granice i nastavak
Nema novih backend promena niti APK-a. Nije izvršen vizuelni/native prolaz za ovaj commit.
Prethodna DEV ispravka otkazivanja ostaje primenjena. Stvarni izbor zamene, vremenski konflikti, bezbedna ponovna objava, AI oblast/valuta, grupne izmene, precizan push cilj i closure ostaju otvorene stavke aktuelnog MVP audita.
