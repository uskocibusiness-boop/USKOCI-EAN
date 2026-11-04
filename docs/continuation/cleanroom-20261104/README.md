# USKOČI CLEANROOM — evidencija provera, nije novi master

**Radna grana:** `work/uskoci-cleanroom-audit-20261104`  
**Fiksirani polazni izvor:** `839dd0a30228fbc34d46337e66449c053be434ea`  
**Radni režim:** potpuno odvojena grana; bez merge/cherry-pick postupaka, bez promene `work/rev14-review-f17`, `feature/uskoci-cisto`, živog DEV-a, korisničkih podataka ili produkcije.

Jedini izvršni master i dalje je [CODEX_PLAN_RADA.md](../../plan/CODEX_PLAN_RADA.md). Jedini Product/UX master i dalje je [USKOCI_PRODUCT_UX_MASTER.md](../../product/USKOCI_PRODUCT_UX_MASTER.md). Ova datoteka objašnjava isključivo dokaze **inventara svakog fajla**.

## Šta tačno dobijamo

Izvršavanje `node scripts/cleanroom-file-ledger.cjs artifacts/cleanroom-file-ledger` proizvodi:
- `FILE_LEDGER.csv` i `FILE_LEDGER.json`: **svaka praćena datoteka** sa putanjom, SHA-256, proverom git blob-a, osnovnom ulogom, statičkim vezama, sintaksnim statusom i izdvojenim upozorenjima;
- `RUNTIME_REVIEW_QUEUE.json`: red za dubinsku proveru stvarnog mobilnog i Edge izvršnog koda;
- `REPORT.json`: stvarni broj fajlova i izvornih veza, kritična upozorenja, veliki moduli i neproverene oblasti;
- `source-audit/`: originalni inventar, spisak lokalnih veza, nerazrešene reference, dinamičke reference i identične bajtove, napravljen već postojećim `scripts/product-audit.cjs`.

Artefakti provera se čuvaju izvan aktivnog koda, putem GitHub Actions. Ovim se ne pravi druga aplikacija i ne dodaje se nepotreban arhivski ZIP u repozitorijum.

## Granice dokaza, bez lažnih potvrda

**INVENTORIED / SHA_VERIFIED** znači da fajl postoji i da se njegovi bajtovi poklapaju sa Git izvorom.  
**STATIC_PARSED / JSON_PARSED** znači da je statički parser pregledao format; ne znači da je poslovna logika ispravna.  
**TS / JEST / AI CI PASS** označava tačno izvršene provere, ne garantuje stvarni Gemini odgovor, DEV ili Android ekran.  
**CODE_REVIEW_PENDING** je stanje fajla dok vlasnik te celine ne proveri upotrebu, semantiku, obradu grešaka, privatnost, performanse i kompatibilnost.  
**NATIVE / DEV / REAL_TWO_ACCOUNT** je **NOT VERIFIED** dok se konkretno ne dokaže.

Nula pronađenih statičkih referenci **nije** odobrenje za brisanje: Expo Router, native moduli, SQL, dinamički importi, alati i rollback mogu imati implicitne veze. Stare migracije se ne uklanjaju samo zato što su stare. Slično tome, automatski pronađeni dupli bajtovi ne dokazuju dupliranu poslovnu odgovornost.

**Fizičko brisanje** dozvoljeno je tek kada je odluka o fajlu posebno dokumentovana i testiran relevantni tok. Nezavršeni slučajevi ostaju označeni kao PENDING umesto da se prikazuju kao završeni.

**Izvršna naredba za sledeće realne provere:** `node scripts/cleanroom-file-ledger.cjs`, zatim ciljano pročitati i dokazati po celinama oba AI intervjua, Save/Publish, lokaciju, R01 privatnost, R05 matching, Dogovore/Poruke i R10 lifecycle. Najpre sadašnji aktivni izvršni kod, zatim reference iz istorijskog bridge-a — ne pokretati novu analizu svih starih ZIP-ova pri svakoj izmeni.
