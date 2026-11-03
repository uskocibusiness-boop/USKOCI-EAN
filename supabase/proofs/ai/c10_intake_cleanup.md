# C10 — povlačenje neaktivnog katalog-explorer i shadow mosta, 03.11.2026.

Ograničen dokaz uz `docs/plan/CODEX_PLAN_RADA.md`, ne drugi plan.
Polazni source: `06d6dd637b3190d3643032dd17a7b3d4f429854f`, grana
`work/rev14-review-f17`, postojeći Draft PR43 prema `feature/uskoci-cisto`.

## Konkretan problem i promena

Oba aktivna interview handler-a već imaju single-pass tok. Napušteni
`classificationExplorer` i `taxonomyScopedShadow` više nemaju produkcione
pozivaoce, ali trenutni Need/Worker dokazni loader-i još unapred izvršavaju
stare alternative. Jedan isključeni source test čak zahteva vraćanje starog
explorer/tool/shadow lanca. Zeleni test takvog skupa nije dokaz stvarnog bundle-a.

Povučena su tri runtime/type fajla iz tabele i tri testa koji proveravaju samo
napuštenu strategiju. Postojeći loader-i sada izvršavaju stvarne tranzitivne
zavisnosti handler-a; nema novog runtime loader-a ili klasifikatora. Novi
`intake_module_boundary.test.mjs` preko TypeScript AST-a nezavisno računa oba
import grafa i poredi **svaki file SHA256** sa stvarno izvršenim VM fajlovima.
Proverava i odsustvo povučenih modula/Edge import-a i nezakačenih alternativnih
strategija. Ta provera je automatski u postojećem `ai/*.test.mjs` CI skupu.

`taxonomyRuntimeConfig.mjs` ima samo `taxonomyIntakeEnabled`. Povučeni su
nekorišćeni `taxonomyOptionalEnabled` i tri alternativna selektora.
**Postojeći deployment ključ `USKOCI_TAXONOMY_DUAL_GEMINI` ostaje nepromenjen**:
DEV scope, dozvoljeni project ref, HTTPS host, paid-test admission i default-OFF
ostaju isti. Interni naziv izvoza je usklađen u oba handler-a i relevantnim
testovima. Nema dodavanja novog flag-a niti menjanja server konfiguracije.

## Očuvani ugovori i zamena povučenih testova

| Raniji scenario | Sadašnji aktivni dokaz / granica |
|---|---|
| Katalog nije skraćena prva strana; invalidna hijerarhija, duplikati i zastareli snapshot ne postaju uspeh | `background_catalog_completeness`, `background_catalog_hierarchy`, `background_catalog_lifecycle`, `classification-full-catalog-edge` |
| Pravi ID, nova grana, mode/BOTH, očuvanje stare usluge i namerno uklanjanje | `single_pass_continuity`, `background_taxonomy_scope`, `background_taxonomy_failures` |
| REMOTE nije dozvola za izmišljeni pin ili handoff; novi poslovni podaci ne gube poznat scope | `background_catalog_hierarchy`, `background_taxonomy_scope`, `ai_edge_context` |
| Jedan model, bez katalog tool petlje; Save/Publish/matching/push nisu ovlašćenja razgovora | `single_pass_edge`, `classification-gemini-shadow-source` (postojeći naziv testa; već proverava single-pass) |
| Odbijen upis, prekid/lost ACK, isti rezultat i bez novog plaćenog pokušaja | `single_pass_edge`, `v5_worker_edge`; zasebni SQL/concurrency testovi ostaju nepromenjeni |
| Default-OFF, vlasništvo, paid admission, obračun i UNKNOWN nisu prečice | `taxonomy_runtime_config`, `ai_edge_context`, `v5_worker_edge`, `gemini_usage`, `ai_accounting_transport` |
| Stari SEARCH/EXACT cursori, paralelni tool query cache i scoped preview akcije | Retired-only transport detalji: više nisu sadašnji acceptance. Tačan izvor ostaje u polaznom Git commitu, ne tvrdi se da postoji novi isti tool tok. |

