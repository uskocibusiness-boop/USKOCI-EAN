# Requirements for a separate, limited R01 admission

Status: **not admitted**. This specification does not change strict parity,
authorize a fixture, or classify the full platform as equal. It follows the
source-provenance correction that omits the CLI's unconditional legacy webhook
bootstrap before an empty disposable database is initialized.

The prior runtime `40718314171` has 13 strict differences and 62 supplemental
differences. The legacy bootstrap accounts for the added role membership, three
default ACL records, its role search_path, ten added schema-permission rows and
the two pg_net security-mode/configuration differences. The new run must measure
the actual result. A predicted removal is not accepted evidence.

Run `40732062562` reached the actual patched TypeScript shell, isolated startup
and all version/history checks, but stopped at an incorrect assertion that the
native pg_net helper/event should be absent. Its individual booleans are unknown
and it produced no new strict or supplemental comparison. The read-only DEV
contract in `artifacts/r01/20261028-managed-net-hook-contract.json` (SHA-256
`9bf79f4562d4829466d0a9e8706d8d9380a83465c71b9501d84e4dbba5800134`)
instead confirms legitimate helper/event presence, invoker mode for the helper
and both HTTP routines, and absence of the `supabase_functions` schema.
`managed-net-hook-expected.json` binds the exact catalog query to that observed
native contract. Its comparison is enforced after the next complete strict and
supplemental captures; any differing helper body, ACL, security setting or event
definition still fails. Neither that source correction nor a successful CLI
build is a platform or R01 boundary admission.

Any later limited admission must consume the **same validated raw capture** and
the unchanged strict and supplemental comparators. It must enumerate each
remaining identity and field; reject every extra, missing or changed field outside
the reviewed cases; retain the original strict FAIL in receipts; and emit a
separate result named `R01_BOUNDARY_PREREQUISITES` rather than `METADATA_EQUAL`.
The application table, policies, function bodies/settings/ACLs, column ACLs,
triggers, constraints, exposed schemas, authenticator pre-request and actual
request principals must remain exact. It cannot admit another source/baseline or
changed platform version. Evidence must be captured before test fixtures.

| Prior remaining difference | Concrete proof needed for limited R01 scope | What stays unproven |
| --- | --- | --- |
| `storage.objects` raw table ACL | Compare normalized ACL entries including grantor and grant option; show exactly which tuple differs or whether only ordering differs. The existing supplemental capture separately compares effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, ownership and grantability for all ten registered principals. Every effective result must be identical. If actual permissions differ, do not admit. The R01 scenario must not claim Storage file lifecycle or change Storage ACL. | Full Storage management and closure/export readiness. Any ACL serialization difference may still alter closure certification and must be recorded without rebinding a certificate. |
| Hosted `cli_login_postgres` role and its `postgres` membership absent locally | Verify the only difference is this exact hosted login role and exact one-way membership, with captured role flags and membership options. Show that no tested request principal inherits or can SET this role in DEV, and no application object/definer owner, policy, grant/default grant, role setting or membership chain depends on it. Tests authenticate through GoTrue/PostgREST roles, never this hosted CLI login. The dependency capture must include all role references rather than relying only on literal SQL search. | Hosted CLI login and remote administrative access. Never create that operational role or transfer its login configuration to a disposable environment. |
| `supabase_admin` search_path spelling differs | Compare parsed effective search path under the actual role and catalog namespace existence, not strings alone. Both quoted `$user` variants must resolve to the same actual schemas with the same order. Show that missing `supabase_admin`/literal `$user` namespaces cannot shadow an object. No raw setting or new path may be accepted. Request-role and function-local paths must remain exact. | A future schema creation or path change; re-evaluate on every run. Never ALTER the managed role setting to force equality. |
| Ownership of `pg_stat_statements`, `pgcrypto`, `uuid-ossp`, and corresponding routine owner/ACL fields | Require exact extension name/version/schema and complete routine inventory. Each affected routine must be SECURITY INVOKER on both sides, with equal language, actual body/binary/config, strictness, volatility, parallel/leakproof flags, and effective EXECUTE for all principals that execute an R01 path. Prove effective schema USAGE and request-role reachability equal. Examine grantor-only versus actual privilege changes explicitly. A changed SECURITY DEFINER routine, missing function, changed body/config or execution privilege blocks admission. Do not generalize this rule to pg_net or other extensions. | Extension administration, ALTER/DROP/GRANT authority and operational use of the statistics extension. No ownership or ACL rewrite is permitted. |

The existing supplemental query covers four execute principals (anon,
authenticated, service_role, postgres), ten schema/Storage principals and their
registered role reachability. This is useful evidence but **insufficient by
itself** for the hosted-login dependency and effective-path assertions above.
The missing assertions need a narrow read-only catalog capture on DEV and the
disposable server, exact baseline binding, adversarial checker tests and actual
execution. Dynamic SQL can hide dependencies from pg_depend; inspect all
affected captured executable bodies and fail if authority can reach an unproved
object. A statement that an entire managed schema is irrelevant is not enough.

The separate read-only DEV capture
`artifacts/r01/20261028-hosted-cli-role-dependencies.json` (SHA-256
`3574fb9f89b4022b2124ce94b82bad33452d5484fc069012476a09d735617b76`)
advances the hosted-login case: pg_shdepend reports no objects depending on
`cli_login_postgres`; its sole membership is that login role as a non-inheriting,
non-admin member of postgres with SET allowed. The login role has none of
SUPERUSER/CREATEROLE/CREATEDB/REPLICATION/BYPASSRLS. All eight queried
request/service/postgres principals have neither inherited USAGE nor SET to
that login role. Captured application/Auth/Storage/extensions routine bodies
contain zero literal mentions. Namespaces named `supabase_admin`, `$user` and
literal `\$user` are all absent. This contains only catalog metadata, not Auth
or business rows. It supports the scoped hypotheses but is not yet a paired
disposable assertion or a complete dynamic-code dependency proof.

The follow-up catalog capture
`artifacts/r01/20261028-storage-acl-extension-invoker-metadata.json` (SHA-256
`c2020c0675a8c9d71a4d9d4dad516fc526aec609f5ac11efbb25711498d9debf`)
identifies the exact prior Storage ACL delta: both sides have 32 normalized
grantee/grantor/privilege tuples. Only the eight explicit grant-option bits for
the table owner `supabase_storage_admin` differ (DEV true; prior disposable
false). Every other tuple is the same. The owner itself is identical; the
[PostgreSQL 17 ownership rule](https://www.postgresql.org/docs/17/ddl-priv.html)
gives an owner implicit grant options, explaining the already-equal effective
grantability checks. This is a concrete owner-bit representation difference,
not an allowance for arbitrary Storage grants. It must be rechecked against the
new disposable capture and still remains a strict metadata difference.

The same read-only capture confirms zero SECURITY DEFINER functions among all
49 affected extension routines: pgcrypto 36, uuid-ossp 10, pg_stat_statements 3.
This strengthens the execution-authority condition but does not substitute for
the paired body/config/EXECUTE comparison or the actual API tests.

Only after every actually remaining difference is proved within this scope may
an isolated next stage create synthetic Auth users, exercise current PostgREST
paths, apply the unchanged R01 candidate and test all three private columns.
Its receipt must retain both strict FAIL and the narrower prerequisite/result
statuses. HTTP execution must still include own/foreign/participant, same/other
world, closed/anon/malformed/expired sessions, legitimate public reads and owner
close-search, actual current client decoders, and unchanged closure certification.
Neither metadata equality nor this admission specification replaces that proof.
