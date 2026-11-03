# STATUS I GRANICE — 30. oktobar 2026.

## NADREĐENI AKTUELNI STATUS (dopuna izvršne istine, posle objave Bridge-a)

**Važeći SOURCE/CI/DEV/NATIVE dnevnik je samo [CODEX master §11.2a i §12.6](../../plan/CODEX_PLAN_RADA.md).** Ovaj fajl je originalni presek dokaza iz trenutka kada je Bridge pripreman; starije rečenice ispod ne poništavaju naredna dokumentaciona/CI izvršenja. Početni provereni HEAD `472de27afcdffe86f9da3ad351cb3ff0e113367a`: Full CI [41130520059](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41130520059) **FAIL** (R06 SQL + media harness), R01 [41130520128](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/41130520128) **FAIL** (8 strict + 49 dopunskih + 3 helper). Dokumentaciona izmena sama ne zatvara ove kapije.

**Važeći Product/UX kanon:** [Product/UX master 29.10 sa važećom dopunom 31.10 (jedna zajednička reputacija naloga)](../../product/USKOCI_PRODUCT_UX_MASTER.md), A–J/S01–S18. Njegova najnovija odluka je **MAX 6 fotografija**, dok je **1–3 preporuka**, NE nova otvorena odluka. Štaviše, `/arhiva` više nije ciljna korisnička površina već compatibility redirect; stara 77-screen tabela „Full screen” predstavlja istorijsko mapiranje. Bez ponovnog odlučivanja o 4 taba, neobaveznom gradu na registraciji i jednu zajedničku reputaciju naloga; aktuelni code gap i acceptance su u §12.6 mastera.

**Semantika ovog fajla:** sve neprovereno u originalnoj tabeli ostaje neprovereno, ali status iz 30.10. nije automatski trenutni FAIL/PASS budućeg commita; traži novi SHA i GitHub run. Ne menjati izvorna Z09/Z10/Z16 tela ni istorijska SHA očitavanja.



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
