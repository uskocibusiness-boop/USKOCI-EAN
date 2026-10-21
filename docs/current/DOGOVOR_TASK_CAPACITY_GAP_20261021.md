# Dogovori: popunjenost zadatka posle otkazivanja — otvoren P2 nalaz

**21.10.2026. Izvorni audit; bez izmene poslovne logike, servera i APK-a.**

## Šta je provereno

- `src/ui/agreements/agreementListModel.ts` grupiše pojedinačne Dogovore po zadatku. Grupa zadržava i otkazani Dogovor uz aktivne.
- `src/ui/agreements/AgreementListCard.tsx` za grupu prikazuje `group.items.length` kao broj saradnji. Primer 3 prihvaćena → 1 otkaže ostaje „3 saradnje”. To je tačan broj istorijskih saradnji, ali **nije** broj trenutno potvrđenih izvršilaca.
- `src/ui/agreements/AgreementOverview.tsx` namerno ograničava `agreement.pokrivenost` na jedan bilateralni Dogovor. Iz tog polja se ne sme izvoditi task-wide `2/3`.
- `src/app/dogovor/[id].tsx` daje `openTask`; `src/app/(app)/potrebe/[id]/pregled.tsx` učitava vlasnikov zadatak i proverava ponovnu potragu. `src/data/needSearchRecoveryContract.ts` zahteva stvarni status, `missingSlots` i vremenski uslov. Zatvoren zadatak se ne otvara automatski samo zato što je jedan saradnik otkazao.

## Korisnički problem

Objavljivač u Dogovorima ne vidi da je posle otkazivanja popunjenost sa `3/3` prešla na `2/3`. „3 saradnje” može da liči na tri aktivna čoveka. Mora da otvori pojedinačni Dogovor, pa svoj zadatak, da bi video autoritativno stanje i eventualnu sledeću radnju. Izvršilac ne treba da vidi ili dobije komandu za task-wide ponovno traženje.

## Ugovor za naredni klijentski paket

1. Za owner grupu vezanu za jedan zadatak učitati ili ponovo upotrebiti **owner read** zadatka; ne sabirati bilateralne Dogovore. Vezu sa zadatkom i pripadnost nalogu proveriti kao i na vlasnikovom zadatku. Nema dodatnog upisa.
2. Tek uz potvrđen read prikazati diskretno `Potvrđeno 2/3` pored naziva zadatka; „3 saradnje” ostaje samo kao broj svih saradnji ili postaje „Saradnje” bez brojke. Broj prijava je posebno polje i ne ulazi u popunjenost.
3. Tokom učitavanja, greške ili zastarelog read-a ne pokazivati izmišljeni `2/3`. Prikazati „Proveri popunjenost zadatka” koji otvara postojeći owner ekran i tamo osvežava podatke. Worker kartica zadržava samo svoje bilateralno stanje.
4. `Ponovo traži ljude` u Dogovorima sme da se pojavi tek ako ista autoritativna projekcija i `needSearchRecoveryContract` daju dozvolu, ili korisnika treba voditi na vlasnikov zadatak gde se ta provera već izvršava. `CLOSED`, istekao termin ili nula mesta moraju ostati bez CTA.
5. Nakon otkazivanja/izbora zamene read invalidirati i proveriti novo `2/3` → `3/3`; reakcije na push/Back moraju voditi na isti zadatak bez gubitka mesta u listi. Ne prikazivati uspeh pre readback-a.

## Test koji nedostaje

Dva naloga, jedan zadatak za tri izvršioca: `0/3` → `3/3` → jedan potvrđeni otkazuje → owner čita `2/3` i proverava dozvolu ponovne potrage → zamena → `3/3`. Ponoviti sa zabranjenim ponovnim otvaranjem posle isteka ili `CLOSED`, sa gubitkom mreže i sa worker prikazom bez owner komande. To nije native prihvaćeno ovim auditom.
