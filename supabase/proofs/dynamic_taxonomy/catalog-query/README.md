# Serversko istraživanje aktuelnog kataloga

Nova read-only funkcija: `public.rpc_taxonomy_query_catalog_service(p_query jsonb)`. Postojeći reader, normalizer, admission fingerprint, review, Save i writer ostaju neizmenjeni. Migraciju `20261019085714_taxonomy_query_catalog_service.sql` napravio je Supabase CLI.

## Ugovor

```ts
type Query = {
  operation: 'META' | 'EXACT' | 'SEARCH' | 'ROOTS' | 'CHILDREN' | 'SIBLINGS' | 'ANCESTORS' | 'RESOLVE';
  scope?: 'ALL' | 'REMOTE' | 'ON_SITE'; // default ALL; EXACT mora biti ALL
  text?: string; // samo EXACT/SEARCH, 1–256 znakova
  categoryId?: string; // CHILDREN/SIBLINGS/ANCESTORS
  categoryIds?: string[]; // RESOLVE, 1–100 različitih UUID po zahtevu
  limit?: number; // 1–100, default 32; granica stranice, ne celog kataloga
  cursor?: string | null;
  catalogVersion?: number;
  catalogFingerprint?: string;
};
```

Odgovor ima `schemaVersion: TAXONOMY_CATALOG_QUERY_V1`, `action: CATALOG_QUERY`, operaciju/scope, kanonski `catalogVersion` i `catalogFingerprint`, `items`, `count`, `nextCursor`. Stavka sadrži `categoryId`, `label`, `parentId`, deterministički sortirane različite `aliases`, oba stvarno podržana `modes`, pun `path`, `pathIds` i `isLeaf`. Sve tri authority vrednosti su `NONE`, a pregled vlasnika ostaje obavezan. `META` vraća prazne stavke i `totalCategories`; taj broj nije potvrda integriteta svake grane.

`EXACT` pretražuje sve ESTABLISHED kategorije sa podržanim režimom, kroz kanonski naziv i sačuvane normalizovane alijase, nezavisno od režima korisnikovog zadatka. Sva poklapanja mogu se preuzeti stranicama. Zato drugi ID sa istim alijasom nije sakriven iza drugog režima ili prve stranice. `SEARCH` je leksička pretraga: tačan naziv, tačan alijas, prefiks i podniz. Nije semantička garancija niti dokaz da ne postoji drugačije imenovana srodna kategorija.

`ROOTS` otvara vrhove, `CHILDREN` neposrednu decu, `SIBLINGS` braću bez izabranog čvora, `ANCESTORS` roditelje od najbližeg do korena. `RESOLVE` razrešava tražene ID-jeve; nepoznat ili neodobren ID ne postaje stavka. Nema globalnog limita kategorija ili broja nivoa. Postoje per-request granice: ulaz 16 KiB, stranica 100 stavki, rezultat 1 MiB i funkcijski timeout 5 s. Prevelik rezultat daje grešku, ne lažno prazan ili potajno odsečen katalog.

## Doslednost i bezbednost

- Prvi poziv uspostavlja trenutno stanje. Edge mora vezati dalje istraživanje i završnu proveru za dobijeni version/fingerprint par. Nepotpun ili nevažeći par se odbija; promenjen par vraća `PT409 / TAXONOMY_QUERY_STALE_CATALOG`.
- Cursor sadrži snapshot i digest normalizovane operacije/filtera, plus keyset položaj. Ne može se preneti na drugu pretragu ili granu. Nije autorizacioni token i ne odobrava ID ili uslugu.
- Novi alijas ili promenjeno normalizovano značenje ruši fingerprint čak i bez povećanja verzije. Postojeći kanonski fingerprint namerno ostaje jedini javni owner: display-only promena naziva ili skripta koja ostavlja isti canonical/normalized key nije obuhvaćena tim fingerprintom. Ovaj paket ne uvodi drugi ili treći paralelni snapshot ugovor.
- Rekurzivna putanja proverava kompletan ESTABLISHED lanac, cikluse i režime svih predaka. Nekonzistentna izabrana grana vraća `55000`, ne skraćenu putanju. Provera je konzervativna: ne skriva neispravan deklarisani režim čvora.
- Funkcija je `STABLE SECURITY INVOKER`, sa fiksnim `search_path`. Samo service_role ima EXECUTE; dodatno se proverava stvarni JWT role. Koristi postojeća SELECT prava. Nema definer privilegija, novih tabela, indeksa, podataka ili canonical upisa.

Konačna Edge validacija mora izvršiti `EXACT` za svaku relevantnu uslugu/etiketu i `RESOLVE` za izabrane ID-jeve i roditelje, iscrpeti relevantne stranice i potvrditi isti snapshot. Delimično istražen skup nije dokaz globalne jedinstvenosti. Ni ovaj RPC ni modelski predlog ne menjaju kompetencije: potreban je potpisan pregled i stvarni Save.

## Dokaz i vraćanje

Workflow `taxonomy-catalog-query-pg-proof.yml` izvršava fixture, proveru prethodnog odsustva, migraciju, assertione, rollback, ponovnu proveru odsustva i reapplication na PostgreSQL 16 i 17. Sintetički katalog sadrži 248 ESTABLISHED kategorija, 130 globalnih alias poklapanja i lanac od 26 čvorova. Pokriveni su paging bez gubitka/ponavljanja, pretraga oba pisma, oba režima, svi načini istraživanja, cross-mode kolizija, stale cursor/non-cursor par, promena alias-a bez version bump-a, malformed ulaz, ciklus/roditeljski režim, stvarni service_role poziv, JWT i ACL odbijenice, nepromenjeni stari reader/dependencies i nepromenjeni canonical podaci.

`before-metadata.json` i `current-dependencies.sql` su read-only snimak stvarnih zavisnosti. Migracija proverava njihov MD5 i odsustvo novog RPC-a. `revert.sql` odbija neočekivano promenjen RPC i uklanja samo ovu novu funkciju bez CASCADE. Nema rollback-a korisničkih podataka.

Lokalno nema PostgreSQL izvršnog okruženja. Pripremljeni fixture i statička provera nisu tvrdnja da je PG CI prošao, da je migracija primenjena, niti da je kompletan AI tok proveren. Glavni agent zasebno integriše Edge i dokaze primene.

Primarni izvori provereni 19.10.2026: Supabase changelog, database functions/privileges i [funkcijski timeout](https://supabase.com/docs/guides/database/postgres/timeouts). Leksička pretraga trenutno koristi postojeće indekse za ID/grane i sken za podniz; dodavanje novog indeksa nije opravdano bez izmerenog usporenja. Kanonski fingerprint je već globalni obračun po pozivu.
