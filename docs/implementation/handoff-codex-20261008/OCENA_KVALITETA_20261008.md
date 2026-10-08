# Iskrena ocena kvaliteta koda, servera i tokova — 8. 10. 2026 (za vlasnika i Codex)

Pitanje vlasnika: „kako je trenutno stanje koda, da li je čist, spreman, profesionalan ili ga još treba očistiti, srediti, optimizovati; kakav je Supabase; da li su funkcije povezane i jasne; ima li nezaokruženih tokova, funkcija na pola“. Odgovor po oblastima, sa ocenom 1–5 (5 = nivo na koji bi stao vrhunski tim) i merilom.

## Ukupno: 3,5 / 5 — čvrsta osnova sa disciplinom, ali NIJE spremno za prodavnicu i nosi tehnički dug

Šta je na profesionalnom nivou **već sada**: svaka promena ima test (13.286 testova, 582 fajla), tipovi su čisti (tsc 0), stil je zaključan automatskim „ratchet“ testovima (tokeni, ikonice, razmaci, linije, površine, množina, reči), svaki serverski paket ima dokaz na jednokratnoj bazi + potvrdu + tačan revert, privatnost i brisanje naloga su sertifikovani digestom, CI proba 10 tokova. To je bolje od većine startup aplikacija.

Šta NIJE: ništa iz današnjeg talasa nije viđeno na telefonu; nekoliko tokova je svesno isključeno prekidačem; server nosi više generacija istih funkcija; nekoliko fajlova je preveliko; dokumentacija je ogromna i delom istorijska.

## 1. Klijent (React Native) — 3,5 / 5

**Dobro:** jedna arhitektura (ruta → `*Presentation` → `src/data/*ClientService` → RPC), ugovori tipizirani u `src/contracts`, jedan sistem tokena (`src/ui/system/tokens.ts`) i primitiva (`Screen/Section/ListRow/FactRow/Surface/InfoButton/…`), pokret preko `sys.motion` sa smanjenim pokretom, svaki ekran ima galerijsku scenu sa lažnim podacima.

**Dug (konkretno, po redu važnosti):**
1. **Preveliki fajlovi:** `src/ui/v2/DiscoveryPresentation.tsx` ≈ 1.430 redova (mapa + lista + list + pretraga + filteri + kamera + merenja), `src/app/(app)/pregled-zadatka.tsx` ≈ 700, `src/app/(app)/profil/radnik.tsx` > 300 sa dosta logike u ruti. Profesionalni rez: Discovery u 5–6 modula (kamera/mapa, list i stanice, kapsule i filteri, kartica pina, merenja/trace, povezivanje), rute tanke (čitanje + prosleđivanje), logika u čistim funkcijama sa testom. Rizik regresije je visok bez dokaza na telefonu — raditi tek posle telefonskog dokaza današnjeg talasa.
2. **Prekidači u buildu** (`EXPO_PUBLIC_*`): P6 čitač, EX-04 tri straničenja, D12 komentar, voice, EX-04 test limit — svaki je „ili-ili“ grana koja živi u kodu. Posle dokaza: uključiti trajno i obrisati stare grane (EX-04 legacy čitanja celih lista, stari TaskCard putevi).
3. **Imenovanje iz istorije:** `src/ui/v2/` je glavni UI (nema „v1“), `src/ui/aiFirst/`, `v5` sufiksi na serveru — nije greška, ali zbunjuje novog inženjera; preimenovanje je jeftino samo uz alat (tsc) i jedan komit.
4. **Mešani kraj reda** (CRLF u radnom stablu, LF u indeksu) — bezopasno, ali svaki alat upozorava; `.gitattributes` jednom proširiti na ceo repo.
5. **Sitno:** `Skeleton.tsx` varijanta `preview` crta staru karticu pregleda (kozmetika), scene „Blokirane osobe“ u `dizajn-obavestenja.tsx` zastarele, `SuccessMark` ima oprugu sa odskokom (vlasnik: odskok NE), `StatusChip` nema ključeve za podršku/izvoz, `TaskDecision.tsx:159` „Objavio“ rodno (vlasnikova reč), dva maestro toka tek usklađena i nepokrenuta.
6. **Performanse:** izmereno samo za stari raspored Zadataka (EX-03 na HONOR-u: halo 85/91 ms, kartica 71/78 ms, povratak 162/218 ms); nova lista + apsolutna traka tabova + animacija NISU mereni; B22 (Reanimated zakrpa) otvoren; „vidljiv povratak na mapu 1–2 s“ otvoren.

