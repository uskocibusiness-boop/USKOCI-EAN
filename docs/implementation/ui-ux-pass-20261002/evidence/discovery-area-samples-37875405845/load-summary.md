### Applied Discovery reader: isolated 40000-task baseline

Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.

| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |
|---|---:|---:|---:|---:|---:|---:|
| pageDefault | 525.1 | 517.5 | 678 | 560 | 50 | 40000 |
| pageTextCiscenje | 1427.6 | 1320.7 | 1579.3 | 1400 | 50 | 5333 |
| pageTextSelidba | 1417.2 | 1327.5 | 1566.7 | 1426 | 50 | 5333 |
| pageTextNoHit | 1373.9 | 1284.9 | 1433.9 | 1360 | 0 | 0 |
| pagePlaceCity | 332.8 | 320.2 | 379.6 | 321 | 50 | 7332 |
| pagePlaceLabel | 258.9 | 259.1 | 351.1 | 294 | 0 | 0 |
| pagePlaceAndText | 1164.1 | 1041.8 | 1164.6 | 1041 | 50 | 2000 |
| pageAreaToday | 467.6 | 470.3 | 543.3 | 486 | 50 | 11075 |
| mapDefault | 468.6 | 456.8 | 511.7 | 490 | 14 | 40000 |
| mapPlaceCity | 195.7 | 197.7 | 282.2 | 203 | 1 | 7332 |
| placesDefault | 250.3 | 223.1 | 230 | 215 | 30 | 40000 |
| placesPrefix | 223.2 | 225.5 | 296.6 | 229 | 5 | 40000 |
| placesCity | 223.6 | 232.7 | 303.2 | 231 | 12 | 40000 |
| placesCityPrefix | 222 | 223.1 | 227 | 228 | 1 | 40000 |
| pageRemote | 275.5 | 258.2 | 333.1 | 273 | 50 | 2000 |
| mapCityDense | 371.7 | 302.4 | 353.4 | 310 | 5 | 40000 |

11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.

#### Transaction-local profiles

One extra instrumented call per request; not latency medians. Full function list is in JSON. Unobserved helpers are not assumed to cost zero.

##### pageDefault

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| rpc_discovery_v1(jsonb) | 1 | 404.845538 | 512.537633 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 105.331064 | 105.331064 |
| covered_slots(needs) | 50 | 0.922311 | 0.922311 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.288041 | 0.620171 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.283632 | 0.283632 |
| private.closure_account_restricted(uuid) | 1 | 0.28026 | 0.28026 |
| rpc_storage_account_open() | 1 | 0.264448 | 0.884619 |
| discovery_fold_v1(text) | 2 | 0.231721 | 0.231721 |

##### pageTextCiscenje

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 303.501462 | 303.501462 |
| discovery_fold_v1(text) | 40002 | 283.887851 | 283.887851 |
| rpc_discovery_v1(jsonb) | 1 | 263.675745 | 1323.327193 |
| p6_discovery_area(text,text,boolean) | 40000 | 221.762017 | 654.382275 |
| p6_discovery_unquote(text) | 76000 | 129.159437 | 252.422258 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 119.344876 | 119.344876 |
| covered_slots(needs) | 50 | 0.923828 | 0.923828 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.287371 | 0.287371 |

##### pageTextNoHit

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 350.72451 | 350.72451 |
| discovery_fold_v1(text) | 40002 | 303.517594 | 303.517594 |
| p6_discovery_area(text,text,boolean) | 40000 | 243.654432 | 738.225887 |
| rpc_discovery_v1(jsonb) | 1 | 226.188021 | 1404.923781 |
| p6_discovery_unquote(text) | 76000 | 143.883386 | 280.960436 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 135.867539 | 135.867539 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.280863 | 0.608367 |
| private.closure_account_restricted(uuid) | 1 | 0.27601 | 0.27601 |

##### pagePlaceAndText

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78281 | 304.199542 | 304.199542 |
| rpc_discovery_v1(jsonb) | 1 | 244.783631 | 1078.062829 |
| p6_discovery_area(text,text,boolean) | 40045 | 220.746691 | 657.495566 |
| p6_discovery_unquote(text) | 76132 | 133.855869 | 258.490696 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 122.356671 | 122.356671 |
| discovery_fold_v1(text) | 7421 | 49.318365 | 49.318365 |
| covered_slots(needs) | 50 | 0.929364 | 0.929364 |
| p6_discovery_key(text) | 133 | 0.779242 | 1.875319 |
