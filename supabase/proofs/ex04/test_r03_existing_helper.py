"""Negative source controls for R03 existing-helper candidate. No SQL execution."""
import unittest
from unittest.mock import patch
import build_r03_existing_helper as r


class R03SourceOnlyCandidateTests(unittest.TestCase):
    def test_exact_generator_and_frozen_source(self):
        source=r.candidate_text()
        self.assertEqual(source.encode('utf-8'),r.TARGET.read_bytes())
        self.assertEqual(r.md5(r.PAGE_BODY),r.BODY_MD5)
        self.assertEqual(source.lower().count('create or replace function public.rpc_list_my_needs_page'),1)

    def test_existing_helper_and_new_selection_authority_are_preserved(self):
        source=r.candidate_text()
        self.assertNotIn('create function private.own_task_counts',source.lower())
        self.assertNotIn('drop function private.own_task_counts',source.lower())
        self.assertIn('01d695467d5fa39dec180086cb07de40',source)
        self.assertIn('0d2156f39520b49da48d3eabf14bfffe',source)
        self.assertNotIn('6d65e304f41f3e130228f58874757f0d',source)

    def test_fail_closed_local_only_closure_unchanged_acl_and_catalog(self):
        source=r.candidate_text()
        for guard in ('R03_DISPOSABLE_ONLY','R03_CLOSURE_NOT_READY','R03_CLOSURE_MOVED',
                      'R03_EXISTING_HELPER_CHANGED','R03_UNRELATED_FUNCTION_DELTA',
                      'R03_PAGE_ATTRIBUTES_CHANGED','R03_READER_AUTHORITY_CHANGED',
                      'R03_PAGE_PREDECESSOR_DRIFT','R03_DEPENDENCY_CHANGED'):
            self.assertIn(guard,source)
        self.assertEqual(source.count('DO $r03$'),1)

    def test_mutating_frozen_body_or_function_signature_refuses_generation(self):
        with patch.object(r,'PAGE_BODY',r.PAGE_BODY+'\nSELECT 1;'):
            with self.assertRaisesRegex(ValueError,'R03_FROZEN_BODY_CHANGED'):
                r.candidate_text()
        with patch.object(r,'PAGE_SIGNATURE','wrong'):
            with self.assertRaisesRegex(ValueError,'R03_PAGE_SIGNATURE_CHANGED'):
                r.candidate_text()


if __name__=='__main__': unittest.main()
