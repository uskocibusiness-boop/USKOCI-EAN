# Worker AI oprema — lokalni kandidat, nije aktivan

**21.10.2026.** Predlog u [`proposal.patch`](proposal.patch) je napravljen i sintetički proveren, pa izdvojen iz aktivne Edge funkcije. `supabase/functions/uskoci-worker-interview/index.ts` i njegov važeći `v5_worker_edge.test.mjs` vraćeni su na početni HEAD. Nema DEV/prod objave, migracije ni promene signed review-a. Ovaj kandidat ne menja područje rada, kalendar, usluge/način izvršenja ili AI safety status. Zakrpa ima nula redova konteksta: njena provera i eventualna primena zahtevaju `git apply --unidiff-zero`.

## Namena i provereni deo

U trenutnom MVP razgovoru AI ne bi trebalo da pita za alat/vozilo niti da pravi nove zakrpe `tools`/`vehicles`. Predlog pooštrava provider uputstvo i opise u shemi, a pre `rpc_complete_worker_ai_turn_service` uklanja **samo** ta dva ključa iz zakrpe. Ako ih model ipak predloži uz `ALLOW`/`CLARIFY`, zamenjuje potencijalno netačnu potvrdu neutralnom porukom i zadržava samo zasebna pitanja koja jasno ne govore o opremi. `REVIEW`/`BLOCK` zadržavaju safety i odgovor; njihova zakrpa opreme se takođe izostavlja. Ostali ključevi zakrpe ostaju.

Postojeća oprema se ne uklanja iz vlasničkog kandidata. U postojećem SQL-u `private.worker_ai_patch` preskače odsutne ključeve (`20260912220506_clean_v5_owned_worker_profile.sql`, redovi 111–118). `rpc_save_worker_ai_review` i dalje upisuje `tools`/`vehicles` iz celog potpisanog kandidata (redovi 418–426). Zato istorijska neispražnjena oprema mora ostati vidljiva u završnom potpisanom pregledu dok se serverski ugovor ne izmeni. Skrivena obična profilna površina nije dokaz da je Save prestao da upisuje te podatke.

Sintetički Edge proof sa primenjenim kandidatom: `node --test supabase/proofs/ai/v5_worker_edge.test.mjs` → **84/84 PASS**. Pokriva očuvanje nepovezanih `skills`/`bio` zakrpa, zasebnog pitanja, postojećeg equipment kandidata i `REVIEW`/`BLOCK` statusa. `npx tsc --noEmit --pretty false` i ciljani `git diff --check` imali su exit 0. Ovaj test ne izvršava PostgreSQL Save, Gemini ni prikaz na telefonu.

## Razlog za zadržavanje van aktivnog toka

Tekst `patch.bio` može sadržati novu tvrdnju o opremi čak i kada su `patch.tools` i `patch.vehicles` uklonjeni. Ne postoji pouzdana uska tekstualna zaštita koja bi iz biografije uklonila samo tu činjenicu, a sačuvala nezavisnu uslugu, lični opis i ograničenje. Model može i da postavi pitanje o opremi bez opremne zakrpe; prompt i korekcija vezana za zakrpu to ne garantuju. Jedno složeno pitanje koje spaja opremu i grad ne može se bezbedno razdvojiti jednostavnom obradom teksta. Zbog tih rupa predlog **nije spreman za DEV objavu** kao potpun MVP ugovor.

Pre aktiviranja treba definisati pravilo za novu opremu u slobodnom tekstu i odgovorima, sačuvati i prikazati istorijsku opremu u signed review-u, a zatim dokazati stvarni DB readback/Save i živi Gemini tok. Eventualna promena da Save više ne prepisuje opremu traži poseban forward RPC/migration ugovor; odsustvo polja u klijentskom prikazu samo po sebi nije dovoljno. `REQ-05J-02` i `REQ-05K-04` ostaju otvoreni za proveru.

Stariji `supabase/proofs/dynamic_taxonomy/worker-interview-question-policy.test.mjs` trenutno daje 1/9 PASS jer očekuje fraze i route sintaksu kojih nema ni u početnom HEAD-u. Taj zastareli test nije menjan u ovom kandidatu.
