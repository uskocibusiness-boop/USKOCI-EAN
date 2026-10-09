# GitHub / CI / kontrolna tabla — 09.10.2026.

Polazni i CodeQL analizirani commit: `a0dea3ac83a20ad8735058ddc29634e4cdcc5217`.
Ovo je dokaz jednog ograničenog paketa; jedini statusni registar ostaje `docs/control/redovi.json`.

## URADIO

- PRE-P4 push i PR provere obuhvataju obe aktuelne grane (`work/uskoci-ui-unification-20260924`, `integration/spoj-20261006`) i zadržavaju staru `clean-alpha-backend`.
- Izmena ili brisanje TS/TSX izvora eksplicitno bira pet postojećih UI pravila koja skeniraju filesystem. Jest import graf ih ranije nije pouzdano birao. Postojeći ciljani i puni režim ostaju.
- Kontrolna tabla escapuje uvezene scalar vrednosti pre HTML prikaza; svetla prihvataju samo pet poznatih naziva iz sopstvenih ključeva mape. Template i generisani renderer su usklađeni.
- Novi dashboard regresioni korak radi posle `npm ci` i njegov stvarni ishod ulazi u CI receipt. Kratak PR obrazac traži promenu, dokaz i preostale provere. Nema novih zavisnosti.

## DOKAZAO

| Provera | Rezultat |
|---|---|
| `node --test scripts/ci/*.test.cjs` | 39 PASS, 0 FAIL, 0 SKIP |
| `node --test scripts/control/tabla-rendering.test.cjs` | 12 PASS, 0 FAIL, 0 SKIP |
| Pet UI ratchet grupa + Reanimated contract | 194 PASS, 0 FAIL, 9 SKIP |
| TypeScript `--noEmit` | exit 0 |
| YAML / oba push i PR branch spiska | PASS |
| Nezavisan read-only pregled renderer-a i CI povezivanja | bez materijalnog nalaza |

Devet preskočenih testova su postojeći shell-tool-dependent APK attestation fixture-i na Windows-u; nisu predstavljeni kao prolaz. Prethodno blokiran stvarni Git routing test sada prolazi. Pripremljeni dashboard RED dokaz imao je 8 FAIL i 2 kontrolna PASS; GREEN ima 12 PASS. Ispravan prikaz stanja ostaje isti, a uneseni HTML ostaje tekst. Ovo ne dokazuje ACL objavljenog hosta ili stvarnu međukorisničku eksploataciju.

## CodeQL: pročitani stvarni nalazi

GitHub je na početku paketa pokazivao 28 otvorenih nalaza. JS/TS SARIF `1926222485` i tačni alert podaci dopunjuju raniji pregled slika; ništa nije masovno zatvoreno.

- Četiri nalaza #7–10 obuhvataju popravljeni renderer kontrolne table.
- #28 je zapravo `v5_retention_compatibility.test.mjs:11`: MD5 poredi tela istorijskih SQL funkcija, ne lozinke. Poređenje ostaje kompatibilno sa pinovima; primenjene migracije nisu menjane.
- #22–26 vode od request UUID-a kroz JSON objekat do označenih `accountId` argumenata. Izvor postavlja `accountId` nezavisno iz scope-a; navedeni tok ne dokazuje nasumičan identitet. Kompletna server/RLS provera i odluka o svakom novom alert-u ostaju odvojeni; ranije prihvatanje drugih alerta nije automatski primenjeno.
- #11 je link sa fiksnim fragment prefiksom i `textContent`; #12 fiksna lokalna iframe putanja sa query vrednošću. Inspektovani tokovi ne tumače tu vrednost kao HTML.
- Ostali testni/proof/arhivski nalazi imaju zasebnu statičku trijažu sa ograničenjima. Nema tvrdnje da je ceo proizvod bezbednosno završen.

[CodeQL run 37988814767](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37988814767): Java/Kotlin autobuild nije prepoznao build komandu; analiza je preskočena. Potrebna je ručna Expo prebuild / Gradle konfiguracija, a ne gašenje jezika. JS/TS, Python i Actions skenovi su završeni.

## NIJE DOKAZANO

Ovaj lokalni prolaz nije novi GitHub CI/CodeQL rezultat, produkcioni build ili native/store dokaz. GitHub settings nisu menjana: pregledač ih odbija zbog sačuvane zabrane pristupa github.com. Nisu uključeni novi ruleset/required checks/Dependabot/secret-scanning prekidači ovim paketom. Nije zaobiđena zabrana drugim alatom. Generisana tabla nije dokaz objave Claude artefakta. Nema server, push, nalog, podatak ili sertifikat promene. Postojeći NO-GO ostaje.

## SLEDEĆE

Proveriti CI na objavljenom commit-u, dovršiti GitHub zaštite i Java/Kotlin konfiguraciju kada se ukloni browser zabrana; zatim objedinjeni Android header/camera/permission paket i preostali konačni release koraci iz postojećeg registra. Automatizacija na 30 minuta ostaje PAUSED.
