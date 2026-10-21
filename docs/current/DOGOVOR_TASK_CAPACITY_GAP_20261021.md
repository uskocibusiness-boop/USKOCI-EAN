# Dogovori: popunjenost zadatka posle otkazivanja — klijentski prikaz, runtime otvoren

**21.10.2026. Izvorni audit i uski klijentski paket; bez izmene poslovne logike, servera i APK-a.**

**Dopuna istog dana:** `src/ui/agreements/ownerTaskCapacity.ts` i `src/app/(app)/dogovori.tsx` sada opcionalno čitaju postojeći vlasnički `rpc_get_need_search_state` za najviše 12 jedinstvenih zadataka, u serijama po četiri. Potvrđen broj se vidi i za jednu i za više saradnji, a istorijski broj dobija reč „ukupno”. Učitavanje, greška, osvežavanje, promena naloga, fokus ili zastareli odgovor skrivaju broj. Sekundarna komanda otvara postojeći vlasnikov pregled koji ponovo proverava dozvoljene akcije. Izvršilac ne dobija vlasnički broj ni komandu. Ciljana tri Jest paketa: 83/83 PASS; TypeScript i diff check PASS. Read-only DEV katalog potvrđuje da RPC `rpc_get_need_search_state(uuid)` postoji kao `SECURITY DEFINER` i da izvršavanje ima `authenticated`; vlasnički uslov je potvrđen u izvornom SQL-u. Nije urađen dvonaložni tok zamene niti HONOR prihvatanje.

## Šta je provereno

- `src/ui/agreements/agreementListModel.ts` grupiše pojedinačne Dogovore po zadatku. Grupa zadržava i otkazani Dogovor uz aktivne.
- `src/ui/agreements/AgreementListCard.tsx` za grupu prikazuje `group.items.length` kao „3 saradnje ukupno”. To je broj istorijskih saradnji, **nije** broj trenutno potvrđenih izvršilaca. Sadašnji odvojeni `Potvrđeno 2/3` dolazi samo iz owner read-a.
- `src/ui/agreements/AgreementOverview.tsx` namerno ograničava `agreement.pokrivenost` na jedan bilateralni Dogovor. Iz tog polja se ne sme izvoditi task-wide `2/3`.
- `src/app/dogovor/[id].tsx` daje `openTask`; `src/app/(app)/potrebe/[id]/pregled.tsx` učitava vlasnikov zadatak i proverava ponovnu potragu. `src/data/needSearchRecoveryContract.ts` zahteva stvarni status, `missingSlots` i vremenski uslov. Zatvoren zadatak se ne otvara automatski samo zato što je jedan saradnik otkazao.

## Korisnički problem

Objavljivač sada dobija `2/3` kada uspe autoritativno čitanje. Kada nije moguće potvrditi broj, kartica pokazuje put do vlasnikovog zadatka. I dalje nedostaje stvarna potvrda celog otkazivanja, ponovne potrage i zamene sa dva naloga na uređaju; nema automatskog otvaranja potrage iz same kartice. Izvršilac nema task-wide vlasničku komandu.

## Ugovor i granice primenjenog klijentskog paketa

1. Za owner grupu vezanu za jedan zadatak učitati ili ponovo upotrebiti **owner read** zadatka; ne sabirati bilateralne Dogovore. Vezu sa zadatkom i pripadnost nalogu proveriti kao i na vlasnikovom zadatku. Nema dodatnog upisa.
2. Tek uz potvrđen read prikazati diskretno `Potvrđeno 2/3` pored naziva zadatka; „3 saradnje” ostaje samo kao broj svih saradnji ili postaje „Saradnje” bez brojke. Broj prijava je posebno polje i ne ulazi u popunjenost.
3. Tokom učitavanja, greške ili zastarelog read-a ne pokazivati izmišljeni `2/3`. Prikazati „Proveri popunjenost zadatka” koji otvara postojeći owner ekran i tamo osvežava podatke. Worker kartica zadržava samo svoje bilateralno stanje.
4. Klijent je izabrao drugu putanju: vodi na vlasnikov zadatak, gde se ponovno čita dozvola za `Ponovo traži ljude`. `CLOSED`, istekao termin ili nula mesta ne dobijaju takvu radnju iz kartice Dogovora.
5. Nakon otkazivanja/izbora zamene read invalidirati i proveriti novo `2/3` → `3/3`; reakcije na push/Back moraju voditi na isti zadatak bez gubitka mesta u listi. Ne prikazivati uspeh pre readback-a.

## Test koji nedostaje

Dva naloga, jedan zadatak za tri izvršioca: `0/3` → `3/3` → jedan potvrđeni otkazuje → owner čita `2/3` i proverava dozvolu ponovne potrage → zamena → `3/3`. Ponoviti sa zabranjenim ponovnim otvaranjem posle isteka ili `CLOSED`, sa gubitkom mreže i sa worker prikazom bez owner komande. To nije native prihvaćeno ovim auditom.
