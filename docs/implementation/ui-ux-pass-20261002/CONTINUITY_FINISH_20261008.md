# Završni paket kontinuiteta — 8.10.2026

## URADIO / SOURCE

Polazni HEAD a6504718. Postojeći proizvod, isti RPC i autoritet baze.

- Discovery: „Na daljinu“ prva kapsula; kratko jednoredno polje pretrage; neuspeo P6 pregled ima ponovni pokušaj uz sačuvane izbore. P6 ne računa lokalne rezultate koje odbacuje; promena omotača čuva memoizaciju liste/pinova.
- Moje prijave: poslednja stranica ne sklanja filtere i ne pregrupiše kartice pod prstom. Moji zadaci: reset filtera ostaje u nacrtima/istoriji u kojoj se korisnik nalazi.
- Dogovori: Sve / Tražim pomoć / Uskačem iz stvarne sopstvene uloge; isti filter kroz aktivne/istoriju, očuvan pri povratku, poništen pri promeni naloga. Profilov ukupni broj završenih otvara sve uloge i uklanja prethodna suženja; eksplicitni parametar se troši jednom.
- Profil: duže statusne rečenice ispod naslova, ne u uskoj desnoj koloni.
- Radni AI: zatvoren razgovor ne nudi unos. Uvod i ručna polja jasno obuhvataju svakodnevnu pomoć, bez automatskog dodavanja veština.
- Grupni razgovor: potvrđeno slanje automatski nastavlja stvarno čitanje. Neizvestan ishod čuva postojeći ključ; neuspeo lokalni cleanup zadržava potvrdu i retry samo čitanja. Neposlat nacrt ostaje u memoriji iste montirane konverzacije kroz background/focus; promena naloga/revizije/grupe/dozvole ga uklanja. Bez plaintext zapisa na disk. Render koristi indeks liste umesto ponovnog pretraživanja svih poruka.

## DOKAZAO

- TEST: 6 ciljanih grupa / 380 testova PASS, zatim 9 grupa / 416 testova PASS. Završna dopuna eksplicitnog ulaza u istoriju: route grupa 24/24 PASS (prethodno 23). To je 797 različitih testova u 15 grupa, ne zbir sa ponavljanjem.
- TEST: TypeScript PASS i posle poslednje dopune eksplicitnog ulaza u istoriju.
- SOURCE: nezavisni read-only pregledi Discovery, ličnog rada i grupnog razgovora; pronađen i ispravljen profil→filtrirana istorija propust.
- DEV: read-only checkpoint 235 / 3a785d42; nema server promene.
- PHONE: postojeći APK 4e0ea506, package rs.uskoci.preview, versionCode35, SHA256 7122b1c22073af4f4b38330e22115dbf02536cef0072092502aa19fa06d2fea1. POST_NOTIFICATIONS granted=true. To nije dokaz novih izmena.
- DEV push: total_devices2 / active_devices1 / active_android_devices1 / active_session_bound_devices1, last_seen_at 2026-10-08T21:18:55.080965Z. Nisu čitane vrednosti tokena. Sama registracija ne dokazuje dostavu.
- EMULATOR: USKOCI_V5_TEST pokrenut, Android16,1264×2728/560dpi/font1.15; postojeći preview APK SHA256 3f78e4e9943233e9c43fb7a9b128c71e127b6ed8e90068e3298fa9bd6601c6c7. Novi paket još nije instaliran.

## NIJE DOKAZANO

Novi native izgled/motion; cela objava→ocene na dva naloga; nova voice/push dostava; AI kompletna ruta; hiljade istovremenih korisnika; prodavnica. Radni AI ne pita još sistematski o svakodnevnim zadacima; sinonimi poput „pomoć sa kesama“ nisu garantovano pokriveni matchingom. Nema novih automatskih kategorija/opt-in polja.

## SLEDEĆE

Tačan emulator/phone APK ovog paketa → instalacija-r uz isti potpis i podatke → ograničene slike/tokovi → korekcija stvarnih nalaza. Push transport: kapacitet i single-target dokaz pre kontrolisane dostave. AI pitanja/sinonimi zasebno uz existing server contracts. Lokalna kontrolna tabla se osvežava; objavljena Claude tabla nije time republished.


## Dopuna — reference i neprekinuto povlačenje liste

