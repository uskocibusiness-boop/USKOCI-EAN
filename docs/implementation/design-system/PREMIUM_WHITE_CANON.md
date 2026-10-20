# USKOČI — Premium White

**Aktivan vizuelni i UX canon · 18.10.2026.**

Ovo je jedini aktuelni canon izgleda i organizacije ekrana. Primenjuje poslednju odluku vlasnika: disciplina, preglednost i osećaj kvaliteta kao referenca najboljih potrošačkih aplikacija, uključujući Airbnb, uz originalan USKOČI identitet. Ne kopiraju se tuđi logo, ilustracije, paleta, tekstovi niti konkretna kompozicija. Foundation ovog canona je odobren za primenu. Opisi željenog proizvoda nisu potvrda da ih instalirani APK ili server već podržavaju. Ovo nije drugi statusni plan: status ostaje u `docs/control/redovi.json`, postojećem LIVE planu i [aktuelnom fizičkom preseku](../../current/CURRENT_BASELINE_20261018.md).

## 1. Autoritet i tri vrste pravila

Najnovija odluka vlasnika → `AGENTS.md` → ovaj canon za dizajn. Izvršavanje poslovnih i bezbednosnih pravila dokazuje aktuelan kod/server. Numeričke vrednosti boja, tipografije, razmaka, radijusa i motion-a žive u zajedničkim tokenima; proza i stari screenshot nisu drugi numerički izvor.

| Klasa | Šta znači | Šta se radi sa testom |
| --- | --- | --- |
| **OBAVEZNA_ZASTITA** | Pristupačnost, privatnost, autorizacija, stvarno stanje, očuvanje rada, potvrda i bezbedna interakcija | Čuva se dokaz ponašanja; može da se promeni implementacija testa |
| **EVOLUIRAJUCA_SMERNICA** | Hijerarhija, gustina, vizuelna porodica, centralni tokeni, primerena animacija | Razvija se uz povezani UI i proveru čitljivosti/upotrebljivosti |
| **ZASTARELI_FREEZE** | Tačna stara boja, položaj, broj crteža, zabranjena varijanta kartice ili stari obavezni tok | Povlači se kao autoritet; u mešovitom testu ostaje funkcionalna zaštita |

[Forenzički registar](DESIGN_CONSTRAINT_REGISTRY_20261018.md) i [mašinski zapis](DESIGN_CONSTRAINT_REGISTRY_20261018.json) vezani su za Git `eaa38a04e20be24bba71840660493b634180ee72`, pre ovog paketa. Linije su iz tog snimka. Registar nije naredba da se uklone celi testovi i nije nova allowlista koja sme samo da se smanjuje. Istorijski dokumenti ostaju dostupni kao poreklo; njihove reči „locked“, „current“, „must“ i „owner-approved“ odnose se na njihov datum.

## 2. Identitet i vizuelne osnove

- Belo je osnovno platno, taman tekst nosi sadržaj. Duboka zelena i topla narandžasta nose USKOČI identitet. Pomoćne semantičke boje razlikuju informaciju, pažnju, problem i potvrđeni uspeh.
- Zelena ilustracija ili brend dugme sami po sebi ne znače da su podaci provereni. Potvrđenost mora imati stvarni podatak i jasan tekst/status. Nacrt nikada ne izgleda kao već objavljen ili sačuvan rezultat.
- Kartice mogu biti bele, blago tonirane, uokvirene, podignute ili sa fotografijom. Ne postoji zabrana boje, senke ili ugnježdenog informativnog bloka sama po sebi. Materijal sledi svrhu, a ekran zadržava jasnu hijerarhiju.
- Inter je sadašnja radna tipografija. Uloge naslova, teksta, pomoćnih činjenica, cene i komandi dolaze iz tokena. Veličine i težine smeju da evoluiraju; smisleni tekst, dijakritika i brojevi moraju ostati čitljivi.
- Razmaci i radijusi formiraju porodicu, ne jedan kalup. Kompaktna stavka, velika hero kartica, fotografija, ulazno polje i sheet ne moraju imati isti radijus.
- Narandžasta je dozvoljena i kao sekundarni deo dvobojne ilustracije i prepoznatljiv brend akcenat. Nije ograničena samo na broj obaveštenja. Tekst i informativni simboli imaju odgovarajući kontrast u stvarnoj kombinaciji površine i tona.

