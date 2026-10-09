### Applied Discovery reader: isolated 40000-task baseline

Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.

| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |
|---|---:|---:|---:|---:|---:|---:|
| pageDefault | 581.4 | 563.9 | 793.1 | 588 | 50 | 40000 |
| pageTextCiscenje | 2225.2 | 1988.8 | 2195.3 | 2067 | 50 | 5333 |
| pageTextSelidba | 2133.8 | 1989.6 | 2114.7 | 2072 | 50 | 5333 |
| pageTextNoHit | 2097.6 | 1927.5 | 2170.7 | 1966 | 0 | 0 |
| pagePlaceCity | 370.5 | 360.3 | 539.6 | 404 | 50 | 7332 |
| pagePlaceLabel | 308.4 | 313.9 | 420.4 | 305 | 0 | 0 |
| pagePlaceAndText | 1765.5 | 1655.7 | 1751.2 | 1779 | 50 | 2000 |
| pageAreaToday | 504.4 | 496.7 | 685.4 | 521 | 50 | 11075 |
| mapDefault | 433.7 | 447.6 | 564.3 | 454 | 14 | 40000 |
| mapPlaceCity | 195.4 | 197.4 | 299.5 | 199 | 1 | 7332 |
| placesDefault | 241 | 236.4 | 335.2 | 224 | 30 | 40000 |
| placesPrefix | 235.5 | 237 | 356 | 227 | 5 | 40000 |
| placesCity | 295.1 | 240.8 | 336.2 | 243 | 12 | 40000 |
| placesCityPrefix | 265.4 | 239.1 | 266.8 | 247 | 1 | 40000 |
| pageRemote | 336.5 | 292.4 | 408 | 308 | 50 | 2000 |
| mapCityDense | 330.1 | 295.2 | 350.6 | 306 | 5 | 40000 |

11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.

#### Transaction-local profiles

One extra instrumented call per request; not latency medians. Full function list is in JSON. Unobserved helpers are not assumed to cost zero.

##### pageDefault

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| rpc_discovery_v1(jsonb) | 1 | 504.174669 | 656.566797 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 149.542 | 149.542 |
| covered_slots(needs) | 50 | 1.159373 | 1.159373 |
| private.closure_account_restricted(uuid) | 1 | 0.357248 | 0.357248 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.355176 | 0.355176 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.337222 | 0.763068 |
| discovery_fold_v1(text) | 2 | 0.281016 | 0.281016 |
| rpc_storage_account_open() | 1 | 0.247543 | 1.010611 |

##### pageTextCiscenje

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 532.188169 | 532.188169 |
| p6_discovery_area(text,text,boolean) | 40000 | 365.040814 | 1071.14713 |
| rpc_discovery_v1(jsonb) | 1 | 341.504398 | 1934.587417 |
| discovery_fold_v1(text) | 40002 | 324.35747 | 324.35747 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 195.168984 | 195.168984 |
| p6_discovery_unquote(text) | 76000 | 173.998748 | 349.043819 |
| covered_slots(needs) | 50 | 1.025134 | 1.025134 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.374751 | 0.726048 |

##### pageTextNoHit

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 580.572552 | 580.572552 |
| p6_discovery_area(text,text,boolean) | 40000 | 403.927012 | 1180.199271 |
| discovery_fold_v1(text) | 40002 | 363.036254 | 363.036254 |
| rpc_discovery_v1(jsonb) | 1 | 302.2979 | 2064.985542 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 218.061945 | 218.061945 |
| p6_discovery_unquote(text) | 76000 | 195.743389 | 394.147165 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.428613 | 0.428613 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.339385 | 0.690132 |

##### pagePlaceAndText

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78281 | 535.419957 | 535.419957 |
| p6_discovery_area(text,text,boolean) | 40045 | 378.04417 | 1093.553375 |
| rpc_discovery_v1(jsonb) | 1 | 321.273739 | 1686.063515 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 213.240943 | 213.240943 |
| p6_discovery_unquote(text) | 76132 | 182.076833 | 359.621345 |
| discovery_fold_v1(text) | 7421 | 52.573309 | 52.573309 |
| p6_discovery_key(text) | 133 | 1.046586 | 2.759539 |
| covered_slots(needs) | 50 | 0.961518 | 0.961518 |
