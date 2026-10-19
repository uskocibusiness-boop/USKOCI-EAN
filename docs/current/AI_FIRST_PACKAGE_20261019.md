# USKOČI — prvi povezani AI paket, 19.10.2026.

## Opseg
Paket izvora 82991de11676f2ea084e627b7c4d5b1c3b110605 na grani feature/unified-qa-master-20261017. Ovo je isporuka oba AI razgovora i njihovog pregleda, ne završetak cele aplikacije.

## Šta je promenjeno
- Pregled zadatka i radnog profila ne može prekinuti aktivno snimanje, pripremu ili obradu glasa. Čuva se provera stvarnog stanja kontrolera i kada je UI callback star.
- Neposlati tekst ostaje u razgovoru. Pregled jasno objašnjava da taj tekst nije deo potvrđenog server nacrta; nema automatskog slanja ni paralelnog ručnog editora.
- Nezavisna čitanja kataloga izvršavaju se uz ograničenu paralelnost, uz deduplikaciju istih zahteva. Stranice i završna provera verzije ostaju dosledne; nepouzdano ili promenjeno stablo se ne prihvata.
- Stabilna AI pravila prethode dinamičkom kontekstu, dok trenutni profil, razgovor i server činjenice ostaju uključeni. To omogućava bolje iskorišćenje implicitnog cache-a, ali ova proba nije dokazala cache pogodak.
- Obračun razlikuje ulaz, izlaz, razmišljanje i već keširani deo ulaza. Ne sabira isti trošak dvaput. Potpuno primljen odgovor sa neispravnim poslovnim JSON-om i dalje ostavlja trag potrošnje; nepotpun odgovor ne glumi poznat trošak.
- Odluke vlasnika povezane su sa postojećim registrom. Grupni mediji, politika otkaza i ostale šire odluke nisu samo dokumentovanjem proglašene implementiranim.

## DEV
uskoci-ai-interview v107; uskoci-worker-interview v60. Ponovnim čitanjem svih 30 datoteka potvrđen je paritet sa izvorom. Prethodni paketi v106/v59 sačuvani su za vraćanje. Nema nove SQL migracije u ovom paketu.

## Stvarni razgovori
| Proba | Ishod | Trajanje |
| --- | --- | ---: |
| 3D figurica izrađena kod izvršioca, dostava u Srbiji | REMOTE, pošiljka, bez izmišljene lokacije rada kod naručioca | 15,0 s |
| Samo izmena budžeta na 5.000 RSD | Isti razgovor, kategorija i ostali uslovi | 6,1 s |
| Digitalna prezentacija | REMOTE, bez obavezne fizičke predaje/pina | 13,2 s |
| Moleraj koji korisnik naziva online poslom | Objašnjena potreba dolaska; nije spreman pogrešan remote zadatak | 10,5 s |
| Radnik radi 3D figurice, predaja još nepoznata | AI pita da li šalje ili nudi preuzimanje | 12,0 s |
| Radnik potvrđuje samo dostavu u Srbiji | Nema dodavanja preuzimanja ili terenskog rada | 9,8 s |

Šest logičkih poruka koristilo je 12 poziva modela, 124.833 ulazna i 4.119 izlaznih tokena. Interna procena po server evidenciji: 0,109074 USD za ceo uzorak. To nije potvrđen račun provajdera i nije reprezentativna cena svakog budućeg razgovora. Svi izmereni pozivi imaju poznat obračun; cache pogodak nije potvrđen.

**Brzina još nije na cilju.** Raspon 6,1–15 sekundi nije trenutno odgovaranje. Uzorak nije kontrolisano poređenje sa ranijom serijom, pa ne tvrdimo procenat ubrzanja. Sledeći AI paket treba da smanji broj uzastopnih modelskih koraka i nepotrebno ponovljene tokene, uz iste provere klasifikacije.

## Granica razgovor / čuvanje
Pre eksplicitnog čuvanja svih pet otisaka stanja ostalo je isto: katalog, zadaci, veze zadataka, radni profil i veze radnika. Razgovor je menjao samo svoj nacrt i evidenciju rada.
Zatim je normalnim korisničkim RPC-jem, bez service-role poziva aplikacije, sačuvan jedan DRAFT zadatak: 866d7829-c963-480d-b11c-5463c58a1a2c. Budžet je 5.000 RSD, jedno mesto, REMOTE, handoff shippingCountries=[RS]. UUID kategorije je d5e890a0-2502-4901-8803-7462b8ca6d24. Naknadni binder potvrdio je BOUND_NEED_REVISION, dispatchAuthority=NONE i notificationAuthority=NONE.
Radni profil QA naloga je sačuvan kao DRAFT sa opisom 3D izrade i isključive dostave u Srbiji. Nije aktiviran. Zadatak nije objavljen. Ova proba nije end-to-end dokaz matching-a ili push isporuke.
Privremeni AI pristup QA naloga je zatvoren nakon šest poruka. Nalog Miloš i korisnički razgovori nisu menjani.

