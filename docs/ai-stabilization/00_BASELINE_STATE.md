# USKOČI AI stabilization — verified baseline

**Captured:** 2026-10-26 (read-only DEV checks)<br>
**Repository / branch:** `uskocibusiness-boop/USKOCI-EAN` / `feature/uskoci-cisto`<br>
**Verified remote commit:** `8967ee21937479f80f99114d0044b02ee8ed260f`<br>
**DEV project:** `leqcwgzvjsxugfgzdmth` (`eu-central-1`, healthy)<br>
**Production:** not queried, changed, or deployed.

## What is active now

| Path | DEV evidence | Conclusion |
| --- | --- | --- |
| Requester conversation | `uskoci-ai-interview` v151, active | Current dual-Gemini requester path is deployed. |
| Worker conversation | `uskoci-worker-interview` v104, active | Current dual-Gemini worker path is deployed. |
| Post-save taxonomy | `uskoci-taxonomy-postsave-worker` v5, active | A DEV cron invokes this worker every minute; do not change it without a separate preimage audit. |
| Source parity | Live index/shared source compared with this branch (LF-normalized) | Active conversation code is not an older, separate implementation. |

The two interview functions validate the caller through `/auth/v1/user` in code. Their platform setting `verify_jwt=false` must therefore not be read alone as an authorization conclusion.

## Verified request path

`nova.tsx` → `aiNeedTurnStream.ts` / `aiNeedV2Production.ts` → `uskoci-ai-interview` → durable facts/review RPCs → canonical publish/matching path.

`profil/razgovor.tsx` → `workerAiClientService.ts` → `uskoci-worker-interview` → signed worker review/save RPCs → worker category/mode/area bindings.

Both edges may start `backgroundTaxonomyArchitect.mjs` only after a semantic change or a pending clarification. The durable main turn completes before that background capture; the background worker does not itself publish or dispatch.

## Facts that must not be overstated

- Live logs show sampled main completion and background-classifier timings, but no physical handset E2E has been run in this work item.
- The client currently waits for validated final conversation text; it does not render provider deltas. Enabling raw token streaming would be a product/safety change, not a latency toggle.
- Runtime secret values cannot be read safely. Code defaults the dual-Gemini gate on in DEV unless `USKOCI_TAXONOMY_DUAL_GEMINI === 'false'`; actual secret value remains unverified.
- Local and remote migration histories use different historical version names. The three current AI migrations were recorded as byte-different, not declared semantically identical or safe to replay.

## Completed safe changes since the baseline parent

| Commit | Result |
| --- | --- |
| `0fff6e4c` | Reconciled local migration provenance evidence and corrected a stale welcome assertion. |
| `8cacf889` | Restored concise worker-interview rules that had actually been lost during prompt condensation. |
| `8967ee21` | Labels task/worker background classifier timings instead of recording them as `UNKNOWN`. |

All three are pushed to the named development branch. No migration was applied, no function deployed, and no notification sent.