Kod je numerički izvor: `src/ui/system/tokens.ts`, `layout.ts`, `textScale.ts` i motion tokeni zajedničkog sistema. Nazivi postojećih API-ja mogu ostati radi kompatibilnosti; to ne zaključava njihove stare brojeve. Razvoj ne uvodi paralelnu „v6“ paletu ili kopiju celih ekrana.

## 3. Ikone, fotografije i logo

**Sadržaj:** originalne dvobojne 2.5D ilustracije u zelenoj i toploj narandžastoj, uz neutralne i semantičke detalje. Dubina dolazi iz jasnih velikih oblika, diskretne senke i doslednog svetla. Ne iz tačnog starog broja SVG čvorova. Na malim veličinama koristi se čitljiv pojednostavljen rez istog značenja.

**Kontrole:** strelica, zatvaranje, filter, pretraga, slanje i glavna navigacija pripadaju doslednoj jasnoj porodici kontrolnih glyph-ova. Donja navigacija koristi jednostavne prepoznatljive simbole sa nazivima; bogate 2.5D ilustracije pripadaju sadržaju gde pomažu prepoznavanju namere. Dodirni prostor je veći od samog crteža. Akcija ima razumljivo dostupno ime; dekoracija se ne čita dva puta.

**Najnovija ispravka vlasnika 20.10.2026:** donja navigacija treba da bude svetla, mirna i sa jednostavnijim ikonama. Prethodna dozvola za tamno šumsko-zeleno sidro je povučena; prethodni izgled ostaje samo istorijski APK dokaz. Sve boje dolaze iz `sys.navigation`: svetla površina, čitljiv neutralan neizabrani naziv/simbol i blago zeleno označen izbor. Izbor se prepoznaje i po obliku simbola i dostupnom stanju, a ne samo boji. Nazivi rastu sa sistemskim fontom; dodirna površina ostaje dovoljno velika i kada se crtež smanji. Jedan simbol po odredištu i bez ponovnog animiranja pri refresh-u. U sadržaju plavi avion može predstavljati prijavu; cenovna etiketa ostaje budžet/traženje ponuda. Boja i materijal prate značenje. Konačna kompozicija ekrana i stvarno prihvatanje celog toka imaju svoje odvojene dokaze.

**Stanje:** potvrda, upozorenje i greška imaju tekst i oblik, uz boju. Kalendar, daljinski rad, lokacija ili alat ne nose kvačicu koja bi izmišljala saglasnost ili verifikaciju. Generička ilustracija alata nije dokaz da ih korisnik poseduje.

Logo i wordmark moraju biti oštri, pravilno kadrirani i bez odsečenih delova na različitim gustinama. Izvor, licenca i originalnost resursa ostaju proverljivi. Bajtovi arhiviranog originala mogu biti zaštićeni kao poreklo; aktuelan adapter nije dužan da ponovi stari HTML raspored, putanju ili crop. Novi asset dobija svoju evidenciju. Bez skripti ili nepouzdanog sadržaja u SVG-u.

Stvarne fotografije imaju stabilne proporcije, razumljiv prikaz preostalog broja, loading/retry i povratak na bezbedni placeholder. Ne crtati lažne korisničke fotografije, ocene ili sadržaj zadatka radi popunjavanja kartice.

## 4. Jedan nalog i glavna organizacija

Jedna osoba može i da objavljuje zadatke i da radi. Nema dva odvojena profila za prijavu niti obaveznog globalnog prebacivanja uloge. U konkretnom zadatku/prijavi/dogovoru prikazuje se odgovarajući odnos te osobe.

Četiri poznata glavna odredišta su **Početna, Zadaci, Dogovori i Poruke**. Profil i obaveštenja su jasni ulazi iz zajedničkog zaglavlja. „Moji zadaci“, „Moje prijave“, nacrti i kalendar ostaju dostupni iz svog smislenog konteksta. Ovo je organizacija funkcija; ne zaključava tačan oblik donje navigacije, broj piksela ili njen broj kopija ikone.

Povratak vraća filtere, položaj liste i mapu gde je korisnik bio. Deep link i obaveštenje otvaraju autorizovani objekat istog naloga. Zatvoren, obrisan ili nedostupan cilj pokazuje pošteno stanje i put nazad. Nikakva dizajnerska promena ne daje pravo na prijavu na sopstveni zadatak ili na tuđe privatne podatke.

