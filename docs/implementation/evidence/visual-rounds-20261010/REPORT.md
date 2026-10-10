# Tri objedinjena vizuelna kruga — 10.10.2026.

Status: **59876dc6 instaliran; ograničeni fizički prolaz i puna klijentska CI regresija potvrđeni. Edge paket nije primenjen; store NO-GO.**

Vlasnik je tražio nekoliko većih krugova, jasne radne kartice, AI podešavanje, mirne bele površine, filtere prema svojim Airbnb referencama, identitet uz poruke i manje ručnih/duplih kontrola. Root je jedini pisac; tri stručna agenta dala su nezavisne read-only preglede.

## Šta je smetalo i šta je promenjeno

| Krug | Pre | Posle | Korist / granica |
|---|---|---|---|
| 1 — radni profil | Novi profil prikazuje uvod i nastavlja u dugačak ručni formular. DRAFT otvara uređivač i više komandi. | Prvi čist ulaz ima AI uvod; sačuvan DRAFT čitljivu radnu karticu i jednu komandu Nastavi kroz razgovor. | Jasniji početak; zadržani prljavi unos i nepoznati ishod upisa ne nestaju. |
| 1 — čuvanje | Veliki switch aktivacije dominira pregledom. | Postojeći pristupačni izbori Aktivan profil / Nacrt, kontrolisani istim pripremljenim stanjem. | Korisnik bira posledicu čuvanja; nema automatske aktivacije. |
| 2 — filteri | Sve grupe u jednom neprozirnom panelu. | Odvojene bele izdignute sekcije na zajedničkoj zamućenoj pozadini; jedna otvorena, ostale prikazuju sažetak. | Manje vizuelne gužve; pretraga, broj rezultata i primena ostaju pod istim serverskim autoritetom. |
| 3 — razgovori | Inicijali uz poruke čak i kada postoji dozvoljena slika; privatne mete odvojene od ljudi. | Postojeći autorizovani čitači slike uz ime pošiljaoca; Privatno neposredno uz dozvoljenog učesnika. | Učesnik privatno samo naručiocu; naručilac svojim pojedinačnim Dogovorima. Nepoznat pošiljalac ostaje na fallback-u. |
| 3 — pregled zadatka | Fotografija sa greškom nema ponuđen postojeći retry; brisanje nema namensku ilustraciju. | Vraćen zaštićen retry i trash ikona uz postojeću potvrdu brisanja. | Bez automatskog ponavljanja upisa, brisanja ili upload-a. |
| 3 — kalendar | Termin blizu ponoći može postati prenizak blok. | Termin koji nema 48dp prostora dobija čitljiv red; kasni dan se otvara na tom redu. | Vreme ostaje stvarno; svaka stavka tačno jednom. Popravljena i ponovna upotreba skrol-offseta između dana. |

## DOKAZANO

- TypeScript exit 0. Petnaest relevantnih test grupa: **475/475 PASS, bez preskočenih**. Posle poslednje korekcije senke/inseta ponovljeno 70 filter testova: PASS, ne sabirati kao dodatnih 70 jedinstvenih testova.
- Sačuvani testovi recovery-ja, suspension/account/focus ograda, aktivacije, disabled i ponovnog izbora, privatnih meta, server preview/cancel filtera, retry fotografije i kalendara. Novi retained-screen slučaj proverava kasni → normalni → kasni dan sa zakasnelim layout merenjem.
- Nezavisni pregledi našli su i ispravili tri konkretna problema: zaostali kalendarski offset, dugačke privatne oznake i nasleđenu senku celog transparentnog okvira. Kratke vidljive oznake zadržavaju puno pristupačno ime.
- Nema promene dependencies, native konfiguracije, backend-a, sertifikata, pravnih tekstova ili podataka. Source hash i hash privatnih test logova su u `source-checks.json`. Prethodni neuspešni test rezultati ostaju sačuvani kao istorija.

## NIJE DOKAZANO

