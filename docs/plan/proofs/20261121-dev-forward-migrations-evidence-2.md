# DEV prenos 21.11.2026 — nastavak (posle 20261121102921)

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage (md5 prosrc) |
|---|---|---|---|
| 20261121105238 | taxonomy_resolve_on_clarify | 3eb2f9ebe5c4e6559c84077bb985346c | `private.taxonomy_resolve_turn_catalog_v1` f468d6019b2586f62cc69809b54761af |

- Preimage pre izmene: prosrc md5 639983846b4f6b51cfe62c91afe4b0d6 (proveren u migraciji pre izmene).
- Odluka vlasnika 21.11.2026: usluga se smešta u stablo i na CLARIFY potezu; REVIEW/BLOCK ostaju odloženi; provera rizika po nazivu nepromenjena.
- Rollback: `scripts/sql/rollback_taxonomy_clarify_resolve_preimage_20261121.sql`.
- Ledger posle primene: 381 migracija.
| 20261121152127 | publication_pre_evaluation | 1c56cfc8ca93390193b30e9d7bbcf532 | nove funkcije: preview f93133c1414b7ae7432b278fd55f7f55 (authenticated), claim aa7885bc8e3cabb04f26085879a1bd93, complete a80004df70b7d1d89efc3384a73d3044, read aac5cbb3a730f6afe0d8b026d815e7f7 (samo service_role); tabela `private.ai_task_review_pre_evaluations` RLS uključen, bez prava za klijente |

- Rollback za 20261121152127: `scripts/sql/rollback_publication_pre_evaluation_20261121.sql` (briše samo nove objekte). Ledger posle: 382.