## 5. Ulaz, prijava i Početna

Ulaz treba da stane pregledno na običan ekran, uz bezbedan scroll kada tekst ili ekran to zahtevaju. Logo je kvalitetan i miran nakon kratkog uvoda. „Prijavi se“ i „Registruj se“ su vidljivi i dostupni, bez čekanja dekorativne animacije. Željeni gostujući tok dozvoljava probni AI nacrt uz očuvan prelazak na prijavu i eksplicitnu objavu. Audit 18.10. nije našao takav proizvodni tok: trenutni ulaz vodi u registraciju, a `/nova` zahteva prijavu. Ne nuditi „probaj bez naloga“ ili „1-klik prijavu“ dok stvarni ugovor i ponašanje to ne podrže.

Početna daje dve jasne namere: **Objavi zadatak** i **Uskoči i zaradi**. Njihova težina i veličina mogu biti različite, ali obe moraju biti razumljive. Radar pripada kartici „Uskoči i zaradi“ prema ispravci vlasnika; može imati kratko smisleno kretanje uz aktivan ekran, bez stalnog ometanja drugih sadržaja.

Ispod su samo korisne stvarne stavke: nastavi nacrt/razgovor, aktuelni zadaci, moje obaveze ili ono što čeka odluku. „Zadaci za mene“ se prikazuje tek za stvarno potvrđenu personalizovanu preporuku; postojeći pregled javnih zadataka bez sopstvenih nije dokaz matching-a. Ne vraćati opštu „Bezbedan dogovor“ promotivnu karticu kao obavezni blok. Prazni odeljci, ponovljene prečice i statistike bez vrednosti ne zauzimaju pola ekrana. Redosled se menja prema relevantnosti, bez izmišljanja događaja.

## 6. AI razgovor za zadatak

Korisnik opisuje potrebu prirodno. AI čuva delimične odgovore, povezuje prethodni kontekst i pita samo ono što je potrebno za odluku ili bezbednu objavu. Jedno do nekoliko kratkih povezanih pitanja može biti primereno; test ne zaključava „uvek tačno jedno pitanje“.

Tok: opis → korisno razjašnjenje → jedna sažeta živa kartica razumevanja → **jedan pregled** → **eksplicitna objava/čuvanje**. Razgovor služi opisu i ispravci; živa kartica pokazuje tekući nacrt, a završni pregled potvrđuje konkretnu reviziju. Na pregledu je jedna zajednička akcija **„Izmeni kroz razgovor“**, bez olovaka i zasebnih „Izmeni“ uz svaku činjenicu, bez drugog paralelnog pregleda i ručnih formulara. Ne zatrpavati svaki odgovor celom karticom niti sakrivati composer ispod velikog hero bloka. Primenu jedinstvene akcije, preostali opseg mape i stvarni APK dokazuje aktuelni presek; sam canon nije dokaz isporuke.

Izmene opisa, vremena, cene, broja ljudi, načina i područja rada idu **kroz AI razgovor**. Jedinstvena akcija „Izmeni kroz razgovor“ vraća isti vlasnički razgovor, nacrt i kontekst, uz očuvan neposlati tekst i reviziju; ne otvara paralelni ručni formular niti automatski šalje tekst umesto korisnika. Interna tema može da usmeri razgovor bez nove spoljne olovke po činjenici. AI predlog nije potvrda. **Rok za prijave ostaje vidljiv bez običnog ručnog editora u lokalnom AI-only kandidatu:** AI izmena tog posebnog polja zahteva povezan backend ugovor koji još nije isporučen. Rok za izvršenje nije rok za prijave. Ne vraćati stari ručni editor niti predstavljati taj cilj kao već puštenu AI funkciju.

