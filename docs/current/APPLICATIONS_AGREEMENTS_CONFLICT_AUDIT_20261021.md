# Prijave, preklapanje termina i kapacitet Dogovora — 21.10.2026.

Ovo je uski dokazni pregled za tok prijava i izbora. Nije potpun pregled aplikacije. DEV projekat `leqcwgzvjsxugfgzdmth` je čitan samo SQL upitima `SELECT`; SQL nije primenjen. Ne postoji izveden test sa dva naloga za 3/3 → 2/3 → zamena.

## Potvrđeno iz aktivnog DEV-a

| Tvrdnja | Dokaz | Granica |
| --- | --- | --- |
| Izbor ponovo proverava podobnost i termin. | Aktivna `public.rpc_select_response(uuid,integer,uuid,integer,text,text)` poziva `private.match_detail_for_calendar_interval` i za početak bez trajanja proverava `private.worker_calendar_conflict`; odbija `WORKER_NO_LONGER_ELIGIBLE` i `WORKER_CALENDAR_CONFLICT`. MD5 definicije: `2bd9a91b3f4b8179173c622c974270f9`. | Pročitan ugovor funkcije; nije izveden konkurentni runtime test. |
| Izbor ne sme da pređe broj potrebnih mesta. | Ista funkcija proverava `fn_need_covered_slots + response.covered_slots > required_slots` i odbija `OVERFILL`. | Nije potvrđen svaki ekranski prikaz brojeva. |
| Otkazivanje oslobađa odabrano mesto. | Aktivna `rpc_cancel_agreement(uuid,text)` menja `agreements.status` i `need_selections.status` u `CANCELLED`, a `marketplace_responses.status` u `NOT_SELECTED`; zatim ponovo računa `fn_need_covered_slots`. MD5: `ae6d54b2b643d2c972a12f651e236d11`. | Trenutno nema otkazanih Dogovora u DEV podacima: agregatni `count(*) = 0`. |
| Otkazivanje ne otvara samo od sebe ljudski zatvorenu potragu. | Aktivni `rpc_cancel_agreement` enqueuje potragu samo kada je `remaining_search_closed_at is null` i vreme je dopušteno. `rpc_reopen_remaining_search` zahteva ranije zatvorenu potragu, slobodno mesto, dozvoljen status i vreme. MD5 reopen: `c598b151caea23fabc0f866969569a78`. | Potreban potpun test sa dva naloga i krajem vremenskog prozora. |
| Oba prikaza kandidata koriste istu v5 projekciju. | Aktivni `rpc_list_need_candidates(uuid)` i `rpc_list_need_candidates_page(uuid,integer,timestamptz,uuid)` pozivaju `private.need_candidate_states_v5`. | Ovo potvrđuje put podataka, ne vizuelni izgled. |

## Konkretan raskorak: otkazani Dogovor i dalje izgleda izabran u prikazu kandidata

Oba aktivna overload-a `private.need_candidate_states_v5` računaju:

```sql
exists(select 1 from public.agreements a where a.selected_response_id=r.id) as has_agreement
...
when c.has_agreement or c.status='SELECTED' then 'SELECTED'
```

MD5 definicija za `(uuid)` je `6e9656abe2475b53b6dc49ead1131620`, a za `(uuid,uuid[])` `1c25fd199f84964d2ffbb5b54d5aeca0`. Pošto `rpc_cancel_agreement` zadržava istorijski red Dogovora, ali odgovor vraća u `NOT_SELECTED`, kandidatski prikaz bi ga i dalje označio `SELECTED`. Ovo je zaključak iz aktivnih definicija; u DEV-u još nema otkazanog reda za direktno posmatranje.

Prikaz sopstvenih prijava već ima drugačiju zaštitu: aktivni `private.own_application_rows(uuid)` i `rpc_list_my_applications()` proveravaju da povezani Dogovor nije `CANCELLED` pre nego što prijavu proglase izabranom. Dakle, dva prikaza nisu usklađena.

