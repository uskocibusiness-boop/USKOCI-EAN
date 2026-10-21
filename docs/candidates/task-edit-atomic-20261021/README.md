# Objavljeni zadatak: istorijski tehnički kandidat za isti ID

**Status 21.10.2026: NE PRIMENJIVATI kao ciljni ugovor.** Ovaj nacrt nije implementiran ni na DEV-u. Dokaz trenutnog ponašanja niže ostaje koristan, ali predlog pod „Potreban ugovor” zadržava isti `needs.id` i stare prijave. To je u suprotnosti sa [vlasnikovom odlukom od 19.10.](../../current/OWNER_DECISIONS_20261019.md): pre prvog izbora, kada postoje prijave, „Izmeni i ponovo objavi” potvrđivanjem stvara **novi ID povezan sa starim**, zatvara staru objavu i aktivne prijave, ne prenosi prijave/cene i obaveštava stare kandidate; stara objava ostaje aktivna dok zamena nije potvrđena. Nakon prvog izbora ovaj tok je trajno zatvoren. Nijedan SQL iz ovog kandidata ne sme se primeniti kao rešenje bez novog usklađenog ugovora i izolovane probe.

Postojeći tok eksplicitno upozorava korisnika da se zadatak privremeno povlači. Nije bezbedno zvati ga atomarnom izmenom. Posebna zamenska finalizacija ne može se napraviti prostim pozivom `rpc_cancel_need`, jer on označava otkaz na zahtev objavljivača i šalje pogrešnu vrstu događaja. Evaluator i potpisani publisher danas zahtevaju stvarni DRAFT ID/reviziju, a mediji se čitaju sa postojećeg `needs.id`; privatni staging traži sopstveni potpisani kontekst i integraciju sa pravilima brisanja podataka. Ove uslove prvo treba dokazati u zasebnom kandidatu.

## Dokaz trenutnog ponašanja

1. `public.rpc_accept_ai_task_review` poziva `public.rpc_confirm_need_edit_from_review_v2` za razgovor vezan za objavljeni zadatak (`supabase/migrations/20260912213702_clean_v5_review_acceptance.sql:251-262`).
2. Taj writer u istoj transakciji zamenjuje javne činjenice na **istom** `needs.id`, postavlja `status='DRAFT'`, briše `published_at` i podiže reviziju (`supabase/migrations/20261019104604_service_handoff_signed_matching.sql:610-626`).
3. Triger na reviziju tada menja postojeće prijave u `STALE_REVIEW_REQUIRED`, dostave u `EXPIRED` i zaustavlja dispatch (`supabase/migrations/20260904214500_clean_ru4_owner_edit_lock.sql:272-301`).
4. Edge procena i zaseban poziv za objavu slede **posle** prihvatanja (`src/data/aiTaskReviewClientService.ts:273-313,354-362`). Ako procena nije dostupna ili odbije, novi nacrt ostaje, a stara objava i prijave se ne vraćaju.
5. `rpc_publish_need_canonical` zahteva DRAFT istog ID-ja i odluku vezanu za njegovu tačnu reviziju i fingerprint (`supabase/migrations/20260910144644_clean_w05_publication_evaluator_authority.sql:480-605`). Samo zadržavanje starog statusa PUBLISHED uz upis novih činjenica bi izložilo neproveren sadržaj i prekršilo taj ugovor.

## Potreban ugovor

Dok vlasnik razgovara i čeka procenu, postojeći objavljeni zadatak ostaje čitljiv i dostupan, sa starim `needs.id`, revizijom i prijavama. Novi sadržaj se sme čuvati samo u privatnoj staging verziji vezanoj za immutable AI review i očekivanu reviziju. Radnik nikad ne čita tu verziju. Postojeći dodir na „Potvrdi izmene” jeste vlasnikova eksplicitna potvrda pregledane verzije: tek za nju se pokreću procena i, uz ALLOW, završna promocija. Samo otvaranje razgovora ili nastanak novog AI predloga ne sme objaviti ništa.

Jedna završna DB transakcija mora pod vlasničkom i policy proverom:

