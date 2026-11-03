# R04/R08/R11 — prirodni kratki odgovori i miran prikaz razgovora

Datum: 03.11.2026. Bazni aplikacioni source: `4e6f5c05579d0151a3aefe791738634120ad6bb4`.
Ovo je dokaz izvršenja uz postojeći `docs/plan/CODEX_PLAN_RADA.md` (R04/R08/R11/R12),
ne novi master, potpuni audit ili release odobrenje. Product autoritet ostaje
`docs/product/USKOCI_PRODUCT_UX_MASTER.md`, naročito B0 i S16.

## Šta je promenjeno

1. Postojeći Worker mode parser prihvata kratke jasne izbore „Uživo“, „Lično“,
   „Onlajn“, „Oba“ i povezane formulacije u oba pisma. Izbor pripada samo poslednjem
   pitanju o jednoj ponuđenoj usluzi na istoj server-owned reviziji. Proverava se
   tačan skup načina rada, originalni USER citat i odsustvo nove handoff dozvole.
   Pomeranje granice od šest znakova pomoću tačke više ne menja ovaj ugovor;
   „Da“, „Ne“, „Može“ i „Važi“ ne proširuju sposobnosti. Duplikati, promenjen nalog/
   revizija, druge usluge, saved handoff i potpisani Save zadržavaju svoje zaštite.
   Prompt ne traži izmišljanje dužeg citata. Ovo nije opšti jezički klasifikator,
   novi modelski poziv, SQL promena ili aktivacija radnika.
2. Statični AI marker i eksplicitno statična ilustracija više ne stvaraju tri
   Animated.Value objekta, interpolacije, AppState listener ili dekorativni timer.
   Animirana ilustracija sada prekida i aktivno treptanje/namigivanje, ne samo
   lebdenje, pri background-u, unmount-u i Reduce Motion. Stari completion callback
   ne može pokrenuti novi timer posle povratka. Svi dekorativni timing-i koriste
   native driver i isInteraction=false. Identitet, veličine, boje i motion tokeni
   su sačuvani; ovo nije tvrdnja o izmerenom native FPS-u.
3. Evidencija pristiglih poruka koristi copy-on-write za skupove ID-jeva.
   Stream fragmenti i kucanje ne kopiraju celu poznatu istoriju; stvarna nova
   poruka dobija svoju kopiju pre izmene. Render ostaje čist, istorija mirna,
   potpun AI odgovor se najavljuje jednom, a fragmenti se ne izgovaraju.
4. Postojeći klijentski odgovori za dostupnost i Raspored koriste Vi/Vam formalni
   govor. Kodovi grešaka, account/revision zaštita, čuvanje, transport i korisnički
   sadržaj nisu menjani. Nema nove automatske prijave ili push saglasnosti.

## Reprodukcija i lokalni prihvat

Zaključana kopija repo-a i zavisnosti preuzeta je kroz read-only GitHub run
`41726803003`, artifact `13275860714`. Provereno je 3925 primljenih tracked blobova
prema izvornom Git stablu, bez razlike; šest font fajlova namerno nije preneto.
To je provera integriteta kopije, ne tvrdnja da je svaki fajl analiziran.
Zavisnosti su instalirane iz lockfile-a sa --ignore-scripts, zatim je stvarni
Reanimated patch primenjen i `verify-native-patches.cjs` prošao. Lokalno Node
22.16.0 / TypeScript 6.0.3; GitHub Node24 CI ostaje zaseban dokaz.

Novi testovi na neizmenjenom baznom kodu:
- kratki odgovori: 57 slučajeva, 36 PASS / 21 FAIL;
- lifecycle ilustracije: 12 slučajeva, 2 PASS / 10 FAIL;
- arrival istorija: 16 slučajeva, 15 PASS / 1 FAIL (kopiranje istorije).
Ovo su ulazi/posledice tri ograničena problema, ne 32 nezavisna produkciona kvara.

Posle ispravke:
- jedanaest povezanih AI fajlova: **587 PASS / 0 FAIL / 0 SKIP / 1 postojeći TODO**;
- deset mobilnih testnih celina: **523 PASS / 0 FAIL**, uključujući zadatak,
  worker razgovor/profil, layout/question focus, dostupnost i Raspored;
- TypeScript, Node sintaksa i git diff whitespace proveravaju se odvojeno;
- isti test sa 1000 istorijskih poruka i 30 fragmenata više ne kopira istorijski
  ID ledger; tek stvarni kanonski odgovor ga kopira jednom.

Tačne komande, hash-evi promenjenih fajlova i rezultati su u susednom JSON receipt-u.
Novi testovi koriste postojeće Node/Jest glob-ove; nema nove test biblioteke.
Privremeni `uskoci-review-workspace.yml` služi samo preuzimanju javnog tracked
source-a i zaključanih zavisnosti i uklanja se u istom implementation paketu.

## Dodatni povezani UI zahvat — R08/S16, isti datum

Nastavak posle source commita `bf657192ed94bfb0280876f889f4ba617b994bda`.
Postojeći `Turn` u zajedničkom `AiConversationShell.tsx` više ne pravi
Reanimated omotač za istoriju ili za već prikazan stream/pending tekst.
Izbor omotača i ulazna animacija vezani su za prvi mount istog reda: kucanje,
osvežavanje, promene naglaska i preferenci ne remount-uju pročitani tekst.
Novi AI odgovor dolazi 8dp odozgo, sopstvena nova poruka 8dp odozdo, koristeći
postojeće `content.reveal`/240ms/easeOut tokene iz Product B0.3. Nema novog
animation framework-a, palete, fonta ili paralelnog razgovora. Nije promenjena
potvrda lokacije, anchor/tastatura, slanje, čuvanje ili prikaz finalnog pregleda.

Šest novih montiranih provera na prethodnom kodu: 1 PASS / 5 FAIL; posle
izmene svih 6 PASS. Zajedno sa šest postojećih relevantnih testnih celina:
**7 suite-ova / 382 PASS / 0 FAIL**, TypeScript noEmit PASS. Ovaj broj se
preklapa sa prethodnih 523 i ne sabira se kao novi nezavisan zbir. Animacioni
builder-i i native View su zamene; vizuelni Android/iOS prihvat nije izvršen.
Tačne datoteke i komanda: `conversation-polish-ui-20261103.json`.

## Granice

Nema SQL, ACL/RLS, Supabase deploy-a, flag/tajni promene, plaćenog modelskog
poziva, OTA/APK isporuke, fizičkog uređaja, dva-naloga ili store prihvata.
Provideri, AppState/native animacije i poruke u testovima su kontrolisane zamene;
izvršen je stvarni parser/builder/React komponentni kod, ne stvarni telefon.
Glavni CI ne zatvara R01, R10, matching/push, fotografije/glasovne poruke,
pun vizuelni freeze ili javno izdanje. Te stavke ostaju u istom CODEX planu.
Ne primenjivati LOCAL_ONLY SQL kandidate niti menjati readiness sertifikate
na osnovu ovog frontend/parser dokaza. Sledeća isporuka mora proveriti tadašnji
HEAD i tačan Edge/klijent paket; stari zeleni rezultat nije potvrda novog sadržaja.