**Mapa ostaje ljudska potvrda.** Ta potvrda ograničava se na razjašnjene tačke i stvarnu dvosmislenost; nije paralelni formular za ručnu promenu načina rada, regije, rute ili broja stajanja. `NeedLocationForm` potvrđuje samo već razjašnjene tačke: država, način rada, javni opis, broj/redosled stanica i privatne napomene ostaju iz razgovora. Provera čuva reviziju i priprema isti završni pregled; stara ruta `mesto-zadatka` samo preusmerava na taj pregled. Tačan nivo DEV/APK/native provere čita se u aktuelnom registru. Za terenski rad AI razjašnjava stvarno mesto ili rutu, a korisnik proverava i potvrđuje tačku/tačke. Za udaljenu izradu sa slanjem ili preuzimanjem ne traži se kućna lokacija samo zato što je pomenut grad. Javna kartica ne dobija privatnu adresu iz vlasničkog pregleda.

Promena poruke, stare revizije, nepoznat ishod i oporavak imaju jasne poruke. Nema duplog automatskog slanja, lažnog „sačuvano“ ili brisanja neprosleđenog teksta. Zatvoren sačuvan razgovor je istorija, bez aktivnog nacrta koji poziva na ponovni upis.

## 7. AI radni profil i pokrivenost

Razgovor obuhvata stvarno ponuđene usluge, način rada i područje kada je terensko. Dostupnost se pita kada pomaže konkretnom toku. Alati, vozila, iskustvo i jezici nisu obavezan upitnik niti se pominjanje kombija pretvara u ponuđenu uslugu prevoza.

Svaka usluga može imati svoj potvrđeni način rada. Promena biografije ne menja REMOTE u ON_SITE niti dodaje oba moda iz kataloga. Nepoznata ili nova usluga se jasno prikazuje kao još nerazjašnjena, bez lažne zelene potvrde. Interni ID-jevi, taxonomy tier i shadow status nisu potrošački tekst.

„Novi Sad“, „Novi Sad i okolina“, „cela Vojvodina“, „cela Srbija“ i ruta nisu isto. AI predlaže tumačenje i korisnik potvrđuje. UI sme da prikaže regionalno pokrivanje kao sačuvano tek kada isti potvrđeni model koriste upis, ponovno otvaranje, matching i dispatch. Tekst regiona sam ne dokazuje funkcionalnost. U preseku 18.10. klijentski ugovor još sadrži državu, grad, radijus 1–200 km i približnu tačku; nema potvrđen region/poligon, više centara ili country-wide pokrivanje. To je otvorena zajednička AI/server/client celina, ne obećanje prompta.

Sačuvani profil je pregled, sa jednom jasnom akcijom **Izmeni kroz razgovor**. Završni pregled radnog profila takođe ima jednu zajedničku AI izmenu, bez olovaka po grupi činjenica. Usluge, načini, pokrivenost i dostupnost menjaju se AI putem uz pregled i Save; nema paralelnih ručnih slidera radijusa i editora radnog vremena. Potvrda mape, izbor između nejasnih lokacija, dodavanje medija, prijava i sistemske dozvole ostaju direktne ljudske kontrole. Ova odluka ne pretvara lozinku, kontakt ili privatnost u neautorizovan AI upis.

Javni profil prikazuje samo dozvoljene stvarne podatke. Nema duplih alijasa kao dve kompetencije, izmišljenih ocena, nepostojeće verifikacije ili radijusa uz isključivo udaljenu uslugu. Razgovor, nacrt i sačuvani javni profil moraju se vizuelno razlikovati.

## 8. Zadaci, mapa i filteri

„Na terenu“ i „Na daljinu“ su jasno razdvojeni. Mapa predstavlja fizičku geografiju; udaljeni zadaci imaju smislen listovni prikaz i ne dobijaju izmišljene pinove. Jedan prostor filtera objedinjuje pretragu, budžet, ponude i relevantna ograničenja; aktivni filteri se vide i lako resetuju.

Kada ima mnogo zadataka, mapa koristi grupisanje, razumljive brojčane klastere, stabilan izbor i ograničen broj vidljivih objekata. Otvaranje klastera, kompaktni preview i puna lista moraju ostati dostupni. Lista i mapa dele kriterijume i iste bezbedne podatke; pomeranje kamere ne pokreće nekontrolisan niz zahteva. „Pretraži ovu oblast“ je primer jasne namere, ne obavezna formulacija.

Pin preview sadrži minimum potreban za sledeći korak i vodi u pun detalj. Uvećan tekst može da skroluje unutar ograničenog preview-a uz stalno dostupno zatvaranje; stara apsolutna zabrana unutrašnjeg scroll-a ne sme da sakrije sadržaj. Pun detalj ostaje pravo mesto za dugu odluku.

