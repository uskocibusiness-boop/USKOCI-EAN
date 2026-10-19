# Potvrđene odluke vlasnika — 19.10.2026.

**Status odluka: APPROVED_DIRECTION. Dokaz realizacije ovog objedinjenog opsega: PENDING.**

Ovo je datirani dodatak postojećem planu, ne novi master ili registar isporuke. Statusi i dokazi ostaju u [62 toka](../control/redovi.json), a izgled u [Premium White canonu](../implementation/design-system/PREMIUM_WHITE_CANON.md). Odluka o željenom ponašanju ne potvrđuje da ga trenutni klijent, DEV ili APK već podržavaju.

## Poreklo i aktuelna primena

Izvor je vlasnički dokument iz ove sesije, `outputs/USKOCI-20261019/USKOCI-PLAN-ZAVRSAVANJA-ZA-VLASNIKA.md`, uključujući naknadno zabeležene odgovore vlasnika. SHA-256 pročitanog dokumenta: `857c6202480ee4f8b55f956dde89b297c8298882fb39c72b6ef43c475ad2d934`. Njegov planski source presek je `f50413d91c44c8c9648d1bc833e9b728fac75a3a`, `USKOCI-EAN`, grana `feature/unified-qa-master-20261017`.

Naknadni nalog vlasnika pokreće **prvi povezani paket oba AI razgovora na DEV-u i emulatoru**. Zato ranije rečenice izvornog dokumenta „READ-ONLY, bez primene“ ne zaustavljaju taj odobreni posao. Ovaj dodatak ne proglašava širu politiku otkaza, zamene, grupnih medija, istorije ili recenzija implementiranom. Za svaku celinu zasebno beležiti SOURCE, TEST, DEV APPLIED, APK BUILT i EMULATOR; PHONE i RELEASE imaju sopstvene dokaze.

Postojeći datirani testovi i isporuke ostaju važeći u svom ograničenom opsegu. Novi `proofStatus: PENDING` u redovima odnosi se na ovde potvrđeni celovit smer, bez brisanja tih prethodnih dokaza ili podizanja njihovog prihvatanja. Završni integrator upisuje rezultat prvog paketa kada stvarno primeni i proveri tačan izvor. Ovim dokumentacionim korakom nisu menjani proizvodni kod, server, uređaj ili javna objava.

## Izdanje i nalog

- **Srbija, Android, kontrolisana proba pre javne objave.** Najpre završiti tok prijavljenog korisnika. Gostujući probni AI je kasnija celina i nije uslov prvog izdanja; UI ga ne obećava dok ne postoji.
- **Jedna osoba, jedan nalog, obe perspektive.** Isti korisnik može da objavljuje zadatke i da ih izvršava. Nema trajnog razdvajanja identiteta, reputacije ili sesije u dva naloga.
- **18+ za nalog i obe uloge u prvom izdanju.** Uključivanje maloletnika nije deo ovog izdanja. Odluka o opsegu nije već sprovedena provera uzrasta niti tvrdnja da ista zakonska granica važi za svaki mogući proizvod.
- Pravna dokumenta, stvarni operater, srazmerna provera uzrasta i obaveze pre javnog rada ostaju zaseban posao. Zatvorena proba, besplatnost ili oznaka beta nisu dokaz pravne usklađenosti.

Veze: A01, N01, N02, N04, N05, N11, S01.

## AI, pregled i geografija

