# DEV push parser preflight — 21.10.2026.

Scope: `leqcwgzvjsxugfgzdmth`, `uskoci-push-transport`. This is a deployment receipt for the parser only, not proof of an application deep link or delivery to a device.

## Applied and read back

- Deployed the current source with `npx supabase functions deploy uskoci-push-transport --project-ref leqcwgzvjsxugfgzdmth --no-verify-jwt --use-api --yes`; CLI exited 0.
- CLI `functions list --output json` and the Supabase readback both showed version **36**, `ACTIVE`, `verify_jwt=false`, bundle `ezbr_sha256=dcfc991c37c35c76cc125b720a1629aa3b849ccb30e4528d80e3b454c9f5bb34`.
- The read-back source admits `RESPONSE_RECEIVED` and `RESPONSE_UPDATED` in the receipt event-ID parser. For those types it adds provider `eventId` only when `EXPO_PUSH_APPLICATION_TARGET_ENABLED === 'true'`.
- DEV secrets listing did not contain `EXPO_PUSH_APPLICATION_TARGET_ENABLED`, so this new exact-payload branch is currently **off**. Existing generic `{kind:'INBOX'}` response payload remains the current path.
- The local Edge entrypoint had SHA-256 `FA53ECD3623BD26EDC81479BBBC207690B54977E861D589F00E039AF4CB73A44` at the readback. This file hash and the service's bundle hash measure different artifacts.

## Still open

The `rpc_begin_push_send` SQL patch and `rpc_resolve_activity_application_v1` are source candidates, not applied by this step. A real response receipt with `eventId`, authenticated two-account resolver checks, client APK upgrade, cold/warm device taps and old-client rollout compatibility have not been verified. Keep the global flag off until the whole chain and registered-client capability are proven. A SQL migration must follow a fresh predecessor/ACL readback; see `supabase/candidates/push-application-target-20261021/README.md`.

This receipt supersedes only the earlier assertion in `PUSH_NOVA_PRIJAVA_TARGET_GAP_20261021.md` that the active Edge parser cannot accept a response event ID. Its older two-tap behavior description remains the last phone proof.
