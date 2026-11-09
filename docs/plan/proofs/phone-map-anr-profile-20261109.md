# Telefon: zastoj mape i sređivanje profila — 09.11.2026.

## Stvarni kvar

Na fizičkom Honor VKP_NX9 / Android 16, font 1,15, paket `rs.uskoci.preview` sa source `a22d14d47b248dce52ea4a12e215816fbcdfc7b3` zabeležio je ANR 15:16:25 UTC. `dumpsys activity exit-info` potvrđuje input dispatch timeout od 5000 ms; prethodni proces je zatim zatvoren posle greške. Ovo nije zaključak iz lokalnog testa.

Izdvojeni stack sopstvenog procesa iz Android Dropbox ANR zapisa:

```text
main: Waiting
Object.wait
MapLibreSurfaceView$RenderThread.onWindowResize (MapLibreSurfaceView.java:432)
MapLibreSurfaceView.surfaceChanged (MapLibreSurfaceView.java:163)
android.view.SurfaceView.updateSurface
android.view.SurfaceView.setFrame
android.view.View.layout
MLRNMapView.onLayout (MLRNMapView.kt:635)
SurfaceMountingManager.updateLayout
```

UI thread čeka promenu veličine native SurfaceView mape. Nije dokazan kružni deadlock, OOM, zastoj baze ili Gemini poziva. SafeArea upozorenja sama nisu uzrok. Lokalni izdvojeni zapis `verification/phone-acceptance-20261109/reported-map-anr-owned-threads.txt` ima SHA-256 `5c788b5062dbc593516d982944a4f8929c38d515994f0d5d809e1aedb679a864`; sirovi sistemski bugreport i tuđi procesi nisu objavljeni.

## Najmanja povezana izmena

