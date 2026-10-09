# Android: pretraga, AI ulaz i povezana mapa/lista

Nastavak postojećih A02/A03/B04/B05, prema neposrednim vlasnikovim zahtevima 09.10. Jedan pisac; tri nezavisna read-only pregleda. Bez nove zavisnosti, backend promene, poslovne politike ili novog mastera.

## URADIO

- Vidljiv **Novi razgovor** u task i worker AI zaglavlju. Task restart traži potvrdu, završava čuvanje, zatvara postojeći OPEN razgovor i proverava kanonski ABANDONED odgovor pre novog ulaza. Stari razgovor nestaje iz nastavaka, ali ovo **nije trajno brisanje istorije**. Poruka to izričito govori. Fotografije, aktivan zahtev, drugi nalog i odlazak aplikacije u pozadinu čuvaju postojeće zaštite.
- **Grad ili zadatak**: stvarni unos, gradovi/mesta filtrirani kucanjem i do pet aktuelnih javnih task predloga iz postojećeg server PAGE ugovora. Prethodno primenjen tekst pretrage ostaje pri izboru grada. Stari odgovor ili zatvoren panel ne otvara zastareli zadatak.
- FULL lista spaja se sa belim zaglavljem. Kapsule se sklanjaju sa native offsetom i vraćaju kod početka; jedna Gorhom lista, bez novog gesture sistema. Kratak/prazan sadržaj ima dovoljno scroll prostora. Native lock, restore, promena geometrije i gubitak vlasništva ne zadržavaju pogrešan offset kapsula.
- **Moja lokacija** prikazuje obuhvat od pet kilometara u svakom smeru, prilagođen vidljivom delu mape. To je kamera, **nije strogi kružni filter udaljenosti**. Detenti liste tiho menjaju zoom u oba smera koristeći istu osnovu; nema kumulativnog udaljavanja. Ručni pan/pinch i novi cilj preuzimaju kontrolu.
- Novi TASK/PLACE pin centrira javnu približnu tačku uz najmanje neighbourhood zoom12; čuva bliži korisnikov zoom. Klaster zadržava postojeći bounds fit. Otvorena pin kartica menja podatke u istom native sheet-u, bez ponovne mount animacije; resetuje svoj unutrašnji scroll. Staro zatvaranje ili stari callback ne zatvara novu karticu.
- U AI lokaciji sam naziv grada, i latinicom i ćirilicom, traži bliže mesto pre mape. **Ovde gde sam** pravi nepotvrđen GPS pin; reverse lookup može dodati adresu, ali ne pomera GPS koordinate niti ih potvrđuje. Eksplicitno **Označi na mapi** može učitati grad samo kao orijentir kamere, bez biranja tačke. Radni profil zadržava postojeće prvo pitanje.

## DOKAZAO — izvor

TypeScript exit0. Završnih 12 pogođenih suite-ova, **887/887 PASS**, bez skip-a; dodatnih sedam ciljanih kamera testova PASS posle uklanjanja čitanja SharedValue tokom rendera. Obuhvat uključuje deset ciklusa zooma bez drifta, TASK/PLACE na udaljenoj mapi, stale podatke/gesture/blur, zamenu kartice tokom zatvaranja, kratak sadržaj, izvorni native-probe settlement bez ponovnog commit-a liste, AI restart sa kasnim odgovorima i GPS/kontekst mesta. Raniji neuspeli prolazi ostaju u lokalnim dokazima; njihove zastarele pretpostavke o kameri i završetku native gesture-a ažurirane su, zaštite nisu uklonjene.

Nezavisni pregled našao je i popravljen je propust grad-u-adresi, ručni grad-kontekst, kratka lista, staro zatvaranje i čekajući P6 fokus posle promene podataka/posete. Ovo su source/unit dokazi, ne merenje native animacije.

## NIJE DOKAZANO

Native prihvat ovog paketa čeka tačan APK i proveru. Nema nove tvrdnje o push kategorijama, potpunom poslovnom toku dva naloga, latenciji/FPS, serverskom kapacitetu, brisanju naloga ili store spremnosti. Postojeći forensic NO-GO ostaje. Web/store ogranci pripremaju dokumentaciju, ali ne daju production erasure ili release artefakt; nisu nasumično spojeni sa ovim UI paketom.

## SLEDEĆE

Izgraditi tačan objedinjeni QA APK, proveriti potpis, instalirati isključivo install-r i proveriti map/list, pretragu, pin zamenu i AI ulaze. Sačuvati stvarne native rezultate u ovom izveštaju i jedinom registru. Automatizacija na30min ostaje PAUSED.
