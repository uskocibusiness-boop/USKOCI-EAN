# SOURCE / QA / Maintainability audit — 2026-10-09

## Scope and binding

Exact inspected HEAD: `6311804dbac2323069e927f9a8dc49f8f0bb1f14`.
Canonical checkout: `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006`.
Read-only canonical repository. All newly written outputs are under `C:/Users/user/Documents/Codex/uskoci-forensic-20261009/source/`. No device, live SQL, deployments, dependency installation or security plugin used. Supplied scope is mobile engineering, test quality and maintainability/observability, not a security certification. Existing React Native skill used for lifecycle/list/render guidance; no new library recommended from skill examples.

Inventory is rebuilt from tracked files at this HEAD, not copied from the Sep30 audit. Files are fingerprinted in source-inventory.json; full route list and import edges supplied. Repository was clean at entry and subsequent status check. Existing canonical docs are evidence indexes, not proof that a current binary passed.

## Measured inventory

| Measure | Observed | Meaning / denominator |
|---|---:|---|
| Tracked files | 5,881 | git ls-files, entire repository |
| App TS/TSX files excluding tests | 704 | tracked src/**/*.ts(x); includes QA scenes and test-support production-folder files |
| App lines | 85,006 | raw split-line count, includes comments/blanks; not logical statements |
| src/app route/layout files | 74 | Expo Router filesystem roots, not74 independent product screens |
| Design/gallery route files | 21 | src/app/dizajn-*; counts within74 |
| Static reachable from route/build roots | 685 /704 =97.30% | AST union including aliases/platform alternatives; not actual runtime execution |
| Reachable after dropping gallery roots | 653 /704 =92.76% | hypothetical nongallery root set; not Metro bundle-size measurement |
| Gallery-only static graph |32 files|21 routes plus11 components; see scope-summary.json |
| Test-only reach |15 /704 =2.13%|not runtime, but not dead: test seam/retained compatibility/art |
| No found static caller |4 /704 =0.57%|review candidates only, not proven safe deletion |
| Byte-identical whole app source files |0 groups|SHA256 exact files, not semantic duplication detection |
| Computed require/import in app AST |0|native autolinking/config/string-route mechanisms still outside static proof |
| TODO/FIXME/HACK/XXX markers |0|not a debt estimate |
| @ts-ignore / @ts-nocheck |0|strict tsconfig; does not rule out casts or runtime decoder errors |
| Console calls |7 files/7 calls|bounded debug/trace or error boundary; no raw logging sweep certification |
| Timers / listeners |123 calls in88 files /139 in99|review surface, not leak count |
| Empty/comment-only catches |75 in39 files|many deliberate teardown/privacy guards; not75 defects |
| Files above500 lines |16 /704 =2.27%|10,784 /85,006 lines =12.69%; maintenance concentration proxy |
| Dependencies |41 runtime +6 dev|lock923 entries including root /922 dependency nodes |
| Tracked JS/TS test files |729|multi-runner: Jest, node:test and auxiliary contracts |
| Matching current Jest config |604|125 remaining test files are outside default npm test; not necessarily unexecuted in their dedicated workflows |
| Test files declaring jest.mock |422;2,410 calls|static AST, overlapping methods; mocks are appropriate seams but not native coverage |
| Test files declaring fake timers |113|logic determinism, not native frame/timing proof |
| skip/only/todo declarations |2 conditional skip sites;0 only/todo|details below |

`control-graph-exact.json` independently repeats the current control generator's resolver, without executing osvezi or changing its projections. Literal existing control graph reaches678/704 (96.31%). The richer AST graph above covers aliases, platform variants and build roots. Disagreement between resolvers is a tool limit, not a missing product module. `source-inventory.json.controlGraphReach` is the enhanced control-like pass; use `control-graph-exact.json.existingControlExactReach` for literal resolver count.

### Largest maintenance hotspots

