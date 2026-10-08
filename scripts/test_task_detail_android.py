"""Task recovery selectors must reject stale actions; physical screenshots remain required."""
import ast
from pathlib import Path
import re
import unittest
from unittest.mock import Mock, patch
from xml.etree import ElementTree as ET

namespace = {'re': re}
for filename in ('ru5_android_device_ui_journey.py', 'intent_shell_android_journey.py', 'task_detail_android_journey.py'):
    source = Path(__file__).with_name(filename)
    functions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(functions, str(source), 'exec'), namespace)


def tree(*values):
    root = ET.Element('hierarchy')
    for value in values:
        ET.SubElement(root, 'node', {'text': value, 'enabled': 'false'})
    return root


class TaskRecoverySelectors(unittest.TestCase):
    def test_error_context_without_action_is_accepted(self):
        namespace['assert_no_application_actions'](tree('Zadatak trenutno nije moguće učitati.', 'Nazad na Zadatke', 'Pokušajte ponovo'))

    def test_even_a_disabled_stale_application_action_is_rejected(self):
        for label in ('Pošalji ponudu', 'Pošalji prijavu'):
            with self.subTest(label=label), self.assertRaises(AssertionError):
                namespace['assert_no_application_actions'](tree('Greška', label))

    def test_cached_error_requires_same_snapshot_title_stale_notice_retry_and_back(self):
        values = ('Zadatak trenutno nije moguće učitati.', 'NAV title', 'Nazad na Zadatke', 'Pokušajte ponovo',
                  'Poslednji učitani podaci. Osvežite zadatak pre nastavka.')
        for omitted in range(len(values)):
            if omitted == 0:
                continue  # wait_surface itself owns observation of the error text.
            observed = tree(*(value for index, value in enumerate(values) if index != omitted))
            with self.subTest(omitted=omitted), patch.dict(namespace, {
                'NAV_NEED_TITLE': 'NAV title', 'wait_surface': Mock(return_value=(observed, {})), 'shot': Mock(),
            }), self.assertRaises(AssertionError):
                namespace['task_error']('proof', cached=True)

    def test_fresh_detail_rejects_stale_notice_even_with_a_visible_application_control(self):
        observed = tree('NAV title', 'Nazad na Zadatke', 'Pošalji ponudu', 'Poslednji učitani podaci')
        with patch.dict(namespace, {'NAV_NEED_TITLE': 'NAV title', 'wait_surface': Mock(return_value=(observed, {})), 'shot': Mock()}):
            with self.assertRaises(AssertionError):
                namespace['fresh_task']('proof')


if __name__ == '__main__':
    unittest.main()
