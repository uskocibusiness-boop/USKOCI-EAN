# P6 — aktuelni izolovani prihvat, 09.11.2026.

**Status: TESTIRANO na objavljenom izvoru; nema novog DEV, HTTP ili Android prihvata.**

## Identitet i razlog ponovne provere

- Source commit: `3b3ace969e223ce53fd1c98910426a2eff04957c`; tree `9e44faa94ae62cdc0c8029f6d03c4596f57ece7a`.
- Prethodni dokaz `p6-pagination-native-20261108.json` ostaje neizmenjen. Novi rezultat je potreban zato što je `discoveryV1ScreenSession.ts` promenjen posle prethodnog testa.
- Izvršen je neizmenjeni vraćeni `scripts/p6-discovery-pagination-native.cjs`, SHA-256 `94fb37d505bff9becd20551028362ac918629389347938850d44253a8802195a`.
- Novi native dokaz: [p6-pagination-native-20261109.json](p6-pagination-native-20261109.json), SHA-256 `5d4999ee1cfedd2372f7adb4e4b435cd912b6d3f9994e68cbbcbd38ed99c76c3`. Svih deset zabeleženih source hash-eva odgovara sadašnjim fajlovima.

## Stvarni PostgreSQL/PostGIS rezultat

**12/12 provera PASS.** Cela listanja za 100, 1.000, 5.000, 5.001, 10.000 i 30.000 zadataka nemaju izgubljene ili duplirane redove; redosled, anchor i cursori su stabilni. Odgovor ima najviše 100 redova; najveće listanje ima 300 stranica. Stvarni coordinator počinje sa 50 redova i učitava sledeću stranicu na izričit zahtev. MAP daje 18 agregata za 20.000 zadataka na lokaciji; provereni su selektivna pretraga, PLACES, POINT_MEMBERS, EXACT_PUBLIC, objava/zatvaranje tokom listanja, istek anchor-a, nevažeći cursor i odbijanje anonimnog/nedostajućeg identiteta.

| Zadaci | Stranice | p50 ms | p95 ms | p99 ms |
|---:|---:|---:|---:|---:|
| 100 | 1 | 22.10 | 22.10 | 22.10 |
| 1,000 | 10 | 22.78 | 25.27 | 25.27 |
| 5,000 | 50 | 47.20 | 53.13 | 59.26 |
| 5,001 | 51 | 46.25 | 50.40 | 64.91 |
| 10,000 | 100 | 79.82 | 88.26 | 97.59 |
| 30,000 | 300 | 202.54 | 220.51 | 234.77 |

Ovo su sekvencijalna lokalna vremena RPC omotača. Nisu poređenje brzine pre/posle, hosted SLO, konkurentni load test ili dokaz kapaciteta za 300.000 korisnika. Kod malih uzoraka p99 je maksimum.

## Dve postojeće ScreenSession grane

[Izvršiva proba](p6-screen-selection-current-20261109.cjs) i [rezultat](p6-screen-selection-current-20261109.json) odvojeni su od SQL broja provera. Stvarni TS session, transport i decoder rade nad kontrolisanim RPC odgovorima: **2/2 grane PASS**, uz **2 očekivana pada prethodnih linija** učitanih samo u memoriji.

TASK i PLACE odmah vezuju već prihvaćene učitane redove, a uobičajeno osvežavanje i dalje počinje. Nov prihvaćen MAP odgovor uklanja staru vezu; zakasnela greška prvobitnog osvežavanja je ne vraća. Ova proba ne izvršava SQL/HTTPS niti native pokret prsta. Pri izradi probe je usklađen intercept sa stvarnim ugovorom `PAGE` + `scope.kind=POINT_MEMBERS`; nije menjan ili ublažen assertion aplikacije.

## Izvršavanje i granice

```sh
NODE_PATH=/workspace/scratch/78491a3df814/current/node_modules USKOCI_POSTGRES_ROOT=/workspace/scratch/792f3e12eb9e/pg-runtime/root USKOCI_PG_MODULE=/workspace/scratch/792f3e12eb9e/pg-runtime/node/node_modules/pg USKOCI_PG_FIXTURE_PORT=55444 node scripts/p6-discovery-pagination-native.cjs docs/plan/proofs/p6-pagination-native-20261109.json
NODE_PATH=/workspace/scratch/78491a3df814/current/node_modules node docs/plan/proofs/p6-screen-selection-current-20261109.cjs docs/plan/proofs/p6-screen-selection-current-20261109.json
```

Postojeći disposable PostgreSQL 17/PostGIS je pokrenut samo na 127.0.0.1:55444; fixture proverava svoj data_directory i gasi svoj proces po završetku. Nema hosted SQL-a, Auth prijave, provider poziva ili korisničkih upisa. Fixture zadržava dokumentovane sintetičke account/world i taxonomy/area granice; optional overlay čitači su kontrolisane granice. COARSE_1KM i REMOTE bez pina ostaju provereni javni ugovori.

Runtime, feature flagovi, package, CODEX i migracije nisu menjani. Ovaj commit dodaje samo dokaze. P6 produkciono uključivanje, native mapa i stvaran korisnički E2E nisu izvedeni ovim testom.