**URADIO / SOURCE:** vizuelne reference14395–14424 prevedene u konkretne kriterijume svih površina u postojećem NACRT-u §16.8. Nađen stvaran gesture sukob: Gorhom5.2.14 na FULL rezerviše content drag za refresh čim lista ima `onRefresh` (`createBottomSheetScrollableComponent`, `useGestureEventsHandlersDefault`). Discovery više ne daje taj prop; povlačenje nadole pripada sheet-u. Redovno osvežavanje ostaje Još mogućnosti → Osveži zadatke, a recovery radnje ostaju iste. Ne menjaju se biblioteka, cache/reader, kamera, privatnost ili server.

**DOKAZAO / TEST:** novi regresioni test FAIL pre izmene (onRefresh prisutan), zatim cela Discovery presentation grupa212/212 PASS; TypeScript PASS. Provereno da eksplicitno osvežavanje čuva query/filtere/visinu, a callback prethodnog mount-a ne može da osveži novi ili poništi njegovo vraćanje scroll-a. Ovo su provere source integracije, ne emulacija fizičkog prsta.

**NIJE DOKAZANO:** neprekinuti native gest na APK-u sa ovom naknadnom izmenom. Buildovi37846681465 (emulator) i37846682483 (telefon) pripadaju ranijem source6dbd38e0; ne sadrže ovu dopunu. Map/tablet/performance/whole-app/store tvrdnje nisu zatvorene. Posebno proveriti važnu lokacijsku/Za mene poruku na FULL, floating Mapa preko srednjih redova i pojavu tabova tokom zadržanog draga.

**SLEDEĆE:** tačan novi APK uz postojeći redosled build→slika/snimak→kritika→korekcija. Native proba: HALF→FULL→scroll, scroll→vrh→spuštanje, kratka/prazna lista, detalj→Back, font1.15, reduced motion i dostupnost poslednje kartice. Nova autonomija ne menja oznake nivoa dokaza.


## Dopuna — jasni duboki redovi profila i privatnosti

**URADIO / SOURCE:** „Grad“ u Ličnim podacima zove se „Područje rada“, jer postojeći reader čita work.data.grad i postojeća radnja otvara /profil/lokacija. Sačuvani su isti podaci, read/retry stanja i navigacijska zaštita. Vrednost stoji ispod naziva; isti raspored dobili su Izvoz podataka, Blokirane osobe i Pravila i saglasnosti u Privatnosti. Nema novih privatnosnih opcija niti promene njihove semantike. U ovom paketu nisu konsolidovani duplirani ulazi sa Profila; to ostaje pitanje kompozicije narednog vizuelnog pregleda.

**DOKAZAO / TEST:** postojeće tri grupe (personal-profile-route, profile-edit-render, privacy-retention-screen)93/93 PASS nakon usaglašavanja selektora sa novim nazivom. Zadržane provere navigacije, ponovnog ulaza, nedostupnih/nepročitanih podataka i retention prikaza. Nisu dodati paralelni rendereri ni novi testni framework.

**NIJE DOKAZANO:** native prikaz ove naknadne dopune. Aktivni buildovi37848305665 /37848305939 su source dce7c463 i sadrže gesture fix; ne sadrže ovu kasniju doradu dubokih redova. Raniji6dbd buildovi ne dokazuju ni novi gesture fix.

**SLEDEĆE:** uključiti ove uske vizuelne korekcije u sledeći objedinjeni APK i pregledati iste deep-screen scene pri1.15 fontu. Fizičke i sintetičke probe ostaju odvojeno označene.

Nezavisni SOURCE pregled ove dopune pronašao je gramatičko slaganje fallback-a sa novim nazivom: sada „Trenutno nedostupno“ / „Još nije podešeno“. Ponovna provera route + postojećeg formattera39/39 PASS (preklapa se sa gore navedenih93; ne sabirati kao nove testove). TypeScript PASS.


## Dopuna — fiksna oznaka izvora mape (09.10)

**URADIO / SOURCE:** prema poslednjoj odluci vlasnika, mali natpis izvora ostaje dole levo uz spuštenu listu. Nema animiranog podizanja za listom ili karticom pina; te površine ga prirodno prekrivaju. Prekrivena kontrola uklanja se iz dodira i navigacije čitača ekrana. Isti ugovor primenjen je u native i web komponenti. Izvori i linkovi sačuvani, kamera i Moja lokacija ne menjaju ponašanje.

