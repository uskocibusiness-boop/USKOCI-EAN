"""Offline tests of the emulator proof (EX-07 S03): the scenario flow runs against a MODEL of the app (fake_app.py) and of GoTrue
(fakes.py). They prove the SCRIPT - green on the designed behaviour, red for the right assertion when one rule is broken, NOT_RUN
when a precondition is missing - never the app or the provider; only the CI emulator run does that.
"""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import fake_app
import fakes
import s03_android_proof as proof
import s03_core as core
import s03_http as net

HERE = Path(__file__).resolve().parent
LABELS = core.Labels.load(HERE / 'ui_labels.json')


def run(provider=None, bugs=(), run_as=True):
    clock = fakes.FakeClock()
    prov_model = fakes.FakeProvider(clock, **(provider or {}))
    http = net.Http(prov_model.transport)
    secrets = core.SecretSet()
    report = core.Report('EMULATOR', {'source': {'head': 'test', 'runId': '0'}}, secrets)
    dev = fake_app.FakeApp(prov_model, LABELS, secrets, clock, frozenset(bugs), run_as=run_as)
    ctx = proof.AndroidCtx(net.GoTrue(http, fakes.API, 'anon'), net.Mailbox(http, 'http://127.0.0.1:54324', clock), clock, report, secrets,
                           dev, suffix='e1')
    ctx.mail.clear()
    dev.prepare(None)
    proof.run_all(ctx)
    return report.finalize(), prov_model, dev, secrets


def row(data, check_id):
    return next(a for a in data['assertions'] if a['id'] == check_id)


def statuses(data):
    return {a['id']: a['status'] for a in data['assertions']}


