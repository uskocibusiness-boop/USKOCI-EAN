# F10 — controlled DEV owned-reader promotion

Prepared for `leqcwgzvjsxugfgzdmth` only; **not applied**. The package changes only
`public.rpc_get_worker_execution_modes(uuid)`. It adds owned per-service display
facts and preserves its existing aggregate response, owner and ACL. It writes no
profile, review, capability, activation or matching data.

`capture.sql` reads only database catalog metadata. `preimage.json` contains the
fresh original definition, ACL, two taxonomy helpers, pgcrypto digest dependency
and eleven relation shapes. `build.mjs` runs the complete tested LOCAL_ONLY
candidate unchanged on disposable PGlite, then captures its exact output. No
LOCAL_ONLY bypass is sent to DEV. The explicit reviewed forward package has
fresh OID/body/owner/ACL/relation fingerprints and an external target requirement.
The target setting expresses intent; it does not authenticate project identity.

1. Verify the connector is bound to the named DEV project. Run `preflight.sql`
   through the read-only SQL tool; any drift requires a new reviewed capture.
2. Run `node supabase/operations/dev-alpha/f10-saved-services-20261101/build.mjs --check`
   and `node --test supabase/operations/dev-alpha/f10-saved-services-20261101/package.test.mjs`.
3. After review/authorization, `build.mjs --emit forward` emits the complete
   transaction for the controlled migration tool. **Do not use execute_sql for
   DDL, including temporary or rollback-only DDL.** The transaction includes
   `acceptance.sql` before its final fingerprint check and commit. Any error must
   roll the transaction back, with no silent retry or weakened gate.
4. Verify `postflight.sql` through the read-only SQL tool. Then perform separately
   authorized real owned Save/reopen and both-account/device acceptance.
5. `build.mjs --emit rollback` restores the captured original function only if
   the exact expected postimage/dependencies still match. It preserves ACL and
   user data. Apply through the same reviewed migration procedure and verify
   `preflight.sql` afterward. The client tolerates missing per-service fields and
   reports their unavailability rather than inventing consent.

The no-row acceptance checks anonymous identity denial, authenticated NULL-profile
ownership denial, and the exact new projection with empty names and NULL ownership
keys against real relation shapes. It neither selects nor returns real user rows.
This is not a saved-user journey, real JWT verification, Android proof or release
approval. The separate local `r08_saved_worker_services.test.mjs` covers real SQL
projection → mobile decoding with explicit durable-writer fixtures; those fixture
proofs also do not constitute DEV Save/binder acceptance.

This reader package has no shared mutable function with the R08 activation
package. Apply packages sequentially and repeat their exact preflight gates.
