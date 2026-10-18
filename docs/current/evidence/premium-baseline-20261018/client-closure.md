# Premium reset — client closure

Datum: 2026-10-18. Integrator: root. Autor ovog ograničenog paketa: ai_coverage.

## Granica i prethodno stanje

- Pre prvog upisa pročitan je baseline manifest od `2026-10-18T18:00:58.201499+00:00`, HEAD `eaa38a04e20be24bba71840660493b634180ee72`, grana `feature/unified-qa-master-20261017`.
- Manifest je sačuvao prethodni dirty paket; nije korišćen reset/checkout/discard. Ovaj paket nadograđuje postojeće AI-only tokove, Home i Premium White izmene.
- Tačan spisak 25 promenjenih/dodatih/uklonjenih putanja u ovom krugu, sa prethodnim i završnim SHA-256, nalazi se u `client-closure-files.json`. To su razlike prema sačuvanom dirty baseline-u, ne sve razlike prema HEAD-u.
- Nema Supabase poziva, upisa, migracija, Edge objave, plaćenih AI poziva, commit/push niti APK build-a iz ovog podzadatka.

## Funkcionalne izmene

### 1. Prečice za područje rada i dostupnost

`src/ui/workerProfile/WorkerAiTopicEntry.tsx` sada poziva `router.replace`, akciju koju stvarni Tabs adapter podržava. Prethodni `dismissTo` šalje stack akciju POP_TO, koju ovaj navigator ne obrađuje.

Prethodni unit mock je `dismissTo` prosleđivao u spy nazvan replace i zato nije mogao da otkrije problem. Mock je ispravljen. Novi `worker-ai-topic-navigation.test.tsx` montira stvarni ExpoRoot, sve route nazive sa diska i stvarni `(app)/_layout`:

- oba ulaza zaista završavaju u `profil/razgovor`;
- postojeći conversation route key i mounted local draft ostaju isti;
- lokalni correction token ima pravi account/revision/topic;
- Back preskače kompatibilni ulaz i vraća se na početnu;
- ne dodaje se opšte spajanje parametara u navigatoru.

Važna razlika: REPLACE menja URL parametre. Stvarni `WorkerConversationRoute` već čuva owned conversation ID za topic-only povratak. `worker-conversation-parts.test.tsx` odvojeno montira taj stvarni route i dokazuje očuvanje ID-a, neposlatog teksta i granica naloga. Novi router test ne tvrdi da URL conversationId ostaje prisutan.

### 2. Jedan običan AI ulaz za izmenu zadatka

`src/app/(app)/pregled-zadatka.tsx` prikazuje jedan običan ulaz „Izmeni kroz razgovor“ (accessibility label „Izmeni zadatak“). Naslov, opis, cena, termin, broj ljudi i zahtevi nemaju sopstvenu olovku. Ulaz otvara isti owned intake sa lokalnim `task.details` kontekstom; ne šalje poruku, ne menja fact i ne objavljuje zadatak.

Očuvano:

- zasebna potvrda mesta na mapi i tačne adrese;
- zaseban tok fotografija;
- read-only rok za prijave, jer za njega ne postoji običan AI fact ugovor;
- SYSTEM oznaka podrazumevane vrednosti;
- prikaz nenavedenih činjenica na zahtev;
- ciljane recovery akcije za stvarno nedostajuće podatke;
- ownership/focus/revision granice, držanje nepoznatog ishoda i readback objave;
- odvojeni javni i privatni prikaz podataka.

Galerija `dizajn-objava.tsx` prati isti ugovor. Demonstracioni razgovor je izričito lokalni primer, ne pravi provider poziv. Testovi proveravaju jednu stvarnu Press akciju, mapu/fotografije, nepromenjenu fixture nakon povratka i zabranu ručnih fact formulara.

### 3. Povučena neaktivna ručna grana radnog profila

Referentna pretraga je potvrdila da aktivni `radnik.tsx` već bira AI-only prikaz, dok su ručnu granu `WorkerProfileForm` koristili istorijski prikazi u galeriji i `pkg011-slice5-presentation` test.

Uklonjeni su interni `Field`, `TermsEditor`, `ProfileSection`, `ProfileSummary`, njihove lokalne editing/focus grane, uvozi i stilovi. Komponenta sada prikazuje samo prvi AI ulaz ili postojeće podatke preko `WorkerProfileSaved`, čak i kad stari caller izostavi `aiOnly`.

Nije uklonjeno čuvanje prethodno zadržanog lokalnog nacrta, sinhronizacija imena naloga, journal, ownership guard niti readback u `radnik.tsx`. Kompatibilni propovi ostaju radi tih caller-a i testova; ne mogu da otvore ručni editor. Potvrda tačke na mapi ostaje aktivan poseban tok.

Galerija profila više ne prikazuje ručni unos biografije/veština/vozila niti tvrdi da ima aktivan availability prekidač. Istorijski prikazi save/readback ishoda ostaju korisni za postojeći recovery ugovor.