## Automatske provere
- Lokalni Jest: 621 paket, 13.899 uspešnih testova, 9 postojećih Windows/Bash preskakanja, 0 neuspešnih; 3 snapshot-a prolaze.
- 358 povezanih Node provera prolazi; TypeScript prolazi; current-baseline i kontrola izvornog diff-a prolaze.
- Novi testovi prethodno su reprodukovali zaštitu glasa i prelaza u pregled; nisu uklanjani funkcionalni testovi da bi rezultat postao zelen.
- Jest je pri izlasku upozorio na resurse koji se nisu odmah zatvorili, a potom je normalno završio. To nije razlog za forceExit ili uklanjanje provera.

## APK i fizička provera
APK je izgrađen, kontrolni zbir potvrđen i instaliran sa očuvanim podacima (`adb install -r`). Izvršeni izvor na ekranu O aplikaciji: `82991de11676f2ea084e627b7c4d5b1c3b110605`; ugrađeno ažuriranje `80f4aa06`, preview / uskoci-v1-preview-r1.

SHA-256 preuzetog i ponovo pročitanog instaliranog APK-a: `6430f2fb76440f7f5319096f07178d1426f2ab7cccb9f4f846157ffca25fafa0`. Arhitektura x86_64: **samo za emulator, nije APK za HONOR telefon**.

CI artifakt: 621 paket / 13.908 uspešnih / 0 neuspešnih / 0 preskočenih testova. [Run 39277078099](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39277078099). Regresija i attested APK su preuzeti; poslednji GitHub API status celog run-a je još in_progress, pa završni status workflow-a nije proglašen uspešnim samo na osnovu artefakata.

Fizički provereno:
- Zadatak: razgovor i pregled na 361, 390 i 412 dp, font 1,0 i 1,3; napomena o neposlatom tekstu, dostupna glavna akcija i povratak sa sačuvanom porukom.
- Radni profil: ponovno otvaranje stvarno sačuvanog razgovora; novi nacrt iz sačuvanog profila; pregled, napomena o neposlatom tekstu, skrol do „Izmeni kroz razgovor“ i Back sa sačuvanom porukom. Proveren 361 dp / font 1,3.
- Sačuvana su 22 nova snimka. Pregledana kompozicija, prelamanje napomene i glavne akcije na uskim/širokim i uvećanim prikazima. Ovo nije nova galerija svih ekrana aplikacije.
- Provera voice/review trke ima automatske testove za faze i zadržani callback; ovom native probom nije ponovljena živa glasovna transkripcija.
- Vraćen Android korisnik 0, originalna rezolucija 1264×2728 i density 560; originalni font korisnika 0 je ostao 1,15, QA korisnika 10 vraćen na 1,0.

**Preostali stvarno viđen nedostatak:** olovka „Mesto“ u pregledu zadatka još otvara izbor države i načina rada. To je raniji ručni sloj. Sledeći paket treba da ostavi namensku potvrdu fizičkih tačaka/rute na mapi, a semantičku promenu države/načina izvršenja vrati u isti AI razgovor. Zato nije tačno da su svi ručni ulazi već uklonjeni.

Radni profil u novom QA nacrtu pokazuje da potvrda kategorija još nedostaje; ne obećava matching ni obaveštenja za nepotvrđene usluge. Testni profil je ranije sačuvan samo kao DRAFT, bez aktivnih potvrđenih načina rada. Drugi Save/aktivacija nisu pritisnuti.

## Šta ostaje
1. Uklanjanje preostalog ručnog izbora države/načina rada iz pregleda; ostaje potvrda tačaka na mapi. Merljivo smanjenje AI kašnjenja i tokena; testirati kratke promene, više delimičnih odgovora, promenu usluge i nejasnu geografiju.
2. Regionalna pokrivenost i sve relevantne tačke rute kroz isti model razgovora, čuvanja, matching-a i dispatch-a.
3. Dva naloga od objave do prijave, Dogovora, poruke, push isporuke i otvaranja pravog ekrana.
4. Povezani vizuelni talasi i ostali odobreni tokovi: Dogovori, grupne fotografije/glas, privatna komunikacija vlasnika sa izabranim članom, otkazi, zamena i recenzije.
5. Kontrolisana Android proba pre javne objave. Emulator dokaz nije dokaz fizičkog telefona ili spremnosti za produkciju.
