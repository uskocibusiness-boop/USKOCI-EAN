# KOMANDA ZA CODEX — NASTAVAK ISTOG RADA, BEZ NOVOG MASTER PLANA

## AKTUELNO PRAVILO ZA NASTAVAK — POSLE INTEGRACIJE (30.10.2026)

**Tačke 4–5 u originalnoj komandi ispod su već izvršene na nivou dokumentacionog mapiranja:** `208/208` istorijskih veza je indeksirano, `77` screen ID-jeva mapirano, `44` dodatna nalaza povezana; `docs/plan/CODEX_PLAN_RADA.md` već sadrži `12.5` i sada **`12.6`. **NE ponavljati** „jednokratno mapiraj/integrisi dopunu” u narednoj Codex sesiji. To nije 208 dokazanih runtime popravki: ažuriranje konkretnog nalaza tek posle pregleda današnjeg code/SHA + test + DEV/native readback.

Novi PRODUCT/UX kanon je [tačan master 29.10](../../product/USKOCI_PRODUCT_UX_MASTER.md); izvršni autoritet je samo [CODEX master §11.2a i §12.6](../../plan/CODEX_PLAN_RADA.md). Četiri taba, MAX 6 fotografija (1–3 preporuka), signup bez obaveznog grada, jedna zajednička reputacija naloga i `/arhiva` compatibility redirect su **već zaključane odluke**; ne tražiti istu odluku ponovo, ali ne tvrditi da je implementacija već završena.

Prvi sledeći tehnički posao: potvrdite aktuelni HEAD/CI; R06 LOCAL_ONLY SQL parser regresije, media harness/fixture i nov Full CI; R01 pravi Auth/PostgREST i PG17 strict parity nezavisno. R10/DEV/native/release ostaju zasebni gates. Nema drugog master plana i nema source/SQL/Edge/apply promene iz samog ovog istorijskog dokaznog paketa.

### Istorijska komanda — za kontekst, obavezno tumačiti po novijem masteru



Ovo je dodatni dokazni paket, ne novi izvršni plan. Operativni plan je samo `docs/plan/CODEX_PLAN_RADA.md` na `work/rev14-review-f17` (PR #43). Pre rada proveri remote HEAD, `git status`, poslednji dovršeni CI, §11.2a i konkurentne izmene; ne resetuj i ne prepisuj ništa.

1. U radnom folderu gde je ovaj paket raspakovan pokreni `python alati/proveri.py` i utvrdi `PASS`. Ne zahteva mrežu, deploy, model, DB write.
2. Pročitaj `PROCITAJ_PRVO.md`, `STATUS_I_NALAZI.md`, `DOPUNA_JEDINOG_MASTER_PLANA.md`, `indeksi/POVEZANI_NALAZI.json`. Za zadatak pozovi `python alati/kontekst.py R04 --repo /checkout` (ili SV04, C10, UI:UI-CONTRACT-01, SCREEN:taskDetail). To prikazuje tačne dokumente i stare sha; ne čitaj svih 439 iznova.
3. Izvrši source-drift kontrolu `python alati/drift.py /checkout --tasks R01,R04,R06,R09,R10` i sačuvaj rezultat. Stari SHA na `a9692e1` nije današnji SHA.
4. Jednokratno veži 44 dodatna nalaza MARKET:M01–M24/ACCOUNT01–ACCOUNT10/CAL01–CAL06/UI-CONTRACT-01–04 i 77 screen ugovora za postojeće R/C/SV bez menjanja usvojenog Product/UX kanona. Status po nalazu: `SOURCE_REPAIRED_CI_VERIFIED`, `SOURCE_PRESENT_UNPROVEN`, `ACTUAL_GAP`, `SUPERSEDED`, `DECISION_REQUIRED`. Sa svakim id navedi konkretan current source, test i/ili server readback. Sam istorijski zapis ne potvrđuje aktuelan bug.
5. Dopunu §12.5 iz `DOPUNA_JEDINOG_MASTER_PLANA.md` integrisi U POSTOJEĆI master tek nakon rebase-a na poslednji GitHub HEAD i provere aktuelnog kanona; ne zamenjuj kompletan `CODEX_PLAN_RADA.md`, ne briši §1–§12 ni postojeći dnevnik. Ažuriraj §11.2a samo stvarnim novim dokazima, a ne datim istorijskim statusom. Ne pravi konkurentski master, PDF ili pet novih planova.
6. Nastavi stvarni R01–R12/C/SV rad: prvo full CI na aktuelnom source, korekcije stvarnih regresija, R06 durable FIRST-PLAN i R01 Auth/PostgREST/PG17; paralelni nezavisni R02–R09/Edge rad po zavisnostima; R10 closure i R12 fizički Android E2E pre release-a. Ne vrti isti nepromenjeni test pet puta.
7. Kritično: `MARKET:M04/UI-CONTRACT-01` Proveri vs writer, `ACCOUNT02` partial Push save, `CAL05` nedostajući closure reason, `MARKET:M20` javni URL, `PHOTO_LIMIT` 1–3 vs 6, i `MARKET:M01/M03` recovery: razjasni aktuelni kod/test/odluku; ne menjaj globalno 6 fotografija ili unos podataka zbog starog briefa.
8. GitHub, Supabase i aplikacioni kod smeju se menjati samo u opsegu korisnikovog poslednjeg odobrenja i postojeće implementacione politike. Ne primenjuj SQL ili Edge na DEV/PROD bez posebne provere kompatibilnosti i odobrenja. Ne tvrdi PASS bez odgovarajućeg SHA i run ID-ja.
9. Na kraju izvuci tabelu: ID | istorijski izvor/pointer | stvarni live source | šta je menjano | test/CI | DEV/native dokaz | status | sledeći posao. Ako je korak blokiran, nastavi nezavisan.

Važne usvojene odluke: jedan nalog/obe uloge, četiri glavna taba i Profil nije peti tab, persiranje Vi, stariji istorijski `ti` tekst nije izvršni autoritet, slogan `USKOČI — Vaš partner za svaki zadatak`. Ne petljati dizajn u ovom tehničkom krugu.
