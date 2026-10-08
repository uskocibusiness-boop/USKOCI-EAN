# Plan napred — od stanja 8. 10. 2026 do spremnog proizvoda

Četiri koraka, svaki sa merilom „gotovo“. Codex radi odmah; Claude nastavlja kad se nedeljni limit obnovi (13. 10. u 21 h) ili pre toga na vlasnikovu reč. Vlasnikove odluke su izdvojene, da ništa ne čeka na njih skriveno.

## Korak 1 — Dokaz i doterivanje na telefonu (1–2 dana, Codex + vlasnik)
1. Vlasnik gleda APK 4e0ea506 i šalje primedbe po ekranu (slika + reč). Svaka primedba ima prednost nad nacrtom.
2. Codex: nativna proba na emulatoru `USKOCI_V5_TEST` za Zadaci (lista/traka tabova/pin/„Moja lokacija“), kalendar (3 prikaza, font 1,3), pregled pre objave, Lični podaci (ime u oba profila), fotografija; popravke; po potrebi vraćanje pojedinog ekrana (`git checkout <sha> -- <fajl>`).
3. Nov APK (`visual/phone-<datum>-<n>`), vlasnik potvrđuje ekran po ekranu; registar dobija dokaze sa telefona (svetlo „Telefon“ zeleno samo sa slikom).
**Gotovo kad:** vlasnik kaže „ovako ostaje“ za svaki od 25 ekrana nacrta, a registar to nosi.

## Korak 2 — Čišćenje i učvršćivanje (2–3 dana, Codex)
1. Rez velikih fajlova u module sa testovima: `DiscoveryPresentation.tsx` (≈1.430 redova), `pregled-zadatka.tsx`, `profil/radnik.tsx`.
2. Dokazani prekidači → trajno uključeni, stare grane obrisane (P6 čitač, EX-04 straničenja, D12 komentar kad legalno dozvoli).
3. Server paket **RETIRE-V1**: ukloniti zamenjene verzije funkcija (11 koje aplikacija ne zove, red S04) posle dokaza da ih nijedan APK u opticaju ne poziva; dokaz na jednokratnoj bazi; primena po stalnom nalogu.
4. Repozitorijum: `.gitattributes` LF za sve, stari worktree-ovi i grane, dokumentacija sa jednim živim indeksom.
5. Merenja na HONOR-u za novu mapu (halo, kartica, povratak) i B22 probe; cilj: ništa preko 100 ms do halo-a, bez janka > 1 %.
**Gotovo kad:** tsc 0, Jest zelen, nijedan fajl > 600 redova u `src/ui`, tabla „Server ume, aplikacija ne koristi“ = 0.

## Korak 3 — Povezivanje i isključeni tokovi (3–5 dana, Codex + vlasnikove reči)
1. Serverski paketi koje klijent već čeka: `publishedAt` u vlasnikovom čitanju zadatka; redosled prijava/kandidata po ceni i oceni; broj nepročitanih 1:1; redosled „Najbliže“ (ako se želi). Svaki = kandidat + dokaz + primena po stalnom nalogu.
2. Edge tekstovi (`uskoci-ai-interview` završna rečenica izmene; predlog radnog profila bez imena) — deploy na vlasnikovu reč, bajt-tačan readback.
3. **PUSH-KAPACITET** (recept u `DRUGI_PROLAZ_I_PUSH_RECEPT_20261008.md`) → povlačenje zaostale isporuke → **prvi jednociljni push** (jedan vlasnikov uređaj, jedan događaj) na njegovu tačnu reč → tek onda slanje svima.
4. **HITNO:** registar kategorija + allowlist + klijent (vlasnik: „uključi i HITNO“), paket sa dokazom.
5. Glasovno snimanje u aplikaciji (B2) uz `expo-audio` (odobren A03) — kad korak 1 prođe.
**Gotovo kad:** svaki red registra ima zeleno „Server“ i „Kod“, push radi na vlasnikovom telefonu, HITNO se može uključiti za svoj zadatak.

## Korak 4 — Izlazak (1–2 nedelje, vlasnik + Codex)
1. Vlasnik otvara: NOV produkcioni Supabase (plaćen plan, backup), Play Console (paket `rs.uskoci`, listing, adresa politike privatnosti), pravne tekstove (operater + pravnik).
2. Codex: ceo lanac kandidata na produkciju istim redosledom (B24 oba dela, …, INBOX-NASLOV, RETIRE-V1), izbacivanje vlasnikovih naloga iz TEST sveta (pkg029e), dve odložene privatnosne grane, potpisan AAB, nov dokazni APK za P6 native journey.
3. Test na dva telefona do 32/32; „release candidate“ imenovan; vlasnikov prolaz kroz sve tokove na dva naloga.
**Gotovo kad:** registar 62/62 zeleno sa dokazima za tačnu verziju, prodavnica prihvatila paket.

## Vlasnikove odluke koje ovo traži (čim pre, da ništa ne stoji)
- Reči: „Dogovoren“ ili „Dogovoreno“ (jedna reč); „⋯“ u Porukama Dogovora da/ne; „d“ bez kvačice nalazi „đ“ da/ne; DISCOVERY-GRAD S3 da/ne.
- Push: reč za deploy PUSH-KAPACITET i reč za prvi jednociljni push.
- HITNO: koje kategorije smeju HITNO (allowlist) i da li se naplaćuje (sada 0 RSD).
- Plaćanje: provajder i cene (tek kad odluči — ništa u kodu ne zavisi do tada).
- Izlazak: produkcioni Supabase, Play Console, pravni tekstovi.
- Grana `backup/telefon-20261008-1`: obrisati kad potvrdi 4e0ea506.

## Ko šta radi
- **Codex** (odmah): koraci 1–3 po `START_PROMPT_CODEX.md`, jedan agent po checkout-u, dokazi pre tvrdnji.
- **Claude** (od 13. 10. 21 h, ili ranije na reč): preuzima bilo koji korak; isti pravilnik, isti registar.
- **Vlasnik**: gleda telefon, daje reči iz liste gore, otvara naloge za korak 4.
