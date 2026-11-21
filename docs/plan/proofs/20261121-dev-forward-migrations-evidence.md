# DEV prenos migracija 21.11.2026 — dokaz

Projekat: DEV `leqcwgzvjsxugfgzdmth`. PROD nije diran. Release: **NO-GO**.

Migracije su primenjene preko Supabase MCP `apply_migration`; tačni bajtovi su sačuvani u `supabase/migrations/`.
Readback (samo SELECT): `md5(array_to_string(statements,''))` u ledgeru = md5 fajla, `array_length(statements,1) = 1`,
`sha256`/`octet_length` naredbe = sha256/veličina fajla. Broj DEV migracija: 376 pre, 380 posle.

| # | Verzija | Naziv | md5 (fajl = ledger) | Bajtova | Rollback |
|---|---|---|---|---|---|
| 377 | 20261121102509 | publication_decision_final_per_revision | 7d6151d8a2b29b265550cfe6c033f001 | 5371 | scripts/sql/rollback_publication_decision_preimage_20261121.sql |
| 378 | 20261121102704 | marketplace_safety_blocks_withdrawn_phone | 1815df13cd3f5c9447020cb54bc7c342 | 20703 | scripts/sql/rollback_marketplace_safety_preimage_20261121.sql |
| 379 | 20261121102809 | review_projection_reuse_resolved_decision | 1d0e83a80f45312b310f3a54c4e951c8 | 5539 | scripts/sql/rollback_review_resolved_reuse_preimage_20261121.sql |
| 380 | 20261121102921 | r06_gemini_cache_input | 6659c94ea65088c3618293d629e8d20a | 12439 | scripts/sql/r06_gemini_cache_input_20261118.rollback.sql |

## DEV postimage readback (`md5(prosrc)`)

Odluka o objavi (377):
- `public.rpc_publish_need_canonical` d4b1ebc37183c785dd48a4192ff6de79
- `public.rpc_record_need_publication_decision_service` 567d2d33a4b6f1cec57b1b99c0fc81d7
- Edge `uskoci-publication-evaluate` v34 (ACTIVE, verify_jwt=true)

Bezbednost tržišta (378):
- `public.rpc_get_agreement_workspace` 3884817e3fcc4717f9d3143d715305b5
- `public.rpc_list_need_candidates` 754d506f7367b111505972cce43b4b10
- `public.rpc_list_need_candidates_page` f1b2109e7e5d0d751ce30a28c001d6fa
- `public.rpc_reveal_contact` 7432a455a1543ad41b92798e45454b96
- `public.rpc_set_contact_grant` 2ccbbc41665d98d14d2fb2de679d047b
- `public.rpc_submit_response` dc49b5ad5382f5877644b4b6cddcc119
- pomoćna `rls_private.viewer_block_counterparties()` ACL `{postgres=X/postgres,authenticated=X/postgres}`, SECURITY DEFINER, `search_path=pg_catalog`

Ponovna upotreba razrešene odluke u pregledu (379):
- `private.taxonomy_review_candidate_projection_v2` a98a0b2228095b1db7236836633d09a7

R06 Gemini cache ulaz (380):
- `public.rpc_ai_prepare_input_service` 308166baa3a16c79f5adf6f202566107

Svi izmenjeni SECURITY DEFINER RPC-ovi zadržavaju `search_path=pg_catalog`.

## Obim

Samo DEV. Nema promene produkcije, brisanja istorijskih podataka ni tvrdnje o produkcionoj spremnosti.
Proveru u repozitorijumu sprovodi `supabase/migrations/check_migration_integrity.py`
(sekcija `forward_execution_20261121` u `MIGRATION_PROVENANCE.json`).
