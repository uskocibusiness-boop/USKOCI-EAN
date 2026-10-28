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

Only after every actually remaining difference is proved within this scope may
an isolated next stage create synthetic Auth users, exercise current PostgREST
paths, apply the unchanged R01 candidate and test all three private columns.
Its receipt must retain both strict FAIL and the narrower prerequisite/result
statuses. HTTP execution must still include own/foreign/participant, same/other
world, closed/anon/malformed/expired sessions, legitimate public reads and owner
close-search, actual current client decoders, and unchanged closure certification.
Neither metadata equality nor this admission specification replaces that proof.
