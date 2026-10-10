# Tri objedinjena vizuelna kruga — 10.10.2026.

Status: **63366e0f je instaliran i ograničeno pregledan na telefonu; pronađene native regresije imaju proverenu naknadnu source ispravku, novi APK/native još čeka**. V1 ostaje **NO-GO**. Ovo je dopuna postojećeg plana, ne novi master.

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