## Testovi: šta je povučeno i šta ostaje zaštićeno

| Stara provera | Zamena / očuvani ugovor |
|---|---|
| Celo stablo rating ekrana i snapshot sa `#00845A` | Nema TextInput komentara kad flag nije uključen; eksplicitan izbor 1–5, tag, owned legacy request bez comment parametra, potvrđen saved rezultat, nema editovanja sačuvane ocene |
| Ručni worker editor i chip uklanjanje | Čitljive sačuvane činjenice, AI-only ulaz bez upisa, dostupnost kao činjenica, nema manual polja ni uklanjanja |
| Pojedinačne fact olovke | Jedan AI ulaz, ista konverzacija, nepromenjene činjenice pre eksplicitne poruke |
| Exact visine tabova 61/64/67 i nula radius/margine | Konačna nenegativna geometrija, viewport, 48 dp kontrola, font scaling, native measured label height i system inset |
| Green-only Send / inbox odsustvo pojedinih heks boja | Dostupnost/disabled Send, razlika dostupno–nedostupno, čitljivo read/unread stanje, accessibility akcije i stvarni callback |
| Hardcoded green za primarne akcije | Centralna `brandAction` uloga gde se testira konzistentnost primarne akcije; ne određuje koji heks mora da bude brend |
| Tačna zelena filtera ili linka za Dogovor | Semantička selekcija/check, stabilan inset, stvarni onAgreement callback |

Velika prethodna brisanja testova za ručni worker unos pregledana su po nameni. Povučene su metode koje više nemaju product ulaz. Relevantna zaštita ostaje u stvarnim route testovima: suspendovan profil i retained callbacks, ABA account generation, owned topic, unknown save/readback, name synchronization, signed review, explicit activation, journal/recovery/cancel, unsent draft, map confirmation i one-account/both-roles shell. Nije izbrisana provera idempotentnosti, ovlašćenja ili privatnosti radi lakšeg prolaza.

`availability-step10.test.tsx` i njegove preostale component provere nisu blanket obrisani: UI komponenta i pripadajući data ugovori imaju reference izvan kompatibilnog route-a. Sam ulaz u product sada vodi kroz AI. Isto važi za servisne write-safety testove.

## Izvršene ciljane provere

Komande koriste postojeći `node node_modules/jest/bin/jest.js --runInBand --silent --runTestsByPath ...`. Nije pokretana puna lokalna suite.

1. Worker/navigation paket: `worker-ai-topic-navigation`, `worker-conversation-parts`, `worker-profile-native`, `pkg011-slice5-presentation`, `profile-gallery`: **5 suite / 77 testova PASS**.
2. Review/navigation paket: `review-exits-and-place`, `v5-tab-navigation`, `tabLayoutSafeAreaContract` prošli u zajedničkom krugu. Gallery jedan novi count assertion prvobitno je brojao i ListRow i njegov Press; popravljen da broji stvarni interaktivni Press. Potom **dizajn-galerija-pregled PASS**.
3. Presentation/interaction krug od 11 suite: **10 PASS / 518 prošlih testova, 1 neuspešan**. Jedini neuspeh bio je nov selector u `application-face`; ispravljen da pritisne stvarni foot action i proveri onAgreement. Ostatak kruga: task review, review exits, gallery review, chat thread/UI, filter selection, inbox, swipe, push preferences i location guards prošli.
4. Završni krug: `application-face`, `oceni-dogovor-flag-off-baseline`, `profile-gallery`, `worker-ai-conversation-recovery`, `pkg005-worker-onboarding`, `availability-route-refresh`, `availability-step10`, `worker-area-route`: **8 suite / 164 testova PASS**, 36.442 s.
5. `node --test scripts/__tests__/design-lab-boundary.test.cjs`: **1 PASS**; nema product route/import putanje u development galeriju.
6. `git diff --check` u vlasničkom scope-u: **PASS**. CRLF normalization upozorenja nisu greške patch-a.

Brojevi iz različitih krugova se ne sabiraju: delovi su ponovljeni samo posle konkretne korekcije. Prvi neuspesi nisu sakriveni: nedostajući session mock, pogrešna pretpostavka o URL parametru, wrapper/Press duplo brojanje i previše uzak a11y selector ispravljeni su prema stvarnom ugovoru, bez slabljenja produkcionih zaštita.

## Preostala integracija

- Root radi TypeScript proveru i jednu punu regresiju na nepromenljivom CI izvoru sa APK build-om.
- Native izgled i realan povratak na emulatoru potvrđuje root na tom APK-u; ovaj manifest ne tvrdi da je nova verzija već instalirana.
- Nisu rešavani novi regionalni matching, novi AI field ugovori, server statusi, privacy grants ili push. Ovaj paket ih ne menja.
- Izvor je zamrznut posle završnog ciljanog kruga. Dalje korekcije samo na konkretan rezultat integratora.
