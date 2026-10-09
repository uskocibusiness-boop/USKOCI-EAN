### Applied Discovery reader: isolated 40000-task baseline

Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.

| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |
|---|---:|---:|---:|---:|---:|---:|
| pageDefault | 592 | 569.1 | 746.4 | 555 | 50 | 40000 |
| pageTextCiscenje | 2080.4 | 2044.2 | 2154.3 | 2007 | 50 | 5333 |
| pageTextSelidba | 2125 | 2017.1 | 2096.6 | 1989 | 50 | 5333 |
| pageTextNoHit | 2041.2 | 1946.7 | 2071.5 | 1947 | 0 | 0 |
| pagePlaceCity | 466.2 | 360.1 | 468.7 | 371 | 50 | 7332 |
| pagePlaceLabel | 319.1 | 316.8 | 368.4 | 312 | 0 | 0 |
| pagePlaceAndText | 1621.5 | 1643.1 | 1782.2 | 1642 | 50 | 2000 |
| pageAreaToday | 709.8 | 504.2 | 553.7 | 571 | 50 | 11075 |
| mapDefault | 569.9 | 457.1 | 585.9 | 472 | 14 | 40000 |
| mapPlaceCity | 198.7 | 195.6 | 236.1 | 210 | 1 | 7332 |
| placesDefault | 286.9 | 244.3 | 348.3 | 286 | 30 | 40000 |
| placesPrefix | 242.6 | 251.7 | 307.2 | 232 | 5 | 40000 |
| placesCity | 247.2 | 245.3 | 330.3 | 257 | 12 | 40000 |
| placesCityPrefix | 242.3 | 243.5 | 395.2 | 251 | 1 | 40000 |
| pageRemote | 313.7 | 292.7 | 326.1 | 314 | 50 | 2000 |
| mapCityDense | 293.5 | 296.7 | 431.1 | 302 | 5 | 40000 |

11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.

#### Transaction-local profiles

One extra instrumented call per request; not latency medians. Full function list is in JSON. Unobserved helpers are not assumed to cost zero.

##### pageDefault

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| rpc_discovery_v1(jsonb) | 1 | 456.228723 | 598.4958 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 138.762302 | 138.762302 |
| covered_slots(needs) | 50 | 1.643311 | 1.643311 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.445941 | 0.831982 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.389256 | 0.389256 |
| private.closure_account_restricted(uuid) | 1 | 0.316681 | 0.316681 |
| rpc_storage_account_open() | 1 | 0.313185 | 1.145167 |
| discovery_fold_v1(text) | 2 | 0.276467 | 0.276467 |

##### pageTextCiscenje

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 537.434013 | 537.434013 |
| p6_discovery_area(text,text,boolean) | 40000 | 368.861861 | 1084.960272 |
| rpc_discovery_v1(jsonb) | 1 | 352.30133 | 1969.431668 |
| discovery_fold_v1(text) | 40002 | 329.898241 | 329.898241 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 199.780438 | 199.780438 |
| p6_discovery_unquote(text) | 76000 | 178.7085 | 358.227859 |
| covered_slots(needs) | 50 | 1.157309 | 1.157309 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.36368 | 0.71831 |

##### pageTextNoHit

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 541.526972 | 541.526972 |
| p6_discovery_area(text,text,boolean) | 40000 | 372.504694 | 1092.828491 |
| discovery_fold_v1(text) | 40002 | 334.137275 | 334.137275 |
| rpc_discovery_v1(jsonb) | 1 | 284.664448 | 1911.317879 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 198.156819 | 198.156819 |
| p6_discovery_unquote(text) | 76000 | 178.844344 | 358.672123 |
| private.closure_account_restricted(uuid) | 1 | 0.389627 | 0.389627 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.382113 | 0.84164 |

##### pagePlaceAndText

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78281 | 563.758602 | 563.758602 |
| p6_discovery_area(text,text,boolean) | 40045 | 389.023816 | 1138.103304 |
| rpc_discovery_v1(jsonb) | 1 | 330.003833 | 1748.504904 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 221.771453 | 221.771453 |
| p6_discovery_unquote(text) | 76132 | 187.234916 | 375.198953 |
| discovery_fold_v1(text) | 7421 | 53.175378 | 53.175378 |
| p6_discovery_key(text) | 133 | 1.103917 | 2.744491 |
| covered_slots(needs) | 50 | 1.055429 | 1.055429 |