- Izgled i ponašanje ovog paketa na telefonu, širina kalendara i povećani font, TalkBack, broj photo zahteva u dugom razgovoru, nova APK runtime verzija i potpuni povezani tok. Prolaz testova nije dokaz ovih stavki.
- Potpuno AI-only uređivanje profila: legacy ručni paneli i biography deeplink nisu uklonjeni. Kandidatska mapa mora da menja revisioned AI predlog; ne sme prečicom upisivati live profil.
- Email šablon/redirect/SMTP nisu primenjeni; stvarna potvrda emaila ostaje otvorena. Raniji auth CI retry se vodi u svom izveštaju.
- Nisu rešeni numerički budžet kroz PAGE/MAP/PLACES, brži ponovni GPS fix, kompletan two-account media/QA/finish/cancel tok, prirodni opportunity push, privacy/deletion/performance i store paket.

## FREEZE za ovaj krug

Ne prepravljati bez konkretne regresije: bela FULL lista, kapsule/scroll, stabilna kartica pri promeni pina, prazno→prazno bez treperenja, backend autorizacija, sačuvane činjenice i suspension/recovery, stvarne cene i broj ljudi. Postojeći dokazi za njih ostaju vezani za svoje stare APK verzije.

## SLEDEĆE

1. Objaviti ovaj provereni paket na obe kanonske grane i proveriti tačan CI; jedan zajednički QA APK sa istim potpisom.
2. Install-r i ograničen native prolaz samo u slobodnom prozoru telefona: filters/range/Back, radna kartica/AI ulaz, razgovor/identitet, kalendar. Ne dirati aktivnu vlasnikovu upotrebu.
3. Najmanji naredni poslovni paket: revisioned AI mapa područja rada i normalni AI ulazi umesto ručnih, uz očuvan stari pending/dirty recovery i dozvoljenu ručnu dostupnost.
4. Povezani lifecycle/two-account testovi, preostali sigurnosni i release blokatori; postojeći jedini registar ostaje autoritet. Automatizacija 30min ostaje PAUSED. Nema tvrdnje o udaljenoj objavi Claude table.

## Integrisani CI — prvi ishod i korekcija test putanje

Izvor aplikacije `63366e0fb231071d9bcc5a2d8f252aec4682e6ab` objavljen na obe kanonske grane. R20 run **38027742416 FAIL**: TypeScript PASS, fokusirani Discovery 222 PASS / 5 FAIL, puna regresija SKIPPED. Pet testova pokušalo je da direktno pritisne opciju sada zatvorene sekcije. Testovi sada izvode vidljivu korisničku radnju otvaranja sekcije, pa zadržavaju sve tvrdnje o broju rezultata, primeni/otkazivanju nacrta, kapsulama i account-scoped skorašnjoj pretrazi. Lokalni integrisani suite: **227/227 PASS**; dodate su i tvrdnje da je samo jedna sekcija proširena. Nezavisni pregled potvrdio je svih pet mesta. Ovo nije promena aplikacije da bi test prošao. Novi full CI se beleži po stvarnom ishodu.

Otvoren performance detalj: `ProfilePhoto` za tuđu fotografiju trenutno čita pri svakom montiranju; nova slika po nizu poruka povećava broj takvih čitanja. Nema potvrde brzine dugog razgovora. Sledeća ciljana optimizacija mora objediniti čitanja unutar iste autorizovane posete, uz brisanje na blur/background/account promenu; ne uvoditi trajni cache tuđih fotografija bez zaštita. To ostaje razlog da se ovaj paket ne naziva proizvodno spremnim.

Puna P5 regresija na63366e0f, run38027733293: **603suite PASS / 3FAIL; 13637test PASS / 7FAIL; 6snapshot PASS**. Pored pet istih Discovery koraka, dva gallery/marketplace testa očekivala su da je Iznos otvoren pri ulasku. Sada koriste isti vidljivi header, proveravaju sažetke, stanje radio opcije i jednu glavnu akciju. Lokalno sve tri pogođene grupe: **251/251 PASS**. Prvi neuspešni CI ostaje istorijski; nova puna regresija proverava konačne korekcije.

## Zajednički APK

