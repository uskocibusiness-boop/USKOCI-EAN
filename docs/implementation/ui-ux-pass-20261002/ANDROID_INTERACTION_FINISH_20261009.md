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

## Fizički prolaz 517e35ee i uske korekcije (09.10, 21:55–22:12 lokalno)

URADIO: ARM64 QA517 je attestiran i instaliran na vlasnikov HONOR samo install-r. Runtime O aplikaciji pokazuje517e35e, isti UID i firstInstallTime; sesija sačuvana. Nema objave zadataka, izmene profila, brisanja istorije ili slanja poruka. Emulator517 je zasebno izgrađen/attestiran, ne zamena za telefon.

DOKAZAO NA TELEFONU517: postojeća mapa sa nazivima ulica; server predlog za unet naziv zadatka otvara isti pregled; Back vraća mapu; jedan task u FULL pod belim zaglavljem, dalji native scroll sklapa kapsule, povlačenje sadržaja vraća HALF/mapu. Radni profil odmah pokazuje prvo pitanje i Novi razgovor; potvrda/cancel radi bez menjanja profila. Screenshot/XML i logovi su privatni, van javnog repozitorijuma.

NAĐENO, NIJE ULEPŠANO: prvi ulaz u pretragu pokazuje kursor ali ne i tastaturu do dodatnog tapa; FULL ima12dp traku mape iznad belog zaglavlja; sklopljene kapsule ostaju u accessibility stablu pri fractional native stop-u. Moja lokacija spušta listu, ali željeni GPS camera rezultat u ovom prolazu nije potvrđen. Ne tvrdimo da je ceo paket native-završen.

USKE SOURCE KOREKCIJE: input se fokusira jednom tek na Modal.onShow, sa close/unmount zaštitom; belo zaglavlje crta backing kao sibling od vrha mape; paint i accessibility koriste isto zasićenje u poslednjem1dp; Nearby/cluster flight i njegov pending onArea debounce imaju prednost nad dekorativnim detent zoom-om. Privremeni Nearby trag ima samo fiksne faze, limit60, radi isključivo u preview/dev paketu, nikada ne beleži koordinate, unos ili nalog. Ukloniti ga kad se fizički kvar razjasni.

DOKAZAO SOURCE: korekcije native prolaza392PASS/5suite; završna dopuna guard-a i fractional geometrije89PASS/2suite. TypeScript exit0. Širi CI na f201 imao9FAIL/13543PASS, ista9 pada u tri workflow-a. Pregled je potvrdio zastarele nazive/strukturu, preview mock vezan za stari limit1, serialization internog React Fiber-a i shadow regex koji pogađa komentar. Ispravljeni testovi zadržavaju server-count, ownership, no-GPS-call i token zabrane; šest ranije neuspelih grupa prošlo, coordinator/guard završno55PASS. Novi CI i novi fizički APK još treba da potvrde ove korekcije.

SLEDEĆE: izgraditi i instalirati tačan follow-up kandidat; proveriti tastaturu odmah pri ulazu, FULL belinu/a11y i dijagnostikovati Nearby na telefonu. Bez reset-a podataka i bez novog mastera. P5/Location/R20 moraju ponovo biti stvarno zeleni; Play NO-GO ostaje.


## Fizički prolaz4b5 i pronađen HONOR permission prekid (09.10, 22:17–22:33)

URADIO: follow-up4b5 APK instaliran install-r, Runtime About4b5f48c očitan. Prvi tap pretrage sada odmah otvara tastaturu; Android Back zatvara tastaturu i ostavlja pretragu otvorenu. FULL backing sada bez trake mape iznad zaglavlja. Kratka lista podiže/spušta sadržaj i kapsule. Nakon vlasnikove potvrde da prepušta telefon, stvarni tapovi Početna→Zadaci→Dogovori potvrđuju donju navigaciju na oba root ekrana. Raspored je odvojeni full-screen ekran; prethodno neočekivano menjanje ekrana bilo je preklapanje sa vlasnikovim dodirima, koje je on potvrdio. Ne proglašavamo kvar root navigacije iz tog nevažećeg scenarija.

DOKAZAO CI4b5: P5 run37985179185, R20 run37985182906 i Location run37985186356 su SUCCESS. Svaki ima605suite/13559testova PASS i6snapshot-a, TSC PASS. Ciljani delovi225/223/237PASS. Svi rade tačan4b5f48c46e84d1fb43b35a0be30d1fe2138b2dda.

NAĐENO: sklopljeni filteri na4b5 još postoje u Android accessibility stablu. Dva Nearby pokušaja na HONOR-u pokazuju start→locating→background→retired u27–34ms, bez koordinata u tragu; ponovljeno i bez UIAutomator-a. Instalirani ExpoLocation poziva Activity.requestPermissions čak i uz postojeće FINE/COARSE dozvole. To je objašnjenje nepotrebnog permission puta, ne kvar Supabase pretrage. Izvor: node_modules/expo-location/android LocationModule.get/requestForegroundPermissionsAsync i expo-modules-core PermissionsService; API: https://docs.expo.dev/versions/latest/sdk/location/ .

USKE KOREKCIJE POSLE4b5:
- Nearby prvo čita postojeću dozvolu; već odobrena ne otvara permission Activity, a svaka nova namera ponovo proverava stvarni grant. Background/account/timeout zaštite ostaju.
- AI „Ovde gde sam“ prihvata već datu approximate dozvolu bez nepotrebnog traženja precise nadogradnje. Kamera takođe koristi get-first, blocked odmah daje postojeći oporavak, galerija i dalje koristi samo sistemski izbor slika.
- Accessibility sakrivanje čipova premešteno na nesklopiv, netransformisan native roditelj. Reakcija uključuje vlasnika/posetu i mount: novi vlasnik ponovo dobija isti hidden=true, a stari callback se odbija.
- Po novoj vlasnikovoj primedbi, potvrđeno prazna oblast zadržava isti opis tokom novog viewport upita. Čuva se samo descriptor, bez starih handlera, vezan za nalog/filtere. Prvi upit ostaje loading, novi rezultat/greška ga menjaju. Prazan pan ne podiže PEEK u HALF. Broj ostaje označen kao zauzet dok novi rezultat nije potvrđen.

DOKAZAO SOURCE: pogođenih5suite ukupno328PASS kroz završne prolaze (DiscoveryPresentation226PASS, ostala4suite102PASS); dodatni permission/location/media3suite123PASS. Ukupno451pogođeni test PASS; TSC exit0. Ranija2 pada novih testova bila su pristup mockovanom FlatList propu koji mock troši; ispravljeno čitanjem stvarne DiscoveryListState komponente. Nema promene backend-a ili novih zavisnosti.

NIJE DOKAZANO: novi APK posle ovih korekcija tek treba proveriti. Prvo stvarno OS odobravanje lokacije ostaje poseban native scenario; get-first rešava postojeći grant, ne tvrdi automatsko nastavljanje kroz svaki permission dijalog. Nisu dokazani live GPS tokom kretanja, kompletan tok dva naloga, sve push kategorije,40k kapacitet ili store spremnost. Potrebne nove vizuelne dopune i AI-only profil su zabeleženi u postojećem registru/autoritetu, ne predstavljeni kao završeni.
