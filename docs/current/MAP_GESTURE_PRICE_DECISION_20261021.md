# Mapa: brzo prevlačenje, pin i cena — odluka za native proveru

**21.10.2026, izvorni presek.** Korisnik želi da jako prevlačenje mape prirodno nastavi i uspori, da mali pinovi budu jasni, a izabrana kartica legne do dna bez donje navigacije. Ovo još nije potvrđeno na HONOR-u za tekući izvor.

## Šta izvor zaista radi

- `src/ui/v2/DiscoveryMap.tsx` koristi nativni MapLibre `Map`, `dragPan` je podrazumevano uključen, a `touchPitch`/`touchRotate` isključeni. `onRegionDidChange` beleži *smirenu* kameru; tek nakon `AREA_SETTLE_MS` šalje vidljivu oblast listi. `onRegionWillChange` otkazuje stari čekajući upit kada korisnik ponovo uhvati mapu. Nema JS petlje koja ručno pomera kameru po svakom kadru.
- Javni tip instaliranog `@maplibre/maplibre-react-native` 11 (`node_modules/@maplibre/maplibre-react-native/lib/typescript/module/components/map/Map.d.ts`) nudi `dragPan` i zoom geste, ali nema javnu vrednost za trenje/inerciju. Stvarni nastavak kretanja prsta zavisi od nativnog SDK-a i uređaja. `easeTo` u `DiscoveryMap.tsx` služi za **programske** letove do izabranog mesta/pina, ne za kinetiku korisnikovog prevlačenja.
- `src/ui/v2/discovery/DiscoveryV1ServerMarkerLayer.tsx` prikazuje P6 bucket kao nativnu kapsulu: jedan zadatak ima marku, grupe imaju broj; serverov map bucket nema cenu. `src/ui/v2/discovery/PricePill.tsx` zna da prikaže cenu u starijoj javnoj putanji, ali ne sme da izmisli cenu u P6 markeru. Izabrana kartica prikazuje cenu iz čitanog zadatka.
- `src/ui/v2/DiscoveryPresentation.tsx` i `(app)/_layout.tsx` kriju donju navigaciju uz izabrani pin, a kartica koristi donju sigurnu ivicu. Ovo je izvorni raspored, bez novog native screenshot-a.
- Posle izbora pina `DiscoveryPresentation.tsx` sada uklanja brzu traku datuma/čipova; dugme „Filteri” ostaje, a izabrani kriterijumi se vraćaju kada se kartica zatvori. Provera oba putanja, legacy i P6, prošla je u ciljanim testovima mape (325/325). I dalje nema provere na telefonu.

## Provera pre promene kinetike

Na istom kandidatu APK-a i HONOR telefonu snimiti tri jaka poteza mape u oba smera, sa panelom u `peek` i `half` položaju. Posmatrati: nastavlja li se kamera posle puštanja, da li prirodno usporava, da li se rezultat menja tek na krajnjoj oblasti, da li kartica/pin ili list panel prekidaju gest, i da li se posle detalja vraća isti viewport. Ako se kretnja zaista zaustavlja naglo, prvo reprodukovati koja komponenta presreće gest ili remountuje mapu; zatim menjati nativni gest konfiguraciju uz merenje. Ne dodavati nezavisni JS `fling`, jer bi dao dve različite kamere i pogrešnu oblast pretrage.

## Cena na malom pinu

Za P6 je potreban autoritativan podatak u map bucket-u: `FIXED` iznos i osnova (`ukupno`/`po satu`) u RSD, `OFFERS` bez izmišljene cifre, te `COUNT` za klastere. Uz to treba odrediti ograničenje dužine, preklapanje i prioritet izabranog pina. Predlog prikaza: **jedan zadatak** tiha bela kapsula sa sažetom cenom ili „Ponude”; **više zadataka** broj zadataka; **izabrani** narandžasta kontura, dok puna kartica prikazuje celu cenu i uslove. Remote zadatak nema fizički pin. Dok read model ne donese taj ugovor, mali P6 pin ostaje znak zadatka, a cena živi u kartici.

Uži izuzetak je **već izabrani TASK pin**: nakon exact-task čitanja `p6Seam.peek.item` sadrži autoritativnu cenu. Ona se može vezati samo ako `peek.key` odgovara izabranom ključu i `item.id` ID-u tog TASK markera, bez proširenja bucket-a. Sadašnji izabrani nativni pin je fiksan sprite bez mesta za tekst, pa bi to zahtevalo poseban simbol/kapsulu i HONOR proveru preklapanja; nije implementirano. PLACE i CLUSTER marker i dalje nemaju jednu istinitu cenu.

Ovo je UX/tehnička odluka i kontrolna lista, ne tvrdnja da je kinetika ispravljena ili cena već na P6 pinu.
