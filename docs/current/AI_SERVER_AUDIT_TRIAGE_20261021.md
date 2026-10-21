# AI/server audit 21.10.2026 — aktuelni presek i granica primene

Ovaj zapis proverava dostavljeni `USKOCI_AI_SERVER_AUDIT_20261021.md` prema novijem izvoru i živom DEV-u. Audit je čitao commit `3a0d33eb`; na početku ove provere grana `feature/unified-qa-master-20261017` bila je na `30ada333`. Provereni izvorni Worker paket potom je stigao do `220352fdc9ba578c78ad2dd9d533cd15d6ee4f4b`. Ne tretirati staru oznaku HEAD-a kao aktivni Edge paket.

## Izvori istine

| Sloj | Potvrđeno | Granica dokaza |
| --- | --- | --- |
| GitHub | Na početku kruga lokalni i remote HEAD bili su isti `30ada333`. Izvorni Worker paket i naknadna ispravka tipova poslati su do `220352fdc9ba578c78ad2dd9d533cd15d6ee4f4b`; [source CI 39568791426](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39568791426) je uspešan baš za taj SHA. | Source CI nije potpisani DEV razgovor, Save, DB assertions niti dokaz APK-a. |
| DEV AI | Radni AI je ACTIVE v73, 18/18 fajlova jednako početnom HEAD-u `30ada333`. Task AI je ACTIVE v119, 19/20 fajlova jednako tom izvoru, ali `index.ts` se materijalno razlikuje. | Novi izvorni worker guard menja dva zajednička fajla posle ovog poređenja; nije deo v73. Poređenje paketa nije potpisani razgovor/Save. Ne objavljivati novi Task paket kao običan sync. |
| DEV SQL | Poslednja migracija `20261021014849`; taxonomy review projection telo MD5 `f9318f476e32a8233fbb07ccf5d22aeb`. `retention_ai_source_ready()=false`, `closure_erasure_binding_v5()=null`. | SQL readback nije izvršena migracija niti E2E brisanje. |
| Lokalni F01 | `supabase/candidates/closure-f01-rebase-20261021/` sadrži nepotpun readback, `certified:false`; nema izvršivog forward kandidata. | Repo je javan, pa se pune žive definicije ne dodaju automatski u Git. |

## Nalazi i sledeći povezani paketi

| ID | Stanje | Dokaz / potreban ishod |
| --- | --- | --- |
| AI-01 Jedna usluga, više mode-ova | Izvorni Edge guard i testovi dodati; DEV i SQL ostaju otvoreni. | Pre izmene su `supabase/functions/_shared/classificationGeminiShadow.mjs` i aktivna `private.taxonomy_review_candidate_projection_v2` proveravali servis/mode pojedinačno. Novi Edge guard odbija različit canonical ID ili novu parent/path putanju pre zadržavanja hintova, uključujući stare divergentne saved ID-jeve. Server projection je još aktivni stari kod. |
| AI-02 Sačuvan profil po usluzi | Potvrđena praznina klijentskog readback-a. | `src/ui/workerProfile/WorkerProfileSaved.tsx` prikazuje skills uz globalni mode sažetak, ne per-service binding/handoff. Potreban owner-scoped server read model, pa tek onda istinit UI status SAVED/ACTIVE/matching-ready. |
| AI-03 Oblast rada | Area V2 nije aktivna. | `docs/candidates/worker-area-v2-sql/INTEGRATION_GATE_20261021.md`; V1 je jedan city/country/radius i zahteva potvrđen centar za stvaran radius. Više gradova/„cela Srbija” traži čitav signed Save → matcher → requeue put. |
| AI-04 Vreme | Statički potvrđen nesklad, runtime slučaj otvoren. | Dostavljeni audit poredi `need_search_time_admitted_v1`, `expire_lifecycle` i `rpc_discovery_v1`; tada je bilo 0 pogođenih DEV zadataka. Uskladiti search cutoff, javni acceptsApplications, prijavu, expiry i već sklopljen Dogovor pre SQL primene. |
| AI-05 Srodni matching | Aktivni exact scope gate blokira ne-exact fallback. | `taxonomy_match_scope_control_v1` je bio uključen u auditovom DEV preseku; ne isključivati ga. Sam parent nije dokaz kompetencije. |
| AI-06 Mesto/predaja | Dve read-only probe potvrđuju rupu. | `Novi Sad`/`Novom Sadu` nije isti u aktuelnom handoff helper-u; sintaksički `ZZ` prolazi. Potrebni kontrolisani locality/country ID-evi i odvojen ugovor za prisustvo klijenta kod pružaoca. |
| AI-07 Rok za prijave | End-to-end nije aktivan. | Fact registry/review RPC/feature flag i edit writer nemaju zajednički set/change/clear ugovor; ne uključivati samo flag. |
| AI-08 Cena i valuta | P0 pre novog Task Edge deploy-a. | `docs/current/TASK_CURRENCY_MVP_GATE_20261021.md` i `docs/candidates/task-currency-followup-20261021/ATOMIC_SERVER_CONTRACT.md`: stara prihvaćena RSD činjenica može preživeti naknadnu EUR korekciju. CUR01 je samo rollback-only statički kandidat. |
| AI-09 Brisanje/zadržavanje | P0 release gate zatvoren. | `docs/current/ACCOUNT_CLOSURE_DEV_GATE_20261021.md`; traži puni program/source digest, stvarni export/erasure dokaz i tehničku recertifikaciju, a ne ručno presnimljen hash. |

