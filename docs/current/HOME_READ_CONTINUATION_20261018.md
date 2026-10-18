# Početna i Dogovori — nastavak tehničkog čišćenja

Polazni kod: `6cfc348a1216e5c8ff71525f96ee56262d2aff9c`, grana `feature/unified-qa-master-20261017`. Nastavak ranije objavljenog čišćenja, bez promene rasporeda ekrana. Dokaz: [strukturirani rezultat](evidence/HOME_READ_CONTINUATION_20261018.json).

## Primenjeno u izvoru

- Početna dobija zbirne brojeve prijava kroz postojeći `mojePrijaveStrana(ALL, 1)` umesto cele istorije. Broj ne zavisi od jedine vraćene stavke; prethodni potpuni prikaz prijava ostaje dostupan svom ekranu. Nedostajući zbir ostaje nedostupan, bez izmišljene nule ili nepotpunog broja.
- Čitanja Početne završavaju čekanje kada ekran izgubi fokus, promeni se nalog, aplikacija ode u pozadinu ili istekne 15 sekundi. Dogovori i aktuelni zadaci dobijaju taj signal i na transportu. Uspešne opcione sekcije zadržavaju postojeći oporavak; neodazivan servis ne drži ekran zauvek.
- Dogovori više ne prihvataju neispravan nastavak kao kraj spiska. Proveravaju se boolean `hasMore`, identiteti, duplikati i napredovanje kursora kroz stranice, sa PostgreSQL mikrosekundama i UUID redosledom. Greška kasnije stranice odbija ceo rezultat. Ograničenje od 20 stranica ostaje izričita greška.
- Postojeći preview workflow sada podrazumeva x86_64 emulator, kako nalaže aktuelni AGENTS. ARM64 telefon ostaje izbor pri ručnom pokretanju. Novi izvor uključuje i prethodno čišćenje mrtvog koda.

## Provera

Pre ispravke 21 od 24 nova testa reprodukovalo je problem. Posle ispravke povezane provere: 7 grupa / 237 testova; dodatne provere životnog veka i stvarne rute: 3 grupe / 155 testova. Skupovi se preklapaju i ne sabiraju se. Puna regresija: **621 grupa / 13.861 test / 3 snimka PASS**, bez preskočenih testova. TypeScript, vlasništvo izvora i native patch guard prolaze. Jest je ispisao upozorenje o kasnom izlasku; konačan process exit-code nije preuzet pre povlačenja sesije. JSON rezultat je `success: true`; nije korišćen prinudni izlazak. Native isporuka se beleži odvojeno po završetku.

DEV je samo pročitan. Kroz stvarnu `authenticated` ulogu, claims i API preflight upoređeni su novi zbir i stara puna lista za tri postojeća naloga; brojevi su jednaki. Proveren je i oblik stranica njihovih Dogovora. Izvršivi read-only dokaz je `supabase/proofs/home-read-reliability-20261018/application-summary-read.sql`. Nema poslovnih upisa, migracije ili Edge objave; ledger ostaje 288, poslednja verzija `20261018201517`.

Ovi nalozi imaju 1/0/0 prijava. Omotač nove stranice na tako malom skupu ima više JSON bajtova; korist je ograničen rast odgovora sa istorijom, ne ovde izmereno ubrzanje. Velike brojeve, više stranica, povratak i neispravne odgovore pokrivaju lokalni testovi. SQL role provera nije HTTP niti emulator dokaz.

## Preostalo u istom planu

Početna i dalje uzima pune zadatke i Dogovore zbog nacrta, tačnih zbirnih brojeva, budućeg prihvaćenog termina i nedovršenih obaveza. Za njih treba poseban sažetak sa dokazom istog značenja. Četiri osnovne sekcije i dalje čekaju zajedno. Ostala jednokratna čitanja se logički povlače, ali ovaj paket ne uvodi fizički abort u svaki servis; stara dopuna ocena zadržava svoj postojeći limit od četiri sekunde.

Devet ranije sačuvanih cleanup kandidata nije obrisano bez provere stvarne uloge. Mapa, UI kompozicija, ikone i AI tokovi ostaju u svojim postojećim redovima plana. Nema podizanja PHONE/RELEASE prihvatanja, tvrdnje o instalaciji ili ukupnom ubrzanju aplikacije.
