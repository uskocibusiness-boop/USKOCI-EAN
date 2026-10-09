# R01: prikaz telefona po važećoj saglasnosti

**DEV APPLIED, postflight PASS. Fizička UI provera nije završena.**

Prikaz telefona i oznaka moje saglasnosti u tri postojeća agreement reader-a sada koriste isti `private.safety_grant_valid` kao direktno otkrivanje kontakta. Blokiranje u bilo kom smeru sakriva telefon; odblokiranje ne oživljava staru saglasnost. Nova saglasnost posle odblokiranja vraća dozvoljeni prikaz. Izmenjeno je samo šest uslova, bez nove arhitekture ili promena formata odgovora.

Kandidat: `supabase/candidates/r01_phone_read_consent_20261009.sql`; tačan revert je susedni `.revert.sql`. Kandidat je poslat bez promene bajtova i zabeležen u DEV migraciji **20261009172613**, ledger **238**. SHA-256 kandidata: `c345730c125d97fef5251907082a61b6563c477495a0115da6c3e10d3842502e`. MD5 sačuvanog statementa je isti kao poslati fajl: `eb1cc4786635c042818b843e3bb2efed`.

Preflight i postflight JSON dokazuju očekivana tri nova body hash-a, nepromenjen helper, owner/ACL/search_path/security metapodatke, nepromenjen closure source/program/certified/erasure digest i `retention_ai_source_ready=true`. Nema izmene stvarnih poslovnih podataka. Primena je pokrivena postojećim odobrenjem dokazanih server paketa u AGENTS.md3.1.10 i novijim autonomnim nalogom vlasnika.

## Provera

Root je nezavisno ponovio dokaz na PostgreSQL17.5 i18.3/WASM: **67 PASS,0 FAIL**, sa **12 reprodukovanih FAIL-before** po engine-u. To je67 različitih provera ponovljenih na dva engine-a. Pokriveni su oba učesnika i sva tri reader-a; blokiranje u oba smera, odblokiranje, nova saglasnost, opoziv, istek, closure restriction, foreign ID, anon/missing-auth, paging, identičan valid-consent JSON i tačan revert/reapply.

`R01_PHONE_CONSENT_PROOF_BUNDLE.zip` sadrži samostalan reproduktivni harness, tačne funkcijske fixture-e, manifest, kandidata/revert i detaljne limite. Ne sadrži node_modules, app dependency izmene ili stvarne korisničke podatke.

**Granice:** minimalna sintetička relaciona šema, ne cela canonical šema/RLS/trigger integracija; synthetic Auth claim nije JWT verifikacija. Lokalni admission guard očekuje fixture digest umesto live digest-a, a retention-ready je fixture; pravi live sertifikat je zasebno proverio root. PG17 fixture koristi nativni PostgreSQL SHA256 umesto pgcrypto; PG18 koristi pravi pgcrypto. Nema dokaza sa telefona, PostgREST mutation testa ili produkcionog load testa.

## Preostali uski korak

Na završnom APK-u sa legitimnim probnim parom proveriti consent indikator i prikaz telefona kroz block → read → unblock → read → new grant → read. Server ne vraća broj za nevažeću saglasnost; postojeći prikaz u klijentskom kešu zahteva svoju runtime proveru. Ovaj paket ne znači ukupnu release spremnost. Istorijski audit ostaje neizmenjen; isti62-redni registar nosi novi dokaz.

## Sledeći redosled

1. Trajan povratak u nedovršen AI unos posle kill/reopen.
2. Oporavak neizvesnog slanja i foreground osvežavanje grupnog četa.
3. Production konfiguracija, pravni/store podaci i završni Android build sa ciljanim testom osnovnih tokova.

Dovoljno dobre ekrane i postojeće sigurnosne/revizijske/idempotency zaštite ne redizajnirati radi ukusa.
