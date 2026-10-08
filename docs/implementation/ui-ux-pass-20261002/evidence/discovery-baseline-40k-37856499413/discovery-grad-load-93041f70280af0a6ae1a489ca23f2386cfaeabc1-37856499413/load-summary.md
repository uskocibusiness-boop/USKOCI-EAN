### Applied Discovery reader: isolated 40000-task baseline

Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.

| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |
|---|---:|---:|---:|---:|---:|---:|
| pageDefault | 617.3 | 569.6 | 918.9 | 537 | 50 | 40000 |
| pageTextCiscenje | 1932 | 1986.2 | 2123 | 2027 | 50 | 5333 |
| pageTextSelidba | 1936.1 | 1969.1 | 2062.7 | 2055 | 50 | 5333 |
| pageTextNoHit | 1861.9 | 1870.9 | 1984.9 | 1872 | 0 | 0 |
| pagePlaceCity | 372.9 | 366.2 | 447.9 | 398 | 50 | 7332 |
| pagePlaceLabel | 318.4 | 302.9 | 410.8 | 307 | 0 | 0 |
| pagePlaceAndText | 1788.5 | 1641.3 | 1771 | 1694 | 50 | 2000 |
| pageAreaToday | 516.6 | 504.9 | 738.5 | 515 | 50 | 11075 |
| mapDefault | 475.1 | 460.6 | 515.5 | 454 | 14 | 40000 |
| mapPlaceCity | 195.4 | 197 | 319 | 201 | 1 | 7332 |
| placesDefault | 235.6 | 246.3 | 266.8 | 236 | 30 | 40000 |
| placesPrefix | 235.6 | 241.8 | 379.2 | 230 | 5 | 40000 |
| placesCity | 373.9 | 244.7 | 301.8 | 251 | 12 | 40000 |
| placesCityPrefix | 260.4 | 242.8 | 275.6 | 256 | 1 | 40000 |
| pageRemote | 405 | 290.2 | 420.6 | 320 | 50 | 2000 |
| mapCityDense | 290.4 | 300.9 | 334.1 | 305 | 5 | 40000 |

11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.