- Semantičke izmene zadatka i radnog profila idu kroz pripadajući **isti AI razgovor i nacrt**: usluga, opis, cena zadatka, traženi broj ljudi, način i područje rada, raspored i dostupnost. Ne otvarati paralelni običan ručni formular.
- Jedna živa kartica pokazuje razumevanje; **jedan završni pregled**, jedna akcija „Izmeni kroz razgovor“, zatim izričit Save/objava. Nema olovaka uz svaku činjenicu, automatskog Save-a iz razgovora ili lažne potvrde spremnosti.
- Neposlati tekst, delimični odgovori, revizija i vlasništvo ostaju očuvani pri povratku. Neposlata poruka nije deo server pregleda. Neizvestan upis se prvo razjašnjava; ne ponavlja se automatski.
- Mapa ostaje ljudska potvrda konkretne geografske tačke/razrešenja. Identitet, mediji i sistemske dozvole imaju namensku direktnu kontrolu. To nisu alternativni editori budžeta, vremena ili usluge.
- Potvrda mape nije objava. Izrada kod izvršioca sa dostavom/preuzimanjem ne znači dolazak kod naručioca. Regionalnu pokrivenost prikazivati kao funkcionalnu tek kada je isti model podržan kroz Save, readback, matching i dispatch.
- Podaci ponude i broj osoba koje konkretna prijava predstavlja nisu obična izmena zadatka. Njihova direktna kontrola i kapacitet traže zasebno povezano rešenje; ovaj dodatak ne zaključava konačan widget.

Veze: A02, A04, A06, A07, B00, B01, B02, B03, S03. Aktuelno je odobren prvi AI paket; njegova implementaciona i uređajska potvrda vodi se zasebno.

## Glas u oba AI razgovora

- Osnovni tok: **drži mikrofon → govori → pusti → slanje prepoznate poruke AI-ju**, bez obaveznog dodatnog pregleda.
- Diskretna opcija **„Pregledaj pre slanja“** omogućava proveru/ispravku prepoznatog teksta i izričito slanje. Uređuje se poruka, ne poslovna polja.
- Snimanje, prepisivanje, slanje i greška moraju biti istinita i različita stanja. Live transkripcija se ne glumi ako je transport ne podržava. Tastatura i neposlati sadržaj ostaju dostupni i očuvani.
- Automatsko slanje glasovne poruke nije Save radnog profila niti objava zadatka. Pregled ne sme nenamerno prekinuti aktivno snimanje ili obradu.
- Tačna kompozicija, gest otkazivanja i pamćenje opcije pregleda ostaju za razradu i proveru. Ovo pravilo se ne prenosi automatski na audio poruke između učesnika.

Veze: A03, A02, B00, S03. Dokaz celog voice opsega ostaje PENDING; postojeći hold/release i accessibility dokazi ne potvrđuju automatski novu opciju i sve native scenarije.

## Dogovor, privatni i grupni razgovor

- Za objavu sa više izabranih izvršilaca korisnički prikaz je **jedan zajednički Dogovor**, učesnici i grupa. Ovo ne spaja automatski pojedinačne serverske Dogovore, iznose, potvrde, završetke ili otkaze.
- Privatni kanal postoji između objavljivača i svakog odgovarajućeg izabranog izvršioca. Izvršilac vidi svoj kanal sa objavljivačem. **Nema privatnog kanala izvršilac–izvršilac u ovom toku**; njihova komunikacija je u grupi.
- **Fotografije i glasovne poruke u grupi ulaze u prvo izdanje.** Server/media dozvole, upload, slanje, prijem, reprodukcija, oporavak i obaveštenja moraju biti povezani i provereni; prisustvo dugmeta nije dokaz podrške.
- Primaoci/grupa jasno su imenovani. Promena kanala ne prenosi neprimetno tekst ili prilog drugom primaocu. Privatni sadržaj i pojedinačni finansijski uslovi ne prelaze u grupu.
- Kontakt i tačna adresa nisu automatski javni zbog izbora ili Dogovora. Deljenje je svesno, prema važećoj dozvoli i odabranim primaocima. Budući pristup može biti ograničen, ali već pročitani/kopirani plaintext ne može se obećano povući.

Veze: D01, D02, D03, D04, D05, D08, P01, P04, N11.

## Istorija grupnog razgovora

