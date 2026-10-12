# Provider-ticket idle-loop candidate — 11 October 2026

**SOURCE CANDIDATE ONLY.** Not applied to DEV/PROD; no real notification sent or altered.

Read-only canonical DEV proof: 1 `TICKET_PENDING` from 2026-09-26 is 24h-expired and next-attempt-due; 1 newer `PROVIDER_ACCEPTED` attempt is terminal. The active one-minute worker includes all `TICKET_PENDING` in its work predicate, and the existing `rpc_claim_push_transport` expiration occurs only when transport is actually invoked with sending enabled. Over the last 24h 1,420 Edge HTTP 200 calls were observed, which do **not** prove provider sends. Do not infer live transport flag from response status alone.

This candidate moves **only the old-ticket timeout transition** to the cron-owned worker before provider configuration checks. It matches the existing terminal `UNKNOWN/FATAL/RECEIPT_UNAVAILABLE` transition, does not replay/send a notification, requires the receipt ticket to be over 24 hours old, and avoids touching live receipt leases. It preserves original `SECURITY DEFINER`, ACL, volatility, parallel safety, `search_path`, and default argument. Source predecessor MD5: `f9485392ceb2db1e06a982da7ee9b049`; candidate MD5: `7d03dc2c31a629785b5f222786bf4dd9`.

Isolated PostgreSQL 16/17 fixtures test the old-ticket transition, active lease exclusion, null ticket exclusion, already-accepted terminal state, idempotence, and exact function rollback. The fixture deliberately has no vault credentials or outbound provider transport. No global cron or other scheduling function is added.

**Before controlled DEV promotion:** obtain explicit owner approval, re-read live function MD5/security and table columns, ensure latest PR HEAD and CI are successful, inventory existing cron errors and provider gating, choose a maintenance window, apply `forward.sql` in one transaction, verify exact function MD5 and receipt terminal state without sending messages. Rollback with `revert.sql` restores function logic only and never resurrects terminal tickets. Real provider-disabled root cause still requires separate diagnosis.
