# USKOČI ADR — Jedinstvena semantika vrste posla; način izvršenja je odvojen atribut

**Datum:** 2026-10-16  
**Status:** Potvrđen produktni smer; **source-only specifikacija**, bez primenjene šeme, migracije, live flag-a ili OTA.  
**Prvenstvo:** Ova odluka pojašnjava raniji opis "dve glavne grane ON_SITE/REMOTE": to su **dva režima izvršavanja**, ne dve kopije profesionalnog stabla, niti dva nezavisna UUID-a za istu uslugu. Istorijske RU/proof dokumente ne prepisivati retroaktivno.

## 1. Tri odvojene dimenzije

1. **Jedinstvena vrsta posla / service identity**: semantički definisana radnja + predmet + domen, stabilan UUID i jedinstveno profesionalno stablo (npr. `Edukacija > Jezici > Časovi engleskog`). Način isporuke nije deo identiteta.
2. **Worker offers / radnik čime se bavi**: radnik potvrđuje jednu profesiju ili konkretnu užu uslugu i koji način izvršavanja prihvata za nju. Potvrđena šira profesija pokriva samo *stručno validirane standardne podvrste* (roditelj → dete). Potvrda deteta nikada ne daje roditelja ni sestrinske grane. Eksplicitni izuzeci i bezbednosni zahtevi ostaju.
3. **Task execution policy / način konkretnog zadatka**: `ON_SITE`, `REMOTE`, ili situacija sa oba režima. Razlikovati **EITHER** (može online ILI uživo, dovoljan jedan) i **BOTH_REQUIRED** (postoje dve obavezne faze, npr. video konsultacija + dolazak). Ovo nisu kategorije; za rad na terenu čuva se postojeća preciznija putanja STATIONARY / POINT_TO_POINT / MULTI_STOP / AREA_BASED.

**Ručni alat, vozilo i inventar nisu podrazumevane gate provere za notifikaciju i prijavu**; u opisima su informativni. Izričite regulisane/bezbednosne obaveze proveriti zasebno, ne pretvarati svaki specifičan alat u kvalifikaciju.

## 2. Semantička jednoznačnost

- Gole reči "montaža", "popravka", "servis" nisu identitet usluge. `montaža ormara`, `montaža video-snimka` i `montaža slavine` moraju imati odvojene profesionalne identitete; pitanje konteksta rešava Gemini, ali **server** potvrđuje katalog.
- Isti service UUID može podržavati `ON_SITE` i `REMOTE`; ne umnožavati identitete zbog režima. Sinonime/padeže/pisma prijemno normalizovati, ali semantički različite homonime ne spajati po jednom stringu.
- `canonical_key` trenutno zavisi isključivo od `normalize(label)` i ima globalni UNIQUE, a alias tabela UNIQUE na (`locale`,`normalized_key`). Pre nego što podržimo istovetne nazive sa različitim značenjima, obezbediti kontekstno razrešenje ili eksplicitni disambiguirani kanonski naziv (domen + objekat), bez nebezbednog ukidanja postojećeg UNIQUE.
- NOVA stvarna vrsta posla: Gemini predlaže `CREATE_CHILD` ili novu profesionalnu granu, ali nikada ne bira lažnog roditelja niti autonomno dodeljuje worker capabilities. Server koristi katalog, proverava roditelja, duplikate, reviziju, bezbednost i evidenciju. Rizične/nejasne predloge odvojiti; bez nepotrebnog operatora za svaki običan novi posao kada bude dokazano pouzdan automatski režim.

## 3. Izvršavanje i dispečer

- Worker `Časovi engleskog` može eksplicitno nuditi `[ON_SITE,REMOTE]`. Dve dozvole su dva reda `(category_id,execution_scope)`, a ne dve kategorije.
- Task `EITHER`: dozvoljava `[ON_SITE,REMOTE]`; svaki radnik se filtrira po stvarno potvrđenom režimu i zadatku, ali se ne obaveštava duplo ako nudi oba. UI prikazuje mogući način izvođenja; dogovor potvrđuje koji je izabran.
- Task `BOTH_REQUIRED`: potrebno je eksplicitno modelovati faze, odgovornost, termine i lokaciju. Ne tretirati ga kao `EITHER` niti kao dva nezavisna posla bez dogovora.
- Za `REMOTE`: ne zahtevati PostGIS radijus. Za `ON_SITE`: primeniti radnikov radijus i privatnost tačne adrese. Za `EITHER`: odabrani kanal odlučuje koje provere važe; ne prihvatati `REMOTE` kao zaobilaznicu za obavezni fizički dolazak.
- Dispečer prvo uzima direktan identitet, provereno ekvivalentne identitete i dokazanu **nizvodnu** standardnu pokrivenost radnikovih izabranih predaka; ako ponuda nedostaje, testira samo odobrene srodne usluge uz radnikov pristanak. Nema globalnog "svi zanati", nijednog nasumičnog push-a, nema širenja radijusa bez pristanka. Pored tehničkih filtera obezbediti requeue/replay u granicama revizije; ne tvrditi da je poslato bez dostavnice.