- `DiscoveryMap`, `ResolvedPinMap`, `LocationOverviewMap` koriste podržani `androidView="texture"` umesto `surface`. Nema promene verzije MapLibre, pinova, grantova lokacije, API-ja ili geometrije. [Zvanični MapLibre v11 ugovor](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/) i lokalni 11.3.10 `Map.tsx` potvrđuju oba renderera. Njegov pinovani Android SDK je 13.2.0: [TextureViewRenderThread](https://raw.githubusercontent.com/maplibre/maplibre-native/android-v13.2.0/platform/android/MapLibreAndroid/src/main/java/org/maplibre/android/maps/renderer/textureview/TextureViewRenderThread.java) pri promeni veličine postavlja dimenzije i obaveštava render thread, bez `wait` petlje. Uništavanje površine ostaje zaseban lifecycle put i ne proglašava se bezuslovno sigurnim. Time se uklanja zabeležena SurfaceView resize putanja; native prihvat još mora potvrditi stvarni rezultat.
- Profil ima jednu odjavu na dnu, sa postojećom potvrdom, proverom identiteta/revizije i push revoke redosledom. Podrška ostaje u Podešavanjima. Aktivnosti su grupisane uz postojeće komponente.
- Lični podaci prikazuju sačuvani `workAreas` pre starog `grad` polja. Na telefonu je prethodno prikazano „Još nije podešeno“ za aktivan profil sa Novi Sad područjem. Nema upisa izmišljene lokacije.
- Dogovor zadržava prava/status/cenu/ljude; formalizovane su akcije i uklonjen dupli ulaz u prethodne saradnje. Prazna lista i dalje ima pristup istoriji.
- Eksplicitni `phone-preview` APK dobija ARM64 i x86_64, dok automatski isolated QA ostaje ARM64. Drugi već prijavljeni emulator prima ARM64 APK, ali njegov native bootstrap traži x86_64 `libreactnative.so` i pada. Stari kompatibilni APK vraćen je `install -r`, bez brisanja naloga. Taj emulator kvar nije uzrok fizičkog ANR-a.

## Dokaz i granice

- TypeScript `npx tsc --noEmit`: exit 0.
- `node --test scripts/ux-discovery-for-me.test.cjs scripts/location-grant-failclosed.test.cjs`: 23/23 PASS, susedna zaštita podataka/lokacije, ne native ANR test.
- `node --test scripts/ux-navigation-copy.test.cjs`: 46/46 PASS; stvarno montirani profil/ConfirmSheet proverava otkazivanje, dupli tap, blur, promenu naloga, grešku/retry i kasni odgovor; reprodukovan pogrešan izbor starog grada.
- `node --test scripts/ux-agreement-search.test.cjs scripts/r09-agreement-groups-client.test.cjs`: 61/61 PASS, uključujući obe uloge i pristup istoriji.
- Dva međusobna read-only pregleda promenjenih profile/Dogovor fajlova: bez konkretnog nalaza. Nisu zamena za telefon.
- Stari a22 APK: otvoreni Podešavanja, Lični podaci, područje rada, promena lozinke bez unosa, privatnost i prazna lista blokiranih; bez destruktivnih radnji ili plaćenih AI poziva. Novi izgled i renderer tek čekaju novi APK.
- DEV read-only 15:20–15:21 UTC: povezani telefonski nalog nema prijave, izabrane izvršioce ni Dogovore. Prazan ekran nije dokaz pokvarenog čitanja. Potreban je stvaran drugi Auth nalog i prijava→izbor→Dogovor za prikaz obe uloge.
- Baza/Edge/Auth/budžet nisu menjani. Poslednji puni CI pre ovog paketa ostaje `42637068510`; za novi paket je potreban nov run. Nema store/PROD tvrdnje.

## Native kriterijum zatvaranja

Isti novi APK, potvrđen source/hash/potpis, na telefonu i emulatoru; više otvaranja/zatvaranja mape i promene visine, tastatura/uređivanje/povratak, bez novog input ANR-a. Proveriti donji logout i otkazivanje potvrde, prikaz Novi Sad, Podešavanja i istoriju Dogovora. Zatim običan Auth tok prijave/izbora i isti Dogovor prikazan obema stranama. Ograničena proba ne dokazuje da svaki mogući ANR ili ceo release više ne postoji.

## Naknadni rezultat 16:04–16:15 UTC

Source `5ba9531ee49b12445409f14b292eb7bd1469bce5` prošao je [puni CI42646085496](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/42646085496): 1380/1380 Node, TypeScript bez dijagnostike, 233 migracije/72 integrity provere i native build. APK `f3e54eb02f32327e67f4178ba8d9e2a829397dc481f47b3b6e135331db4bf80a` sadrži ARM64 i x86_64, uključujući stvarni SDK57 Hermes `libhermesvm.so`. Isti potpisani bajtovi ponovo su preuzeti sa telefona i emulatora posle `install -r`; obe prijave ostaju sačuvane.

Na telefonu rade prikaz mape, proširenje liste, filteri, otvaranje tastature, zatvaranje filtera, prelazak na REMOTE listu i povratak na Početnu. Profil ima jednu odjavu na dnu; potvrda je otvorena i otkazana. Lični podaci sada prikazuju Novi Sad. Otvoreni su obaveštenja/upravljanje telefonom, privatnost/rokovi, podrška i O aplikaciji. Naknadni own-package exit-info ima samo očekivani PACKAGE UPDATED posle starog ANR-a; nema novog zabeleženog ANR-a u ovoj ograničenoj probi. [Binarni i native dokaz sa hash-evima snimaka](phone-mapfix-native-20261109.json).

Otkriven je zaseban stvarni blocker Dogovora: Milos je normalnim UI-em poslao jednu prijavu za prevod, ali server vraća `WORKER_PROFILE_NOT_READY`. Oba aktivna profila imaju sačuvano CITY područje, a prazno legacy `city` polje. Reader dopušta ručnu prijavu; submit/select/stale-resubmit writer još koristi stari city-only uslov. Nema potvrđene prijave ili Dogovora iz te probe. Popravka tih writer-a i ponavljanje celog Auth toka slede odvojeno. Obaveštenja prikazuju UNKNOWN transport stanje; dozvola telefona nije dokaz isporuke.
