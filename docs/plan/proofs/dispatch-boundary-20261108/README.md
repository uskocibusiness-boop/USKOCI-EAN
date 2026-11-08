# Izolovani dispatch dokaz i oporavak izvora — 08.11.2026.

**LOCAL_ONLY. Nema promene aktivnog DEV dispatch-a, Cron-a ili prava.** Agent i koordinator su pre prekida okruženja nezavisno izvršili po11/11 scenarija na privremenom PostgreSQL17.11. [Zabeleženo opažanje](execution-observation.json) jasno odvaja taj rezultat od nedostupnih originalnih receipt fajlova.

Stvarni sačuvani tick/requeue/enqueue kod reprodukovao je zadržavanje prethodnih i budućih Need zaključavanja do kraja batch-a. Kandidat sa zasebnim transakcijama oslobodio je ta zaključavanja i sačuvao prethodno commit-ovan posao posle prekida procesa. Negativne kontrole dokazale su potrebu prenosa transakcione v1b.notified vrednosti i skupa već obrađenih Need-ova. Profile sweep izvršen je jednom.

**Talas i maintenance bili su izričite testne zamene.** Budžet2 u toj kontroli nije važeća produkciona konfiguracija: stvarni dispatch_config_v1b prihvata50–1500. Nema dokaza punog matchera, stvarnog notification ledgera, svih lifecycle trigger-a, konkurentnog stvarnog selection writer-a ili hosted pg_cron putanje. Ovo nije kapacitetni benchmark.

## Šta je trajno sačuvano

[Manifest](recovery-manifest.json) povezuje pet kompleta SQL izvora oporavljenih iz celovitih alatnih rezultata i njihove SHA-256/Git blob identitete. Koordinator ih je ponovo otvorio preko GitHuba, proverio JSON strukturu, broj bajtova i odsustvo obrazaca tajnih ključeva. Poslednji komplet kandidatskih helpera odvojeno je sačuvan iz rezultata čitanja; njegov prethodni lokalni upis nije potvrđen.

## Šta je prekinuto

Izvršni runner, SQL kandidat i sirovi receipt-i kopirani su u lokalni proof direktorijum i test je ponovljen pre prekida, ali njihov završni GitHub commit nije izvršen. Posle gubitka okruženja tačni kompletni stringovi nisu bili dostupni u store-u, pa nisu rekonstruisani iz skraćenih ispisa. Ako se stara radna kopija vrati, proveriti zabeležene hash-eve pre integracije. Ako se ne vrati, ponovo napraviti i izvršiti izolovani test iz sačuvanih preimage izvora.

Novi test stvarnog ON_SITE talasa nije pokrenut. Sledeći korak koristi60 sintetičkih radnika, dva zadatka i budžet50, uz stvarni dispatch_next_wave i jedinstveni ključ primaoca/zadatka/revizije. Event sink ostaje posebno označena zamena. Top-level CALL kroz hosted pg_cron ostaje zasebna kapija.

Autoritet ostaje [izvršni master](../../CODEX_PLAN_RADA.md) i [postojeći dispatch nalaz](../capacity2-dispatch-transaction-20261108.json).