- src/ui/v2/DiscoveryPresentation.tsx:1 —1,484 lines /120,397 bytes.
- src/data/lazniIzvor.ts:1 —850 lines /34,905 bytes (explicit fake adapter, KEEP; not production backend).
- src/app/(app)/pregled-zadatka.tsx:1 —755 lines /60,523 bytes.
- src/ui/AgreementChat.tsx:1 —743 lines /57,170 bytes.
- src/data/agreementClientService.ts:1 —675 lines /46,108 bytes.
- src/ui/calendar/AvailabilityForm.tsx:1 —639 lines /47,080 bytes.
- src/app/dogovor/[id].tsx:1 —629 lines /48,780 bytes.
- src/ui/location/LocationPointEditor.tsx:1 —610 lines /44,992 bytes.

These are real complexity concentration, not evidence they are broken. Extract tested pure presentation/state units only alongside changes in that feature; do not wholesale rewrite the owners/guards to reduce line count.

## Reachability / legacy / removal disposition

**No source deletion is authorized by this audit.** Four no-static-caller candidates: src/ui/profile/WorkProfileArt.tsx; src/ui/system/CalendarArt.tsx; src/ui/system/PeopleArt.tsx; src/ui/system/ToolArt.tsx. Before deletion, check full tracked literal names, asset/native/config linkage, design authority and full bundle/test diff. This run found no computed require/import in src, but that alone does not prove all runtime registration is absent.

15 test-only modules remain KEEP/REVIEW, notably agreementCurrentLocationService, AgreementLocationController, locationResolver, LottieArt, ReferenceEntryHero, ReviewCommentsSection, selectionIdempotency, testing/fakes and answeringHost. A module covered only in tests may be intentionally retained compatibility or future renderer. Test-only reach must not become a claim that its product feature is wired.

32 gallery-only graph files include OutcomeUncertain, PickerTile, Pictogram and StateGallery. This matters when claiming a universal UI component was rolled out: a component demonstrated in a gallery is not necessarily on product routes. It is not evidence that current product recovery is absent, because equivalent inline recovery exists.

All21 gallery routes inspected have package/development gates. Examples: src/app/dizajn-dogovori.tsx:356 (__DEV__ or .dev), dizajn-mapa.tsx:74 (exact rs.uskoci.dev), dizajn-katalog27.tsx:11 (exact rs.uskoci.dev). They remain filesystem routes and static imports, so shipping byte cost requires actual Metro artifact measurement. No claimed store-visible gallery leak. Keep inert scenes for native QA; later production exclusion may improve bundle size but is not a proven speed fix.

Fake adapter: src/data/index.ts:27–30 admits test or explicit EXPO_PUBLIC_USE_FAKE_SOURCE. Production does not silently fall back when Supabase is missing (31–38). Build hook scripts/check-eas-preview.cjs:85 rejects fake/test composition; standard QA workflows pin flag0. Keep it and its boundary tests, do not delete as legacy. v1/v2/v5 in names denotes versions/contracts, not automatic obsolescence.

Nine direct deps have no app import: decode-uri-component, expo-glass-effect, expo-symbols, expo-system-ui, expo-web-browser, patch-package, react-dom, react-native-screens, react-native-web. This is NOT an unused-dependency list. Several are explicit overrides, config/native plugins, Expo peers or build tools. dependency-imports.json carries exact app importers. expo-web-browser remains a REVIEW candidate only, pending config/autolinking/upstream consumer check.

## Concrete risk register (not a replacement security scan)

### P1-review DEP-01 — unresolved dependency advisory triage

Fresh `npm audit --package-lock-only --ignore-scripts --json`:63 affected package entries (critical1/high57/moderate5); not63 independent vulnerabilities and not63 exploitable Android paths. Unique advisory sources and dependency propagation are distinct. Critical entry shell-quote1.10.0 at package-lock.json:11008–11010, via react-devtools-core (lock:10231); advisory GHSA-pqg4-j6r4-53mv requires quote() input containing a comment token and line terminator. No demonstrated user-input path to that operation in the shipped app. Prioritize toolchain/runtime reachability triage before release, not automatic audit fix. npm proposes incompatible/downward fixes such as Expo44; DO NOT apply blindly. Saved raw metadata includes primary advisory links. No package was installed/updated.37 direct packages reported outdated; old does not equal unsafe and newer does not equal Expo-compatible.