## 9. Porodice kartica

Jedna porodica delećih komponenti, više jasnih uloga. Ista kartica ne znači identičnu strukturu za naručioca i radnika.

| Porodica | Prioritet sadržaja | Radnja i ograničenje |
| --- | --- | --- |
| Namere na Početnoj | Jasna korist, kratka radnja, originalna ilustracija | Otvori razgovor ili pronalaženje rada; bez izmišljene aktivnosti |
| Nastavak nacrta/AI sažetak | Razumevanje, nedostajuće činjenice, stanje nacrta | Nastavi/pregledaj; nacrt nema stvarne prijave ili status objave |
| Zadatak u otkrivanju — radnik | Šta, cena/ponude, gde ili remote, kada, preostala mesta, stanje moje prijave, stvarni naručilac i dostupna reputacija | Detalj/prijava prema pravima; nema privatne lokacije, izmišljene ocene ili obaveštenja da sam prijavljen pre server potvrde |
| Moj zadatak — vlasnik | Stanje objave, preostala mesta, stvarne prijave i sledeća odluka | Nastavi nacrt, vidi kandidate, odgovori prijavljenoj osobi ili zatvori pretragu. „Ponovo traži ljude“ samo kada server dopušta novo traženje preostalih mesta; ne poništava postojeće dogovore |
| Pin/klaster preview | Naslov, javno mesto, cena, vreme, raspoloživost | Otvori detalj/listu; zadrži kameru i filtre pri povratku |
| Detalj zadatka | Opis i stvarni mediji, uslovi, cena, vreme, mesta, javna geografija | Jasna kontekstna radnja; istek i stale stanje vidljivi |
| Kandidat — naručilac | Osoba, njena stvarna ponuda, obuhvat ljudi, termin i poruka | Pregled i izbor tačne revizije, bez izmišljene reputacije |
| Moja prijava — radnik | Zadatak, status, poslata ponuda i sledeći korak | Promena/odustajanje/dogovor prema serveru, očuvana istorija |
| Aktivan Dogovor u listi | Zadatak i druga strana, prihvaćeni uslovi, sledeća obaveza i čiji se odgovor čeka | Otvori svoj dogovor i sledeću dozvoljenu radnju; ne mešati predlog sa prihvaćenim stanjem |
| Završen/otkazan Dogovor | Ishod, stvarno vreme i objašnjenje, dostupna istorija i ocena kada je dozvoljena | Čitaj istoriju/oceni prema pravima; nema aktivne komande koja izgleda kao da posao još traje |
| Sidro zadatka u četu | Kratak naslov, kontekst, mesta i pristup uslovima | Otvori/sažmi detalje; ne guši istoriju ili composer |
| Predlog izmene dogovora | Šta se menja u odnosu na prihvaćeno | Prihvati/odbij tačnu verziju; stari dogovor ostaje do odluke |
| Profil/javna osoba | Identitet i stvarne usluge/reputacija | Vlasniku AI izmena, drugima samo dopuštene javne radnje |
| Status timeline | Događaj i stvarno vreme, akter kada je dozvoljen, prihvaćeno naspram predloženog | Otvori relevantan detalj; redosled ne izmišlja izvršene korake ili potvrde |
| Individualna poruka | Druga osoba, kontekst zadatka/dogovora, pošiljalac, poslednja poruka i nepročitano | Otvori dozvoljen privatni kanal; sačuvaj istinit ishod slanja |
| Grupna poruka | Naziv/konkretan kontekst grupe, stvarni učesnici i ime pošiljaoca uz poruku | Članstvo i privatni podkanali ostaju razdvojeni; nema tuđih poruka ili podataka van dozvoljenog kanala |
| Obaveštenje | Koji događaj, za koji objekat, nepročitano stanje | Otvori autorizovani cilj; unknown delivery nije delivered |
| Raspored/obaveza | Koji dogovor, stvarno vreme, status | Detalj obaveze; izmena radne dostupnosti ide kroz razgovor |
| Sistemsko stanje | Konkretan razlog i korisni sledeći korak | Prazno, filter bez rezultata, greška, offline i nepoznat upis nisu isto |

