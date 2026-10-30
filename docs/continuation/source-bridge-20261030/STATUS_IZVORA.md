# STATUS I GRANICE — 30. oktobar 2026.

Ovo je presek dokaznog paketa; **ne** real-time release potvrda, nije izvršen novi CI ili DEV test.

| Oblast | Potvrđeno iz mastera / aktuelnog source-a | Otvorena granica |
|---|---|---|
| R01 | SELECT/ACL kandidati i read-only DEV nalazi | 8 strict + 49 extension-owner/ACL + 3 managed hook razlike; real Auth/PostgREST i PG17 parity nisu zatvoreni |
| R02–R03 | PAGE/MAP/source/keyset delovi | aktuelni server/Auth/E2E, pet scope-ova, native mapa/lista |
| R04/R06 | klasifikacija/source popravke, reuse/new branch, ispravljeni devet `END; $tag$;`, parcijalni SV04 DEV v6 | trajni FIRST-PLAN pre provider poziva, paid UNKNOWN/usage, stvarni Gemini/signed review/binder |
| R05 | TODAY i radna područja, izbor D08 start-location | indeksirani >300km bez lažno izbačenih kandidata; Za mene/dispatch isti matcher |
| R07–R08 | satnica po osobi/source, deo razgovor/review | kompletan signed Save/publish/apply, end-user E2E i uređaj |
| R09 | poruke, push, mediji i neki receipt/opravci source | realne notifikacije, concurrent uploads, read-only Proveri ishod, parcijalni role save |
| R10 | inventar privatnosti i closure | `retention_ai_source_ready=false`, export binding NULL; full consent/erasure/export |
| R11/R12 | C source cleanup + Metro export i nov CI source | puna kompatibilnost i fizički Android E2E; finalni CI na poslednjem SHA nije potvrđen |

**CI:** ranije pregledani `41106500883` je FAIL na Jest 8/623 suite; R01 `41106500746` je FAIL. Kasniji source commitovi ispravljaju deo razloga, ali ovaj paket ne tvrdi novi full CI PASS na HEAD `8616a9d...`. Pre zaključivanja proveriti GitHub Actions status tog HEAD-a.

**Važne istorijske funkcionalne razlike sa konkretnim source tragom:**
- `MARKET:M04 / UI-CONTRACT-01`: private chat `UNKNOWN → Proveri` još poziva writer `retry` (isti ID; nema dokaza dupliranja). Zahteva odvojenu read-only proveru i poseban retry intent.
- `MARKET:M20`: deljenje zadatka nema provereni javni URL/deep link — nije dozvoljeno izmišljanje.
- `CAL05`: arhivski reader gubi neke razloge zatvaranja; filter ne može pošteno prikazati ono što nema u podacima.
- `ACCOUNT02`: sekvencijalni role preferences upis sa readback-om; testirati parcijalni rezultat/lost ACK i locked UI pre tvrdnje o atomarnosti.
- `M03`: agreement unsent draft source postoji; proveriti kompletan povratak i polja pre označavanja rešenim.
- Fotografije: stariji brief navodi 1–3 uz zadatak, današnji shared `PHOTO_LIMIT=6` za zadatak/poruku. **Ne menjati bez vlasničke odluke i server/client ugovora.**

**Važeća vlasnička odluka iz mastera:** jedan shell, 4 glavna taba, Profil nije peti tab. UI persira Vi; istorijski REV13 prototip je na ti. Nema masovnog rewrita copy-ja iz istorije.
