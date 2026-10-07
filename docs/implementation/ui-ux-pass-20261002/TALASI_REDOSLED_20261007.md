# Talasi: redosled, preduslovi i pravila (7.10.2026, uveče)

Operativni zapis za onoga ko nastavlja (sesija, Codex, novi agent). Status stavki je u `docs/control/redovi.json`; plan ekrana je `UX_PLAN_PO_EKRANIMA_20261007.md`; trenutne odluke vlasnika su u registru (`owner_*_20261007*`).

## Stalna ovlašćenja vlasnika (7.10.)
- „Rešavaj sve, ne zaustavljaj se, angažuj koliko ti treba, razumno“ i „pokreći sve talase kad dođe vreme za to“: svaki sledeći klijentski talas se pokreće SAM čim su mu ispunjeni preduslovi.
- Ostaje na vlasniku: „PRIMENI <ime paketa>“ za svaki serverski paket (goli „PRIMENI“ ne važi), prodavnica/Play/Firebase/ključevi, novi paketi (dependencies), plaćeni resursi, push (poslednje), upisi na DEV bez njegove reči.
- Telefon samo u njegovom prozoru („sad“ = ~6 min): ažuriranje se primenjuje hladnim pokretanjem (2x), nikad se ne briše podatak/odjavljuje nalog.

## Timovi i vlasništvo fajlova (jedan pisac po fajlu; samo Edit na postojećim fajlovima)
| Tim | Šta | Fajlovi |
|---|---|---|
| S | sistem: ConfirmSheet kao dijalog, `Poruka`, `StatusChip`, zeleno glavno dugme, ProductSheet | `src/ui/system/**`, `ui/product/ProductSheet.tsx`, `ui/v2/V2Action.tsx`, `app/(app)/_layout.tsx` (host) |
| H | Početna (dugmad 88, „Čeka te“, blok Raspored) | `src/ui/home/**`, `data/homeSnapshot.ts`, `app/(app)/index.tsx` |
| W | reči: „zadatak“, rod, „mi“ | tekstovi u `src/**` osim fajlova drugih timova |
| Q | pitanja i odgovori u zadatku | `ui/qa/**`, `prilike/[id].tsx`, `potrebe/[id]/pregled.tsx`, `PublicNeedPresentation`, `NeedPresentation` |
| T1-search | panel pretrage | `ui/v2/discovery/DiscoverySearch*`, `DateRangeGrid`, `discoveryWords`, pretraga u `DiscoveryPresentation` |
| T3a | Dogovori lista + detalj | `AgreementCollectionPresentation`, `app/dogovor/**`, `ui/agreements/**` |
| T3b | Raspored + Arhiva | `ui/calendar/**` |
| T4a | Obaveštenja, Profil, Ocene | `app/obavestenja.tsx`, `ui/notifications/**`, `ui/profile/**`, `profil/*` |
| T2a | prijava kao objekat, Moji zadaci | `MyApplications*`, `Application*`, `CandidateFace`, `MarketplacePresentation`, `ui/needs/**` |
| server | ZONE-PERF, MATCH-V1, DISCOVERY-ZAMENE | worktree `USKOCI-CLEAN-match-20261007`, grana `candidate/match-v1-20261007` |

## Red čekanja (pokreće se kad uslov padne)
1. **T2b** — statusi i pregled zadatka naručioca, trenutak „Objavljeno“, tok objave (`pregled-zadatka`, `nova`, `NeedPresentation`): posle Q.
2. **T3c** — Dogovor čet: znak „viđeno“ (prvo proveriti da li server pošiljaocu vraća; `procitano` je danas `null`), baloni, datumi, glas, automatsko ponovno slanje, blokiranje iz prepiske: posle T3a.
3. **T4b** — profil radnika (intervju, pregled, sačuvan profil) i ulaz u aplikaciju (prvo otvaranje, registracija, dozvole u kontekstu): posle vizuelnog predloga i T4a.
4. **T1-map2** — Zadaci: lista kao zaglavlje sa pilulom i kapsulama (stanja skupljena/pola/puna), zum dugmići uvek iznad liste, starost „pre 2 dana“ i najnovije prvo, mesto za zvezdicu, izgled sa mnogo zadataka: posle T1-search.
5. **Integracija** — posle svakog skupa: `npx tsc`, ciljani testovi po timu, pun `npx jest`, commit po jedinici (eksplicitne putanje, `[skip ci]`), push, ažuriranje (OTA) iz ČISTOG stabla, APK za emulator (limit 55 min), provera na emulatoru (samo čitanje) i na telefonu uz „sad“.
6. **Server posle ZAMENE:** S3 brzina pretrage (filter oblasti u prvom koraku, dani samo uz filter vremena, brojanje „novih“, cena grupe), S5 zbirovi za Početnu i čitanje plana, zvezdica (sertifikat), pretraga bez kvačica. Svaki: jednokratna baza, FAIL pre / PASS posle, tačan revert, pa „PRIMENI“ vlasnika.

## Pravila naučena 7.10. (da se ne ponove)
- **Obilazak emulatora:** pomeraj SAMO sa praznog levog ruba (x≈18) i sporo; zastali potez postaje dodir i otvorio je „Prijave“ na tvom zadatku. Ne otvaraj čet unutar Dogovora, grupni razgovor, pojedinačna obaveštenja, „Označi sve kao pročitano“, odjavu. `uiautomator dump` visi: koristi snimke i koordinate (1264x2728).
- **Merenje trešenja na uređaju:** `dumpsys gfxinfo <paket> reset` pa ~3 s mirovanja, plus 6 uzastopnih `screencap` i razlika piksela; mirna površina = 0 slika i 0 promena.
- **Brzina servera:** jedna provera zone (`private.availability_timezone_valid`, skenira `pg_timezone_names`) košta ~73 ms po pozivu; Početna (`rpc_home_attention`) 884 ms prvi put / 86 ms posle, `rpc_list_my_needs_page` 356 ms, uparivanje ~17 s po zadatku na 300 radnika. Popravka u paketu ZONE-PERF.
- **Pun jest** pada kad se istovremeno rade drugi poslovi (vremenska ograničenja); pojedinačno prolazi. Pre OTA-a stablo mora biti čisto.
- **Nema nagađanja uzroka:** trešenje prozora nije reprodukovano ni na emulatoru ni na telefonu sa popravkom; uzrok iz koda je pretpostavka dok vlasnik ne potvrdi.