### P2 OBS-01 — production render failures lack reviewed durable diagnosis

src/ui/system/AppErrorBoundary.tsx:18 logs only under __DEV__. UI recovery is present and avoids false save claims. No crash/analytics SDK in package.json; searched source/modules/plugins for captureException, ErrorUtils.setGlobalHandler, Sentry/Crashlytics/reportException and found no app implementation. A release render error can be visible to a user without an app-owned correlated diagnostic trail. Native OS/crash services may exist outside this source audit; do not claim they do not exist. Minimum closure: approved privacy-safe error code + build/runtime/route identifier, retention/access policy, verified release-mode capture and symbolication; no message/location/auth payload. Choosing external telemetry/keys remains owner decision.

### P2 OBS-02 — intentional swallowed push reconciliation exceptions obscure operational cause

src/ui/notifications/PushRuntime.tsx:87 catches reconciliation exceptions to undefined; line96 does same for cold-response read. Correctly avoids exposing raw payloads, and cleanup at98–104 retires listeners/timer/ownership. But support cannot distinguish transport absence, native token failure and stale-account discard from release-side traces. Add only reviewed bounded reason counters/diagnostic codes and exact build binding; do not log tokens, account IDs or raw errors. It is an observability gap, not demonstrated dropped notifications or unsafe retries.

### P2 QA-01 — blanket full-test wording exceeds actual runner/build coverage

jest.config.cjs:26 matches only __tests__/**/*.test.ts?(x).125 of729 tracked test files use other runners/locations. No collectCoverage/coverageThreshold is configured here. There is therefore no measured statement/branch coverage percentage for this HEAD, and npm test is not all repository proofs. Maintain explicit runner/feature/source matrix; run selected native/protocol proofs only at meaningful boundaries. Static regex/source guards cannot replace behavioral/native tests.

### P2 QA-02 — known exact-source native and full-regression gap

Historical full CI sourcea48162a7:603 suites/13,391 tests PASS, not this HEAD. Later a5d9 full local run stopped after79PASS/1FAIL; Firebase subprocess timeout was followed by unchanged targeted13/13PASS, not a completed full run or proven app failure. Current task's fresh bounded80/80 does not close current full CI. Existing native group c62 initial-bottom proof is real, but full keyboard/history/participants sequence was interrupted by ANR; root's current new measurements are independent and must be attached separately. Close on current frozen source/build and relevant native scenarios, never by changing old receipt to green.

### P2 MAINT-01 — high churn/authority owners are oversized

DiscoveryPresentation1484 lines; AgreementChat743; task review755; LocationPointEditor610. Large render/state/event code increases review coupling and makes source-string tests fragile. Evidence is size/concentration and real stale/lifecycle controls, not a calculated cyclomatic complexity score. Small pure extractor refactors with unchanged contracts, targeted tests and native comparisons are appropriate; avoid new parallel architecture.

### P3 MAINT-02 — status/test-only/gallery projection confusion

Existing static control graph treats every route as a root and doesn't evaluate flags. A gallery-only component can appear reachable, and existing docs contain older statuses alongside current ones. Preserve receipts/history but mark current state explicitly. Do not count gallery render or module import as production adoption.

No new P0 production blocker was demonstrated in this bounded SOURCE review. Absence of a P0 finding is not release approval.

## Lifecycle / race / error-handling sample