**DOKAZAO / TEST:** discovery-map + discovery-presentation, 2 grupe / 266 testova PASS; TypeScript PASS nakon usaglašavanja web poziva. Nezavisni read-only pregled pronašao je stari web potpis, ispravljen pre završne provere. Granica: stanje dostupnosti kontrole tokom samog draga prati poslednji potvrđeni sheet indeks; konačni HALF/FULL i prikaz kartice ga isključuju.

**DOKAZAO / APK:** raniji buildovi37846681465 /37846682483 završeni uspešno. Preuzeti APK-ovi source6dbd38e0: emulator SHA256 ad65bee27d0876132e45f8975a881bcf03d33373ee886ecf5318754991171d69; telefon SHA256 6b610fe29214443a496f93368179497e181ae062d3f60d53f54680c4af498d2d. Potpis direktno pročitan iz oba trenutno instalirana preview APK-a i novih artefakata: SHA256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c. Nema razlike potpisa; raniji kratki dumpsys identifikator nije SHA256 sertifikata. Provera sama ne znači instalaciju.

**NIJE DOKAZANO:** poslednja kompozicija oznake i dubokih redova na native APK-u. Raniji6dbd artefakti ne sadrže ove dopune ni gesture fix. Dce7 buildovi sadrže samo raniji gesture fix. Nema nove serverske primene, dostave push-a ili dokaza spremnosti za prodavnicu.

**SLEDEĆE:** objedinjeni APK sa ovom izmenom i profilom/privatnošću; proveriti COMPACT/HALF/FULL i pin karticu, zatim nativni gest i povratak. Instalacija isključivo preko postojećeg paketa uz očuvane podatke.

## Dopuna — učesnici, AI mikrofon i kompletna kartica (09.10)

**URADIO / SOURCE:** ovlašćeni spisak učesnika na Pregledu višestrukog zadatka; izbor grupne/privatne prepiske sa management straničenjem, retry-jem i zaštitom od zastarelih callbackova. Učesnik nema ulaz u privatni razgovor sa drugim učesnikom. Ime i inicijali uz prvi oblačić niza u oba tipa razgovora. Bilateralni uslovi ostaju bilateralni. Segmentirane kontrole poštuju disabled stanje bez haptike ili navigacije. Privremeno blokiran red poruka ostaje čitljiv, a delimično učitana lista ne prikazuje lažnu konačnu prazninu.

AI završna kartica se pojavljuje tek sa svim potrebnim činjenicama i potvrđenim lokacijama. Poseban ulaz u fullscreen glasovni AI razgovor je uklonjen iz oba unosa; ostaje jedan mikrofon sa hold/release i pristupačnim tap načinom. Stvarni transkript ulazi u razgovor tokom slušanja, bez dupliranja u statusu. Postojeće slanje, dozvole, greške, account scope i follow-scroll ugovori ostaju.

**DOKAZAO / TEST:** završno izvršavanje 12 grupa / 486 testova PASS: ai-conversation-layout, ai-owned-intake-screen, v5-group-conversation-screen, agreement-screen-recovery, agreement-chat-thread, agreement-chat-tab-glue, AgreementOverview, segmented, discovery-view, discovery-v1-server-marker-layer, conversation-inbox-presentation i voice-composer-controls. TypeScript PASS. Pet dizajn guard grupa / 121 test PASS. Raniji crveni međukoraci uključivali su nepotpunu group mock strukturu, uklonjenu last promenljivu i VoiceTranscript mock; ispravljeni, završna provera pokriva iste putanje.

Nezavisni read-only agentski pregled našao je dodatno učitavanje iste fotografije po nizu poruka i nevidljivu paging grešku u privatnom chatu. Oba nalaza korigovana: inicijali uz niz, postojeća fotografija u zaglavlju; paging greška i retry u kanalskoj kontroli. Provereni stale account/focus/background callbackovi i učitavanje dodatnih ovlašćenih ID-eva.

