# USKOČI — šta postoji u GitHubu, a nije instalirano na DEV (12.10.2026)

**Svrha:** izvršni, read-only inventar `uskocibusiness-boop/USKOCI-EAN`, PR #6 (`fix/match-ai-category-fallback-20261010`) prema kanonskom Supabase DEV projektu **`leqcwgzvjsxugfgzdmth`**. Ovaj dokument ne odobrava deploy, ne šalje obaveštenja i ne pokreće SQL izmene.

## 1. Edge Function razlike: provereno direktnim poređenjem glavnog index.ts

- **Identično (9):** uskoci-ai-interview v61; uskoci-publication-evaluate v19; uskoci-qa-classify v18; uskoci-location-search v19; uskoci-speech-session v20; uskoci-data-export-worker v19; uskoci-data-export-download v19; uskoci-media v19; uskoci-account-closure-worker v9.
- **Različito (2):**
  1. `uskoci-worker-interview` v23: GitHub ima import `AI_CREDITS_UNAVAILABLE/AI_DIAGNOSTICS_*`, poseban `GeminiCreditsUnavailableError`, precizniju `safe_error` granu i prirodniji prompt za razgovor. Live još koristi opštu grešku `AI_TURN_NOT_CONFIRMED` i raniji prompt.
  2. `uskoci-push-transport` v28: GitHub prihvata `eventId` i za `OPPORTUNITY_AVAILABLE` samo kad je zahtev prethodno server-side targetiran i važi dodatna zastavica `EXPO_PUSH_OPPORTUNITY_TARGET_ENABLED=true`; live prihvata tu nadogradnju samo za `MESSAGE_RECEIVED`. GitHub verzija nije provider/prod send dokaz.

**Granica provere:** poređen je glavni `index.ts` svake Edge funkcije; ne tvrdi se automatski jednakost svih importovanih fajlova, podešavanja, tajni i provider statusa.

## 2. SQL kandidati: prisutnost vs. instalacija

`supabase/proofs/deploy_inventory/dev-actual-vs-repo-readonly.sql` je izvršen protiv DEV sa rezultatom **14/14 expected source-body hashes match, 0 drift, 0 missing**. Među njima: novi matcher, vreme, deadline, sedam start-only task API / state funkcija, targeted-push prijem/admission/begin send, stale ticket worker. Ove funkcije JESU na serveru i njih ne treba automatski ponovo primeniti.

**Evidencioni dug:** poslednja Supabase zabeležena migracija ostaje `20261009172613` (238 ukupno). Naknadni deploy SQL kandidata dogodio se bez urednog novog migration recorda. Pre PROD migracije izgraditi kanonski redosled iz tačnih source hash-eva i saopštiti pravila idempotentnog ponavljanja; ne upisivati lažne migration recorde.

## 3. Dinamička taksonomija — nije puštena

- Trenutni DEV: `work_kinds_head` navodi **11** vrsta posla; `private.work_kinds_v5` je hardkodirano zatvorenog skupa. **0 `private.work_taxonomy%` tabela, 0 `taxonomy_%` funkcija.**
- U GitHubu postoje `supabase/candidates/dynamic-taxonomy-20261011/` katalog, aliasi, parent/subkategorije, veriﬁkovane relacije, potvrđene sposobnosti radnika, snapshot revizija zadataka, audit, risk triage, AI pregled i source-only preview. Izolovani PostgreSQL proof PASS.
- NEDOSTAJE za siguran deploy: pouzdan Auth/owner/revision trust gateway, kontekstualna semantika i regulisani poslovi, istorijsko mapiranje starih 11 kategorija i radnika, potvrda korisnika, integration with live `private.worker_need_fit_v1`, geo/time/closure/ACL, zero-match diagnostics, izolovan E2E, stabilna migracija/rollback. **Ne primenjivati sam `catalog-foundation.sql` i ne uključivati auto_registration_enabled.**

## 4. Dokazano ograničenje starog matchinga

Read-only DEV `private.work_kinds_v5` vraća:
- `Popravka laptopa` → `SITNE_POPRAVKE`
- `Popravka 3D štampača` → `SITNE_POPRAVKE`
- `Podešavanje 3D štampača` → prazan niz
- `Dresura pasa` → prazan niz.

Zato staro implicitno sinonimsko spajanje može pružiti previše široko pravo na dispatch između različitih vrsta popravke. Test `supabase/proofs/match_category_fallback/novel-category-dispatch-gap.sql` demonstira poznatu široku kategoriju i zasebno proverava exact novi radnički skill prema nepoznatoj kategoriji, kroz stvarni matcher i dispatch u disposable PostgreSQL-u. Ovo **nije** validacija automatskog kreiranja novih kategorija.

## 5. Redosled otklanjanja prepreka (bez slepog deploya)

1. **Taxonomy core:** u izolovanoj PostgreSQL/Supabase E2E kopiji završiti actor-bound klasifikaciju, registraciju novih work identity (ID umesto sirovog teksta), provereno mapiranje starih task/worker sposobnosti, trajne revizije, audit/rollback i zaštitu od duplicate/homonym/prompt injection. Feature flag ostaje OFF.
2. **Matcher & dispatch:** eliminisati generičko spajanje nepovezanih vrsta poslova; semantička sličnost neka vrati predlog, ne push dozvolu. Sačuvati lokaciju, vreme, isključenja, required-skills, vlasništvo i zaštitu od duplog slanja.
3. **Workers/AI:** aktivirati potvrdu specifičnih sposobnosti radnika (review ≠ save ≠ activation); istovremeno testirati GitHub promenjen `uskoci-worker-interview` Edge kod.
4. **Push:** uraditi bounded SQL/Edge integration i test tačnog uređaja/poruke na HONOR-u pre promene `uskoci-push-transport` i uključivanja feature gate-a.
5. **Release:** formalizovati migracije, održati on-device preview APK/OTA proof, zatim posebni produkcioni projekat. Nikada ne usmeravati STORE profil ka DEV-u.

## 6. Precizne granice ovog inventara

- GitHub PR #6 je draft i nije spojen u glavnu granu.
- READ-ONLY proverom nisu slani masovni push događaji, nije menjan Supabase i nije potvrđena funkcionalnost produkcionog APK-a.
- Ne tvrditi da 30.000 istovremenih stvarnih korisnika radi: isolated 30k workload testovi nisu live HTTP/Auth/FCM/Dogovor proof.
