# Forenzički registar dizajn ograničenja

Datum: 18.10.2026. Baseline: `eaa38a04e20be24bba71840660493b634180ee72`. Aktivan pravac: [Premium White](PREMIUM_WHITE_CANON.md). [Potpuni mašinski registar](DESIGN_CONSTRAINT_REGISTRY_20261018.json).

## Granica ovog nalaza

### Fizičke zamene u povezanom UI paketu — 20.10.2026.

Ovaj dodatak se odnosi na runtime/test diff prvog paketa iz odobrenog `UI_DIRECTION_REVIEW_20261020.md`. Raniji inventar ispod ostaje datiran, a isporuku potvrđuje zaseban CI/APK dokaz.

| Povučeno ograničenje | Konkretno mesto | Razlog i zamena |
| --- | --- | --- |
| Početne akcije tačno 88 dp, ilustracija tačno 64 dp | `HomePresentation`, `HomeLaunchArt`, odgovarajući assertion u `v3-home-screen.test` | Kompaktne tonirane namere; veliki tekst prelazi u pune redove. Ostaju oba odredišta, minimum dodira, prirodan rast i neodsečen tekst. Stvarne obaveze prethode opštim prečicama. |
| Navigacija obavezno skrivena na PEEK i uz pin | `DiscoveryPresentation`, uklonjen `zadaciBarRevealTop`, odgovarajuće grupe `discovery-presentation` i `zadaci-bar` | Četiri odredišta stalno dostupna pri pregledanju. Novi testovi čuvaju rezervisan prostor, povratak, bez dodatnih animacija pri pomeranju sheet-a i lifecycle. Ostali testovi native visibility/cancel ostaju. |
| Samo jedna grupa filtera otvorena | `DiscoverySearchPanel`, `discovery-search-panel`, helper u `discovery-presentation` | Sve tri kratke grupe odmah vidljive; samo kalendar ima disclosure. Sačuvani nacrt, reset, Back, nepromenjeni rezultati pre potvrde, serverski broj i retry. |
| Odvojene plutajuće kutije za svaku grupu | Uklonjen nekorišćen `SearchSheet.separated` prop i stilovi | Jedna čitljiva bela površina; modal, safe area, keyboard, scroll i sticky potvrda ostaju. |
| Kapsule sa tačno zadatom raised/inset senkom | Relevantni assertions u `discovery-presentation` | Tiša kapsula unutar punog dodira. Proveravaju se izbor, tekst, check i accessibility state, a ne dekorativna senka. |
| Zaseban veliki red aktivne pretrage / kontrola tačno 56 dp | `DiscoverySearchBar`, `discovery-search-pill` | Kontekst unutar postojeće search kontrole; puna vrednost ostaje izgovorena, zasebno clear i filter dugme. Provera minimalne dodirne površine umesto tačne dekorativne veličine. |
| Zvono mora biti konkretna 32 dp ilustracija | `InboxBell`, jedan assertion `inbox-bell` | Centralni funkcionalni glyph. Sačuvani broj, nepoznato stanje, identitet naloga, otvaranje inbox-a, Reduce Motion i prekid animacije. |
| Svaka činjenica kartice velika ilustracija; centriran naslov detalja | `TaskRecordBody`, `TaskDecision`, `TaskDetailSummary`, oba detail ekrana | Budžet, naslov i osoba vode; pomoćne činjenice koriste centralne simbole. Sačuvani svi podaci, full spoken summary, privatnost, owner/worker statusi i akcije. |

Dopuna integracije: konkretni isti assertions usklađeni su i u `discovery-chip-row`, `screen-chrome`, `dizajn-zadaci-gallery`, `zadaci-guards-from-marketplace` i `task-card-face`. Izolovani card testovi sada mock-uju centralni Glyph; njegov stvarni registar zadržava sopstvene provere. `Skeleton` je fizički usklađen sa novom karticom jer je stara geometrija pravila razliku 25–29 dp. Provera skoka visine nije ublažena: popravljen je placeholder. Mašinski zapis: `connectedUi20261020`.

Nijedan mešoviti testni fajl nije obrisan. Novi simboli su u istom `Glyph` registru; paleta, Surface i motion nemaju paralelne vlasnike. Native prihvatanje se ne izvodi iz ove tabele.

- **101 test fajlova / 1313 statičkih grupa** je inventarisano. `it.each` je jedna deklarisana grupa; ovo nije broj izvršenih testova.
- **171 grupa** ima konkretno pregledanu klasifikaciju. Preostalih **1142** su jasno označeni **MEHANICKI_PREDLOG** za pregled pri promeni pogođene porodice. Nije ručno pregledan svaki assertion u svim grupama.
- Pročitano je 17 dokumenata kao celina; 1860 pasusa/pravila je mehanički izdvojeno sa lokacijom i predlogom klasifikacije u pregledanoj porodici. Nije svaka tabelarna ćelija posebno ručno verifikovana. 45 istorijskih ekran-zapisa i 179 authority izvora imaju zasebnu klasifikaciju.
- **Dokument ne uklanja gate iz koda.** Oznaka ZASTARELI_FREEZE znači da taj zahtev više nije vizuelni autoritet. Dok test nije izmenjen, i dalje može pasti. Tačne promene i PASS pripadaju integracionom diff-u/CI, ne ovom spisku.
- Prava, privatnost, istinitost, očuvanje unosa, idempotentnost, lifecycle i pristupačnost ostaju obavezni i u mešovitoj freeze grupi. Ne brisati ceo test zato što jedna geometrijska jednakost zastareva.

## Fizičko zatvaranje dokumentacionog autoriteta — 18.10.2026.

Po odobrenom resetu, tek posle sačuvanog baseline manifesta, izmenjeno je **26 dokumentacionih fajlova + ovaj MD/JSON registar**. **19** istorijskih motion/V28/cloud-handoff/oktobarskih izvora dobilo je fizički banner sa direktnim linkom na jedini aktivan canon. Još **13** već dodatih history bannera je provereno i sačuvano. Nije prepisana istorija funkcionalnih rezultata niti ukinuta privatnost, autorizacija, recovery ili pristupačnost.

Canon i aktivni ulazi sada imaju **devet talasa**, **jedan pregled i jednu „Izmeni kroz razgovor“**, svesno smerno deljenje telefona/adrese bez automatskog otkrivanja, granicu opoziva već viđenog ili običnog teksta i precizno razlikovanje budžeta/ponude/prihvaćene cene/isplate. Gostujući AI, regionalno pokrivanje, responseDeadline AI činjenica, portfolio i grupni mediji nisu proglašeni isporučenim.

| Nivo | Stvarno značenje | Šta ovaj paket zatvara |
| --- | --- | --- |
| Mehanički kandidat | Predlog iz naslova/tela; čitanje tek predstoji | Ništa automatski; **1142** ostaju prethodni mehanički predlozi |
| Pregledana grupa | Ugovor/freeze konkretno pročitan | **171** je raniji inventar, ne broj novozavršenih testova |
| Fizički dokumentacioni autoritet | Sadržaj promenjen/history banner dodat u imenovanom fajlu | **26 + 2** dokumentaciona fajla; tačni pre/posle hash-evi u JSON i privatnom closure manifestu |
| Test gate / runtime | Test stvarno promenjen uz proveru očuvanog ponašanja | **0** test/runtime fajlova u ovoj celini; prethodni receipts imaju sopstveni obuhvat |
| Isporuka | Commit, CI, DEV/APK i stvaran uređaj, prema sloju | Ovaj docs paket ne daje novi PASS, deployment ili native prihvatanje |

JSON polje `documentationClosure` daje tačnu listu i veze. Privatni radni zapis: `work/premium-reset-20261018/docs-closure.md`. Baseline tabele ispod ostaju datirani inventar; njihovi stari brojevi linija i hash-evi ne opisuju novu kompoziciju dokumenta. **Ne tvrdi se da su hiljade pravila zatvorene.**

### Dodatno zatvaranje aktivne LIVE table

Aktivni `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html` je fizički zamenjen kompaktnom projekcijom registra/baseline-a/canona. Stari HTML je sačuvan byte-for-byte u `docs/authority/history/USKOCI_OPERATIVNI_MASTER_PLAN_PRE_PREMIUM_20261018.html`, uz zaseban provenance. Sva **62** flow ID-a i schema1/14 DOM elemenata generatora ostaju; devet talasa je iz canona. Stari source-md/search-data i istorijske operativne instrukcije nisu u aktivnom prikazu. Svih **179** authority source redova ima sopstvenu `currentApplicability: HISTORICAL_PROVENANCE_ONLY`, uz potpuno očuvana originalna polja.

Generator `--check` prolazi. Lokalni headless Chrome na **1440 i 390 px**: bez horizontalnog overflow-a ili JS grešaka; pretraga A01, otvaranje toka, filter, ispravan/neispravan lokalni JSON provereni. Ovo je provera dokumenta, bez app/DEV/native isporuke. `liveOverviewClosure` u JSON-u vezuje tačne hash-eve i ograničenja; raniji `documentationClosure` ostaje datirani snapshot.

## Klasifikacija

| Klasa | Grupe testova (uključuju predloge) | Pravila/pasusi dokumenata |
| --- | ---: | ---: |
| OBAVEZNA_ZASTITA | 460 | 204 |
| EVOLUIRAJUCA_SMERNICA | 720 | 1593 |
| ZASTARELI_FREEZE | 133 | 63 |

## Nalazi koji određuju prvi foundation paket

1. Surface: materijal/tone i interakcija nezavisni; pasivni inset dozvoljen, aktivne ugnježdene komande zaštićene.
2. Tokeni/layout: jedna semantička skala, bez fiksnog spiska svih budućih brojeva, samo-belih kartica i univerzalne zabrane senke/hairline-a.
3. Ikone: dvobojna 2.5D porodica i semantički tonovi; ostaju kontrast, prepoznatljivost i zabrana lažne potvrde.
4. Entry: poreklo i bezbednost resursa ostaju; stari Chrome/V396/V4.9 položaji i putanje ne zaključavaju native kompoziciju.
5. Motion: uloge i lifecycle; Reduce Motion i otkazivanje ostaju. Tačna trajanja, curve, stari rise i broj SVG čvorova nisu globalni canon.
6. Galerije: ne ulaze u proizvodne rute i ne vrše poslovne upise. Stari ručni editor u galeriji nije zahtev za ponovno uvođenje u AI tok.
7. Preostali precizni recepti kartica/redova ne predstavljaju završenu adaptaciju: usklađuju se pri implementaciji odgovarajuće porodice.

## Paralelna implementacija prve celine

Root i motion agent prijavili su konkretne zamene freeze-a u Surface/layout/token/Entry/action/card/gallery/motion/state/skeleton/FactArt grupama. JSON `integrationSourceUpdates` beleži tačne baseline linije i hash izmenjenog fajla u radnoj kopiji. Oznaka **IZMENA_PRIJAVLJENA_I_FAJL_IZMENJEN_CEKA_INTEGRACIONI_DOKAZ** razlikuje te grupe od preostalih **ZA_ZAMENU_KADA_SE_POGODJENA_GRUPA_MENJA**. Ovo nije potvrda prolaza punog CI-a ili native isporuke; glavni agent dodaje taj dokaz u postojeći registar isporuke.

### Dodatni ciljani semantički paket — izvršen

Sedam fajlova (`avatar`, `disclosure`, `flow-footer`, `glyph-board`, `screen-chrome`, `section`, `state-rules`) je izmenjeno bez runtime promena. **7 suites / 98 tests PASS**, 10,548 s. Uklonjeni su isključivo stari estetski/source recipe assertioni: wrapper/senka, 2 dp okvir, 180 ms, 20/12/12/8, tačan JSX i stari naslovi galerije, no-frame zabrana, 15 px/48 tačno i obavezni tekst „one green action“ u komentaru. Ostaju identitet, semantika stanja, safe area, čitljiv sadržaj, kontrola komande i Reduced Motion. JSON `targetedSemanticTestResult` sadrži komandu, hash svih sedam fajlova i rezultat. To nije kompletna integraciona regresija ili native provera.

## Konkretno pregledane test-grupe

Lokacije su iz baseline komita, pre paralelnih izmena ovog paketa. Sledeći spisak je nalaz, ne lista već završenih test-ispravki.

