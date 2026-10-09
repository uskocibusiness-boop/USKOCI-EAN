# Bounded source review and isolated execution status

## Current recapture — 09.10.2026 (DEV235)

Read-only captures at23:44–23:50UTC08.10 confirm ledger235, readytrue and unchanged full digest3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23. All13 function bodies and metadata, certificate rows, dataset/export catalogs, three table surfaces and Edgev22 assets match the prior225 captures. One pg_get_functiondef header prints public.notification_deliveries under explicit pg_catalog; it is a catalog rendering difference, not a changed body. The local exact capture uses the same search_path and admits both qualified and legacy public signatures.

Regenerated candidate SHA256239ccd181e2787ad7624bc638c3b6bf88eb928e1419f332f0d709e8f6adc45ac differs from the preceding candidate only in its ledger guard225→235. This guard was changed AFTER full recapture and comparison. Fresh regenerated preflight returns problems[]. Revert/postflight/Edge candidate hashes stay unchanged.22DO blocks and outerSQL parse;6offline Edge testsPASS. A Windows working-tree LF/CRLF mismatch initially failed byte comparison; the unchanged Git blob was materialized as declared LF and all6 reranPASS. No test assertion was weakened.

Current99 wrapper run37861832231/sourcec70dd513d0896628b9958a8be2bd272a7180b383 succeeded: independently checked28/28 source hashes;99→108→99→108→99 certificate restoration,17AI receipt and13DEV definition checks,13behavior groups,6offlineEdge, teardownPASS. It executes a local ledger147/OID/certificate-specific wrapper, not literal live235SQL. Prior37085434332 is historical evidence. This chain verifies the relevant certified99-function predecessor and exact17AI+13push/certificate functions, not an entire replica of everyDEV235 lifecycle function. CLI2.119.0 secrets listing succeeds; EXPO_PUSH_TRANSPORT_ENABLED digest matches SHA256('false'), single-target flag absent. This proves metadata/default-off state, not provider execution or set/deploy authority. No DEV write, certificate update, Edge deployment, admission or provider call occurred.

## Historical source review (02.10)


Current candidate SHA256: `f069ba97a2ce3d6b459404dcb74593cdc54b6d651a2869e70a789d22271f227c`.

The earlier independent review by `/root/review_ci` covered the generator, candidate/preflight/postflight/revert, isolated current99 proof and workflow. It identified the encoded inverse-probe GUC defect, which was corrected before encoding. That source review was not DEV application acceptance.

Run37084601034 at882f3cbb completed the separate source-bound current99 local-catalog fixture assembly: all17 AI receipt function checks and13 full-definition/portable-metadata checks passed. This is not execution of the original historical DEV ledger bytes. The report explicitly records historicalLedgerApplied=false. All15 report source hashes were independently matched to committed Git blobs; report SHA256 is5193b0ec13c47fb4a6ad4c4b45a4ac03b4beacf31bd1ff667f899fd611787df9.

The run then stopped at the first promotion install because four frozen predecessor regprocedure signatures relied on public search_path while the new wrapper intentionally sets pg_catalog. The current generator fully qualifies those four signatures using unique exact tuple anchors, retaining every expected body hash. The generated candidate differs only in those four strings. Historical installer, seven function bodies, revert, preflight, postflight and Edge assets are unchanged. Root independently reviewed this bounded correction. JavaScript parsing and pure source generation passed; the corrected SQL still requires isolated execution.

The full current99 install/postflight/revert/reapply proof and existing13 behavioral groups must pass before promotion. Existing trusted service_role direct DML limitation remains explicit. No live mutation, certificate update, Edge deployment, admission or sending occurred in this correction.

## Exact-message target offline extension —09.10

Ten Edge tests now pass, adding the single-target exact-message path with global transport off, validated opaque event identity and exactly three metadata fields; one mock provider request, no global claim/readiness path. Malformed event identities fail before provider IO. Exact flag off and legacy begin receipts keep INBOX compatibility; target off stays zero IO even when exact is on. Only tests and their source manifest changed; candidate Edge bytes and SQL remain frozen. No real provider delivery, DEV deployment or native tap has been proven by these tests.


## Applied current99 package —09.10.07:04UTC

The Owner account authenticated through the normal CLI browser flow and both target=false secret writes succeeded. All3 metadata digests verifiedfalse. Corrected dispatcher discovery found shared cron2 uskoci_edge_workers (its name contains no push): paused07:02:48, freshdrain/preflightPASS07:03:40–42, restored07:04:48 unchanged. Marketplacejob1 remainedactive. Exact migration20261009070352 storedSHAbe8782a4834857f3d2507a40e6bcf9757fc61f753e6857977fa02360867f9ace; ledger236, roster108, postflightproblems[], certificate0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb. Edge24 bothfiles exactcandidate, verify_jwt=false/customserviceauth retained. Admission0/provider0/push0; allflagsfalse. Receipt: `supabase/operations/dev-alpha/ledger/20261009_push_single_target_v1_application.receipt.json`. Prior NOT_APPLIED/access-denied sections are history. No repeated application; proceed to actual owned device/fresh event admission. Frozen proof inputs/manifests remain unchanged.
