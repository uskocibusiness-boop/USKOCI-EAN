# WPP02-A — granica primene

**Nije zahtev za odobrenje primene. Nije samostalan deploy paket.**

Postoje tačni forward/pause/resume artefakti i `sql-manifest.json`; oni omogućavaju konkretan pregled kanonskih preferenci i dispatch sloja. PostgreSQL dokaz je pripremljen, nije izvršen. Nijedan fajl ovog paketa nije primenjen na DEV.

Sledeći stvarni approval artefakt treba da bude **`APPROVAL.md` za kompletan WPP02**, tek kada sadrži:

1. Jedan tačan SHA256 forward paketa koji zajedno uključuje V1/V2 AI source/hash/turn/review/save/recovery, kanonske preference, iskustvo, uski notification merge i registry identity.
2. Aktuelne preimage i postimage funkcijske/schemа/ACL pinove, tačne closure digests i odvojeni certificate/export admission. Postojeća prazna export-policy instanca mora imati sopstveno stvarno rešenje; ne izmišljati legal podatke.
3. Disposable run/source/artifact receipte za stvarni Auth/ownership, direktne zabrane, konkurentne upise, source/registry/revision staleness, detailed/cheap parity, V1 receipt/replay, export, erasure i holds.
4. Kompatibilan APK i minimalni version-aware Edge paket sa tačnim readback granicama; jasno koji native tokovi su viđeni.
5. Kompatibilnu pauzu i resume, sa posledicom: postojeći podaci ostaju; profili sa novim filterima privremeno ne ulaze u automatsku selekciju. Ne spuštati rollback na ignorisanje odbijenih poslova.
6. Redosled primene, provere i nadzora poziva u toku; zaseban eksplicitan owner `primeni` u skladu sa AGENTS.

`candidate.sql` ovog parcijalnog koraka ne ispunjava stavke 1–4 i 6. Njegov privatni writer namerno nije aplikacioni endpoint. Nema prikrivenog certificate/hash prevezivanja, stvarnog push-a ili paid AI poziva.
