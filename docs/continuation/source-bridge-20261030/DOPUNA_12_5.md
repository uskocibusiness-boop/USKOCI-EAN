### 12.5. Kontinuitet izvora REV13/REV14 FULL i dodatni funkcionalni nalazi (preporučena dopuna)

> **Ovaj odeljak je predlog za INTEGRACIJU u POSTOJEĆI `docs/plan/CODEX_PLAN_RADA.md`, nije drugi master i ne predstavlja potvrdu implementacije.** Pre unošenja proveriti tekući HEAD i razlike od 30.10.2026.

**Poreklo:** REV10 139 fajlova, REV13 896, REV14 FULL 908. Svih 132 prvobitna dokazna fajla iz REV10 ostala su byte-identična u REV13/REV14, a REV14 nasleđuje svih 896 REV13 fajlova. GitHub continuation paket od 305 fajlova čuva REV10, uži UX REV14 i execution evidence, ali **ne** celu zasebnu REV14 FULL arhivu. Predana radna arhiva `USKOCI_CODEX_BRIDGE_KOMPLET_2026-10-30.zip` sadrži sve tekstualne/strukturisane izvore potrebne za trenutno ciljano usaglašavanje; istorijski renderi i fontovi nisu u radnom paketu. Pre korišćenja proveriti hash manifest, a pre bilo kakvog upisa radnu granu i PR.

**Stalni izvori, ne paralelni planovi:**
- `dokazi/registar/consolidated_read_register.json`: bazni popis 3.434 putanje, 3.335 tekstualnih fajlova, 626.320 linija i 680 ondašnjih tela SQL funkcija; istorijski SHA `a9692e...`.
- `dokazi/izvrsivost/readiness_review.json` (Z10): 12 R zadataka, 42 F/SB/X nalaza, C01–C19 i `normalized_path_index`.
- `dokazi/namena_i_testovi/intent_review.json` (Z09): namere, korisnički tokovi, CI/test/decision matrice.
- `dokazi/server_final/change_manifest.json` (Z16): SV01–SV14, 3.037 inventarskih serverskih objekata, ACL/owner/provenance/diff.
- `dizajn/spec/screen_contracts.json`: svih 77 proširenih istorijskih screen ugovora; `UX_PRODUCT_MASTER_REV14/USKOCI_SURFACE_MAP_REV14.json`: istih 77 ključeva u novijoj konsolidaciji.
- `dokazi/ui_ux_rev12/MARKET_AGREEMENT_UX_REVIEW.json` (M01–M24), `ROOT_ACCOUNT_UX_REVIEW.json` (ACCOUNT01–10), `CALENDAR_UX_REVIEW.json` (CAL01–06), `dokazi/ui_ux_rev11/IMPLEMENTATION_DELTAS.json` (UI-CONTRACT-01–04). Ova **44 nalazi** nisu automatski 44 aktuelna kvara; izvorni `POVEZANI_NALAZI.json` daje predlog vezivanja uz postojeće R radove.

**Obavezna metoda pre izmene:** (1) identifikovati R/SB/X/C/SV i eventualno M/ACCOUNT/CAL/UI-CONTRACT relevantni trag; (2) otvoriti konkretan JSON pointer u pratećem izvoru i staru SHA; (3) pročitati aktuelni reader/writer, zavisnosti i test; (4) uporediti sa starom specifikacijom i novijim vlasničkim odlukama; (5) uraditi najmanju ispravku + pozitivni/negativni test + dostupni DEV/readback; (6) zapisati SOURCE / CI / DEV / NATIVE odvojeno u postojeći §11.2a. Ako je izvor zastareo, zabeležiti superseded i zašto. Ne prihvatati stari PASS kao current-SHA PASS.

**Posebne otvorene semantičke provere:**
- `MARKET:M04/UI-CONTRACT-01 → R09/R11c`: Unknown chat Proveri mora biti read-only provera kada je takav ugovor; danas statički poziva outbox.retry/dispatch, ali isti immutable ID ne dokazuje duplikat. Odvojiti proveru od explicit retry uz scope/idempotency/abort negativne testove.
- `ACCOUNT02 → R09`: dve uloge u PushPreferences sekvencijalno se upisuju i čitaju; dokazati parcijalni commit, lost ACK, Back i restart pre atomarnog obećanja.
- `CAL05 → R11e/R03`: arhivski filter ne može pouzdano razvrstati nepostojeći closure reason; prvo dokazati server reader pre promene filtera.
- `M20 → R12`: javno deljenje nema dokazani URL; ne kreirati lažan link.
- `PHOTO_LIMIT`: stariji predlog zadatka 1–3 naspram trenutnog shared 6 je **otvoreno pravilo proizvoda**, ne automatski bugfix.
- `MARKET:M01–M24`, `ACCOUNT01–10`, `CAL01–06`, `UI-CONTRACT-01–04`: svi imaju tačne pointere u prenosnoj evidenciji; svaki proveriti po najbližem R zadatku bez izdvajanja novih 44 projekata.

**Ne menjati važeće:** bez petog donjeg taba Profila, bez vraćanja globalnog role switch-a, UI persira Vi, bez vraćanja starih `ti` kopija i demo prototipova kao runtime istine. Ne brisati 130 dokaza ni istorijske migracije. Bez prikrivenog DEV/PROD apply-a i bez promene Gemini naplate tokom usaglašavanja.
