# USKOČI — AI upravlja rastom kategorija, server odlučuje i čuva integritet

**Potvrđena odluka vlasnika, 12.10.2026:** dozvoliti postojećem Gemini AI-u da predlaže dopune i izmene kataloga kategorija i potkategorija, bez ručnog programiranja za svaki novi posao. Ne dozvoliti direktan AI pristup SQL tabelama, brisanje postojećih kategorija ili pripisivanje radniku nepotvrđenih sposobnosti.

## Kanonsko drvo (ne zatvorenih 11 vrsta)

1. **Na lokaciji (ON_SITE)**: STATIONARY, POINT_TO_POINT, MULTI_STOP, AREA_BASED, sa lokacijskim i privatnosnim pravilima.
2. **Na daljinu (REMOTE)**: poslovi bez fizičkog prisustva, bez obaveznog pina/radijusa.

Unutar obe: kategorija → potkategorija → uža potkategorija → proizvoljna dalja dubina. Prepoznati sinonimi vode na postojeći identitet. „Krečenje dve sobe“ menja obim zadatka, ne uvodi automatski novu uslugu. Ista usluga može, kada je potvrđeno smisleno, imati veze za oba režima, ali to ne proširuje automatski radničke kompetencije.

## Pravila koja se ne smeju zaobići

- **AI je predlagač**: generiše tekst i eventualnog roditelja. Nije autoritet za bazu, radnika, lokaciju ili slanje obaveštenja.
- **Naručilac je vlasnik konkretnog zadatka**: potvrđuje radnju za stvaran DRAFT, sa tačnom revizijom. Predlog se vezuje za bazom potvrđeni `needs.category` i `needs.execution_location_mode`, a ne za proizvoljne `reviewed:true` iz zahteva.
- **Server je jedini izvršilac promene**: validira semantičku dvosmislenost, originalnu vrstu posla, sinonime, opasne/regulisane radove, parent/granu, ograničenje brzine, zaključavanja, identitete i atomsku evidenciju.
- **Bez duplikata i „siročića“**: identitet ili postojeća potvrđena usluga u istoj grani, ili predlog novog deteta potvrđenog roditelja. Nikad novo ime bez validnog scope parenta.
- **Potkategorija nije veština**: samo konkretne sposobnosti koje je radnik izričito potvrdio mogu da postanu jedan od uslova matchinga. Roditeljska kategorija i AI sličnost ne stvaraju push pravo.
- **Audit, verzija, rollback**: sve promene čuvaju poreklo, reviziju i pre/post stanje. Automatsko spajanje, brisanje, preimenovanje već korišćenih identiteta i menjanje korisničkog sadržaja zabranjeno; predlog za operatora.
- **No match is visible**: kada nema potvrđeno odgovarajućih radnika, sačuvaj zadatak i izloži objašnjenje; ne šalji slučajnoj susednoj kategoriji.

## Izvođenje po etapama

**A — instalirana baza (VERIFIKOVANO):** 14 početnih grupa (11 ON_SITE, 3 REMOTE), katalog sa `parent_id`, aliasima i audit podacima, servisi read-only za proveru, Gemini v63 shadow, radnički režimi. `auto_registration_enabled=false`.

**B — kandidat, u testiranju:** `dev-owner-bound-taxonomy-change-requests.sql` uvodi privatnu red čekanja `PENDING_REVIEW`. Samo prijavljeni vlasnik tekućeg DRAFT zadatka može zahtevati proširenje. Ne menja kategorije, ne upisuje worker capability ni need snapshot, ne objavljuje i ne šalje push. Rizici/duplikati vraćaju odvojena objašnjenja. Ovo nije isto što i automatsko kreiranje.

**C — još nije implementirano:** posebna autorizovana promocija potvrđenih predloga, sa revalidacijom aktuelnog vlasnika, revizije, roditelja, bezbednosti, semantičke jednoznačnosti, vremenskog budžeta, zaključavanja i atomskim vezivanjem `ON_SITE/REMOTE`; idempotentna kategorija+alias+audit operacija. Low-risk režim tek posle dodatnih nezavisnih dokaza, operator-review za konflikt/rizik. Nikad otvoreni endpoint „AI kaže LOW_RISK_VERIFIED“.

**D — integracija posla i radnika:** serverski pregled `review ≠ save ≠ activation`, čuvanje category_id + mode sa revizijom zadatka, posebno radničko potvrđivanje category_id i podržanih načina rada, pravi matcher i dispatch uz vreme, lokaciju, zaštitu privatnosti, zahteve, profil, consent, block i capacity. Potvrditi na realnom Android telefonu sa dva naloga, kontrolisanim push-om i tačnim otvaranjem ekrana.

**E — produkcija:** formalne migracije i rollback dokazi, staged OTA/APK, potpuno 30k korisničko opterećenje samo na izolovanom sistemu, RLS/HTTP/FCM provere i store QA.

## Bezbednosne blokade koje ostaju

- `private.taxonomy_register_low_risk_v1` je postojeći konceptualni registrar sa parametrima koje bi neovlašćeni klijent mogao da lažno navede da nije zaključan; trenutno je auto flag OFF i servis DML opozvan.
- Trenutni risk triage zasnovan na rečima nije dovoljan da samostalno autorizuje bilo koji legitiman posao. Potreban slojeviti servisni admission pregled, uz spoljne restrikcije (zdravstveni, regulisani, opasni, nezakoniti radovi), neusaglašene sinonime i audit.
- Katalog je na kanonskom **DEV `leqcwgzvjsxugfgzdmth`**, a ne u produkciji. Nijedan novi deploy bez uspešnih nezavisnih testova i postflight provere. Ne prebacivati feature flag na ON samo da bi AI mogao da menja bazu.
