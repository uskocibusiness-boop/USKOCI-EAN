import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

folder = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('plan_trace', folder / 'plan-cache-trace.py')
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)
source = (folder.parents[1] / 'candidates/discovery-grad-20261008/candidate.sql').read_text(encoding='utf-8')
start = source.index('with place_base as materialized (')
end = source.index(' into result;', start)
query = source[start:end].rstrip()


def record(query_text=query, **patch):
    plan = {'Node Type': 'Aggregate', 'Actual Loops': 1, 'Shared Hit Blocks': 4,
            'Filter': 'secret-filter', 'Output': ['secret-output'],
            'Plans': [{'Node Type': 'Seq Scan', 'Relation Name': 'needs', 'Plan Rows': 40000,
                       'Actual Rows': 40000, 'Actual Loops': 1, 'Shared Hit Blocks': 400}]}
    plan.update(patch)
    return 'NOTICE: duration: 20 ms plan: ' + json.dumps({'Query Text': query_text, 'Plan': plan})


class PlanTraceTests(unittest.TestCase):
    def test_source_binding(self):
        self.assertEqual(len(query.encode()), 7154)
        self.assertEqual(hashlib.sha256(query.encode()).hexdigest(), '3f63aaf71e9aff49e00ad0afc1a6224fe79c147010c67e0d8568808e0148133b')

    def test_only_projected_structure_leaves_parser(self):
        result = trace.plans(record())
        self.assertEqual(result[0]['nodeCount'], 2)
        self.assertEqual(result[0]['sample'], 0)
        encoded = json.dumps(result)
        for prohibited in ['Query Text', 'Filter', 'Output', 'secret-', 'place_base as']:
            self.assertNotIn(prohibited, encoded)

    def test_changed_inner_query_rejected(self):
        with self.assertRaisesRegex(ValueError, 'SOURCE_BINDING'):
            trace.plans(record(query + ' '))

    def test_no_plan_after_timeout_is_empty(self):
        self.assertEqual(trace.plans('ERROR: 57014: canceling statement due to statement timeout'), [])

    def test_missing_needs_or_actual_buffers_rejected(self):
        with self.assertRaisesRegex(ValueError, 'RELATION_MISSING'):
            trace.plans(record(Plans=[]))
        with self.assertRaisesRegex(ValueError, 'NONFINITE'):
            trace.plans(record(**{'Actual Loops': 1, 'Shared Hit Blocks': None}))

    def test_two_plans_do_not_become_one_sample(self):
        with self.assertRaisesRegex(ValueError, 'MULTIPLE'):
            trace.plans(record() + '\n' + record())


if __name__ == '__main__':
    unittest.main()
