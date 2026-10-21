# CUR01 — obavezni izolovani dokaz pre forward verzije

Nijedan scenario ispod nije izvršen. Koristiti sintetičke naloge u zasebnoj
provereno izolovanoj bazi, posle closure/retention popravke i dovršene CUR01
forward verzije. Svaki scenario počinje novim fixture-om; stari receipt se
čita, nikad ponovo ne šalje kao nova poslovna radnja. Zabeležiti ID fixture-a,
pre/post `pg_get_functiondef` hash, ACL, SQLSTATE, receipt i oba loga sesija
bez privatnih poruka u izveštaju.

| ID | Korak | Obavezno opažanje |
| --- | --- | --- |
| C00 | Pre forward porta popisati postojeće priced DRAFT/OPEN, priced PUBLISHED/SELECTION, zatvorene i legacy-schema intake razgovore. Posle porta na sintetičkom istorijskom DRAFT fixture-u čitati `AFTER_HISTORY_QUARANTINE`. | Preexisting V2 DRAFT je `UNRESOLVED`, stari fakti/Need ostaju kao zastarela istorija, review/publish odbijeni. Priced non-DRAFT ili zatvoren vezan razgovor prekida port sa `CUR01_HISTORICAL_PUBLISHED_OR_CLOSED_PRICE_INVENTORY_REQUIRED`; legacy OPEN sa aktivnom cenom daje `CUR01_HISTORICAL_LEGACY_PRICE_INVENTORY_REQUIRED`. Nema tihog backfill-a u NORMAL. |
| C00A | Izolovani fixture: `NEED_INTAKE`, `COMPLETED` ili `ABANDONED`, bez `bound_need_id`, uz aktivan `need.price_mode` ili `need.price_rsd` fakt. Posebno proveriti vezan non-DRAFT Need i otvoren V2 DRAFT. | Zatvoren nevezan i vezan non-DRAFT moraju oboriti istorijski port sa `CUR01_HISTORICAL_PUBLISHED_OR_CLOSED_PRICE_INVENTORY_REQUIRED`. Samo otvoren V2 DRAFT ide u `UNRESOLVED` karantin; `fact_schema_version='NEED_FACT_V2'` ograničava UPDATE. |
| C01 | Aktivni `need.price_mode=MY_PRICE`, `need.price_rsd=100`, basis; prihvaćen DRAFT. Novi turn „u evrima”. | Claim atomarno postavlja `UNRESOLVED`; nema aktivna tri price fakta; Need ostaje DRAFT iste revizije sa starom cenom; review `canAccept=false`; publication context `NOT_READY/PRICE_UNRESOLVED`. |
| C01A | Prvi turn, bez aktivne RSD činjenice ili Need cene: „Budžet mi je 100 EUR”. Ponoviti kada se EUR nalazi posle 160. karaktera validne poruke (do 4000). | Oba claim-a postavljaju `UNRESOLVED` pre context hasha; modelova RSD pretpostavka ne ulazi u price fakta. Nema preskakanja zbog dužine ili odsustva stare cene. |
| C02 | Isti UUID i tekst ponoviti posle nepoznatog ishoda; isti UUID sa drugim tekstom. | Prvi je isti turn/status/receipt bez drugog supersedovanja; drugi `AI_REQUEST_ID_REUSED`. |
| C03 | Provider failure, owner cancel, istekao lease posle C01. | `UNRESOLVED` i odsustvo aktivne RSD cene opstaju; nema automatske obnove/objave. |
| C04 | Posle C01 reći samo „12000” ili model vrati lažni `need.price_rsd` bez RSD u owner tekstu. | Ostaje `UNRESOLVED`; lažni price predlozi se ne upisuju; drugi nezavisan fakt iz iste poruke može opstati. |
| C05 | Posle C01, sa već potvrđenim `people_needed=3`, „12000 RSD ukupno” uz tri price predloga. | `RSD_READY`, aktivan `MY_PRICE/12000/TOTAL`, novi source hash, novi review može biti prihvaćen; `AFTER_ACCEPT` sa `proof_expected_mode=MY_PRICE`, `proof_new_price_rsd=12000`, `proof_expected_price_basis=TOTAL` proverava da su **sačuvani Need mode, iznos i basis** novi, uz DRAFT reviziju veću od polazne i stanje `NORMAL`. |
| C05A | Posle C01, `people_needed=1`, „5.000 RSD” uz samo mode i amount, bez basis-a. | `RSD_READY`, iznos je 5000 (ne 0), tačno **dva** aktivna price ključa, basis ne postoji. `AFTER_RSD_TURN` proverava `proof_new_price_rsd=5000`. |
| C05B | `people_needed` nije poznat ili je za više ljudi izostavljen/pretpostavljen basis. | Ostaje `UNRESOLVED`; model ne izmišlja broj ljudi ni osnovu cene. |
| C05C | Posle EUR korekcije i stanja `UNRESOLVED`, u jednoj poruci korisnik prvi put kaže „Potrebna su dva čoveka, 12000 RSD ukupno” i model istovremeno predloži `people_needed` i cenu. | Skica može prihvatiti broj ljudi, ali cenu ostavlja `UNRESOLVED` i traži zasebnu, jednostavnu potvrdu RSD cene. Ovo je poznat UX trošak fail-closed parsera, ne dokazano prirodan završni tok. |
| C06 | Posle C01 eksplicitno „ponude” uz samo `need.price_mode=OFFERS`. | `OFFERS_READY`, nijedan aktivan amount/basis; `AFTER_ACCEPT` sa `proof_expected_mode=OFFERS` i praznim `proof_new_price_rsd`/`proof_expected_price_basis` proverava sačuvani Need `OFFERS` bez RSD iznosa ili basis-a, novu DRAFT reviziju i `NORMAL`. |
| C07 | Novi/ranije prepared review pre C01, zatim korekcija. | Raniji accept je stale; tokom `UNRESOLVED` oba prepare puta imaju `canAccept=false` i prompt. |
| C08 | Direktan draft save, inner edit save, authenticated v2 wrapper, kanonski publish tokom pending. | Novi write odbijen; isti pređašnji idempotentni receipt samo se čita. Drugi vezani razgovor ne može zaobići Need-locked pending marker. |
| C09 | C01 nad PUBLISHED ili SELECTION Need-om. | Claim odbijen `PRICE_CORRECTION_REQUIRES_REPLACEMENT`; ne tvrdi da je stara objava povučena. Novi task ID čeka drugi ugovor. |
| C10 | Drugi nalog, anon, direktan UPDATE AI stanja/fakta. | Nema owner claim/review/publish ni direktnog UPDATE; ACL/RLS i SQLSTATE su zabeleženi. |
| C11 | RSD mode bez amount-a, OFFERS sa amount-om, više ljudi bez izričitog basis-a. | Review/publication odbijaju nedoslednost. |
| C12 | Posle nove kolone izvršiti retention/erasure fixture i readback oba binding-a. | `retention_ai_source_ready=true`, closure i erasure binding non-NULL, izbrisani AI razgovor nema zaostalo CUR01 stanje. |
| C13 | Posle `RSD_READY=12000` vlasnik kaže „ne 12000 nego 15000 RSD”, a model vrati samo amount; posebno ponovi „15000” bez jedinice. | Claim prvo superseduje stari price triple i vraća `UNRESOLVED`; nepotpun ili nepotkrepljen predlog ne može zadržati staru READY cenu. Potrebna je nova jednostavna izjava sa RSD i kompletan predlog. |
| C14 | „Trošak materijala 500 RSD”, „materijal 500 RSD, za rad 12000 RSD”, „15 000 RSD” i „12000 RSD, 500 RSD za gorivo” u pending ceni. | Nema `RSD_READY`, modelov prvi/sporedni broj ne postaje task price. Nezavisni validni fakti se mogu sačuvati, uz novo pitanje za cenu. |
| C15 | Kasniji price signal u `OFFERS_READY` ili `RSD_READY`, i kontrolni turn „datum 2026” dok je READY. | Korekcija poništava prethodni READY pre provider-a; kontrolni datum može konzervativno izazvati dodatno pitanje. To je poznata UX cena fail-closed skice i mora se proveriti pre prihvatanja. |
| C15A | Svež `RSD_READY=12000/TOTAL` za više ljudi, vlasnik šalje „ipak po osobi”; ponoviti iz `PER_PERSON` sa „ipak ukupno”. Kontrola: „potrebna su 2 čoveka” i `C05C` mešovita izjava. | Obe cele basis korekcije daju `AFTER_BASIS_ONLY_CORRECTION`: `UNRESOLVED`, nula aktivnih price ključeva, stari DRAFT Need netaknut i review/publish odbijeni. Kontrolna sporedna količina od 1–2 cifre ne pali novi signal; mešovita `C05C` i dalje traži pojašnjenje, ne postaje READY. |
| C15B | Svež `RSD_READY`, vlasnik šalje samo „20” ili „ipak 20”, bez RSD jedinice; kontrola „20 ljudi” i „12. oktobra”. | Kratka cela poruka ili izričita kratka ispravka daju `AFTER_SHORT_AMOUNT_CORRECTION`: staro READY je poništeno pre provider-a, novi RSD iznos nije potvrđen bez jedinice, review/publish odbijeni. Sporedne količine i datum u rečenici ne pale **novi** kratki signal. |
| C15C | Posle EUR korekcije, sintetički service writer dobije dva `need.price_rsd` predloga (prvi tačan, drugi različit); ponoviti dupli mode ili basis, i OFFERS dupli mode. Ovaj test mora zaobići Edge dedup da proveri DB granicu. | `AFTER_DUPLICATE_PRICE_PROPOSAL`: svi price predlozi uklonjeni, `UNRESOLVED`, nula aktivnih price ključeva, stari Need netaknut, nezavisni validni fakti mogu opstati. Nijedan drugi duplikat ne sme naknadno pobediti u writer petlji. |
| C15D | Iz svežeg `RSD_READY` zasebno poslati „to je po osobi”, „samo ukupno”, „ipak po osobi, ne ukupno”; kontrola bez basis reči: „Materijal je spakovan u dve kutije”; incidentalna rečenica sa basis rečju: „Materijala ima ukupno dve kutije”. | Svaka basis varijanta daje `AFTER_BASIS_ONLY_CORRECTION` (`UNRESOLVED`, bez aktivne cene, review/publish odbijeni). Kontrola bez basis reči ostaje READY (`AFTER_RSD_TURN`). Incidentalno „ukupno” namerno pravi lažnu pauzu, jer je signal fail-closed; zabeležiti UX učestalost pre forward porta. |