## 2. Server (Supabase DEV `leqcwgzvjsxugfgzdmth`) — 4 / 5 za bezbednost, 3 / 5 za urednost

**Dobro:** 235 migracija u lancu, 86 `dev_alpha_*` primena sa potvrdama, sve SECURITY DEFINER funkcije sa `search_path=pg_catalog`, ACL samo `authenticated` gde treba, servisne funkcije odvojene (`*_service`), RLS + sertifikat zatvaranja naloga (`3a785d42…`) koji svaki paket mora da dokaže nepomaknutim, nema `40001` ponovnih pokušaja (B24), cron radnici 2.880/0 grešaka za 24 h, 11 Edge funkcija sa `verify_jwt` gde treba.

**Dug:**
1. **Više generacija istih funkcija žive uporedo** (258 `rpc_*`): `rpc_send_agreement_message` i `_v2`, `rpc_read_agreement_messages_page_v1` i `_v2`, `rpc_read_agreement_message_window_v1/_v2`, `rpc_submit_agreement_review` i `_v2`, `rpc_propose_agreement_change` i `_v2`, `rpc_list_my_applications` i `_page`, `rpc_list_need_candidates` i `_page`, `rpc_list_my_tasks` i `rpc_list_my_needs_page`, `rpc_list_open_tasks_v3` (stari čitač) i `rpc_discovery_v1` (P6), `rpc_get_my_agreement_review` i `_v2`, `rpc_publish_need` i `_canonical`, `rpc_confirm_need_edit_from_review` i `_v2`. Tabla kaže „Server ume, aplikacija ne koristi: 11 (+2 preko Edge)“. Registar red **S04** je baš to: čišćenje starih verzija posle dokaza da ih nijedan klijent (ni stari APK) ne zove — jedan paket „RETIRE-V1“ sa dokazom na jednokratnoj bazi.
2. **Prekidači politike su na „isključeno“ odlukom**, ne greškom: `urgent_activation_policy.enabled=false` (HITNO čeka registar kategorija), `platform_payments.enabled=false` (0 RSD), push slanje isključeno, `profile_trust_visibility=OWN_ONLY`, `received_reviews_detail=COMMENTED_ONLY`. Svako uključivanje = paket + vlasnikova reč.
3. **Nepovezani klijent ↔ server:** klijent prima a server ne šalje `publishedAt` (vlasnikovo čitanje zadatka); server ne ume redosled prijava po ceni/oceni u stranicama, ni „Najbliže“; ugovor inboxa razgovora ne daje broj nepročitanih 1:1; Edge `uskoci-ai-interview` završna rečenica izmene nije ona koju ekran želi (klijent preslikava); predlog radnog profila nosi `displayName` (klijent prepisuje).
4. **Kandidati koji stoje** (`supabase/candidates/`, 20+): pkg023c (zabranjen), pkg023i (konflikt), GRAD S3 (svoja reč), chat B3a/b/c, P4 push transport, voice B2, AI-location-01, dve privatnosne grane. Svaki ima README; nijedan nije „na pola primenjen“ — ili je ceo, ili nije.
5. **Produkcija ne postoji** (R04: nov projekat, plaćen plan, backup) — pre prvog korisnika mora ceo lanac kandidata u istom redosledu + pravni tekstovi + izbacivanje vlasnikovih naloga iz TEST sveta (pkg029e) + Play Console.

