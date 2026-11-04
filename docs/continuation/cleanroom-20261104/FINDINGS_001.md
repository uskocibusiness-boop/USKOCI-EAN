# CLEANROOM — dokazani nalazi prvog prolaza (04.11.2026)

**Ovo nije novi master i nije odobrenje za brisanje.** Jedini izvršni plan je `docs/plan/CODEX_PLAN_RADA.md`, a jedini Product/UX izvor `docs/product/USKOCI_PRODUCT_UX_MASTER.md`.

**Posebna grana:** `work/uskoci-cleanroom-audit-20261104`.  
**Provereni commit:** `b24f403eac2697633d3a7e66804a270a9edf5bc3`.  
**Polazni commit:** `839dd0a30228fbc34d46337e66449c053be434ea`.  
**Izvršni dokaz:** [GitHub Actions 41812439068 — SUCCESS](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41812439068). Artifact: `uskoci-cleanroom-all-files-evidence` (CSV/JSON inventar, izvorni graf, reference, podaci o testovima; dostupnost artifacta ograničena retencijom).

## Precizan obuhvat

| Status | Rezultat i njegova granica |
| --- | --- |
| Praćeni izvori | **3.899/3.899** fajlova u indeksu, svi provereni prema Git blob otisku |
| JS/TS statički pregled | **2.073** fajla obrađeno parserom; to nije poslovna/bezbednosna revizija |
| JSON | **433** ispravno parsirana, nijedan nevalidan |
| Python | **91/91** sintaksno pravilno |
| Statistička mreža lokalnih referenci | **9.066** statičkih veza, **69** dinamičkih referenci koje traže posebnu proveru |
| Mobilni regresioni skup | **629/629** celina, **14.618/14.618** testova prošlo |
| TypeScript, izabrani AI Edge ugovori i Android Hermes Metro export | **PASS** — bez tvrdnje o live Gemini, DEV, APK instalaciji ili dvokorisničkom toku |
| Semantički kompletno pregledani fajlovi | **0 od 3.899** sertifikovano u ovom automatskom prolazu. Dubinska revizija po funkcionalnim domenima tek sledi |

## Razjašnjeno: 55 nerazrešenih statičkih referenci NISU 55 potvrđenih kvarova

Statički parser je prijavio 55 referenci koje nije mogao da poveže sa praćenim fajlom.

- **41 referenca** koristi `new URL('./', import.meta.url)` ili drugu putanju direktorijuma. To nije obično uvoženje modula i ne predstavlja samo po sebi kvar.
- **12 import-referenci** u starijim server/proof fajlovima upućuje na četiri odsutna modula: `scripts/ci/owned-intake-source.mjs` (9 poziva), `scripts/proofs/build-p6-rollout-v3.mjs`, `scripts/ai_review_fixture.mjs`, `scripts/task_detail_read_preflight.mjs` (po jedan). Ti konkretni dokazni postupci nisu potvrđeni kao funkcionalni; pre popravke ili arhiviranja treba proveriti da li su još aktivni i iz koje istorijske verzije treba uzeti odgovarajući ugovor.
- **2 ostale reference** upućuju na odsutan istorijski GitHub workflow i na `week-cases.json` iz `scenarios.inc.mjs`. Druga je fragment umetnut u drugi skript, pa relativnu putanju treba proveriti u izvršnom kontekstu; ne prepisivati je naslepo.

**U aktivnim mobilnim `src/` modulima u ovom statičkom prolazu nije evidentirana nerazrešena lokalna referenca.** To nije dokaz da su runtime integracije ispravne ili da nema problema sa dinamičkim importom.

## Stvarna dupliranja i naredni pregled

Pronađeno je **40 grupa bajt-identičnih Git fajlova**, pretežno istorijskih SQL kandidata, zamrznutih verzija Edge funkcija i migracija. Potreba za njima zavisi od testova, rollback-a i istorije; zato `deletionApproved=false` za svaku pojedinačnu datoteku.

Prvi prioriteti po aktuelnoj izvornoj složenosti: `src/ui/v2/DiscoveryPresentation.tsx` (134.051 bajt), `supabase/functions/uskoci-ai-interview/index.ts` (112.717), `src/ui/AgreementChat.tsx` (60.619), `src/ui/aiFirst/AiConversationShell.tsx` (58.852). Veliki fajl nije sam po sebi bug. Potrebna je ručna provera odgovornosti, ponovljenih logika, korisničkih tokova i performansi.

**Otvoreno pre oznake ZAVRŠENO:** dva realna AI intervjua sa save/readback, R01 privatnost i Auth/PostgREST, matching i cena, Dogovori/Poruke/mediji/push, R10 izvoz/brisanje, potpisani Android sa dva naloga. U ovom prolazu nije promenjena nijedna poslovna funkcija, baza, Edge, SDK, EAS/OTA ili korisnički podatak; nijedan PR nije spojen.