## Dvosmerna trka sa dve SQL sesije

Koristiti barijeru između stvarnih RPC poziva, ne dva poziva u jednoj sesiji.
Za claim koristi service-role kontekst, za owner review/publish potpisanu owner
sesiju. Ista dva naloga i fixture ID moraju biti u logu; `pg_sleep` sam po
sebi nije dokaz redosleda.

**Redosled A — claim dobija Need prvi**

1. Sesija A: `BEGIN`; pozove claim EUR turn-a; ne potvrđuje transakciju.
   Očitati `pg_locks` da drži conversation i Need lock.
2. Sesija B: počne kanonsku objavu ili njen Need-locked context i potvrdi da
   čeka isti Need, bez upisanog publish receipt-a.
3. Sesija A: `COMMIT`. Sesija B se odblokira i dobija
   `NOT_READY/PRICE_UNRESOLVED`, bez PUBLISHED statusa.

**Redosled B — publish dobija Need prvi**

1. Svež fixture. Sesija B: `BEGIN`; kanonski publish do Need lock-a, zadrži
   transakciju pre commit-a; proveriti PUBLISHED unutar B.
2. Sesija A: pozove EUR claim i potvrdi da čeka Need posle conversation lock-a.
3. Sesija B: `COMMIT`. Sesija A se odblokira, vidi PUBLISHED i vraća
   `PRICE_CORRECTION_REQUIRES_REPLACEMENT`; nema uspešnog claim receipt-a
   koji bi tvrdio da je već objavljena cena povučena.