**Iznosi imaju precizan naziv.** Budžet zadatka, predložena cena prijave i prihvaćena cena dogovora su različiti podaci. Navesti valutu i osnovu (ukupno / po osobi) kada je poznata; nedostajuću staru osnovu ne pogađati. Podeljeni prikaz mora objasniti zaokruživanje kada zbir delova nije jednak ukupnom budžetu. Dogovoreni iznos nije dokaz isplate: bez evidencije plaćanja nema „Zarađeno“ niti izmišljene statistike prihoda. Ocena, završenost i verifikacija prikazuju samo stvarno dostupne podatke; nedostupno nije nula.

Prikaz mesta razdvaja broj osoba koje jedna prijava pokriva od ukupne popunjenosti zadatka. Na primer, „3 osobe“, „3 od 5 mesta popunjeno“ i „2 slobodna mesta“ imaju odvojeno značenje; ne ponavljati tri skoro iste brojke bez konteksta. Brojevi dolaze iz važeće projekcije.

## 10. Dogovori, razgovori i privatnost

Dogovor vodi prihvaćenim uslovima i sledećom stvarnom radnjom. Zadatak, učesnici i termini su dostupni bez pretvaranja četa u formular. Vlasnik vidi izbor i raspodelu za svoj zadatak; radnik vidi svoj obuhvat i uslove. Više učesnika, grupni razgovor i privatni kanali nisu jedan bilateralni čet sa dodatnim avatarima.

Pre dogovora javna pitanja i prikaz ne otkrivaju privatni broj, punu adresu ili podatke drugih prijavljenih. **Sklapanje dogovora samo po sebi ne otkriva adresu ili telefon.** Korisnik svesno bira šta deli i sa kim. Postojeći server ima eksplicitne smerne dozvole: osoba deli svoj telefon drugoj strani, a naručilac tačnu lokaciju konkretnom radniku. Željeni ulaz u četu koristi taj ugovor i jasno prikazuje primaoca, sadržaj i opoziv; strukturisana kartica deljenja u četu nije proglašena isporučenom.

Pristup zavisi od važećeg dogovora, konkretne dozvole i prava. Novi član ne nasleđuje tuđe bilateralno deljenje; grupni razgovor nije zajednički trezor svih adresa i telefona. Opoziv ili otkaz prekidaju buduća dozvoljena otkrivanja prema serveru. **Ne mogu povući ono što je primalac već video, kopirao, fotografisao ili dobio kao običan tekst/sliku/glas u istoriji.** Slanje sirovog broja ili adrese kao obične poruke nije zamena za opozivu dozvolu. Istorija poruka posle otkaza i prava na medije proveravaju se zasebno. Sama zelena kartica, avatar ili otvoren chat ne dodeljuju pristup.

Slanje poruke ima vidljiv pending, confirmed, failed i unknown ishod. Unknown najpre proverava rezultat, bez slepog ponovnog slanja. Zatvaranje i povratak ne brišu neposlato. Istorija ne skače na dno dok je korisnik namerno čita; „Najnovije“ vraća kontrolu. Tastatura i sistemska traka ne pokrivaju slanje.

## 11. Profil, obaveštenja, podešavanja i ostali tokovi

- Profil je jedno mesto za lični identitet, radne usluge i javni pregled. Put do radnog razgovora i povratak na sačuvano su očigledni.
- Obaveštenja prikazuju stvarne događaje, stanje čitanja i bezbedan cilj. Podešavanja imaju grupisane razumljive opcije; trajna zabrana ili dozvola ne zaključuje se iz neuspešnog mrežnog čitanja.
- Kalendar prikazuje stvarne dogovore i potvrđenu dostupnost. Ne dodaje se obavezni zaseban ručni kalendarski wizard.
- Podrška, prijava problema, privatnost, saglasnosti, izvoz i zatvaranje naloga ostaju dostupni. Opasne radnje imaju posledicu i potvrdu kada je potrebna; dizajn ne tvrdi pravnu ili operativnu spremnost bez dokaza.
- Ocene, HITNO, mediji, glas i verifikacija prikazuju stvarnu dostupnost. Stari datum „nije implementirano“ ne drži ih zauvek ugašenim, a novi crtež ih ne uključuje sam.

## 12. Materijal i zajednički API

