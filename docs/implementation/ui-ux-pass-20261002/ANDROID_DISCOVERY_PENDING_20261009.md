# Android: jasni rezultati pri promeni filtera i oblasti

Izvor aplikacije: `725be7bd7c74c2f6c338906e9e12ba77bf8087fd`. Nastavak postojećih B04/B05/S03, bez novog mastera, backend promene ili zavisnosti.

## URADIO

Pre izmene novi filter se odmah prikazivao, dok je zaglavlje liste moglo da prikazuje prethodni broj zadataka bez informacije da novi odgovor još nije stigao. Koordinator je već pravilno zadržavao celu prethodnu kolekciju; njegov postojeći brojač zamene sada stiže do prikaza.

Zaglavlje govori **„Osvežavamo zadatke…“** i izlaže busy/polite stanje čitaču ekrana. Mapa, kartice i izabrana visina liste ostaju tokom promene filtera/oblasti. Stari nulti broj ne prikazuje lažno „Nema zadataka“ i ne podiže listu. Straničenje i automatska dopuna zadataka bez pina čekaju kraj zamene. Brzi dupli zahtev za stranicu više ne može da ukloni loadingMore prvog zahteva. Ne menja se pin halo → kartica u narednom frame-u; nema pull-to-refresh koji bi preuzeo sheet gest.

Home nastavak razgovora dobio je i precizan accessibility hint: otvaranje razgovora, izbor iz liste ili pokušaj ponovo, prema stvarnom stanju.

## DOKAZAO — izvor

- TypeScript exit 0.
- 23 pogođene grupe / **600 testova PASS**: real route/coordinator/owner sa odloženim transportom, oba redosleda odgovora dva filtera, greška/retry, account revision, dvostruko straničenje, map/list u HALF/FULL, prazna zadržana slika, pin halo, warm return, Home i ostali Discovery ugovori.
- Prvi prolaz: 299 PASS / 1 FAIL. Stari test očekivao je tačan objekat `{expanded:true}`; proširen je na novo legitimno `{expanded:true,busy:false}`. Nije uklonjena provera. Završni prolaz je svih 600 PASS.
- Nezavisan read-only pregled nije našao blokirajući nalaz paketa. Izričito Osveži iz menija zadržava prethodni busy režim; ovaj paket ne tvrdi da menja taj tok.
- Prethodni b9 paket ima zasebnu punu lokalnu regresiju 605/605 i fizički AI resume dokaz. GitHub na source-ekvivalentnom dokumentacionom `5fd6ee64` sada stvarno izvršava testove: 37973737055 EX-06E lifecycle (uključujući Full regression), 37973736906 P5 (uključujući Full Jest) i 37973736930 tracker — svi SUCCESS. Raniji 9e1 run zbog billing-a nije aktuelni dokaz zabrane svih novih run-ova. Nema tvrdnje da je naplata menjana ovom sesijom.
- Završni [CI 37975515493](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37975515493), HEAD `e1355f376b87422a84f9bf6e1e54c612c7e55a9b` (isti aplikacioni source kao APK 725): **SUCCESS**. TypeScript, 219 focused lifecycle testova i puna regresija **605/605 suite, 13.519/13.519 PASS, 6 snapshot-a PASS**, 313,666 s. Aktuelni CI log nema skipped testove; ranijih 9 lokalnih skip-ova b9 ostaju istorijska činjenica, ne pripisuju se ovom run-u. Source binding i proof artifact koraci takođe SUCCESS. Ovo je CI izvora, ne CI proizvodnja APK-a niti store gate.

## Native dokaz

Tačan ARM64 preview APK `725be7bd` izgrađen je i instaliran isključivo `adb install -r` na fizički HONOR VKP-NX9, Android 16/API36, font 1.15. SHA256 `b29d1862872d064e8e358c0a7237c5ac287082b5f7969cbd6a73f625865abb91`, 99.703.340 bytes, 5.951 source fajl byte-equal Git arhivi. Potpis je isti prethodni testni Android Debug sertifikat; paket `rs.uskoci.preview` 1.0.0/35, non-debuggable, OTA preview uključen. Instalirani hash i runtime About `725be7b` provereni nezavisno; UID, prvo vreme instalacije i postojeća sesija sačuvani. Ovo nije produkcioni AAB/potpis.

- Stvarni filter **Danas**: prvi snimak posle klika pokazuje **„Osvežavamo zadatke…“**, istu mapu, postojeću karticu i HALF visinu. Kasniji snimak prikazuje potvrđen **1 zadatak**. Vremena capture-a nisu network latency/P95 merenje.
- Filter **Ovaj vikend** daje pošten prazan rezultat; **Poništi filtere** vraća zadatak.
- Lista se podiže do FULL; spušta prevlačenjem preko sadržaja do mape; pritisak zaglavlja vraća HALF. Nazivi ulica vidljivi su na telefonu. Ovim nije testirana gustina hiljada pinova niti dokazan FPS svih animacija.
- Početna → nastavak AI razgovora vraća prethodnu korisničku poruku, isto potvrđeno mesto i pitanje o broju ljudi. Nema nove AI poruke, objave zadatka ili push slanja u ovoj završnoj proveri. Telefon ostavljen na Početnoj.
- Posle hladnog ulaza direktno u About, Android Back je otišao na launcher (nema prethodnog app backstack-a); QA foreground ograda zaustavila je capture van aplikacije. Ponovni ulaz u Home radi. Ovo nije dokaz pada aplikacije niti popravke ranijeg povremenog About nalaza.

Sirovi PNG/XML, instalacioni log i očitavanje paketa ostaju privatno lokalno. Njihovi hashovi i precizan obuhvat nalaze se u `evidence/android-discovery-pending-20261009/receipt.json`.

## NIJE DOKAZANO

Nema novog kapaciteta backend-a, korisnika/s ili network P95. Odloženi test transport nije spora stvarna mreža. Nema testa hiljada native kartica, svih ekrana, svih animacija, svih push kategorija ili kompletnog dvostranog poslovnog toka. Povremeni ce23 About beli ekran ostaje otvoren dok se ne reprodukuje i dokaže uzrok/popravka. Postojeći NO-GO za store ostaje: pravni dokumenti, izvoz/brisanje, performance/security, produkcioni AAB/potpis/okruženje i ceo povezani put nisu zatvoreni.

## Isporuka i grane

Sveže `gh repo view` očitavanje 09.10. kaže da je `uskocibusiness-boop/USKOCI-EAN` **PUBLIC**. Ranije tvrdnje da oznaka prerelease ili sam taj repo znači privatnu distribuciju ne važe za trenutnu vidljivost. Novi APK se u ovom paketu ne kači na GitHub release; ostaje lokalno i na povezanom telefonu. Sirovi snimci sa nalogom i backend readback ostaju lokalno privatno; verzionisani receipt sadrži samo opis obuhvata i SHA dokaza.

Novi automatski `d0dd6f76` sa UI grane sačuvan je običnim merge-om; nije pregazan force-push-em. Aplikacioni source APK-a ostaje tačno 725be7bd, a kasniji merge/dokumentacija imaju svoj HEAD.

## SLEDEĆE

Povezani AI profil/task edit → prijava više ljudi → izbor → privatni/grupni chat → izmena/otkaz/zamena → završetak/ocena na tačno određenom kandidatu i dva testna naloga. Paralelno zatvarati konkretne pravne i production release uslove iz postojećeg forensic plana; ne otvarati ponovo dovoljno dobre ekrane zbog kozmetike. Automatizacija na 30 minuta ostaje PAUSED.
