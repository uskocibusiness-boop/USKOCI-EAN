# Owner-requested DEV data reset — 2026-11-02

Executed once on `leqcwgzvjsxugfgzdmth`, after explicit owner authorization to remove old tasks and worker profiles for a fresh application test. See `receipt.json` for exact scope and verified results. `executed.sql` is historical evidence, not a reusable seed/reset command: its exact content/metadata guards must reject a changed database.

A real deletion trial was rolled back and original counts verified before the identical committed operation. Auth accounts, requester profiles, taxonomy and unrelated data remain intact. Physical Storage blobs remain for recovery; this was not a privacy erasure.

The private snapshot is deliberately outside Git: `artifacts/dev-data-reset-20261102/backup-private-locked.json.gz.dpapi`. It contains 4,444 selected rows. Recovery requires the same Windows user context to decrypt DPAPI, then gunzip and inspect the JSON. Decryption was roundtrip verified. Database re-import must be separately planned under maintenance with FK/trigger ordering and current-state checks; it has not been rehearsed. Do not describe this as an automatic restore.