Za obe trke zabeležiti `pg_locks`, rezultat svake sesije, Need status/reviziju,
active price fact set, marker, audit/receipt count. Pokrenuti zasebno stale
review accept pre/posle claim-a: ili accept serijalizovano završi pre korekcije
pa C01 povuče tu cenu, ili accept posle C01 mora biti stale.

`ISOLATED_ASSERTIONS.sql` čita C00/C01/C03/C05/C05A/C06/C05-accept i C15A/B/C/D ishode. Za njegov
poziv u provereno izolovanoj sesiji prethodno postaviti session parametre:
`cur01.proof_disposable_identity_verified=CUR01_DISPOSABLE_CONFIRMED`,
`cur01.proof_stage`, `cur01.proof_owner`, `cur01.proof_conversation`,
`cur01.proof_need`, `cur01.proof_need_revision`,
`cur01.proof_old_price_rsd` i za `AFTER_RSD_TURN` dodatno
`cur01.proof_new_price_rsd`. Za `AFTER_ACCEPT` obavezno je
`cur01.proof_expected_mode=MY_PRICE|OFFERS`; uz `MY_PRICE` su obavezni
`cur01.proof_new_price_rsd` i, kada je više ljudi, `cur01.proof_expected_price_basis=TOTAL|PER_PERSON`.
Za `OFFERS` oba dodatna parametra moraju ostati prazna. Svaku fazu pokrenuti
u novoj sesiji ili izričito resetovati prethodne `cur01.proof_*` parametre.
Oznaka nije automatska potvrda identiteta baze;
operater zasebno proverava tačan projekat/branch.
