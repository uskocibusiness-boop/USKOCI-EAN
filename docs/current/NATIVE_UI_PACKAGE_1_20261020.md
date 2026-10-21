# USKOČI — prvi paket prenosa dizajna u stvarnu aplikaciju

Datum: 20.10.2026.

## Stanje

Prvi povezani paket je implementiran u postojećem Expo/React Native klijentu. To obuhvata detalje zadatka iz obe perspektive, formu i pregled prijave, listu kandidata i prikaz pojedinačne prijave. Ovo nije kompletno zatvaranje Master komande, nov izdati APK niti potvrda celog poslovnog toka.

Osnova je grana `feature/unified-qa-master-20261017`, HEAD `70bc79f250b33ae706a068579c3527dfbf297792` i lokalne izmene navedene u evidenciji. Zatečene izmene dokumentacije su sačuvane.

Figma smer: [postojeći dokument](https://www.figma.com/design/nZwxDeRClrrecngX09bimy). U ovom paketu Figma dokument nije dodatno menjan. Preneta je konkretna kompozicija paketa D uz prilagođavanje stvarnim native komponentama.

## Šta je promenjeno

| Oblast | Stvarna izmena | Veza sa kodom |
|---|---|---|
| Iznos | Zajednički prikaz sa jasnim značenjem „Budžet“, „Cena zadatka“ ili „Ukupna ponuda“. Iznos, valuta i osnova ostaju iz postojećeg modela. | `src/ui/system/MoneySummary.tsx`, `tokens.ts` |
| Velika slova | Kod velikog sistemskog fonta ikona se seli uz oznaku; iznos dobija celu širinu. Nema fiksne visine ni skraćivanja iznosa. | `MoneySummary`, postojeći `useLayoutClass` |
| Popunjenost | „0/2 izabrano“, „1/2“, „2/2“, „2/3“, „3/3“ odvojeno od broja prijava. Nepoznat podatak se ne pretvara u nulu. | `src/ui/v2/detail/TaskCapacity.tsx` |
| Detalj zadatka | Kapacitet → budžet/uslov ponude → označeni termin i mesto/način rada. Privatnost javne lokacije i format vremena ostaju u postojećim pravilima. | `TaskDetailSummary`, `TaskDecision`, `NeedPresentation`, `PublicNeedPresentation` |
| Učitavanje | Placeholder prati novi raspored naslova, kapaciteta, iznosa i činjenica. | `Skeleton.tsx`, varijanta `taskDetail` |
| Forma prijave | Jasniji naslov zadatka; originalna ikona novca; pregled sa ukupnom ponudom, ljudima i terminom. | `ApplicationComposerPresentation.tsx` |
| Kandidati | Kontekst zadatka i popunjenost iznad liste; zaseban broj prijava; detalj prijave sa naslovom zadatka, ponudom, ljudima, terminom i porukom. | `ApplicationSelectionPresentation.tsx` |
| Pristupačnost | Označene činjenice imaju objedinjene opise za čitač ekrana; tekst se prelama. | `FactRow.tsx`, `TaskCapacity`, `MoneySummary` |

Originalna 2.5D grafika novca, ljudi, kalendara i lokacije koristi postojeće assete. Kartice u discovery listi i mehanika mape nisu menjane ovim paketom.

Figma komponenta činjenice je preneta proširenjem postojećeg `FactRow`, umesto uvođenjem drugog vlasnika istog izgleda. Time se zadržavaju originalni asseti, pristupačnost i kompatibilnost postojećih ekrana.

## Ponašanje koje je sačuvano

- Ponuda se prvo pregleda, a zatim eksplicitno šalje.
- Promenjena ponuda ili revizija zadatka poništava prethodnu potvrdu.
- Fiksna cena nije slobodno polje za unos druge cene.
- Nepoznat ishod zahteva proveru; ne tretira se kao neuspeh i ne pravi se nova komanda naslepo.
- Izbor kandidata traži potvrdu uslova i koristi postojeću serversku zaštitu kapaciteta i termina.
- Zatvoren zadatak sa preostalim mestima ne dobija dugme za novu prijavu samo zbog broja slobodnih mesta.
- Nema novih backend zavisnosti, statusa, plaćanja ili alternativnog ručnog editora zadatka.

## Provere izvora

- **TypeScript `tsc --noEmit`: PASS.**
- **11 ciljanih Jest grupa / 272 testa: PASS.** Rezultat je u `jest-results.json`.
- Provereni su i postojeći testovi prijave, pregleda, fiksne/srazmerne cene, kandidata, straničenja, nepoznatog ishoda i prikaza detalja. Novi slučajevi obuhvataju pet kombinacija popunjenosti i zatvoren zadatak sa slobodnim mestom.
- `git diff --check`: bez greške razmaka u izmenjenom kodu.
- Ovo nije pokretanje kompletne regresije celog repozitorijuma.

## Stvarni emulator

Lokalni debug APK je izgrađen za `x86_64` i instaliran pomoću `adb install -r`, uz očuvanu sesiju. Kod je ugrađen u APK jer je lokalna Metro veza davala HTTP chunk grešku. To nije OTA ažuriranje ni objavljivanje.

Potvrđeno stvarnim dodirom i snimcima:

1. Početna → postojeći kandidati.
2. Lista sa **jednom prijavom i 0/2 izabrana izvršioca**.
3. Otvaranje prijave, ukupna ponuda, termin, broj ljudi i puna poruka kroz skrol.
4. Otvaranje dijaloga izbora i **Odustani**, bez potvrđivanja izvršioca.
5. Lista kandidata sa fontom 1,3.
6. Otvaranje vlasničkog detalja sa fontom 1,3 na širini 360 dp.
7. Ulazak u postojeću mapu/listu na širini 412 dp.

Važna granica: otvaranje postojeće QA prijave pokrenulo je zatečenu komandu `oznaciPrijavuVidjenom`; prikazana je oznaka „Viđena“. Zato ovaj prolaz nije opisan kao potpuno bez upisa. Nije potvrđen izbor, poslata nova prijava, objavljen zadatak niti menjana serverska funkcija ili šema.

HONOR nije bio povezan. Na aktivnom nalogu svih pet dostupnih zadataka pripada istom korisniku, pa stvarno podnošenje nove prijave drugom korisniku nije provereno.

## Native provera sa probnim podacima

Za nedostupnu perspektivu izvršioca korišćen je odvojen ulaz `scripts/proofs/native-ui-package-1.preview.tsx`. On prikazuje iste produkcione komponente sa lokalnim primerima, bez servisa, korisničke sesije ili komandi za slanje. Nije deo ruta aplikacije. Na svakom njegovom ekranu stoji „VIZUELNA PROBA · bez servera i slanja“.

| Provera | Rezultat | Snimak |
|---|---|---|
| Forma na širini 412 dp | Iznos i ostala polja vidljivi; izvorne 2.5D ikonice | `31-probe-form-ready-412.png` |
| Otvorena tastatura | Fokusirano polje i dugme za pregled dostupni iznad tastature | `32-probe-keyboard-ready-412.png` |
| Izmena i pregled | Uneto `123456`, pregled pokazuje `123.456 RSD` | `33-probe-review-412.png` |
| Povratak iz pregleda | Uneta vrednost `123456` ostaje u formi | `34-probe-review-back-retained.png` i XML |
| Veći font 1,3 | Iznos `125.000 RSD`, naziv ponude i osnova čitljivi; ikona uz oznaku | `36-probe-review-font130-412.png` |
| Detalj za izvršioca | Naslov, `1/3 izabrano`, budžet, termin, približno mesto i glavna akcija | `38-probe-worker-detail-font130.png` |
| Nepoznat ishod | Sažetak ostaje; jedina glavna radnja je provera ishoda. Skrol otkriva pun termin i poruku | `40-probe-unknown-font130.png`, `41-probe-unknown-scrolled.png` |
| Učitavanje | Placeholder prati raspored detalja; povratak dostupan | `42-probe-loading-font130.png` |
| Greška čitanja | Jasna poruka, povratak i dugme za novi pokušaj | `44-probe-error-ready-font130.png` |

Ovo dokazuje raspored i lokalne interakcije. Ne dokazuje stvarni mrežni prekid, uspešnu serversku prijavu, oporavak komande ili kompletan tok sa dva naloga. Ishodi slanja i izbora u ovoj probi nisu izvršavani.

Rani snimci tokom povezivanja Metro-a, pokretanja aplikacije i podešavanja probnog prikaza ostaju sirova evidencija. Za prihvatanje rasporeda koriste se gore navedeni završni snimci. Prvobitna traka probnog prikaza zauzimala je visinu i remetila proveru tastature; pre završnih snimaka premeštena je u overlay izvan layout-a ekrana.

### Završno stanje emulatora

Stvarna aplikacija ovog paketa vraćena je na emulator sa očuvanim nalogom. Snimak `46-product-restored-ready.png` potvrđuje stvarnu Početnu bez probne trake. SHA-256 instaliranog `base.apk` jednak je sačuvanom lokalnom paketu: `4d207ad64fb50e0cf591664c9de785d4b2222de7d9c9f47e14413ad501c218ba`.

U generisane Android izlaze vraćeni su stvarni aplikacioni bundle i APK. Probni ulaz ostaje odvojen pod `scripts/proofs`. Emulator je vraćen na zatečene vrednosti: 1442 × 2728, gustina 560, font 1,3. UIAutomator nije dobio mirno stanje animirane Početne, pa završni dokaz koristi vizuelno pregledan PNG i hash instaliranog paketa; za taj snimak ne postoji uspešan XML dump.

## Šta još ostaje

1. Povezan test sa dva QA naloga: stvarno slanje → prijem → izbor → Dogovor, sa dozvoljenim testnim upisima.
2. Vizuelni prolaz na fizičkom telefonu i kompletna matrica različitih širina, fontova i mrežnih prekida.
3. Sledeći paket: organizacija pretrage i filtera na mapi, jasna odvojenost zadataka na daljinu, očuvanje položaja mape/listе i povratka iz detalja.
4. Potom Dogovori i njihove dozvoljene akcije, privatne/grupne poruke, obaveštenja i deep linkovi, profil, raspored i podešavanja prema istom registru.
5. Zajednička regresija, release build, fizički uređaj i priprema prodavnica tek na odgovarajućem preseku.

Figma prototip se ne pretvara automatski u APK. Ovaj paket predstavlja stvarne izmene postojećih komponenti i njihovih postojećih funkcionalnih veza. Svaki naredni paket prolazi isti postupak: dizajn → postojeći ugovor podataka → native kod → ciljane provere → stvarni prikaz → zapis granica dokaza.
