# DEV semantic probe — 28.11.2026

Scope: synthetic single-turn, real Gemini provider, current full DEV taxonomy v24, candidate shared taxonomy instruction (blob 062639a38865af0ab656dc8795f38e9b2270a3f8). No task publication, user sign-in, worker Save or catalog writes. Not an end-to-end interview/matching acceptance test.

| Case | HTTP | Observed decision | Provider latency |
|---|---:|---|---:|
| Chinese initial | 400 provider (502 wrapper) | Probe omitted existing wire adapter; no classification | 934 ms |
| English + French BOTH | 200 | CREATE_CHILD English and French separately; ON_SITE and REMOTE each, same existing language family; ADD both | 7765 ms |
| Paint 15 m² bedroom | 200 | REUSE_EXISTING Krečenje i moleraj, ON_SITE | 3701 ms |
| Chinese corrected probe | 200 | CREATE_CHILD Časovi kineskog jezika, REMOTE, same language family | 3667 ms |

Successful classification checks: 3/3. First rejected request is not a semantic pass. Chinese corrected usage: 4610 prompt + 228 output = 4838 tokens; measured DB accounting 4313 microUSD. Other three reservations remain unsettled at 250000 microUSD each; not actual charges. No manual release or fabricated usage. Worker response asked optional level/age plus territory; full conversational brevity not verified.

Transport: pg_net signed, bounded synthetic requests; no user credentials sent. Probe retired on DEV v4 with JWT verification true and 410 handler. Network schema/table ACL is broader than appropriate (anon/authenticated have USAGE and SELECT); investigate/restrict with platform-owner assistance before transmitting credentials through pg_net. No ACL mutation. No new secrets.

DEV deployment: Need 231 → 232; Worker 172 → 173. Preflight verified exact original shared module from active source base; deployed only changed prompt module over retrieved existing bundles. Postflight exact byte-for-byte bundle match (27 and 29 files), authentication settings unchanged. Original shared module available at f4065ad8c402b2c5b9918a755ed9f15da8b10775. No SQL migration or production changes. Full existing Need/Worker flow, category persistence, profile re-confirmation, device push/Za mene regression, and previously misclassified records remain to be verified. Separate withdrawn response SQL candidate not deployed. Branch not merged into active development branch.
