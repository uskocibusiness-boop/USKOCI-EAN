### Applied Discovery reader: isolated 40000-task baseline

Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.

| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |
|---|---:|---:|---:|---:|---:|---:|
| pageDefault | 499.7 | 505.8 | 620 | 481 | 50 | 40000 |
| pageTextCiscenje | 1392.2 | 1321.6 | 1403.8 | 1272 | 50 | 5333 |
| pageTextSelidba | 1281.6 | 1328.8 | 1487.8 | 1371 | 50 | 5333 |
| pageTextNoHit | 1195 | 1251 | 1337.4 | 1253 | 0 | 0 |
| pagePlaceCity | 329.1 | 315.9 | 380.1 | 317 | 50 | 7332 |
| pagePlaceLabel | 255.9 | 259.8 | 350.6 | 265 | 0 | 0 |
| pagePlaceAndText | 1027.5 | 1035.5 | 1085.9 | 1034 | 50 | 2000 |
| pageAreaToday | 456.4 | 450.3 | 535 | 464 | 50 | 11075 |
| mapDefault | 430.9 | 458.1 | 479.3 | 467 | 14 | 40000 |
| mapPlaceCity | 192.6 | 192.6 | 213.6 | 203 | 1 | 7332 |
| placesDefault | 219 | 230.1 | 272 | 211 | 30 | 40000 |
| placesPrefix | 216.9 | 222.6 | 247.4 | 227 | 5 | 40000 |
| placesCity | 219.4 | 222.3 | 236 | 276 | 12 | 40000 |
| placesCityPrefix | 219.3 | 224 | 269.8 | 227 | 1 | 40000 |
| pageRemote | 278.5 | 253.5 | 345.2 | 262 | 50 | 2000 |
| mapCityDense | 298.9 | 296.4 | 371.2 | 330 | 5 | 40000 |

11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.

#### Transaction-local profiles

One extra instrumented call per request; not latency medians. Full function list is in JSON. Unobserved helpers are not assumed to cost zero.

##### pageDefault

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| rpc_discovery_v1(jsonb) | 1 | 398.642084 | 506.885468 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 105.601396 | 105.601396 |
| covered_slots(needs) | 50 | 1.260824 | 1.260824 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.279173 | 0.279173 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.275719 | 0.587424 |
| private.closure_account_restricted(uuid) | 1 | 0.25954 | 0.25954 |
| discovery_fold_v1(text) | 2 | 0.238235 | 0.238235 |
| rpc_storage_account_open() | 1 | 0.235033 | 0.822457 |

##### pageTextCiscenje

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 308.116543 | 308.116543 |
| discovery_fold_v1(text) | 40002 | 275.210273 | 275.210273 |
| rpc_discovery_v1(jsonb) | 1 | 267.551508 | 1340.267407 |
| p6_discovery_area(text,text,boolean) | 40000 | 228.004414 | 669.240482 |
| p6_discovery_unquote(text) | 76000 | 133.170286 | 256.348607 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 125.974431 | 125.974431 |
| covered_slots(needs) | 50 | 0.946167 | 0.946167 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.355711 | 0.705696 |

##### pageTextNoHit

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 300.208789 | 300.208789 |
| discovery_fold_v1(text) | 40002 | 278.417826 | 278.417826 |
| p6_discovery_area(text,text,boolean) | 40000 | 219.397439 | 651.149847 |
| rpc_discovery_v1(jsonb) | 1 | 206.328666 | 1258.700364 |
| p6_discovery_unquote(text) | 76000 | 131.58379 | 252.862483 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 121.694506 | 121.694506 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.268241 | 0.582104 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.267677 | 0.267677 |

##### pagePlaceAndText

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78281 | 320.415542 | 320.415542 |
| rpc_discovery_v1(jsonb) | 1 | 251.045213 | 1126.97352 |
| p6_discovery_area(text,text,boolean) | 40045 | 235.504963 | 695.339077 |
| p6_discovery_unquote(text) | 76132 | 140.732587 | 273.196045 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 128.392532 | 128.392532 |
| discovery_fold_v1(text) | 7421 | 48.049432 | 48.049432 |
| covered_slots(needs) | 50 | 0.943273 | 0.943273 |
| p6_discovery_key(text) | 133 | 0.78421 | 1.881461 |
