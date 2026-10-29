"""R05/F18 source contract checks. No DB or business data."""
import unittest
from unittest.mock import patch
import build_today_candidate as r

class TodayWindowCandidateTest(unittest.TestCase):
    def test_generator_and_pinned_current_body(self):
        self.assertEqual(r.candidate_text().encode(),r.TARGET.read_bytes())
        self.assertEqual(len(r.PREDECESSOR_MD5),32)
        self.assertEqual(len(r.TARGET_MD5),32)
    def test_only_today_null_and_started_bounded_branches_are_new(self):
        source=r.candidate_text()
        self.assertIn("n.schedule_kind='TODAY_FLEXIBLE' and n.starts_at is null and n.ends_at is null",source)
        self.assertIn("(anchor_day+1)::timestamp at time zone wtz",source)
        self.assertIn("private.worker_available_periods(pid,ws,we,tz)",source)
        self.assertIn("n.schedule_kind='TODAY_FLEXIBLE' and n.starts_at is not null and n.ends_at is not null",source)
        self.assertIn("private.worker_available_periods(pid,at_now,n.ends_at,tz)",source)
        self.assertIn("private.worker_calendar_events",source)
        self.assertNotIn('GRANT EXECUTE ON FUNCTION',source)
        self.assertNotIn('DROP FUNCTION',source)
        self.assertEqual(source.count('CREATE OR REPLACE FUNCTION private.worker_need_time_tier_v1'),1)
        # The full captured predecessor remains intact apart from this insertion;
        # no existing time mode, function setting or helper is rewritten.
        original=r.SOURCE.read_bytes().decode('utf-8')
        target=source.split('$r05_body$')[1]
        self.assertEqual(target.replace(r.INSERTION,'',1),original)
    def test_disposable_only_and_authority_closure_are_guarded(self):
        source=r.candidate_text()
        for expected in ['R05_HOSTED_OR_NONDISPOSABLE_TARGET_REFUSED','cli_login_postgres',
                         'R05_TIME_TIER_AUTHORITY_DRIFT','R05_CALENDAR_SOURCE_DRIFT',
                         'R05_CLOSURE_NOT_READY','R05_CLOSURE_MOVED',
                         'R05_TIME_TIER_ATTRIBUTE_CHANGED','a845d98b624ae4ac8ec33159beb8bb17']:
            self.assertIn(expected,source)
    def test_mutated_predecessor_and_anchor_fail_before_generation(self):
        with patch.object(r,'PREDECESSOR_MD5','0'*32):
            with self.assertRaisesRegex(ValueError,'R05_CURRENT_SOURCE_DRIFT'):
                r.candidate_text()
        with patch.object(r,'ANCHOR','deleted source marker'):
            with self.assertRaisesRegex(ValueError,'R05_INSERTION_ANCHOR_DRIFT'):
                r.candidate_text()
        with patch.object(r,'INSERTION',r.INSERTION+'\nreturn 4;'):
            with self.assertRaisesRegex(ValueError,'R05_TARGET_BODY_DRIFT'):
                r.candidate_text()

if __name__=='__main__':unittest.main()