## Redosled primene

1. Fail-closed Edge zaštita AI-01 je napisana i povezanih osam Node datoteka daje **393 PASS / 0 FAIL / 1 postojeći TODO** (394 testa; 21.10.2026). Testni runtime za Task AI imao je zastarelu import mapu za već postojeći `taskApplicationDeadline.ts`; ispravljena je samo mapa testnog okruženja u `supabase/proofs/ai/owned_intake_edge_runtime.mjs`. Ovo potvrđuje izvorni kod, ne DEV v74: za primenu još treba kompletan paket i potpisana izolovana QA proba. Nisu automatski ispravljeni stari hints/review redovi.
2. [Rollback-only SQL predlog](../../supabase/candidates/taxonomy-cross-mode-20261021/README.md) postoji kao izvor, sa statički parsiranim SQL/PLpgSQL fajlovima. Nezavisan pregled je našao i zatim ponovo proverio usklađenost konfliktnih `PENDING` odgovora sa klijentskim decoder-om; test koji nije dostizao novi guard uklonjen je. PostgreSQL assertions nisu izvršene i nema DEV migracije. Review i reviewed-batch guard za AI-01 zahtevaju celovit F01/closure preflight i izolovan izvršni dokaz. Sama provera sintakse nije DB PASS.
3. Task AI lokalni `index.ts`, CUR01 i Area V2 se ne deploy-uju kao samostalan sync dok atomski ugovori, gate i potpisane probe nisu spremni.
4. Posle stvarne primene čitati tačan Edge paket, SQL telo/ACL i rezultat signed QA scenarija. APK/telefon su zaseban dokaz.

Ovaj dokument je trijaža dostavljenog audita i aktivnih granica. Status pojedinačnih izvršenja dodati posle provera; ne koristiti broj lokalnih testova kao procenat gotovosti proizvoda.

## GitHub provera posle izvornog commita

Paket je poslat na `feature/unified-qa-master-20261017` kao `0239ad9bb42da5ac390928b6ad9a888c80dcbeb5`; dodati source CI kao `7d663c387fea3ab7a3e62497b01850ca43e505f5` i Deno tipna ispravka kao `220352fdc9ba578c78ad2dd9d533cd15d6ee4f4b`. Remote SHA je ponovo očitan i jednak poslednjem izvornom commitu. Postojeći W03 source workflow, run `39567510614`, stao je na istorijskom `SOURCE_PROVENANCE_INVENTORY_MISMATCH`: njegov zaključani izvorni popis očekuje stariji skup migracija, dok aktuelni checkout sadrži kasnije taxonomy i AI history migracije. To nije PASS ovog paketa i ne opravdava promenu istorijske evidencije.

Za sadašnji worker izvor dodat je [.github/workflows/worker-ai-cross-mode-source.yml](../../.github/workflows/worker-ai-cross-mode-source.yml): Node/TypeScript/Deno izvorna provera bez APK-a, DEV upisa ili zamene istorijskog W03 dokaza. Prvi run `39567940295` je našao šest tipnih grešaka u Worker handler-u; minimalna tipna ispravka je prošla [ponovljeni run 39568791426](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39568791426), uključujući Deno check, TypeScript, migracije i osam povezanih testnih datoteka. Provera pripada commitu `220352fd`; ne prenosi se automatski na kasnije izmene izvora.

## Potpisana DEV proba — preflight 21.10.2026.

Pre promene QA lozinke, [skripta](../../scripts/acceptance/set_dev_qa_password.ps1) sada proverava tačan Auth ID i email. Stvarni read-only admin GET vratio je 404; nezavisan tačan `auth.users` upit vratio je nula redova za taj ID/email. Proba je završila **pre PUT zahteva**, bez promene naloga. Nedostaje i lokalni DPAPI credential store, pa postojeći potpisani acceptance harness ne može da posluži kao dokaz novog Worker Edge-a. Read-only budžetski presek pokazuje aktivne testne naloge, `reserved_microusd > ceiling_microusd` i `reservation_cap_enforced=false`. To ne dokazuje da je nov provider poziv blokiran, ali zahteva jasnu proveru testnog troška i politike pre pokretanja. Zato Worker source ostaje na GitHub-u, a DEV v73 nije zamenjen. Za usku DEV primenu potrebni su svež namenski QA nalog sa potvrđenim testnim pristupom, sačuvan kompletan v73 rollback paket i ciljano potpisano ON_SITE+REMOTE review/Save/readback ispitivanje.
