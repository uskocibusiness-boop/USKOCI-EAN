# Runtime zastavice, payload i latencija

Ključevi nisu čitani/beleženi. Source uključuje dual režim u DEV-u osim kada je USKOCI_TAXONOMY_DUAL_GEMINI=false; raniji logovi pokazuju BG aktivnost, ali tačne skrivene flag vrednosti nisu potvrđene.

| Mera | Stvarno značenje |
| --- | --- |
| NEED_COMPLETE / WORKER_COMPLETE | Samo completion/writer RPC. Ranijih približno 120–329 ms NIJE vreme Gemini odgovora. |
| PROVIDER | Novi lokalni wrapper za oba direktna streaming poziva; čekanje i prijem stream-a, bez naknadnog parse/writer/readback/UI. |
| NEED_BG_ARCHITECT / WORKER_BG_ARCHITECT | BG katalog/klasifikacija; ranijih približno 6–9 s nije glavni odgovor. Faza može završiti bez izuzetka uz tehnički failure kod. |
| Klijent | NEED čeka EOF pa owned readback; worker prihvata potvrđeni delta pa readback. Vreme prikaza na telefonu nije izmereno. |

Stari opis COMPLETE kao glavne Gemini latencije bio je pogrešan.

## Sintetičko lokalno merenje, bez provider poziva

| Dual tok | Stabilno uputstvo (znaci) | Dinamički system deo | Ceo JSON zahtev (UTF-8 bajtovi) |
| --- | ---: | ---: | ---: |
| WORKER, posle lokalnih izmena | 19.759 | 448 | 23.737 |
| NEED | 26.819 | 357 | 29.933 |

Prazan kalendar/owned state; ovo nije produkcioni prosek. History se šalje zasebno u contents i povećava zahtev. Nema eksplicitne cachedContent reference u pregledanom zahtevu. To ne dokazuje odsustvo implicitnog cache-a, cache hit ili 75% uštede.

Zadržani limiti: zahtev 262.144 bajtova, output 8.192 tokena; direktni provider 30 s, research 42 s, klijent 55 s. Limiti nisu izmerena latencija i nisu povećavani.

## Otvoreno F6/F10

Kratko normativno uputstvo, uklanjanje duplikata uz golden testove i očuvanje kalendara/cene/geografije/signed Save zaštita. Kompaktni serviceMeaning za klasifikator umesto nepotrebne istorije. Bez-PII trace auth/preflight/TTFT/provider/writer/readback/UI; p50/p95 i usage/cache merenje na posebno odobrenim DEV pozivima.

Nema sirovog token-streama pre validacije samo radi privida brzine. Konačno sažimanje i poboljšanje stvarne brzine NISU završeni.
