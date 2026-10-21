# Task AI: valuta posle prethodnog broja — lokalni kandidat

**21.10.2026.** Ovaj kandidat menja samo Edge obradu AI razgovora i sintetički Node dokaz. Nije objavljen na DEV, nije push-ovan i nije potvrđen živim Gemini razgovorom.

## Provereno u izvoru

- `need.price_rsd` i V2 writer prihvataju samo pozitivan celobrojni RSD iznos. Izostavljanje `need.price_rsd` iz sledećeg AI odgovora **ne povlači** raniju aktivnu činjenicu (`rpc_ai_apply_interview_turn_v2_service` u `20260903190000_clean_ru2_need_v2_draft.sql`).
- Ranija Edge zaštita je prepoznavala izričit iznos i EUR u istoj poruci, ali nije prepoznavala sled „100” → „u evrima”.

## Lokalna izmena

- Broj bez oznake valute više ne ide u `need.price_rsd`; AI pita koji iznos u RSD korisnik želi. Kratko naknadno „u evrima” prepoznaje se uz neposredno prethodnu kratku korisničku poruku sa brojem, već aktivnu cenu ili modelov pokušaj da predloži RSD cenu.
- Čak i kada model vrati `ACK` bez nove činjenice, odgovor sa izričitim EUR iznosom ili takva naknadna ispravka dobija `CLARIFY`. Nezavisni podaci, poput broja ljudi, ostaju.
- Cenovno pitanje prepoznaje se iz poslednje upitne rečenice, ne iz usputnog pominjanja cene u ranijem delu odgovora. Ako korisnik kaže „Treba mi 2 radnika”, pogrešan modelov predlog RSD cene se odbacuje, a ispravan broj ljudi ostaje bez novog pitanja za RSD.
- Izričit naknadni RSD iznos prolazi u postojeći writer. Izričit izbor ponuda čuva `OFFERS`, a odbacuje suvišan modelov predlog RSD iznosa.
- Ako je RSD cena već aktivna, Edge jasno upozorava da ona može ostati u nacrtu i traži novu RSD odluku ili ponude. Ovo upozorenje nije povlačenje činjenice.

## Otvoren P0

Već upisana `need.price_rsd=100` može ostati aktivna kada korisnik naknadno kaže „u evrima”. Postojeći V2 writer nema atomsku operaciju za uklanjanje te činjenice bez nove validne RSD vrednosti. Zato sama Edge izmena **ne dokazuje** da stari RSD iznos ne može proći odvojeni pregled/čuvanje. Potreban je server ugovor koji u istoj vlasničkoj i revizionoj transakciji povlači pogrešno protumačenu cenu i blokira pregled/objavu dok korisnik izričito ne navede RSD iznos ili izabere ponude; zatim test stvarnog writer-a, pregleda i objave na izolovanom nalogu. Ne koristiti service-role direktnu izmenu činjenica kao zaobilaznicu.

## Lokalni dokaz

`node --test supabase/proofs/ai/ai_edge_context.test.mjs supabase/proofs/ai/v5_worker_edge.test.mjs` pokriva goli broj, `u evrima`, `100 EUR`, `€100`, pogrešan `ACK`, kasniji RSD, ponude, drugi iznos u istoj poruci, trošak materijala/prevoza/goriva, kasniju EUR ispravku, javni opis sa brojem i negativne primere broja ljudi. Posle nezavisnog VM pregleda i dopuna: **252 PASS, 0 FAIL, 1 TODO**. Test za atomsko povlačenje starog RSD podatka ostaje `TODO/P0`; Node test je mock transport, ne serverski ni Gemini runtime dokaz. `npx tsc --noEmit --pretty false` je provera izvora. Server koraci su opisani u [atomskom ugovoru](ATOMIC_SERVER_CONTRACT.md), bez tvrdnje da su primenjeni.