`Surface` razdvaja ulogu, materijal, ton, gustinu i interakciju. Postojeći `record`, `panel`, `float`, `note` ostaju kompatibilni; `hero`, `media`, `inset` podržavaju druge uloge. Materijali `flat`, `outlined`, `elevated`, `tinted` ne menjaju autorizaciju niti automatski prave dugme.

Cela površina sme biti klikabilna ako predstavlja jednu jasnu radnju. Ako sadrži više komandi, spoljni kontejner ne krade njihove dodire niti pravi dvostruka čitanja. Pasivni inset unutar kartice je dozvoljen; ugnježdene aktivne komande zahtevaju eksplicitnu semantiku i dokaz interakcije. Ne praviti automatski karticu oko svake činjenice.

## 13. Motion i odziv

Kodna mapa motion-a je `src/ui/system/motionTokens.ts`: `press`, `feedback`, `content`, `navigation`, `sheet`, `assistant`, dostupno kroz `sys.motion.categories` i `getMotionPreset`. Preset bira vrednosti; sam ne pokreće animaciju niti povezuje lifecycle. Komponenta i dalje prati zajednički Reduce Motion, fokus i AppState/cancel. Stari flat ključevi mogu ostati kompatibilni aliasi.

Pokret ima svrhu: dodir, promena izbora, ulaz/izlaz, premeštanje fokusa, odgovor sistema ili kratki izraz identiteta. Tokeni razlikuju te uloge; ne nameće se isti spring, curve ili trajanje svakom elementu. Nijedna dekoracija ne odlaže stvarnu radnju ili izmišlja uspeh.

Koristiti efikasnu native animaciju gde odgovara. Transform i opacity su dobar podrazumevani put, ali stara univerzalna zabrana drugih mehanizama nije dizajnerski zakon. Promena rizičnog mehanizma traži dokaz baš za njegov runtime rizik, bez ponovnog uvođenja ranijeg remount/renderer problema.

Petlje se zaustavljaju van fokusa i u pozadini. Reduced Motion odmah daje razumljivo statično stanje; ne sakriva sadržaj, potvrdu, slanje ili navigaciju. Cancel, unmount, brzo ponovno otvaranje i stari completion callback ne smeju promeniti noviji ekran. Haptika prati smislen događaj i može izostati kada nije dostupna; ne potvrđuje server koji nije odgovorio.

Nema fiksnog globalnog broja animiranih SVG čvorova, identičnog kretanja svake kartice ili čuvanja starih Chrome koordinata. Postoji ograničen stvaran rad na vidljivom ekranu i merenje kada se uvodi veći trošak.

## 14. Pristupačnost i stvarna stanja

Sačuvati čitljiv kontrast: smisleni obični tekst najmanje 4,5:1, veliki tekst i važne netekstualne kontrole najmanje 3:1 u stvarnom paru boja. Boja nikada nije jedini signal. Android kontrole ciljaju najmanje 48 dp dodirne površine; postojeći širi prostori se ne sužavaju zbog lepše ilustracije.

Proveriti običan tekst i uvećanje, uski i viši ekran, tastaturu, safe area, TalkBack redosled, Back i Reduce Motion. Bitan iznos, termin i komanda ne smeju nestati zbog ellipsis-a ili fiksne visine. Tačan stari prag 340 dp/1,3 i smer slaganja nisu nepromenljivi; rezultat mora ostati upotrebljiv.

Loading ne potvrđuje uspeh. Prazno prvi put, filter bez rezultata, završen spisak, offline keš, nedostupan server, stale podatak i unknown upis imaju različito objašnjenje. Jasna primarna radnja je smernica hijerarhije, ne test „tačno jedno zeleno dugme u celom stablu“.

## 15. Provera i granica isporuke

Menjati povezanu porodicu, proveriti stvarni rizik i integrisati. Zadržati behavioral testove za prava, stanje, dostupnost, cancel/replay, input retention, privatnost, inertne galerije i proizvodni bundle bez test podataka. Tačne stare stilove zameniti dokazima semantičkih varijanti, kontrasta, sadržaja i interakcije kada se taj deo menja. Ne gomilati nove testove koji samo prepisuju implementaciju ili očekuju isti literal na drugom mestu.