## 4. Verified read-only DEV snapshot (2026-10-16)

- Supabase `leqcwgzvjsxugfgzdmth`: `private.work_taxonomy_categories` ima **141** kategoriju; `private.work_taxonomy_category_modes` ima **120 ON_SITE** i **21 REMOTE** red, **nula kategorija sa oba režima**. Nema fizičkih `ON_SITE` / `REMOTE` root čvorova; 17 root čvorova su nazivi delatnosti.
- Šema **već dopušta** više modova na istom identitetu: `PRIMARY KEY (category_id, execution_scope)`, `execution_scope CHECK IN ('ON_SITE','REMOTE')`. **Ne treba novo stablo ni novi identitet**.
- `Časovi engleskog jezika` trenutno imaju samo `REMOTE`, iako mogu da se održavaju uživo; drugi zadaci takođe mogu imati pogrešno ili nepotpuno vezan režim.
- `public.needs.execution_location_mode` ima samo **jedan** režim sa dozvoljenim vrednostima `STATIONARY`, `POINT_TO_POINT`, `MULTI_STOP`, `AREA_BASED`, `REMOTE`; ne postoji `EITHER` niti `BOTH_REQUIRED` kao prihvaćen zapis. **Ne uvoditi prost `HYBRID` enum i ne menjati CHECK na slepo**.
- Potpisani radnički review već podržava `reviewedServiceModes` listu i `(service,mode)` parove, ali opcioni client flag i Save/binder nisu dokazani E2E. Potvrđene capability/mode tabele su prazne na ovom preseku.
- Postoje pogrešna smeštanja pod `Zanati i popravke` (npr. časovi klizanja, prevod, web dizajn). Ne otvarati nasleđivanje preko AI-poreklom označenih veza dok se profesionalna pokrivenost ne proveri.
- `private.taxonomy_scope_eligible_v1` trenutno traži tačan leaf UUID po radniku, što preseca nameravanu stručnu nasleđenu pokrivenost u `taxonomy_requirement_tier_inherited_v1`; to ostaje zasebni P0 korektivni zahvat, sa dokazima pre live promene.

## 5. Minimalni plan bez regresija

1. Napraviti **read-only** audit svih 141 `category_id` i njihovih mode oznaka, semantičkih roditelja, duplikata značenja i eventualnih nezgodnih naziva. Ne premeštati i ne brisati postojeće identitete u toj fazi.
2. U izolovanoj bazi testirati bezbedno dodavanje **drugog** scope reda na **istom** UUID-u, sa dva worker-mode izbora, jednom on-site ili remote need klasifikacijom. Sačuvati postojeći client ugovor.
3. Posebno dizajnirati kompatibilan `accepted_execution_modes`/policy objekat za `EITHER` i fazni plan za `BOTH_REQUIRED`; prvo Android UX i backend revizije, pa bezbedna migracija. Željenim promenama kategorije ne menjati već sklopljene Dogovore.
4. Proširiti klasifikacioni pregled i potpisani Save: potvrditi *service identity* i *mode* odvojeno za radnika i zadatak, sprečiti duple notifikacije i nepodesne remote/onsite prelaze.
5. Dokazati: isti `Časovi engleskog` UUID za online/u učionici, različite UUID za tri vrste "montaže", profesija→standardna podvrsta ali ne obrnuto; remote bez radijusa, onsite sa radijusom, `EITHER` bez duplog push-a, `BOTH_REQUIRED` sa obe faze, nema alata kao gate, error/retry/revision/idempotency.
6. Tek posle fixture CI, signed owner tests, DEV dry run, kontrolisanih DEV zapisa i dva fizička naloga dozvoliti širi rollout.

**Status:** bez DB promene, bez aktiviranih feature flagova, bez retroaktivnog prijavljivanja kategorija ili korisničkih sposobnosti. Ovaj ADR je kanonsko razjašnjenje dimenzija, ne dokaz gotovog kombinovanog matchinga.
