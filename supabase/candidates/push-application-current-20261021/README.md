# Exact application notification target — current DEV

Parent applied `migration-with-proof.sql` successfully to DEV on 21 October 2026. The rollback fixtures and exact target refusal assertions passed. Parent owns exact migration ledger.

Adds RESPONSE_RECEIVED exact `eventId` delivery branch and authenticated `rpc_resolve_activity_application_v1(uuid,uuid)`. Requires actual recipient, current session/account, owned need, matching response version/event and currently selectable candidate; stale, withdrawn, cancelled, closing-account, foreign and suppressed activity refused. Existing generic routes remain.

Predecessor drift was independently explained by applied cancelled-candidate history parity: helper MD5 is now `c47d3658e94a82474c1d408f7ee23888`; begin RPC pin was unchanged. No broad guard removal.

Runtime proof uses rollback-only synthetic owner/worker/session/Need/response rows and real authenticated role. Checks positive owner route plus recipient, account/session, payload/version, suppression, withdrawal, cancellation and closure barriers. No push provider send/device token used. No synthetic rows persisted.

Four related Jest suites passed: 87 tests total (activity application target, application push target, closure client, closure dialog). This is client and SQL evidence, not native push delivery evidence.

Transport flag was NOT enabled by this package. New native build and cold/warm tap verification plus old-device capability check remain before activation. Closure source admission is separate; package does not certify it.