1. Zaključati postojeći zadatak, staging verziju, review komandu i stanje potrebnih politika.
2. Ponovo proveriti nalog, vlasništvo, nepromenjenu staru reviziju, status koji dopušta izmenu i trajni lock posle prvog Dogovora.
3. Proveriti da je ALLOW odluka sveža, vezana za **tačan staging fingerprint**, jurisdikciju, pravila, medije, geografiju i konkretan evaluator pokušaj. Tuđa ili ponovljena odluka ne sme proći.
4. Preneti staged javne i privatne podatke u stari `needs.id`; upisati reviziju, odluku i novu objavu kao jednu celinu. Tek tada promeniti status prijava/dostava i pokrenuti novi dispatch. Na grešku se vraća cela transakcija, uključujući statuse radnika.
5. Upisati receipt sa stabilnim request ID-jem. Replay vraća isti rezultat; izgubljen odgovor se rešava čitanjem receipt-a, bez nove procene i bez drugog podizanja revizije.

Za ovo treba refaktorisati interne write helper-e koji sada koriste `auth.uid()` i očekuju već upisan DRAFT. Privilegovani finalizer ne sme prihvatiti proizvoljan account ID niti samo klijentski ALLOW string. Service role proverava prethodno trajno zabeležen claim i rezultat pokušaja, a javni wrapper proverava vlasnikov JWT. Direktno menjanje `status` iz klijenta ili kopiranje evaluator odluke sa privremenog Need ID-ja nije prihvatljivo.

## Kompatibilnost i migracija

- Ne menjati aktivne `rpc_accept_ai_task_review` / `rpc_publish_accepted_ai_task_review` iza leđa starijeg APK-a. Novi opt-in RPC i novi client/Edge flag se uvode zajedno; kad je OFF, stari potpisani put ostaje identičan.
- Staging tabela je u `private`, sa RLS, opozvanim podrazumevanim privilegijama, ograničenim rokom i proverom vlasnika pri svakom čitanju. Nema javnog `needs` reda za nedozvoljen sadržaj.
- DRAFT koji je već nastao starim tokom ostaje na starom oporavku; ne pretvarati ga automatski u navodno aktivnu staru objavu.
- Rok za prijave, kad njegov kandidat bude uključen, pripada staging fingerprint-u i finalnom receipt-u. Rok promenjen samostalno (`AT→AT`, `AT→NONE`, `NULL→AT`) mora biti materijalna izmena; porediti predloženi rok iz potvrđene činjenice sa starim rokom, ne prolazno SQL `NULL` na DRAFT-u. Očuvati razliku `NONE` i neutvrđenog u review-u; istorijsko čuvanje te razlike zahteva zaseban model.

## Dokaz pre uključivanja

1. Izolovana DB proba sa dva naloga i izvršiocem: uspeh, CLARIFY/BLOCK, NOT_READY, Edge timeout i izgubljen odgovor; u svim neuspesima stara objava/revizija/prijave/dispatch ostaju isti.
2. Istovremena prijava radnika, izbor izvršioca, otkazivanje i dve vlasnikove izmene: finalizer ili serializuje uspeh ili vraća `STALE_REVIEW_REQUIRED` bez poluobjave i bez duple notifikacije.
3. ALLOW za pogrešan review, stari fingerprint, stari policy, drugu geografiju, tuđ nalog, promenjen medij i rok koji je istekao mora biti odbijen.
4. Jedan uspešan commit: isti `needs.id`, nova revizija i tačan readback; tek tada stare prijave postaju `STALE_REVIEW_REQUIRED` i radnik dobija pravi nastavak KEEP/UPDATE/WITHDRAW.
5. DEV dokaz ACL/RLS, schema migration readback, Edge verzije, flag OFF/ON, puna regresija i potpisani tok oba naloga; zatim Android proba gubitka mreže i povratka.

Dok ti uslovi ne prođu, bezbedan korisnički tekst mora iskreno reći да потврда привремено повлачи задатак. Не уклањати то упозорење само због визуелне једноставности.