Izolovan predlog ispravke je [forward.sql](../../supabase/candidates/cancelled-candidate-parity-20261021/forward.sql). Menja samo `has_agreement` uslov u oba kandidatska overload-a na `a.status<>'CANCELLED'`. Ima tačne DEV MD5 preduslove i SQL proveru obe definicije posle promene. `c.status='SELECTED'` ostaje: redovno otkazivanje ga atomarno menja u `NOT_SELECTED`, pa ne održava pogrešan izbor; ako ta dva zapisa ikada divergiraju, potrebna je posebna popravka podataka. Predlog **nije** u `supabase/migrations` i **nije** primenjen.

Ne promovisati ovaj kandidat samo na osnovu MD5 provere. Pre DEV-a nedostaju izolovana proba otkazivanja i zamene 3/3 → 2/3 → 3/3, provera oba owner čitača i worker čitača, drugih vlasnika/anonimnog pristupa, puni ACL/closure postflight i rollback. Klijentski `CLOSED` sada govori uzročno neutralno „Prijava više nije u izboru”, jer otkazani Dogovor može ostaviti zadatak otvoren za zamenu.

## Preklapanje prijava i „zamrzavanje“

Izbor osobe u konfliktu je blokiran na serveru, ali aktivne projekcije nemaju zasebno stanje `TIME_CONFLICT_FROZEN`. `need_candidate_states_v5` neuspeh uslova termina, profila, revizije ili cene svodi na `STALE`. Sopstvene prijave koriste `SUBMITTED`, `VIEWED`, `SHORTLISTED`, `SELECTED`, `STALE_REVIEW_REQUIRED`, `WITHDRAWN` i `CLOSED`; `private.own_application_rows(uuid)` nema stanje zamrzavanja. Zato ne treba prikazivati obećanje da je druga prijava „zamrznuta“ i da će se sigurno vratiti. Ponovna podobnost se preračunava, ali rok, revizija i stanje drugog zadatka mogu to onemogućiti.

Klijent je usklađen sa tim ugovorom: uklonjen je neaktivni tip `TIME_CONFLICT_FROZEN` iz [projections.ts](../../src/contracts/projections.ts), a [CandidateFace.tsx](../../src/ui/v2/CandidateFace.tsx) za `STALE` daje uzročno neutralan tekst „Prijava trenutno nije dostupna za izbor.“ Prethodni tekst je pogrešno tvrdio da je zadatak izmenjen, iako aktivna funkcija grupiše više uzroka. Test ulaza odbija neaktivno stanje.

Stari [temporal-conflict-freezing-v1.sql](../../supabase/candidates/temporal-conflict-freezing-v1.sql) nije bezbedan kandidat za primenu bez prerade: zasniva se na ranijem modelu i izmišlja trajanje od jednog sata za zadatak koji ima samo početak. Aktivni `rpc_select_response` namerno koristi mikrosekundni interval samo kao proveru tačke preklapanja, ne kao trajanje posla.

## Više izvršilaca i uslovi

Svaki izbor pravi pojedinačan Dogovor, a promena uslova se šalje po ID-u tog Dogovora ([agreementClientService.ts](../../src/data/agreementClientService.ts)). Grupni prikaz i čet mogu pokazati učesnike, ali ne znače zajedničko prihvatanje jedne cene ili statusa za sve ([AgreementOverview.tsx](../../src/ui/agreements/AgreementOverview.tsx)). Scenariji 0/3, 2/3 i 3/3 moraju koristiti `need_selections` sa statusom `SELECTED`, odvojeno od broja prijava; vizuelni 3/3 → 2/3 → zamena još nije potvrđen celim runtime tokom.

## Lokalne provere i sledeći korak

- Ciljani Jest: 4 suite-a, 202 testa prošla.
- `npx tsc --noEmit --pretty false`: prošlo.
- Statička provera SQL kandidata: tačno 2 definicije i 2 čuvana `has_agreement` izraza.
- Sledeće: pregledati SQL predlog, promovisati ga u forward migraciju tek uz regresioni test otkazivanje → 2/3 → zamena, potvrditi DEV definicije nakon primene i proveriti dva naloga na uređaju. Zasebno odlučiti da li je korisniku potreban eksplicitan prikaz konflikta među sopstvenim prijavama; to zahteva novi server ugovor, ne samo boju kartice.