- **Novi ovlašćeni član vidi celu raniju grupnu istoriju i dostupne priloge**, uključujući fotografije i glas. Prijava na zadatak nije članstvo. Pravilo počinje tek potvrđenim serverskim ulaskom.
- Učesnici unapred znaju da njihov sadržaj u grupi mogu videti budući članovi istog Dogovora. To uključuje kontakt/lokaciju koji su svesno poslati grupi, bez otvaranja zasebnih privatnih grantova ili privatnih kanala.
- **Izvršilac koji odustane zadržava read-only istoriju dostupnu do izlaska.** Posle serverske granice izlaska nema novih poruka/priloga, slanja, novih grupnih push obaveštenja ili curenja novog stanja kroz cache, Realtime i deep link.
- Arhivski prikaz jasno se razlikuje od aktuelnog Dogovora. Ne vraća obrisan/povučen sadržaj i ne određuje neograničen rok čuvanja.
- Ponovni ulazak, privatni kanal posle odustajanja i bezbednosno uklanjanje ostaju otvoreni za konkretnu razradu. Dobrovoljni izlazak nije automatski isto što i uklanjanje zbog zloupotrebe.

Veze: D03, D04, D05, D07, D08, P01, P04, N11. Potrebni su pozitivni i negativni dokazi pristupa porukama i medijima na obe strane granice članstva, a ne samo skriven composer.

## Izmena i ponovna objava — samo pre prvog izbora

- Dok nije bilo prijava, izmena ide kroz postojeći AI kontekst, jedan pregled i potvrdu promene objave.
- Kada postoji pristigla prijava, a **nikada još nije izabran prvi izvršilac**, cilj je „Izmeni i ponovo objavi“. AI kreće od postojećih podataka; stara objava važi dok zamena nije potvrđena.
- Potvrđena serverska zamena zatvara staru objavu i njene preostale aktivne prijave, stvara **nov task ID sa vezom na prethodni**, čuva istoriju i pokreće matching prema novim uslovima. Prijave i cene se ne prenose automatski.
- Prethodni aktivni kandidati dobijaju tačno obaveštenje o zatvaranju svoje prijave, čak i kada ne odgovaraju novoj objavi. Zatvaranje nije njihovo odustajanje ili negativna ocena. Novi opportunity push je zaseban, ciljan i deduplikovan događaj.
- **Prvi izbor je trajna granica ovog toka.** Naknadni pad broja aktivnih izvršilaca na nulu ne otključava običnu zamenu sa poništavanjem Dogovora.
- Transakcija, konkurentan izbor/prijava, idempotency, neizvestan ishod, rokovi i značenje ranijeg „sutra“ moraju se proveriti pre primene. Ne ostaviti zatvorenu staru objavu bez nove zbog delimičnog neuspeha.

Veze: A08, A11, A12, A13, A14, B10, P01, P04. Raniji stale KEEP/UPDATE/WITHDRAW tokovi su postojeće ponašanje za proveru migracije, ne drugi paralelni ciljni smer. Ovaj model zamene nije implementiran ovim dodatkom.

## Fleksibilan termin posle izbora

- Kada konkretan dolazak/zajednički rad traži termin, AI može predložiti vreme **unutar već prihvaćenog fleksibilnog okvira**. Potvrđuju svi na koje promena utiče; ostali uslovi ostaju isti.
- Predlog, odbijanje i neodgovaranje ne postaju potvrđen termin i sami ne otkazuju Dogovor. Zadatak kome tačan sat nije potreban ostaje fleksibilan.
- Novi učesnik prihvata tada važeće uslove/termin bez resetovanja tuđih potvrda. Promena jedne nezavisne aktivnosti ne menja tiho ostale.
- Odluka ne daje opštu dozvolu za pomeranje već potvrđenog fiksnog termina, širenje prihvaćenog okvira, obima ili dodavanje trajanja koje nije dogovoreno.

Veze: B12, D02, D06, P01, P04. Za prvo izdanje ne razvijati opšti novi editor prihvaćenih uslova umesto ovog ograničenog cilja. Postojeći serverski ugovor tek treba uporediti i povezano prilagoditi.

## Otkaz, automatsko traženje zamene i završetak

