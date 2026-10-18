# Prazan prikaz „Na daljinu“ — 18.10.2026.

## Nalaz i odluka

U Metro debug APK-u na `emulator-5554` brzi filter „Na daljinu“ ispravno sklanja mapu i otvara listu. Kada lista nema rezultat, generičko stanje je i dalje prikazivalo veliku sliku mape i „Nema zadataka u ovom prikazu“. To nije odgovaralo kontekstu rada na daljinu.

Stanje sada razlikuje prazan REMOTE filter: slika je postojeći `FactArt remote` (laptop), naslov „Nema zadataka na daljinu“, a objašnjenje kaže da nijedan zadatak na daljinu ne odgovara izabranim uslovima. Dugme „Poništi filtere“ čuva postojeću radnju i server/filter ugovore. Ostala prazna stanja ostaju ista. Nema novih paketa, RPC-ja ili upisa u Supabase.

## Provera i granice

- `discovery-presentation.test.tsx`: 229/229 PASS, uključujući novi test praznog remote prikaza.
- `npx tsc --noEmit --pretty false`: PASS.
- Metro debug APK na emulatoru: nakon izbora „Na daljinu“ nema mape, broj je `0 zadataka`, a prazno stanje pokazuje laptop i odgovarajući tekst. Snimak je u lokalnom Codex `outputs` kao `uskoci-remote-empty-after-20261018.png`.
- Nisu provereni veliki skup zadataka, kamera i pinovi pri mnogo zadataka, fizički telefon ili release APK. Status B04 ostaje DELIMIČNO.

## Razlika prema UX nacrtu

Zadržan je jedan ekran mape i liste, kao i neposredan pristup zadacima na daljinu. Izmenjena je samo povratna informacija kada taj podskup nema rezultat, da stanje prati izabrani režim umesto vizuelne metafore mape.