| ID / fajl:linija | Klasa | Nalaz | Nova zaštita |
| --- | --- | --- | --- |
| T0160 · src/data/__tests__/dizajn-dogovori.test.tsx:62 | ZASTARELI_FREEZE | has one green action, the actions as rows of the page and no "···", and says no sentence that the ⓘ says — Broj/zabrana menija i tačan raspored koraka pripadaju staroj kompoziciji. | Razumljivi uslovi i dostupna sledeća radnja pri običnom i velikom tekstu, uz očuvane lifecycle/privatnost testove. |
| T0161 · src/data/__tests__/dizajn-dogovori.test.tsx:71 | ZASTARELI_FREEZE | draws the four steps in one row at the owner's phone and text size, and as a column at 1.3, with every word whole — Broj/zabrana menija i tačan raspored koraka pripadaju staroj kompoziciji. | Razumljivi uslovi i dostupna sledeća radnja pri običnom i velikom tekstu, uz očuvane lifecycle/privatnost testove. |
| T0168 · src/data/__tests__/dizajn-dogovori.test.tsx:126 | ZASTARELI_FREEZE | the form that reports a problem takes the place of its row, at the end of the page — Broj/zabrana menija i tačan raspored koraka pripadaju staroj kompoziciji. | Razumljivi uslovi i dostupna sledeća radnja pri običnom i velikom tekstu, uz očuvane lifecycle/privatnost testove. |
| T0177 · src/data/__tests__/dizajn-galerija-moj-zadatak.test.tsx:60 | ZASTARELI_FREEZE | a task nobody has applied to says "Još nema prijava" once, with the edit beside it and no green action — Tačno zeleno dugme, info-only objašnjenje i položaj reda zaključavaju stari ekran. | Stvarno stanje prijava/preostalih mesta, jasna sledeća radnja i bezbedno zatvaranje; tekst i kompozicija mogu evoluirati. |
| T0178 · src/data/__tests__/dizajn-galerija-moj-zadatak.test.tsx:70 | ZASTARELI_FREEZE | applications waiting for a choice are the faces, the count and the ONE green action — Tačno zeleno dugme, info-only objašnjenje i položaj reda zaključavaju stari ekran. | Stvarno stanje prijava/preostalih mesta, jasna sledeća radnja i bezbedno zatvaranje; tekst i kompozicija mogu evoluirati. |
| T0179 · src/data/__tests__/dizajn-galerija-moj-zadatak.test.tsx:77 | ZASTARELI_FREEZE | "Tražim ponude" is a fact with its picture, and what it means is one tap away behind a small ⓘ, not a sentence under it — Tačno zeleno dugme, info-only objašnjenje i položaj reda zaključavaju stari ekran. | Stvarno stanje prijava/preostalih mesta, jasna sledeća radnja i bezbedno zatvaranje; tekst i kompozicija mogu evoluirati. |
| T0184 · src/data/__tests__/dizajn-galerija-moj-zadatak.test.tsx:116 | ZASTARELI_FREEZE | what ends something is a row at the end of the page, on the screen, with the lifecycle's own question — Tačno zeleno dugme, info-only objašnjenje i položaj reda zaključavaju stari ekran. | Stvarno stanje prijava/preostalih mesta, jasna sledeća radnja i bezbedno zatvaranje; tekst i kompozicija mogu evoluirati. |
| T0187 · src/data/__tests__/dizajn-galerija-pregled.test.tsx:81 | ZASTARELI_FREEZE | every part has its own pencil, named for what it changes, and the only green is the publish — Istorijska galerija obavezuje ručne olovke i editore cene/vremena/roka. | Aktivni tok menja činjenice kroz AI razgovor, sa tematskim ulazom i eksplicitnim Save; mapa ostaje ljudska potvrda. Inertnost galerije mora ostati. |
| T0197 · src/data/__tests__/dizajn-galerija-pregled.test.tsx:156 | ZASTARELI_FREEZE | under a large text size the pencils keep their names and lose their word — Istorijska galerija obavezuje ručne olovke i editore cene/vremena/roka. | Aktivni tok menja činjenice kroz AI razgovor, sa tematskim ulazom i eksplicitnim Save; mapa ostaje ljudska potvrda. Inertnost galerije mora ostati. |
| T0198 · src/data/__tests__/dizajn-galerija-pregled.test.tsx:166 | ZASTARELI_FREEZE | the price is an amount field with the tabs of its facts, and the other pencils are gone — Istorijska galerija obavezuje ručne olovke i editore cene/vremena/roka. | Aktivni tok menja činjenice kroz AI razgovor, sa tematskim ulazom i eksplicitnim Save; mapa ostaje ljudska potvrda. Inertnost galerije mora ostati. |
| T0199 · src/data/__tests__/dizajn-galerija-pregled.test.tsx:173 | ZASTARELI_FREEZE | the time is the pickers of its start, with the tabs of its facts — Istorijska galerija obavezuje ručne olovke i editore cene/vremena/roka. | Aktivni tok menja činjenice kroz AI razgovor, sa tematskim ulazom i eksplicitnim Save; mapa ostaje ljudska potvrda. Inertnost galerije mora ostati. |
| T0200 · src/data/__tests__/dizajn-galerija-pregled.test.tsx:178 | ZASTARELI_FREEZE | the deadline is its own editor, in the place of the deadline — Istorijska galerija obavezuje ručne olovke i editore cene/vremena/roka. | Rok za prijave ostaje read-only dok povezani AI/backend ugovor za izmenu nije isporučen. Stari ručni editor ne vraćati; ne tvrditi da AI već menja rok. Mapa ostaje ljudska potvrda, a inertnost galerije obavezna. |
| T0201 · src/data/__tests__/dizajn-galerija-pregled.test.tsx:184 | ZASTARELI_FREEZE | what the page does not say yet is one row, which opens the facts as rows with their pencil — Istorijska galerija obavezuje ručne olovke i editore cene/vremena/roka. | Aktivni tok menja činjenice kroz AI razgovor, sa tematskim ulazom i eksplicitnim Save; mapa ostaje ljudska potvrda. Inertnost galerije mora ostati. |
| T0312 · src/data/__tests__/entry-spoj-brand-geometry.test.ts:7 | ZASTARELI_FREEZE | matches original HTML geometry at $time ms / $phone.width px — Potpuno poklapanje sa izvornim HTML-om određuje aktuelni native izgled. | Ograničena konačna geometrija, ispravno statično stanje i bezbedni rubni ulazi. |
| T0313 · src/data/__tests__/entry-spoj-brand-geometry.test.ts:20 | OBAVEZNA_ZASTITA | provides the exact final state immediately with reduced motion — Reduced Motion i nevažeće mere su stvarne runtime granice. | Sačuvati konačno statično stanje i odbijanje NaN/negativne/neizmerene geometrije. |
| T0314 · src/data/__tests__/entry-spoj-brand-geometry.test.ts:29 | OBAVEZNA_ZASTITA | rejects unmeasured or non-finite geometry — Reduced Motion i nevažeće mere su stvarne runtime granice. | Sačuvati konačno statično stanje i odbijanje NaN/negativne/neizmerene geometrije. |
| T0316 · src/data/__tests__/entry-spoj-surface.test.tsx:107 | ZASTARELI_FREEZE | mounts the two exact local portraits and SVG notes without an image network request or loading transition — Dva originalna portreta, tačan rIntroFrame i obavezne dve kolone jesu stara kompozicija. | Autorizovane namere, lokalni bezbedni resursi, vidljive komande i sadržaj pri velikom tekstu; stari callback ne upravlja novijom sesijom. |
| T0319 · src/data/__tests__/entry-spoj-surface.test.tsx:160 | ZASTARELI_FREEZE | keeps the panel boundary synchronized with original rIntroFrame at %i ms — Dva originalna portreta, tačan rIntroFrame i obavezne dve kolone jesu stara kompozicija. | Autorizovane namere, lokalni bezbedni resursi, vidljive komande i sadržaj pri velikom tekstu; stari callback ne upravlja novijom sesijom. |
| T0320 · src/data/__tests__/entry-spoj-surface.test.tsx:167 | ZASTARELI_FREEZE | preserves the selected original scene during %s sweep, keeping the white lockup — Dva originalna portreta, tačan rIntroFrame i obavezne dve kolone jesu stara kompozicija. | Autorizovane namere, lokalni bezbedni resursi, vidljive komande i sadržaj pri velikom tekstu; stari callback ne upravlja novijom sesijom. |
| T0337 · src/data/__tests__/entry-spoj-surface.test.tsx:380 | ZASTARELI_FREEZE | retains both portraits and reflowing note text with the source large-text two-column composition — Dva originalna portreta, tačan rIntroFrame i obavezne dve kolone jesu stara kompozicija. | Autorizovane namere, lokalni bezbedni resursi, vidljive komande i sadržaj pri velikom tekstu; stari callback ne upravlja novijom sesijom. |
| T0339 · src/data/__tests__/entry-v49-reference.test.ts:11 | OBAVEZNA_ZASTITA | binds the four native assets and vector adapter to the exact owner V4.9 bytes — Provenance, pravi format, Reduced Motion i dostupnost sadržaja ostaju relevantni. | Zadržati integritet arhiviranih resursa i odbijanje skripti; novi legitimni asset ima novi manifest, a novi layout ne mora da kopira stari. |
| T0340 · src/data/__tests__/entry-v49-reference.test.ts:22 | OBAVEZNA_ZASTITA | names both original portraits by their actual embedded format without re-encoding — Provenance, pravi format, Reduced Motion i dostupnost sadržaja ostaju relevantni. | Zadržati integritet arhiviranih resursa i odbijanje skripti; novi legitimni asset ima novi manifest, a novi layout ne mora da kopira stari. |
| T0341 · src/data/__tests__/entry-v49-reference.test.ts:39 | ZASTARELI_FREEZE | matches real Chrome final V396 measured layout at %s — Runtime je izjednačen sa starim Chrome/V396 koordinatama, crop-om ili vremenima. | Konačna/nenegativna geometrija, vidljiv logo i sadržaj, safe area, mogućnost reflow-a i stabilno završavanje; sačuvati referencu samo kao istorijski uzorak. |
| T0342 · src/data/__tests__/entry-v49-reference.test.ts:46 | ZASTARELI_FREEZE | matches Chrome original part/seam wrappers at $timeMs ms — Runtime je izjednačen sa starim Chrome/V396 koordinatama, crop-om ili vremenima. | Konačna/nenegativna geometrija, vidljiv logo i sadržaj, safe area, mogućnost reflow-a i stabilno završavanje; sačuvati referencu samo kao istorijski uzorak. |
| T0343 · src/data/__tests__/entry-v49-reference.test.ts:54 | ZASTARELI_FREEZE | matches actual Chrome selected-scene sweep at $timeMs ms — Runtime je izjednačen sa starim Chrome/V396 koordinatama, crop-om ili vremenima. | Konačna/nenegativna geometrija, vidljiv logo i sadržaj, safe area, mogućnost reflow-a i stabilno završavanje; sačuvati referencu samo kao istorijski uzorak. |
| T0344 · src/data/__tests__/entry-v49-reference.test.ts:61 | OBAVEZNA_ZASTITA | renders all parts immediately under reduced motion at %i ms — Provenance, pravi format, Reduced Motion i dostupnost sadržaja ostaju relevantni. | Zadržati integritet arhiviranih resursa i odbijanje skripti; novi legitimni asset ima novi manifest, a novi layout ne mora da kopira stari. |
| T0345 · src/data/__tests__/entry-v49-reference.test.ts:64 | OBAVEZNA_ZASTITA | keeps measured content ordered and safely scrollable at %i×%i scale%i — Provenance, pravi format, Reduced Motion i dostupnost sadržaja ostaju relevantni. | Zadržati integritet arhiviranih resursa i odbijanje skripti; novi legitimni asset ima novi manifest, a novi layout ne mora da kopira stari. |
| T0346 · src/data/__tests__/entry-v49-reference.test.ts:74 | ZASTARELI_FREEZE | does not compress the authored photos to fit larger hit targets or repeatedly apply the V396 delta — Runtime je izjednačen sa starim Chrome/V396 koordinatama, crop-om ili vremenima. | Konačna/nenegativna geometrija, vidljiv logo i sadržaj, safe area, mogućnost reflow-a i stabilno završavanje; sačuvati referencu samo kao istorijski uzorak. |
| T0347 · src/data/__tests__/entry-v49-reference.test.ts:81 | ZASTARELI_FREEZE | preserves the original photo crop and motion travel with real device insets at %i×%i scale%i — Runtime je izjednačen sa starim Chrome/V396 koordinatama, crop-om ili vremenima. | Konačna/nenegativna geometrija, vidljiv logo i sadržaj, safe area, mogućnost reflow-a i stabilno završavanje; sačuvati referencu samo kao istorijski uzorak. |
| T0365 · src/data/__tests__/own-task-card.test.tsx:195 | ZASTARELI_FREEZE | is a raised record with a neutral edge and 24 corners: the state is the chip, never the colour of the frame — Fiksna 24 geometrija i tačan footer razdelnik ne predstavljaju poslovni ugovor. | Owner kartica jasno razlikuje stanje, preostala mesta i sledeću odluku; semantički Surface tokeni. |
| T0366 · src/data/__tests__/own-task-card.test.tsx:201 | ZASTARELI_FREEZE | only a task that waits for my decision has a foot, and the foot has one line above it and no other — Fiksna 24 geometrija i tačan footer razdelnik ne predstavljaju poslovni ugovor. | Owner kartica jasno razlikuje stanje, preostala mesta i sledeću odluku; semantički Surface tokeni. |
| T0418 · src/data/__tests__/task-card-face.test.tsx:66 | ZASTARELI_FREEZE | says title, amount with what it buys, where, when, count of people and who, in that order, and nothing else — Tačan redosled svake činjenice, broj tipografskih rola i zabrana svakog unutrašnjeg bloka zamrzavaju karticu. | Čitljivo šta/gde/kada/cena/ljudi uz javnu privatnost; koherentne role i bez ugnježdenih aktivnih komandi. |
| T0419 · src/data/__tests__/task-card-face.test.tsx:74 | ZASTARELI_FREEZE | draws the amount as the first fact, under the title, with the money picture and no word for what it is — Tačan redosled svake činjenice, broj tipografskih rola i zabrana svakog unutrašnjeg bloka zamrzavaju karticu. | Čitljivo šta/gde/kada/cena/ljudi uz javnu privatnost; koherentne role i bez ugnježdenih aktivnih komandi. |
| T0420 · src/data/__tests__/task-card-face.test.tsx:84 | ZASTARELI_FREEZE | uses four type roles at most: the title, the amount, the facts and the person, the state — Tačan redosled svake činjenice, broj tipografskih rola i zabrana svakog unutrašnjeg bloka zamrzavaju karticu. | Čitljivo šta/gde/kada/cena/ljudi uz javnu privatnost; koherentne role i bez ugnježdenih aktivnih komandi. |
| T0424 · src/data/__tests__/task-card-face.test.tsx:121 | ZASTARELI_FREEZE | then the vehicles with the vehicle fact drawing, then the tools with the tool fact drawing — Tačan redosled svake činjenice, broj tipografskih rola i zabrana svakog unutrašnjeg bloka zamrzavaju karticu. | Čitljivo šta/gde/kada/cena/ljudi uz javnu privatnost; koherentne role i bez ugnježdenih aktivnih komandi. |
| T0453 · src/data/__tests__/task-card-face.test.tsx:463 | ZASTARELI_FREEZE | draws no frame of its own: the Surface is the only container and there is no card inside it — Tačan redosled svake činjenice, broj tipografskih rola i zabrana svakog unutrašnjeg bloka zamrzavaju karticu. | Čitljivo šta/gde/kada/cena/ljudi uz javnu privatnost; koherentne role i bez ugnježdenih aktivnih komandi. |
| T0581 · src/ui/system/__tests__/action-states.test.tsx:209 | ZASTARELI_FREEZE | draws every primary action green with a white label in any tone: neutral never makes one black — Svaka primarna/druga radnja ima obavezno istu zelenu/belu kombinaciju. | Pristupačan kontrast konkretnog semantic tone-a, jednoznačan prioritet i stvarni disabled/busy status. |
| T0582 · src/ui/system/__tests__/action-states.test.tsx:231 | ZASTARELI_FREEZE | writes the label white on the brand surface and green on every other action — Svaka primarna/druga radnja ima obavezno istu zelenu/belu kombinaciju. | Pristupačan kontrast konkretnog semantic tone-a, jednoznačan prioritet i stvarni disabled/busy status. |
| T0600 · src/ui/system/__tests__/appear.test.tsx:160 | ZASTARELI_FREEZE | steps by sys.motion.stagger per row, and gives every row past the sixth the delay of the sixth — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0601 · src/ui/system/__tests__/appear.test.tsx:173 | ZASTARELI_FREEZE | a row that arrives at position 40 waits no longer than the one at position 6, and every entrance is one enter long — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0602 · src/ui/system/__tests__/appear.test.tsx:195 | ZASTARELI_FREEZE | is given easeOut explicitly, the one curve of every entrance — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0603 · src/ui/system/__tests__/appear.test.tsx:201 | ZASTARELI_FREEZE | starts 8 dp below its place, the rise of the outcome bar, not the 25 dp of the preset — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0604 · src/ui/system/__tests__/appear.test.tsx:209 | ZASTARELI_FREEZE | comes from above (-8 dp) when `from="above"`, from below (+8 dp) by default and when `from="below"`: only the side differs — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0605 · src/ui/system/__tests__/appear.test.tsx:223 | ZASTARELI_FREEZE | gives every row of a list the same curve and the same rise, whatever its position — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0607 · src/ui/system/__tests__/appear.test.tsx:242 | ZASTARELI_FREEZE | keeps each doc on its own declaration: the list's memory is documented on useAppear, not on the constant above it — Tačan rise/broj redova/curve ili mesto JSDoc komentara jeste source/layout freeze. | Primerena content kategorija, ograničeno odloženo prikazivanje, očuvan identitet i lifecycle; dokumentacija mora biti razumljiva, ne na staroj liniji. |
| T0688 · src/ui/system/__tests__/fact-art.test.tsx:185 | ZASTARELI_FREEZE | draws the flat mark at 24 px and below and the sticker above, so no call site needs an edit — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0689 · src/ui/system/__tests__/fact-art.test.tsx:193 | ZASTARELI_FREEZE | lets the board force a cut, and a size between the two cuts (a Profil row, 26 px) keeps the sticker — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0690 · src/ui/system/__tests__/fact-art.test.tsx:199 | ZASTARELI_FREEZE | draws what the cut says at %i px: no ground shadow in the mark, one in the sticker — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0692 · src/ui/system/__tests__/fact-art.test.tsx:218 | OBAVEZNA_ZASTITA | draws every kind at every size in use, hidden from screen readers, on the 32-unit canvas — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0693 · src/ui/system/__tests__/fact-art.test.tsx:233 | OBAVEZNA_ZASTITA | renders a picture of each cut, hidden from screen readers, at the size asked for — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0694 · src/ui/system/__tests__/fact-art.test.tsx:246 | ZASTARELI_FREEZE | %s draws green, with no orange, at 16 px, and turns grey when it is not active — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0695 · src/ui/system/__tests__/fact-art.test.tsx:258 | ZASTARELI_FREEZE | keeps the default size at 20 and accepts `muted` as before, drawing the same shapes in the quiet tone — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0696 · src/ui/system/__tests__/fact-art.test.tsx:272 | OBAVEZNA_ZASTITA | %s lies inside the canvas, with no hairline stroke or sliver of fill — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0697 · src/ui/system/__tests__/fact-art.test.tsx:289 | ZASTARELI_FREEZE | %s draws no ground shadow, no edge and no shine: one fill tone and white, nothing else — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0698 · src/ui/system/__tests__/fact-art.test.tsx:296 | OBAVEZNA_ZASTITA | %s keeps every white detail on the tone: a white detail that falls off its shape vanishes on a white card — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0699 · src/ui/system/__tests__/fact-art.test.tsx:311 | ZASTARELI_FREEZE | draws every kind in the tone it is given, and nothing but that tone and white — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0700 · src/ui/system/__tests__/fact-art.test.tsx:318 | OBAVEZNA_ZASTITA | keeps every tone at 3:1 or more against white, and the white detail at 3:1 or more against the tone — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0701 · src/ui/system/__tests__/fact-art.test.tsx:328 | ZASTARELI_FREEZE | draws both people of the pair in the full tone, side by side, the second one smaller — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0702 · src/ui/system/__tests__/fact-art.test.tsx:341 | ZASTARELI_FREEZE | draws the calendar as a body, a header band, two rings and two lines, and the clipboard as a board, a clip and two lines — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0703 · src/ui/system/__tests__/fact-art.test.tsx:352 | ZASTARELI_FREEZE | draws the mark with at most four shapes, and always fewer than the sticker — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0704 · src/ui/system/__tests__/fact-art.test.tsx:363 | ZASTARELI_FREEZE | %s keeps the approved construction: a ground shadow first, every shape inside the canvas — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0705 · src/ui/system/__tests__/fact-art.test.tsx:379 | ZASTARELI_FREEZE | reserves the attention orange palette for the bell, the star and the alert by default — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0706 · src/ui/system/__tests__/fact-art.test.tsx:388 | ZASTARELI_FREEZE | keeps the small mark in brand green and draws the large pin in its semantic location material — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0707 · src/ui/system/__tests__/fact-art.test.tsx:408 | ZASTARELI_FREEZE | turns grey when it is not active and orange or red only on request — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0708 · src/ui/system/__tests__/fact-art.test.tsx:421 | OBAVEZNA_ZASTITA | has one phrase for every kind and no two kinds share it — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0709 · src/ui/system/__tests__/fact-art.test.tsx:428 | OBAVEZNA_ZASTITA | draws no two kinds the same, in either cut — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0710 · src/ui/system/__tests__/fact-art.test.tsx:439 | ZASTARELI_FREEZE | draws the price tag, the agreement and the conversation as three different shapes — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0711 · src/ui/system/__tests__/fact-art.test.tsx:452 | ZASTARELI_FREEZE | draws the new task and the clipboard of your own list apart: a badge with a plus, and a clip — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0712 · src/ui/system/__tests__/fact-art.test.tsx:461 | OBAVEZNA_ZASTITA | finds a tick by its shape: a short stroke down and a longer one up, not an arrow head — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0713 · src/ui/system/__tests__/fact-art.test.tsx:469 | OBAVEZNA_ZASTITA | draws a tick on the check, the agreement and the shield only, in both cuts — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0714 · src/ui/system/__tests__/fact-art.test.tsx:476 | OBAVEZNA_ZASTITA | draws no tick on the calendar, the task list or the remote screen: an unconfirmed term does not wear a confirmation — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0716 · src/ui/system/__tests__/fact-art.test.tsx:498 | ZASTARELI_FREEZE | draws the four tones — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0717 · src/ui/system/__tests__/fact-art.test.tsx:504 | ZASTARELI_FREEZE | shows the two oranges side by side: the accent kinds as the sticker at 26 and as the mark at 24 — Jednobojnost, prag reza, tačan oblik/broj SVG elemenata ili fiksne četiri palete zaključavaju staru ikonografiju. | Originalna čitljiva dvobojna 2.5D porodica i prilagođen mali rez; proveriti značenje, kontrast, granice crteža i bezbedan render, ne stari path. |
| T0718 · src/ui/system/__tests__/fact-art.test.tsx:521 | OBAVEZNA_ZASTITA | draws the pin's hole shade in the tone it is in, so an orange, grey or red pin has no stray green in it — Čitljivost, dostupnost i istinita semantika ikone imaju nezavisnu korisničku svrhu. | Sačuvati skriven dekorativni opis, granice platna, prepoznatljive razlike, kontrast i odsustvo lažne potvrde. Algoritam detekcije konkretne putanje može biti zamenjen semantičkim dokazom. |
| T0813 · src/ui/system/__tests__/layout-ladder.test.ts:41 | ZASTARELI_FREEZE | %s spells no padding, margin or gap off the ladder — Fiksna lista brojeva i univerzalna zabrana platformskog hairline-a. | Koherentan imenovani sistem, finite/nonnegative mere i dokaz čitljivog razdvajanja; ne whitelist svih budućih brojeva. |
| T0814 · src/ui/system/__tests__/layout-ladder.test.ts:46 | ZASTARELI_FREEZE | %s does not draw the platform's hairline — Fiksna lista brojeva i univerzalna zabrana platformskog hairline-a. | Koherentan imenovani sistem, finite/nonnegative mere i dokaz čitljivog razdvajanja; ne whitelist svih budućih brojeva. |
| T0816 · src/ui/system/__tests__/layout-ladder.test.ts:58 | ZASTARELI_FREEZE | is every step of sys.space (4 · 8 · 12 · 16 · 20 · 24 · 32 · 48), and 0, 1 and 2 for a line and a half-leading — Fiksna lista brojeva i univerzalna zabrana platformskog hairline-a. | Koherentan imenovani sistem, finite/nonnegative mere i dokaz čitljivog razdvajanja; ne whitelist svih budućih brojeva. |
| T0817 · src/ui/system/__tests__/layout-ladder.test.ts:63 | ZASTARELI_FREEZE | every distance in layout.ts is on it — Fiksna lista brojeva i univerzalna zabrana platformskog hairline-a. | Koherentan imenovani sistem, finite/nonnegative mere i dokaz čitljivog razdvajanja; ne whitelist svih budućih brojeva. |
| T0818 · src/ui/system/__tests__/layout.test.ts:11 | ZASTARELI_FREEZE | is exactly the agreed set of names and values — Tačan skup naziva/vrednosti/exporta ili zabrana hairline-a zamrzava implementaciju. | Valjana semantička geometrija, minimum dodira i jedan izvor; nove uloge ne moraju da menjaju istorijsku listu. |
| T0819 · src/ui/system/__tests__/layout.test.ts:18 | ZASTARELI_FREEZE | has one divider, 1 dp, and it is not the platform's hairline — Tačan skup naziva/vrednosti/exporta ili zabrana hairline-a zamrzava implementaciju. | Valjana semantička geometrija, minimum dodira i jedan izvor; nove uloge ne moraju da menjaju istorijsku listu. |
| T0821 · src/ui/system/__tests__/layout.test.ts:34 | ZASTARELI_FREEZE | the edge of the screen is `sys.space.lg` (20): the one step that is an edge and never a distance between things — Tačan skup naziva/vrednosti/exporta ili zabrana hairline-a zamrzava implementaciju. | Valjana semantička geometrija, minimum dodira i jedan izvor; nove uloge ne moraju da menjaju istorijsku listu. |
| T0824 · src/ui/system/__tests__/layout.test.ts:58 | ZASTARELI_FREEZE | exports exactly `layout` and `ruleWidth` — Tačan skup naziva/vrednosti/exporta ili zabrana hairline-a zamrzava implementaciju. | Valjana semantička geometrija, minimum dodira i jedan izvor; nove uloge ne moraju da menjaju istorijsku listu. |
| T0867 · src/ui/system/__tests__/one-token-source.test.ts:59 | OBAVEZNA_ZASTITA | %s spells no colour of its own (no raw #RRGGBB, no white or black by name) — Jedan izvor i provere valjanosti/kontrasta štite stvaran sistemski ugovor. | Zadržati centralni numerički izvor, valjane boje, pristupačan kontrast i zajedničko čitanje reduced motion; ne zaključavati naziv fajla ako se API bezbedno izdvoji. |
| T0868 · src/ui/system/__tests__/one-token-source.test.ts:65 | OBAVEZNA_ZASTITA | %s reads tokens only from sys — Jedan izvor i provere valjanosti/kontrasta štite stvaran sistemski ugovor. | Zadržati centralni numerički izvor, valjane boje, pristupačan kontrast i zajedničko čitanje reduced motion; ne zaključavati naziv fajla ako se API bezbedno izdvoji. |
| T0869 · src/ui/system/__tests__/one-token-source.test.ts:72 | OBAVEZNA_ZASTITA | %s reads reduced motion from the one store — Jedan izvor i provere valjanosti/kontrasta štite stvaran sistemski ugovor. | Zadržati centralni numerički izvor, valjane boje, pristupačan kontrast i zajedničko čitanje reduced motion; ne zaključavati naziv fajla ako se API bezbedno izdvoji. |
| T0871 · src/ui/system/__tests__/one-token-source.test.ts:81 | ZASTARELI_FREEZE | the motion scale is the agreed one, and it lives in sys only — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0872 · src/ui/system/__tests__/one-token-source.test.ts:96 | ZASTARELI_FREEZE | the motion tiers of the UI/UX pass exist, with the agreed values — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0873 · src/ui/system/__tests__/one-token-source.test.ts:118 | ZASTARELI_FREEZE | the five motion tokens that nothing read are gone — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0875 · src/ui/system/__tests__/one-token-source.test.ts:135 | OBAVEZNA_ZASTITA | every named colour in sys is a real colour value, named by its whole path (sys.color.* and sys.art.* are different groups) — Jedan izvor i provere valjanosti/kontrasta štite stvaran sistemski ugovor. | Zadržati centralni numerički izvor, valjane boje, pristupačan kontrast i zajedničko čitanje reduced motion; ne zaključavati naziv fajla ako se API bezbedno izdvoji. |
| T0876 · src/ui/system/__tests__/one-token-source.test.ts:145 | ZASTARELI_FREEZE | the corner scale is 12 / 24 / 28 / pill, and a control and the primary action share one corner — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0880 · src/ui/system/__tests__/one-token-source.test.ts:209 | ZASTARELI_FREEZE | %s is a hairline card with no shadow — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0881 · src/ui/system/__tests__/one-token-source.test.ts:215 | OBAVEZNA_ZASTITA | the second motion scale is gone with the v2 token file, and no tone reads below AA on green — Jedan izvor i provere valjanosti/kontrasta štite stvaran sistemski ugovor. | Zadržati centralni numerički izvor, valjane boje, pristupačan kontrast i zajedničko čitanje reduced motion; ne zaključavati naziv fajla ako se API bezbedno izdvoji. |
| T0882 · src/ui/system/__tests__/one-token-source.test.ts:235 | OBAVEZNA_ZASTITA | keeps fact tones separate from Home illustration colors — Jedan izvor i provere valjanosti/kontrasta štite stvaran sistemski ugovor. | Zadržati centralni numerički izvor, valjane boje, pristupačan kontrast i zajedničko čitanje reduced motion; ne zaključavati naziv fajla ako se API bezbedno izdvoji. |
| T0883 · src/ui/system/__tests__/one-token-source.test.ts:241 | ZASTARELI_FREEZE | is four tones with the four parts a picture needs, all real colours — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0884 · src/ui/system/__tests__/one-token-source.test.ts:249 | ZASTARELI_FREEZE | the default tone IS the UI green, so an icon, a title and the primary action agree (no second emerald) — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0885 · src/ui/system/__tests__/one-token-source.test.ts:256 | ZASTARELI_FREEZE | every tone has depth (edge darker than front) and a front that stays readable on white — Zaključana lista/vrednost tokena ili stara univerzalna paleta, senka i geometrija. | Testirati semantičke role i stvaran kontrast; održati centralni izvor; dozvoliti novu numeričku skalu i bogatiju paletu. Kontrast u mešovitoj grupi ostaje obavezan. |
| T0886 · src/ui/system/__tests__/one-token-source.test.ts:273 | EVOLUIRAJUCA_SMERNICA | is large from text scale 1.3, narrow under 340 dp, and the designed compact layout otherwise — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0887 · src/ui/system/__tests__/one-token-source.test.ts:283 | EVOLUIRAJUCA_SMERNICA | reads Android's 1.2999999523 as the 1.3 step it is, and large wins when both reasons apply — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0888 · src/ui/system/__tests__/one-token-source.test.ts:289 | EVOLUIRAJUCA_SMERNICA | never stacks for a value that is not a measurement, and hands back one shared answer per class — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0889 · src/ui/system/__tests__/one-token-source.test.ts:296 | EVOLUIRAJUCA_SMERNICA | follows the window of the device it renders on — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0890 · src/ui/system/__tests__/one-token-source.test.ts:314 | EVOLUIRAJUCA_SMERNICA | hands the room itself to that rule: the width in dp and the text scale rounded to hundredths, one object while they hold — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0891 · src/ui/system/__tests__/one-token-source.test.ts:396 | EVOLUIRAJUCA_SMERNICA | finds each way of reading the width, aliased imports included, and nothing else — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0892 · src/ui/system/__tests__/one-token-source.test.ts:414 | EVOLUIRAJUCA_SMERNICA | only the listed files read it, every listed file still does, and the list names real files — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0893 · src/ui/system/__tests__/one-token-source.test.ts:422 | EVOLUIRAJUCA_SMERNICA | the hook is where the width is read — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0894 · src/ui/system/__tests__/one-token-source.test.ts:428 | EVOLUIRAJUCA_SMERNICA | the ratchet is an equality: a stale entry fails, and so does a raised one — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0895 · src/ui/system/__tests__/one-token-source.test.ts:490 | EVOLUIRAJUCA_SMERNICA | finds each literal form, in any expression, and lets a named token and a zero through — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0896 · src/ui/system/__tests__/one-token-source.test.ts:505 | EVOLUIRAJUCA_SMERNICA | a file outside the list spells none, and a file on it spells exactly its entry: it can only shrink, and shrinks with the code — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T0897 · src/ui/system/__tests__/one-token-source.test.ts:512 | EVOLUIRAJUCA_SMERNICA | tokens.ts is where the values are written — Pragovi responsive klase i source ratchets su implementaciona disciplina, ne vlasnički vizuelni zakon. | Čitljiv rezultat na uskom/uvećanom ekranu i relevantni API boundary; pregledati novu legitimnu upotrebu umesto večne liste prestupnika. |
| T1015 · src/ui/system/__tests__/rule-width-ratchet.test.ts:92 | ZASTARELI_FREEZE | no file spells more than its entry, and none spells fewer: it can only shrink, and shrinks with the code — Broj source pojavljivanja i hairline zabrana nisu korisnički ugovor. | Semantički divider tokeni i čitljiv razdelnik; detektor mora pregledati stvaran izvor, bez večne liste fajlova. |
| T1017 · src/ui/system/__tests__/rule-width-ratchet.test.ts:105 | ZASTARELI_FREEZE | the grid draws none: layout.ts and the six primitives spell neither, and Segmented has given up the hairline — Broj source pojavljivanja i hairline zabrana nisu korisnički ugovor. | Semantički divider tokeni i čitljiv razdelnik; detektor mora pregledati stvaran izvor, bez večne liste fajlova. |
| T1163 · src/ui/system/__tests__/skeleton.test.tsx:75 | ZASTARELI_FREEZE | is 68 dp with a picture and two lines, the same as the real row: 12 over and under, 12 between, a 40 slot, a title line and a note line — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1164 · src/ui/system/__tests__/skeleton.test.tsx:84 | ZASTARELI_FREEZE | is 64 dp with a picture and one line (the row's least), as the real row is — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1165 · src/ui/system/__tests__/skeleton.test.tsx:92 | ZASTARELI_FREEZE | is 80 dp with a face and two lines: the 56 slot decides, as it does in the real row — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1166 · src/ui/system/__tests__/skeleton.test.tsx:100 | ZASTARELI_FREEZE | draws the slot 40 wide with the 32 picture in it, and the inset rule from 52 to the right edge, 1 dp, under every row but the last — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1167 · src/ui/system/__tests__/skeleton.test.tsx:113 | ZASTARELI_FREEZE | starts its rule at 68 with a face, and has no slot and the pill of a switch at the end in a settings list — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1168 · src/ui/system/__tests__/skeleton.test.tsx:122 | ZASTARELI_FREEZE | is 56 dp for a settings row with one line and 64 with two, the real row's two heights — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1169 · src/ui/system/__tests__/skeleton.test.tsx:129 | ZASTARELI_FREEZE | puts a section title's bar over the rows when asked: a line of the heading type, 12 above what it holds — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1171 · src/ui/system/__tests__/skeleton.test.tsx:143 | ZASTARELI_FREEZE | is the height of its picture for one line, as the real fact is, and stands 8 from the next — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1172 · src/ui/system/__tests__/skeleton.test.tsx:156 | ZASTARELI_FREEZE | draws the picture at the side the real fact draws it, and a line whose first line is centred on it — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1173 · src/ui/system/__tests__/skeleton.test.tsx:164 | ZASTARELI_FREEZE | stands in the frame of a Surface record: the same white card, 24 corners, 16 padding, the same edge and shadow — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1174 · src/ui/system/__tests__/skeleton.test.tsx:175 | ZASTARELI_FREEZE | is the least a task card is with the person and two facts (about 200 dp), and 52 less without the person — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1175 · src/ui/system/__tests__/skeleton.test.tsx:187 | ZASTARELI_FREEZE | keeps 12 between the parts of the face and 4 inside a part, as the face does, and stands 12 from the next record — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1176 · src/ui/system/__tests__/skeleton.test.tsx:196 | ZASTARELI_FREEZE | draws the person at the foot only when asked, 40 with two lines; `rows` is the number of facts — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1177 · src/ui/system/__tests__/skeleton.test.tsx:215 | ZASTARELI_FREEZE | draws three facts (the amount first, then two), the person's 40 picture, and the count of people at the end of the person's line — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1178 · src/ui/system/__tests__/skeleton.test.tsx:225 | ZASTARELI_FREEZE | is as tall as the least the real card is: a title of one line, the amount, where, when, and the person; and 4 between the facts, 12 between the parts — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1180 · src/ui/system/__tests__/skeleton.test.tsx:241 | ZASTARELI_FREEZE | takes `rows` more facts after the amount, and stands 12 from the next card — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1187 · src/ui/system/__tests__/skeleton.test.tsx:308 | ZASTARELI_FREEZE | keeps the gap of every shape: rows touch (their rule parts them), records 12 apart, facts 8, the older cards 12 — Skeleton zaključava numeričku geometriju starih kartica/redova. | Placeholder odgovara stvarnoj novoj ulozi i tekst skali, bez layout skoka, interakcije ili lažnog sadržaja. |
| T1210 · src/ui/system/__tests__/state-view.test.tsx:71 | ZASTARELI_FREEZE | is one centred column, no wider than 280, with the title in the title type and the sentence in the copy type, both centred — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1211 · src/ui/system/__tests__/state-view.test.tsx:80 | ZASTARELI_FREEZE | draws the picture at 96 with nothing around it: no well, no panel, no card — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1212 · src/ui/system/__tests__/state-view.test.tsx:90 | ZASTARELI_FREEZE | lies a third of the way down: a fifth of the free room above the block and four fifths below, and never closer than 48 to what is above — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1214 · src/ui/system/__tests__/state-view.test.tsx:109 | ZASTARELI_FREEZE | keeps the steps of the grid between its parts: 16 after the picture, 8 after the title, 24 before the actions — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1226 · src/ui/system/__tests__/state-view.test.tsx:217 | ZASTARELI_FREEZE | draws the same state smaller: the picture at 48, the title in heading and the sentence in note, 16 over and under, and no lift — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1227 · src/ui/system/__tests__/state-view.test.tsx:227 | ZASTARELI_FREEZE | keeps the picture of the kind at 48 — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1237 · src/ui/system/__tests__/state-view.test.tsx:320 | ZASTARELI_FREEZE | the facts are 24 px drawings beside a label and a value, one row per fact — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1238 · src/ui/system/__tests__/state-view.test.tsx:325 | ZASTARELI_FREEZE | the person is a 56 px face, five star blanks and the tag pills — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1240 · src/ui/system/__tests__/state-view.test.tsx:345 | ZASTARELI_FREEZE | draws the picture of an empty screen at 144 and everything else as it was: the same column, the same words, the one green action and the one quiet one — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1241 · src/ui/system/__tests__/state-view.test.tsx:358 | ZASTARELI_FREEZE | is the same state without it: an empty list that is not a hero keeps its 96 — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1242 · src/ui/system/__tests__/state-view.test.tsx:365 | ZASTARELI_FREEZE | is only for an empty screen: a failure, a lost connection and an unknown outcome stay grey and still at 96, and a state inside a section stays at 48 — Fiksne širine i dimenzije 280/96/48/144 zaključavaju sve sistemske prikaze. | Stanje, čitljiv tekst i dostupna radnja; veličina ilustracije i kompozicija prilagođene kontekstu. |
| T1259 · src/ui/system/__tests__/surface-kinds-ratchet.test.ts:95 | ZASTARELI_FREEZE | no file outside Surface takes more than its entry, and none takes fewer: it can only shrink, and shrinks with the code — Source import allowlista fiksira vlasništvo naziva umesto materijala i ponašanja. | Jedan deljeni API materijala, bez duplih stilskih skala; nova legitimna uloga ne zavisi od broja starih importera. |
| T1260 · src/ui/system/__tests__/surface-kinds-ratchet.test.ts:104 | ZASTARELI_FREEZE | every entry names a real file that is not Surface, and only names real tokens — Source import allowlista fiksira vlasništvo naziva umesto materijala i ponašanja. | Jedan deljeni API materijala, bez duplih stilskih skala; nova legitimna uloga ne zavisi od broja starih importera. |
| T1261 · src/ui/system/__tests__/surface-kinds-ratchet.test.ts:111 | ZASTARELI_FREEZE | Surface really is the file that takes them, and the tokens still exist where it takes them from — Source import allowlista fiksira vlasništvo naziva umesto materijala i ponašanja. | Jedan deljeni API materijala, bez duplih stilskih skala; nova legitimna uloga ne zavisi od broja starih importera. |
| T1262 · src/ui/system/__tests__/surface.test.tsx:26 | ZASTARELI_FREEZE | is white with the shadow of a raised item, 24 corners and 16 padding — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1263 · src/ui/system/__tests__/surface.test.tsx:34 | OBAVEZNA_ZASTITA | with onPress is one button for the whole card, that gives on the row rung and says its label and hint — Grupa pokriva dostupnu interakciju, override ili dijagnostiku bez produkcionog curenja. | Zadržati tačno aktiviranje komande, dostupno ime, neaktivnu površinu bez lažnog dugmeta i razvojne granice logovanja. |
| T1264 · src/ui/system/__tests__/surface.test.tsx:46 | OBAVEZNA_ZASTITA | without onPress is a plain view: nothing is pressed, and nothing is said unless the caller labels it — Grupa pokriva dostupnu interakciju, override ili dijagnostiku bez produkcionog curenja. | Zadržati tačno aktiviranje komande, dostupno ime, neaktivnu površinu bez lažnog dugmeta i razvojne granice logovanja. |
| T1265 · src/ui/system/__tests__/surface.test.tsx:54 | OBAVEZNA_ZASTITA | keeps the caller's style last, so a card can be told its width or its margin — Grupa pokriva dostupnu interakciju, override ili dijagnostiku bez produkcionog curenja. | Zadržati tačno aktiviranje komande, dostupno ime, neaktivnu površinu bez lažnog dugmeta i razvojne granice logovanja. |
| T1266 · src/ui/system/__tests__/surface.test.tsx:61 | ZASTARELI_FREEZE | is the compact card: a 1 dp edge in cardLine, 24 corners, 16 padding, and no shadow of any kind — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1267 · src/ui/system/__tests__/surface.test.tsx:70 | ZASTARELI_FREEZE | is the floating lift with the 1 dp line, white, and takes its corner from the caller — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1268 · src/ui/system/__tests__/surface.test.tsx:77 | ZASTARELI_FREEZE | has a corner of its own when the caller names none — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1269 · src/ui/system/__tests__/surface.test.tsx:84 | ZASTARELI_FREEZE | tone %s is the tint %s, flat: no edge, no shadow — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1270 · src/ui/system/__tests__/surface.test.tsx:90 | ZASTARELI_FREEZE | is a wash when no tone is given, and takes its padding from the scale (12 over and under, 16 across; `inset` pads 14) — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1271 · src/ui/system/__tests__/surface.test.tsx:95 | ZASTARELI_FREEZE | the tone belongs to a note alone: a record stays white whatever it is told — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1272 · src/ui/system/__tests__/surface.test.tsx:102 | ZASTARELI_FREEZE | a %s ignores onPress: it is read, not touched — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1273 · src/ui/system/__tests__/surface.test.tsx:114 | ZASTARELI_FREEZE | says so for a card inside a card, in every pairing, and names both — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1274 · src/ui/system/__tests__/surface.test.tsx:121 | ZASTARELI_FREEZE | says nothing for the first Surface, and nothing for a note: a tint may stand in a card — Stari materijal, radijus ili tip kontejnera određuje svaku površinu i interakciju. | Uloga/variant/tone/density iz zajedničkog API-ja; semantika komande nezavisna od materijala; sprečiti ugnježdene aktivne komande, dozvoliti pasivne insete. |
| T1275 · src/ui/system/__tests__/surface.test.tsx:126 | OBAVEZNA_ZASTITA | is spoken in a development build and in no other, and never under Jest (which has __DEV__ on too) — Grupa pokriva dostupnu interakciju, override ili dijagnostiku bez produkcionog curenja. | Zadržati tačno aktiviranje komande, dostupno ime, neaktivnu površinu bez lažnog dugmeta i razvojne granice logovanja. |
| T1276 · src/ui/system/__tests__/surface.test.tsx:133 | OBAVEZNA_ZASTITA | prints nothing under Jest, though __DEV__ is on here: the nesting is drawn and nobody is told — Grupa pokriva dostupnu interakciju, override ili dijagnostiku bez produkcionog curenja. | Zadržati tačno aktiviranje komande, dostupno ime, neaktivnu površinu bez lažnog dugmeta i razvojne granice logovanja. |
| T1277 · src/ui/system/__tests__/surface.test.tsx:141 | OBAVEZNA_ZASTITA | prints it once, with both names, when the build is a development build outside Jest — Grupa pokriva dostupnu interakciju, override ili dijagnostiku bez produkcionog curenja. | Zadržati tačno aktiviranje komande, dostupno ime, neaktivnu površinu bez lažnog dugmeta i razvojne granice logovanja. |

## Inventar svih test-grupa

**P** = pregledana grupa; **M** = mehanički predlog. JSON čuva hash fajla i grupe, krajnju liniju, broj assertion poziva, razlog i novu zaštitu za svaku stavku. Skraćeno: **Z** obavezna zaštita, **S** evoluirajuća smernica, **F** zastareli freeze.

### __tests__/dizajnPrivatnostGallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 29 / T0001 | M · S | reaches every scene by its visible label and comes back to the list with "Nazad" |
| 45 / T0002 | M · S | Android Back inside a scene returns to the list, as "Nazad" does, and leaves no listener behind |
| 55 / T0003 | M · S | the support scenes' own arrow returns to the list and reaches no route |
| 68 / T0004 | M · S | the closure start in the gallery asks its real question and starts nothing |

### __tests__/entrySafeAreaContract.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 9 / T0005 | M · Z | uses the existing device safe-area provider, not fixed status-bar guesses |
| 14 / T0006 | M · S | keeps the real sign-in target outside top and side system insets |
| 20 / T0007 | M · S | keeps the existing bottom actions and legal text above navigation insets |
| 26 / T0008 | M · Z | aligns the final logo with the safe topbar while preserving its original flight origin |

### __tests__/tabLayoutSafeAreaContract.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 84 / T0009 | M · Z | disables detail shifts with reduced motion while retaining instant peer tabs |
| 95 / T0010 | M · S | exposes Početna, Zadaci and Dogovori, in that order, for every account |
| 100 / T0011 | M · S | keeps my tasks, my applications, every detail route and the two retired addresses registered, but not as tabs |
| 109 / T0012 | M · F | shows the tab bar only on the three root screens |
| 125 / T0013 | M · S | covers every existing leaf route so Router cannot append unnamed extra tabs |
| 135 / T0014 | M · S | mounts the one Poruka host beside the navigator, clear of the bar and its margin (inset %i, text %f) |
| 141 / T0015 | M · S | keeps usable controls above the system navigation clearance and no-slide navigation |
| 148 / T0016 | M · S | reserves the %s-point bottom inset without shrinking controls |
| 154 / T0017 | M · S | gives enlarged labels more space without consuming the system navigation inset |
| 163 / T0018 | M · S | makes the bar exactly as high as the icon and the label need: 61 at ordinary text, 64 on the owner's phone at 1.15, 67 at 1.3 |
| 172 / T0019 | M · Z | draws the tab label in the `tab` variant, and keeps navigator selection fill disabled |
| 181 / T0020 | M · S | keeps the root navigation a full-width white rail with a quiet top separator |
| 194 / T0021 | M · Z | is as high as the icon and one line of the label need, whatever the width, and the 48 px control stays whole |
| 202 / T0022 | M · S | gives Početna, Zadaci and Dogovori one line each: no word is wider than the room its tab leaves it |
| 216 / T0023 | M · S | has no mode to switch: the shell reads no role store and keys nothing on one |

### src/data/__tests__/ai-conversation-layout.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 56 / T0024 | M · Z | does not apply a second height-based keyboard adjustment over Android window resizing |
| 62 / T0025 | M · Z | a correction topic waits until editing is enabled, focuses once, and never changes or sends the unsent draft |
| 77 / T0026 | M · Z | keeps the saved-action footer above the gesture area even when closing precedes keyboardDidHide |
| 91 / T0027 | M · S | protects a closed conversation action inside the scroll when the composer and footer are absent |
| 103 / T0028 | M · S | uses a quiet restart icon rather than a plus beside the conversation title and defers the action to its owner |
| 114 / T0029 | M · Z | keeps recovery scrollable and composer reachable, without discarding a pending draft |
| 126 / T0030 | M · S | keeps welcome separate from $state and identifies only real answer text |
| 149 / T0031 | M · S | draws a history note inside the message list after the message it followed, never in a docked region |
| 166 / T0032 | M · S | offers a way in before the first word, and one tap puts it in the message |
| 178 / T0033 | M · S | draws the openings as the rows of one section named "Na primer", a sentence each and no box of its own |
| 188 / T0034 | M · S | the opening of a conversation is a skeleton and one quiet sentence, never a spinner |
| 193 / T0035 | M · S | hides the pinned area entirely when there is nothing yet to pin |
| 198 / T0036 | M · S | keeps one reachable review inside the scroll on constrained geometry %o |
| 210 / T0037 | M · Z | does not offer openings once the conversation has started, or while it cannot be edited |
| 218 / T0038 | M · S | an empty status fragment does not permanently collapse a normal task card |
| 225 / T0039 | M · S | offers a return to the latest answer without taking the reader away from earlier messages |
| 243 / T0040 | M · S | a different conversation drops the previous scroll hint |
| 255 / T0041 | M · S | compacts without disabling editing on constrained geometry %o |
| 290 / T0042 | M · Z | follows the first pending turn across content and keyboard geometry, but cancels queued following on drag |
| 307 / T0043 | M · Z | reveals an owned editor top once, ignores local height changes, then follows normally after it closes |
| 332 / T0044 | M · S | requires a fresh native measurement for a replacement owner, even without a layout event (y=%s) |
| 353 / T0045 | M · Z | cancels a pending editor reveal for deliberate history scrolling and never reclaims that offset |
| 370 / T0046 | M · S | reveals an explicitly requested editor while earlier messages are being read |
| 394 / T0047 | M · Z | preserves the deliberate history offset when context, viewport and streaming content change |
| 419 / T0048 | M · S | keeps an anchor inside the old summary at %s when details expand |
| 436 / T0049 | M · S | keeps the visible top in place when inline context is first inserted |
| 447 / T0050 | M · Z | reserves space for latest while reading an expanded draft and preserves its review action |
| 475 / T0051 | M · Z | treats accessible history scrolling as intent and resumes following only through latest or an enabled send |
| 501 / T0052 | M · F | shows a complete task in the thread with its facts as rows and ONE green review, and nothing that names a state |
| 520 / T0053 | M · S | keeps an incomplete draft as the name, the facts it has and what is still needed, and does not call it ready |
| 534 / T0054 | M · Z | keeps the draft terms whole beside a review that stays a finger high at $width dp / $scale ($words) |
| 561 / T0055 | M · Z | keeps a legal long amount complete in a constrained, wrapping line at large text |
| 577 / T0056 | M · Z | shows the small USKOČI mark once per consecutive group while retaining the identity of every accessible turn |
| 588 / T0057 | M · Z | worker disclosure stays local, survives same-owner updates and resets with the stable ownership key |
| 613 / T0058 | M · Z | the intake card keeps no state of its own: a server id arriving or a new key changes nothing, what is needed stays, and the review waits until it is allowed |
| 636 / T0059 | M · Z | explains speech privacy in an in-app notice with one button, not a system alert |
| 650 / T0060 | M · S | empty: one held microphone and no voice-mode entry; text: the round send |
| 666 / T0061 | M · S | whitespace is not text: the send stays away until something is written |
| 672 / T0062 | M · Z | pending: the send is the same message again, disabled, and says why to the eye and to a screen reader |
| 687 / T0063 | M · S | a send that can go says nothing extra |
| 693 / T0064 | M · S | "+" is drawn only when there is something to attach to, and says when it cannot be used |
| 703 / T0065 | M · S | a tap on the held microphone explains itself above the composer; typing takes the advice away |
| 714 / T0066 | M · Z | the advice switches the same microphone to accessible start/stop %s |
| 730 / T0067 | M · S | a Switch Access click on the held microphone shows the advice and the way to voice mode, and starts nothing |
| 743 / T0068 | M · S | the advice offers no voice mode while the screen cannot take a message |
| 750 / T0069 | M · S | the chrome has no "···" when the screen has nothing to put behind it |
| 758 / T0070 | M · Z | keeps finalization without recognized words beside the microphone without inventing a message |
| 771 / T0071 | M · S | keeps real live speech beside the microphone, then puts only the sent message and thinking state in history |
| 783 / T0072 | M · Z | keeps the mode entry absent with reduced motion %s, without starting capture |

### src/data/__tests__/auth-entry-hooks.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 37 / T0073 | M · S | waits until entry opens, then closes the read boundary when hidden |
| 47 / T0074 | M · Z | clears availability synchronously on retry and rejects a superseded response |
| 60 / T0075 | M · Z | shows network error as unknown and retries without caching a false disabled projection |
| 68 / T0076 | M · Z | aborts on background/unmount and reads fresh settings on foreground |
| 81 / T0077 | M · S | admits only one same-tick Auth command and blocks form changes until settlement |
| 92 / T0078 | M · Z | rejects an obsolete form callback after a same-tick form revision, while the new form remains usable |
| 102 / T0079 | M · Z | ignores late %s after signed-out→A→signed-out ownership change |
| 111 / T0080 | M · S | rejects an old form action before React renders a signed-out→A→signed-out transition |
| 120 / T0081 | M · Z | does not start an Auth command from a signed-in session and ignores completion after unmount |
| 132 / T0082 | M · Z | makes a failed command retryable without swallowing the error callback |

### src/data/__tests__/auth-entry-surface.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 109 / T0083 | M · S | keeps email functional and shows no way in that does not work |
| 133 / T0084 | M · S | connects the V4.9 welcome signup action to the existing real signup sheet without submitting |
| 144 / T0085 | M · S | is ONE calm screen for both ways in: one greeting, the switch under it, the real fields, the explicit primary command |
| 172 / T0086 | M · Z | says honestly that the legal documents are not published instead of a tick, only when an account is being made |
| 189 / T0087 | M · Z | asks for the password once: the eye is on the field, the sign-up sends what was typed, and nothing else is checked against it |
| 200 / T0088 | M · S | still refuses a short password locally, on the one field there is, and sends nothing |
| 209 / T0089 | M · S | keeps an empty password submission local and immediately editable |
| 221 / T0090 | M · Z | a %s sign-in failure shows its own message and leaves the form retryable |
| 235 / T0091 | M · Z | hides a revealed password when switching form mode, preserving the entered value without submitting |
| 265 / T0092 | M · S | is usable while the check is still being made, and signs in without waiting for it |
| 275 / T0093 | M · S | is usable when the check fails, says so quietly with a way to try again, and signs in without it |
| 287 / T0094 | M · S | can also make an account when the check failed: the switch and the fields are there, and the command sends them |
| 298 / T0095 | M · S | "Pokušaj ponovo" reads again and keeps what was typed; the note goes when the read succeeds |
| 307 / T0096 | M · S | keeps the form and what was typed when the app comes back to the front and the check is made again |
| 317 / T0097 | M · Z | does not take recovery away: a build that can recover a password offers it whatever the check found |
| 328 / T0098 | M · Z | does not offer signup when disabled, while existing email login remains available |
| 338 / T0099 | M · Z | gives an explicit route back if signup is disabled while the signup form is open |
| 346 / T0100 | M · Z | blocks duplicate signup, conflicting navigation and editing, then shows accurate confirmation with a real login Back |
| 362 / T0101 | M · Z | offers an explicit confirmation resend after signup and serializes duplicate taps |
| 376 / T0102 | M · Z | visibly gates unfinished recovery and never sends a broken reset link |
| 389 / T0103 | M · Z | does not promise a confirmation email when autoconfirm is enabled but signup returns no session |
| 398 / T0104 | M · S | rejects an old login press after the form changes to signup |
| 405 / T0105 | M · S | does not invoke an old phone command after fresh settings disable phone |
| 414 / T0106 | M · S | serializes SMS verify and resend through the same command boundary |
| 425 / T0107 | M · S | opens a direct auth destination without an intro and submits through the existing service |
| 437 / T0108 | M · Z | prepares %s once before opening Auth, on creating an account, with the choice as one sentence |
| 458 / T0109 | M · S | changes the choice with "Promeni": the same write of the other intent, and nothing typed or opened is disturbed |
| 476 / T0110 | M · S | keeps the chosen sentence when the change cannot be saved, and says so on the form |
| 485 / T0111 | M · S | does not change the choice while a command runs |
| 498 / T0112 | M · Z | retains the entry and exposes retry after failed intent storage |
| 506 / T0113 | M · Z | does not open Auth or retain a selection when %s supersedes a pending prepare |
| 528 / T0114 | M · Z | rejects a retained pre-blur callback after refocus while allowing a fresh choice |
| 537 / T0115 | M · Z | ignores a cancelled selection storage error and permits a fresh retry without opening Auth early |
| 548 / T0116 | M · Z | keeps prepared intent through both ways in and recovery but clears it for explicit plain sign-in or sign-up |
| 569 / T0117 | M · Z | does not carry a prepared label across an account incarnation change |
| 581 / T0118 | M · Z | does not accept a late prepare or show its label after signed-out account ABA |
| 592 / T0119 | M · S | uses neutral presentation for a new direct Auth destination after a prepared selection |
| 607 / T0120 | M · S | closes the sheet to the entry from the signing-up way and from the signing-in way, with the arrow and with the phone Back |
| 620 / T0121 | M · S | steps from a later stage back to the sign-in form, and only then to the entry |
| 632 / T0122 | M · Z | submits recovery only on user action and reports accepted rather than delivered email |
| 645 / T0123 | M · Z | prevents duplicate recovery sends and keeps a failed request editable |
| 688 / T0124 | M · S | after an email sign-in the provider refused as restricted, with the password cleared and one way back to the same email |
| 702 / T0125 | M · S | after a phone %s the provider refused as restricted |
| 717 / T0126 | M · Z | after a password-recovery request the provider refused as restricted |
| 726 / T0127 | M · Z | opens on its own, once, when the provider ended the session because the account is restricted |
| 739 / T0128 | M · S | is left with the phone Back as well, to the sign-in form |
| 749 / T0129 | M · F | draws "Obrati se podršci" as the one green command, and says the sentence about it, only when the owner has given a public address |
| 768 / T0130 | M · Z | every sentence is plain Serbian in the "ti" voice, without gender, invented contact, reason or duration |
| 788 / T0131 | M · S | names each missing field of an account, sends nothing, and each message stands in its own field and nowhere else |
| 796 / T0132 | M · S | says a wrong address and a short NEW password, each under its own field |
| 805 / T0133 | M · S | says the length of a new password BEFORE it can be wrong, and asks for no length when signing in |
| 814 / T0134 | M · S | forgets what was said about a field as soon as that field is edited, and about the form when the email or the password is |
| 834 / T0135 | M · S | offers to sign in after a sign-up that did not go through, and takes the person there with the email kept |
| 845 / T0136 | M · S | does not blame an existing account when the provider only said "%s" |
| 851 / T0137 | M · Z | offers to send the confirmation again when the email is not confirmed, sends it, and says it was sent |
| 861 / T0138 | M · S | offers nothing extra after a lost connection: the command and "Zaboravljena lozinka?" are already there |
| 868 / T0139 | M · S | puts the city right when the person leaves the field, and keeps what was typed when it is already right |
| 876 / T0140 | M · S | sends the city put right even when the person never left the field |
| 883 / T0141 | M · Z | chains the fields with the keyboard: "next" goes on to the next field and "go" on the password sends the form |
| 905 / T0142 | M · S | scrolls the sheet by exactly what hides the field when it takes focus, and not at all when it is already in view |
| 916 / T0143 | M · S | adds the distance to where the sheet is scrolled to, and looks again when the scroll area changes size |
| 934 / T0144 | M · Z | keeps the green command in the foot, outside the scroll area, so it rises with the keyboard and never scrolls away |
| 945 / T0145 | M · Z | is grey and says "Prijava emailom trenutno nije dostupna." above itself when the server has email sign-in switched off |
| 963 / T0146 | M · S | draws no reason, and a live green command, when nothing is missing |
| 986 / T0147 | M · S | scrolls down to a failure that stands below the visible part, and does not scroll for one that is in view |
| 996 / T0148 | M · Z | scrolls back up to the confirmation that was sent again, which stands above the visible part |
| 1010 / T0149 | M · S | retains a callback while Auth is covered and shows it when Router focuses Auth |
| 1022 / T0150 | M · Z | an expired callback offers a working resend after a previous auto-confirm signup, and reveals each warm return |
| 1041 / T0151 | M · S | a warm callback leaves Proveri email even when the route form has not changed |
| 1056 / T0152 | M · Z | cold expired callback can resend with just a valid email, preserves CTA while typing and serializes taps |
| 1075 / T0153 | M · S | does not interrupt or replay navigation over an in-flight signup |
| 1087 / T0154 | M · S | manual form change dismisses the callback; a new callback is a new event |

### src/data/__tests__/dizajn-dodaci.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 45 / T0155 | M · S | opens every scene by its visible label and comes back with "Nazad" |
| 60 / T0156 | M · Z | keeps the binding cancellation words after retiring current-location sharing |
| 69 / T0157 | M · Z | renders actual group message runs, sender identities and a participant private channel without data reads |
| 83 / T0158 | M · Z | can inspect, prepend and restore inert long history while opening and closing the real participant sheet |

### src/data/__tests__/dizajn-dogovori.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 51 / T0159 | M · Z | opens the scene "%s" without reading or writing anything |
| 62 / T0160 | P · F | has one green action, the actions as rows of the page and no "···", and says no sentence that the ⓘ says |
| 71 / T0161 | P · F | draws the four steps in one row at the owner's phone and text size, and as a column at 1.3, with every word whole |
| 83 / T0162 | M · S | ignores a text size it does not know |
| 91 / T0163 | M · S | R01a: an account without a number is told where contact happens, and is offered no command that cannot succeed |
| 99 / T0164 | M · S | a shared number is called, and withdrawn |
| 104 / T0165 | M · S | R02: a Dogovor with no term says so where the person reads what comes next, with the way to propose one |
| 110 / T0166 | M · S | R03: the worker is told the address is not shared and can ask for it; the requester is told to share it when ready |
| 118 / T0167 | M · S | R04: after a reported problem there are three ways on, and the form that reported it is gone |
| 126 / T0168 | P · F | the form that reports a problem takes the place of its row, at the end of the page |
| 132 / T0169 | M · Z | CANCEL-INFO: a cancelled Dogovor says when, by whom and why - and a reason that was never kept, in words |
| 140 / T0170 | M · Z | R29: before "Sačuvaj" the person is told that a saved rating cannot be changed; grey, the foot says why instead |
| 148 / T0171 | M · Z | a send whose outcome is not known says so under its bubble with the one "Proveri"; a refused one keeps "Nije poslato" and "Pošalji ponovo" |
| 159 / T0172 | M · S | the group conversation says what the screen of the group says when fewer than two people are chosen |
| 164 / T0173 | M · S | the states of the Dogovor while it is read: loading, a failed read with one way forward, and a Dogovor that cannot be opened |
| 173 / T0174 | M · S | shows one task with separate accepted terms and expands the fourth collaboration without photo readers |
| 187 / T0175 | M · Z | shows the existing account identity once for the new local outgoing run |

### src/data/__tests__/dizajn-galerija-moj-zadatak.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 53 / T0176 | M · Z | shows nothing but its refusal in a store build |
| 60 / T0177 | P · F | a task nobody has applied to says "Još nema prijava" once, with the edit beside it and no green action |
| 70 / T0178 | P · F | applications waiting for a choice are the faces, the count and the ONE green action |
| 77 / T0179 | P · F | "Tražim ponude" is a fact with its picture, and what it means is one tap away behind a small ⓘ, not a sentence under it |
| 84 / T0180 | M · S | a task for several people says how many in words, and the people already agreed after it, never as "1/3" |
| 89 / T0181 | M · S | a closed search says so in one line and offers nothing more to choose |
| 97 / T0182 | M · Z | says when it was published, quietly and at the end, only when the read carries the time (the scene is a preview of what the server will make possible) |
| 105 / T0183 | M · Z | what cancels a live task nobody is agreed with is the red row that ends the page, and a task with an agreed place does not offer it |
| 116 / T0184 | P · F | what ends something is a row at the end of the page, on the screen, with the lifecycle's own question |

### src/data/__tests__/dizajn-galerija-pregled.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 58 / T0185 | M · Z | shows nothing but its refusal in a store build |
| 65 / T0186 | M · Z | draws the real card, then the real page, each under its caption, and the owner's frame of the exact address at the end of the page |
| 81 / T0187 | P · F | every part has its own pencil, named for what it changes, and the only green is the publish |
| 90 / T0188 | M · S | "Tražim ponude" shows no amount anywhere, and a term nobody fixed is the word "Fleksibilno" |
| 98 / T0189 | M · S | a task without a place or a price says so, draws no map and no frame, and the publish waits grey with its reason |
| 109 / T0190 | M · S | while the publish runs no pencil is drawn and the delete row waits grey |
| 116 / T0191 | M · S | a stored command is read only: no pencil, no row of the deletion, no "Dodaj još podataka" |
| 123 / T0192 | M · Z | the changes of a task that exists are confirmed, not published, and there is no draft to delete |
| 131 / T0193 | M · Z | a route names its stops on the page, the two places in the frame, and the points to be confirmed are not counted when all are |
| 138 / T0194 | M · S | remote work says "Na daljinu" twice, and has no map, no frame of an address |
| 143 / T0195 | M · S | a draft with no photographs offers the way to add them, and an owner nobody has read is not drawn as the one who asks |
| 149 / T0196 | M · Z | long names wrap whole: nothing is cut with an ellipsis, and the page says all of them |
| 156 / T0197 | P · F | under a large text size the pencils keep their names and lose their word |
| 166 / T0198 | P · F | the price is an amount field with the tabs of its facts, and the other pencils are gone |
| 173 / T0199 | P · F | the time is the pickers of its start, with the tabs of its facts |
| 178 / T0200 | P · F | the deadline is its own editor, in the place of the deadline |
| 184 / T0201 | P · F | what the page does not say yet is one row, which opens the facts as rows with their pencil |
| 193 / T0202 | M · S | loading is the skeleton of the card and no foot; failure is the one way to try again |

### src/data/__tests__/dizajn-galerije-prijave.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 67 / T0203 | M · Z | %s: a store build shows nothing but its refusal, whatever the scene says |
| 76 / T0204 | M · S | draws the scene %s from its address |
| 94 / T0205 | M · S | opens every scene from its chip and says what a press on a card would do, without doing it |
| 105 / T0206 | M · S | draws the scene %s from its address |
| 124 / T0207 | M · Z | draws the control in the draft's words for a whole list and not for a list with a page still to come |
| 133 / T0208 | M · S | draws the scene %s from its address |
| 155 / T0209 | M · S | draws the scene %s from its address |

### src/data/__tests__/dizajn-kalendar.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 49 / T0210 | M · S | opens every scene by its visible label and comes back with "Nazad" |
| 68 / T0211 | M · S | draws both sides, a finished Dogovor, one with only a start, and the bar of the Dogovori without a term, on the month |
| 88 / T0212 | M · S | opens on the month, with the grid, the dots and the tint of the worker's days, and draws the week and the day on their own scenes |
| 105 / T0213 | M · S | draws a month without a work profile with no tint and no way into the hours, many Dogovori in one day, and a night on the hours |
| 119 / T0214 | M · S | draws what a list read without the exact window leaves: only my work, and a line that says so |
| 127 / T0215 | M · S | goes home from the list when it was opened cold by its address |
| 141 / T0216 | M · S | draws a missing work profile as a step to take, not as a failed read |
| 149 / T0217 | M · S | shows the conversation check that the reason of the "razlog" scene names |
| 158 / T0218 | M · S | draws no task or application in any scene, and the bar of the Dogovori without a term with its sheet and its command |
| 178 / T0219 | M · Z | draws the Arhiva in its states from the same fixtures, with its records under the group headings |

### src/data/__tests__/dizajn-katalog27.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 18 / T0220 | M · S | refuses package %s even in a development JavaScript runtime |
| 26 / T0221 | M · S | the .dev trial has no event until an explicit tap and owns blur |

### src/data/__tests__/dizajn-mapa-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 28 / T0222 | M · Z | does not mount the map or fixture dataset outside the exact internal package (%s) |
| 36 / T0223 | M · S | rejects malformed or out-of-range scene input before rendering Discovery: %j |
| 48 / T0224 | M · Z | bounded point-members fixture carries an independent total through the real seam and stays local |
| 66 / T0225 | M · Z | label isolation fixture is reachable only in exact DEV package: %s |
| 74 / T0226 | M · S | does not combine the label probe with dataset or trace modes: %j |
| 82 / T0227 | M · Z | point-members fixture remains unavailable outside exact DEV package: %s |
| 90 / T0228 | M · S | one-row entry uses the real component with a public point, no image resource and only local callbacks |
| 102 / T0229 | M · Z | explicit local %s pin scene stays local and preserves the selected relation on detail return |
| 110 / T0230 | M · Z | 1,000 deterministic rows cover real local filtering/cluster shapes without media, profiles or invented review scores |
| 131 / T0231 | M · Z | opening a row pushes only its bounded local detail; filters/camera/scroll stay in the retained gallery |
| 152 / T0232 | M · Z | has a local safe exit and no direct backend/provider/media dependency or remote fixture source |
| 160 / T0233 | M · S | gallery diagnosis is explicit, numeric-only, bounded and retired when its flag disappears |

### src/data/__tests__/dizajn-obavestenja-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 34 / T0234 | M · Z | opens every scene from its visible name, draws it, and comes back with "Nazad" without touching data |
| 58 / T0235 | M · S | draws a device without notifications whose sets are on while sending is not yet on |
| 69 / T0236 | M · S | draws the settings as one screen with no tabs, and each state in its own words |
| 90 / T0237 | M · S | opens a scene by its address at the text size %s and keeps the words |
| 97 / T0238 | M · S | draws the inbox with the task under the event where the read names it |

### src/data/__tests__/dizajn-pocetna.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 38 / T0239 | M · Z | refuses fixture content in a store build (%s), regardless of the scene query |
| 47 / T0240 | M · S | retains the development-runtime boundary used by the other galleries |
| 53 / T0241 | M · S | renders the real Home for %s without a gallery wrapper or live action |
| 106 / T0242 | M · Z | renders the real Home for the scene %s with its own words and no live action |
| 137 / T0243 | M · S | draws the owner's own overview as the task and the action of each thing that waits, with no Raspored block and no repeated sentence |
| 146 / T0244 | M · S | draws the owner's overview at the text size %s without changing what it says |
| 152 / T0245 | M · S | falls back to the fixed upcoming example for an unallowlisted query (%j) |

### src/data/__tests__/dizajn-prijava-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 38 / T0246 | M · S | opens every scene by its visible label and comes back with "Nazad na listu scena" |
| 52 / T0247 | M · Z | draws the composer, its review and the sent state, and the rating with its person |
| 79 / T0248 | M · Z | lists the scenes first, under their own heading, and the application and rating scenes after them |
| 87 / T0249 | M · S | draws every sign-in scene with its real components and comes back to the list |
| 98 / T0250 | M · F | the first step in every state: fields with their label, the one green command in the foot, and what is wrong said under the form or the field |
| 118 / T0251 | M · S | a failed check of the available ways in is a quiet note under a form that is all there |
| 125 / T0252 | M · Z | the keyboard scene stands the sheet on a column that is a keyboard shorter |
| 130 / T0253 | M · S | every scene can be opened directly by its key |

### src/data/__tests__/dizajn-zadaci-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 43 / T0254 | M · S | every state of the list card, with the small mark of what the account is to the task and no label above the title |
| 52 / T0255 | M · S | with the person's position known each card on the map says how far the task is, and a task done remotely says none |
| 59 / T0256 | M · Z | the same cards at large text, and the card of a chosen pin with and without the distance |
| 75 / T0257 | M · Z | lista hands the whole screen a list of the shapes the real one meets: mapped, remote and placed nowhere |
| 87 / T0258 | M · S | %s is the state of the list that it names |
| 94 / T0259 | M · S | "Za mene" is on in lista-za-mene, and refused in lista-za-mene-odbijeno (no active work profile) |
| 102 / T0260 | M · S | lista takes the height of the sheet and the pin whose card stands at the bottom; a pin or a height that is not one is ignored |
| 115 / T0261 | M · S | pretraga is the search that fills the screen: the field, the cities with their counts and what was searched before, and none of the filters |
| 123 / T0262 | M · S | pretraga-sta has a word typed already |
| 129 / T0263 | M · S | %s is the sheet of the filters: Kada, Iznos and the foot with the real number |
| 135 / T0264 | M · Z | filteri-izabrano has a day and an amount chosen |

### src/data/__tests__/entry-brand-scene-clock.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 54 / T0265 | M · S | passes atlas normalization through the real native SVG transform extractor |
| 72 / T0266 | M · S | mounts the actual SVG scene at time zero while paused and starts the full unchanged clock only on release |
| 86 / T0267 | M · Z | shows the final static frame without allocating a timing animation for reduced/skipped entry |
| 91 / T0268 | M · Z | cancels on skip and unmount and does not report a cancelled clock as completion |
| 118 / T0269 | M · S | requires nonzero original artwork and a later UI frame, not layout or exactly40ms |
| 136 / T0270 | M · S | discards a queued old frame on skip and accepts the committed static frame without replay |
| 150 / T0271 | M · Z | never releases from an unmounted frame callback and never observes paused geometry |
| 177 / T0272 | M · Z | derives the first in-viewport 8-bit source sample, preserving the empty0-40 boundary and every following track |
| 186 / T0273 | M · S | holds the exact prepared source state across delayed RN delivery, without allocating a running timeline |
| 203 / T0274 | M · Z | resumes the same source sample once after acknowledgement and later UI frames, without replay or acceleration |
| 225 / T0275 | M · S | holds preparation until the real hide request settles and later frame handoff completes |
| 254 / T0276 | M · S | discards a delayed prepared acknowledgement after %s, showing static welcome with no replay |
| 271 / T0277 | M · S | invalidates queued preparation and completion when the lifetime ends |
| 289 / T0278 | M · S | clips the original fixed word artwork at $time ms / $phone.width px before phase completion |

### src/data/__tests__/entry-intent-client.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 8 / T0279 | M · S | prepares %s as guest intent without granting an authenticated role |
| 15 / T0280 | M · Z | releases the caller after hung storage and permanently invalidates a late write |
| 25 / T0281 | M · Z | rejects guest→account→guest ABA ownership when storage returns |
| 33 / T0282 | M · S | retains a real storage failure and clears its timer so a new attempt can succeed |
| 39 / T0283 | M · Z | passes selection cancellation into the serialized store and rejects an obsolete result |
| 47 / T0284 | M · Z | denies a retained successful storage result when its screen is no longer current |

### src/data/__tests__/entry-intro-hook.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 45 / T0285 | M · Z | plays once, lets skip win over completion, and persists only cosmetic state |
| 52 / T0286 | M · Z | skips motion for accessibility without waiting on storage |
| 56 / T0287 | M · S | does not replay after the persisted first visit |
| 59 / T0288 | M · Z | persists the actual scene-timeout completion before unmount and does not replay on the next mount |
| 79 / T0289 | M · Z | finishes an active intro when reduced motion changes and never replays when disabled again |
| 86 / T0290 | M · Z | opens welcome if storage hangs and rejects the late first-visit response |
| 93 / T0291 | M · S | opens welcome on a failed read and never blocks on a failed cosmetic write |
| 99 / T0292 | M · Z | finishes on background and discards an already queued completion after unmount |
| 105 / T0293 | M · S | does not persist a delayed animation completion after leaving the screen |
| 111 / T0294 | M · S | prepares the original intro under the held cover instead of waiting for hide to start it |
| 121 / T0295 | M · Z | shows static welcome on failed readiness, and preserves reduced motion without waiting |
| 130 / T0296 | M · Z | does not revive an intro after Back/skip or background while visibility was pending |

### src/data/__tests__/entry-splash-ready-hook.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 56 / T0297 | M · S | requires nonzero layout, fulfilled hide, and a draw before the following frame |
| 70 / T0298 | M · Z | does not restart readiness on duplicate layout or a later resize |
| 78 / T0299 | M · S | skips motion on a native rejection without pretending readiness or scheduling frames |
| 85 / T0300 | M · Z | bounds a hung native hide and ignores its late completion |
| 95 / T0301 | M · Z | cancels stalled frames at the deadline instead of starting a late animation |
| 103 / T0302 | M · Z | ignores native completion after unmount and clears the deadline |
| 111 / T0303 | M · Z | cancels the second frame on unmount and rejects an already queued callback |
| 119 / T0304 | M · S | retains the cover until Entry geometry and cosmetic intro decision are prepared |
| 128 / T0305 | M · Z | bounds a missing visible-frame acknowledgement, renders skip before releasing and ignores late ack |
| 144 / T0306 | M · Z | cancels scene wait and queued fallback release on unmount |
| 155 / T0307 | M · Z | does not reveal an unresolved or redirected route and releases once the real route owns it |
| 165 / T0308 | M · Z | holds native auto-hide before Router startup while preserving recovery capture (bridge failure %s) |
| 190 / T0309 | M · Z | releases the single startup cover once across routes and clears the fallback |
| 199 / T0310 | M · S | releases the cover at the finite fallback even when the async bridge hangs |
| 210 / T0311 | M · S | uses the approved dimensional mark on white for both native themes instead of an empty drawable |

### src/data/__tests__/entry-spoj-brand-geometry.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 7 / T0312 | P · F | matches original HTML geometry at $time ms / $phone.width px |
| 20 / T0313 | P · Z | provides the exact final state immediately with reduced motion |
| 29 / T0314 | P · Z | rejects unmeasured or non-finite geometry |

### src/data/__tests__/entry-spoj-surface.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 98 / T0315 | M · S | shows the vector lockup and two real intent controls without dispatching on mount |
| 107 / T0316 | P · F | mounts the two exact local portraits and SVG notes without an image network request or loading transition |
| 118 / T0317 | M · Z | preserves both image instances and their native ancestors through intro, selection, cancellation and completion |
| 154 / T0318 | M · Z | does not let a retained auth handler bypass an in-flight intent or a changed session |
| 160 / T0319 | P · F | keeps the panel boundary synchronized with original rIntroFrame at %i ms |
| 167 / T0320 | P · F | preserves the selected original scene during %s sweep, keeping the white lockup |
| 179 / T0321 | M · Z | restores the attached native mappers after returning from %s, despite late intro and selection clocks |
| 213 / T0322 | M · Z | keeps the newer opposite selection when a cancelled retained Auth callback completes late, then restores both columns |
| 231 / T0323 | M · Z | commits the complete static welcome before delayed UI clock writes, including late old assignments |
| 269 / T0324 | M · S | starts an explicit choice from the final scene even if the old intro clock is still zero |
| 284 / T0325 | M · Z | disables conflicting controls immediately and delivers %s exactly once after 760ms |
| 295 / T0326 | M · Z | keeps the selected state while the real owned callback is pending |
| 304 / T0327 | M · S | shows real preparation at the completed %s doorway even before the JS timer runs |
| 317 / T0328 | M · Z | shows immediate static preparation for a reduced-motion pending choice without starting a clock |
| 325 / T0329 | M · Z | invalidates the delivered selection on %s before late completion |
| 343 / T0330 | M · Z | restores both choices with retry text after current storage failure without claiming confirmation |
| 351 / T0331 | M · Z | cancels a pending choice on %s |
| 356 / T0332 | M · Z | cancels on explicit cancellation and allows a fresh opposite choice |
| 360 / T0333 | M · Z | rejects A→B→A before callback even when React has not rerendered yet |
| 365 / T0334 | M · Z | does not deliver after unmount |
| 369 / T0335 | M · S | reduces selection motion to an immediate real callback |
| 373 / T0336 | M · Z | cancels an in-progress sweep when the system preference changes and accepts an immediate fresh choice |
| 380 / T0337 | P · F | retains both portraits and reflowing note text with the source large-text two-column composition |
| 390 / T0338 | M · S | waits for measured geometry before starting the intro and keeps actions unavailable |

### src/data/__tests__/entry-v49-reference.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 11 / T0339 | P · Z | binds the four native assets and vector adapter to the exact owner V4.9 bytes |
| 22 / T0340 | P · Z | names both original portraits by their actual embedded format without re-encoding |
| 39 / T0341 | P · F | matches real Chrome final V396 measured layout at %s |
| 46 / T0342 | P · F | matches Chrome original part/seam wrappers at $timeMs ms |
| 54 / T0343 | P · F | matches actual Chrome selected-scene sweep at $timeMs ms |
| 61 / T0344 | P · Z | renders all parts immediately under reduced motion at %i ms |
| 64 / T0345 | P · Z | keeps measured content ordered and safely scrollable at %i×%i scale%i |
| 74 / T0346 | P · F | does not compress the authored photos to fit larger hit targets or repeatedly apply the V396 delta |
| 81 / T0347 | P · F | preserves the original photo crop and motion travel with real device insets at %i×%i scale%i |

### src/data/__tests__/marketplace-intent-entry.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 14 / T0348 | M · S | public discovery opens a new task directly, for every account, with no mode to read, ask about or set |

### src/data/__tests__/own-task-card.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 45 / T0349 | M · S | says "Bira se · 3" first, then the task, and the next step as the foot that opens the applications |
| 67 / T0350 | M · Z | the chip is not a stop of its own: the body is heard once, as one sentence that starts with the state |
| 73 / T0351 | M · S | without a way to the applications the line is still said, as plain text in the body |
| 80 / T0352 | M · S | %s says "%s" and has no foot |
| 98 / T0353 | M · S | a closed task whose ending was not carried, or an archived one, has no chip and says what is true instead |
| 105 / T0354 | M · S | never says "Čeka prijave", which read as the opposite of what it meant |
| 114 / T0355 | M · S | keeps the facts of the task as rows of one kind: what it pays, where, when and how many people, each with its picture |
| 128 / T0356 | M · Z | says how many people only when it is more than one, and how many are agreed once any is |
| 136 / T0357 | M · Z | a task done remotely says so with the remote picture, and a long title keeps to two lines for the eye and whole for the ear |
| 145 / T0358 | M · S | a task with no price says it in words, beside the picture of a price tag, and never as an amount |
| 152 / T0359 | M · S | a draft has no places agreed and no applications: it counts neither, in words or aloud, and says nothing about itself the chip does not |
| 158 / T0360 | M · Z | a price that is not stored never looks like an amount |
| 164 / T0361 | M · S | keeps HITNO beside the chip, a word with a symbol, and says it first when it is heard |
| 173 / T0362 | M · S | with `sectionSays` draws no chip but says the state aloud as before, and keeps HITNO, the foot and the next step |
| 184 / T0363 | M · S | without `sectionSays` (the default, and the lists of finished and all tasks) the chip stands exactly as it did |
| 189 / T0364 | M · S | while a command runs nothing on the row can be pressed, and the row stays readable |
| 195 / T0365 | P · F | is a raised record with a neutral edge and 24 corners: the state is the chip, never the colour of the frame |
| 201 / T0366 | P · F | only a task that waits for my decision has a foot, and the foot has one line above it and no other |

### src/data/__tests__/password-recovery-surface.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 55 / T0367 | M · Z | does not render password controls or success before server verification finishes |
| 72 / T0368 | M · Z | validates confirmation locally, single-flights the write and waits for confirmed success |
| 87 / T0369 | M · S | refuses a signed-in actor before checking the supplied link |
| 92 / T0370 | M · Z | drops a late verified identity after account change and never displays its email |
| 98 / T0371 | M · Z | shows a used/expired link without a password form and offers the recovery request route |
| 103 / T0372 | M · S | retries a verification read with a new lease, not a password update |
| 108 / T0373 | M · Z | does not claim success or offer blind write retry after an unknown outcome |
| 114 / T0374 | M · Z | clears entered secrets when another recovery link arrives |
| 121 / T0375 | M · Z | does not hide an interrupted write behind a newer link or a late success |
| 132 / T0376 | M · S | clears the fragment in the installed Expo serializer, not just a mocked router |
| 139 / T0377 | M · S | scrubs the focused route rather than just the enclosing navigator params |
| 155 / T0378 | M · S | revalidates a repeated OS callback instead of displaying the preceding success |
| 174 / T0379 | M · S | a restricted account is its own screen, not an expired link (failed while saving: %s) |
| 203 / T0380 | M · Z | names the flow ONCE ("Oporavak lozinke" in the bar), has one title in the content, and no line with the build's version |
| 213 / T0381 | M · F | has exactly ONE command in the foot of the screen in every state, and it is the one green command |
| 229 / T0382 | M · Z | says a short new password under its own field, and a mismatch under the confirmation, before anything is sent |
| 243 / T0383 | M · Z | draws a refused or unconfirmed step with a title that says what happened, never a code, and the contract's own sentence |

### src/data/__tests__/pkg003-manual-entry-source.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 17 / T0384 | M · S | sends the New Task control straight into the conversation from both lists |
| 30 / T0385 | M · S | leaves no chooser, no manual screen and no second Need-fact writer in the client |
| 42 / T0386 | M · S | keeps the conversation as the only client that proposes or writes Need facts |
| 63 / T0387 | M · Z | still keeps the retired branch proven where it is enforced, on the server |

### src/data/__tests__/prijava-card.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 36 / T0388 | M · F | is exactly the owner's five words, each a key of the one chip table, and every card wears one |
| 45 / T0389 | M · S | adds a reason line under the chip only when the model has one, never a second chip, in the warn colour only for a warning |
| 55 / T0390 | M · S | is read on a sheet and silent inside a card that is one press |
| 64 / T0391 | M · S | the worker meets the TASK, the requester the PERSON, and neither meets the other's head |
| 71 / T0392 | M · Z | keeps a long title whole and lets the head carry one quiet mark of its own |
| 79 / T0393 | M · S | the worker reads the term, then the offer and the people on one line, then the message; the requester the offer, then the term, then the message |
| 86 / T0394 | M · S | the requester's list says the term only when the person proposed one, and says what the person has before the message |
| 92 / T0395 | M · S | draws a fact picture beside the term and beside what the person has, and nowhere else: the offer and the people are one line of words |
| 99 / T0396 | M · Z | a price that was not stored says "Cena nije navedena" in plain regular grey words, with no figure, no currency and no "ukupno" |
| 109 / T0397 | M · Z | an amount is ink, bold and tabular, never cut; at large text its basis stacks under it |
| 121 / T0398 | M · S | puts the people on the same line as the offer, after a dot, and without the dot when the parts stand under each other |
| 128 / T0399 | M · S | clamps a long message only when asked, and the people and the term are never clamped |
| 137 / T0400 | M · S | an application that is over keeps its words as readable as any: the chip says it is over, and nothing is faded |
| 146 / T0401 | M · S | is one sentence in the order it is drawn: the state, the reason, the term, the offer, the people, the message |
| 153 / T0402 | M · S | lets the adapter say the message its own way (the worker's own words, a bounded preview) or not at all |

### src/data/__tests__/profile-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 51 / T0403 | M · S | lists every scene by its visible name and draws each one, with Nazad back to the list |
| 68 / T0404 | M · Z | a scene edits only its own copy: a free-text vehicle is retained locally and nothing is sent |

### src/data/__tests__/system-reduced-motion-hook.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 83 / T0405 | M · Z | renders the root's launch snapshot %s while the current native query is pending |
| 91 / T0406 | M · Z | replaces a stale cached startup value with the native current preference %s |
| 98 / T0407 | M · S | follows the change event: every reader turns with one event, on and off, without waiting for a hanging query |
| 109 / T0408 | M · Z | a reader without a mounted root never touches a native API and reads "not reduced" |
| 117 / T0409 | M · Z | rejects the startup query after a newer preference event, including an on/off ABA transition |
| 124 / T0410 | M · Z | refreshes on foreground and ignores older native query completions |
| 133 / T0411 | M · Z | lets a newer runtime event win over an in-flight foreground refresh |
| 141 / T0412 | M · Z | keeps the known preference after native query failure and recovers on a later foreground |
| 152 / T0413 | M · S | does not reset a current runtime preference or replace listeners on rerender |
| 161 / T0414 | M · Z | removes both native subscriptions and isolates late responses and queued events from a remount |
| 177 / T0415 | M · S | the store itself imports no Reanimated, so every route suite can load it |
| 193 / T0416 | M · S | a reader that outlives the root keeps the last known answer, and a retried root starts from it |
| 206 / T0417 | M · Z | once no root and no reader is left, nothing is known: the next reader starts from "not reduced" |

### src/data/__tests__/task-card-face.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 66 / T0418 | P · F | says title, amount with what it buys, where, when, count of people and who, in that order, and nothing else |
| 74 / T0419 | P · F | draws the amount as the first fact, under the title, with the money picture and no word for what it is |
| 84 / T0420 | P · F | uses four type roles at most: the title, the amount, the facts and the person, the state |
| 90 / T0421 | M · Z | is one record that is touched: one press, on the row rung, and a title that is never cut |
| 104 / T0422 | M · S | never shows a skill, the category or the mixed `uslovi` list: without a condition, vehicle or tool there is no line |
| 110 / T0423 | M · S | shows the task's own conditions first, wrapping every supplied condition with the info art |
| 121 / T0424 | P · F | then the vehicles with the vehicle fact drawing, then the tools with the tool fact drawing |
| 139 / T0425 | M · S | is always filled, and a word is never money-styled (text scale %s) |
| 162 / T0426 | M · S | says what the amount buys in one or two words beside it, and nothing when the basis is not named |
| 171 / T0427 | M · Z | keeps the whole title, amount and publisher at larger and ordinary text without sharing width with capacity |
| 186 / T0428 | M · S | says the same words to the owner of a task found in discovery as to everybody and as the page of the task does ("Tražim ponude"), never "Tražiš ponude" |
| 196 / T0429 | M · S | say the people a task needs in words (%s total, %s filled): "%s" |
| 206 / T0430 | M · S | says nothing of the count for a task for one person ("0/1" meant nothing), and a face with neither a person nor a count has no foot at all |
| 217 / T0431 | M · S | retains the full audience-specific count in the shared component used by the composer and preview |
| 226 / T0432 | M · S | show the owner the progress on a task of mine met in discovery, with no person |
| 234 / T0433 | M · Z | puts the publisher after the terms with the one initials rule and a rating that says how many reviews it stands on |
| 243 / T0434 | M · Z | uses caller-supplied media and restores initials when absent without changing the card action or rating |
| 255 / T0435 | M · S | rate honestly with %s |
| 267 / T0436 | M · Z | draw no rating when none is known, and no person without a name |
| 274 / T0437 | M · Z | shows only the privacy-safe public start street on the discovery card, never house number or destination |
| 290 / T0438 | M · Z | comes from the list that read the task, after the rating, and is heard with the card |
| 299 / T0439 | M · Z | is said alone when the poster has no rating, and is not invented where the list does not know it |
| 309 / T0440 | M · S | states the draft and the closure of a task, and never repeats the state its section is named for |
| 323 / T0441 | M · S | waits exactly when the list's attention rule says so, for every state, place count and application count |
| 337 / T0442 | M · S | %s is the mark "%s" at the end of the amount's row, and the card's sentence still says "%s" |
| 352 / T0443 | M · S | is nothing for a task that is not mine and not applied to: no mark, no empty row |
| 359 / T0444 | M · S | keeps HITNO and the life of a task above the title: a draft or a closed task is a state, not a relation |
| 367 / T0445 | M · Z | gives application states a full-width value and stacks ownership at narrow or large text sizes |
| 387 / T0446 | M · Z | says how far the task is after the place, only once the person has said where they are and the task has a public point |
| 410 / T0447 | M · S | is one sentence after the command name, in the order the face is drawn |
| 419 / T0448 | M · Z | has no stop of its own inside: the whole face sits under a subtree hidden from assistive technology |
| 431 / T0449 | M · Z | draws the time as a fact with the time picture, and never as a confirmation |
| 437 / T0450 | M · S | retains the complete time range at every text size (text scale %s) |
| 443 / T0451 | M · Z | keeps the schedule confirmation classifier independent of the artwork |
| 451 / T0452 | M · Z | keeps the whole title, the whole range and the whole person at %s dp, text scale %s |
| 463 / T0453 | P · F | draws no frame of its own: the Surface is the only container and there is no card inside it |

### src/data/__tests__/task-card-layout-class.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 101 / T0454 | M · S | 1264 px at 560 dpi is 361 dp, and 47 px of cap height at 16 sp is the 1.15 text scale |
| 110 / T0455 | M · S | so its layout class is compact (not stacked) at 1.15, and large only from 1.3 |
| 118 / T0456 | M · S | width %s dp, text scale %s: publisher keeps full width |
| 127 / T0457 | M · S | my own task met in discovery, width %s dp, text scale %s: capacity stays a fact without an empty publisher footer |
| 135 / T0458 | M · S | long titles and amounts retain their own full-width reading groups |
| 148 / T0459 | M · S | width %s dp, text scale %s: stacked = %s |
| 157 / T0460 | M · S | the gallery can still force the large layout on a roomy phone, and the phone's class decides when nothing is forced |
| 172 / T0461 | M · S | width %s dp, text scale %s: the command name and every word are the same sentence |
| 184 / T0462 | M · S | long monetary values retain the complete amount and basis at%sdp/%s |
| 238 / T0463 | M · S | knows the width of every glyph it measures: the table is the bundled font, not a copy that drifted |

### src/data/__tests__/task-card-urgency.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 33 / T0464 | M · S | draws no top row for an expired HITNO on a task with no status |
| 40 / T0465 | M · S | draws the badge while HITNO holds and drops the row the moment it expires |
| 51 / T0466 | M · S | runs one urgency timer per card and hands that clock to the badge |
| 60 / T0467 | M · Z | a badge given a clock follows it and runs no timer; without one it keeps its own |
| 78 / T0468 | M · S | keeps a status row when there is a status, with or without HITNO |

### src/data/__tests__/task-photo-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 57 / T0469 | M · Z | uses measured width for each authorized page, updates the real counter, and keeps the chosen page on resizing |
| 72 / T0470 | M · Z | opens the pressed photo in a full-screen authorized viewer and synchronizes the page when closed with Android Back |
| 88 / T0471 | M · Z | respects reduced motion and exposes an explicit close control |
| 95 / T0472 | M · S | closes the viewer and retires old photos when the task or account revision changes |
| 108 / T0473 | M · Z | does not preserve an open native viewer after leaving the route |
| 114 / T0474 | M · S | draws nothing for an empty list and nothing for a read that failed (no sentence, no grey plate), and reads again the next time it is asked |
| 128 / T0475 | M · Z | holds a picture of a photo in the page while the photo is read: never a spinner, never a bare grey plate |
| 135 / T0476 | M · S | leaves a page out when its photo cannot be read, and draws no gallery at all when no photo can be |
| 148 / T0477 | M · S | keeps the counter only for more than one photo |
| 154 / T0478 | M · Z | keeps ProfilePhoto on its original authorized portrait contract |

### src/store/__tests__/session-layout.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 111 / T0479 | M · S | an owned cold Inbox delivery cannot be replaced by an older fallback: %s |
| 125 / T0480 | M · Z | root pushes follow live reduced motion without replacing the navigator: signedIn=%s |
| 142 / T0481 | M · S | keeps the current motion preference when session restoration finishes |
| 153 / T0482 | M · Z | cold launch selects the admitted entry route instead of recovery: signedIn=%s |
| 162 / T0483 | M · Z | replaces private navigation state after batched A→B→A even when the rendered account id matches |
| 172 / T0484 | M · Z | retains private navigation state across a same-account token refresh |
| 181 / T0485 | M · Z | exposes only Auth at cold signed-out startup and excludes every private root route |
| 190 / T0486 | M · Z | exposes the four private root routes only after authentication and excludes Auth |
| 197 / T0487 | M · S | rechecks a newly completed intent and opens its typed destination without setting any mode first |
| 215 / T0488 | M · Z | rejects stale A completion before React cleanup when current account is %s in a newer epoch |
| 226 / T0489 | M · S | handles failed local consumption without a navigation or unhandled rejection |
| 233 / T0490 | M · Z | does not leave Auth from a stale signed-in render after logout |
| 240 / T0491 | M · Z | does not open Auth from a stale signed-out render after a new sign-in |
| 248 / T0492 | M · S | bypasses the decorative intro for an unauthenticated deep route |
| 256 / T0493 | M · Z | continues the completed %s entry shortcut once, as a destination in the one shell |
| 265 / T0494 | M · Z | keeps the recovery route public without consuming a saved intention: signedIn=%s |
| 278 / T0495 | M · S | does not overwrite an unresolved cold native %s link while Auth restores |
| 290 / T0496 | M · S | does not consume a saved user action before the native destination is resolved |
| 300 / T0497 | M · Z | resumes unauthenticated access protection once a private native destination resolves |
| 312 / T0498 | M · S | starts push listeners only after %s has left the protected routing boundary |
| 327 / T0499 | M · S | consumes the completed intention after a signed-in native app destination resolves |
| 355 / T0500 | M · Z | an open account shows nothing, is asked once per incarnation, and not again on a token refresh |
| 365 / T0501 | M · S | is not asked %s |
| 372 / T0502 | M · S | a failed or unclear read shows nothing and blocks nothing |
| 379 / T0503 | M · Z | a confirmed closing stage covers the navigator, hides it from screen readers, and holds push back |
| 394 / T0504 | M · S | shows the progress this device can read, and a closed account as closed |
| 410 / T0505 | M · S | "Proveri stanje" asks again: a failure says so, an open answer lifts the state |
| 423 / T0506 | M · Z | private support, which the guard still admits, opens with the closing state out of its way |
| 437 / T0507 | M · Z | signs this device out of the same account incarnation, and says so when it could not |
| 448 / T0508 | M · S | reads this device's saved closure start, and only a START |

### src/ui/__tests__/press-reduced-motion.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 110 / T0509 | M · Z | does not scale under reduced motion; the press itself still happens |
| 121 / T0510 | M · S | scales on the press duration and springs back when motion is allowed |
| 129 / T0511 | M · S | follows the setting while the app is open: turning motion off stops the next press from scaling |
| 138 / T0512 | M · S | takes its default give from the press-scale ladder, not from a number of its own |
| 147 / T0513 | M · Z | fires once on release, before the caller's own onPress, and never on touch-down |
| 159 / T0514 | M · S | keeps every kind of haptic reachable: select, light, medium, success and error |
| 171 / T0515 | M · Z | says nothing for haptic none, and hands the caller's onPress through untouched |
| 180 / T0516 | M · S | a tap on a surface that has no onPress does nothing, so it ticks nothing; its long press is what ticks (a chat bubble) |
| 190 / T0517 | M · Z | a touch that turns into a scroll before the delay fires nothing and does not shrink |
| 208 / T0518 | M · S | a slower drag that starts to shrink and is then taken by a scroll still ticks nothing, and the surface returns |
| 219 / T0519 | M · Z | a quick tap is not dead: it shrinks, ticks once on release and presses once |
| 233 / T0520 | M · Z | a long press ticks when it happens (the press is cancelled by it), not on the release after it |
| 244 / T0521 | M · Z | keeps ticking under reduced motion: a tick is not movement |
| 258 / T0522 | M · Z | names the surfaces: a button rung and below gives at once, the row rung and above waits |
| 264 / T0523 | M · S | %s gives the instant the finger lands, and ticks on release |
| 276 / T0524 | M · S | %s waits for the delay before it gives, so a finger that is about to scroll shrinks nothing |
| 288 / T0525 | M · S | a card body that does not give itself (scaleTo 1) delays what the card above it gives on: onPressIn arrives after the delay |
| 297 / T0526 | M · S | a sheet command or a button that is tapped quickly gives and settles before a row would even have begun |
| 308 / T0527 | M · S | ticks the moment the finger lands, with no delay, and not a second time on release |
| 319 / T0528 | M · Z | still hands the caller's onPress through untouched |
| 324 / T0529 | M · S | a caller's own delay is respected |
| 335 / T0530 | M · S | draws no Reanimated state at all, yet keeps the press, the haptic and the caller's handlers |
| 351 / T0531 | M · S | a scaling Press does draw one shared value and one animated style |
| 357 / T0532 | M · S | is chosen at mount: the surface is never swapped for another element type, so nothing under it remounts |
| 372 / T0533 | M · Z | holds still under reduced motion, as it always did, and still ticks |
| 386 / T0534 | M · S | gives to the row rung of the ladder by default and springs back; one shared value and one style |
| 397 / T0535 | M · S | takes another rung when asked |
| 403 / T0536 | M · Z | under reduced motion never gives, and puts the card back at once, even if the setting changed mid-press |
| 424 / T0537 | M · Z | %s: ticks once, on release, with the change, and not when the finger lands |
| 437 / T0538 | M · S | %s: a finger that lands and is taken by a scroll ticks nothing and changes nothing |
| 445 / T0539 | M · S | ticks nothing for the segment that is already chosen: nothing changes |
| 453 / T0540 | M · S | a segment that gives takes the button rung of the ladder |
| 460 / T0541 | M · S | in a rail that scrolls, a finger that starts a drag ticks nothing and shrinks nothing; the tick waits for the tap to complete |

### src/ui/__tests__/public-profile-safety-entry.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 31 / T0542 | M · Z | offers one entry from the profile and opens bezbednost with the person the server resolved |
| 43 / T0543 | M · S | says plainly that there is no target instead of opening a screen that cannot act |
| 52 / T0544 | M · Z | carries the server refusal without inventing a navigation |
| 61 / T0545 | M · S | does not send a second read while the first is still open |
| 77 / T0546 | M · Z | a delayed safety target cannot navigate after the screen unmounts |
| 87 / T0547 | M · S | blur retires a lookup even if the same screen is focused again before it answers |
| 102 / T0548 | M · Z | changing the %s retires both the old result and its retained press handler |
| 121 / T0549 | M · S | a retired rejection cannot clear a newer lookup or add an old error |

### src/ui/__tests__/release-safety-surfaces.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 24 / T0550 | M · Z | a screen that throws while rendering says it did not open and offers retry and the start, never the raw error |
| 36 / T0551 | M · Z | the success mark buzzes once only when the thing has just happened; a reopened receipt is still |

### src/ui/__tests__/safety-target-name-entry.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 44 / T0552 | M · S | opens bezbednost with %j and nothing more |
| 53 / T0553 | M · Z | carries no name and no profile even when the server result has one |
| 62 / T0554 | M · S | opens bezbednost with %j and the profile it was opened from |
| 70 / T0555 | M · Z | never puts the displayed name in the route (server result %#) |
| 77 / T0556 | M · S | still opens nothing for a profile that is no target |

### src/ui/support/__tests__/SupportContextEntry.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 36 / T0557 | M · S | reads the existing owned case before routing with only opaque identifiers (%s) |
| 44 / T0558 | M · Z | serializes duplicate taps and blocks the retained callback even before navigation blur arrives |
| 49 / T0559 | M · Z | drops a late context read after %s |
| 60 / T0560 | M · S | a flip of the retired app mode drops nothing: the context read in flight still opens support |
| 65 / T0561 | M · Z | two background cycles release only their own listener and never reuse a previous foreground read |
| 75 / T0562 | M · S | shows a bounded service failure and does not infer ABSENT or navigate automatically |
| 80 / T0563 | M · Z | a retained callback from the previous focus cannot acquire the new focus lease |
| 85 / T0564 | M · Z | drops a lookup from replaced parent authority but releases the same screen busy indicator for an explicit fresh read |
| 93 / T0565 | M · S | previews only the chosen message and performs no lookup until the explicit continuation |
| 105 / T0566 | M · S | a selected message continuation is invalid after %s |
| 116 / T0567 | M · S | a sheet that closes while the parent guard says no still takes its choice with it |
| 125 / T0568 | M · S | the entry keeps its words while it checks, with a spinner |
| 130 / T0569 | M · S | the continuation leaves with the sheet: it is gone before the next screen opens |

### src/ui/system/__tests__/action-states.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 31 / T0570 | M · S | is never under 48 px, and the primary is 54 as the brand action |
| 43 / T0571 | M · Z | keeps a readable label when disabled: muted ink on the quiet wash, never a faded ghost |
| 56 / T0572 | M · Z | keeps its colour and its words while loading, shows a spinner, cannot be pressed twice and is spoken as busy |
| 68 / T0573 | M · Z | shows the check for 1.2 s only when the caller says the write is confirmed |
| 85 / T0574 | M · Z | settles the check in with a short scale, and simply shows it under reduced motion |
| 96 / T0575 | M · S | draws a danger outline and the caller's message right under the button, announced as an alert |
| 109 / T0576 | M · Z | draws a disabled button's icon in the label's muted ink, and keeps the live icon's own colour otherwise |
| 122 / T0577 | M · Z | says why a disabled action cannot be pressed: a muted line under it and the same words as its spoken hint |
| 142 / T0578 | M · S | keeps a row of buttons in its columns when one of them says something under itself |
| 170 / T0579 | M · Z | keeps the same button when its error or reason appears, because a caller that passes the prop gets the column at once |
| 186 / T0580 | M · S | announces a reason that appears or changes, but not the one it was drawn with, nor the same one after working |
| 209 / T0581 | P · F | draws every primary action green with a white label in any tone: neutral never makes one black |
| 231 / T0582 | P · F | writes the label white on the brand surface and green on every other action |

### src/ui/system/__tests__/actual-user-avatar.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 61 / T0583 | M · Z | keeps profile navigation available before identity arrives and uses the authorized profile ID |
| 76 / T0584 | M · S | reads the worker fallback only after an authoritative missing requester, never after an error |
| 89 / T0585 | M · Z | cannot republish an old account after A to B to A, including a changed session revision |
| 103 / T0586 | M · S | clears a loaded photo immediately when the same account receives a new revision |
| 114 / T0587 | M · Z | retires a pending read on blur before fallback and reads the current identity after focus returns |
| 124 / T0588 | M · Z | forgets the visible photo on background and ignores an older read after foreground resumes |
| 137 / T0589 | M · S | forgets the photographs the app remembers when its account goes away, and forgets nothing when it is only drawn again for the same account |

### src/ui/system/__tests__/appear.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 57 / T0590 | M · S | is silent for what was already there, and for the same rows read again |
| 64 / T0591 | M · Z | animates the row that was not there before, once |
| 73 / T0592 | M · Z | switching to existing history or a filter is silent, while a later incoming record still enters once |
| 90 / T0593 | M · S | carries an entrance only for the row the list called new |
| 97 / T0594 | M · Z | does nothing at all when the system asks for less motion |
| 106 / T0595 | M · S | a row that was already there is a plain View: no Reanimated view for a settled list |
| 113 / T0596 | M · S | only the arriving row carries an animated view |
| 125 / T0597 | M · S | a row that mounted settled never becomes an animated view, even if it is later asked to animate |
| 134 / T0598 | M · S | a row that mounted arriving keeps its element when the list stops calling it new: nothing remounts |
| 146 / T0599 | M · Z | reduced motion read at mount keeps a row plain, and turning it on later does not swap an arriving row |
| 160 / T0600 | P · F | steps by sys.motion.stagger per row, and gives every row past the sixth the delay of the sixth |
| 173 / T0601 | P · F | a row that arrives at position 40 waits no longer than the one at position 6, and every entrance is one enter long |
| 195 / T0602 | P · F | is given easeOut explicitly, the one curve of every entrance |
| 201 / T0603 | P · F | starts 8 dp below its place, the rise of the outcome bar, not the 25 dp of the preset |
| 209 / T0604 | P · F | comes from above (-8 dp) when `from="above"`, from below (+8 dp) by default and when `from="below"`: only the side differs |
| 223 / T0605 | P · F | gives every row of a list the same curve and the same rise, whatever its position |
| 234 / T0606 | M · Z | asks for no entrance at all under reduced motion: nothing moves, so there is nothing to shape |
| 242 / T0607 | P · F | keeps each doc on its own declaration: the list's memory is documented on useAppear, not on the constant above it |
| 251 / T0608 | M · S | without the option the first list is what was already there: a warm return stays still |
| 257 / T0609 | M · Z | with the option the rows arrive, once, and the same rows read again are silent |
| 265 / T0610 | M · Z | a view key given on the very first call does not turn the arrival into a baseline |
| 270 / T0611 | M · Z | only the first rows arrive, never a whole page of animated views |
| 277 / T0612 | M · S | still skeleton (no rows yet) then the first rows: they arrive; a filter change afterwards stays still |
| 285 / T0613 | M · Z | is an arrival once: a later list that had no rows is not a second skeleton |
| 292 / T0614 | M · Z | makes no motion at all under reduced motion |

### src/ui/system/__tests__/arrive.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 27 / T0615 | M · S | takes sys.motion.arrive: its duration and its curve, on the native driver, after the delay it was given |
| 37 / T0616 | M · S | is long on purpose: a moment, never something a finger waits on (R6) |
| 42 / T0617 | M · S | only settles: every value goes one way, from where it starts to where it stays, and none goes past it |
| 58 / T0618 | M · S | follows a curve that does not overshoot either: it stays between 0 and 1 from the first moment to the last |
| 67 / T0619 | M · Z | does not move at all under reduced motion: it is simply there |
| 74 / T0620 | M · Z | under reduced motion it stands at once in its final place: no rise, no tilt, full opacity |
| 84 / T0621 | M · S | goes down and up over sys.motion.loop.breath each, on the native driver |
| 92 / T0622 | M · Z | does not breathe under reduced motion: the placeholder stands still at full opacity |

### src/ui/system/__tests__/avatar.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 17 / T0623 | M · S | draws the initials in a %i px disc, never under 12 px, and keeps them inside it |
| 27 / T0624 | M · S | no initials (%j) draw a person, not letters |
| 33 / T0625 | M · S | a name with no letters in it reaches the disc as the person, through inicijali() |
| 39 / T0626 | M · Z | is decoration beside the name: a screen reader does not hear it |
| 52 / T0627 | M · F | are off by default: the disc is the whole of the face, with no wrapper, no edge and no shadow |
| 59 / T0628 | M · S | with edge wraps the same disc in two dp of white and one soft shadow, centred, so the face lies on the screen as a sticker |
| 69 / T0629 | M · S | with ring adds a ring outside the edge: green for a live Dogovor, the strong line for one that is over |
| 76 / T0630 | M · Z | wraps anything that is a face, the photo included, and is decoration like the face: a screen reader does not hear it |

### src/ui/system/__tests__/balanced.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 9 / T0631 | M · S | asks Android for the balanced break strategy, which is a prop of the text |
| 13 / T0632 | M · S | gives a phone no style of its own for it: under Jest the platform is not the web |
| 17 / T0633 | M · S | gives the web design lab the CSS one, so a screenshot taken there says what the phone is asked for |

### src/ui/system/__tests__/confirm-dialog.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 52 / T0634 | M · Z | asks with a title, one sentence, one confirm and one quiet cancel |
| 69 / T0635 | M · S | is a white card with corner 24 and a soft shadow, at most 340 wide, over a screen dimmed to 0.35, in a native Modal |
| 84 / T0636 | M · Z | draws a destructive confirm in the danger colour, at the primary's measure |
| 89 / T0637 | M · S | keeps a long sentence scrollable while the title and the two commands stay put, and never taller than the window less 24 each side |
| 102 / T0638 | M · S | says what a tap outside does to the question, and is not visited while the command it started runs |
| 113 / T0639 | M · Z | turns the pressed confirm busy in place, without drawing the card or its buttons again |
| 126 / T0640 | M · Z | runs a confirm once, however often it is pressed, then closes without cancelling |
| 134 / T0641 | M · Z | stays busy and cannot be left while the command it started runs, and reports nothing itself |
| 155 / T0642 | M · Z | lets Back and a tap outside close the window once the command runs long, without cancelling or repeating it |
| 176 / T0643 | M · S | closes after a command that fails, leaving the failure to the screen that owns it |
| 184 / T0644 | M · Z | cancel runs the cancel path once, and a confirm pressed after it does nothing |
| 192 / T0645 | M · Z | %s is a cancel |
| 199 / T0646 | M · Z | a notice has one button and nothing to cancel |
| 214 / T0647 | M · Z | opens on a scale from 0.96 over 200 ms, decelerating, on the native driver, inside the Modal's own fade |
| 230 / T0648 | M · Z | is simply there under reduced motion: the Modal does not fade, the card does not scale, no timing at all |
| 254 / T0649 | M · S | draws nothing until a dialog has been asked, then one native Modal while it is open |
| 264 / T0650 | M · S | is over for the screen, and gone from its tree, the moment it is answered |
| 279 / T0651 | M · Z | shows a new question at once when it is asked over an open one, and the old one ends as a cancel |
| 292 / T0652 | M · Z | follows the caller's reading of reduced motion for the Modal's fade |
| 307 / T0653 | M · S | is a dialog unless the request carries extra content or asks for the sheet |
| 317 / T0654 | M · S | draws a plain request as a dialog, and extra content or form "sheet" as the bottom sheet, through the same hook |
| 333 / T0655 | M · S | a question that is a sheet answers like a sheet, and the sheet and the dialog share the one contract |
| 348 / T0656 | M · S | a dialog drawn on its own (no hook) is a Modal that is over as soon as it is answered |

### src/ui/system/__tests__/disclosure.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 33 / T0657 | M · S | opens and closes in place, speaks its state and is at least 56 px high |
| 45 / T0658 | M · S | follows the caller when it owns the state, and tells it what the press asks for |
| 57 / T0659 | M · F | turns its caret over in 180 ms on a real change, and at once under reduced motion |
| 72 / T0660 | M · S | speaks its hint with the label, since the hint is a fact about what the row holds |
| 80 / T0661 | M · S | lines what it opens up under the label when the row has a picture |
| 87 / T0662 | M · S | keeps its spacing on the sys.space scale; a list inside a card is inset by the card's own padding |
| 97 / T0663 | M · S | draws a list of its rows in a plain column, with the hairline between rows but not above the first (`divider`, `inset`) |
| 116 / T0664 | M · S | draws the Dogovor's AgreementSection through it: closed until pressed, and with no line above it (sections are separated by space, UI pass 2026-10-08) |

### src/ui/system/__tests__/dizajn-sistem-gallery.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 47 / T0665 | M · Z | refuses fixture content in a store build (%s), regardless of the scene query |
| 55 / T0666 | M · S | lists the nine scenes as rows with an arrow, in the order of the plan, and draws nothing else of the system until one is chosen |
| 64 / T0667 | M · S | opens a scene when its row is pressed and returns to the index with the arrow back |
| 72 / T0668 | M · S | leaves the gallery by the router when there is something to go back to, and to the start when there is not |
| 86 / T0669 | M · Z | draws from fixtures only, with no data client and no account, and every press is inert |
| 95 / T0670 | M · Z | redovi: touched rows have an arrow, info rows have none, the last of a group has no divider, a face row has the 56 slot |
| 110 / T0671 | M · Z | zapisi: a record that is touched, a panel, a float and the three tints of a note |
| 117 / T0672 | M · S | uslovi: facts on a detail screen, and the terms with a price, an action and a node as a value |
| 127 / T0673 | M · S | izbor: two options, three options (also with the old flags) and five chips that scroll |
| 139 / T0674 | M · Z | podnozje: a flow whose foot says why the green action cannot be pressed, and lets it go when it can |
| 150 / T0675 | M · Z | dugi: the longest names the app meets are drawn whole, in a wrapped title, never cut |
| 159 / T0676 | M · S | veliki: the components are told "large" by the override, so a key-value row stacks and a section's action goes under its title |
| 174 / T0677 | M · S | lists the states as rows of their own, with an arrow, and opens one full screen under its bar, with the arrow back to the list |
| 186 / T0678 | M · Z | names every state a person meets: empty three ways, a wait in three shapes, a failed read, no connection (a screen and a strip), a service that is down, and an unknown outcome three ways |
| 192 / T0679 | M · Z | draws from fixtures only: no data client, no account, and every press is inert |
| 199 / T0680 | M · S | is also drawn at text scale 1.3, by `&veliki=1` |
| 205 / T0681 | M · F | puts an empty state in a screen that does not scroll, so the block has the whole room to lie a third of the way down in, and a wait in one that does |
| 213 / T0682 | M · S | draws the three empty lists as the rules of StateView write them: the first time, a filter and everything done |
| 225 / T0683 | M · S | waits in rows, records and facts: each is the shape the list is told, and nothing in it can be pressed |
| 234 / T0684 | M · S | says a read that did not arrive, no connection and a service that is down in the words of the table, each with the one button |
| 244 / T0685 | M · S | draws "no connection" as a strip over the rows the screen already has, with the one word that reads again |
| 251 / T0686 | M · S | draws "we do not know" as a screen with the one button Proveri, then as the button at work, and as a note in the foot of a flow that stays |
| 274 / T0687 | M · Z | draws the compact state inside two sections of a screen that scrolls, and the longest words of a failure whole |

### src/ui/system/__tests__/fact-art.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 185 / T0688 | P · F | draws the flat mark at 24 px and below and the sticker above, so no call site needs an edit |
| 193 / T0689 | P · F | lets the board force a cut, and a size between the two cuts (a Profil row, 26 px) keeps the sticker |
| 199 / T0690 | P · F | draws what the cut says at %i px: no ground shadow in the mark, one in the sticker |
| 209 / T0691 | M · S | draws the cut it is asked for whatever the size |
| 218 / T0692 | P · Z | draws every kind at every size in use, hidden from screen readers, on the 32-unit canvas |
| 233 / T0693 | P · Z | renders a picture of each cut, hidden from screen readers, at the size asked for |
| 246 / T0694 | P · F | %s draws green, with no orange, at 16 px, and turns grey when it is not active |
| 258 / T0695 | P · F | keeps the default size at 20 and accepts `muted` as before, drawing the same shapes in the quiet tone |
| 272 / T0696 | P · Z | %s lies inside the canvas, with no hairline stroke or sliver of fill |
| 289 / T0697 | P · F | %s draws no ground shadow, no edge and no shine: one fill tone and white, nothing else |
| 296 / T0698 | P · Z | %s keeps every white detail on the tone: a white detail that falls off its shape vanishes on a white card |
| 311 / T0699 | P · F | draws every kind in the tone it is given, and nothing but that tone and white |
| 318 / T0700 | P · Z | keeps every tone at 3:1 or more against white, and the white detail at 3:1 or more against the tone |
| 328 / T0701 | P · F | draws both people of the pair in the full tone, side by side, the second one smaller |
| 341 / T0702 | P · F | draws the calendar as a body, a header band, two rings and two lines, and the clipboard as a board, a clip and two lines |
| 352 / T0703 | P · F | draws the mark with at most four shapes, and always fewer than the sticker |
| 363 / T0704 | P · F | %s keeps the approved construction: a ground shadow first, every shape inside the canvas |
| 379 / T0705 | P · F | reserves the attention orange palette for the bell, the star and the alert by default |
| 388 / T0706 | P · F | keeps the small mark in brand green and draws the large pin in its semantic location material |
| 408 / T0707 | P · F | turns grey when it is not active and orange or red only on request |
| 421 / T0708 | P · Z | has one phrase for every kind and no two kinds share it |
| 428 / T0709 | P · Z | draws no two kinds the same, in either cut |
| 439 / T0710 | P · F | draws the price tag, the agreement and the conversation as three different shapes |
| 452 / T0711 | P · F | draws the new task and the clipboard of your own list apart: a badge with a plus, and a clip |
| 461 / T0712 | P · Z | finds a tick by its shape: a short stroke down and a longer one up, not an arrow head |
| 469 / T0713 | P · Z | draws a tick on the check, the agreement and the shield only, in both cuts |
| 476 / T0714 | P · Z | draws no tick on the calendar, the task list or the remote screen: an unconfirmed term does not wear a confirmation |
| 489 / T0715 | M · S | draws every kind from FACT_KINDS on the ladder, and the sticker beside the mark at 16, 20 and 24 |
| 498 / T0716 | P · F | draws the four tones |
| 504 / T0717 | P · F | shows the two oranges side by side: the accent kinds as the sticker at 26 and as the mark at 24 |
| 521 / T0718 | P · Z | draws the pin's hole shade in the tone it is in, so an orange, grey or red pin has no stray green in it |

### src/ui/system/__tests__/fact-material.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 24 / T1313 | M · S | preserves vector meaning for %j (generički it.each) |
| 16 / T0719 | M · S | bundles decorative art without a network request or entrance fade |
| 38 / T0720 | M · S | allows a deliberately chosen decorative 24dp illustration |

### src/ui/system/__tests__/fact-row.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 24 / T0721 | M · S | is a 28 dp picture of the kind asked for (above 24 it is the 2.5D sticker, not the flat mark), 12 dp before the fact |
| 34 / T0722 | M · S | keeps its picture on the FIRST line: a fact that wraps does not centre it on the middle one |
| 42 / T0723 | M · S | is the `note` type (14/20) in the `fact` colour; the note under it is `meta`, grey |
| 48 / T0724 | M · S | is the card size when nothing is said |
| 53 / T0725 | M · S | centres the first line of 20 on a picture of 28: the text starts 4 dp down |
| 62 / T0726 | M · S | is the `body` type (16/24) in ink; the note under it is `note`, grey |
| 68 / T0727 | M · S | centres the first line of 24 on the picture of 28: the text starts 2 dp down |
| 76 / T0728 | M · S | cuts nothing with an ellipsis: a long fact and a long note wrap, at any size |
| 85 / T0729 | M · Z | is one sentence for a screen reader: the fact, then its note; the picture says nothing |
| 92 / T0730 | M · Z | has no divider, no border and no background: a fact is a line, not a box |

### src/ui/system/__tests__/flow-footer.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 20 / T0731 | M · Z | pins the action on the surface under a hairline, at the screen gutter, inside the screen's own safe area |
| 30 / T0732 | M · S | keeps clear of the bottom edge itself only where the screen asks it to, with the same surface reaching the edge |
| 40 / T0733 | M · F | is 20 / 12 / 12 and 8, spelled with the grid: the gutter, and the one divider |
| 47 / T0734 | M · F | holds one green action and one quiet one, one under the other, as it was handed them |
| 57 / T0735 | M · S | stands ABOVE the actions, in the `note` type in grey, and the actions follow in the order given |
| 63 / T0736 | M · S | is announced politely when it appears or changes, so the person hears what is still missing |
| 68 / T0737 | M · S | is not drawn at all when nothing is missing: no empty line, and the foot is the same foot |
| 76 / T0738 | M · Z | is wrapped, never cut: a long reason takes two lines and the foot grows |
| 81 / T0739 | M · S | has the same measure with the bottom edge kept by the foot itself, and the reason is inside it |
| 88 / T0740 | M · S | takes its test id from the foot's, so two feet on one screen can be told apart |

### src/ui/system/__tests__/glyph-board-render.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 29 / T0741 | M · Z | draws the bar preview, the whole glyph registry and the controls with their words |

### src/ui/system/__tests__/glyph-board.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 15 / T0742 | M · S | draws the real bar parts and lets the owner tap them: a section of its own with the preview |
| 21 / T0743 | M · S | says what it is, in his words: the new bar is built from the same parts as the real one, and it is not a before and after |
| 30 / T0744 | M · F | draws every name of the registry at the three sizes and in every tone, and the on-state |
| 39 / T0745 | M · S | asks the registry for every icon: the board imports no icon package of its own |
| 45 / T0746 | M · Z | shows a bare control and a captioned one side by side, so he can judge a word beside a glyph |
| 53 / T0747 | M · S | speaks every captioned control by a label that contains the word on it |
| 59 / T0748 | M · S | keeps every older section: the system icons, the two cuts, the tones, the pickers and the real task card |

### src/ui/system/__tests__/glyph-import-guard.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 60 / T0749 | M · S | finds each way of taking the package in, and nothing else |
| 74 / T0750 | M · S | no file outside Glyph imports the package unless it is on the shrinking list, and every listed file still does |
| 83 / T0751 | M · S | the list has the size it says, never lists Glyph itself, and Glyph really is the importer |
| 89 / T0752 | M · S | the two system components of the chrome are off the list: they ask Glyph |
| 97 / T0753 | M · S | the navigation asks Glyph and imports no icon package of its own |

### src/ui/system/__tests__/glyph.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 31 / T0754 | M · S | names exactly the controls the app draws, no more and no fewer |
| 36 / T0755 | M · S | %s draws the Phosphor icon %s |
| 41 / T0756 | M · S | gives no two names the same drawing: one meaning, one picture |
| 50 / T0757 | M · S | refuses a name that is not in it, a size off the 16, 20, 24 ladder, a tone outside the five, and a weight of the caller's own |
| 64 / T0758 | M · S | has chrome 24, row 20 and in-text 16, and draws 20 in ink unless told otherwise |
| 74 / T0759 | M · S | draws each tone in its token colour and no other |
| 86 / T0760 | M · S | is bold at 16 and below, and for check, close, plus and minus at any size |
| 91 / T0761 | M · S | is regular at 20 and 24 for everything else |
| 97 / T0762 | M · S | is fill only for an on-state, which wins over everything else |
| 109 / T0763 | M · S | lets the chrome ask for bold at any size, and nothing picks a weight of its own |

### src/ui/system/__tests__/haptics.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 66 / T0764 | M · Z | %s is %s(%j), once, and nothing of Android's |
| 74 / T0765 | M · Z | the two tables cover the same ten kinds, each once |
| 84 / T0766 | M · Z | %s is the system's %s, once, with no vibrator waveform |
| 92 / T0767 | M · S | names constants the installed package really has, by their own values |
| 99 / T0768 | M · S | asks in the same turn as the tick: it keeps pace with the picture, nothing waits for a promise first |
| 113 / T0769 | M · S | a choice falls back from Segment_Tick to Context_Click, and stops there |
| 121 / T0770 | M · Z | a confirmed outcome falls back from Confirm to Virtual_Key, and stops there |
| 129 / T0771 | M · S | a switch tries its own constant, then the choice tick, then the plain click (Toggle_On came with Android 14) |
| 137 / T0772 | M · S | %s: when every constant is refused it plays what it played before this wrapper, the vibrator form %s(%j) |
| 144 / T0773 | M · S | a package without the function, or a build whose JS is newer than its native half, plays the vibrator form |
| 168 / T0774 | M · S | %s: a rejected promise is taken, and a throw at the call is caught; nothing comes out of tick() |
| 185 / T0775 | M · S | %s: with no haptics function at all it is silence, not an error |
| 197 / T0776 | M · S | is silence for a kind it does not know (a caller from plain JavaScript) |
| 207 / T0777 | M · F | the gap is 120 ms: a second tick of the same kind at 119 ms is dropped and at 120 ms it plays |
| 215 / T0778 | M · S | a lighter tick or an equal one right after a heavier one is dropped |
| 221 / T0779 | M · Z | a HEAVIER tick right after a lighter one plays: an outcome is never held back by the touch that caused it |
| 228 / T0780 | M · S | a dropped tick does not push the window on: the gap is counted from the last tick that PLAYED |
| 233 / T0781 | M · S | a clock that went backwards (the device's time was changed) is not "just now" |
| 238 / T0782 | M · Z | forgetTicks() lets the next tick through at once, for tests whose clocks do not share a past |
| 260 / T0783 | M · S | no other file imports the haptics package: a new tick is `tick(kind)`, not a call of its own |
| 267 / T0784 | M · S | Press ticks through it, and does not know the package |
| 272 / T0785 | M · Z | the outcome bar and the success mark tick a confirmed outcome through it too: tick('success'), the system's own Confirm on Android |
| 281 / T0786 | M · Z | does not read the reduced-motion store: a tick is not movement, and a person who asked for less motion has not asked for less feedback (R5, R7) |

### src/ui/system/__tests__/info-button.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 32 / T0787 | M · Z | draws only the mark until it is touched, and names what it explains |
| 42 / T0788 | M · S | opens the explanation in a sheet with its title and lines |

### src/ui/system/__tests__/key-value-row.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 35 / T0789 | M · S | draws the label in `meta`, grey, and the value in `body`, in ink |
| 41 / T0790 | M · S | draws the one amount of a screen in the `priceLarge` type with `emphasis="price"` |
| 47 / T0791 | M · S | draws a node as it was given, at the end of the line |
| 54 / T0792 | M · S | wraps a long label and a long value: nothing is cut with an ellipsis |
| 62 / T0793 | M · S | is 12 above and under, 12 between the label and the value, and never under 48 dp, with the value at the end of the line |
| 70 / T0794 | M · S | lets the label take at most 45 % and wrap, so a long label never leaves the value no room |
| 77 / T0795 | M · Z | is 1 dp in `line`, from the left edge (the label starts there) to the right, and does not take the touch |
| 84 / T0796 | M · S | is not drawn under the last row of a group, and the row has no border of its own |
| 94 / T0797 | M · S | is a button named with the label it belongs to, which runs the caller's command |
| 103 / T0798 | M · Z | is written 15/600 in green and is a touch of 48 dp that fits the row, which is 48 high |
| 110 / T0799 | M · Z | stands after the value, not inside the sentence a screen reader says for the label and the value |
| 119 / T0800 | M · S | reads a string value together with its label as one sentence, and a node as it is |
| 131 / T0801 | M · S | stacks them in one column that starts at one edge, with no right alignment and no share of the width |
| 148 / T0802 | M · S | is more than 40 characters: the scope of a task is a paragraph, not a figure |
| 158 / T0803 | M · S | keeps a value of 40 characters or fewer on the line, at the end, as a figure |
| 165 / T0804 | M · S | never stacks a node by its length: a node is drawn as given |
| 170 / T0805 | M · Z | puts the action under the long value, with the same 48 dp touch |

### src/ui/system/__tests__/layout-class-override.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 27 / T0806 | M · S | is large, and stacked, for what it forces, at any window: the answer the phone gives at text scale 1.3 |
| 33 / T0807 | M · Z | is not there in the app: with no provider the window decides, at ordinary text and at large text |
| 40 / T0808 | M · S | wins over the window it forces, and gives the window back when a provider carries nothing |
| 46 / T0809 | M · S | reaches every component under it, however deep, and none outside it |

### src/ui/system/__tests__/layout-ladder.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 24 / T0810 | M · S | reads each way a space is written as a number |
| 30 / T0811 | M · S | lets a name through: a space written as `sys.space.md`, `-sys.space.md` or `layout.group` is the way |
| 34 / T0812 | M · S | does not take a size for a space, and does not read a comment |
| 41 / T0813 | P · F | %s spells no padding, margin or gap off the ladder |
| 46 / T0814 | P · F | %s does not draw the platform's hairline |
| 50 / T0815 | M · S | looks at real files: each primitive is long enough and spaces itself by name, so an empty read cannot pass for a clean one |
| 58 / T0816 | P · F | is every step of sys.space (4 · 8 · 12 · 16 · 20 · 24 · 32 · 48), and 0, 1 and 2 for a line and a half-leading |
| 63 / T0817 | P · F | every distance in layout.ts is on it |

### src/ui/system/__tests__/layout.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 11 / T0818 | P · F | is exactly the agreed set of names and values |
| 18 / T0819 | P · F | has one divider, 1 dp, and it is not the platform's hairline |
| 24 / T0820 | M · S | every distance between things is a step of sys.space |
| 34 / T0821 | P · F | the edge of the screen is `sys.space.lg` (20): the one step that is an edge and never a distance between things |
| 41 / T0822 | M · Z | a touch is never smaller than the system's minimum, and a row is at least a touch high |
| 52 / T0823 | M · S | imports nothing: `tokens.ts` includes it later, and a token file is not reached by a cycle through its own numbers |
| 58 / T0824 | P · F | exports exactly `layout` and `ruleWidth` |

### src/ui/system/__tests__/list-row.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 38 / T0825 | M · S | draws the title at 16/24, then the subtitle as `note` and the meta line as `meta`, both grey, in that order |
| 46 / T0826 | M · Z | writes the title in 600 when the row is touched and in 400 when it only tells |
| 53 / T0827 | M · Z | never cuts a long title or line with an ellipsis: it wraps |
| 61 / T0828 | M · S | is 56 dp high with neither a second line nor a picture, and 64 with either; 12 of padding and 12 between its parts |
| 72 / T0829 | M · Z | is never a touch smaller than 48 dp |
| 79 / T0830 | M · Z | starts at the edge without a picture: the divider runs the whole width |
| 85 / T0831 | M · S | starts 52 from the edge with a picture (slot 40 + 12): the divider is inset by that |
| 93 / T0832 | M · S | starts 68 from the edge with a face (slot 56 + 12), for the lists of people |
| 100 / T0833 | M · S | is 1 dp, never a hairline, and the last row of a group draws none |
| 110 / T0834 | M · Z | does not take the touch: the divider lets it through |
| 117 / T0835 | M · S | with onPress it is a button with the arrow, a press that gives on the row rung, a tick, and the caller's name and hint |
| 129 / T0836 | M · Z | without onPress it has no arrow and no press, and is one stop for a screen reader that says all its lines |
| 137 / T0837 | M · S | an info row that holds a node of its own is not made one stop, so that node can still be reached |
| 143 / T0838 | M · S | a name from the caller wins on an info row too |
| 150 / T0839 | M · S | a danger row is pressed and has no arrow: "Odjavi se" does something, it does not open a screen |
| 159 / T0840 | M · S | `arrow` overrides the default in both directions: a red row that opens a flow keeps its arrow, and a plain one can drop it |
| 166 / T0841 | M · S | never draws an arrow for a row that only tells, whatever `arrow` says: nothing that looks like a link goes nowhere |
| 174 / T0842 | M · S | stands after the text and before the arrow, so a chip or a dot is not under the arrow |
| 182 / T0843 | M · Z | goes UNDER the words at a large text size, so it does not crush them, and the arrow stays at the end |
| 197 / T0844 | M · S | draws the value in grey after the words and before the caret, and speaks it after the title |
| 205 / T0845 | M · Z | wraps a long value inside half the row and never cuts it |
| 212 / T0846 | M · Z | puts the value under the title at a large text size, with the node at the end, so it does not crush the words |
| 220 / T0847 | M · S | keeps a status sentence below a settings title even at ordinary text size |
| 229 / T0848 | M · S | on a row that only tells the value is one stop with the title, after it |
| 235 / T0849 | M · S | expanded={false} draws the caret DOWN and says "not expanded"; expanded draws it UP and says "expanded" |
| 245 / T0850 | M · S | is still a button that gives on the row rung and ticks, and presses through |
| 253 / T0851 | M · S | a row without `expanded` is exactly the row it was: the arrow to the right and no expanded state at all |
| 260 / T0852 | M · Z | only a touched row can be expanded: on a row that only tells it is ignored, with no caret and no state |
| 267 / T0853 | M · Z | `arrow={false}` still takes the caret away from an expanded row, and a disabled one is greyed and says it |
| 277 / T0854 | M · Z | a disabled destructive control is muted and cannot look enabled after replacing its illustration |
| 286 / T0855 | M · S | `danger` writes the words in red |
| 291 / T0856 | M · S | `danger` turns a FactArt picture red with its words, and `quiet` turns it quiet; a face is left as it was given |
| 302 / T0857 | M · Z | disabled (the screen is working) greys the words and the picture, cannot be pressed and ticks nothing |

### src/ui/system/__tests__/offline-line.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 30 / T0858 | M · S | says the screen shows the last thing that was loaded, and offers the one word that reads again |
| 38 / T0859 | M · S | says only "Nema veze." when there is nothing yet to show |
| 43 / T0860 | M · S | only tells, with no word to press, when the screen cannot read again |
| 51 / T0861 | M · S | is a note: a flat tint, not a card and not a shadow, and not the state view |
| 58 / T0862 | M · Z | is as high as a touch and no higher: the sentence centres in the 48 dp that the word is |
| 67 / T0863 | M · S | asks for balanced lines, so a sentence of two lines is not a long one and a lonely word |
| 72 / T0864 | M · Z | is announced as an alert, once, when it appears |
| 78 / T0865 | M · S | writes the word in green, 15/600, and in grey while it reads |
| 89 / T0866 | M · S | puts the word under the sentence instead of crushing it |

### src/ui/system/__tests__/one-token-source.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 59 / T0867 | P · Z | %s spells no colour of its own (no raw #RRGGBB, no white or black by name) |
| 65 / T0868 | P · Z | %s reads tokens only from sys |
| 72 / T0869 | P · Z | %s reads reduced motion from the one store |
| 77 / T0870 | M · S | the one store never imports Reanimated, so every screen suite can load it |
| 81 / T0871 | P · F | the motion scale is the agreed one, and it lives in sys only |
| 96 / T0872 | P · F | the motion tiers of the UI/UX pass exist, with the agreed values |
| 118 / T0873 | P · F | the five motion tokens that nothing read are gone |
| 122 / T0874 | M · S | the one sheet spring lives in sys, and ProductSheet only re-exports it |
| 135 / T0875 | P · Z | every named colour in sys is a real colour value, named by its whole path (sys.color.* and sys.art.* are different groups) |
| 145 / T0876 | P · F | the corner scale is 12 / 24 / 28 / pill, and a control and the primary action share one corner |
| 158 / T0877 | M · S | no file under src still spells the checkbox corner as a nested control corner |
| 180 / T0878 | M · F | the list sheet and the PeekSheet take their lift from sheetLift and spell no shadow colour |
| 191 / T0879 | M · S | the FULL lift exemption cannot admit raw shadows, nonzero elevation, another token or detached sheets |
| 209 / T0880 | P · F | %s is a hairline card with no shadow |
| 215 / T0881 | P · Z | the second motion scale is gone with the v2 token file, and no tone reads below AA on green |
| 235 / T0882 | P · Z | keeps fact tones separate from Home illustration colors |
| 241 / T0883 | P · F | is four tones with the four parts a picture needs, all real colours |
| 249 / T0884 | P · F | the default tone IS the UI green, so an icon, a title and the primary action agree (no second emerald) |
| 256 / T0885 | P · F | every tone has depth (edge darker than front) and a front that stays readable on white |
| 273 / T0886 | P · S | is large from text scale 1.3, narrow under 340 dp, and the designed compact layout otherwise |
| 283 / T0887 | P · S | reads Android's 1.2999999523 as the 1.3 step it is, and large wins when both reasons apply |
| 289 / T0888 | P · S | never stacks for a value that is not a measurement, and hands back one shared answer per class |
| 296 / T0889 | P · S | follows the window of the device it renders on |
| 314 / T0890 | P · S | hands the room itself to that rule: the width in dp and the text scale rounded to hundredths, one object while they hold |
| 396 / T0891 | P · S | finds each way of reading the width, aliased imports included, and nothing else |
| 414 / T0892 | P · S | only the listed files read it, every listed file still does, and the list names real files |
| 422 / T0893 | P · S | the hook is where the width is read |
| 428 / T0894 | P · S | the ratchet is an equality: a stale entry fails, and so does a raised one |
| 490 / T0895 | P · S | finds each literal form, in any expression, and lets a named token and a zero through |
| 505 / T0896 | P · S | a file outside the list spells none, and a file on it spells exactly its entry: it can only shrink, and shrinks with the code |
| 512 / T0897 | P · S | tokens.ts is where the values are written |

### src/ui/system/__tests__/outcome-copy.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 24 / T0898 | M · S | every title is one line without a full stop, and every sentence ends with one |
| 32 / T0899 | M · S | uses none of the words the revision forbids, and no "ti" that is a "Vi" |
| 37 / T0900 | M · S | the buttons are three words and each is one verb of the app's own vocabulary: Pokušaj ponovo, Proveri, Osveži |
| 45 / T0901 | M · Z | a screen reader's name for the check button carries the word that is written on it |
| 51 / T0902 | M · Z | failed says nothing was saved; unknown says it does not know, and why; neither promises what it cannot know |
| 60 / T0903 | M · S | a lost connection is told apart from a service that is down, and the second says it is not the person's phone |
| 67 / T0904 | M · S | a read that did not arrive names the thing the screen passes in, already in the accusative |
| 72 / T0905 | M · S | the strip under the bar is a line, not a screen: with the last thing loaded, or bare |
| 79 / T0906 | M · S | %s: the sentence and the title say something else than the button |
| 84 / T0907 | M · S | %s follows the rules of a state when it is drawn as one |
| 91 / T0908 | M · S | each says "Ne znamo da li je/su ..." with the verb in the form its noun needs, and stands for itself with a picture of the app |
| 98 / T0909 | M · S | keeps the vocabulary: "zadatak" in lower case, "Dogovor" in capitals, "prijava" for what is sent to a task, "problem" for what is reported |
| 106 / T0910 | M · S | has no two subjects with the same title |

### src/ui/system/__tests__/outcome-uncertain.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 32 / T0911 | M · Z | says what is not known, why, and offers "Proveri": the generic words when it is not told what the person did |
| 44 / T0912 | M · S | about "%s": the title and the picture of the thing the person did |
| 49 / T0913 | M · S | lets the flow say it better: its own title and sentence replace the table's, and nothing else changes |
| 56 / T0914 | M · S | shows the one quiet way out when it is given one, and never a second way to send the same thing |
| 65 / T0915 | M · Z | while it checks, the one button keeps its colour and shows its spinner and cannot be pressed twice; the words do not move |
| 72 / T0916 | M · S | is announced as an alert, grey, like every failure, and inside a section it is the compact state |
| 78 / T0917 | M · S | follows the rules of a state, with the words of the table and with every subject |
| 86 / T0918 | M · F | is a note in the warning tint with the title, and the secondary button: a screen has ONE green action, and in this flow it is the foot's |
| 92 / T0919 | M · S | does not draw the state view: it draws the title in the strong type as an alert, then the button |
| 102 / T0920 | M · S | asks for balanced lines for its title and its sentence |
| 107 / T0921 | M · S | draws a sentence only when the flow gives one: the title is already the honest sentence |
| 115 / T0922 | M · S | presses through, shows the spinner while it checks, and offers the one quiet way out |
| 126 / T0923 | M · Z | says its words once to a screen reader, and keeps the 8 dp between the words and the button the foot keeps under its reason |
| 135 / T0924 | M · Z | hears "Proveravamo…" once when the check starts, and nothing when the state is first drawn or when it stops |
| 146 / T0925 | M · S | says it for the note as well, and the name of the button carries the word that is written on it |

### src/ui/system/__tests__/pecat.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 38 / T0926 | M · Z | is spoken as its word, once, and draws that word in the label type |
| 46 / T0927 | M · S | takes the ground and the word of the chip's tone, and the neutral one by default |
| 54 / T0928 | M · S | is tilted by -4 degrees, like a stamp on a receipt |
| 59 / T0929 | M · S | draws a dot for green and a ring for neutral, as the state table does, and the shape it is asked for |
| 71 / T0930 | M · S | is 140 ms, shorter than a switch, on the native driver and on easeOut |
| 82 / T0931 | M · S | starts after the delay it was given |
| 88 / T0932 | M · Z | ticks lightly once when it lands, and not before, and not when the fall was stopped |
| 98 / T0933 | M · Z | makes the tick it is asked for as it lands: success where the stamp is the outcome the server confirmed, also under reduced motion |
| 109 / T0934 | M · Z | is simply there under reduced motion, and the tick stays (a tick is not movement) |
| 117 / T0935 | M · S | is still when nothing just happened: no fall and no tick |
| 124 / T0936 | M · S | falls only on opacity and transform: the values it drives are one progress, never a size or a position |

### src/ui/system/__tests__/peek-overflow.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 49 / T0937 | M · S | the pin body can scroll within its existing cap while close stays outside it: fontScale=%s |
| 73 / T0938 | M · Z | a place keeps its bounded rows and whole-list action scrollable with a persistent close |
| 85 / T0939 | M · Z | scrollable cards preserve reduced motion and the native swipe completion path: reduced=%s |
| 93 / T0940 | M · Z | Back dismisses the focused card once and does not remain registered while its screen is away |
| 102 / T0941 | M · S | generic Peek callers keep the existing static body by default |
| 109 / T0942 | M · S | changing pins keeps one native sheet, resets the content scroll, and retires old dismiss callbacks |
| 122 / T0943 | M · S | an old native closing completion cannot dismiss the next pin, even after it reopens |

### src/ui/system/__tests__/pictogram.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 22 / T0944 | M · S | draws every kind in the catalog, each with its own gradient |
| 29 / T0945 | M · S | covers the four groups the directive names, with a label for each |
| 38 / T0946 | M · Z | a disabled pictogram is drawn in the muted tone only |
| 51 / T0947 | M · S | says its label and whether it is chosen, and chooses on press |
| 61 / T0948 | M · S | a single-answer tile is a radio |
| 67 / T0949 | M · Z | a disabled tile says why and cannot be chosen |
| 87 / T0950 | M · S | a medium tile keeps its role, label and state, and sits in two columns on a 390 dp phone |
| 96 / T0951 | M · S | turns every tile into a row at %s |
| 103 / T0952 | M · S | a tile outside a grid keeps the large look it always had |

### src/ui/system/__tests__/pill-composer.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 24 / T0953 | M · S | a note above the pill lands on the page gutter while the capsule keeps the area inset |
| 33 / T0954 | M · S | an empty fragment above the pill adds no element, so the capsule sits where it did |
| 40 / T0955 | M · S | a grey send says why through its hint and a danger note is an alert |

### src/ui/system/__tests__/plural-has-one-spelling.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 43 / T0956 | M · S | looks at a real tree, so an empty sweep cannot pass for a clean one |
| 48 / T0957 | M · S | computes it in exactly one file |
| 57 / T0958 | M · S | and that one file is still right about every shape |

### src/ui/system/__tests__/plural.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 9 / T0959 | M · S | %i |
| 17 / T0960 | M · S | takes the three words from the caller, because only the caller knows them |
| 29 / T0961 | M · S | agrees the verb with the count as well as the noun |
| 36 / T0962 | M · S | says the total is for %i in the accusative |

### src/ui/system/__tests__/poruka.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 44 / T0963 | M · S | draws nothing while there is no message, and draws it the moment one is shown |
| 54 / T0964 | M · S | is a white capsule on the lift of a sheet, black 15 px words, 16 dp in from both edges and 16 above what it must clear |
| 72 / T0965 | M · F | carries one green text button at most, a full 44 to touch, and no button when there is no action |
| 85 / T0966 | M · Z | runs its action once, after taking the message away, so an action that shows a message of its own keeps it |
| 96 / T0967 | M · S | shows nothing for an empty text, and hides only the message it was asked about |
| 110 / T0968 | M · S | a new message replaces the one on show, and the old one's time never takes the new one away |
| 125 / T0969 | M · F | stays 4 s, or 6 s when it carries an action, and then leaves over 160 ms |
| 147 / T0970 | M · S | a message that arrives while the last one is leaving takes its place, and the leaving does not take it away |
| 160 / T0971 | M · Z | reads each message out to a screen reader once when it appears, and not again when the screen draws again |
| 173 / T0972 | M · Z | ticks a success only when the caller says the server confirmed it |
| 192 / T0973 | M · S | takes a message away by itself after its time even when no host is mounted, so it never turns up minutes later |
| 210 / T0974 | M · Z | is safe to mount more than one host (a screen above the navigator mounts its own): it is read out and ticked once, and each draws it |
| 237 / T0975 | M · F | rises 8 dp and fades in over 240 ms and leaves over 160 ms, on the native driver and the decelerating curve |
| 258 / T0976 | M · Z | only appears and disappears under reduced motion: no timing, no animated style, gone at once |

### src/ui/system/__tests__/public-profile-sheet.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 64 / T0977 | M · S | draws nothing without a state, a skeleton while loading, and a way to try again when the read failed |
| 76 / T0978 | M · S | is titled with the person's name, and says when there is none |
| 83 / T0979 | M · S | shows the portrait, the headline and the city only when they are there |
| 92 / T0980 | M · S | stands the face, the headline and the city in one centred column, the face at 72 inside its sticker edge |
| 103 / T0981 | M · Z | are the rating, finished and reliability, in one row, the rating first |
| 111 / T0982 | M · Z | says the rating the Serbian way with the count under it: "4,8" and "12 ocena", with the star |
| 121 / T0983 | M · S | writes %s as "%s" |
| 125 / T0984 | M · S | counts %s the Serbian way: "%s" |
| 130 / T0985 | M · Z | says "Još nema" and "ocena" when there are no reviews, without a number and without the star that stands for a rating |
| 137 / T0986 | M · Z | draws no rating when the server does not know it, and never shows a number it was not given |
| 144 / T0987 | M · Z | shows a rating alone when only the rating is known, never a made-up count |
| 149 / T0988 | M · S | says finished %s the Serbian way: "%s %s", zero too, as zero |
| 157 / T0989 | M · S | replaces "Završeno N zadataka" and never names a side of the task |
| 165 / T0990 | M · Z | appears only when the server offers it AND it is true |
| 177 / T0991 | M · S | is there only when the person wrote one, exactly as they wrote it, and is not clamped |
| 188 / T0992 | M · S | has no heading and no text when there is nothing written (%j) |
| 196 / T0993 | M · S | is the last thing on the sheet and the only control in it, and says what it does |
| 217 / T0994 | M · Z | keeps its busy and error states, and is absent when the screen offers no way to report |
| 230 / T0995 | M · Z | is not drawn without a trust read: the sheet is what it was, two figures and no confirmation |
| 236 / T0996 | M · S | draws NOTHING for %s: no figure, no row, no placeholder, no word about what is hidden |
| 243 / T0997 | M · Z | adds the reliability as the third figure, and the agreed tasks and the month as confirmations, when the server lets this viewer have them |
| 251 / T0998 | M · S | says in words that there is no percentage yet, as a statement about the person, and never draws "0%" or "100%" |
| 258 / T0999 | M · Z | leaves out a part the server did not return, and a month it cannot read |
| 266 / T1000 | M · Z | shows the person themself what the server returns for them, in the same places |
| 271 / T1001 | M · Z | puts the identity first among the confirmations, then the agreed tasks, then the month |
| 276 / T1002 | M · S | promises nothing about who sees what, and never names a side of the task |
| 281 / T1003 | M · S | writes "Na USKOČI-ju od" with the Serbian month, and nothing for a date it cannot read |
| 290 / T1004 | M · Z | keeps the confirmations as full-width rows that wrap, and the safety entry a touch of 48 dp, at width %s and scale %s |
| 307 / T1005 | M · S | keeps every text at 12 px or more |

### src/ui/system/__tests__/push-transition.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 63 / T1006 | M · F | shifts in, over exactly `sys.motion.push`, which is 240 ms: as long as something arriving, never longer |
| 75 / T1007 | M · S | is passed `easeOut` explicitly: the curve of `sys.motion.easeOut`, not the library's own ease-in-out that a missing easing falls back to |
| 89 / T1008 | M · S | is ONE transition for every pushed screen: the same spec, not thirty spellings of it |
| 96 / T1009 | M · S | leaves the three roots instant (a tab is not a place you went to) and the redirects still |
| 106 / T1010 | M · Z | moves nothing under reduced motion: every pushed screen is `none` with no spec at all (R7) |

### src/ui/system/__tests__/rule-width-ratchet.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 60 / T1011 | M · Z | counts each way of spelling them, once each |
| 66 / T1012 | M · S | does not count a comment, a full border or another word |
| 75 / T1013 | M · S | prints the table as it stands today (RATCHET_PRINT) |
| 87 / T1014 | M · S | looks at a real tree, so an empty sweep cannot pass for a clean one |
| 92 / T1015 | P · F | no file spells more than its entry, and none spells fewer: it can only shrink, and shrinks with the code |
| 97 / T1016 | M · S | every entry names a real file and a real family, with a count above zero |
| 105 / T1017 | P · F | the grid draws none: layout.ts and the six primitives spell neither, and Segmented has given up the hairline |

### src/ui/system/__tests__/screen-chrome.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 55 / T1018 | M · S | keeps shared padding, with a 56 px profile target and unchanged 48 px detail/flow controls |
| 72 / T1019 | M · S | has the edge of the grid: `layout.gutter`, which is the edge of every screen, for each of the three bars |
| 83 / T1020 | M · S | draws DetailTopBar, ProductHeader and the Settings screens with the same bar and the same title |
| 99 / T1021 | M · Z | keeps the mark in flow, then the screen action, bell and own profile; the section remains spoken |
| 108 / T1022 | M · S | speaks a header toggle as selected or not, and shows it by weight and colour together |
| 121 / T1023 | M · Z | places the larger own profile last and preserves its navigation callback |
| 134 / T1024 | M · S | keeps a data-free profile fallback when a presentation has no injected identity |
| 144 / T1025 | M · S | keeps a data-free profile glyph for direct ScreenChrome galleries |
| 154 / T1026 | M · Z | is a 44 px white circle with the hairline inside an exact 48 px touch area, with a 24 px regular glyph in ink |
| 167 / T1027 | M · Z | draws a disabled control with a muted glyph and never fades it |
| 176 / T1028 | M · S | has a quiet form without the circle, for a control that ends a row of its own content |
| 184 / T1029 | M · S | draws the semantic bell without a chrome circle; the real unread count keeps its orange badge |
| 209 / T1030 | M · Z | keeps the back label and the disabled state, draws the title as a header and holds one right control |
| 220 / T1031 | M · S | lets a task screen leave the title to its content and still say its state under the arrow |
| 227 / T1032 | M · S | puts a face before the name when the bar is about a person |
| 237 / T1033 | M · F | is hidden from the eye and from a screen reader until the content title has scrolled away, then fades in over 180 ms |
| 253 / T1034 | M · S | takes no height, hidden or shown, so the bar keeps one height at every text size |
| 278 / T1035 | M · Z | is simply there under reduced motion |
| 287 / T1036 | M · S | turns on and off only when the content title crosses the line |
| 301 / T1037 | M · S | has the close X and says where you are in the flow |
| 319 / T1038 | M · Z | draws the named glyph at 24, regular, in ink inside the same circle and the same 48 px touch area as a Phosphor icon |
| 328 / T1039 | M · S | shows a toggle by weight and colour together, and speaks it as selected |
| 335 / T1040 | M · Z | draws a disabled glyph muted and an explicit action green, exactly as a Phosphor icon is |
| 342 / T1041 | M · S | draws the arrow back, the close X and the profile from the registry, not from Phosphor imports of its own |
| 352 / T1042 | M · S | is handed through the header toggle too, so a later wave can say glyph="search" there |
| 363 / T1043 | M · Z | is a 44 px pill with the glyph at 20 and the word in the meta variant, inside a 48 px touch height |
| 381 / T1044 | M · S | keeps the large-text cap of the chrome title, so the pill cannot crush a tab row |
| 386 / T1045 | M · Z | is spoken by its label only: the caption is not a second name |
| 392 / T1046 | M · Z | wears the word in the glyph's colour: ink, green when on, muted when disabled; and fills the glyph when on |
| 406 / T1047 | M · S | works on a Phosphor icon as well, and the quiet form drops the circle but keeps the word |
| 413 / T1048 | M · Z | is handed through the header toggle as well: the same pill, spoken as selected when on |
| 427 / T1049 | M · Z | is not drawn without a caption: a bare control keeps its 48 by 48 touch area and has no word |
| 435 / T1050 | M · S | ticks nothing for the arrow back and the close X |
| 446 / T1051 | M · S | is silent by default for the glyph names back and close wherever they are drawn, and ticks for every other name |
| 457 / T1052 | M · S | lets a caller ask for a tick on a close that IS an outcome, and never guesses from a Phosphor component |
| 465 / T1053 | M · Z | keeps the selection tick for the controls that are not navigation back, and ticks nothing when disabled |
| 474 / T1054 | M · Z | lets a caller choose, and a disabled control still ticks nothing |

### src/ui/system/__tests__/screen.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 31 / T1055 | M · S | a tab has the tab bar under it, so it keeps clear of the top and the sides only |
| 36 / T1056 | M · S | a %s is the last thing before the system's bottom, so it keeps clear of every edge |
| 41 / T1057 | M · S | is white and fills the room, and carries the test id |
| 49 / T1058 | M · S | has the edge 20, the first thing 8 below the bar, the blocks 24 apart and 32 under the last thing |
| 55 / T1059 | M · S | is 24 under the last thing when a foot stands under it |
| 60 / T1060 | M · S | is a column of at most 640, centred, so on a tablet it does not run across the screen |
| 66 / T1061 | M · S | takes the caller's own style last, for the rare exception |
| 71 / T1062 | M · S | draws no card and no line: nothing it draws has a border, a shadow or a divider |
| 83 / T1063 | M · S | puts the bar above the scroll and the foot below it, inside the same frame |
| 88 / T1064 | M · S | draws what is handed in and nothing in its place: no bar, no foot when there are none |
| 93 / T1065 | M · S | keeps the foot to the same 640 column as the content |
| 99 / T1066 | M · Z | hands the scroll position to the bar through onScroll, at 16 ms, so the title can appear once the large one has gone |
| 107 / T1067 | M · S | hands the refresh control through, and keeps taps working while a field is focused |
| 116 / T1068 | M · S | scrolls by default |
| 121 / T1069 | M · S | is a plain column that fills the room with `scroll={false}`, with the same measure |
| 131 / T1070 | M · Z | lifts a flow, so its foot rises with the keyboard, and nothing else by default |
| 140 / T1071 | M · S | can be told either way, whatever the kind |
| 147 / T1072 | M · Z | keeps the foot inside the keyboard avoidance and under the scroll, so it rises with the field it belongs to |

### src/ui/system/__tests__/section.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 35 / T1073 | M · Z | is the heading type in ink and is spoken as a heading, and wraps rather than being cut |
| 43 / T1074 | M · S | is 12 dp above what the section holds, which comes after it in the order given |
| 50 / T1075 | M · S | is optional: a section without one draws no header and no line of its own, only what it holds |
| 60 / T1076 | M · F | has no border, no shadow and no outer margin (the one pull a 48 dp action needs is pinned with the action, below) |
| 68 / T1077 | M · S | is a plain column: it is not given the card, the edge or the gap that the screen gives |
| 77 / T1078 | M · S | is a button with the word as its name, which runs the caller's command and ticks a selection |
| 86 / T1079 | M · Z | takes the caller's spoken name and test id, so "Ceo raspored" can say more |
| 92 / T1080 | M · S | is written 15/600 in green |
| 98 / T1081 | M · Z | is a touch of 48 dp, and the line it stands in is 48 high: the title is centred in it |
| 105 / T1082 | M · S | keeps the title where it would be without an action: the section is pulled up 12 into the screen's gap, and 12 is under the title already |
| 113 / T1083 | M · S | can stand alone, without a title, at the end of its line |
| 121 / T1084 | M · S | stacks the title and the action and starts both at the same edge |

### src/ui/system/__tests__/segmented-modes.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 40 / T1085 | M · S | %i options: one track, no scroller, every tab the same share and 48 dp high, and a track of 56 |
| 51 / T1086 | M · S | keeps accepting contentSized and scroll, and ignores them: equal shares, no scroller, no intrinsic widths |
| 60 / T1087 | M · S | still lets the give of a tab wait out the press delay when the caller said `scroll`, as a row in a scrolling list does |
| 67 / T1088 | M · S | wraps a word that does not fit instead of cutting it: no line limit, and the tab may hold two lines |
| 75 / T1089 | M · Z | is a tab for a screen reader, says which is chosen, and gives on the button rung with a tick for the one that is not |
| 86 / T1090 | M · S | paints the chosen tab before it is measured, then moves one white pill to it |
| 98 / T1091 | M · S | draws 4 and 5 options as chips in a horizontal scroller, not in a track |
| 109 / T1092 | M · S | is the boundary: three options are a track, four are chips |
| 116 / T1093 | M · S | chips with `scroll` or `contentSized` are the same chips: the flags change nothing |
| 122 / T1094 | M · S | draws a chip 48 dp high with a 1 dp edge and room for its word: nothing is cut, 8 apart |
| 131 / T1095 | M · S | marks the chosen chip with a quiet well and an ink edge and a bold ink word, and there is no sliding pill |
| 140 / T1096 | M · S | waits out the press delay and has no extra reach (the chips are 8 apart), because a finger on a chip may be a scroll |
| 145 / T1097 | M · S | commits on a press of a chip that is not chosen, and ticks only then |
| 153 / T1098 | M · S | runs out to the screen's edges by default (the gutter), so a chip scrolls under the edge and not under a strip of white |
| 163 / T1099 | M · S | puts the caller's style on the scroller |
| 170 / T1100 | M · Z | opt-in equal underlines keep %i long labels within their allocated width and preserve selection |
| 183 / T1101 | M · S | keeps the underline tabs in a track for five options too: it is not the chips |
| 190 / T1102 | M · S | with `scroll` it is still a scroller (the underline has its own scrolling row), with the delay |
| 200 / T1103 | M · S | draws the number of an attention tab, in the orange of what waits, and none for a quiet count |
| 211 / T1104 | M · Z | still SAYS a count the caller named, so a screen reader hears what the eye is not given, and retires one that went away |
| 221 / T1105 | M · S | draws it in the chips as well, and nowhere a quiet count was drawn before |
| 228 / T1106 | M · S | draws a number given as a word too, and nothing for an attention tab with no number |
| 238 / T1107 | M · Z | draws each tab at the width of its word, 16 on each side, and lets the track give way before it pushes its neighbour out of the row |
| 247 / T1108 | M · S | keeps a tab 48 dp high, a word that does not fit going to a second line, and the tab semantics of the set it is |
| 256 / T1109 | M · S | is nothing the set had before: without it the tabs are equal shares of the width they are given, as always |
| 268 / T1110 | M · S | changes nothing for chips (four or more options already are the width of their words) and nothing for the underline strip |
| 278 / T1111 | M · S | takes the caller's own style after its own, so a column can put it at the left |

### src/ui/system/__tests__/segmented.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 29 / T1112 | M · Z | an unavailable channel has no selection action or haptic and announces why it cannot be pressed |
| 39 / T1113 | M · S | paints selection before measurement, then moves one native underline while tab semantics change immediately |
| 67 / T1114 | M · S | remeasures label/count width and the following tab position instead of assuming equal segments |
| 81 / T1115 | M · Z | explicitly retires a previously spoken count when its badge disappears |
| 90 / T1116 | M · Z | reduced motion places the underline at the measured target and updated width without starting a transition |
| 107 / T1117 | M · S | contentSized is accepted and ignored: equal shares, 48 high, and the pill moves to the measured tab |
| 124 / T1118 | M · S | a scrolling underline belongs to the measured content row, while the fixed pill keeps its first-frame fallback |

### src/ui/system/__tests__/sheet-stable-inset.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 32 / T1119 | M · S | draws no SafeAreaView inside a sheet and pads its pinned actions by the window inset |
| 39 / T1120 | M · S | a sheet without pinned actions keeps the inset under its own content |
| 45 / T1121 | M · S | a re-measure within one pixel does not size the sheet again |

### src/ui/system/__tests__/sheets.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 59 / T1122 | M · Z | asks with a title, one sentence, one confirm and one quiet cancel |
| 74 / T1123 | M · Z | draws a destructive confirm in the danger colour, at the primary's measure |
| 82 / T1124 | M · S | says what a tap outside does to the question, and is not visited while the command it started runs |
| 93 / T1125 | M · Z | keeps one footer component, so the pressed confirm turns busy in place instead of being mounted again |
| 107 / T1126 | M · Z | runs a confirm once, however often it is pressed, then closes without cancelling |
| 115 / T1127 | M · Z | stays busy and cannot be left while the command it started runs, and reports nothing itself |
| 134 / T1128 | M · Z | lets Back and a tap outside close the window once the command runs long, without cancelling or repeating it |
| 156 / T1129 | M · S | closes after a command that fails, leaving the failure to the screen that owns it |
| 164 / T1130 | M · Z | cancel runs the cancel path once, and a confirm pressed after it does nothing |
| 172 / T1131 | M · Z | %s is a cancel |
| 187 / T1132 | M · Z | a notice has one button and nothing to cancel |
| 196 / T1133 | M · Z | never moves when the phone asks for less motion |
| 206 / T1134 | M · Z | shows what was asked, retires it silently through the cancel path, and asks again |
| 221 / T1135 | M · Z | a new question replaces an open one, and the old one ends as a cancel |
| 230 / T1136 | M · S | a slow command's window closed by Back is gone, and the command settles on its own afterwards |
| 245 / T1137 | M · S | pins its actions under the content, and the content makes room for them |
| 258 / T1138 | M · S | keeps the same footer component across renders and updates its actions in place |
| 272 / T1139 | M · S | says in Serbian what a tap outside really does, and is not visited where a tap does nothing |
| 298 / T1140 | M · S | keeps the title and its × on one row inside the sticky heading, not on the sticky element itself |
| 314 / T1141 | M · S | names a sheet without a visible title, and draws no heading for it |
| 320 / T1142 | M · Z | closes on Back and on its ×, each once |
| 335 / T1143 | M · S | asks before throwing unsaved input away, and the caller's own commit never asks |
| 360 / T1144 | M · S | commits without the question |
| 368 / T1145 | M · S | cannot be left while it is not dismissible |
| 376 / T1146 | M · Z | settles on a critically damped spring, and on nothing at all under reduced motion |
| 397 / T1147 | M · Z | is asked for over 170 ms on the decelerating curve, whichever command closes it, and the spring stays what it opens on |
| 414 / T1148 | M · Z | is at once under reduced motion, the system's or the caller's |
| 429 / T1149 | M · S | draws its × as the one close glyph, 24 in a 48 hit area |
| 445 / T1150 | M · S | puts a destructive action last and draws it in the danger colour |
| 456 / T1151 | M · Z | names the menu where a screen reader reads it, and says what a tap outside does |
| 469 / T1152 | M · S | draws each picture in its own well token, not in the icon button's |
| 476 / T1153 | M · Z | runs the chosen action once, after the sheet has gone |
| 486 / T1154 | M · Z | draws a subtitle as one quiet line under the label, and a screen reader hears it, before the row's own hint |
| 508 / T1155 | M · S | does nothing for an action that is not available |
| 517 / T1156 | M · S | draws a row that cannot be used on the grey wash in muted ink, never faded, and says why in the line a subtitle would take |
| 557 / T1157 | M · Z | peeks over the screen without a backdrop, a modal or a focus trap, detached above the tab bar |
| 574 / T1158 | M · Z | closes on Android Back before the screen under it does, and lets Back go once it is on its way out |
| 589 / T1159 | M · S | takes Back only while its own screen is in front |
| 603 / T1160 | M · Z | appears without motion under reduced motion |
| 610 / T1161 | M · Z | closes on the sheets' own short timing when a command closes it, and at once under reduced motion |
| 627 / T1162 | M · S | floats 16 dp in from both edges, and a card with its own × can leave the grab bar out and keep its top padding |

### src/ui/system/__tests__/skeleton.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 75 / T1163 | P · F | is 68 dp with a picture and two lines, the same as the real row: 12 over and under, 12 between, a 40 slot, a title line and a note line |
| 84 / T1164 | P · F | is 64 dp with a picture and one line (the row's least), as the real row is |
| 92 / T1165 | P · F | is 80 dp with a face and two lines: the 56 slot decides, as it does in the real row |
| 100 / T1166 | P · F | draws the slot 40 wide with the 32 picture in it, and the inset rule from 52 to the right edge, 1 dp, under every row but the last |
| 113 / T1167 | P · F | starts its rule at 68 with a face, and has no slot and the pill of a switch at the end in a settings list |
| 122 / T1168 | P · F | is 56 dp for a settings row with one line and 64 with two, the real row's two heights |
| 129 / T1169 | P · F | puts a section title's bar over the rows when asked: a line of the heading type, 12 above what it holds |
| 135 / T1170 | M · S | follows the text size: the line boxes grow with the type, so the row does not jump when its words come at 1.3 |
| 143 / T1171 | P · F | is the height of its picture for one line, as the real fact is, and stands 8 from the next |
| 156 / T1172 | P · F | draws the picture at the side the real fact draws it, and a line whose first line is centred on it |
| 164 / T1173 | P · F | stands in the frame of a Surface record: the same white card, 24 corners, 16 padding, the same edge and shadow |
| 175 / T1174 | P · F | is the least a task card is with the person and two facts (about 200 dp), and 52 less without the person |
| 187 / T1175 | P · F | keeps 12 between the parts of the face and 4 inside a part, as the face does, and stands 12 from the next record |
| 196 / T1176 | P · F | draws the person at the foot only when asked, 40 with two lines; `rows` is the number of facts |
| 215 / T1177 | P · F | draws three facts (the amount first, then two), the person's 40 picture, and the count of people at the end of the person's line |
| 225 / T1178 | P · F | is as tall as the least the real card is: a title of one line, the amount, where, when, and the person; and 4 between the facts, 12 between the parts |
| 233 / T1179 | M · S | matches a multi-person task when its extra capacity fact is included |
| 241 / T1180 | P · F | takes `rows` more facts after the amount, and stands 12 from the next card |
| 248 / T1181 | M · S | grows with the text size as the real card does: the lines are taller, a fact is the taller of its picture and its line, the person the taller of 40 and its two lines |
| 260 / T1182 | M · S | grows with the text size: at 1.3 the card is as tall as the real one, which is taller by the lines it holds |
| 274 / T1183 | M · Z | runs one loop for the list, however many placeholders it holds, and none at all under reduced motion |
| 284 / T1184 | M · Z | is hidden from a screen reader (the sentence under it says it all), unless the caller gives it the one name it has |
| 292 / T1185 | M · S | draws nothing that spins and nothing that can be pressed |
| 300 / T1186 | M · S | is `row` by default under the name `Skeleton`, three of them, with the placeholders of every other variant still reachable by name |
| 308 / T1187 | P · F | keeps the gap of every shape: rows touch (their rule parts them), records 12 apart, facts 8, the older cards 12 |

### src/ui/system/__tests__/state-gallery-large.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 37 / T1188 | M · S | draws the strip of "no connection" with its word beside its sentence at ordinary text, and under it with `&veliki=1` |
| 45 / T1189 | M · S | does the same for a scene that is not a state scene: `?scene=redovi&veliki=1` stacks a section's action under its title |
| 54 / T1190 | M · S | takes an address parameter that the router hands over as a list as its first word |

### src/ui/system/__tests__/state-rules.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 12 / T1191 | M · S | a first-time empty list with its sentence and its one action follows the rules |
| 17 / T1192 | M · S | a headline with nothing under it has no sentence |
| 22 / T1193 | M · Z | an error, a lost connection and an unknown outcome each need the one button; an empty list needs a way in unless everything is done |
| 33 / T1194 | M · S | a wait offers nothing to press: nothing can be done while it reads, and its title is its one sentence |
| 40 / T1195 | M · Z | finds a verb repeated as a whole phrase, whatever the case, the diacritics or the punctuation |
| 51 / T1196 | M · S | flags the old way of writing an error: "... pokušaj ponovo." over a button "Pokušaj ponovo" |
| 57 / T1197 | M · S | flags the same words on the green action and the quiet one |
| 64 / T1198 | M · S | the first time speaks to a person who has none: "Još nemaš ...", and never about a view |
| 69 / T1199 | M · S | a filter speaks about the view, and its green action takes the narrowing away; it never says "Još nemaš ..." |
| 78 / T1200 | M · S | reports every problem there is, in the order of the rules |
| 84 / T1201 | M · S | lower-cases, drops the diacritics and the punctuation, and keeps đ readable |
| 94 / T1202 | M · S | names the three causes of an empty list and the checks that hold them |
| 102 / T1203 | M · F | says the four rules every state follows: a sentence, one way forward, one green action, and never the button's verb again |
| 113 / T1204 | M · S | lets the first time of an empty screen be a hero, and says nothing of a state that is not one |
| 119 / T1205 | M · S | flags a hero that is a filter, a "done", or a failure: those keep the quiet 96 |

### src/ui/system/__tests__/state-view-bare-fact-art.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 22 / T1206 | M · S | %s: a failure that names a picture with a tick falls back to the quiet sign, and one that names another keeps it |
| 29 / T1207 | M · S | an empty list and a loading state draw as they do with the real art |
| 36 / T1208 | M · S | reads nothing of FactArt but the picture: its source imports no other name from it |

### src/ui/system/__tests__/state-view.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 51 / T1209 | M · S | says an empty list with its picture, a heading, one sentence and the one way forward |
| 71 / T1210 | P · F | is one centred column, no wider than 280, with the title in the title type and the sentence in the copy type, both centred |
| 80 / T1211 | P · F | draws the picture at 96 with nothing around it: no well, no panel, no card |
| 90 / T1212 | P · F | lies a third of the way down: a fifth of the free room above the block and four fifths below, and never closer than 48 to what is above |
| 98 / T1213 | M · S | puts its actions in the column, as wide as the column, the green one in the footer's own shape and the quiet one under it |
| 109 / T1214 | P · F | keeps the steps of the grid between its parts: 16 after the picture, 8 after the title, 24 before the actions |
| 117 / T1215 | M · S | draws no action when the screen offers none, and no sentence when it has none |
| 125 / T1216 | M · Z | an empty list's picture settles in once; a failure's does not |
| 134 / T1217 | M · S | an empty conversation list draws the conversation picture at the same 96 |
| 140 / T1218 | M · S | announces a read that failed as an alert, with the picture gone grey |
| 150 / T1219 | M · Z | never draws a failure with a picture that says "confirmed": a tick (agreements, check, shield) falls back to the quiet sign, an empty list keeps its own |
| 163 / T1220 | M · S | asks the platform for balanced lines, so a centred title is not a long line and a lonely word |
| 169 / T1221 | M · S | says "no connection" the same way, with its own quiet picture when the screen names none |
| 175 / T1222 | M · S | says "we do not know whether it arrived" as an alert as well, grey, with the one button that finds out |
| 190 / T1223 | M · Z | spells the pictures that say "confirmed" as FactArt does: the list here is the list there |
| 200 / T1224 | M · Z | greys out with `disabled`, and leaves the other one alone |
| 209 / T1225 | M · Z | keeps its colour and shows its spinner with `busy`, as the V2Action does while a write is in flight |
| 217 / T1226 | P · F | draws the same state smaller: the picture at 48, the title in heading and the sentence in note, 16 over and under, and no lift |
| 227 / T1227 | P · F | keeps the picture of the kind at 48 |
| 234 / T1228 | M · S | shows the placeholders in the shape of what is coming and one quiet sentence, and nothing to press |
| 243 / T1229 | M · S | never puts a spinner over the screen: the wait is the placeholders, and a spinner lives only inside a button |
| 252 / T1230 | M · Z | is announced politely, once, by the one sentence |
| 257 / T1231 | M · S | waits in rows, records or facts when the screen says which: three of them by default, in the system's own shapes |
| 270 / T1232 | M · S | waits in the task card's shape only where a task list says so; every other card waits plain, with no person |
| 291 / T1233 | M · S | %s draws no card frame and no list person |
| 297 / T1234 | M · S | the preview keeps the compact card with the head and its facts, and nothing under them |
| 304 / T1235 | M · S | the face is the same head and facts, bare, over the composer's hairline |
| 311 / T1236 | M · S | a thread item is the question, the answer behind its rule, and a hairline above; the list adds no gap of its own |
| 320 / T1237 | P · F | the facts are 24 px drawings beside a label and a value, one row per fact |
| 325 / T1238 | P · F | the person is a 56 px face, five star blanks and the tag pills |
| 332 / T1239 | M · S | the state view forwards the variant to the list |
| 345 / T1240 | P · F | draws the picture of an empty screen at 144 and everything else as it was: the same column, the same words, the one green action and the one quiet one |
| 358 / T1241 | P · F | is the same state without it: an empty list that is not a hero keeps its 96 |
| 365 / T1242 | P · F | is only for an empty screen: a failure, a lost connection and an unknown outcome stay grey and still at 96, and a state inside a section stays at 48 |
| 376 / T1243 | M · S | draws the two panels of a conversation at 144 as well |
| 383 / T1244 | M · S | is written where a person building a screen looks: the header names it, and says it is for the first time only |

### src/ui/system/__tests__/status-chip.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 35 / T1245 | M · S | has exactly the plan's task and application states, each with its one word |
| 43 / T1246 | M · S | never gives two states of one object the same word, and every word is a real word |
| 51 / T1247 | M · S | says the phase by the shape and whose move it is by the tone, the same way for every state |
| 74 / T1248 | M · Z | %s draws its word AND its shape, and a screen reader hears the word alone |
| 94 / T1249 | M · S | adds a detail after a dot for the eye and after a comma for the ear, without changing the word, the shape or the tone |
| 101 / T1250 | M · S | is a small chip that sits in a row and never takes more than its words, and takes the caller's style last |
| 106 / T1251 | M · S | draws a mark alone for a caller that has its own words |
| 113 / T1252 | M · Z | reads its words at 4.5:1 or better on their ground, and its marks at 3:1 |
| 121 / T1253 | M · S | uses only colours of the system: no colour of its own is spelled in the file |
| 128 / T1254 | M · S | keeps the label type at 12 px, and no word is drawn smaller anywhere in it |

### src/ui/system/__tests__/surface-kinds-ratchet.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 52 / T1255 | M · S | reads each way of taking one: plain, aliased, type-only, several lines, a re-export, the @ alias |
| 63 / T1256 | M · S | lets through everything that is not a container taken from the system tokens |
| 78 / T1257 | M · S | prints the table as it stands today (RATCHET_PRINT) |
| 90 / T1258 | M · S | looks at a real tree, so an empty sweep cannot pass for a clean one |
| 95 / T1259 | P · F | no file outside Surface takes more than its entry, and none takes fewer: it can only shrink, and shrinks with the code |
| 104 / T1260 | P · F | every entry names a real file that is not Surface, and only names real tokens |
| 111 / T1261 | P · F | Surface really is the file that takes them, and the tokens still exist where it takes them from |

### src/ui/system/__tests__/surface.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 26 / T1262 | P · F | is white with the shadow of a raised item, 24 corners and 16 padding |
| 34 / T1263 | P · Z | with onPress is one button for the whole card, that gives on the row rung and says its label and hint |
| 46 / T1264 | P · Z | without onPress is a plain view: nothing is pressed, and nothing is said unless the caller labels it |
| 54 / T1265 | P · Z | keeps the caller's style last, so a card can be told its width or its margin |
| 61 / T1266 | P · F | is the compact card: a 1 dp edge in cardLine, 24 corners, 16 padding, and no shadow of any kind |
| 70 / T1267 | P · F | is the floating lift with the 1 dp line, white, and takes its corner from the caller |
| 77 / T1268 | P · F | has a corner of its own when the caller names none |
| 84 / T1269 | P · F | tone %s is the tint %s, flat: no edge, no shadow |
| 90 / T1270 | P · F | is a wash when no tone is given, and takes its padding from the scale (12 over and under, 16 across; `inset` pads 14) |
| 95 / T1271 | P · F | the tone belongs to a note alone: a record stays white whatever it is told |
| 102 / T1272 | P · F | a %s ignores onPress: it is read, not touched |
| 114 / T1273 | P · F | says so for a card inside a card, in every pairing, and names both |
| 121 / T1274 | P · F | says nothing for the first Surface, and nothing for a note: a tint may stand in a card |
| 126 / T1275 | P · Z | is spoken in a development build and in no other, and never under Jest (which has __DEV__ on too) |
| 133 / T1276 | P · Z | prints nothing under Jest, though __DEV__ is on here: the nesting is drawn and nobody is told |
| 141 / T1277 | P · Z | prints it once, with both names, when the build is a development build outside Jest |

### src/ui/system/__tests__/tab-bar-item.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 29 / T1278 | M · S | uses compact drawings and spacing while retaining a visible selection marker |
| 35 / T1279 | M · S | leaves room above the drawing for the marker and below the scalable label |
| 41 / T1280 | M · S | makes the bar as high as the icon, the gap, the tab padding, the bar padding and the label actually need |
| 57 / T1281 | M · Z | is always mounted, over the whole tab without a filled selection well, and never takes a touch |
| 74 / T1282 | M · S | carries a compact green marker on its top edge, which fades with it |
| 83 / T1283 | M · S | fades over the toggle token on the native driver with an ease-out, only when the selection changes |
| 98 / T1284 | M · Z | under reduced motion is instant: no animation is started and the value is set at once |
| 111 / T1285 | M · S | draws the same 24dp outline in muted and green tones |
| 121 / T1286 | M · S | shows the quiet mark at rest and brand mark when chosen, and keeps both mounted |
| 135 / T1287 | M · Z | cross-fades over the toggle token on the native driver and pops once, 1.0 to 1.04 to 1, only on a selection |
| 152 / T1288 | M · S | does not pop when it is deselected, nor when it is drawn already selected |
| 164 / T1289 | M · Z | under reduced motion swaps at once: nothing is animated |
| 178 / T1290 | M · S | uses the scalable navLabel role independently of content segments |
| 193 / T1291 | M · S | hands its measured lines on, so the bar can follow them |
| 207 / T1292 | M · Z | is the real parts in a bar surface: the four tabs, the first chosen, with the padding, corner and capsule corner of the bar itself |
| 222 / T1293 | M · Z | moves the choice, the capsule and the icon together when a tab is tapped, and says so at once to a screen reader |
| 239 / T1294 | M · S | uses React Native Animated on the native driver, and no Reanimated, layout, entering or exiting animation |
| 248 / T1295 | M · Z | moves only opacity and transform, from tokens, and reads reduced motion from the one store |
| 256 / T1296 | M · S | spells no colour, duration or spring of its own |

### src/ui/system/__tests__/tab-bar-navigator.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 54 / T1297 | M · S | puts a capsule, two copies of the icon and a label of the tab variant in each tab, in the order of the bar |
| 71 / T1298 | M · S | draws the chosen tab with its capsule shown, its brand mark shown and its label in green, and the others at rest, from the first frame |
| 85 / T1299 | M · S | draws each tab in the same 24dp outline family with muted and green layers |
| 97 / T1300 | M · Z | moves between ordinary root tabs at once for a screen reader, and starts the fade, the cross-fade and one pop on the native driver |
| 114 / T1301 | M · Z | keeps the chosen tab a root of its own: a tap on the tab already chosen starts no animation |
| 123 / T1302 | M · Z | keeps navigation silent on a cancelled touch, a completed tap and a tap on the selected tab (U10) |

### src/ui/system/__tests__/text-scale.test.ts

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 4 / T1303 | M · S | reads the Android float 1.2999999523 as the 1.3 step it is |
| 8 / T1304 | M · S | keeps the other steps and falls back to 1 for a value that is not a scale |

### src/ui/system/__tests__/use-pull-refresh.test.tsx

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 20 / T1305 | M · S | never shows the spinner for a read nobody pulled |
| 27 / T1306 | M · S | shows it while the pulled read runs and lets go when it ends |
| 41 / T1307 | M · Z | lets go of a pull that started nothing, so a later background read does not borrow it |
| 50 / T1308 | M · S | offers no pull when the screen has no refresh |

### scripts/__tests__/entry-assets.test.cjs

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 15 / T1309 | M · S | installs byte-identical resources without a docs directory or historical HTML |
| 23 / T1310 | M · S | validates all hashes before writing even the first resource |
| 29 / T1311 | M · S | rejects a manifest destination outside its fixed output allowlist |

### scripts/__tests__/design-lab-boundary.test.cjs

| Linija / ID | Ocena | Grupa |
| --- | --- | --- |
| 14 / T1312 | M · Z | development scenes cannot become Expo product routes or runtime imports |

## Dokumenti i istorija

Svi dokumenti ispod imaju zasebne lokacije pravila/pasusa u JSON-u. Aktivni ulazi se povezuju na Premium White; istorijske datoteke zadržavaju originalni tekst ispod jasno označenog istorijskog zaglavlja. CSV/JSON inventari zadržavaju istorijske podatke i nisu runtime/proizvodni registar.

| Dokument | Pravila/pasusi | Freeze predmeti |
| --- | ---: | ---: |
| AGENTS.md | 23 | 1 |
| USKOCI_MASTER_PLAN_DIZAJNA.md | 7 | 0 |
| docs/current/README_USKOCI_LIVE_MASTER_PLAN.md | 30 | 0 |
| docs/authority/AUTHORITY_INDEX.md | 21 | 2 |
| docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md | 28 | 1 |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md | 60 | 10 |
| docs/implementation/design-system/ICON_SYSTEM.md | 141 | 12 |
| docs/implementation/design-system/TOOLSET.md | 48 | 5 |
| docs/product-design-truth/DESIGN.md | 64 | 2 |
| docs/product-design-truth/USKOCI_COMPONENT_INVENTORY.md | 81 | 3 |
| docs/product-design-truth/USKOCI_DESIGN_IMPLEMENTATION_GAP.md | 53 | 4 |
| docs/product-design-truth/USKOCI_FIGMA_DESIGN_BRIEF.md | 64 | 4 |
| docs/product-design-truth/USKOCI_FIGMA_MAKE_MASTER_PROMPT.md | 40 | 4 |
| docs/product-design-truth/USKOCI_INFORMATION_ARCHITECTURE.md | 29 | 2 |
| docs/product-design-truth/USKOCI_PRODUCT_CANON.md | 63 | 4 |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md | 1042 | 7 |
| docs/product-design-truth/USKOCI_USER_FLOWS.md | 66 | 2 |

## Dokumentovane grupe koje traže povlačenje starog autoriteta

| Fajl:linija | Raniji zahtev (skraćeno) | Zamena |
| --- | --- | --- |
| AGENTS.md:52 | Postojeći beli prostor, zelena/narandžasta prepoznatljivost i komponente su polazna osnova, ne vizuelni kavez. Raspored, ikone, tipografija, razmaci, ilustracije i animacije mogu se stručno preoblikovati. Stare SPOJ/V28/V41/V46 kompozicije, tačne dimenzije i z… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/authority/AUTHORITY_INDEX.md:16 | Stari SPOJ/V28/V41/V46 i druge HTML reference ostaju poreklo i pomoć u razumevanju funkcija. Ne zaključavaju raspored, broj kartica, veličinu početnih pločica ni tačno trajanje nove kompozicije. Sačuvati prepoznatljiv brend i prava na originalne resurse; prome… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/authority/AUTHORITY_INDEX.md:23 | - [Final owner review 21/21](sources/owner-history/01_CURRENT_CANON/OWNER_REVIEW_21_FINAL_COMPLETE_SOURCE.md), [locked decisions](sources/owner-history/01_OWNER_LOCKS/OWNER_LOCKED_DECISIONS.md), [50-row reconciliation](sources/owner-history/02_RECONCILIATION/0… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md:7 | Najnoviji zahtev je da aplikacija dobije jasan sadašnji izgled i tokove, bez gomilanja starih ekrana i smernica, uz slobodu za redizajn. Prethodni SPOJ/V28/V41/V46 rasporedi, veličine pločica i tačne motion sekvence više nisu obavezna vizuelna kompozicija. Čuv… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:3 | > **Current scope, 2026-10-18:** the owner now requests a clean current app and freedom to redesign the UI/UX. This list is a historical skill-selection reference, not a requirement to reload every skill or reproduce V28/manual-profile/Entry layouts. Use avail… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:5 | Owner instruction: 2026-09-13, load all nine skills and use them throughout USKOČI app work. Each SKILL.md below was read in this session. This registry persists that preference for future sessions; it does not claim model memory outside this workspace or that… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:40 | Keep original brand assets; use white surfaces. The colours and letters are the owner's V28 prototype as of 2026-09-22 (superseding the earlier green #176B55 / orange #FF850F / ink #183A30 / secondary #586B62 and "existing font family"). Use `sys.color` in `sr… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:61 | The owner ordered the UI/UX pass on 2026-10-02 ("kreni sad"). His complaints were a generic look, poor motion, poor icons, weak legibility and unclear screens, and the audit traced a large part of them to values every screen chose for itself. This section is t… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:81 | green = do / selected / money the one primary action, the chosen tab or chip, a title that opens something, a price, a fact that IS confirmed ink = content what a person wrote and what a thing is called muted = unknown / meta a term that is not set ("Termin ni… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:92 | `danger` says something went wrong or cannot be undone, and always sits beside a word or an icon. Fact pictures follow the same table through `sys.color.art`: four tones, `brand` (the UI green, the default for every kind), `accent` (the orange, only where it m… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:113 | R1 Only transform and opacity move: never height, width, top or an SVG prop (the locked V4.9 entry scene is the one exception). An SVG draw pass is what the B22 Reanimated flood replays. R2 Enter decelerates and is longer than exit; easeOut is passed explicitl… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:186 | `one-token-source.test.ts` holds four guards. The first two are ratchets: each names today's offenders so the suite is green now, and each can only shrink. They are EQUALITIES, not ceilings (wave-1 review): a file that is not on a list, or that spells more tha… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:195 | locked entry; the files move onto `useLayoutClass()` wave by wave). An aliased import of `useWindowDimensions` or `Dimensions`, a namespace access and a width read from `useWindowRoom()` count as reads. Not seen: a width handed on as a value; | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/v5-ai-first/DESIGN_SKILLS.md:232 | Behaviour changes to confirm on the HONOR before wave 1 is called done (SOURCE and CI only until then, AGENTS 3.2.4): the entry buttons (`EntryWelcome` is locked and untouched, but its `Press scaleTo={1} haptic="light"` now ticks on release instead of on touch… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:14 | Two things in this item are defaults applied by the team, pending the owner's eye on the phone, not owner decisions: the single-tone sticker (the old two-tone one of 2026-09-22 is gone and cannot be restored without redrawing it) and the flat mark for 24 dp an… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:75 | The same 32-unit canvas, drawn two ways. The mark is not a shrunken sticker: it is the same subject with the finish taken off. The reason is a design decision, not a legibility emergency: one hue, one weight and fewer details make one consistent family at the … | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:88 | - At most four SVG shapes per picture, and always fewer than the sticker of the same kind (B22: every `react-native-svg` | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:103 | The look the owner approved on 2026-09-22 and the one the Home rows, the Profil rows, the tab bar and the empty states keep: a ground shadow (ellipse at 16, 29.4, rx 10.2, ry 1.6), a darker edge 1.5 units under the face, a light shine stroke, white or ink deta… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:110 | A picture is one hue. The tones come from `sys.color.art` in `tokens.ts`, never from a hex in FactArt, so the picture, the title and the primary action are the same green. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:125 | Two oranges, on purpose. The accent sticker (25 dp and up) is the action orange `#FA8229` on its darker edge; the accent mark (24 dp and down) is that tone's edge, `#C86821`, because a small graphical object must be 3:1 against white (WCAG 1.4.11) and `#FA8229… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:149 | \| `calendar` \| a date or a term in the calendar \| `lock` \| something private or locked \| | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:260 | - the shape count of the mark is at most four and below the sticker's for every kind; | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:278 | Open `uskociapp://dizajn-tabla` in the internal build. The board draws, for every kind: the ladder 16, 20, 24, 32, 48, 64 (the mark up to 24, the sticker above); then "Dva reza: nalepnica (levo) i oznaka (desno)", the sticker beside the flat mark at 16, 20 and… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:284 | Verify (wave 1 plan, item 1.3): every card-row icon at 16 and 20 dp is nameable without its word; one hue; no grey blur under an icon; no tick on a calendar; orange only on counts, waiting and the bell and star; the five pairs that were close (`tasks` and `pub… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:300 | - The owner's A/B of the single-tone default against the old two-tone look does NOT exist on the board: both cuts there are in | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/ICON_SYSTEM.md:308 | 2. Draw the mark first: one tone and white, at most four shapes, strokes 2.4 or more, inside 0.5 to 31.5, no tick unless it | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/TOOLSET.md:11 | \| Design audit \| **impeccable** (critique, audit; harden and polish before release) \| React Native audit from source: screen-reader labels, 48 dp targets, text scaling, list performance; critique scoring \| Its "be bold" stance yields to "refine, don't replace"… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/TOOLSET.md:19 | \| Every phase end \| **superpowers:verification-before-completion** \| No "done" without fresh tsc, Jest and phone evidence tied to a commit \| \| | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/TOOLSET.md:21 | \| Backend and database \| **supabase** + **supabase-postgres-best-practices**, and the Supabase connector (read-only queries, logs) \| RLS, grants, migrations, edge functions \| DEV changes still need a disposable proof and the owner's "primeni". \| | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/TOOLSET.md:37 | \| Built-in browser \| Owner's HTML prototypes (V41, V46) through the local static server on port 8097; reference research \| STANDARD for references \| | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/implementation/design-system/TOOLSET.md:62 | write-swift (no Swift in the repo), animation-vocabulary (naming only), code-review and code-simplifier (duplicate pr-review-toolkit; code-review posts public PR comments), frontend-design (V28 already fixes the look). | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/DESIGN.md:47 | Owner-confirmed correction, 8 September 2026: this three-zone decision supersedes the earlier five-tab design brief. The current canonical three-zone shell is aligned with it. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/DESIGN.md:52 | - Bell → Notifications / Inbox. Avatar → Profile, including the intent switch. No permanent Home or Profile tab. Map/List are modes inside Zadaci, accessible in both intents; access to public discovery does not grant Application or private-data permissions. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_COMPONENT_INVENTORY.md:30 | Use the owner-confirmed three-zone correction from 8 September 2026; previous five-tab variants are superseded. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_COMPONENT_INVENTORY.md:32 | - Three-zone role bar: MENI TREBA = Zadaci \| U / Novi \| Dogovori; JA MOGU = Prijave \| U / Zadaci \| Dogovori. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_COMPONENT_INVENTORY.md:33 | - Top bar with title, bell → Inbox and avatar → Profile; no permanent Home/Profile bottom items. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_DESIGN_IMPLEMENTATION_GAP.md:3 | Baseline: canonical `38e9a38`, live migrations 87/87, Edge `uskoci-ai-interview` v11 ACTIVE/JWT. Open PRs are candidates only. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_DESIGN_IMPLEMENTATION_GAP.md:65 | - **R01 Former Naručilac Home** and **W01 Former Uskočer Home** are superseded by the owner-confirmed three-zone correction on 8 September 2026. Their absence is not a missing capability. Useful context belongs in Zadaci, Prijave, Dogovori and avatar → Profile… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_DESIGN_IMPLEMENTATION_GAP.md:69 | - Owner-confirmed navigation: MENI TREBA = Zadaci \| U / Novi \| Dogovori; JA MOGU = Prijave \| U / Zadaci \| Dogovori. Bell → Inbox; avatar → Profile. No permanent Home/Profile tabs. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_DESIGN_IMPLEMENTATION_GAP.md:70 | - Checked source `0e6951e` already implements the three-zone shell in `src/app/(app)/_layout.tsx`; it is aligned, not navigation debt. The final visual treatment and shared List/Map access inside Zadaci for both intents retain their separately recorded partial… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_DESIGN_BRIEF.md:22 | - Canonical source: Git `38e9a38`. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_DESIGN_BRIEF.md:23 | - Live data model: Supabase `leqcwgzvjsxugfgzdmth`, 87 migrations, Edge AI v11. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_DESIGN_BRIEF.md:44 | - Bell → Notifications / Inbox. Avatar → Profile, including the intent switch. No permanent Home or Profile tab. Map/List are modes inside Zadaci, accessible in both intents; access to public discovery does not grant Application or private-data permissions. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_DESIGN_BRIEF.md:45 | - This explicit owner correction supersedes the earlier five-tab brief; the current three-zone source is not a navigation gap. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_MAKE_MASTER_PROMPT.md:22 | Use this locked navigation: | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_MAKE_MASTER_PROMPT.md:26 | - Bell → Notifications / Inbox. Avatar → Profile, including the intent switch. No permanent Home or Profile tab. Map/List are modes inside Zadaci, accessible in both intents; access to public discovery does not grant Application or private-data permissions. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_MAKE_MASTER_PROMPT.md:27 | - This latest owner-confirmed three-zone decision supersedes the earlier five-tab reconstruction brief. Preserve the aligned canonical shell semantics. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_FIGMA_MAKE_MASTER_PROMPT.md:55 | Build a reusable variable-driven system: color, typography, spacing, radius, elevation and motion tokens; buttons, inputs, chips, three-zone navigation with a central U action/destination, Need/Opportunity/Application/Dogovor cards, map pins/sheets, AI/chat el… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_INFORMATION_ARCHITECTURE.md:5 | Owner-confirmed correction, 8 September 2026: the following three-zone architecture supersedes the earlier five-tab brief. The canonical three-zone shell is aligned with this decision. Shared discovery coverage is a separate implementation boundary. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_INFORMATION_ARCHITECTURE.md:61 | - shared task discovery with List / Map modes - owner-only Needs/drafts context, clearly distinguished from public discovery - lifecycle filters and compact owner Need cards - full Need detail - edit through AI/manual correction - structured review - publish -… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_PRODUCT_CANON.md:5 | This product canon was reconstructed on 8 September 2026 from canonical Git commit `38e9a38f7c9713cc7061f347eb083d84022dcdfd`, the live Supabase project `leqcwgzvjsxugfgzdmth` with 87 migrations and Edge Function `uskoci-ai-interview` v11, the current governin… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_PRODUCT_CANON.md:7 | Navigation correction, 8 September 2026: the owner explicitly reconfirmed the three-zone model below. This supersedes the five-tab instruction in the earlier reconstruction brief and the resulting design handoff. The broader code/live evidence above retains it… | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_PRODUCT_CANON.md:44 | Zadaci is the requester entry surface: it offers task discovery in List/Map and an owner-only view of the user's own Needs and drafts. Attention belongs with the relevant Need or Dogovor instead of a separate Home tab. The center U / Novi opens Need creation. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_PRODUCT_CANON.md:102 | \| Three-zone role navigation \| Latest owner-confirmed decision \| Canonical shell aligned; final visual treatment remains separate \| | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:3 | Generated 2026-09-08. Evidence boundary: canonical Git HEAD `38e9a38`; live Supabase `leqcwgzvjsxugfgzdmth`; open PR work is listed as pending, never canonical. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:133 | **Statuses:** UNKNOWN; GRANTED; DENIED; BLOCKED | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:289 | **Statuses:** ACTIVE; CLOSURE_BLOCKED; CLOSURE_PENDING; CLOSED | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:326 | **Current route/evidence:** Owner-confirmed three-zone correction 2026-09-08; former five-tab concept superseded | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:352 | **Current route/evidence:** /nova; nova.tsx; aiNeedV2Production.ts; Edge v11; actual provider success unproven | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:471 | **Statuses:** INCOMPLETE; READY_FOR_DRAFT; REVIEW_REQUIRED; BLOCKED; SAVED; STALE | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_SCREEN_INVENTORY.md:508 | **Current route/evidence:** Owner-confirmed three-zone correction 2026-09-08; former five-tab concept superseded | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_USER_FLOWS.md:3 | Navigation follows the owner-confirmed three-zone correction of 8 September 2026. Bell → Inbox; avatar → Profile. No permanent Home/Profile tab. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |
| docs/product-design-truth/USKOCI_USER_FLOWS.md:24 | 8. Success opens the full Need detail or owner Needs context inside Zadaci with the exact saved values. | Aktivan Premium White; sačuvana istorija i funkcionalne zaštite. |

## Šta ovo ne dokazuje

Nema tvrdnje da je cela aplikacija redizajnirana, da je svaki predlog ručno verifikovan ili da je svaka stara test zabrana uklonjena. Aktuelni build/native/DEV rezultat čita se iz postojećeg registra i isporuke. Spoljašnja donor putanja iz `uskoci-design` veštine nije dostupna; korišćeni su dostupna veština, stvarni repo, istorijski manifesti i poslednji nalog vlasnika. Nije preuzet tuđi identitet niti rađeno internet poređenje konkretnih Airbnb ekrana.


## Završni integratorski pregled

Dodatno su pročitane i usklađene preostale označene grupe. Pet naslova je pogrešno sugerisalo vizuelni freeze; njihove stvarne funkcionalne provere ostale su. Ostale navedene zamene i konačni hash-evi nalaze se u `rootIntegrationReview` i `currentFileSha256` mašinskog zapisa. Gornji spisak čuva baseline nalaz; konačna klasifikacija je u JSON-u. Dokaz lokalne regresije, CI-a i emulatora vezuje `PREMIUM_WHITE_FOUNDATION_20261018.json`.
