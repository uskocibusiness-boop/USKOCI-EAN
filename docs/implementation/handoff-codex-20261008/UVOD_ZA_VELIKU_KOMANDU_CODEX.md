# Uvod koji ide ISPRED velike komande „USKOČI — ULTIMATE PRODUCT TAKEOVER“ (zalepiti zajedno, uvod prvi)

Redosled za vlasnika: (1) prvo zalepi `START_PROMPT_CODEX.md` i sačekaj Codexovih pet redova stanja; (2) onda zalepi OVAJ uvod + veliku komandu u jednoj poruci.

---

UVOD (važi iznad svega u komandi ispod):

1. Ne kreći od nule. Polazna istina je paket `docs/implementation/handoff-codex-20261008/` (presek, ocena kvaliteta, plan, lista) i jedini registar `docs/control/redovi.json`. Audit iz komande radi se kao PROVERA tog preseka i samo za ono što diraš, ne kao nov audit celog proizvoda.
2. Obavezujući dizajn-dokumenti su u `docs/implementation/ui-ux-pass-20261002/`: `NACRT_PROIZVODA_20261008.md` (odobren 8. 10., sa dopunama R2 i Z5), `ANALIZA_EKRANA_TELEFON_20261008.md` (pravila J1–J15), `IZBOR_VLASNIKA_20261008.md`, `KREATIVNI_PRAVAC_20261008.md`, `AIRBNB_OSECAJ_SPEC_20261008.md`, istraživanja R1–R4; vlasnikove odluke 8. 10. su u `docs/authority/OWNER_DECISIONS_20261008.md`. Dokumente koje komanda pominje a nema ih u repozitorijumu (Screen Atlas, Master Design Synthesis, Idealno korisničko iskustvo, Master Execution Spec, Design Master) ne tražiti — oni su istorija ili van repozitorijuma.
3. Gde se komanda razlikuje od nacrta, VAŽI NACRT: pretraga je ceo ekran (reč + mesto, gradovi sa brojem), filteri su odvojeno okruglo dugme i list odozdo (Kada/Gde/Iznos), bez vođenog čarobnjaka sa automatskim prelaskom koraka; na Zadacima je donja traka tabova sakrivena dok je lista dole (vlasnikova odluka), kapsula „Na daljinu“ je prva, postoji ulaz „N nisu na mapi“, bez prekidača Mapa/Lista desno (lista je sheet, „Mapa“ dugme kad je lista gore). Razdvajanje nacrta filtera od primenjenih i zaštita od zastarelog upita iz komande VAŽE.
4. Ekrani promenjeni 8. 10. (talas „Telefon“, komit 4e0ea506) se NE preuređuju dok vlasnik ne da primedbe po ekranu; prvo dokaz na emulatoru/telefonu (CODEX_LISTA, deo A), pa popravke po njegovim rečima.
5. Server: DEV `leqcwgzvjsxugfgzdmth`, ledger 235, digest 3a785d42. Važi strože pravilo iz komande: svaka promena stanja na DEV-u, Edge, podaci, sertifikat, push, zavisnosti = pre toga vlasnikova reč sa preflight-om i rollback-om (RETIRE-V1 i PUSH-KAPACITET su pripremljeni u paketu i čekaju tu reč).
6. Jedan agent po checkout-u: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN-spoj-20261006` (grana `integration/spoj-20261006` = `work/uskoci-ui-unification-20260924` na remote-u `novi`); push na obe grane; APK za telefon = push na `visual/phone-<datum>-<n>` bez `[skip ci]`; vlasnik skida sa GitHub Actions ili ti instaliraš na njegovu reč (`adb install -r`, nikad brisanje podataka/sesije).
7. Na kraju svakog paketa: URADIO → DOKAZAO → NIJE DOKAZANO → SLEDEĆE, i registar ažuriran po pravilima repozitorijuma (bez lažnog zelenog).

---
(Ispod ide velika komanda „USKOČI — ULTIMATE PRODUCT TAKEOVER“ bez izmena.)
