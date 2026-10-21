# DEV gate: zatvaranje naloga i precizni push cilj

**21.10.2026. · read-only presek, projekat `leqcwgzvjsxugfgzdmth`.** Ovo je P0 release gate, ne izvršena proba brisanja naloga.

DEV je pre kandidata za push prijave vraćao `private.closure_source_digest_v5() = e064bf5bd995c9b846495f9f808c2910ba56d21f5fcb56b84ad98514d569bb79`, dok oba tehnička sertifikata imaju `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`. `private.retention_ai_source_ready()` je `false`, `private.closure_erasure_binding_v5()` je `null`, a aktivnih `EXECUTING` zatvaranja nije bilo. Funkcija za pokretanje izvršavanja u `supabase/migrations/20260913081147_clean_v5_event_bound_account_erasure.sql:543-544` odbija prazan binding sa `CLOSURE_POLICY_NOT_READY` (`55000`). Stvarni end-user zahtev nije pokretan u ovom auditu.

`supabase/candidates/push-application-target-20261021/candidate.sql` menja `public.rpc_begin_push_send`, jednu od funkcija zaštićenog digest registra. Čak i ako njegov uski SQL preflight prođe, sam kandidat ne obnavlja spremnost zatvaranja. Zato precizni push target i zastavica ostaju isključeni; Edge parser v36 sa isključenom zastavicom je zaseban, kompatibilan korak. Detalji preflight-a su u `supabase/candidates/push-application-target-20261021/README.md`.

Postojeći F01 kandidat za proširenje redakcije/izvoza nije neposredno primenljiv: šest od 34 MD5 provere prethodnih funkcija se razlikuje od sadašnjeg DEV izvora. Trenutni katalog ima 76 relacija u redakciji i 52 izvozne stavke, bez delotvornog retention policy seta i potvrđene export policy veze. Pre finalnog APK/release prihvatanja potrebno je snimiti konačan izvor, pregledati kopije ličnih podataka, obnoviti F01 za tačan prethodnik, proveriti izolovano i u punom Auth/Storage toku, pa posebnom strogo vezanom forward migracijom uskladiti konačan digest, literal spremnosti i oba sertifikata. Zatim potvrditi `ready=true`, ne-prazan binding i izvršiti novu testnu putanju zatvaranja. Samo upis novog hash-a ne dokazuje privatnost ni brisanje.

Ovaj nalaz ne poništava lokalne push UI testove ili H1/H2 AI istoriju. Jasno razdvaja pripremljen klijent i parser od bezbedno aktivirane serverske putanje.
