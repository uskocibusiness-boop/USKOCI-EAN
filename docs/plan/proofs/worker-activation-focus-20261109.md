# Worker activation return: focus ordering repair

Observed on the physical Honor / installed source8c9: returning to the retained Worker conversation using a new activation request briefly showed the local `WORKER_AI_UNAVAILABLE` message. A manual Reload restored the same conversation and then its ordinary activation succeeded. No server data or AI turn was lost.

The route and `useOwnedEditor` each own an Expo focus effect. A changed activation request can rerun the editor while `navigation.isFocused()` is already true but the retained route has not received its focus event. Its local focus guard is then still null. The minimal repair adds the same activation request to the existing route focus effect dependencies, so that guard refreshes before the editor reads. Ownership, blur, cancellation and explicit Save guards remain intact.

`scripts/ai-review-expiry.test.cjs` now uses the installed Expo `useFocusEffect` implementation for two focused scenarios: navigation state before the retained focus event, and changed parameters while navigation is still blurred. The former failed against the preimage; after the change both pass. The tests also assert preserved unsent input, one activation review, no duplicate read after the later focus event, no Save and no leaked subscriptions.

Verification reported by the implementing agent and diff independently reviewed by the coordinator:

```text
node --test scripts/ai-review-expiry.test.cjs scripts/ai-budget-client-recovery.test.cjs scripts/ux-navigation-copy.test.cjs scripts/conversation-intent-integration.test.cjs
113 passed; 0 failed/cancelled/skipped/todo; 3429.9189ms
npx tsc --noEmit
exit0, no diagnostics
git diff --check
PASS
```

This is source/React evidence with the real Expo hook and a controlled native-navigation boundary. It does not by itself prove the repaired APK on a phone. The unchanged server activation is separately documented in `worker-draft-activation-phone-20261109.json`.

The same physical acceptance exposed a separate compact-summary omission: the account hub dropped `workAreas` before formatting the Worker subtitle. Confirmed REMOTE was shown, but confirmed ON_SITE had no area because legacy `grad` was blank. The existing saved area projection and `workerAreasLabel` now reach the existing formatter; no new fetch, mode inference, field or layout is introduced. Expected subtitle: `Aktivan · Kurirske dostave +6 · Na daljinu · Dolazak: Novi Sad`. Legacy city/radius fallback and confirmed-mode guards remain. The mounted account-route regression failed on the preimage; `node --test scripts/ux-navigation-copy.test.cjs` passes37/37 including three added scenarios. Coordinator independently reviewed the diff and ran `npx tsc --noEmit` (exit0, no diagnostics) for the combined changes. Actual installation/readback of this final mobile pair remains a separate proof.
