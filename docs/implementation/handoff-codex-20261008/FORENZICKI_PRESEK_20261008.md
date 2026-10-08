# USKOČI — forenzički presek stanja, 8. oktobar 2026 (predaja Codexu)

**Ko piše:** Claude Code (sesija vlasnikovog telefona 8. 10.; model sesije Fable 5.1 u trenutku pisanja — promenjen u aplikaciji; sav današnji posao na ekranima radili su agenti na Sonnet 5.5, serverski paket na Opus 5.5). **Vlasnikov nalog, doslovno:** „ti se spremi da predaš dalje rad kodeksu… ultra detaljno forenzički presek šta je završeno, šta nije, u kom folderu se nalazi, koji GitHub, koji Supabase, kakvo je stanje… kao kompletan stručni tim za svaku oblast… šta je na pola, šta treba usavršiti, očistiti, povezati, poboljšati, očistiti uska grla, unaprediti i spremiti za predaju kodeksu.“

**Kako čitati nivoe istine (ista lestvica kao u P6 zatvaranju):** IZVOR (kod + testovi) → CI → DEV PRIMENJENO (server) → APK IZGRAĐEN → LABORATORIJA (web prikaz, lažni podaci) → EMULATOR → TELEFON (vlasnikov HONOR). Ništa ispod „TELEFON“ nije prihvaćeno kao gotovo za korisnika; „zeleni testovi“ nikad ne znače „radi na telefonu“ (AGENTS.md 3.2.4).

---

## 0. Gde je šta (adrese, grane, projekti)