Lokalni63366e0f build uspešan: Gradle5m39s, 940tasks (912up-to-date), bez clean/prebuild/dependency promene. Attestation: paket`rs.uskoci.preview`, versionCode35,ARM64,debuggablefalse, isti sertifikat`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, overlaydozvola odsutna. APK SHA256`217924351af9ce69ca16d2836c87685b072fb223d4a747b61a704ae05d4508c0`. Frozenarchive5972fajla byte-equal, embeddedsource63366e0f. QA/previewOTAON; nije produkcioniAAB. Posle633 menjani su samo testovi i dokumentacija, aplikacioni source ostaje isti.

Telefon je u preflight-u pokazao aktivan ChatGPT i nove dodire; ništa nije instalirano preko aktivne upotrebe. Vlasnik je pitan tek nakon konkretnog proverljivog APK-a. Instalacija i native prihvatanje ostaju odvojeni od attestacije.


## Native nalaz i sledeći objedinjeni paket

Telefon je oslobođen izričitom porukom vlasnika. Nadogradnja63366e0f izvršena je10.10. u05:38UTC, isključivo install-r: isti UID i firstInstallTime, sačuvana prijava; About prikazuje63366e0f. Font1.15. Privatni snimci01–31 nisu objavljeni u javnom repozitorijumu; njihovi hash-evi i granice su u device-baseline-checks.json.

Viđeni su radna kartica/AI prvo pitanje, odvojene filter sekcije, kalendar, Back koji otkazuje nacrt filtera, bela FULL lista bez trake mape i pretraga grada sa tastaturom. Nalog nema razgovore/Dogovore za dokaz popunjenih privatnih/grupnih stanja. Ovo nije kompletan prolaz proizvoda.

Konkretne regresije: početni singleton bounds zumirao je u reku umesto da pokaže okolinu; Mapa kapsula ostala je preko otkrivene mape; posle Raspored → Zadaci → Back nestala je donja navigacija u Dogovorima. Na Profilu je prikazana nedostupnost broja završenih Dogovora; taj čitač još nije istražen/ispravljen. Prethodni R20 run38028137609 na98dec9ab:606suites/13644tests/6snapshots PASS. Njegov prolaz nije sprečio ove native probleme.

### URADIO

- Samo prvi server camera bounds dobija minimalan raspon0.04 stepena po osi; saved viewport, pin i filter ostaju izvorni. Mapa kapsula zavisi i od stvarnog pokrivanja mape listom, ne samo od zatraženog FULL stanja. Root nav dobija odvojen native host/reset transformacije posle povratka iz Discovery.
- Pomeranje mape više ne dodaje Ova oblast u rastuće zaglavlje. Sve oblasti je kratka zasebna komanda uz stvarni broj rezultata; ostali filteri se čuvaju. Gradovi zadržavaju stvarni broj u blagoj neutralnoj pločici, zadaci namensku ilustraciju. Nulta pretraga nudi istinit izlaz kroz filtere; uputstvo za raspon datuma je pre kalendara.
- Dogovori dobijaju vidljiv naslov i ravnomerne lakše podvučene tabove; isto razdvajanje u rasporedu. Semantičke edit/trash/cancel ikone, jednostavnije zvono; autoritet/confirm/callback ostaju. Završeno i otkazano su neutralni, razlikuju ih check/dash i reči. Predložena dodatna linija između saradnika odbačena je nakon postojeće provere design sistema; zadržan je razmak bez novih linija.
- Slušanje i stvarne prepoznate reči stoje uz mikrofon, prvo pitanje ostaje vidljivo, u istoriju ulazi poslata poruka. Ćirilica govornog unosa prelazi u latinicu pre kontrole dužine; isti postojeći mapper koriste mesta i govor. Recovery više ne tvrdi da postoji sačuvan tekst kada ga nema. Malformed final zaštićen pre trim. Nema ponovnog posebnog glasovnog razgovora, izmišljenog transkripta ili novih provider poziva.

### DOKAZAO

Puna lokalna regresija pre poslednje korekcije: 600 suites PASS / 6 FAIL, 13650 tests PASS / 6 FAIL; 6 snapshots PASS;9platformskih SKIP. Nalazi ispravljeni: dodatna linija odbačena; fixture-i usklađeni sa vidljivim naslovom, zvonom, fizičkom pokrivenošću mape i promenom nav hosta uz očuvane poslovne tvrdnje. Ponovljene pogođene provere: 358 PASS u9grupa. Cela regresija konačnog izvora čekaCI, lokalnih9SKIP se ne računaju kao PASS; TypeScript exit0. Tri read-only pregleda; očuvani authorizations/session/revision/late-request/voice-once/recovery guardovi. Novi slučajevi pokrivaju singleton bounds, fizičku pokrivenost, nav host, P6 area reset uz druge filtere,320/font2, dimenzije tabova i statusa, ćirilično proširenje do/iznad4000, stale/invalid final i prazno prepoznavanje. Izvor/hash/provere u native-followup-checks.json. Raniji failed ciljani pokušaji ostaju zabeleženi, nisu skriveni zelenim završnim rezultatom.

### NIJE DOKAZANO

Ovaj followup još nije instaliran. Posebno proveriti nestajanje nav, početni zoom, footer/tastaturu/uvećan tekst na fizičkom uređaju. Nema tvrdnje da je test sa renderer mockovima dokaz native geometrije ili server kapaciteta.

Brojčani minimum budžeta ostaje otvoren: zahteva isti ugovor u PAGE/MAP i zasebnoj PLACES grani, cursor/count i jasno TOTAL/PER_PERSON značenje. AI prompt lokalno još sadrži zastarelo pravilo TOTAL/cela-ekipa (uskoci-ai-interview:365); otkriveno source-only, deploy nije proveren. Toplina i razumevanje stvarnog modela nisu dokazani ovim klijentskim paketom. AI-only profil/candidate-map, autentifikacioni email, photo-cache, two-account lifecycle, privacy/deletion/performance/store ostaju otvoreni. NO-GO;30min automatizacijaPAUSED.

### SLEDEĆE

Jedan novi APK ovog zamrznutog source-a sa istim potpisom; zatim ograničen phone prolaz u slobodnom prozoru i tačanCI. Ne povećavati scope dok native regresije nisu proverene. Sledeći zaseban paket: ispravka AI prompt ugovora/toplo razjašnjenje, zatim zajednički numerički filter i završetak AI-only profila. Čuvati već dobre filter sekcije, postojeći matching/RLS/podatke i cene; bez novog master plana ili tvrdnje o objavi Claude table.


## Završeni fizički prolaz 52720d99 — 10.10. 06:19–06:23 UTC

URADIO: tačan APK52720d99 instaliran isključivo install-r; isti potpis, UID i firstInstallTime. About52720d9, prijava i profil sačuvani. Nisu menjana sistemska podešavanja, poslovni podaci, backend, provider ili push. Privatni snimci01–20 i XML ostaju van javnog repozitorijuma; hash-evi u native-installed-52720d99.json.

DOKAZAO: R20 run38030187236 na istom source-u SUCCESS606/606suites,13665/13665tests,6/6snapshots,0skip/fail; focused228PASS iTypeScriptPASS. Jest log zadržava upozorenje o async zatvaranju procesa — čist cleanup nije dokazan samim zelenim poslom. Na HONOR-u: početni zoom pokazuje okolinu; FULL bela površina i nestajanje Mapa kapsule pri spuštanju; pan više ne povećava header; auto-focus pretrage i stvarni rezultat zadatka/grada; blur/sekcije/datumi; Dogovori/Raspored podvučeni tabovi/zvono; donja navigacija se vraća posle Discovery Back. Radna kartica i prvi AI upit vidljivi.

NIJE DOKAZANO: popunjeni privatni/grupni razgovori, čitav lifecycle, stvarni ASR/AI ton, numerički minimum budžeta, AI-only kandidat mapa, email dostava, skaliranje, privacy/deletion/store. Dogovori su prazni na pregledanom nalogu. Ograničen native prolaz ne znači pregled svakog ekrana. Spremnost za prodavnicu ostaje NO-GO.

### Sledeća konkretna popravka — sopstveni završeni Dogovori

Telefon potvrdio nedostupan broj na DRAFT radnom profilu. Uzrok u aplikaciji: broj je čitan javnom ACTIVE-only projekcijom. Sada ProfileWorkSummary koristi postojeći privatni myStats i tačno proverava očekivani worker ID; ista jedna poruka daje broj završenih i pouzdanost. Ne otvara javno nacrt ili pauziran profil. Requester čitanje ostaje zasebno; neuspeh ili nepoznat broj nikada ne postaje0. Uklonjen drugi nezavisan myStats čitač sa istog ekrana. Izgled figure ostaje isti.

DOKAZAO U IZVORU: četiri povezane grupe107PASS; dodatne service/focus/presentation granice i ponovljen review-fix test zabeleženi u profile-counter-checks.json (brojevi se preklapaju). TypeScript0. Stvarni focused-resource model proverava kasni odgovor posle promene naloga, revizije i ID-ja profila. Nezavisan read-only pregled bez blokirajućeg nalaza. Ova popravka nije deo instaliranog52720APK; čeka svoj runtime dokaz.

SLEDEĆE: objaviti source brojača, jedan mali nadogradni APK istog identiteta i potvrda broja na istom nalogu. Zatim AI prompt ugovor/toplo razjašnjenje, numerički PAGE/MAP/PLACES filter i AI-only profil po postojećem planu. Dovoljno dobre filter sekcije i potvrđene nav/map popravke FREEZE bez nove regresije;30-minutna automatizacija PAUSED.


## Fizički dokaz brojača 00450330 — 10.10. 06:33 UTC

URADIO: nadogradnja tačnog APK00450330 isključivo install-r, sertifikat nepromenjen, sačuvani UID/firstInstallTime/prijava. About pokazuje0045033. Dokaz: native-installed-00450330.json; snimci ostaju privatni.

DOKAZAO: na istom DRAFT profilu stvarni broj0 zamenio je grešku; otvara izabranu Istoriju Dogovora sa donjom navigacijom; Back vraća profil/broj; radna kartica i Nastavi kroz razgovor sačuvani. PRE-P4 oba run-a38031058416/38031058293 SUCCESS:40suites/1131tests iTypeScript, ciljani opseg. Puna regresija606/13665 ostaje dokaz prethodnog52720, ne tvrdi se ponovljena na00450330.

NIJE DOKAZANO: pozitivan broj, PAUSED/error/retry/account-swap na fizičkom telefonu (te granice imaju source testove); popunjeni grupni i privatni razgovori, stvarni ASR/AI, numeric budget, store. Nisu menjana sistemska podešavanja, backend ili poslovni podaci.

SLEDEĆE: objediniti preostalo zvono/semantiku prazne istorije/profila i ispraviti pronađeno skrivanje pravog AI razjašnjenja iza nepotvrđene mape. Live task Edgev60 byte-equal trenutnom izvornom entrypointu još sadrži staro objašnjenje TOTAL ekipe; pripremiti tačan prompt paket, bez tvrdnje o primeni. Worker Edgev23 nije byte-equal lokalnom entrypointu/shared stream helperu; nikakav slepi deploy.


## Razjašnjenje uz mapu i dosledne komande — izvor proveren, native sledi

URADIO: prava CLARIFY poruka ostaje vidljiva i pri nepotvrđenoj mapi; uklanja se i iz već zadržanih ID-jeva i naknadno pročitanog rasporeda. Obično sledeće pitanje ostaje iza potvrde lokacije; kanonska istorija se ne menja. Profil više ne kaže Nova ocena kada nijedna ne postoji, nego Još nema / ocena. Komande Obaveštenja u profilu/radnom profilu imaju isti Glyph kao zaglavlje, istu destinaciju i disabled zaštitu. Istorija sada opisuje završene i otkazane Dogovore, uključujući odgovarajući prazan filter; aktivni početni tok i CTA ostaju.

DOKAZAO:271/271ciljanih klijentskih testova, TypeScript0;126/126offline Edge testova. Dva nezavisna read-only pregleda bez blokera. Prvi neuspeh zadržan: dva copy assertiona i TypeScript tip parametarskog testa ispravljeni; postojeći candidateTrust spoken tekst ostao nepromenjen.

AI SERVER: read-only preflight iz živog taskv60 potvrđuje byte-equal prethodni source i zastarelo pravilo TOTAL cela ekipa. Pripremljena prompt-only izmena prema odobrenom round(total×covered/required), bez izmene cene zadatka/Dogovora, uz ljubazno razjašnjenje bez izmišljenog audio sluha. Svih6deployfajlova ima hash i privatni tačanv60revert. Nije primenjeno. Workerprompt pripremljen za1–3prirodne rečenice/povremeni emodži/empty-patch kod nerazumljivog unosa; živi workerv23 ima dodatni raniji source/shared drift pa nije spreman za slepi deploy.

NIJE DOKAZANO: nova native semantika i složen razgovor tek slede; offline prompt test ne dokazuje ponašanje pravog modela. Ne menjaju se produkcija, DB, provider konfiguracija, push ili poslovni podaci. APK ne primenjuje Edge prompt. Store ostajeNO-GO.

SLEDEĆE: jedan zbirni APK ovog klijentskog kruga, potpis/runtime/nadogradnja/telefon; zasebna primena tačnog Edge paketa po važećoj autorizaciji. Numeric budget PAGE/MAP/PLACES i popunjeni grupni/privatni lifecycle ostaju otvoreni u istom registru.30-minutna automatizacijaPAUSED.


## Zatvoren klijentski krug 59876dc6 — fizički uređaj i puna regresija

**URADIO:** APK 59876dc6 je nadograđen na vlasnikovom slobodnom HONOR-u isključivo `adb install -r`. Potpis, UID, prvobitna instalacija i prijava su sačuvani. About pokazuje 59876dc. Nisu menjana sistemska podešavanja niti poslovni podaci. Dokaz: `native-installed-59876dc6.json`; privatni snimci nisu deo javnog repozitorijuma.

**DOKAZAO:** profil prikazuje „Još nema ocena“ i stvarnih 0 završenih; broj otvara izabranu Istoriju sa novim praznim stanjem i donjom navigacijom; Back vraća profil. Novo zvono u profilu vodi u podešavanja obaveštenja. DRAFT radna kartica, skrol i komanda Nastavi kroz razgovor ostaju. Worker zvono nije viđeno u ovom DRAFT ogranku, pa za njega ostaje samo izvorna provera.

Na tačnom source-u 59876dc6: puna CI klijentska regresija 38031937885 **607/607 grupa, 13.672/13.672 testa i 6/6 snapshotova PASS**; dodatno 237 lokacijskih testova i TypeScript PASS. PRE-P4 na obe grane 38031937974/38031937640 PASS (ciljani opseg: 261 grupa / 6.892 testa). D12 38031937878 PASS odnosi se na izolovan istorijski lanac, ne na trenutni DEV. Source provera CLARIFY rasporeda i dalje je odvojena od stvarnog AI razgovora.

**CI NEUSPEH I POPRAVKA:** PKG-049 38031937895 je stao na 39/40 pure testova jer je njegov očekivani tekst cene zastareo. Aplikacija je već koristila vlasnikovo odobreno pravilo cene prema broju ljudi. Ispravljen je samo literal u testnom ugovoru, bez vraćanja aplikacije ili promene cene. Lokalno sada 40/40 PASS. Istorijski DB replay posle ispravke čeka novi CI; prethodni neuspeh ostaje sačuvan. To nije dokaz da je ceo CI zelen.

**AI PAKET PRIPREMLJEN, NIJE PRIMENJEN:** `ai-edge-candidate-59876dc6.json` sadrži tačne UTF-8/LF hash-eve iz zamrznutog Git izvora, task v60 (6 fajlova), worker v23 (novi paket 4 fajla) i kompletne sačuvane prethodne sadržaje za povratak. Time se precizira stariji receipt koji je poredio Windows CRLF hash sa LF readback-om uz tekstualnu jednakost. Task menja samo prompt. Worker uz topliji prompt uključuje prethodnu lokalnu ispravku dijagnostike HTTP 402, sa tačnim opt-in zaglavljem; stari klijenti zadržavaju generičku grešku. Model, vremenska ograničenja, dispatch/completion i rezervacija budžeta ostaju isti. Novi strogi loader povezuje sva 4 fajla; 210/210 offline testova PASS, bez spoljnog provider poziva i bez DB upisa. Deno provera nije pokrenuta jer alat nije dostupan. Za konkretan Edge deploy i dalje važi AGENTS §3.1.10.

**NIJE DOKAZANO:** prirodnost pravog modela, ASR, popunjeni grupni/privatni razgovori i kompletan lifecycle, brojčani minimum budžeta u svim čitačima, puna AI-only mapa radnog profila, aktuelna push isporuka, email dostava, skaliranje, privacy/deletion i store uslovi. Podešavanja telefona kažu da je dozvola uključena, ali stanje slanja još nije potvrđeno; ovaj pregled nije novi push test. Jedan UIAutomator snimak nije vratio XML; sledeće čitanje istog ekrana je uspelo bez ponavljanja dodira.

**SLEDEĆE:** primena konkretnog Edge paketa tek uz važeće odobrenje, zatim meren razgovorni test uz zasebno ograničenje provider troška; zajednički brojčani filter PAGE/MAP/PLACES i dovršetak AI-only profila; popunjeni two-account tokovi. Ne redizajnirati ponovo potvrđene filter sekcije i map/nav popravke bez novog problema. Jedini registar ostaje 62 reda, automatizacija 30 min PAUSED, store NO-GO. Nema tvrdnje da je javna Claude tabla ponovo objavljena.


## Dodatni native nalaz: tastatura pri otvaranju pretrage

URADIO: na 59876dc6 dva puta je reprodukovano da lupa postavi kursor, ali ne otvori tastaturu; dodatni dodir polja je otvori. Raniji uspešan pokušaj nije dovoljan za opštu tvrdnju. U lokalnom React Native kodu onShow može prethoditi skidanju FLAG_NOT_FOCUSABLE sa dijaloga. Prvi focus se sada odlaže preko dva render frame-a; close, Back i unmount otkazuju i generacijski odbacuju zakasnelu komandu. Nema blur/refocus trika ni vraćanja tastature posle korisnikovog Back-a.

DOKAZAO: 75/75 testova pretrage, uključujući odloženi fokus, otkazivanje pre i između frame-ova, Back sa vidljivom tastaturom i očuvan unos; TypeScript PASS. Prvi TypeScript neuspeh mock potpisa sačuvan, zatim ispravljen. Nezavisan read-only pregled pronašao native redosled prozora i potvrdio ograničen kandidat. Detalji u search-ime-followup.json.

CI DOPUNA: af69e0d4 PRE-P4 obe grane PASS (5 grupa / 140 testova), CodeQL za 59876dc6 SUCCESS, bez tvrdnje da nema dependency nalaza. PKG-049 38032576530 prošao je 40 unit testova i ranije DB faze, ali P6 je pozvao uklonjeni fixedApplicationPeople. Istorijski TOTAL fixture sada eksplicitno bira celu ekipu od 3, preko aktuelnog fixedApplicationPrice; app i istorijski SQL ostaju nepromenjeni. Lokalnih 40 pure testova PASS; nova potpuna istorijska provera tek sledi.

NIJE DOKAZANO: vidljiva tastatura u novom APK-u; dva frame-a nisu formalna potvrda native window fokusa. Zato ide još jedna ograničena fizička provera, sa jasnim prethodnim neuspehom. AI Edge paket i dalje nije primenjen; odobrenje je zatraženo za tačno dve pripremljene funkcije. Numerički minimum i svi širi release tokovi ostaju otvoreni.

SLEDEĆE: isti potpis, install-r, ponovljeno otvaranje pretrage/IME/Back/unos na HONOR-u; zatim preostali brojčani filter i AI-only radni profil iz postojećeg plana. Store NO-GO, automatizacija PAUSED.
