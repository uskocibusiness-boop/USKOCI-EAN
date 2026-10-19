# AI razgovori — celo aktuelno stablo i potvrđeno vezivanje

Datum: 19.10.2026. Polazni kod: `9a629de8204a25a22001cd30a9e0c5684a18bc1a`, grana `feature/unified-qa-master-20261017`. Kanonski DEV: `leqcwgzvjsxugfgzdmth`.

## Nalog i granica

Oba asistenta treba da pregledaju celo trenutno stablo, postave potrebna pitanja i predlože postojeću uslugu ili smislen novu putanju. Razgovor nije potvrda profila niti objava zadatka. Model ne dodeljuje autoritativni UUID, ne pokreće matching i ne šalje obaveštenja.

## Šta menja ovaj paket

- Uklonjen prompt shortlist od 96 čvorova i granica čitanja od 20 stranica. Svaki potez učitava sve stranice za oba načina rada; verzija i fingerprint moraju odgovarati na svakoj stranici. Sve registrovane sinonime i parent veze dobija isti model koji vodi razgovor.
- Prompt koristi sažetu strukturu `id / parentId / label / modes / aliases`. Puni put ne ponavlja se uz svaki čvor. Ciklusi, nedostajući roditelji, ponovljeni cursor i nepotpuni snapshot nisu prihvaćeni kao celo stablo.
- Uklonjeno ograničenje na šest novih nivoa u modelskom predlogu i u oba klijentska dekodera. Ostaju ograničenja veličine poruke, ispravnosti naziva i resursa, bez tihog odsecanja putanje.
- Tačna postojeća usluga i registrovani sinonim zadržavaju kanonski UUID. AI sme prirodnu formulaciju da svede na tačan isti naziv, uz očuvanje stvarnog obima u opisu; srodna ili šira usluga nije automatski ista sposobnost.
- Nova putanja može sadržati više nivoa ispod postojećeg roditelja ili novu početnu granu. Strukturni nazivi i konkretna usluga na kraju imaju različite uloge; postojeći čvorovi se ne premeštaju ovim paketom.
- Nejasno značenje traži korisničko razjašnjenje. Neispravan ili nepotpun klasifikacioni odgovor dobija pošten status provere, bez zahteva da korisnik ponavlja već date podatke. Finish i map potezi takođe nose aktuelni snapshot predloga.
- Granica potvrde ostaje: privatni nacrt → potpisani pregled → eksplicitno čuvanje/prihvatanje → serverski upis i UUID binding. Objavljivanje zadatka je zasebna radnja.

- Uklonjen dodatni ručni formular načina rada na pregledu radnog profila. Izmena vraća isti conversationId i neposlati tekst. Zastareo/nedostupan katalog nudi osvežavanje potpisanog pregleda bez dodatnog AI poziva. Samo eksplicitni READY prikazuje spremnost povezivanja.
- Sačuvani način rada, ponovo provereni UUID i režim više ne ostavljaju zastarelo AI pitanje kada model pošalje prazan/UNCONFIRMED predlog. Nerešene nove usluge i stvarne promene režima i dalje ostaju vidljive.

## Zatečeno stanje kataloga

DEV je pri čitanju imao 135 kategorija, sve `ESTABLISHED`, bez orphan roditelja i bez duplih naziva pod istim roditeljem. Oba scope čitača vraćala su `CATALOG_CONTEXT`. Stvarni novi loader pročitao je sve kroz tri stranice: 135 čvorova, tri registrovana aliasa, verzija4, dubina3, kompletan prompt21.968 UTF8 bajtova. Nije bilo opravdanja za masovno brisanje ili promenu postojećih UUID-jeva.

## Tehničke granice koje ostaju

„Bez 96“ ne znači neograničena memorija ili tokeni. Čitanje ima 4 MiB / 15 s budžet, a postojeći ukupni LLM request limit je 128 KiB. Prekoračenje se prijavljuje kao neuspeh; ne šalje se skriveno skraćen katalog. Za znatno veći budući katalog potreban je zaseban dokaz navigacije kroz serverske alatke. Novi paket to ne predstavlja kao već implementirano.

Broj ponuđenih usluga na jednom radnom profilu ostaje postojeći ugovor (12 usluga / 24 para sa načinom rada). To nije dubina niti širina kataloga. Za njegovo povećanje treba zajedno uskladiti profil, potpisani pregled i prikaz.

## Dokazi i primena

Status ovog odeljka dopunjava se tek stvarnim rezultatima. Napisano, offline provereno, primenjeno na DEV, izgrađen APK i provera na uređaju nisu ista tvrdnja.

- Offline Node presek pre poslednje integracije: 670/670 PASS; naknadni actual-handler proof pokriva14 scenarija. UI cleanup:134/134 u5 testnih paketa i TypeScript PASS.
- Katalog test obuhvata više od 2.100 čvorova, sve stranice, duboke postojeće grane, sve sinonime, ciklus/orphan i promenu fingerprint-a.
- Klijentski testovi prihvataju potpisan predlog od deset nivoa, a i dalje odbijaju pogrešan krajnji naziv usluge.
- Stare test fixture nesaglasnosti ispravljene uz očuvano ponašanje: razlika između nevažeće prijave i nedostupne Auth provere; stvarni provider schema adapter; eksplicitna srpska vremenska zona sintetičkog primera; istorijski planner ostaje fail-closed.
- Izolovani live QA koristi nov test-world nalog. Ne koristi niti menja Milošev aktivni razgovor. Podrazumevani scenario ima sedam AI pokušaja, maksimalno dvanaest, uz lokalni dnevnik pre mrežnog poziva. Rezervacija nije faktura provajdera.

## Šta ovaj paket ne dokazuje sam po sebi

Ne dokazuje nepogrešivo razumevanje svake slobodne rečenice, plaćanje, isporuku push-a na telefonu, ceo UI redizajn niti završetak marketplace-a. Novi naziv koji pripada postojećoj usluzi ne mora postati nova kategorija da bi test uspeo. Aktivno vezivanje radničkih sposobnosti zahteva odgovarajuću potvrdu aktivnog profila; čuvanje DRAFT profila nije isti dokaz.
