# PKG1A — future public-table Data API permissions

Read-only policy guidance (22 October 2026). The announced **30 October 2026** Supabase change means **new** public tables must not rely on inherited automatic Data API grants. Previously existing table permissions are not changed by this documentation.

For each **future** table-creating migration:

1. Identify whether direct access is truly needed by `anon`, `authenticated` or `service_role`. RPC-only tables should not gain broad direct-client grants by default.
2. Enable **RLS**, add restrictive ownership policies with correct `USING` and `WITH CHECK`. `TO authenticated` alone does **not** restrict rows to the owner.
3. Put narrowly scoped explicit `GRANT` statements next to table creation **only for intended access**. Check table owner, sequence usage and definer function privilege boundaries.
4. Test signed-out, authorized and foreign-account behavior on a fresh database rebuild and existing DEV. Inspect view `security_invoker` and `SECURITY DEFINER` functions separately.
5. Do not rewrite old migration files, change default privileges globally, or run blanket grants/revokes as part of this package.

Official announcement: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