| Šta | Gde | Stanje 8. 10. ~18:30 |
|---|---|---|
| **Radni checkout (integracioni, jedini pisac)** | `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN-spoj-20261006` | grana `integration/spoj-20261006`, HEAD **`4e0ea506`**, radno stablo ČISTO (sve komitovano) |
| **GitHub (živi remote `novi`)** | `https://github.com/uskocibusiness-boop/USKOCI-EAN` | `work/uskoci-ui-unification-20260924` = `integration/spoj-20261006` = `visual/phone-20261008-3` = **4e0ea506**; rezervni snimak `backup/telefon-20261008-1` (57d051b3, radno stablo pre integracije — može se obrisati kad se potvrdi 4e0ea506); kandidati `candidate/inbox-naslov-20261008` (1428e16c, PRIMENJEN), `candidate/discovery-grad-20261008`, `candidate/match-v1-20261007`, `candidate/profile-trust-20261007`; istraživanje `explore/varijante-20261008` (bcc9e87d, 75 fajlova varijanti, NIJE u aplikaciji) |
| **GitHub (stari remote `origin`)** | `https://github.com/Uskoci1/USKOCI-CLEAN` | istorijski; podrazumevana grana `clean-alpha-backend` je stara i NIJE radna linija (AGENTS 3.3.1); workflow_dispatch radi samo za workflow-e koji postoje na njoj |
| **Supabase DEV/ALPHA (kanonski, jedini server)** | projekat **`leqcwgzvjsxugfgzdmth`** | ledger **235** migracija (86 `dev_alpha_*` primena), poslednja `20261008133853 dev_alpha_inbox_naslov_application`; sertifikat zatvaranja `closure_source_digest_v5` = **3a785d42…**, program brisanja **2027655d…**, `certificateReady = true`; **11 Edge funkcija ACTIVE** (ai-interview v53, location-search v14, publication-evaluate v14, data-export-worker v14 (verify_jwt off), data-export-download v14, worker-interview v18, speech-session v15, qa-classify v13, push-transport v22 (verify_jwt off), media v14, account-closure-worker v4 (verify_jwt off)) |
| **Produkcioni Supabase** | NE POSTOJI | odluka R04: NOV projekat sa plaćenim planom pre prvog pravog korisnika; DEV ostaje test |
| **Play Console / potpisivanje** | NE POSTOJI | paket `rs.uskoci` trajno; danas se instalira `rs.uskoci.preview` (visual QA APK, versionCode 35) |
| **Telefon** | HONOR, adb serial `A8QDVB6522001205` | instaliran APK iz 4e0ea506 (`adb install -r`, 18:07, prijava sačuvana); vlasnik ga sada gleda |
| **Registar statusa (JEDINI)** | `docs/control/redovi.json` → `stanje.json`, `FINALIZATION_MATRIX.md`, `out/tabla.html` (artefakt https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t) | **ZASTAREO**: osvežen 04:33 UTC na glavi ba5d8369; ne nosi današnji talas ni INBOX-NASLOV (ledger 234 → 235). Osvežavanje je prva stavka za Codex (odeljak 6) |
| **Pravilnik** | `AGENTS.md` (= `CLAUDE.md`) | obavezan; vlasnikova stojeća naređenja iz ove sesije su u odeljku 7 |
| **Nacrt proizvoda (odobren)** | `docs/implementation/ui-ux-pass-20261002/NACRT_PROIZVODA_20261008.md`; skice na platnu https://claude.ai/artifact/6fzbWbjPoRbhKP19d9edX1 i galerija za telefon https://claude.ai/artifact/VLiAKoN5NxvfXqzETGQq12 | vlasnik: „Odobravam“ (pre nego što je video pojedinačne ekrane), pa dve dopune (R2 pregled pre objave = javni zadatak; Z5 kalendar mesec/nedelja/dan) |
| **Analiza telefona + pravila J1–J15** | `docs/implementation/ui-ux-pass-20261002/ANALIZA_EKRANA_TELEFON_20261008.md` | ugovor za svaki ekran |
| **Prethodna predaja Codexu** | `docs/implementation/handoff-codex-20261002/` | istorijska; važe samo delovi koje ova stranica ne menja |
| **Vlasnikove slike telefona (44)** | sesija Claude Code, `C:\Users\user\.claude\uploads\76affeda-95a8-4142-8648-3324aae3af63\` (spisak sa opisom: scratchpad `VLASNIK_TELEFON_20261008.md`) | nisu u repou (privatno) |

**Sporedni worktree-ovi** (git worktree list, 37 unosa): većina je istorija prethodnih talasa (`USKOCI-CLEAN-p1..p4`, `-cb1`, `-d140a`, `-p0e`, kandidati `-grad-20261008`, `-inbox-naslov`, `-match-20261007`, `-trust-20261007`, `.claude/worktrees/*`). Nijedan nije radni; `git worktree prune` + brisanje foldera kandidata čiji su paketi primenjeni je čišćenje (odeljak 6).

---

## 1. Proizvod — šta postoji, po toku (produkt arhitekta)

Četiri toka iz nacrta, svaki od početka do kraja; nivo istine po koraku.

### T1 Tražim pomoć
| Korak | Ekran / fajl | IZVOR | DEV | TELEFON |
|---|---|---|---|---|
| Početna → „Objavi zadatak“ | `src/app/(app)/index.tsx`, `src/ui/home/HomePresentation.tsx` | ✔ (danas prerađeno: „Sledeće“, „Čeka te“ ≤3, „Mogu odmah“) | — | gledano 8. 10. na 6a7b7ac (stara verzija); nova NIJE |
| Razgovor sa asistentom (tekst + glas) | `src/app/(app)/nova.tsx`, `src/ui/v2/IntakePresentation.tsx`, `src/ui/aiFirst/**`; Edge `uskoci-ai-interview` v53, `uskoci-speech-session` v15 | ✔ (danas: kraj razgovora = jedno dugme, polje nestaje) | ✔ | kraj izmene sa serverskim tekstom se u klijentu PRESLIKAVA („Otvori pregled izmena…“) — krhko; Edge tekst treba promeniti (odeljak 5) |
| Pregled pre objave | `src/app/(app)/pregled-zadatka.tsx`, `src/ui/objava/{ReviewPresentation,ReviewDetail,reviewAsTask,EditPencil,useReviewPerson}` | ✔ NOVO danas (agent V): ekran JE javni zadatak (kartica + detalj), privatna adresa samo vlasniku, olovke „Izmeni“, logika objave ista; 634 testa | — | NIJE viđeno nigde osim testova |
| Objava → „Objavljeno“ | `src/ui/objava/PublishedMoment.tsx`, `rpc_accept_*`, `uskoci-publication-evaluate` | ✔ | ✔ | ranije dokazano na telefonu (stari izgled) |
| Moj zadatak (detalj) | `src/app/(app)/potrebe/[id]/pregled.tsx`, `src/ui/v2/NeedPresentation.tsx`, `src/ui/v2/detail/TaskStateBlock.tsx` | ✔ danas (blok stanja, „Izmeni“ gore, „Otkaži“ dole, ⓘ) | — | NIJE |
| Prijave → izbor → „Dogovoreno!“ | `potrebe/[id]/kandidati.tsx`, `src/ui/v2/ApplicationSelectionPresentation.tsx`, `DogovorenoMoment.tsx`; `rpc_select_response` | ✔ (redosled po ceni/oceni samo za celu učitanu listu) | ✔ | starije verzije dokazane |
| Dogovor → termin → „Zadatak je gotov“ → potvrda → ocena | `src/app/dogovor/[id].tsx`, `src/ui/agreements/**`, `src/ui/v2/AgreementPresentation.tsx`; `rpc_mark_work_done`, `rpc_confirm_*`, `rpc_submit_review` (D12 komentar primenjen, klijent iza `EXPO_PUBLIC_D12_REVIEW_COMMENT`) | ✔ danas (radnje vidljive, koraci bez preloma, ⓘ) | ✔ | NIJE sa novim izgledom |

### T2 Uskačem
| Korak | Ekran / fajl | IZVOR | DEV | TELEFON |
|---|---|---|---|---|
| Zadaci: mapa + lista | `src/app/(app)/zadaci.tsx`, `src/ui/v2/DiscoveryPresentation.tsx` (1.4k redova), `src/ui/v2/discovery/**` (DiscoverySearchBar, DiscoveryChipRow, DiscoverySearchPanel, SearchSheet, recentSearches, taskDistance, zadaciBar, MapCredits), `(app)/_layout.tsx` (traka tabova apsolutna + `ZadaciBarContext`); čitač `rpc_discovery_v1` (P6 + DISCOVERY-ZAMENE + DISCOVERY-GRAD) | ✔ danas (agent Z, 1.000 testova): cela mapa, lista dole, traka tabova skrivena dok je lista dole, pilula pretrage + ODVOJENO okruglo dugme filtera, kapsule (Za mene · **Na daljinu** · Danas · Ovaj vikend · Sa iznosom), „N nisu na mapi ›“, kartica pina skroz dole, „Moja lokacija“ (centrira, udaljenost), bez +/−, bez „0/1“, skorašnje pretrage (brišu se pri odjavi) | ✔ | **NIJE** (najrizičniji ekran: gorhom list + apsolutna traka tabova + animacija — prva stvar koju Codex proverava na telefonu) |
| Detalj tuđeg zadatka → ponuda | `(app)/prilike/[id].tsx`, `src/ui/v2/PublicNeedPresentation.tsx`, `prilike/[id]/prijava.tsx`, `ApplicationComposerPresentation` | ✔ (dole samo „Pošalji ponudu“/„Pošalji prijavu“ — vlasnikov izbor; ⓘ na ceni i adresi) | ✔ | NIJE |
| Moje prijave | `(app)/moje-prijave.tsx`, `src/ui/v2/MyApplicationsPresentation.tsx` | ✔ (grupe Čeka odgovor/Izabrana/Završene; `nova=1` označava upravo poslatu) | ✔ (EX-04 S2 straničenje, flag OFF) | NIJE |
| Radni profil + područje + dostupnost | `(app)/profil/radnik.tsx`, `lokacija.tsx`, `dostupnost.tsx`, `src/ui/workerProfile/**`, `src/ui/calendar/AvailabilityForm.tsx` | ✔ danas (agent R: kartica „Kako te vide kad uskačeš“, bez polja imena, „Mogu odmah“, jedna kontrola radijusa) | ✔ | NIJE |
| Raspored (kalendar) | `(app)/raspored.tsx`, `src/ui/calendar/{AgendaScreen,MonthView,WeekDays,DayView,DayCell,DayBlock,PeriodControls,LooseTerms,calendarViews,entryText,roleTone}` | ✔ NOVO danas (agent K, 627 testova): Mesec · Nedelja · Dan, „Danas“, ⓘ legenda, traka bez termina, osenčeni dani dostupnosti, linija „sada“ | ✔ (čita `rpc_get_worker_availability` + `mojRadnikProfil` dodatno) | **NIJE**; rizik: rotirani tekst „Mogu da radim“, blokovi pri fontu 1,3 |

### T3 Šta me čeka
Početna „Čeka te“ (≤3, sa naslovom zadatka) → tačan ekran; Raspored = SAMO Dogovori; Obaveštenja = istorija (sada sa naslovom zadatka iz servera, INBOX-NASLOV); Poruke = razgovori (zbijeni redovi, bez katanca). IZVOR ✔, DEV ✔ (INBOX-NASLOV 235), TELEFON NIJE.

### T4 Nalog
Profil (tri odeljka + „Kako te drugi vide“) → Lični podaci (JEDINO mesto imena; upis u nalog + radni profil sa iskrenom porukom pri neuspehu drugog upisa) · Obaveštenja (jedan ekran) · Pomoć (Podrška, Prijavi grešku) · Privatnost (čvorište sa stanjem) · O aplikaciji · Odjavi se. IZVOR ✔ danas (agent R, ~2.070 testova), DEV ✔, TELEFON NIJE. Fotografija: keš sopstvene slike u memoriji (`src/ui/media/ownPhotoCache.ts`, agent F, 44 testa) — treptanje „M“ bi trebalo da nestane; NIJE provereno na telefonu.

---

## 2. Ekran po ekran — šta je završeno, na pola, nije (dizajner + UX)

Legenda: **ZAVRŠENO** = po odobrenom nacrtu, testovi zeleni; **NA POLA** = kod postoji, ali ili fali dokaz, ili zavisi od servera/odluke; **NIJE** = nije rađeno.

| Ekran (nacrt) | Stanje | Šta fali / rizik |
|---|---|---|
| U1 Zadaci — mapa | ZAVRŠENO u izvoru | telefon; redosled „Najbliže“ NE postoji (server nema kursor po udaljenosti); udaljenost samo posle „Moja lokacija“ (područje rada nije tačka) |
| U2 lista do vrha | ZAVRŠENO u izvoru | `Skeleton.tsx` varijanta kartice ne zna za novu oznaku (kozmetika) |
| U3 kartica pina | ZAVRŠENO u izvoru | telefon (EX-03 merenja halo/kartica ostaju važeća samo za stari raspored — ponoviti) |
| U4 pretraga | ZAVRŠENO | deo grada se više ne bira kucanjem (nacrt to nema) — vlasnik nije rekao da mu fali |
| U5 filteri | ZAVRŠENO | bez „Redosled“ (nacrt ga crta; server ne ume) |
| U6 detalj tuđeg zadatka | ZAVRŠENO | „Objavio“ (`TaskDecision.tsx:159`) je rodno obojeno — vlasnikova formulacija; „Pitanja (N) ›“ je inline deo rute |
| U7 ponuda | ZAVRŠENO | — |
| U8 Moje prijave | ZAVRŠENO | broj nepročitanih 1:1 = „nepoznato“ (ugovor čitanja V1) |
| R1 razgovor | ZAVRŠENO | serverski završni tekst izmene (Edge) — klijent preslikava |
| R2 pregled pre objave | ZAVRŠENO (v2) | NIKAD viđeno (ni laboratorija); `PublicNeedPresentation` nije dobio režim pregleda — paritet drži test `review-detail-parity` |
| R3 Moj zadatak | ZAVRŠENO | lica prijavljenih su generički avatari (prava lica = čitanje kandidata); „Objavljen pre N sati“ čeka `publishedAt` sa servera |
| R4 Prijave | ZAVRŠENO | redosled po ceni/oceni samo kad je cela lista učitana (server sortira po dolasku) |
| R5 Moji zadaci | ZAVRŠENO (talas W + T) | `src/ui/v2/ownTaskTabs.ts` verovatno mrtav kod (proveriti) |
| Z1 Početna | ZAVRŠENO | „Danas · 14:00–16:00“ (ne „u 14“ kao na skici); razmak „Sledeće“/„Čeka te“ neviđen |
| Z2 Dogovor | ZAVRŠENO | „Dogovoren“ (lista) vs „Dogovoreno“ (koraci) — **vlasnikova odluka čeka**; „⋯“ u Porukama Dogovora ostaje — odluka čeka |
| Z3 Dogovor — poruke | NIJE DIRANO danas | glas B1 primenjen (ledger 215), B2 nije |
| Z4 Dogovori | tekst ✔, izgled nedirnut (vlasnikov izbor) | grupa „Termin još nije dogovoren“ |
| Z5 Raspored (kalendar) | ZAVRŠENO (v2) | NIKAD viđeno; vidi rizike gore |
| Z6 Poruke | ZAVRŠENO | — |
| Z7 Obaveštenja | ZAVRŠENO + server | — |
| P1 Profil | ZAVRŠENO | `ClosureDialog.tsx` i dalje ima rečenicu (J5) — test je očekuje |
| P2 Lični podaci | ZAVRŠENO (jedno ime) | AI predlog radnog profila i dalje nosi `displayName` (klijent ga prepisuje) |
| P3 Radni profil | ZAVRŠENO | „Mogu odmah“ ima dva ista koda (Početna i Radni profil) — izdvojiti |
| P4 Podešavanja obaveštenja | ZAVRŠENO | dužina „Napredno“ neviđena |
| P5 Privatnost | ZAVRŠENO | Zatvaranje naloga (ClosureDialog) nije po J5 |
| Ulaz/prijava (F7, 8. 10. jutro) | ZAVRŠENO ranije | EX-07 S03 klasifikator usklađen (d3e02489) |
| Ocena, javni profil, prvi razgovor | talas W (jutro) | nisu u današnjem talasu |

**Jezik dizajna (stanje):** jedna lestvica razmaka 4/8/12/16/24/32/48 i ivica 20 (`src/ui/system/layout.ts`), tokeni samo iz `src/ui/system/tokens.ts` (ratchet testovi `one-token-source`, `glyph-import-guard`, `rule-width-ratchet`, `surface-kinds-ratchet`, `layout-ladder` ZELENI), 2.5D sličice (`FactArt`) sa bojama uloga (mesto smaragd `#0F8C61` — vlasnikov recolor 8. 10., ljudi koral, vreme zlatna, asistent plava), linijske ikonice za komande (`Glyph` 16/20/24), ⓘ (`src/ui/system/InfoButton.tsx`) za objašnjenja, spinner za povlačenje samo pri povlačenju (`usePullRefresh`), datum „9. okt“ (`displayDate` ručno), „Fleksibilno“ jedna reč, „ti“ bez roda.

---

## 3. Kod (inženjer)

- **Veličina:** 697 izvornih .ts/.tsx (bez testova), 582 test fajla, 25 ruta u `src/app/(app)` + `src/app/dogovor/**` + galerije `src/app/dizajn-*.tsx` (lažni podaci; obavezne za laboratoriju).
- **Provere na 4e0ea506:** `npx tsc --noEmit` **0 grešaka**; pun Jest **13.286 / 13.286** (570 s, `--maxWorkers=6`). CI na toj glavi: 10 zelenih dokaza (PKG-049, Location route seed, R20, EX-06E, D12, PKG-006, EX-07 S06, EX-04 S2, P5, P7), **1 crven: „P6 native journey“ — pada u koraku „Download and verify the proof APK, Evidence gate“: pinovani dokazni APK artefakt (run 36702278038) je ISTEKAO (HTTP 404). Infrastruktura, ne proizvod; treba nov dokazni APK i nov pin (vlasnikova reč, jer menja dokazni ugovor).**
- **Arhitektura:** Expo 57 / React Native 0.86 / React 19.2 / expo-router 57; Reanimated 4.5.1 (sa jednom odobrenom `patch-package` zakrpom B22/RNR-01); `@gorhom/bottom-sheet` 5.2.14; MapLibre 11.3.10; `expo-location` ~57.0.20 (uslovno odobren R15 — „Moja lokacija“ ga koristi jednokratno, uz dozvolu, ništa se ne čuva). Podaci kroz `src/data/*ClientService.ts` → Supabase RPC (`supabaseKlijent`), ugovori u `src/contracts/**`, sesija `src/store/sesija`.
- **Nove sistemske primitive danas:** `InfoButton.tsx`, `usePullRefresh.ts`, `src/ui/media/ownPhotoCache.ts`, `src/data/recentSearchesKey.ts`, `src/ui/v2/discovery/zadaciBar.ts` (traka tabova), `src/ui/calendar/calendarViews.ts`, `src/ui/objava/reviewAsTask.ts`.
- **Mrtav / sumnjiv kod (čišćenje):** `src/ui/v2/ownTaskTabs.ts` (verovatno nekorišćen), `availabilityShade.dayAvailability` zamenjen sa `availabilitySpans` (proveriti da nema pozivalaca), `Skeleton.tsx` komentar o uklonjenom `ReviewPreview` + varijanta `preview` crta staru karticu, `src/ui/notifications/{NoticeSwitchRow,TimedRow}.tsx` (agent P predlaže spajanje u `SettingsSwitchRow`/`ListRow` — tada se brišu), dva ista koda za „Mogu odmah“ (`index.tsx` i `radnik.tsx`), `DiscoveryMap.web.tsx` samo za laboratoriju.
- **Vozači nativnih proba (ažurirani danas, NEPOKRENUTI):** `scripts/p6_native_journey.py`, `scripts/p6_dev_emulator_check.py`, `scripts/ru5_android_device_ui_journey.py`, `scripts/d03_chat_android_journey.py` („Zadatak je gotov“ + potvrda), `scripts/task_detail_android_journey.py`, `.maestro/walkthrough.yaml`, `.maestro/send-offer.yaml`. **Zastareli i pre danas:** `.maestro/send-offer.yaml`, `ai-welcome.yaml`, `my-applications.yaml` traže natpise kojih nema ni na HEAD-u („Piši umesto da govoriš“, „Vidi sve“) — popraviti ili obrisati.
- **Lint laboratorije:** `scratchpad/lab/cdpl.cjs` (nije u repou; metoda je opisana u memoriji sesije) — za Codex: laboratorija = `npx expo start --web` sa FAKE izvorom; **upozorenje:** pod opterećenjem (više agenata) Metro raste do 8 GB i prestaje da odgovara; danas NIJEDAN današnji ekran nije viđen u laboratoriji (sve kapture su bile splash) — zato je telefon jedini vizuelni dokaz.

---

## 4. Server (Supabase) — stanje i istina (backend)

- **Ledger 235** (`supabase_migrations.schema_migrations`), potvrde `supabase/operations/dev-alpha/ledger/*.receipt.json` (63). Danas: **INBOX-NASLOV (235)** — `rpc_list_inbox` vraća `taskTitle` (prosrc b7928c50 → bd46f06f); juče/noćas: ZONE-PERF 228, CANCEL-INFO 229, PROFILE-TRUST 230, MATCH-V1 231, DISCOVERY-ZAMENE 232, MATCH-V1B 233, DISCOVERY-GRAD 234. Svi sa dokazom na jednokratnoj bazi (FAIL pre / PASS posle, tačan revert), sertifikat nepomaknut.
- **Sertifikat zatvaranja naloga:** `closure_source_digest_v5 = 3a785d42…`, `closure_erasure_program_digest_v5 = 2027655d…`, `certificateReady = true`. Svaki paket koji pomera digest traži izolovanu resertifikaciju + vlasnikovu izričitu reč (AGENTS 3.1.4).
- **Prekidači (`private.marketplace_config`):** `match_v1_dispatch` {mode ALL, ceiling 10000, remoteWaves true, waveSize 300→1000/30 min, workerNotifyPerTransaction 1000, workerDailyCap 1000 (OFF po smislu)}; `profile_trust_visibility` **OWN_ONLY**; `received_reviews_detail` **COMMENTED_ONLY**; `urgent_activation_policy` **enabled false**, allowedCategories [] (HITNO ugašeno; vlasnik 2. 10.: „uključi i HITNO“ — čeka paket + kanonski registar kategorija); `platform_payments` **enabled false**; cenovnik `platform_price:*` na 0 RSD; `work_kinds_head` 11 vrsta posla (ELEKTRO/VODOINSTALATER „unknown“ politika po A15).
- **Podaci na DEV-u (5 naloga, svi test):** 48 zadataka (7 PUBLISHED, 3 ACTIVE, 1 SELECTION, 4 DRAFT, 20 EXPIRED, 10 CANCELLED, 3 COMPLETED), 16 prijava, Dogovori 3 CONFIRMED / 4 COMPLETED / 3 CANCELLED, 89 događaja; app_profiles 5 WORKER + 5 REQUESTER. **Push isporuke:** 1 SENT, **1 CREATED (zaostala, od d15 zatvaranja 7. 10. — povući pre uključivanja slanja)**, 8 EXPIRED, 79 SUPPRESSED.
- **Push:** slanje ISKLJUČENO; Edge `uskoci-push-transport` v22 šalje najviše 1/min (`rpc_claim_push_transport` limit 1) → **PUSH-KAPACITET** paket je preduslov; 3 stare isporuke (2 WORKER + 2026-09-26 pokušaj) ostaju netaknute (A24); prvi pravi push = jednociljni paket na vlasnikovu tačnu reč (3.1.7). Podsetnik pred termin (P05) ne postoji.
- **Nije primenjeno (kandidati u `supabase/candidates/`, „source only“):** pkg023c (ZABRANJENO), pkg023i (konflikt sa 023c), `discovery-grad` deo **S3** (svoja reč), dve privatnosne grane (AI minimizacija d18e830a, inventar obrađivača 1ab01e78 — odložene do završnog prolaza), chat B3a/B3b/B3c, P4 push event transport, EX-05 RC-02, AI-location-01, voice B2. Svaki ima svoj README sa uslovima.
- **Edge:** 11 funkcija (tabela u odeljku 0). Tekstovi za Codex: `supabase/functions/_shared/pushNotificationCopy.mjs` („ti“); 28 predloga teksta iz `TEKSTOVI_PREDLOZI_20261007.json` traže Edge deploy = vlasnikova reč; deploy preko konektora rešava `\u` sekvence — čitati nazad i bajt-porediti (memorija `uskoci-edge-deploy-via-connector-caveat`); vlasnikov CLI deploy je bajt-tačan put.
- **Poznata svesna razlika od RLS-a (INBOX-NASLOV):** radnik koji se prijavio na kasnije otkazan zadatak vidi NASLOV tog zadatka u obaveštenju o otkazivanju (zadatak sam ne vidi). Vlasniku rečeno; revert postoji (`revert.sql` 97be7afa).

---

## 5. Šta traži server ili vlasnika (ne može klijent sam)

1. **PUSH-KAPACITET** (limit 1/min → razuman batch) + povlačenje 1 CREATED isporuke + jednociljni prvi push — vlasnikova reč za slanje.
2. **HITNO** (`urgent_activation_policy`): kanonski registar kategorija + allowlist + klijent; vlasnik: „Uključi i HITNO i push“.
3. **`publishedAt`** u vlasnikovom čitanju zadatka (`rpc_read_own_need`/odgovarajući) → „Objavljen pre N sati“ (klijent spreman: `NeedPresentation` prima `publishedAt`).
4. **Redosled prijava/kandidata po ceni i oceni** u straničenju (EX-04 S4/A11 sada sortira po dolasku).
5. **Redosled „Najbliže“ / kursor po udaljenosti** u `rpc_discovery_v1` (ako se želi; nacrt ga crta).
6. **Edge `uskoci-ai-interview` REVIEW korak za izmene:** završna rečenica „Otvori pregled izmena. Tamo ih potvrđuješ.“ (klijent danas preslikava tačan stari tekst — krhko); isto: predlog radnog profila neka ne nosi `displayName` (klijent ga prepisuje imenom naloga).
7. **Broj nepročitanih 1:1 poruka** u ugovoru inboxa razgovora (sada „nepoznato“).
8. **Dokazni APK za P6 native journey** (istekao artefakt) — nov pin = vlasnikova reč.
9. **Odluke:** „Dogovoren“ vs „Dogovoreno“ (jedna reč), „⋯“ u Porukama Dogovora, „d“ bez kvačice → „đ“ (DISCOVERY-GRAD), S3 primena, da li zvezda-crtež (PNG) — vlasnikov alat/Codex.
10. **Produkcija:** nov Supabase projekat (R04) sa svim kandidatima u istom redosledu (B24 oba dela, MATCH-V1, V1B, DISCOVERY-ZAMENE, GRAD, INBOX-NASLOV…), Play Console + paket `rs.uskoci`, pravni tekstovi (operater + pravnik), izbacivanje vlasnikovih naloga iz TEST sveta (pkg029e), dva privatnosna paketa, test na dva telefona (11/32 do sada).

---

## 6. Uska grla, čišćenje, povezivanje (prioritet za Codex)

**A. Dokaz na telefonu (jedino što nedostaje da bi današnji talas bio „gotov“):** vlasnik upravo gleda APK 4e0ea506. Codex: (1) sačekaj vlasnikove primedbe po ekranu; (2) ako treba vratiti ekran na stariju verziju, svaki je svoj deo komita 4e0ea506 — `git log --oneline -- <fajl>` pa `git checkout <stari sha> -- <fajl>` uz testove; cela prethodna verzija = 6a7b7ac7 (visual/phone-20261008-2). (3) Nativna proba na emulatoru `USKOCI_V5_TEST` (1264×2728, 560 dpi, font 1,15, Europe/Belgrade) za: Zadaci (lista/traka tabova/pin/„Moja lokacija“), kalendar (3 prikaza, font 1,3), pregled pre objave, Lični podaci (upis imena u oba profila), fotografija (bez „M“).

**B. Registar:** `docs/control/redovi.json` ne nosi današnji dan. Uraditi: `dev_snapshot.json` osvežiti (`docs/control/dev_snapshot.sql` read-only na DEV), upisati u redove A01, A06 (pregled), A08, A09, A11, B01–B06, B10, B12 (kalendar), D01–D02, P01–P02, N05, N11 današnje stanje (IZVOR ✔ / telefon ✖), `node scripts/control/osvezi.mjs`, `node scripts/control/osvezi-master-plan.mjs --html … --check`, komit, republish `docs/control/out/tabla.html` na artefakt VxTvL3VpwhYv8cxJCWzD5t. **Upozorenje:** bot komit „docs(control): regenerate tracker views“ posle push-a menja `stanje.json` (`"ci": null`) i čini push non-fast-forward → `git rebase novi/work/...`.

**C. Čišćenje:** mrtav kod iz odeljka 3; zastareli maestro fajlovi; `git worktree prune` + folderi primenjenih kandidata (`USKOCI-CLEAN-inbox-naslov`, `-grad-20261008`, `-match-20261007`, `-trust-20261007`); grana `backup/telefon-20261008-1` posle potvrde; `.claude/launch.json` u audit worktree-u (lokalno, ne komitovati); `explore/varijante-20261008` ostaje kao istorija (ne spajati).

**D. Povezivanje (klijent čeka server):** redovi iz odeljka 5 (3, 4, 5, 7) — čim server da polje, klijent je već spreman (`publishedAt`, `taskTitle` gotovo, redosled).

**E. Performanse:** EX-03 merenja (halo 85/91 ms, kartica 71/78 ms, povratak 162/218 ms) važe za STARI raspored Zadataka — ponoviti na HONOR-u sa novom listom; B22 (Reanimated zakrpa) nije zatvoren (motion probe + vlasnikova reč); „vidljiv povratak na mapu 1–2 s“ otvoren.

**F. Dva pravila koja se danas krše svesno (vlasnikova odluka ima prednost):** AGENTS 3.6.2 „donja navigacija uvek pokazuje gde si“ — na Zadacima je sakrivena dok je lista dole (vlasnik, 8. 10.); AGENTS „bottom bar only on the three roots“ — nepromenjeno. Zapisati u AGENTS.md kao vlasnikovu izmenu pravila kad se potvrdi na telefonu (klasifikator je ranije odbio neke AGENTS.md izmene — ne pokušavati zaobilazno; ako odbije, zapisati u `docs/authority/`).

---

## 7. Vlasnikova stojeća naređenja iz ove sesije (doslovno gde postoji)

- „DA, PRIMENJUJ DOKAZANE PAKETE SAM. MATCH-V1: 5000“ (7. 10.) — dokazani serverski paketi se primenjuju bez posebnog pitanja; i dalje njegova reč: novac/cene, plaćeni ključevi/nalozi, pravni tekstovi, brisanje pravih podataka, prodavnica, PUSH, nove zavisnosti, paketi koji pomeraju sertifikat, privatnosni prekidači, Edge deploy.
- „UBUDUĆE: za destruktivnu ili state-changing DEV/PROD radnju prvo traži moje odobrenje…“ (30. 9.) — čitanje slobodno, pisanje na njegovu reč (osim dokazanih paketa po stojećem nalogu).
- „Može, dobro vam jedno ime za sve.“ (8. 10.) — jedno ime, menja se samo u Ličnim podacima.
- „Odobravam“ (8. 10., nacrt) + dopune: pregled pre objave = javni zadatak; kalendar mesec/nedelja/dan.
- „Nema potrebe da staješ, idi slobodno do 100%, samo nemoj da staješ.“ (8. 10., potrošnja) — za Claude; Codex ima svoj budžet.
- Telefon: „povezao i mobilni telefon, koristi ga za sve — instaliranje, pregled ekrana, tokova“ (8. 10.) — instalacija samo `adb install -r`, nikad brisanje podataka/sesije/odjava, nikad objava/slanje/otkazivanje/brisanje sa njegovog naloga bez njegove reči; dok on gleda, telefon se ne dira.
- Model: Fable 5.1 samo za sintezu/varijante na njegovu reč; svaki pomoćnik mora da kaže na kom modelu radi.
- Kredit: posle vlasnikove reči, danas potrošeno ~90 % nedeljnog limita Claude-a (obnavlja se 13. 10. 21 h).

---

## 8. Metod koji je danas radio (da ga Codex ne ponavlja uzalud)

- **Uzroci pronađeni čitanjem koda/servera, ne nagađanjem:** „09. okt“ = Androidov srpski obrazac datuma (Node piše „9. okt“) → `displayDate` ručno + test; bela tačka u Porukama = Androidov spinner osvežavanja pri svakom čitanju u pozadini → `usePullRefresh`; „M“ umesto fotografije = `AuthorizedPhoto` namerno bez keša + novo čitanje na svaki fokus → keš sopstvene fotografije u memoriji; obaveštenja bez naslova = `rpc_list_inbox` nije nosio naslov → serverski paket.
- **Serverski paket, bezbedno slanje:** read-only preflight → baza izmeri OTKUCANI tekst (`select md5(t), length(t) from (select $q$…$q$::text t) x` = md5 fajla) → `apply_migration` istim tekstom → postflight + `md5(statements[1])` = md5 fajla → smoke u `DO` bloku koji se završava `RAISE EXCEPTION` (ništa se ne upisuje) → potvrda (`scratchpad/integracija/write_application_receipt.py <spec.json>`, kopira paket bajt-tačno u `supabase/candidates/<ime>/` + `APPLIED.md`).
- **Zamke:** `git add --pathspec-from-file` sa već obrisanom putanjom prekida ceo add (7f18ddb6 incident) — koristiti `git add -A -- <dirs>` i `&&`; CRLF: fajlovi u radnom stablu CRLF, index LF (`core.autocrlf=true`), paketi se izvoze `git show` (LF); Python u scratchpad-u: `python -P` (lokalni `bisect.py` zaklanja stdlib); laboratorija: viewport UVEK `[361,780,2]`, kaptura bez teksta = splash; skice za platno (`.dc.html`) renderuju se tek sa `<meta name=viewport width=390>`.

---

## 9. Urađeno posle preseka (isto veče, pre predaje)

- **Registar osvežen (komit 0515b53f):** `docs/control/dev_snapshot.json` = novo read-only čitanje DEV-a (16:45 UTC: ledger 235, 258 RPC / 182 za authenticated — bez promene skupa, Edge verzije iste, cron 2880/0), 20 redova dobilo zapis `finalization.telefon_20261008_talas` (A01, A02, A06, A08, A09, A11, B01, B02, B04, B05, B06, B10, B12, D01, D02, D03, P01, P02, N05, N11: IZVOR + testovi, TELEFON nije provereno), `osvezi.mjs` + `osvezi-master-plan.mjs --check` OK, LIVE plan regenerisan. Tabla objavljena na https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t (verzija 45). Svetla na redovima su i dalje računata iz polja (nisu ručno menjana): „PROBLEM 41 / NA TELEFONU NIJE PROVERENO 21“ ostaje dok Codex ne upiše dokaze sa telefona.
- **Nije dirano (svesno, da se ne uvede rizik bez dokaza na telefonu):** mrtav kod iz odeljka 3 (`ownTaskTabs.ts` ima samo test koji ga koristi — `task-card-layout-class.test.tsx`; `dayAvailability` JESTE u upotrebi u `AgendaScreen.tsx:142`, nije mrtav), zastareli maestro fajlovi (`ai-welcome.yaml` „Piši umesto da govoriš“, `my-applications.yaml` „Vidi sve“ — natpisa nema u izvoru; popraviti ili obrisati), `ClosureDialog` rečenica (J5), dupli kod „Mogu odmah“. Sve je u odeljku 6C sa putanjama.
- **Potrošnja:** Claude nedeljni limit ~91 % na kraju; Codex nastavlja po START_PROMPT_CODEX.md.

## 10. Drugi prolaz (isto veče)

Vidi `DRUGI_PROLAZ_I_PUSH_RECEPT_20261008.md` u ovom folderu: šta je još rešeno (zatvaranje naloga J5, Maestro tokovi, odluke u autoritetu, jedan upis „Mogu odmah“, uklonjen `ownTaskTabs.ts`) i tačan recept za PUSH-KAPACITET sa uzrokom pročitanim iz radnika i claim RPC-a (nije primenjeno: klasifikator je zaustavio izmenu Edge koda za push; Edge deploy je vlasnikova reč).

## 11. Iskrena ocena kvaliteta

Vidi `OCENA_KVALITETA_20261008.md`: ocena po oblastima (klijent 3,5; server 4 bezbednost / 3 urednost; tokovi zaokruženi vs. isključeni), tehnički dug sa putanjama i redosled da bude „profesionalno do kraja“.

## 12. Plan napred

Vidi `PLAN_NAPRED_20261008.md`: četiri koraka (dokaz na telefonu → čišćenje i učvršćivanje → povezivanje i isključeni tokovi → izlazak), merilo „gotovo“ za svaki, vlasnikove odluke koje to traži, ko šta radi.