## 3. Tokovi — šta je zaokruženo, šta je na pola

| Tok | Zaokružen u izvoru i na DEV-u? | Dokazan na telefonu? | Na pola / isključeno |
|---|---|---|---|
| Objava kroz asistenta → pregled → objava → prijave → izbor → Dogovor → gotovo → ocena | DA | starije verzije DA; današnji izgled NE | pisani komentar uz ocenu samo u DEV APK-u (flag); „Objavljen pre N sati“ čeka server |
| Uskačem: mapa → detalj → ponuda → Moje prijave → Dogovor | DA | današnji Zadaci NE | redosled „Najbliže“ nema; straničenja iza DEV flagova |
| Dogovor: termin, izmene, poruke (tekst, slike), glas, problem, otkazivanje | DA (glas B1 server + Edge) | starije DA | glas B2 (snimanje u aplikaciji) ISKLJUČEN flagom; grupni razgovor samo tekst (odluka A07) |
| Obaveštenja u aplikaciji | DA (+ naslov zadatka od danas) | starije DA | — |
| Push na telefon | NE (slanje isključeno; 1 push/min; 1 zaostala isporuka) | ranije jedan pravi push DA | PUSH-KAPACITET recept; podsetnik pred termin (P05) ne postoji |
| HITNO | server postoji, politika isključena, klijent delimičan | NE | registar kategorija + paket |
| Plaćanje | cenovnik 0 RSD, prekidač isključen | — | pravo plaćanje nije ni počelo (P1–P12), čeka provajdera i cene |
| Nalog: registracija, potvrda, oporavak lozinke, lični podaci, radni profil, blokiranje, prijava, podrška, izvoz, zatvaranje | DA | delom (ranije) | pravni tekstovi NISU objavljeni; izvoz čeka pravilo čuvanja; dve privatnosne grane odložene |
| Dva naloga / dva telefona | 11 od 32 provere | delimično | ostaje za pred izlazak |

## 4. Šta bih sledeće uradio da to bude „profesionalno do kraja“ (redosled)

1. **Dokaz na telefonu današnjeg talasa** (vlasnik + emulator), popravke po njegovim primedbama; tek onda bilo kakav veći refaktor.
2. **Rez velikih fajlova** (Discovery, pregled-zadatka, radnik) u module sa testovima; brisanje legacy grana iza flagova koji su dokazani.
3. **Server RETIRE-V1 paket:** ukloniti zamenjene verzije funkcija posle provere da ih stari APK-ovi ne zovu (red S04), i uskladiti nazive (bez `v5` gde nema v4).
4. **Povezivanja koja čekaju server** (odeljak 5 preseka): `publishedAt`, redosled prijava, 1:1 nepročitano, Edge tekstovi.
5. **PUSH-KAPACITET + prvi jednociljni push** (vlasnikova reč), pa HITNO.
6. **Čišćenje repozitorijuma:** `.gitattributes` LF za sve, prazni/istorijski worktree-ovi, stare grane, dokumentacija: jedan indeks „šta je živo“ (presek) a ostalo u `history/`.
7. **Produkcija:** nov Supabase projekat sa celim lancem, pravni tekstovi, Play Console, test na dva telefona do 32/32.

## 5. Jedna rečenica za vlasnika

Kod je disciplinovan i proverljiv (to je retko), ali još nije „gotov proizvod“: današnji izgled nije dokazan na telefonu, četiri toka su isključena prekidačem po odluci (push, HITNO, plaćanje, glasovno snimanje), server nosi stare verzije funkcija koje treba ukloniti, a tri fajla su prevelika da bi ih novi inženjer lako držao u glavi. Sve to je zapisano sa putanjama i redosledom; ništa nije skriveno.