**DOKAZAO / OGRANIČENA NATIVE PROBA:** raniji source6dbd38e0 instaliran na telefonu i emulatoru preko postojećeg preview35, sa istim prethodno potvrđenim potpisom, bez brisanja ili odjave. Telefon: postojeći Inbox → postojeća privatna prepiska → prazna tastatura; zaglavlje se sažima, composer ostaje iznad tastature. Privatne slike su van Git-a u C:/Users/user/Documents/Codex/uskoci-finish-20261008/phone-6dbd-{inbox,chat,keyboard}.png. Nije slata poruka. Emulator preview je ostao odjavljen kao pre instalacije; drugi dev paket nije migriran niti su kopirani tokeni. Ovo NIJE dokaz novih kanala, avatara ili AI izmena.

**DOKAZAO / SINTETIČKI KLIJENT:** test40.000 zadataka obuhvata osam gradova po4.000,4.000 remote i4.000 bez tačke; svi zadaci pojedinog grada dostupni kroz grupisanje. Zaseban test obrađuje256 simuliranih serverskih grupa ukupno32.000 zadataka kroz stvarni marker adapter. Prva putanja je lokalni gallery/legacy model, druga ograničen odgovor; nema stvarne baze ni native FPS merenja.

**NIJE DOKAZANO:** novi native izgled/glasovno slanje; jedinstveni zapis zadatka na glavnoj listi Dogovora; redosled AI lokacija→sledeće pitanje;40.000 istovremenih korisnika ili lifecycle RPC workload; push dostava; App Store/Play spremnost. DEV, Edge, sertifikat i zavisnosti nisu menjani ovim paketom. Buildovi37850899130/37850899422 uspešno sadrže raniji787a337d, ne ovaj paket.

**SLEDEĆE:** push objedinjene promene na obe kanonske grane, novi objedinjeni APK, vizuelna provera i korekcija. Paralelno razraditi uzročni AI location gate i izolovani SQL load harness uz tačan dokaz primenjenih funkcija. Postojeći heartbeat za nastavak rada osvežen poslednjim vlasnikovim zahtevima, bez duplikata. Lokalno generisanje kontrolne table ne znači objavu spoljnog Claude artefakta.

## Dopuna — izolovani Discovery baseline40k (priprema)

**URADIO:** vraćen postojeći izvršni harness iz istorijskog c96dedec (7 proof/workflow fajlova); aktuelni SQL kandidati nisu prepisani. Novi režim deployed-baseline primenjuje samo već primenjeni DISCOVERY-GRAD postimage na disposable bazi. S3 se u tom režimu ne primenjuje.40.000 zadataka u srpskim gradovima,2 sintetička Auth naloga, serijski SQL i PostgREST upiti; proveravaju se PAGE/MAP/PLACES, tekst, grad, daljina i ograničenja odgovora. Loopback admission, tačni hash-evi, ACL, zavisnosti, closure i teardown ostaju obavezni. Ne koristi DEV kredencijale.

**DOKAZAO:** offline generator/SQL provere PASS (22 DISCOVERY-GRAD i46 prethodničkih SQL/PLpgSQL jedinica), fold oracle26 i Node syntax checks. Raniji receipt potvrđuje reader a9b0985991f4ebfe4e95143e5cf57222 i fold41353abe05d434d513495ae5974b9802; runtime ih proverava pre i posle opterećenja. Read-only agentski pregled prethodnika razdvojio relevantnih23 funkcija od pune baze.

**NIJE DOKAZANO:** ovaj40k runtime još nije izvršen. Seed direktno stvara zadatke sa isključenim triggerima samo radi čitanja; ne dokazuje objavu/izbor/otkazivanje/chat, niti40k simultanih korisnika.11 toplih SQL i3 HTTP uzorka nisu p95 kapacitet. Lokalno nema Docker/psql/CLI/WSL; koristi se postojeći GitHub disposable runner.

**SLEDEĆE:** pokrenuti jednim push-em na proof/discovery-baseline-40k-20261009; čitati stvarni rezultat i granicu, ne povećavati timeout radi PASS-a. Zatim stvarni lifecycle runner sa triggerima/RLS i eksplicitnom konkurentnošću. UI paket804cedd2 spojen je u66275774 i poslat na obe kanonske grane; novi phone run37855571775 i emulator37855571254 su od66275774.

### Runtime rezultat40k — PASS sa izmerenim ograničenjem brzine

