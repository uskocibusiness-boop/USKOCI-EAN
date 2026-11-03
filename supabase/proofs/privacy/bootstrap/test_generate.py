"""Offline failure-boundary checks; these are not PostgreSQL runtime proof."""
import unittest

from function_sources import FunctionSourceError, parse_function_definition, scan_sql_fragments
from generate import BootstrapError, acl_entries, default_acl_statements, grant_statements, sequence_options


class GenerationBoundaries(unittest.TestCase):
    def sequence(self, **changes):
        return dict(type="bigint", start="1", increment="1", min="1", max="9223372036854775807", cache="1", cycle=False, **changes)

    def test_int64_is_lossless(self):
        self.assertIn("MAXVALUE 9223372036854775807", sequence_options(self.sequence()))

    def test_numeric_json_is_refused(self):
        for value in (9223372036854775807, 9.223372036854776e18, True):
            with self.subTest(value=value), self.assertRaises(BootstrapError):
                sequence_options(self.sequence() | {"max": value})

    def test_decimal_spelling_is_canonical(self):
        for value in ("01", "+1", "1e3", "1; SELECT 1", "-0"):
            with self.subTest(value=value), self.assertRaises(BootstrapError):
                sequence_options(self.sequence() | {"start": value})

    def test_rounded_int64_is_refused(self):
        with self.assertRaises(BootstrapError):
            sequence_options(self.sequence() | {"max": "9223372036854776000"})

    def test_sequence_bounds_and_increment(self):
        for changes in ({"increment":"0"}, {"cache":"0"}, {"start":"0"}, {"type":"integer"}):
            with self.subTest(changes=changes), self.assertRaises(BootstrapError):
                sequence_options(self.sequence() | changes)

    def test_acl_preserves_grant_option(self):
        sql = grant_statements("TABLE", '"public"."probe"', "{anon=r*w/postgres}", "postgres")
        self.assertEqual(len(sql), 2)
        self.assertIn('GRANT SELECT ON TABLE "public"."probe" TO "anon" WITH GRANT OPTION;', sql)

    def test_acl_unreviewed_grantor_and_quoting_refused(self):
        with self.assertRaises(BootstrapError):
            grant_statements("TABLE", "public.probe", "{anon=r/other}", "postgres")
        with self.assertRaises(BootstrapError):
            acl_entries('{"role,quoted"=r/postgres}', "TABLE")

    def test_default_acl_cannot_touch_managed_owner(self):
        with self.assertRaises(BootstrapError):
            default_acl_statements([dict(owner="supabase_admin",schema="public",kind="r",acl="{}")])
        with self.assertRaises(BootstrapError):
            default_acl_statements([dict(owner="postgres",schema="storage",kind="r",acl="{}")])

    def test_function_parser_rejects_appended_command(self):
        ddl = "CREATE FUNCTION public.probe(p_value text) RETURNS text LANGUAGE sql AS $body$SELECT p_value$body$;"
        self.assertEqual(parse_function_definition(ddl, source="synthetic").arguments, "p_value text")
        with self.assertRaises(FunctionSourceError):
            parse_function_definition(ddl + " DROP TABLE public.probe;", source="synthetic")

    def test_expression_secret_report_contains_no_match(self):
        secret = "sb_secret_" + "SYNTHETICVALUE" * 3
        report = scan_sql_fragments([("default:synthetic", "'" + secret + "'")])
        self.assertEqual(report["blocking"][0]["rule"], "supabase_secret_key")
        self.assertNotIn(secret, str(report))


if __name__ == "__main__":
    unittest.main()
