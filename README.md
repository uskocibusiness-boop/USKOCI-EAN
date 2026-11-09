# USKOČI — čist izvršni proizvod (izdvojena grana)

Ovo je samostalna radna grana za aktivan React Native/Expo kod,
Supabase Edge funkcije, kanonske migracije baze, native integraciju,
brend-resurse i konfiguraciju izgradnje.

**Ovo nije spajanje sa glavnom granom i nije nova aplikacija od nule.**
Polazni izvor: work/uskoci-cleanroom-audit-20261104
na commitu 357d767d9f7ad61b0cd452c9c3a0e44b1b69664f.

## Radni autoritet — odluka vlasnika 09.11.2026
- AGENTS.md — obavezna pravila za Codex i zastita potvrdjenih odluka.
- docs/plan/CODEX_PLAN_RADA.md — tehnicki plan i istorija, **nije UX autoritet**.
- Stari Product/UX master je povucen i obrisan iz aktivne grane; ne citati, ne vracati, ne koristiti.
- Poslednje potvrdjene odluke vlasnika odredjuju nameravano ponasanje; kod i testovi pokazuju stvarno stanje.

## Čisti proizvod
- src/app — ulazi Expo Router ekrana.
- src/features, src/data, src/contracts, src/ui, src/hooks — aktivna aplikacija.
- supabase/functions — aktivni Edge kod i zajednički validatori.
- supabase/migrations — kanonska SQL istorija (nije cela DEV ledger istorija).
- assets, config, modules, plugins, patches, vendor — build/resursi.

## Razvoj bez nepotrebne istorije u folderu
Velika kolekcija QA provera, SQL kandidata, istorijskih analiza i
restore dokaza nije obrisana iz Git istorije. Čuva se u drugoj grani,
work/uskoci-cleanroom-audit-20261104, na prethodno pinovanom commitu.
Tamo se po potrebi izvršavaju detaljni testovi nad aktuelnim kodom.
Ova grana koristi mali smoke test preko npm test i zadrzava
postojeci QA APK workflow za zasebnu Android proveru.

## Lokalna izgradnja
npm ci
npm test
npx tsc --noEmit
npx expo export --platform android

Ovo nije potvrda realnog Gemini razgovora, Supabase DEV Auth/RLS,
instaliranog APK-a ili stvarnog dvo-naložnog toka. Produkcioni backend
mora imati odvojenu verifikaciju i ne sme naslepo koristiti DEV postavke.
