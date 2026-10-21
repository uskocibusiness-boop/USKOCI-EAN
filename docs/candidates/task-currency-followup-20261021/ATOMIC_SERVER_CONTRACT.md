# CUR01 — atomsko razrešenje ispravljene valute (predlog, nije primenjen)

**Status 21.10.2026:** forenzički pregled izvora, bez migracije, DEV upisa, potpisane probe ili APK dokaza. Edge kandidat u istom direktorijumu odbacuje nove pogrešne RSD predloge, ali ne može povući već aktivnu činjenicu. Zato se ovaj ugovor ne sme označiti kao završen na osnovu Node testa.

## Stvarna rupa

`rpc_ai_apply_interview_turn_v2_service` superseduje samo ključeve prisutne u novom predlogu (`supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql`). Korisnik može prvo dobiti aktivni `need.price_rsd=100`, zatim reći „u evrima”. Ako Edge odbaci pogrešan novi RSD predlog, starih 100 RSD ostaje. `private.ai_task_review_source` može ponovo potpisati aktivne činjenice, a ranije prihvaćen DRAFT ima svoju cenu. Upozorenje u čet poruci ne sprečava zaseban pregled ili objavu.

## Ciljni ugovor

1. Jedno serverski upravljano stanje na vlasničkom `ai_conversations`: `NORMAL`, `UNRESOLVED`, `RSD_READY`, `OFFERS_READY`; podrazumevano `NORMAL`. Klijent nema direktan UPDATE/DELETE nad stanjem ili AI činjenicama. Ne uvoditi novu valutu u `need.price_rsd` niti izmišljati kurs.
2. U `rpc_ai_claim_need_turn_v2_service`, posle provere vlasnika i idempotency ključa, a pre turn-context hasha, prepoznati kratku ispravku valute vezanu za postojeću aktivnu RSD cenu. U istoj transakciji supersedovati aktivne `need.price_mode`, `need.price_rsd`, `need.price_basis`, postaviti `UNRESOLVED` i upisati turn komandu. Ostale činjenice ostaju. Ne menjati vezani `needs` red u claim fazi, jer bi to pokvarilo edit-base fingerprint. PUBLISHED/SELECTION mora u zaseban replacement tok, ne u tihu izmenu stare objave.
3. Turn context/hash uključuje stanje cene. Writer/completion sme preći iz `UNRESOLVED` u `RSD_READY` samo uz eksplicitno potkrepljen novi RSD iznos, `MY_PRICE` i ispravan basis gde je potreban; u `OFFERS_READY` samo uz izričit izbor ponuda i bez aktivnih `price_rsd`/basis. Provider failure, cancel i lease timeout ne brišu `UNRESOLVED`. Mešovita poruka može zadržati nezavisne činjenice (npr. broj ljudi).
4. Oba review prepare puta (`20260912213702_clean_v5_review_acceptance.sql` i taxonomy override u `20261019104604_service_handoff_signed_matching.sql`) u `UNRESOLVED` vraćaju `canAccept=false` i jasan izbor „nov iznos u RSD ili ponude”. Stanje ulazi u `private.ai_task_review_source`; accept ponovo proverava pod zaključavanjem. Stari prepared review postaje stale. READY prikazuje samo novu konzistentnu cenu.
5. Zaobilazni draft/edit save putevi iz `20261019104604_service_handoff_signed_matching.sql`, uključujući authenticated wrapper iz `20260904230500_clean_ru4_ai_edit_replay_boundary.sql`, moraju odbiti novu write komandu dok vezani razgovor ima nerešenu/promenu u toku. Uspešan prihvaćeni edit ažurira Need reviziju i vraća `NORMAL` u istoj transakciji; stari idempotentni receipt se samo čita.
6. `private.need_publication_context` pod Need lockom proverava da nijedan vezani vlasnički razgovor nema `UNRESOLVED`, `RSD_READY` ili `OFFERS_READY` koji tek čeka prihvatanje. Vraća `NOT_READY/PRICE_UNRESOLVED`. Kanonska objava dodatno proverava konzistentnost `MY_PRICE` sa RSD iznosom i `OFFERS` bez iznosa. Čitanje razgovora pod Need lockom ne uzima obrnuti `FOR UPDATE` lock.

## Obavezna trka i oporavak

Claim zaključava conversation pa Need. Ako claim prvi dobije Need, publish čeka i vidi pending marker. Ako publish prvi završi, claim posle čekanja vidi PUBLISHED i ne vraća uspeh koji bi tvrdio da je objavljena cena povučena. Stari review accept se serijalizuje pre claim-a ili postaje stale. Testirati oba redosleda sa dve SQL sesije i barijerom; samo jednonitni mock nije dokaz.

Za isti request UUID/tekst retry vraća isti status/receipt bez drugog supersedovanja; isti UUID/drugi tekst odbija se. Failure, cancel ili lease expiry ne vraća staru cenu. Drugi nalog i anon nemaju claim/review/publish prava za vlasnikov razgovor; direktan klijentski UPDATE činjenica odbija se.

## Dokazni redosled pre DEV

1. Pročitati aktuelne `pg_get_functiondef`, ACL i schema digest na ciljnom DEV-u i uporediti sa precima u migracijama; ranije DEV-only promene price basis ne smeju se pretpostaviti iz repozitorijuma.
2. Napraviti izolovan forward kandidat sa pinned prethodnicima i rollback planom. Nova kolona menja retention AI whitelist i closure digest: pre primene proveriti `retention_ai_source_ready`, `closure_source_digest_v5`, `closure_binding_v5` i `closure_erasure_binding_v5`; posle primene tražiti validan binding i izolovan erasure/retention prohod.
3. Na namenski izolovanoj bazi izvršiti: staru aktivnu cenu 100 → „u evrima” → nema aktivne RSD cene → review odbijen; 12000 RSD → novi review/accept; zasebno OFFERS; goli broj/EUR/modelova lažna RSD činjenica ostaje nerešena; već prihvaćen DRAFT ne može se objaviti tokom ispravke.
4. Tek posle SQL i potpisanih Edge/klijent proba primeniti na DEV i uraditi readback. Za objavljen zadatak važi vlasnikova odluka o novom task ID-u i atomskoj ponovnoj objavi; ovaj uži ugovor je ne zamenjuje.

**Granica:** ovo je implementacioni ugovor i matrica provere, ne primenjena funkcija. Ne tvrditi da je postojeći task AI tok bezbedan od stale RSD objave dok server ne zatvori tačke 1–6.
