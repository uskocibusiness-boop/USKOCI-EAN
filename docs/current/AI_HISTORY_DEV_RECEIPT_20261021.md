# AI istorija — DEV readback i granice

**21.10.2026, 01:50 UTC.** Projekat `leqcwgzvjsxugfgzdmth`; produkcija nije menjana.

| Korak | Kanonski lokalni SQL | DEV migracija / dokaz |
| --- | --- | --- |
| H1 metadata lista | `20261021014544_ai_history_h1_metadata.sql` | `20261021014544_ai_history_h1_metadata`, `apply_migration` success; katalog SECURITY DEFINER, EXECUTE authenticated=true, anon/public=false. |
| H2 tekstualni pager | `20261021014557_ai_history_h2_messages.sql` | `20261021014557_ai_history_h2_messages`, success; isti ACL; readback tela pokazuje oba `m.role in ('USER','ASSISTANT')` uslova. |
| H1 sposobnost čitanja | `20261021014849_ai_history_h2_read_capability.sql` | `20261021014849_ai_history_h2_read_capability`, success; H1 zatvorenim redovima daje `canRead=true`, OPEN ostaje false; ACL ponovo potvrđen. |

Pre migracija read-only katalog je pokazao da H1/H2 ne postoje, a potrebne tabele, kolone i `private.closure_assert_open` postoje. Nakon svake primene potvrđen je aktivni `pg_proc` i ACL. Za runtime proveru je na DEV-u korišćen `DO` blok sa lokalnim simuliranim `request.jwt.claim.sub`, bez DML: vlasnik je dobio listu i H2 poruku, tuđ razgovor je odbijen sa `42501`, nepoznati kursor sa `22023`, prazan identitet sa `42501`, a OPEN transkript sa `42501`. Posle forward koraka za stvarni zatvoreni razgovor H1 je vratio `canRead=true`; H2 je vratio isti vlasnički conversation ID; tuđ nalog je opet odbijen. Katalog je pokazao 44 kanonska zatvorena razgovora, 41 sa tekstom, u 6 naloga, u trenutku provere. Nijedan sadržaj poruke nije upisan u dokazni fajl.

**Granica:** SQL simulacija identiteta i katalog nisu stvaran poziv iz instalirane aplikacije niti dokaz HONOR prikaza, tastature, Back ponašanja ili prelaska naloga. Lokalni `src/app/(app)/ai-istorija/` i `src/ui/aiHistory/` daju odvojene liste, OPEN nastavak i read-only zatvoren tekst, uz 50 poruka po strani. H2 ne rekonstruše fotografije, nacrte ni pregled. Nema server komande za skrivanje ili trajno brisanje; ekran to ne obećava. `ABANDONED` znači napušten, ne obrisan.

Nazivi tri lokalna SQL fajla sada nose iste verzije koje DEV migration ledger vraća. SQL sadržaj nije menjan tim preimenovanjem; lokalni MD5/SHA256 registar i source proof prolaze. `MIGRATION_PROVENANCE.json` i dalje pošteno vodi klasifikaciju kao `SOURCE_ONLY_LIVE_BINDING_UNPROVEN`, jer tačni ledger statement bajtovi nisu zasebno rekonstruisani. Komentari o „neprimenjenom kandidatu” unutar samog H2 SQL-a opisuju stanje pri njegovom nastanku; važeći datum primene je gore.

Izvorni integracioni gate: `python supabase/migrations/check_migration_integrity.py`, `npx tsc --noEmit --pretty false`, `node --test supabase/proofs/ai/ai_history_h1_source.test.mjs supabase/proofs/ai/ai_history_h2_source.test.mjs`, Jest `ai-history-client`, `ai-history-messages-client` i `history-ui`. Puni regresioni i Android test beleže se zasebno; ovaj dokument ih ne prisvaja.
