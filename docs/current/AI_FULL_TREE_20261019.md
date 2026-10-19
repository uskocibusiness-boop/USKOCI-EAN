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

- Završni Node presek AI + dynamic_taxonomy: 672/672 PASS, uključujući 14 scenarija stvarnih handler-a sa zamenjenim provider transportom. UI cleanup:134/134 u5 testnih paketa i TypeScript PASS. Poseban migration integrity presek:13/13 PASS na tačnim Git blobovima.
- Katalog test obuhvata više od 2.100 čvorova, sve stranice, duboke postojeće grane, sve sinonime, ciklus/orphan i promenu fingerprint-a.
- Klijentski testovi prihvataju potpisan predlog od deset nivoa, a i dalje odbijaju pogrešan krajnji naziv usluge.
- Stare test fixture nesaglasnosti ispravljene uz očuvano ponašanje: razlika između nevažeće prijave i nedostupne Auth provere; stvarni provider schema adapter; eksplicitna srpska vremenska zona sintetičkog primera; istorijski planner ostaje fail-closed.
- Izolovani live QA koristi nov test-world nalog. Ne koristi niti menja Milošev aktivni razgovor. Podrazumevani scenario ima sedam AI pokušaja, maksimalno dvanaest, uz lokalni dnevnik pre mrežnog poziva. Rezervacija nije faktura provajdera.

## Šta ovaj paket ne dokazuje sam po sebi

Ne dokazuje nepogrešivo razumevanje svake slobodne rečenice, plaćanje, isporuku push-a na telefonu, ceo UI redizajn niti završetak marketplace-a. Novi naziv koji pripada postojećoj usluzi ne mora postati nova kategorija da bi test uspeo. Aktivno vezivanje radničkih sposobnosti zahteva odgovarajuću potvrdu aktivnog profila; čuvanje DRAFT profila nije isti dokaz.

## Primena 07:44 UTC

Kod `eb2f525b`; PostgreSQL16/17 CI `39217796738`: sva četiri job-a PASS, uključujući pre/post dokaz i tačan rollback/reapplication. DEV ledger verzija `20261019074443` odgovara source migraciji `20261019071732`. Sadržaj svih šest funkcija odgovara migraciji, owner/ACL/search_path očuvani. Edge: worker56, task102, sve datoteke ponovo pročitane i identične poslatom paketu. [Mašinski receipt](evidence/AI_FULL_TREE_DEV_20261019.json).

## Stvarni DEV dokaz 07:57 UTC

Osam stvarnih Gemini odgovora na izolovanom novom test-world nalogu: postojeća usluga za zadatak, nova konkretna usluga, nejasan zahtev, postojeća usluga radnika i dopuna radnika upravo napravljenom granom. Nijedan Milošev razgovor nije korišćen ili menjan.

1. Zadatak za 3D štampu koristi postojeći UUID `d5e890a0-2502-4901-8803-7462b8ca6d24`, REMOTE.
2. Specifično autorsko 3D modelovanje i izrada taktilnih karata dobija CREATE_CHILD predlog. Kategorija `ef63d6d2-7087-4d67-8a9d-b07952655d03` nastaje tek posle eksplicitnog prihvatanja potpisanog pregleda. Nacrt zadatka se vezuje za taj UUID; ostaje DRAFT, publishedAt=null.
3. Nejasan zahtev izaziva pitanje šta konkretno treba uraditi; nema izmišljene kategorije ni spremnosti za čuvanje.
4. Radni AI u sledećem potezu čita katalog verzije5 i koristi upravo nastali UUID, uz očuvanu postojeću 3D štampu. Nije bio potreban redeploy da vidi novu granu.
5. Pre prvog čuvanja svih pet snapshot digest-a (katalog, aktivni radni profil i vezivanja, zadaci i vezivanja) ostaje isto. Posle dopune razgovora radni profil i dalje je DRAFT i nema aktivnih binding-a.
6. Tek zaseban signed Save aktivira probni profil. Observer potvrđuje oba UUID-a, oba REMOTE, active=true i excluded=false. Binder za zadatak i radnika izričito vraća dispatchAuthority=NONE i notificationAuthority=NONE. Objava, stvarni matching i push nisu izvršeni ovom probom.

[Read-only snapshot i binding dokazi](evidence/AI_FULL_TREE_LIVE_20261019.json). Osam rezervacija ukupno2 USD predstavlja konzervativni maksimum, ne stvarnu fakturu.

Tokom probe otkrivena je netačna AI formulacija „Pregled je otvoren“. Task instrukcija sada kaže da model ne otvara ekran već upućuje korisnika da ga otvori. Task Edge103 primenjen i svih10 datoteka tačno pročitano nazad; worker ostaje56. Ovo je naknadna copy ispravka, bez dodatnog plaćenog razgovora.

Prvi APK pokušaj `39218193675` stao je na nedostajuća dva zapisa u migration manifestu. Manifest i provenance dopunjeni stvarnim ledger dokazom; istorijski SQL nije prepisivan. Novi APK / puna regresija slede na tom ispravljenom preseku.
