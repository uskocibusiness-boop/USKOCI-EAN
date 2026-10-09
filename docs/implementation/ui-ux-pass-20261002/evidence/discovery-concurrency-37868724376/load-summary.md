### Applied Discovery reader: isolated 40000-task baseline

Synthetic bulk read fixture, serial SQL/HTTP samples on a shared CI runner. Not 40000 active users, whole-schema fidelity, lifecycle or native FPS.

| Request | Cold SQL ms | Warm SQL median ms | Warm maximum ms | HTTP median ms | Rows | Count |
|---|---:|---:|---:|---:|---:|---:|
| pageDefault | 688.6 | 559.7 | 785.2 | 512 | 50 | 40000 |
| pageTextCiscenje | 2250.5 | 1972.7 | 2119.5 | 1992 | 50 | 5333 |
| pageTextSelidba | 2144.3 | 1983.6 | 2135.9 | 2035 | 50 | 5333 |
| pageTextNoHit | 2063.3 | 1914.2 | 2008.2 | 1908 | 0 | 0 |
| pagePlaceCity | 374.5 | 363.5 | 484.8 | 370 | 50 | 7332 |
| pagePlaceLabel | 298.2 | 300.2 | 399.7 | 306 | 0 | 0 |
| pagePlaceAndText | 1712.3 | 1617.9 | 1759.4 | 1760 | 50 | 2000 |
| pageAreaToday | 503.9 | 502.8 | 636.6 | 542 | 50 | 11075 |
| mapDefault | 498 | 444.1 | 485.3 | 502 | 14 | 40000 |
| mapPlaceCity | 190.3 | 192.4 | 326.3 | 204 | 1 | 7332 |
| placesDefault | 252.3 | 237 | 288.1 | 223 | 30 | 40000 |
| placesPrefix | 264.4 | 235.7 | 322.8 | 241 | 5 | 40000 |
| placesCity | 235.5 | 246 | 455.3 | 238 | 12 | 40000 |
| placesCityPrefix | 234.6 | 233.5 | 271 | 242 | 1 | 40000 |
| pageRemote | 333.8 | 287.8 | 352.1 | 329 | 50 | 2000 |
| mapCityDense | 324.3 | 293.5 | 349.4 | 304 | 5 | 40000 |

11 warm SQL samples and 3 HTTP samples per request; no concurrent-user or p95 capacity claim. S3 NOT applied. Provider calls=0, push sends=0.

#### Transaction-local profiles

One extra instrumented call per request; not latency medians. Full function list is in JSON. Unobserved helpers are not assumed to cost zero.

##### pageDefault

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| rpc_discovery_v1(jsonb) | 1 | 410.251258 | 548.977277 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 136.091341 | 136.091341 |
| covered_slots(needs) | 50 | 1.066868 | 1.066868 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.349213 | 0.349213 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.319696 | 0.684839 |
| private.closure_account_restricted(uuid) | 1 | 0.274123 | 0.274123 |
| discovery_fold_v1(text) | 2 | 0.268532 | 0.268532 |
| rpc_storage_account_open() | 1 | 0.221194 | 0.906033 |

##### pageTextCiscenje

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 567.324201 | 567.324201 |
| p6_discovery_area(text,text,boolean) | 40000 | 400.284374 | 1157.731355 |
| discovery_fold_v1(text) | 40002 | 353.23286 | 353.23286 |
| rpc_discovery_v1(jsonb) | 1 | 353.063538 | 2078.87511 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 212.550944 | 212.550944 |
| p6_discovery_unquote(text) | 76000 | 190.167193 | 384.687891 |
| covered_slots(needs) | 50 | 1.016562 | 1.016562 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.34267 | 0.34267 |

##### pageTextNoHit

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78001 | 553.762899 | 553.762899 |
| p6_discovery_area(text,text,boolean) | 40000 | 414.132418 | 1163.982475 |
| discovery_fold_v1(text) | 40002 | 349.75483 | 349.75483 |
| rpc_discovery_v1(jsonb) | 1 | 295.663765 | 2027.005417 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 216.31047 | 216.31047 |
| p6_discovery_unquote(text) | 76000 | 196.13086 | 384.638394 |
| rls_private.p6_discovery_test_world_accounts() | 2 | 0.342019 | 0.342019 |
| private.closure_assert_open(uuid,uuid) | 1 | 0.32112 | 0.692965 |

##### pagePlaceAndText

| Function | Calls | Self ms | Total ms (includes children) |
|---|---:|---:|---:|
| p6_discovery_trim(text) | 78281 | 555.273631 | 555.273631 |
| p6_discovery_area(text,text,boolean) | 40045 | 402.594376 | 1150.468712 |
| rpc_discovery_v1(jsonb) | 1 | 325.725462 | 1759.694724 |
| p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone) | 40000 | 225.030607 | 225.030607 |
| p6_discovery_unquote(text) | 76132 | 194.537874 | 381.709207 |
| discovery_fold_v1(text) | 7421 | 53.244128 | 53.244128 |
| p6_discovery_key(text) | 133 | 1.04964 | 2.680757 |
| covered_slots(needs) | 50 | 0.973982 | 0.973982 |

### Authenticated HTTP read concurrency

Closed-loop clients on the same shared CI host as PostgreSQL/PostgREST; queuing and coordinated omission are not corrected. Not 40000 users, production capacity, lifecycle throughput, background-worker or native performance. CPU/loop metrics describe the Node generator only; JSON bytes are reserialized body sizes, not wire bytes. Client abort does not prove server cancellation.

httpLatencyAll ends when the Supabase HTTP client returns (JSON decoding included); latencyAll additionally includes canonicalization/semantic verification. Hard client deadlines with no return are retained in latencyAll and timeout counts.

| Target parallel | Peak in flight | Mean in flight | Completed/s | Successful/s | Measured successes/failures | p50/p95/p99 ms (all) | Drain ms | State |
|---:|---:|---:|---:|---:|---|---|---:|---|
| 1 | 1 | 1 | 1.28 | 1.28 | 77/0 | 569.14/2054.94/insufficient samples | 1543.19 | PASS |
| 4 | 4 | 4 | 1.43 | 1.43 | 86/0 | 1995.6/6709.09/insufficient samples | 1498.25 | PASS |
| 16 | 16 | 1.06 | 2.77 | 1.39 | 0/0 | null/insufficient samples/insufficient samples | 0 | FAIL |
