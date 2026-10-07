# Prekidači u klijentu i serverski paketi od kojih zavise (7.10.2026, uveče)

Operativni zapis. Timovi su namerno ugradili ekrane za ono što server danas nema, ali ISKLJUČENE, da se nikad ne vidi mrtva kontrola ni izmišljen podatak. Svaki prekidač se uključuje jednom linijom, ali TEK kad je odgovarajući serverski paket primenjen i (gde piše) kad vlasnik kaže. Nije dozvola ni odluka: odluke vlasnika su u registru (`docs/control/redovi.json`, ključevi `owner_*_20261007*`).

| Prekidač / mesto | Gde se nalazi (po izveštaju tima) | Uključiti kad | Zavisi od |
| --- | --- | --- | --- |
| `TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY` | `src/ui/workerProfile/workerProfileFacts.ts` | MATCH-V1 je primenjen na DEV | „PRIMENI MATCH-V1“ (danas je alat i vozilo tvrd uslov na serveru, G1; ekran govori istinu) |
| `FOR_ME_SWITCH_EXISTS`, i `forMeAvailable` na Zadacima | `workerProfileFacts.ts`; `src/ui/v2/DiscoveryPresentation.tsx` / čipovi | DISCOVERY-ZAMENE je primenjen | „PRIMENI DISCOVERY-ZAMENE“ |
| `PUBLIC_PROFILE_SERVER_FACTS_BUILT` („Dolazi kako je dogovoreno N%“, „Na USKOČI-ju od…“) | `workerProfileFacts.ts`, `src/ui/system/PublicProfileSheet.tsx` | PROFILE-TRUST (server) je primenjen i vlasnik kaže „uključi“ | „PRIMENI PROFILE-TRUST“ + red `profile_trust_visibility` = `PUBLIC` (vlasnik je odobrio: svima, tek posle 5 Dogovora; gradi se isključeno) |
| „Tvoja statistika“ (prijave → dogovoreno → završeno) | red u Profilu, još nije građen | PROFILE-TRUST primenjen | isti paket |
| Pojedinačne primljene ocene („Primljene“) | `src/ui/reviews/*` (T4a): danas samo prosek i D12 komentari | `rpc_list_received_reviews_v1` primenjen | PROFILE-TRUST paket (c) |
| Razlog / ko / kada otkazivanja Dogovora | `cancellationLine` u `src/ui/agreements/*` (T3a): gotovo, čeka mapper | CANCEL-INFO (server) primenjen | server agent 2, paket 2 |
| Znak „viđeno“ uz poruke (`procitano === true`) | `src/ui/messages/*` (T3c), uspavan | server vraća čitanje pošiljaocu | server backlog (promena šeme, pomera sertifikat: poseban dogovor) |
| Tačka nepročitanog za lične razgovore i „Nova poruka“ na kartici | `src/ui/messages/*`, kartica Dogovora | server ima stanje čitanja po razgovoru | isto |
| Starost zadatka („pre 2 dana“) i oznaka „Tvoj zadatak“ na karticama | `TaskCard`/`TaskFace`/`OwnTaskCard` + čitač Zadataka (T1-map2 izveštaj) | čitač vraća vreme objave i sopstvene zadatke | izveštaj T1-map2 |
| `SUPPORT_HAS_DUTY_OPERATOR` | `src/ui/objava/reviewFacts.ts` | postoji dežurni operater podrške | niko (operativna odluka vlasnika) |
| Ime onoga ko pita u „Pitanja i odgovori“ | `src/ui/qa/*` | NIKAD bez nove odluke o privatnosti | server danas vraća anonimno |
| Push tekstovi bez roda (`PLANNED_PUBLIC_INBOX_COPIES`) | `src/ui/notifications/publicInboxCopy.ts` + Edge `pushNotificationCopy.mjs` | Edge i klijent se menjaju ZAJEDNO, push je poslednji | server agent 2, paket 3 (samo priprema) |

## Serverski paketi, redosled primene i stanje (7.10., 21:50)
1. **ZONE-PERF**: PRIMENJEN 7.10. (ledžer 228), zapis `supabase/operations/dev-alpha/ledger/20261007_zone_perf_application.receipt.json`.
2. **MATCH-V1**: dokazan (zone 16/16, ponašanje 50/50, opterećenje 19/19); NE primenjuje se dok vlasnik ne odgovori na pitanje o gornjoj granici obaveštenja (500 / 5.000 / bez granice) i ne potvrdi pravilo, pa tek tada „PRIMENI MATCH-V1“.
3. **DISCOVERY-ZAMENE**: dokazan, čeka „PRIMENI DISCOVERY-ZAMENE“.
4. **PROFILE-TRUST, CANCEL-INFO**: kandidati u izradi (server agent 2), ništa se ne primenjuje bez posebne reči.

## Pravilo
Prekidač se menja u istom izdanju (ažuriranju preko veze) u kojem je odgovarajuća serverska promena već primenjena i pročitana nazad. Nikad obrnuto: klijent koji govori „Za mene“ ili „95%“ pre servera bio bi laž.