Push proof grane nije proizveo run; provereno da ga nema, zatim jedan workflow_dispatch. [Run37856499413](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37856499413) uspešno završen, source93041f70280af0a6ae1a489ca23f2386cfaeabc1. Preuzeti ograničeni artifacti sačuvani pod evidence/discovery-baseline-40k-37856499413. Teardown exit0; providerCalls0/pushSends0. Stvarni reader/helper i relevantni prethodnici odgovaraju pinovanim hash-evima, ACL/dependencies/closure provereni pre i posle. S3 nije primenjen.

**DOKAZAO:**40.000 sintetičkih zadataka sa2 Auth naloga; serijski SQL i PostgREST, isti anchor i iste brojnosti. Prva strana50, mapa sveta14grupa, gušća gradska oblast5grupa; zbir članova jednak ovlašćenom SQL broju u istom viewportu. Medijane toplog SQL/HTTP u ms: početna lista569,6/537; mapa460,6/454; grad366,2/398; tekst „ciscenje“1986,2/2027; pretraga bez pogotka1870,9/1872. To su merene vrednosti zajedničkog CI runnera, ne cilj koji smo proglasili zadovoljenim. Tekstualna pretraga oko2s ostaje problem za optimizaciju.

**NIJE DOKAZANO:**40k istovremenih korisnika, lifecycle, celo stanjeDEV235, native FPS ili produkcijski hardver. **SLEDEĆE:** izolovani profil/komparativni eksperiment tekstualne pretrage i zasebni lifecycle workload.

## Dopuna — AI lokacija pre narednog pitanja

**URADIO:** prikaz odlaže poznati običan AI nastavak dok se ne potvrde sve lokacijske tačke. CLARIFY/CORRECT ostaju vidljivi. Poslednji CONFIRM_DISPLAYED odgovor takođe čeka kanonski ishod, čak kada je pin sačuvan u istom readback-u. Potvrđena linija prethodi nastavku; sledeći turnovi ne pomeraju staro pitanje na kraj. Bounded ID-only memorija vezana je za nalog/reviziju i stvarni conversationId, uključujući novi razgovor→izlazak→resume. Stara odgovorena pitanja se ne skrivaju preko nagađanja teksta.

**DOKAZAO / SOURCE TEST:** završne tri grupe intake-location-order, ai-owned-intake-screen i discovery-map-pills:212/212 PASS. Pokrivene su obe tačke rute, nepoznat/delimični ishod, pojašnjenja, završna potvrda, remount i promena naloga. TypeScript prethodnog koraka PASS; završni typecheck i puna regresija pokrenuti. Nezavisni pregled je pronašao i root ispravio poslednju glasovnu potvrdu, remount, hladno istorijsko pitanje i openRequestId→conversationId promenu ključa. Puna regresija otkrila je stara dva očekivanja o kretanju attribution-a, usaglašena sa poslednjom odlukom vlasnika; ciljane map provere sada prolaze. Konfiguracioni Firebase test je u paralelnom lokalnom izvršavanju prešao procesni timeout i zahteva izdvojenu proveru; nije prijavljen kao PASS.

**NIJE DOKAZANO:** novi APK/provider/nativni tok i pouzdana rekonstrukcija tipa stare poruke pri hladnom startu bez metadata. Obični task odgovor sada čeka činjenice pre prikaza, pa se ne prikazuje postepeno tokom provider stream-a; worker-profile streaming ostaje. Bez server/Edge promena. **SLEDEĆE:** završna regresija, objedinjeni push, sledeći tačan APK i native pregled; kasnije fazni stream ugovor koji ne pušta buduće pitanje preko aktivne lokacije.

### Završna regresija i telefon66275774

**DOKAZAO:** puna regresija završena sa598/600 grupa,13.326 PASS,3 FAIL i9 skipped. Dva pada su stara očekivanja da attribution prati sheet, treći je Firebase procesni timeout pri paralelnom opterećenju. Završno izdvojeno izvršavanje svih pogođenih i AI grupa:4/4 grupe,225/225 PASS. Završni TypeScript PASS. Ne tvrdi se da je cela regresija ponovljena na nepromenljivom završnom commitu; svi zabeleženi padovi su zatvoreni odgovarajućim ponovnim proverama.

