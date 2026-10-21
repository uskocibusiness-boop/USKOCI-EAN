# Zamena izvršioca — CCP03 DEV dokaz, 21.10.2026.

## Potvrđeno
Paket proverava deo FLOW05 i REQ-05F-07 na DEV projektu leqcwgzvjsxugfgzdmth.
Izvršena je transakcija sa normalnim triggerima, bez isključivanja RLS pravila.
Početna istorija tri izabrana izvršioca i četvrta prijava su sintetički test podaci.

1. Početni zadatak ACTIVE, kapacitet 3/3.
2. Stvarni rpc_cancel_agreement spušta popunjenost na 2/3.
3. Vlasnikov stvarni rpc_select_response bira zamenu: 3/3.
4. Ponavljanje istog zahteva vraća isti Dogovor; nema duplikata.
5. Isti ključ sa promenjenim zahtevom odbija IDEMPOTENCY_KEY_REUSED.
6. Vlasnički reader prikazuje tri SELECTED, preostalo nula.
7. Vlasnik i novi izvršilac preko rpc_get_agreement_workspace vide isti CONFIRMED Dogovor, uz sopstvene dozvoljene akcije.
8. Nova prijava je SELECTED; stara je CLOSED.
9. Bivši izvršilac ne može otvoriti Dogovor zamene: AGREEMENT_NOT_FOUND_OR_FORBIDDEN.
10. Završne tvrdnje proveravaju ACTIVE, tri popunjena mesta, jedan novi Dogovor i jedan selection command.
11. ROLLBACK; zasebna provera CCP02/CCP03 test naloga vratila je nula ostataka.

## Dokazi
- Izvršiv fixture: supabase/candidates/cancelled-candidate-parity-20261021/replacement.rollback.sql
- Rezultat: supabase/candidates/cancelled-candidate-parity-20261021/replacement.result.json
- SHA256 sačuvanog SQL-a: 3c316464ddaaf3b197489b4bea7d1061e5d45ed5d94705f38daf46b65eddb3aa
- Autoritet: aktivni public.rpc_select_response, public.rpc_cancel_agreement i public.rpc_get_agreement_workspace na DEV-u.

Prvi pokušaj postavljanja fixture-a pravilno je odbijen sa PROFILE_LOCATION_REQUIRES_REVIEW jer je JWT claim ostao aktivan tokom pripreme profila. Priprema je premeštena pre impersonacije. Guard nije isključen niti menjan.

## Granice
Ovo je izvršen SQL test sa authenticated ulogom i JWT claimovima; nije signed Auth HTTP ili telefon.
Početna objava/prijava/izbor nisu izvršeni kroz korisnički UI. Deferred creation constraints nisu svi posebno forsirani.
Nisu provereni konkurentni izbori, preklapanje fiksnih termina ili automatsko vraćanje drugih prijava.
Za ovaj slučaj nije bila potrebna nova migracija niti promena serverske funkcije.
Nema novog APK-a ili vizuelnog prihvatanja. FLOW05 ostaje delimično potvrđen.

## Klijentska putanja i nastavak
Vlasnik trenutno iz Dogovora otvara izvorni zadatak, pa njegove kandidate.
Izvršilac otvara svoju prijavu. Povezana ruta nije dokaz izvršenog native toka.
Sledeće: signed dvonaložni prolaz i provera prikaza povratka/izbora zamene, zatim konflikt termina.
Ostale P0/P1 stavke ostaju u MVP_FLOW_AUDIT_20261021.md; ovaj paket ih ne zatvara.