class BehavesAsDesigned(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.provider, cls.dev, cls.secrets = run()

    def test_every_check_is_green_and_the_result_is_pass(self):
        bad = {k: (v, row(self.data, k)['detail']) for k, v in statuses(self.data).items() if v not in ('PASS', 'OBSERVATION')}
        self.assertEqual(bad, {})
        self.assertEqual(self.data['result'], 'PASS')

    def test_every_emulator_check_of_the_catalog_is_reported(self):
        self.assertEqual([a['id'] for a in self.data['assertions']], [c['id'] for c in core.CATALOG if c['level'] == 'EMULATOR'])

    def test_a_confirmation_callback_opens_the_login_form_cold_and_the_stage_stays_when_warm(self):
        self.assertEqual(row(self.data, 'E05')['observed']['stateAfterCallback'], 'CONFIRMATION_STAGE')
        self.assertTrue(row(self.data, 'E06')['observed']['appLeftTheAuthSurface'])

    def test_the_resend_limit_was_seen_in_the_ui(self):
        o = row(self.data, 'E04')['observed']
        self.assertTrue(o['acceptedBannerSeen'] and o['rateLimitBannerSeen'])
        self.assertEqual(o['messagesToAddress'], 2)

    def test_the_old_callback_never_changed_anybody(self):
        o = row(self.data, 'E11')['observed']
        self.assertEqual(o['screenState'], 'OPORAVAK_SIGNED_IN')
        self.assertTrue(o['victimPasswordIsTheControlOne'] and o['victimOriginalPasswordRefused'])
        self.assertTrue(row(self.data, 'E10')['observed']['callbackWasValidAtTheProvider'])

    def test_replay_while_signed_out_is_recorded_not_judged(self):
        o = row(self.data, 'E12')
        self.assertEqual(o['status'], 'OBSERVATION')
        self.assertEqual(o['observed']['screenState'], 'OPORAVAK_FORM')      # the model's provider keeps the recovery session valid
        self.assertTrue(o['observed']['showsTheSameAccount'])
        self.assertFalse(o['observed']['showsAnotherAccount'])

    def test_the_os_retention_observation_names_the_activity_records(self):
        o = row(self.data, 'E16')['observed']
        self.assertTrue(o['activities']['credentialsFound'])

    def test_app_data_was_cleared_once_and_only_in_the_signed_out_group(self):
        self.assertEqual(self.dev.cleared, 1)

    def test_no_credential_reaches_the_report(self):
        text = json.dumps(self.data)
        for session in self.provider.sessions.values():
            self.assertNotIn(session['access'], text)
            self.assertNotIn(session['refresh'], text)
        self.assertEqual(self.secrets.find_in_text(text), [])

    def test_screenshots_were_taken_for_the_key_steps(self):
        self.assertIn('05-warm-confirmation-callback.png', self.dev.shots)
        self.assertIn('07-recovery-callback-while-signed-in.png', self.dev.shots)


class BreaksOneRule(unittest.TestCase):
    def test_signup_tap_failure_does_not_overwrite_completed_login_assertion(self):
        original = fake_app.FakeApp.tap
        def tap(device, label_id, *args, **kwargs):
            if label_id == 'login.to_signup':
                raise proof.UiTimeout('SIGNUP_FORM_NOT_REACHED')
            return original(device, label_id, *args, **kwargs)
        with mock.patch.object(fake_app.FakeApp, 'tap', tap):
            data, *_ = run()
        self.assertEqual(row(data, 'E01')['status'], 'PASS')
        self.assertEqual(row(data, 'E02')['status'], 'ERROR')
        self.assertEqual(row(data, 'E04')['status'], 'NOT_RUN')
        self.assertEqual(data['result'], 'HARNESS_BROKEN')

    def test_later_part_of_same_assertion_still_invalidates_an_earlier_pass(self):
        with mock.patch.object(proof, 'sign_in_succeeds', side_effect=proof.UiTimeout('SIGNIN_FAILED')):
            data, *_ = run()
        self.assertEqual(row(data, 'E06')['status'], 'ERROR')
        self.assertIn('SIGNIN_FAILED', row(data, 'E06')['detail'])

    def assertFinds(self, bug, *failing):
        data, *_ = run(bugs=[bug])
        for check_id in failing:
            self.assertEqual(row(data, check_id)['status'], 'FAIL', f'{bug}: {check_id}; {row(data, check_id)}')
        self.assertEqual(data['result'], 'FINDINGS')
        return data

    def test_adopting_a_session_from_a_confirmation_callback_is_a_finding(self):
        self.assertFinds('adopts_session', 'E05', 'E06')

    def test_replacing_the_signed_in_session_is_a_finding(self):
        self.assertFinds('replaces_session', 'E08')

    def test_a_recovery_screen_that_ignores_the_signed_in_account_is_a_finding(self):
        self.assertFinds('ignores_signed_in', 'E10', 'E11')

    def test_a_token_in_the_log_is_a_finding(self):
        data = self.assertFinds('logs_tokens', 'E13')
        self.assertEqual(row(data, 'E13')['observed']['appTags'], ['ReactNativeJS'])

    def test_an_os_that_logs_the_launch_uri_is_an_observation_not_an_app_finding(self):
        data, *_ = run(bugs=['os_logs_url'])
        self.assertEqual(row(data, 'E13')['status'], 'PASS')                       # E13 is about what the APP wrote
        self.assertGreater(row(data, 'E16')['observed']['systemLogCredentialMatches'], 0)
        self.assertEqual(row(data, 'E16')['observed']['systemLogTags'], ['wm_create_activity'])
        self.assertEqual(data['result'], 'PASS')

    def test_a_token_in_private_storage_is_a_finding(self):
        data = self.assertFinds('persists_tokens', 'E14')
        self.assertTrue(row(data, 'E14')['observed']['where'])

    def test_a_token_on_screen_is_a_finding(self):
        self.assertFinds('shows_tokens', 'E15')

    def test_unreadable_storage_makes_the_storage_facts_unavailable_not_green(self):
        data, *_ = run(run_as=False)
        st = statuses(data)
        for check_id in ('E02', 'E05', 'E08', 'E14'):
            self.assertEqual(st[check_id], 'UNAVAILABLE', check_id)
        self.assertEqual(data['result'], 'PARTIAL')
        self.assertNotIn('FAIL', st.values())

    def test_a_provider_without_a_confirmation_callback_stops_the_signed_in_groups_cleanly(self):
        data, *_ = run(provider={'confirm_without_tokens': True})
        st = statuses(data)
        self.assertEqual(st['E05'], 'ERROR')
        for check_id in ('E08', 'E10', 'E11'):
            self.assertEqual(st[check_id], 'NOT_RUN', check_id)
        self.assertNotEqual(data['result'], 'PASS')

    def test_a_missing_error_redirect_is_not_run_not_a_failure_of_the_app(self):
        data, *_ = run(provider={'links_are_reusable': True})
        o = row(data, 'E07')
        self.assertIn(o['status'], ('PASS', 'NOT_RUN'))
        self.assertNotEqual(o['status'], 'FAIL')


class DriverGuards(unittest.TestCase):
    ENV = {'EX07_API_URL': 'http://127.0.0.1:54321', 'EX07_MAIL_URL': 'http://127.0.0.1:54324', 'EX07_ANON_KEY': 'anon'}

    def test_refuses_a_non_loopback_target(self):
        with mock.patch.dict(os.environ, {**self.ENV, 'EX07_API_URL': 'https://leqcwgzvjsxugfgzdmth.supabase.co'}):
            self.assertEqual(proof.main(), 2)

    def test_refuses_an_apk_built_from_another_commit(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {**self.ENV, 'EX07_OUT': tmp, 'EX07_S03_APK_SOURCE': 'deadbeef' * 5}):
            with mock.patch.object(proof.prov, 'git_head', return_value='cafebabe' * 5):
                self.assertEqual(proof.main(), 2)

    def test_main_runs_end_to_end_on_the_model_and_writes_the_native_report(self):
        clock = fakes.FakeClock()
        prov_model = fakes.FakeProvider(clock)
        secrets = core.SecretSet()
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {**self.ENV, 'EX07_OUT': tmp, 'GITHUB_RUN_ID': '4242'}):
            dev = fake_app.FakeApp(prov_model, LABELS, secrets, clock)
            code = proof.main(device=dev, transport=prov_model.transport, clock=clock)
            report = json.loads((Path(tmp) / 'native-report.json').read_text(encoding='utf-8'))
        self.assertEqual(code, 0, [a for a in report['assertions'] if a['status'] not in ('PASS', 'OBSERVATION')])
        self.assertEqual(report['result'], 'PASS')
        self.assertEqual(report['source']['runId'], '4242')
        self.assertEqual(report['label'], 'DISPOSABLE EMULATOR evidence')
        self.assertEqual(report['environment']['kind'], 'disposable-android-emulator-and-local-gotrue-mailpit')
        self.assertTrue(report['environment']['timingsAreCiEmulatorNumbersNotPhoneNumbers'])


if __name__ == '__main__':
    unittest.main()
