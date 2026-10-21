# P6: najmanja navedena fiksna cena — lokalni kandidat

**Status: NEPRIMENJENO. UI minimum ostaje isključen.** Nije migracija i nije potvrda da DEV podržava novi ključ.

## Današnji predecessor i izvori

Read-only `pg_proc` čitanje na `leqcwgzvjsxugfgzdmth`, 20.10.2026. u **21:15:47.458959 UTC**, PostgreSQL **17.6**:

- `public.rpc_discovery_v1(jsonb)` prosrc MD5: `a9b0985991f4ebfe4e95143e5cf57222`.
- `SECURITY INVOKER`, STABLE, owner `postgres`, `search_path=pg_catalog`.
- ACL `{postgres=X/postgres,authenticated=X/postgres}`. Nema novog granta, funkcije, tabele, RLS politike ili indeksne promene.
- Tačna definicija je `before.sql`; vremenski i privilegijski podaci su `predecessor.json`.
- Kandidat body MD5: `4771f0606b94fecb78d61ed75ca584bf`. Drift prethodnika, opsega zamene ili metapodataka prekida transakciju.

Supabase skill i zvanična dokumentacija provereni 20.10.2026:

- [Changelog indeks](https://supabase.com/changelog.md): najnovije vidljive objave 14.10. i 12.10; TLS promena najavljena za 10.11. ne menja ovaj SQL filter/ugovor. Ovaj paket ne menja transport ili TLS klijent.
- [Database functions](https://supabase.com/docs/guides/database/functions): invoker/definer, search_path i EXECUTE prava.
- [Mutable search_path advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0011_function_search_path_mutable): eksplicitni put pretrage ostaje očuvan.

## Tačna semantika

Wire `DiscoveryV1Filter.minBudgetRsd?: number`: **ceo broj 1…2.147.483.647**. Po dodatnom zahtevu vlasnika minimalna navedena fiksna cena može zajedno sa zadacima „Tražim ponude”:

| `price` sa minimumom | Značenje |
| --- | --- |
| `all` | OFFERS **ili** MY_PRICE sa navedenom cenom ≥ minimum |
| `MY_PRICE` | Samo MY_PRICE sa navedenom cenom ≥ minimum |
| `OFFERS` | Nevažeća wire kombinacija; nema navedene fiksne cene za poređenje |

Prisutni SQL null, string, boolean, decimal, nula, negativno i overflow su greška. Klijentski prazno/null/undefined nije wire ključ. Adapter odbija malformed/wrong-mode prag umesto tihe šire pretrage. Coordinator pri izričitom prelasku na OFFERS briše zapamćeni prag; prelaz na `all` ga čuva ako je poslat. Prazan search draft briše prag u oba dozvoljena režima. Odsustvo ključa i dalje znači prethodni ugovor.

Poredi se postojeći `public.needs.requester_price_rsd >= minBudgetRsd` samo kada je `needs.mode='MY_PRICE'`. Fiksna cena koja je null ne prolazi minimum; OFFERS u kombinaciji `all` prolazi bez izmišljene cene, a u MY_PRICE je isključen postojećim price predikatom. Iznos je **navedena fiksna cena**. `price_basis` TOTAL ili PER_PERSON ostaje nepromenjen i vidljiv u postojećoj kartici. Nema množenja brojem ljudi, konverzije valute, pretvaranja legacy null osnove u TOTAL ili tvrdnje o isplati/zaradi.

Predikat se dodaje u oba postojeća mesta autoritativnog članstva:

1. PLACES `place_base`: `min_budget_rsd is null or n.mode='OFFERS' or (n.mode='MY_PRICE' and n.requester_price_rsd >= min_budget_rsd)` — CITY/AREA skupovi, brojke i paginacija.
2. PAGE/MAP `shared`: identičan predikat sa aliasom `b` — list/page, scope/point members, map/bucket/count.

EXACT_PUBLIC ostaje samostalni autorizovani tačan pregled objekta. Filter ne postaje dozvola niti razlog da imenovani javni objekat nestane iz tačnog read-a.

Kanonizacija dodaje minimum samo ako postoji, pre filterKey/anchor/cursor obračuna. Izostavljen ključ zadržava prethodni canonical JSON, hash i ugovor; postojeći klijenti nastavljaju stari upit. Novi minimum znači novu traversal sesiju. „Za mene”, visibility, stanje objave/otvorenost, vremenske granice, RLS, coarse-only koordinate i javna projekcija nisu menjani.

## Klijentski kandidat

- `src/data/marketplaceView.ts`: opciono `minBudgetRsd?: number | null`; postojeći initial view ostaje bez novog ključa. Budući UI mora brojati aktivan minimum i kada je price=`all`, prikazati da su uključene ponude i omogućiti potpuno brisanje uslova; UI brojač/unos nije implementiran ovim kandidatom.
- `src/data/discoveryV1Contract.ts`: wire ključ i zajednički validator granice.
- `src/data/discoveryV1MarketplaceAdapter.ts`: strogo opciono serijalizovanje, bez lokalnog filtriranja već učitanih redova.
- `src/data/discoveryV1RouteCoordinator.ts`: search draft, reset pri OFFERS-only ili praznom draft-u, preview i intent/session/warm identitet uključuju minimum. Postojeći owner prosleđuje ceo filter u PAGE/MAP/PLACES. `all+minimum` je različit traversal od `MY_PRICE+minimum` i od `all` bez minimuma.

Nijedan filter UI fajl nije menjan. Root treba da poveže numerički input, local draft/preview/apply/reset i chip prikaz **tek kada je server ugovor zasebno primenjen i pročitan**. Prikaz usloviti P6 reader-om i potvrđenom minimum capability/konfiguracijom; podrazumevano OFF. Postojeći `EXPO_PUBLIC_P6_DISCOVERY_READER=1` nije dokaz podrške za minimum: novi uslov uključivanja još nije dodat ovom paketom. Legacy `marketplaceItems` nema ovu funkciju i ne sme dobiti operativni minimum UI. Ne uvoditi fallback koji odbacuje prag posle P6_INVALID_FILTER. Predloženi naziv: **„Najmanja navedena cena (RSD)”**; osnova cene ostaje na kartici.

## Provera i granice dokaza

`node --test supabase/candidates/discovery-min-price-20261020/candidate.test.mjs` proverava tačan live predecessor, deterministički SQL kandidat, šest ograničenih i reverzibilnih zamena, očuvan EXACT_PUBLIC/canonical baseline i obe povezane membership tačke. To su **offline provere konstrukcije SQL-a, ne izvršen PostgreSQL scenario**.

Ciljani Jest dokazi u repo `work/discovery-min-price-20261020/` pokrivaju pozitivnu/odbijenu/praznu vrednost, identične absent wire bajtove, PAGE/MAP/PLACES prenos oba dozvoljena režima, preview bez menjanja aktivne liste, fresh anchor, warm key, brisanje praga i odbacivanje kasnog starog odgovora. Fajl `result-combined.json` beleži poslednji rezultat; `result.json` ostaje istorijski dokaz prvog MY_PRICE-only kandidata.

Na ovom hostu `psql`, Docker i PGlite nisu bili dostupni. SQL nije izvršen lokalno ili na DEV-u. **Pre primene ostaje obavezan izolovan PG 16/17 dokaz nad stvarnim reader-om:** below/equal/above, TOTAL/PER_PERSON/null basis, `all+minimum` zadržava OFFERS uz null cenu a odbacuje preniske/null fiksne cene; `MY_PRICE+minimum` isključuje OFFERS; `OFFERS+minimum` se odbija; >100 redova/page granica, MAP/PLACES/POINT_MEMBERS count paritet, novi/stari anchor, absent response poređenje i anon/auth/RLS scenariji. Zatim reviewer proverava kandidat i root zasebno generiše forward migraciju; ova datoteka sama nije dozvola za primenu.

## Regeneracija

`node supabase/candidates/discovery-min-price-20261020/build-candidate.mjs --write` lokalno regeneriše samo `candidate.sql`; nema mreže ni DB poziva. Novi predecessor zahteva novu proveru i novi tačan capture, ne isključivanje pina.