| Source sample | Inspected behavior | Verdict / boundary |
|---|---|---|
| data/focusedResource.ts:18–119 | active/generation/account ownership, abort-on-stop/forget, retained snapshot, coalesced trailing read, finally aborts only owned controller | guarded; fresh model tests run; not network/device proof |
| hooks/useFocusedResource.ts:16–25 | focus/AppState ownership, listener remove and model.stop cleanup | source cleanup present |
| data/activityMessageTargetService.ts:57–87 | before/after account fence, external abort race,15s shared read deadline, final abort and listener removal | strong bounded read ownership; fresh test proof |
| data/serverReceipt.ts:63–91 | caller deadline, explicit uncertainty, timer cleanup; no automatic write replay | correct distinction between timed-out caller and server outcome |
| ui/groups/useGroupReading.ts:25,66 | cancellable600ms displayed ACK, epoch/page/geometry/foreground scope, cleanup of frame/listener/timer | fresh hook tests80 totalwithother2; mocked measurements, actual keyboard/FlatList still native |
| ui/notifications/PushRuntime.ts:24–104 | sessionEpoch/account fences, boundedseen128/blocked32,20s rotate reconcile, cleanup, unchanged retained command | no concrete stale-result bug found; OBS-02 remains |
| features/voiceMessages/nativeAudioAdapters.ts:71–92,161–198,250–252 |100ms record poll stops on cleanup, subscriptions removed, failed release retains fail-closed handle; player teardown | source lifecycle present; audio hardware/encoder parity not inferred |
| features/voice/expoPcmCapture.ts:57–60,124–151 | cap/watchdog/listener cleanup; background stops; streaming watchdog500ms | source bounded; own comment notes focus-loss parity limitation |
| ui/messages/useAutoResend.ts:24–65 | latest-ref, one retry per retained entry, only open/resume/recovered-read, removes AppState listener | no arbitrary timer resend; dedupe authority remains server/outbox |
| lib/dataExportFile.web.ts:12–29 | hash checks, abort revoke, one-second Blob revoke, byte zeroing and anchor remove | delayed timer owns short-lived URL, not a proven leak |

Sampling is10sites within123timer/139listener call surface. No global leak-free or race-free percentage is claimed.

## Test coverage matrix and limits

File-count proxies overlap and are not coverage percentages: auth32; AI30; discovery63; agreements98; group5; media43; push31; design35. Full filenames in scope-summary.json.

| Feature | Unit / component seams | Integration/E2E evidence | Current gap |
|---|---|---|---|
| Auth/account ownership | focused-resource, receipt, auth client tests; controlled deferred promises | connected disposable real Auth/RPC chain exists | current full native account/background matrix |
| AI task/worker | intake, worker projection, source/prompt contracts | real known prior AI turns/worker activation/task publication recorded | natural variety, finish-only/location/media + latestbuild acceptance; no provider call made here |
| Map/discovery | owner/session/marker/paging mocks and pure contracts | server isolated corpus/proofs and native6c PEEK/HALF/FULL | nativeperformance/concurrency different from syntheticrowcounts |
| Private text | service/outbox/history/thread mocked API/native | real textarrival+onephonepush historical receipts | current reconnect, largehistory, media/voice |
| Group | group controller/service/UI/reading pure+React seams | connected real4Auth RPC cancellation/cutoff; inertnativec62 bottomshown | realmulti-partydevice+keyboard/prepend/ACK combined |
| Task/chat photos | journal/upload/recovery/terminal access tests | server receipts, RC02applied; priorisolatedmedia proofs | current exactAPKcamera/galleryupload/read/remove |
| Voice | M4A structural validator, composer/player with native ports mocked | B1DEVapplied + isolatedStorageclosure | two-device actualrecord/send/play/interruption |
| Push | router/exacttarget/accountfences; offlineprovider mock | oneMESSAGEprovideraccepted+ownerphone; OPPLOCALproofonly | otheremitters/transport/physicalnew-taskcapacity |
| UI/motion | React host/RN/Jest mocks, token/source-ratchet | perbuildnative screenshots | actualAndroidgestures/layoutIME/a11y/performance |