Primenjene SQL migracije, rollback-i, zamrznuti source/paketi i istorijski
pre-132 fixture ostaju netaknuti. Ne brišu se ownership/world/revision/budget
negativni testovi ili ledger podaci. `classificationEngine` ostaje stvarna
zavisnost; njegovo ime nije razlog za brisanje. Preostali pure shadow/direct
validator-i i tool-accounting proof zavisnosti **nisu** ovim zahvatom povučeni:
ne ulaze u aktuelni intake import graf, a njihovo eventualno povlačenje zahteva
prenos preostalih negativnih ugovora. Ovo nije ceo C10, R04 ili R06 DONE.

## Izvršeno lokalno i granice dokaza

Izvor je prenet iz javnog repoa kroz privremeni read-only Actions archive,
run `41643329565`, artifact `13232919650`. ZIP SHA256
`47b33ee55488aede50e0eef592e22650eb146c95fd224059d051e7193e544b6f`;
unutar njega source tar SHA256
`e28fe199d504a74b6ae107a4e0dfcf4f11d4a23ca3812b2ad796546a49acd661`.
Nema lokalnih privatnih priloga, tajni ili korisničkih sesija u prenosu.

Lokalni runtime je Node22.16.0 / TypeScript5.8.3, **ne** repo lock TS6.0.3.
Osnovni neizmenjeni skup: 135 PASS. Posle izmene, četiri završena, međusobno
nepreklopljena prolaza: 147 + 174 + 93 + 101 = **515 PASS, 0 FAIL, 0 SKIP,
1 postojeći TODO** (u `ai_edge_context`). Provera whitespace/diff izvršava se
pre prenosa. Jedan prethodni objedinjeni lokalni prolaz je prekoračio 200 s i
**nije PASS**; navedeni brojevi potiču iz kasnijih završenih odvojenih komandi.
Ne zaključuje se uzrok tog prekoračenja niti nova brzina aplikacije.

Tačno pinned Node24/npm-ci/TS6 i Deno, commit i naredni CI moraju imati svoj
naknadni receipt; lokalni rezultat ih ne zamenjuje. Poslednji prethodni puni
CI `41640502000` jeste SUCCESS za `06d6dd637`; R01 `41640502092` ostaje FAILURE.
Taj stari CI nije potvrda ovog zahvata.

**DEV/Android/produkciona granica:** nema nove live provere, SQL/ACL/Edge
deploy-a, promene tajni/flagova, plaćenog modela, APK-a ili E2E probe. Poslednji
DEV/Android receipt ostaje `c86ab501`. Uklanjanje neimportovanog koda nije
izmereno smanjenje AI tokena, cene, latencije ili APK-a. Stari klijenti ne
pozivaju ove interne JS module preko mreže; API/SQL i payload ugovori nisu
menjani. Novi paired Edge import/izvoz mora se isporučiti kroz svoj kompletan
kontrolisani paket, ne jedan fajl preko stare verzije.

## Tačna jedinica povlačenja i oporavak

Poreklo svakog povučenog fajla je polazni commit iznad. Povratak je review-ovan
source revert zajedno sa loader/test/config promenama; ne menjati bazu niti
vraćati drugog klasifikatora u redovan intake. Hash-evi ispod su stari fajlovi,
ne navodna trenutna live jednakost.

| Putanja | Bajtovi pre povlačenja | SHA256 pre povlačenja |
|---|---:|---|
| `supabase/functions/_shared/classificationExplorer.d.mts` | 953 | `3d8ac6026e3017d07e9343e3f0869b969d51acdac43b8b8efbb25f7f8af58264` |
| `supabase/functions/_shared/classificationExplorer.mjs` | 15095 | `2f666c00e62f7c80c810ae05fac9bcf8f42de8d28fd4fabf3311d748fa958030` |
| `supabase/functions/_shared/taxonomyScopedShadow.mjs` | 1910 | `c91b7bc3bb95f6cfc370c5a589bd12aba28089261b32d773573853cc62f75e8b` |
| `supabase/proofs/dynamic_taxonomy/classification-explorer.test.mjs` | 20231 | `8f822f7989aac2ebd28d0ed2b8e2048c852415cc89a164b197f47c2ae0357611` |
| `supabase/proofs/dynamic_taxonomy/taxonomy-scoped-shadow.test.mjs` | 4119 | `d23c5a3205ee8ade455f0e9b6eb3f541104f037c4d7578486df2a2d521396f07` |
| `supabase/proofs/dynamic_taxonomy/unified-classification-source.test.mjs` | 1231 | `81516ea08e1a4730a2f01ae32f4d494ffba48199b0e4e8684347a5084d9065d4` |
