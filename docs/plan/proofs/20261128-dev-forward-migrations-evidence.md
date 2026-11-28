# DEV forward migration readback — 28.11.2026

Project `leqcwgzvjsxugfgzdmth`; read-only query of `supabase_migrations.schema_migrations`. Total ledger count 391, head 20261128183114. No migration reapplied, no data modified.

| Version | Name | Recorded statements | Bytes | MD5 | SHA-256 | Ledger count after |
|---|---|---:|---:|---|---|---:|
| 20261128182336 | worker_availability_retirement | 1 | 3890 | 0d587d32022012ce480c6c0733994b1f | 9ea7ecc64b2c9b7dacc784f40f3669845e2aef20d673d33ad8eb6de157d66b31 | 389 |
| 20261128183009 | r09_withdrawn_final | 1 | 11417 | f647410188296050122f13a2503bf4c9 | c8d1e71d5304a88c1463a944b60ea5a717414cfa3ace89c022c5845259a023f3 | 390 |
| 20261128183114 | dispatch_wait_for_confirmed_taxonomy | 1 | 16551 | b5e9b7ddc8f4a6d0c72ce883f5abf128 | a34891f116f09f8f02f35762b0c2173bfd4ac69dfe9acc9956e165f19f8ff5d2 | 391 |

Original GitHub source 770d4466: availability and taxonomy dispatch match byte-for-byte. Withdrawal differs only in case-insensitive SQL keywords: `ORDER BY x.created_at desc,x.id desc` vs `ORDER BY x.created_at DESC,x.id DESC` on lines 223 and 230. Canonical physical migration is restored to exact recorded DEV statement bytes; no change in SQL semantics. All three rollback preimages exist at the recorded paths. This is migration-ledger/byte evidence, not a clean production replay, full CI, native test or authorization to release. Release NO-GO.