- Otkaz/odustajanje **ne zahteva dozvolu druge strane**. Jasna potvrda posledica, inicijator, vreme, istorija i obaveštenje ostaju. Razlog je podržana dopuna; sam inicijator ne dokazuje krivicu.
- Otkaz jedne saradnje razlikuje se od otkaza celog zadatka. Grupni događaj ne mora otkriti privatni razlog. Drugi Dogovori ne menjaju se tiho.
- Posle potvrđenog odustajanja izabranog izvršioca i oslobađanja mesta automatski kreće **traženje odgovarajuće zamene**, samo kada status, rokovi i ostali uslovi dopuštaju novu prijavu/izbor. Objavljivač se obaveštava i sam bira novu osobu; nema automatskog izbora/ponude.
- Otkazan, završen, istekao zadatak ili druga nedozvoljena životna faza ne pokreću novu potragu. Otkaz celog zadatka mora sprečiti ponovno otvaranje potrage kroz pojedinačna otkazivanja. Matching/push su idempotentni i poštuju preferencije.
- „Zaustavi traženje“ i posebno „Sporazumno otkazano“ ostaju preporuke za razradu, ne zasebno odobreni obavezni novi tokovi. Ne tvrditi saglasnost bez nje.
- Brisanje nacrta, zatvaranje objave i otkaz saradnje ostaju različite radnje. Kada je rad prijavljen kao završen, običan otkaz/brisanje ne služi za zaobilaženje potvrde završetka ili prijave problema.
- **CANCELLED nije COMPLETED.** Otkaz ulazi u istoriju, bez računanja uspešno realizovanog posla; može postojati delimično obavljen rad i zaseban problem. Otkaz ne dokazuje ni isplatu ni da rada nije bilo.

Veze: A14, A15, D01, D02, D07, D10, D11, P01, P04, S03. Šira politika ostaje PENDING za implementaciju i stvarne probe; prvi AI paket je ne primenjuje.

## Javni profil, reputacija, portfolio i novac

- Kvalitetan javni profil i recenzije ulaze u prvo izdanje. **Portfolio/galerija primera radova i značke odloženi su.** Fotografija identiteta ili prilog iz četa ne postaje automatski portfolio.
- **Javne zvezdice i komentari samo posle potvrđenog završetka Dogovora**, uz pravo ovlašćene druge strane. Otkazani Dogovor zadržava istoriju i „Prijavi problem“, bez javne recenzije otkaza ili automatskog negativnog proseka.
- Broj završenih saradnji mora voditi na isti potvrđeni skup. Objave, pojedinačni Dogovori i uloge se ne sabiraju proizvoljno. Konačni nazivi uloga, kompozicija profila i precizne metrike ostaju za razradu.
- **Plaćanje posla je van aplikacije.** USKOČI ne prima, ne drži i ne prenosi novac. Prikazuju se budžet, ponuda/dogovoreni iznos i stvarni status; završetak nije potvrda isplate. Nema checkout-a, novčanika, escrow-a ili tvrdnje „Zarađeno“ bez takvog dokaza.
- Potvrđen poslovni opseg pre registracije: bez prihoda za vlasnika kroz proviziju, pretplatu, plaćene objave, oglase ili sponzorstvo. To ne određuje budući model i ne predstavlja pravno izuzeće. Namera vlasnika u vezi operatera ostaje predmet konkretne pravne provere, bez tvrdnje dozvoljenosti javnog rada.

Veze: A12, B08, D01, D02, D12, N04, N05, N11.

## Kako se ove odluke zatvaraju

Postojeći paketi i **devet UX talasa** ostaju redosled rada; ovaj dodatak ne dodaje novu glavnu listu. Prvi AI paket ide kroz ciljane provere, DEV readback, odgovarajući APK i emulator. Za sledeće politike traži se povezan ugovor, implementacija, odgovarajuća regresija i stvaran ograničen scenario.

Posebno nedostaju objedinjeni dokazi: media/istorija grupe sa ulaskom i izlaskom člana; pre-first-selection transakciona zamena; potvrda fleksibilnog termina pogođenih strana; otkaz/zamena sa negativnim životnim fazama; javni profil/recenzije i 18+ opseg. Oni ostaju u relevantnim postojećim redovima sa `proofStatus: PENDING`. Dokumentaciona konsolidacija nije prolaz tih testova, pravna potvrda, javni release ili novo telefon prihvatanje.
