# Uvod koji ide ISPRED velike komande „USKOČI — ULTIMATE PRODUCT TAKEOVER“ (zalepiti zajedno, uvod prvi)

Redosled za vlasnika: (1) prvo `START_PROMPT_CODEX.md` i sačekati Codexovih pet redova stanja; (2) onda OVAJ uvod + velika komanda u jednoj poruci; (3) primedbe po ekranu svojim rečima.

Verzija 2 (8. 10. kasno uveče) — vlasnik: „ne želim da se hvata nacrta proizvoda, već da analizira sve, šta valja, i napravi još bolje… da ga ovo ne graniči da radi opet blizu ovoga što je sad, bez slobode i kreacije.“ Prva verzija (nacrt važi, ne diraj današnje ekrane, bez novog audita) je povučena; čvrste ostaju samo vlasnikove odluke i server-pravila.

---

UVOD (važi iznad komande ispod):

1. Paket `docs/implementation/handoff-codex-20261008/` i registar `docs/control/redovi.json` su ti ULAZ — stanje istine (šta postoji, šta je dokazano i na kom nivou, gde su zamke), ne plafon. Analiziraj ceo proizvod iznova, slobodno, i napravi bolje. Ono što je u preseku označeno kao rešeno ne radi ponovo isto — ali smeš da ga prevaziđeš.
2. Nacrt `docs/implementation/ui-ux-pass-20261002/NACRT_PROIZVODA_20261008.md` je odobren kao PRAVAC, ne kao granica; `ANALIZA_EKRANA_TELEFON_20261008.md` (pravila J1–J15), `KREATIVNI_PRAVAC_20261008.md`, `AIRBNB_OSECAJ_SPEC_20261008.md` i istraživanja R1–R4 su ulaz za tvoju analizu. Dokumente koje komanda pominje a nema ih u repozitorijumu (Screen Atlas, Master Design Synthesis, Idealno korisničko iskustvo, Master Execution Spec, Design Master) ne tražiti.
3. Čvrste su samo vlasnikove odluke (`docs/authority/OWNER_DECISIONS_20261008.md` + AGENTS.md §3.5–3.6): jedno ime za sve; pregled pre objave = javni zadatak sa tačnom adresom vidljivom samo vlasniku; kalendar Mesec/Nedelja/Dan; Zadaci: mapa ceo ekran, lista kao sheet odozdo, traka tabova sakrivena dok je lista dole, pretraga odvojena od filtera, kapsule nad mapom, ulaz „nisu na mapi“, „Na daljinu“ prva i označena, kartica pina dole; skorašnje pretrage brišu se pri odjavi; „ti“ bez roda; crn tekst, siv prateći, bele površine, 2.5D artwork; zelena primarna radnja; tri taba; Početna sa dva velika polja; AI razgovor nalik Gemini. I te odluke smeš da osporiš — ali sa skicom ili slikom sa emulatora i pitanjem, nikad ćutke.
4. Gde se komanda i nacrt razlikuju (vođeni čarobnjak pretrage vs. pretraga ceo ekran sa predlozima; prekidač Mapa/Lista vs. sheet), ne primenjuj nijedno bez pitanja: pokaži vlasniku oba, on bira. Njegova sklonost 8. 10. uveče (nije odluka): pretraga možda pripada listi, ne mapi — polje tek kad je lista gore, ILI potvrđena pretraga odmah podiže listu sa rezultatima. Pokaži.
5. Današnji ekrani (talas 4e0ea506, na vlasnikovom telefonu) su verzija koju treba PREVAZIĆI, ne čuvati. Pravilo: „pokaži pre nego što zameniš“ — predlog po ekranu (skica ili slika sa emulatora, grana po želji), vlasnik kaže da/ne, pa tek onda na glavnu granu. Eksperiment je jeftin: vraćanje ide po fajlu.
6. Server: DEV `leqcwgzvjsxugfgzdmth`, ledger 235, digest 3a785d42. Svaka promena stanja na DEV-u, Edge, podaci, sertifikat, push, zavisnosti = pre toga vlasnikova reč, sa preflight-om i rollback-om (RETIRE-V1 i PUSH-KAPACITET su pripremljeni i čekaju tu reč). Ovo nije dizajn-pitanje i ne popušta.
7. Jedan agent po checkout-u: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN-spoj-20261006` (grana `integration/spoj-20261006` = `work/uskoci-ui-unification-20260924` na remote-u `novi`); push na obe grane; APK za telefon = push na `visual/phone-<datum>-<n>` bez `[skip ci]`; na telefon samo `adb install -r` na njegovu reč, nikad brisanje podataka/sesije.
8. Na kraju svakog paketa: URADIO → DOKAZAO → NIJE DOKAZANO → SLEDEĆE; registar bez lažnog zelenog.

---
(Ispod ide velika komanda „USKOČI — ULTIMATE PRODUCT TAKEOVER“ bez izmena.)