Phone build37855571775 uspešan, source66275774407b2cb4ccebafac508ea237aa59e930, APK SHA256105d2a0877829f6eb171925327a0ce6b58d561a04f0f29ded21f59ed577e244d. Paket je `rs.uskoci.preview`, versionCode35 (ranije spojeno napisano preview35 nije naziv paketa). Isti potpis fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c; `adb install -r` uspešan, postojeća prijava sačuvana. Lično pregledane privatne slike phone-662-home/inbox-ready/chat/keyboard.png u prethodno navedenom privatnom direktorijumu: ulaz u postojeći chat, ime/inicijali uz izlazne nizove, čitljiv tekst, kompaktno zaglavlje i composer iznad otvorene prazne tastature. Nije slata poruka. Nije dokaz grupnog chata, dolaznog avatara, AI provider-a ili kasnijeg location-order paketa.

**SLEDEĆE / PRIPREMA:** profil40k reader-a sada čita transakcionu statistiku jednog authenticated poziva pre rollback-a, bez globalnog brojača/flush pretpostavke. Četiri upita, sve overload funkcije, stroga provera jednog reader poziva; top8 samo u čitljivom sažetku. Offline Node i postojeći SQL generator checks PASS, novi runtime tek sledi. Reč je o instrumentaciji izolovanog dokaza, ne optimizaciji DEV-a.

## Dopuna — fizički otkriveno prekrivanje liste navigacijom

**URADIO / OTKRIO:** na telefonu66275774 mapa ostane preko celog ekrana, a donji tabbar prekrije count i handle spuštene liste. Vidljiv samo zaobljeni rub; swipe odatle pomeri mapu. Privatni dokazi phone-662-discovery.png i phone-662-discovery-drag.png. Nije dokazano koji konkretan native callback niz nastaje pri hladnom ulazu. SOURCE pregled pokazuje reproduktivan problem: onAnimate(PEEK,HALF) unapred otkrije bar, a povratak na originalni PEEK može proći bez onAnimate/onChange; traženi indeks nije stvarna visina.

**ISPRAVKA / SOURCE:** bar prati prelaz fizičkog animatedPosition na HALF, uz odvojene focus/account/mount ograde. onAnimate više ne određuje vidljivost. Kartica pina ima prednost. Tolerancija HALF ne uključuje PEEK čak kada ih deli1px. Nema proizvoljnog povećanja peek visine niti promene izvora mape. Prvi3-suite test250 PASS i TypeScript PASS; finalno ponavljanje posle uske threshold korekcije pokrenuto. Test uključuje prekinut povratak bez izmišljenog onChange i zakašnjele isporuke posle blur/scope promene.

**NIJE DOKAZANO:** native ispravka na novom APK-u. Mogući kratki prenos starog parent position pri keyed remount-u ostaje native rub za pregled, ne potvrđen trajni kvar. **SLEDEĆE:** objedinjeni APK sa AI redosledom i ovom korekcijom; hladan ulaz, sva3 stanja, prekid, pin, Detail/Back.

Emulator build37855571254, isti66275774, SHA25602c35fc8c7055b29536b6c3a16de6f935c22a4a9ca5990c2dc27bd3006f0e0fb, isti potpis/paket/versionCode35; install-r PASS. Ulazni ekran pregledan. Preview je i pre instalacije bio odjavljen i ostao tako; nije kopiran token iz drugog dev paketa.

Profil40k pokrenut samim push-em: run37858643191, source774d2a669b14deb3bca4b4077f9ff400a5947768; nema duplog dispatch-a. Dok je aktivan, ne tvrditi novi runtime PASS.

### Sledeći push paket — jedan ciljani događaj

Read-only pregled razlikuje single-target od globalnog kapaciteta. Kandidat podržava single_target/single_target_receipt uz globalni EXPO_PUSH_TRANSPORT_ENABLED=false. Sledeći korak je novi read-only capture svih13 funkcija,3 table surface-a, kataloga, certificate-a i ledger-a235; ne menjati samo stari guard225 u235. Zatim regeneracija + tačan izolovani apply/postflight/revert/reapply uz očuvanje235 promena, provera operativnog pristupa flagovima/deployu i zamrzavanje hash-eva. Tek nakon toga jedan prirodno nastali MESSAGE_RECEIVED za vlasnikov uređaj sa punom account/role/event/delivery/device/revision/session/admission vezom; ne dirati backlog. Exact-message flag i kompatibilan APK potrebni su za dokaz banner→tačan Dogovor/poruka. Pre admission-a postoji revert; posle admission-a samo target flag off i forward repair, bez brisanja evidencije. Ništa od ovog server paketa nije primenjeno ovom rundom.

