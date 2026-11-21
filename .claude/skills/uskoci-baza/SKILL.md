---
name: uskoci-baza
description: Use for any USKOČI Supabase/PostgreSQL work — RLS, RPC, SECURITY DEFINER functions, triggers, migrations, DEV readback. Explains the source-only candidate SQL pattern, migration provenance and DEV safety rules.
---

# USKOČI baza (Supabase)

## Okruženja
- DEV: `leqcwgzvjsxugfgzdmth` (eu-central-1). PROD: `fvyqqudqvizjrxaflhex` — **nikad ne diraj**.
- Bez odobrenja vlasnika: samo `SELECT` na DEV-u (MCP `execute_sql`, `query_logs`, `get_advisors`, `list_edge_functions`).
- Živa definicija funkcije na DEV-u je izvor istine (`pg_get_functiondef`), ne stari migracioni fajl.

## Kako se pravi SQL izmena (obavezan obrazac)
1. Pročitaj živu funkciju na DEV-u: definicija, `proacl`, `prosecdef`, `proconfig`, md5 definicije.
2. Napiši **source-only kandidat** u `scripts/sql/<tema>_<YYYYMMDD>.candidate.sql`:
   - prvi blok `DO $source_only$` koji odbija izvršavanje dok se namerno ne ukloni;
   - po jedan imenovan `DO $tag$` blok po funkciji: proveri ACL, SECURITY DEFINER, search_path i md5 preimage; zameni tačan anchor; proveri md5 postimage;
   - uzor: `scripts/sql/dispatch_retire_urgency_20261119.candidate.sql`.
3. Rollback preimage: `scripts/sql/rollback_<tema>_preimage_<YYYYMMDD>.sql` (tačne žive definicije pre izmene).
4. Test `scripts/<tema>-candidate.test.cjs`: source-only čuvar, parsiranje svih blokova u pglite, funkcionalni negativni testovi. Uzor: `scripts/dispatch-urgency-retirement-candidate.test.cjs`. Dodaj test u `package.json` `test`.
5. `supabase/migrations/*` se menja **tek posle odobrenog DEV prenosa**, uz `MD5_MANIFEST.txt`, `MIGRATION_PROVENANCE.json` i nov `check_*_provenance` u `check_migration_integrity.py` (uzor: commit `182dbdf4`).
6. Posle DEV prenosa: readback + `get_advisors(security)`.

## Bezbednosna pravila
- RLS uključen na svim javnim tabelama; `v5_closed_account_visibility` politike su RESTRICTIVE — ne pravi PERMISSIVE politike koje bi ih zaobišle.
- SECURITY DEFINER: uvek `SET search_path TO 'pg_catalog'` i provera `auth.uid()`; ne dodeljuj EXECUTE `anon` bez razloga.
- Zaštite preko `current_setting('uskoci.profile_mutation')` tokena i okidača (`guard_profile_write`, `guard_worker_fact_authority`) se ne uklanjaju.
- Pre Dogovora javna lokacija je približna (do 200 m), bez kućnog broja; tačna adresa samo u `need_sensitive` i samo učesnicima sa važećim pristupom.
- Blokiran par (`private.safety_pair_blocked`) ne sme da se vidi u pretrazi, kandidatima, porukama, prijavama.
- Idempotentnost (`client_request_id`, advisory lock) i revizije se ne slabe.

## Lokalni testovi
- SQL testovi traže `@electric-sql/pglite` (devDependency). Ako `node_modules` nema paket: `npm ci`, ili privremeno `NODE_PATH=<folder sa pglite>`.