Fresh executed tests at this HEAD: focused-resource.test.ts + activity-message-target-service.test.ts + group-reading.test.tsx;3 suites,80 tests PASS,0 skipped/failed. No fresh full suite, native or server run. Output bounded-tests.json/log.

Test quality examples:
- group-reading.test.tsx:26 assigns a fake list ref;36 fake timers and own RAF;46–89 asserts measured targets and stale callbacks. This is a useful behavioral ownership test, not a real FlatList layout/gesture test.
- ex06-corpus-contract.test.ts:544–558 checks source string markers; legitimate wiring guard but formatting/brittle and not semantic provider execution.
- __tests__/reanimatedPatchContract.test.ts:300 conditionally skips shell attestation when shell unavailable. The test targets fake APK structure, not compilednativeexecution.
- ex06-corpus-contract.test.ts:568 conditionally skips stem-port parity if pinnedcandidate unavailable. Record whether skipped in actual runner, not automatic suitecoverage.
- scripts/__tests__/firebase-config.test.ts:17–37 spawns actual Expo config resolver with15s timeout and fixtures; operationally realistic, but host load can cause nondeterministic timeout. Known full-run failure + isolatedPASS means suspected infrastructure sensitivity, not proven flakypercentage.
-0 jest.retryTimes found in static scanned testcalls. No repeatedrun experiment was done, so no statistical flakiness rate.

## Verdicts with transparent score basis

Scores are a reviewer rubric of evidence readiness, not percentages of correct code, security, completion or business value. Each role uses5 named criteria scored0(absent/notdemonstrated),1(partial),2(sufficient source/evidence for this limitedreview).

**Principal Mobile Engineer:7/10 — coherent base, controlled finishing required.** Authority boundaries2; lifecycleownership2; componentseparation1; nativeparity1; performanceproof1. No architectural restart justified. Preserve server ownership, account/visit guards, bounded reads and idempotency.

**QA/Test Lead:6/10 — strong logic/regression scaffolding, incomplete current-device closure.** Logic/racenegatives2; actualisolatedintegration2; exactcurrentfullregression0; currentnativeverticaljourneys1; multi-runner/skiptransparency1. Test count alone cannot close voice, photographs, groupkeyboard or allpush.

**Maintainability/Observability:4/10 — manageable source, weak release diagnosis.** Reproducibleinventory2; modularcomplexity1; runtimeerrorcorrelation0; productiontelemetry/symbolication0; status/runnertraceability1. Highest leverage: align evidence and approve minimal privacy-safe release diagnostics, not massdeletion/refactor.

## Recommended bounded next steps

1. Root attaches current frozenAPK and exact native acceptance results; no reclassifying historical results.
2. Finish actual two-account media/voice and multi-party group path. Close found behavior defects with tests that fail first; do not expand into blind test repetition.
3. Separate dependency advisory triage from mobile source audit: inspect actual runtime/build use, choose Expo-compatible minimal remediation, approved update/build regression, never npm audit fix --force.
4. Approved privacy-safe release diagnostics + symbolication/correlation acceptance.
5. Maintain runner matrix; schedule one currentfullregression checkpoint independent of benchmark/device host load. Keep dedicatedSQL/provider/native levels separate.
6. Review4unreferencedart modules and9dependency candidates after dynamic/config/autolink checks. Currently safe-delete list is EMPTY.

## Artifacts

source-inventory.json; import-graph.json; control-graph-exact.json; test-inventory.json; scope-summary.json; dependency-imports.json; npm-audit.json; npm-outdated.json; dependency-check-receipt.json; bounded-tests.json; bounded-tests.log. Inventory scripts retained for reproduction. npm read-only metadata used privatecache underthisdirectory; no install/update. Sharedhost timing warning: one bounded cold-cacheJest ran concurrently with the beginning ofrootstartup experiment; parent was notified ofstart/end. Those overlapping measurements cannot be treated as uncontended startup samples.