### Profil40k — stvarni uzrok troška izmeren

Run37858643191 SUCCESS, source774d2a669b14deb3bca4b4077f9ff400a5947768, teardown0, provider0/push0. Četiri transakciona profila dokazuju po jedan authenticated reader poziv. Tekst ciscenje: area40.000 poziva,669,24ms sa potomcima od1340,27ms instrumentiranog RPC-a; trim78.001, fold40.002. Grad+tekst: area40.045 poziva695,34ms od1126,97ms, a fold samo7.421. Default PAGE: days40.000 poziva105,60ms od506,89ms. Ne sabirati total vremena roditelja i dece; ovo su po jedan instrumentirani poziv, ne dodatne medijane. Obične medijane/HTTP i ceo profil sa overload identitetima sačuvani su u evidence/discovery-profile-40k-37858643191.

**SLEDEĆE:** mali izolovani eksperiment deduplikacije area formattera po sirovom `(approximate_area,approximate_city,isRemote)` unutar jednog reader zahteva. Sačuvati NULL semantiku, kompletan spojeni haystack (i pogotke preko granice polja), RLS, vreme, counts/cursors/anchors, byte-identične izlaze. Baseline→candidate→baseline, sve16 kombinacije i veliki broj jedinstvenih lokacija da se izmeri i negativan slučaj. Nema novog indeksa, šeme, helpera ni S3 u tom eksperimentu. DEV nije optimizovan na osnovu samog profila.

Završno ponavljanje posle HALF/PEEK threshold korekcije:3 grupe/250 testova PASS (89,9s). Raniji250 se ne sabiraju sa ovim istim ponovljenim proverama.

Završni TypeScript nakon svih threshold izmena PASS.

## Dopuna — area formatter A/B/revert eksperiment

**URADIO:** izolovan reader eksperiment: formatiranje po jedinstvenom sirovom JSONB ključu area/city/remote umesto po svakom zadatku. Telo baseline a9b0985991f4ebfe4e95143e5cf57222; kandidat46d4baf9d6ce391710b9d428654763d4. Jedan spoljašnji DO poredi kompletan JSON baseline→candidate→baseline sa istim statement_timestamp i istim cursorima.27 task corpus redova,27 direktnih NULL/empty/boolean key/helper proba, cross-field fraze, license-only zabrana, tekst na mapi, terminal14 PAGE i3 PLACES strane. Dva fixture-a: ponovljene lokacije i skoro svaka lokacija jedinstvena; sva16 merenja u tri faze sa5 toplih SQL i3 HTTP uzorka. Izveštaj čuva i regresije, bez automatskog performance PASS-a.

**DOKAZAO / OFFLINE:** generatori i postojeća22 SQL/PLpgSQL tela PASS; novi kandidat i5 stvarno sastavljenih SQL statementa, uključujući ugnježden apply/revert i exact DO, parsirani bez baze. Node syntax PASS. Dva nezavisna read-only pregleda nisu našla bloker; dopunjene ranije rupe za MAP text, PLACES terminal i NULL ključ. Dokumentacija [PostgreSQL CTE](https://www.postgresql.org/docs/current/queries-with.html) korišćena za materijalizaciju; ponašanje mora dokazati stvarni runtime. Supabase changelog.md nije bio dostupan web alatu (unsupported text/markdown), bez pretpostavke da zato promena nema.

**NIJE DOKAZANO:** runtime novog eksperimenta, ubrzanje, DEV promotion,40k korisničkih lifecycle tokova. Nema server/helper/šema/sertifikat promene, S3 nije uključen. Bulk fixtures i dalje koriste isključene triggere samo u disposable bazi;2 Auth naloga,1 istovremeni zahtev.

**SLEDEĆE:** jedan CI run sa tačnim izvorom; pročitati i semantiku i negativni unique-location slučaj. Novi objedinjeni APK source44e8eaff: phone37859900972, emulator37859901389 u izradi pri poslednjoj proveri. Posle potpisa/install-r potvrditi mapu nativno. Za lifecycle sledeći mali product-RPC driver mora zadržati pozadinske radnike aktivnim: postojeći EX06 parkForeign bi ih suspendovao i učinio load lažno lakim. Discovery replay nema pun chat lanac; ne predstavljati ga kao whole-app stanje235.