Galerija je pregled komponenti, ne dokaz kompletnog native toka. Istorijske slike imaju datum i izvor. Posle smislene celine proveravaju se build, poznat APK i emulator: vrh/sredina/dno, sve relevantne komande, tastatura, povratak i različite uloge. SOURCE, TEST, DEV APPLIED, APK BUILT, EMULATOR, PHONE i RELEASE ostaju odvojene tvrdnje. Ovaj canon i foundation paket ne znače da su svi navedeni ekrani već redizajnirani ili pušteni.

### Redosled devet povezanih talasa

Ovo je poslednji vlasnikov redosled **devet talasa**, u postojećem registru. Foundation je deo talasa 1, ne dodatni paralelni plan. Talas označava povezani opseg rada, ne broj već završenih ekrana.

| Talas | Povezana celina | Granica izlaznog dokaza |
| --- | --- | --- |
| **1 — Design system i globalno** | Tokeni, ikone, Surface, motion, navigacija, zaglavlja i globalna stanja | Jedan canon; semantika, kontrast, dodir, safe area, Back, lifecycle i Reduce Motion; istorijski freeze povučen bez gubitka zaštita |
| **2 — Početna** | Obe namere jednog naloga, nastavci i stvarna aktivnost/obaveze | Prvi korisnik, obe perspektive, loading/retry; javni aktuelni zadaci nisu lažno personalizovani matching |
| **3 — Zadaci** | Mapa, lista, filteri, kartice, preview i detalj | Javna geografija, remote bez lažnih pinova, serverski klasteri/stranice, očuvan filter/viewport/scroll i Back |
| **4 — AI kreiranje i izmena** | Zadatak i radni profil: prirodan razgovor, jedna živa kartica, jedan pregled, jedna „Izmeni kroz razgovor“, eksplicitna objava/čuvanje | Isti vlasnički razgovor i revizija, bez autosend-a/gubitka teksta; delimični odgovor, korekcija, map potvrda, stale i unknown oporavak |
| **5 — Prijave i izbor** | Prijava, kandidati, stvarna ponuda, obuhvat ljudi i izbor | Tačna verzija/revizija, budžet naspram ponude, sopstveni zadatak, kapacitet i idempotentnost |
| **6 — Dogovori** | Prihvaćeni uslovi, predlog izmene, timeline, učesnici i sledeći korak | Predloženo nije prihvaćeno; svaka strana, članstvo, otkaz/završetak i istorija; nema obećanja izmene zaključanog parent zadatka |
| **7 — Poruke i svesno deljenje** | Privatni/grupni čet, tekst, mediji, glas, lokacija i kontakt | Stvarna podrška kanala, dozvole i opoziv, novi član/otkaz, pending/failed/unknown, tastatura i neposlat tekst; grupni mediji nisu postojeća mogućnost samo zato što postoje u privatnom četu |
| **8 — Profil** | Jedan identitet, radni i javni prikaz, portfolio, reputacija, statistike i ocene | AI izmene rada, potvrđen način/područje, stvarne brojke; portfolio i regionalno pokrivanje ostaju otvoreni dok nemaju ugovor i dokaz |
| **9 — Završni tokovi i polish** | Obaveštenja, podešavanja, privatnost, podrška i povezana završna provera | Bezbedan notification cilj, dozvole, export/closure, role/account granice, pristupačnost i konkretan APK walkthrough |

### Dokazna matrica

Reprezentativni native prikazi proveravaju se na **361, 390 i 412 dp**, sa **normalnim i uvećanim tekstom**. Ovo su uzorci za proveru, ne fiksne dozvoljene širine ili breakpoint-i implementacije. Svaka pogođena porodica obuhvata ready, loading, empty i filter-empty gde postoji, error, offline i relevantan stale/unknown/write-in-progress slučaj. Proveravaju se vrh/sredina/dno, tastatura, Back, screen-reader semantika i Reduced Motion, uz owner/worker i pojedinačni/grupni kontekst gde pripadaju.

Aplikacija trenutno ima **light** pravac. Dark nije ovim dokumentom implementiran niti potvrđen. Matrica beleži light kao aktivni cilj; dark je **N/A — nije podržan** dok stvarno ne bude uveden. Kada bude podržan, iste kontrastne i native provere važe za obe teme. Ne označavati dark PASS samo zato što je uređaj podešen na tamnu sistemsku temu.
