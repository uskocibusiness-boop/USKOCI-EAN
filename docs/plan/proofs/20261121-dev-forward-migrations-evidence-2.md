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
| 20261121212026 | geo_privacy_public_labels_200m_grid | b2c49d0391e19203d7b3cf4399fabcab | normalize_location_point 4f88e8d4655d56227b23d6a576998a8a, check_need_resolved_location_binding 4ff95e9d5235ceb8c688f0de86a6a8da, materialize_resolved_location 77f9d093b970774413047dd2ebd4780c, rpc_save_worker_location fce3b8b96bbf2e0f35bd4dc9f5c8d6dc, worker_ai_patch 85b617d8d64cc542b452f7129ddc11ae, rpc_discovery_v1 52bbc64250f09bc3287aec07eda3484a, rpc_save_need_draft_from_review ffa8678d643a72ace3cad2c321a4210b, rpc_confirm_need_edit_from_review 82a6a99c52610f31232461b0e8e19741, stage_task_replacement 0aafb04eceffd3c9d1efbb329028210e |

- Prvi pokušaj (bez `SET CONSTRAINTS ALL IMMEDIATE`) odbijen je sa 55006 i potpuno vraćen; DEV proveren nepromenjen. Ispravljen kandidat primenjen.
- Postojeći red 2c9ab936…: javni label „Omladinskih brigada“ (bez kućnog broja); preimage u `private.geo_privacy_20261121_preimage` (1 red). Zaštitni okidač `guard_need_resolved_location_write_trg` uključen (O). Ledger posle: 383. Novi QA APK (build 297) instaliran na telefon pre primene.
