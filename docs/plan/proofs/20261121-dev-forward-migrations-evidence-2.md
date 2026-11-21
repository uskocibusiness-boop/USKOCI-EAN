# DEV prenos 21.11.2026 — nastavak (posle 20261121102921)

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage (md5 prosrc) |
|---|---|---|---|
| 20261121105238 | taxonomy_resolve_on_clarify | 3eb2f9ebe5c4e6559c84077bb985346c | `private.taxonomy_resolve_turn_catalog_v1` f468d6019b2586f62cc69809b54761af |

- Preimage pre izmene: prosrc md5 639983846b4f6b51cfe62c91afe4b0d6 (proveren u migraciji pre izmene).
- Odluka vlasnika 21.11.2026: usluga se smešta u stablo i na CLARIFY potezu; REVIEW/BLOCK ostaju odloženi; provera rizika po nazivu nepromenjena.
- Rollback: `scripts/sql/rollback_taxonomy_clarify_resolve_preimage_20261121.sql`.
- Ledger posle primene: 381 migracija.
