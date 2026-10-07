"""Offline tests of s03_core (EX-07 S03). Run: python -m unittest discover -s supabase/proofs/ex07/s03 -p "test_*.py" """
from __future__ import annotations

import io
import json
import tarfile
import unittest
from pathlib import Path

import s03_core as core

HERE = Path(__file__).resolve().parent
LABELS = core.Labels.load(HERE / 'ui_labels.json')
SHAPES = core.load_json(HERE / 'callback_shapes.json')

JWT_A = 'eyJhbGciOiJIUzI1NiIsImtpZCI6InN5bnRoIn0.eyJzdWIiOiJzeW50aGV0aWMtdXNlci0xIiwic2Vzc2lvbl9pZCI6IjAwMDEifQ.c2lnbmF0dXJlLXN5bnRoZXRpYy0wMDAx'
JWT_B = 'eyJhbGciOiJIUzI1NiIsImtpZCI6InN5bnRoIn0.eyJzdWIiOiJzeW50aGV0aWMtdXNlci0yIiwic2Vzc2lvbl9pZCI6IjAwMDIifQ.c2lnbmF0dXJlLXN5bnRoZXRpYy0wMDAy'


def node(text='', desc='', cls='android.widget.TextView', clickable=False, enabled=True, password=False,
         bounds=(10, 10, 200, 60), pkg=core.PACKAGE, rid='', order=0):
    return core.Node(text=core.norm(text), desc=core.norm(desc), cls=cls, rid=rid, pkg=pkg, clickable=clickable,
                     enabled=enabled, password=password, bounds=bounds, order=order)


def field(label, text='', **kw):
    return node(text=text, desc=label, cls='android.widget.EditText', clickable=True, **kw)


def button(label, **kw):
    return node(desc=label, cls='android.view.ViewGroup', clickable=True, **kw)


class CatalogTests(unittest.TestCase):
    def test_ids_are_unique_and_levels_known(self):
        ids = [c['id'] for c in core.CATALOG]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(c['level'] in ('HTTP', 'EMULATOR') for c in core.CATALOG))
        self.assertTrue(all(c['kind'] in ('assertion', 'observation') for c in core.CATALOG))

    def test_the_required_card_checks_are_all_present(self):
        titles = ' '.join(c['title'].lower() for c in core.CATALOG)
        for needle in ('confirmation', 'used', 'expired', 'wrong', 'another account', 'old', 'logcat', 'private storage',
                       'allowlist', 'fragment'):
            self.assertIn(needle, titles)


class CallbackTests(unittest.TestCase):
    def test_every_shape_in_the_shared_table(self):
        for case in SHAPES['cases']:
            with self.subTest(case['id']):
                info = core.classify_callback(case['url'], SHAPES['redirects'][case['expectedBase']])
                self.assertEqual(info.kind, case['pyKind'])
                self.assertEqual(info.callback_type, case['pyType'])
                self.assertEqual(info.base_matches, case['pyBaseMatches'])
                self.assertEqual(info.tokens_in_query, case['pyTokensInQuery'])

    def test_public_view_never_contains_a_credential(self):
        case = SHAPES['cases'][0]
        info = core.classify_callback(case['url'])
        text = json.dumps(info.public())
        self.assertNotIn('SYNTHACCESSSIGNUP0001', text)
        self.assertNotIn('SYNTHREFRESHSIGNUP1', text)
        self.assertEqual(len(info.public()['credentialFingerprints']), 2)
        self.assertNotIn('SYNTHACCESSSIGNUP0001', repr(info))

    def test_provider_error_is_decoded_and_has_no_secret(self):
        info = core.classify_callback(SHAPES['cases'][4]['url'], SHAPES['redirects']['signup'])
        self.assertEqual((info.error, info.error_code), ('access_denied', 'otp_expired'))
        self.assertEqual(info.error_description, 'Email link is invalid or has expired')
        self.assertEqual(info.secrets, ())

    def test_redirect_evaluation(self):
        allowed = [core.SIGNUP_REDIRECT, core.RECOVERY_REDIRECT]
        ev = core.evaluate_redirect_to
        self.assertEqual(ev(core.SIGNUP_REDIRECT, core.SIGNUP_REDIRECT, allowed), 'EXACT')
        self.assertEqual(ev('http://127.0.0.1:4173', 'https://attacker.example/cb', allowed), 'SITE_URL')
        self.assertEqual(ev('http://127.0.0.1:4173/', 'uskociapp://evil', allowed), 'SITE_URL')
        self.assertEqual(ev('uskociapp://evil', 'uskociapp://evil', allowed), 'FOREIGN_ECHO')
        self.assertEqual(ev(None, 'uskociapp://evil', allowed), 'ABSENT')
        self.assertEqual(ev('https://other.example', 'uskociapp://evil', allowed), 'OTHER')

    def test_gotrue_error_shapes(self):
        self.assertEqual(core.gotrue_error({'code': 400, 'error_code': 'email_not_confirmed', 'msg': 'Email not confirmed'}),
                         ('email_not_confirmed', 'Email not confirmed'))
        self.assertEqual(core.gotrue_error({'error': 'invalid_grant', 'error_description': 'x'}), ('invalid_grant', 'x'))
        self.assertEqual(core.gotrue_error(None), ('', ''))


class LinkTests(unittest.TestCase):
    ENCODED = 'http://127.0.0.1:54321/auth/v1/verify?token=abcDEF123_-xyz&type=signup&redirect_to=uskociapp%3A%2F%2Fauth%3Fform%3Dlogin'
    RAW = 'http://127.0.0.1:54321/auth/v1/verify?token=abcDEF123_-xyz&type=recovery&redirect_to=uskociapp://oporavak'

    def test_parse_encoded_and_raw_redirects(self):
        a = core.parse_verify_link(self.ENCODED)
        self.assertEqual((a.kind, a.redirect_to, a.host, a.port), ('signup', core.SIGNUP_REDIRECT, '127.0.0.1', 54321))
        self.assertEqual(a.token_length, len('abcDEF123_-xyz'))
        b = core.parse_verify_link(self.RAW)
        self.assertEqual((b.kind, b.redirect_to), ('recovery', core.RECOVERY_REDIRECT))
        self.assertNotIn('abcDEF123', json.dumps(a.public()))

    def test_non_verify_urls_and_other_types(self):
        self.assertIsNone(core.parse_verify_link('http://127.0.0.1:54321/auth/v1/other?token=x'))
        other = core.parse_verify_link('http://127.0.0.1:54321/auth/v1/verify?token=abcdefghij&type=magiclink')
        self.assertEqual(other.kind, 'other')
        self.assertIsNone(other.redirect_to)

    def test_extract_from_html_and_text_unescapes_entities(self):
        html_part = '<p><a href="http://127.0.0.1:54321/auth/v1/verify?token=tok12345678&amp;type=signup&amp;redirect_to=uskociapp://auth?form=login">Confirm</a></p>'
        links = core.verify_links({'HTML': html_part, 'Text': ''})
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0].redirect_to, core.SIGNUP_REDIRECT)
        text_only = core.verify_links({'HTML': '', 'Text': 'open this: ' + self.ENCODED + '.'})
        self.assertEqual(len(text_only), 1)
        self.assertEqual(core.verify_links({'HTML': '<a href="https://example.test/x">x</a>'}), [])

    def test_tamper_changes_exactly_the_token_and_swap_changes_the_type(self):
        changed = core.tamper_token(self.ENCODED)
        self.assertNotEqual(changed, self.ENCODED)
        a, b = core.parse_verify_link(self.ENCODED), core.parse_verify_link(changed)
        self.assertEqual((a.token_length, a.kind, a.redirect_to), (b.token_length, b.kind, b.redirect_to))
        # a token already ending in A is changed to B (never left equal)
        same = self.ENCODED.replace('abcDEF123_-xyz', 'abcDEF123_-xyA')
        self.assertNotEqual(core.tamper_token(same), same)
        swapped = core.swap_link_type(self.ENCODED, 'recovery')
        self.assertEqual(core.parse_verify_link(swapped).kind, 'recovery')
        self.assertEqual(core.parse_verify_link(swapped).redirect_to, core.SIGNUP_REDIRECT)
        with self.assertRaises(ValueError):
            core.tamper_token('http://127.0.0.1:54321/auth/v1/verify?type=signup')

    def test_messages_to_is_case_insensitive_and_newest_first(self):
        listing = {'messages': [
            {'ID': '1', 'To': [{'Address': 'A@example.test'}], 'Created': '2026-10-02T10:00:00Z'},
            {'ID': '2', 'To': [{'Address': 'b@example.test'}], 'Created': '2026-10-02T10:01:00Z'},
            {'ID': '3', 'To': [{'Address': 'a@example.test'}], 'Created': '2026-10-02T10:02:00Z'}]}
        self.assertEqual([m['ID'] for m in core.messages_to(listing, 'a@EXAMPLE.test')], ['3', '1'])
        self.assertEqual(core.message_ids(listing), ['1', '2', '3'])


class SecretTests(unittest.TestCase):
    def test_jwt_header_is_never_a_needle(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        header = JWT_A.split('.')[0]
        self.assertEqual(secrets.find_in_text('Authorization header ' + header + ' only'), [])
        self.assertEqual(secrets.find_in_text('x ' + JWT_B + ' y'), [])        # another session, same header
        hit = secrets.find_in_text('log: token=' + JWT_A + ' end')
        self.assertEqual(len(hit), 1)
        self.assertTrue(hit[0].startswith('access_token:'))

    def test_payload_or_signature_fragments_are_found(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        payload = JWT_A.split('.')[1]
        self.assertEqual(len(secrets.find_in_text('..' + payload + '..')), 1)
        self.assertEqual(len(secrets.find_in_bytes(b'blob ' + JWT_A.split('.')[2].encode() + b' blob')), 1)

    def test_word_boundaries_prevent_substring_false_positives(self):
        secrets = core.SecretSet()
        secrets.add('refresh_token', 'abcdefghijkl')
        self.assertEqual(secrets.find_in_text('xabcdefghijkl'), [])
        self.assertEqual(secrets.find_in_text('abcdefghijklx'), [])
        self.assertEqual(len(secrets.find_in_text('refresh=abcdefghijkl&x')), 1)
        self.assertEqual(len(secrets.find_in_bytes(b'\x00abcdefghijkl\x00')), 1)
        self.assertEqual(secrets.find_in_bytes(b'abcdefghijklm'), [])

    def test_short_values_are_ignored(self):
        secrets = core.SecretSet()
        secrets.add('refresh_token', 'short')
        secrets.add('x', None)
        self.assertEqual(len(secrets), 0)

    def test_redact_removes_known_and_generic_credentials(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        text = 'got ' + JWT_A + ' and uskociapp://oporavak#access_token=zzzzzzzzzzzz&type=recovery and ' + JWT_B
        out = secrets.redact(text)
        self.assertNotIn(JWT_A, out)
        self.assertNotIn('zzzzzzzzzzzz', out)
        self.assertNotIn(JWT_B.split('.')[1], out)
        self.assertIn('[secret:access_token:', out)

    def test_redact_generic_covers_verify_tokens_and_params(self):
        out = core.redact_generic('GET /auth/v1/verify?token=abcdef123456&type=signup refresh_token=rrrrrrrrrrrr')
        self.assertNotIn('abcdef123456', out)
        self.assertNotIn('rrrrrrrrrrrr', out)

    def test_sanitize_exception_redacts_and_truncates(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        text = core.sanitize_exception(RuntimeError('boom ' + JWT_A), secrets)
        self.assertNotIn(JWT_A, text)
        self.assertTrue(text.startswith('RuntimeError: boom'))
        self.assertLessEqual(len(core.sanitize_exception(RuntimeError('x' * 1000))), 240)

    def test_add_callback_collects_both_tokens_with_stable_fingerprints(self):
        info = core.classify_callback(SHAPES['cases'][1]['url'])
        secrets = core.SecretSet()
        secrets.add_callback(info)
        self.assertEqual(len(secrets), 2)
        self.assertEqual(len(secrets.find_in_text('x SYNTHACCESSRECOVERY01 y SYNTHREFRESHRECOVER1')), 2)

    def test_tar_scan_finds_a_credential_inside_a_binary_member_and_lists_only_the_path(self):
        secrets = core.SecretSet()
        secrets.add('refresh_token', 'SYNTHREFRESHTARTEST1')
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode='w') as tf:
            for name, data in (('databases/AsyncStorage-wal', b'\x00\x01 SYNTHREFRESHTARTEST1 \x02'), ('files/clean.txt', b'nothing here')):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                tf.addfile(info, io.BytesIO(data))
        buffer.seek(0)
        out = core.scan_tar_stream(buffer, secrets)
        self.assertEqual(out['files'], 2)
        self.assertEqual([m['path'] for m in out['matches']], ['databases/AsyncStorage-wal'])
        self.assertNotIn('SYNTHREFRESHTARTEST1', json.dumps(out))


class LogcatTests(unittest.TestCase):
    def test_matches_report_tags_never_text(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        log = '\n'.join([
            '10-02 12:00:00.123  1234  1250 I ReactNativeJS: Running "main"',
            '10-02 12:00:01.000  1234  1250 W ReactNativeJS: leaked ' + JWT_A,
            '10-02 12:00:02.000   800   900 I ActivityTaskManager: START u0 {dat=uskociapp://oporavak cmp=x}',
            '10-02 12:00:03.000  1234  1250 E AndroidRuntime: FATAL EXCEPTION: main',
            '10-02 12:00:04.000   800   900 E ActivityManager: ANR in ' + core.PACKAGE + ' (x)'])
        out = core.scan_logcat(log, secrets)
        self.assertEqual(out['matches'], 1)
        self.assertEqual(out['tags'], ['ReactNativeJS'])
        self.assertEqual(out['fatalLines'], 1)
        self.assertEqual(out['anrLines'], 1)
        self.assertNotIn(JWT_A, json.dumps(out))

    def test_clean_log(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        out = core.scan_logcat('10-02 12:00:00.123  1  2 I Tag: nothing\n', secrets)
        self.assertEqual((out['matches'], out['credentials']), (0, []))


XML = '''<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="rs.uskoci.ex07s03proof" content-desc="" clickable="false" enabled="true" password="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Prijavi se" resource-id="" class="android.widget.TextView" package="rs.uskoci.ex07s03proof" content-desc="" clickable="false" enabled="true" password="false" bounds="[100,100][300,160]" />
    <node index="1" text="" resource-id="" class="android.view.ViewGroup" package="rs.uskoci.ex07s03proof" content-desc="Prijavi se" clickable="true" enabled="true" password="false" bounds="[100,2000][980,2100]" />
    <node index="2" text="&#8226;&#8226;&#8226;&#8226;" resource-id="" class="android.widget.EditText" package="rs.uskoci.ex07s03proof" content-desc="Lozinka" clickable="true" enabled="true" password="true" bounds="[100,500][980,600]" />
    <node index="3" text="" resource-id="android:id/navigationBarBackground" class="android.view.View" package="com.android.systemui" content-desc="" clickable="false" enabled="true" password="false" bounds="[0,2274][1080,2400]" />
  </node>
</hierarchy>'''


class ScreenTests(unittest.TestCase):
    def test_parse_dump_and_pick_the_clickable_topmost_target(self):
        nodes = core.parse_ui_dump('UI hierarchy dumped to: x\n' + XML + '\nmore')
        self.assertEqual(len(nodes), 5)
        target = core.find_target(nodes, 'Prijavi se')
        self.assertTrue(target.clickable)                       # the button, not the title with the same words
        self.assertEqual(target.bounds, (100, 2000, 980, 2100))
        pw = core.find_target(nodes, 'Lozinka', field=True)
        self.assertTrue(pw.password)
        self.assertIsNone(core.find_target(nodes, 'Lozinka'))   # a field label is not a plain text
        self.assertEqual(core.navigation_bar_top(nodes), 2274)

    def test_dtd_is_refused(self):
        with self.assertRaises(ValueError):
            core.parse_ui_dump('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><hierarchy><node text="&a;"/></hierarchy>')

    def test_topmost_among_equals_and_disabled_or_offscreen_are_skipped(self):
        under = button('Prijavi se', bounds=(0, 0, 100, 100), order=1)
        over = button('Prijavi se', bounds=(0, 200, 100, 300), order=2)
        off = button('Prijavi se', bounds=(0, 5000, 100, 5100), order=3)
        dead = button('Prijavi se', bounds=(0, 400, 100, 500), enabled=False, order=4)
        self.assertEqual(core.find_target([under, over, off, dead], 'Prijavi se', screen=(1080, 2400)), over)

    def test_contains_and_exact_matching(self):
        n = node(text='Zahtev za novu potvrdu je prihvaćen. Proveri email i neželjenu poštu.')
        self.assertTrue(core.node_matches(n, 'Zahtev za novu potvrdu je prihvaćen.', 'contains'))
        self.assertFalse(core.node_matches(n, 'Zahtev za novu potvrdu je prihvaćen.', 'exact'))
        self.assertTrue(core.node_matches(node(text='  Proveri \n email '), 'Proveri email'))
        self.assertFalse(core.node_matches(node(text='x'), ''))

    def test_tap_point_stays_above_the_navigation_bar_and_inside_the_screen(self):
        self.assertEqual(core.tap_point((100, 2000, 980, 2100), (1080, 2400)), (540, 2050))
        x, y = core.tap_point((100, 2200, 980, 2400), (1080, 2400), nav_top=2274)
        self.assertEqual(x, 540)
        self.assertLess(y, 2274)
        self.assertGreaterEqual(y, 2200)
        with self.assertRaises(ValueError):
            core.tap_point((0, 2300, 100, 2400), (1080, 2400), nav_top=2274)

    def test_wm_size_and_ime(self):
        self.assertEqual(core.parse_wm_size('Physical size: 1080x2400\nOverride size: 1080x2340'), (1080, 2340))
        self.assertIsNone(core.parse_wm_size('nothing'))
        self.assertTrue(core.parse_ime_shown('mShowRequested=true mInputShown=true'))
        self.assertFalse(core.parse_ime_shown('x mInputShown=false y'))
        self.assertIsNone(core.parse_ime_shown('no such line'))

    def _screen(self, *nodes):
        return core.classify_screen(list(nodes), LABELS)

    def test_classification_of_every_auth_surface(self):
        t = LABELS.text
        self.assertEqual(self._screen(field(t('login.field.email')), field(t('login.field.password')), node(text=t('login.forgot'))), 'LOGIN_FORM')
        self.assertEqual(self._screen(field('Ime'), field('Prezime'), field('Grad'), field('Email'), field('Lozinka')), 'SIGNUP_FORM')
        self.assertEqual(self._screen(node(text='Proveri email'), button(t('confirm.back')), node(text=t('confirm.resend'))), 'CONFIRMATION_STAGE')
        self.assertEqual(self._screen(node(text='Proveri email'), button(t('recovery.sent.again'))), 'RECOVERY_SENT')
        self.assertEqual(self._screen(field('Email'), button(t('recovery.request.submit'))), 'RECOVERY_REQUEST')
        self.assertEqual(self._screen(field(t('oporavak.field.new')), field(t('oporavak.field.confirm'))), 'OPORAVAK_FORM')
        self.assertEqual(self._screen(node(text='Lozinka je promenjena.')), 'OPORAVAK_SUCCESS')
        self.assertEqual(self._screen(node(text='Link je nevažeći ili je istekao. Zatraži novi link.')), 'OPORAVAK_INVALID')
        self.assertEqual(self._screen(node(text='Najpre se odjavi sa otvorenog naloga, pa ponovo otvori link za oporavak.')), 'OPORAVAK_SIGNED_IN')
        self.assertEqual(self._screen(node(text='Proveravamo link za oporavak…')), 'OPORAVAK_VERIFYING')
        self.assertEqual(self._screen(node(text='Zadaci')), 'OTHER')
        self.assertEqual(self._screen(), 'OTHER')

    def test_a_signup_form_is_not_mistaken_for_login(self):
        nodes = [field('Ime'), field('Prezime'), field('Email'), field('Lozinka')]
        self.assertEqual(core.classify_screen(nodes, LABELS), 'SIGNUP_FORM')

    def test_leak_scan_of_visible_text(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        clean = [node(text='Prijavi se'), node(text='Email')]
        self.assertEqual(core.scan_nodes_for_leaks(clean, secrets, ['invalid or has expired']), [])
        dirty = [node(text='error: ' + JWT_A), node(text='Email link is invalid or has expired'), node(text='access_token=1')]
        found = core.scan_nodes_for_leaks(dirty, secrets, ['invalid or has expired'])
        self.assertEqual(len(found), 3)

    def test_visible_texts_skip_password_fields(self):
        texts = core.visible_texts([node(text='abc'), node(text='secret', password=True), node(desc='Email')])
        self.assertEqual(texts, ['abc', 'Email'])


class StorageTests(unittest.TestCase):
    def test_session_rows_become_fingerprints_only(self):
        rows = [('sb-10-auth-token', json.dumps({'access_token': JWT_A, 'refresh_token': 'refreshrefresh1', 'user': {'id': 'user-1'}})),
                ('other', 'x'), ('sb-10-auth-token-code-verifier', 'v')]
        out = core.parse_auth_storage(rows)
        self.assertTrue(out['hasSession'])
        self.assertEqual(out['userIds'], ['user-1'])
        self.assertEqual(out['rows'], 3)
        s = out['sessions'][0]
        self.assertEqual(s.access_fp, core.fingerprint(JWT_A))
        self.assertNotIn(JWT_A, repr(out))

    def test_no_session_and_corrupt_value(self):
        self.assertFalse(core.parse_auth_storage([('a', 'b')])['hasSession'])
        out = core.parse_auth_storage([('sb-10-auth-token', '{not json')])
        self.assertFalse(out['hasSession'])
        self.assertEqual(len(out['sessions']), 1)


class GuardTests(unittest.TestCase):
    def test_only_an_emulator_may_be_driven(self):
        self.assertTrue(core.is_emulator('emulator-5554', {'ro.kernel.qemu': '1'}))
        self.assertTrue(core.is_emulator('emulator-5554', {'ro.hardware': 'ranchu'}))
        self.assertFalse(core.is_emulator('A8QDVB6522001205', {'ro.kernel.qemu': '1'}))     # a phone serial, whatever it claims
        self.assertFalse(core.is_emulator('emulator-5554', {'ro.hardware': 'qcom'}))
        self.assertFalse(core.is_emulator('', {}))

    def test_clear_needs_every_condition(self):
        env = {'EX07_S03_ALLOW_CLEAR': '1', 'GITHUB_ACTIONS': 'true'}
        self.assertTrue(core.may_clear_app_data('emulator-5554', core.PACKAGE, env))
        self.assertFalse(core.may_clear_app_data('emulator-5554', 'rs.uskoci.dev', env))
        self.assertFalse(core.may_clear_app_data('A8QDVB6522001205', core.PACKAGE, env))
        self.assertFalse(core.may_clear_app_data('emulator-5554', core.PACKAGE, {'GITHUB_ACTIONS': 'true'}))
        self.assertFalse(core.may_clear_app_data('emulator-5554', core.PACKAGE, {'EX07_S03_ALLOW_CLEAR': '1'}))

    def test_uid_parse(self):
        self.assertEqual(core.parse_package_uid('package:rs.uskoci.ex07s03proof uid:10201\n'), 10201)
        self.assertIsNone(core.parse_package_uid('package:other uid:1'))


class ReportTests(unittest.TestCase):
    def test_unrecorded_assertions_are_not_run_and_the_result_is_partial(self):
        rep = core.Report('HTTP', {'source': {'head': 'abc', 'runId': '7'}})
        rep.expect('P01', True, 'ok')
        out = rep.finalize()
        self.assertEqual(out['result'], 'PARTIAL')
        self.assertEqual(out['counts']['PASS'], 1)
        self.assertEqual(next(a for a in out['assertions'] if a['id'] == 'P02')['status'], 'NOT_RUN')
        self.assertEqual([a['id'] for a in out['assertions']][:3], ['P01', 'P02', 'P03'])
        self.assertTrue(all(a['id'].startswith('P') for a in out['assertions']))

    def test_all_pass_is_pass_and_a_fail_is_findings_even_with_errors(self):
        rep = core.Report('HTTP')
        for c in core.CATALOG:
            if c['level'] == 'HTTP':
                rep.record(c['id'], 'PASS' if c['kind'] == 'assertion' else 'OBSERVATION')
        self.assertEqual(rep.finalize()['result'], 'PASS')
        rep.record('P05', 'ERROR', 'x')
        self.assertEqual(rep.finalize()['result'], 'HARNESS_BROKEN')
        rep.record('P06', 'FAIL', 'y')
        self.assertEqual(rep.finalize()['result'], 'FINDINGS')

    def test_repeated_recording_keeps_the_worst_status_and_merges_detail(self):
        rep = core.Report('EMULATOR')
        rep.record('E10', 'PASS', 'refused', a=1)
        rep.record('E10', 'FAIL', 'password changed', b=2)
        rep.record('E10', 'PASS', 'again')
        row = rep.results['E10']
        self.assertEqual(row['status'], 'FAIL')
        self.assertIn('refused', row['detail'])
        self.assertIn('password changed', row['detail'])
        self.assertEqual(row['observed'], {'a': 1, 'b': 2})

    def test_observations_never_become_pass_or_fail(self):
        rep = core.Report('HTTP')
        rep.record('P14', 'PASS', 'x')
        rep.record('P09b', 'FAIL', 'y')
        self.assertEqual(rep.results['P14']['status'], 'OBSERVATION')
        self.assertEqual(rep.results['P09b']['status'], 'OBSERVATION')

    def test_details_are_redacted_and_unknown_ids_refused(self):
        secrets = core.SecretSet()
        secrets.add('access_token', JWT_A)
        rep = core.Report('HTTP', secrets=secrets)
        rep.record('P05', 'FAIL', 'leak ' + JWT_A)
        self.assertNotIn(JWT_A, json.dumps(rep.finalize()))
        with self.assertRaises(KeyError):
            rep.record('P99', 'PASS')
        with self.assertRaises(ValueError):
            rep.record('P01', 'GREAT')

    def test_error_records_a_sanitized_exception(self):
        rep = core.Report('HTTP')
        rep.error('P01', RuntimeError('boom'))
        self.assertEqual(rep.results['P01']['status'], 'ERROR')
        self.assertIn('RuntimeError: boom', rep.results['P01']['detail'])

    def test_result_line_carries_head_run_and_label(self):
        rep = core.Report('EMULATOR', {'source': {'head': 'deadbeef', 'runId': '42'}})
        line = core.result_line(rep.finalize())
        self.assertIn('head=deadbeef', line)
        self.assertIn('run=42', line)
        self.assertIn('label="DISPOSABLE EMULATOR evidence"', line)
        self.assertIn('RESULT EMULATOR PARTIAL', line)

    def test_merge_evidence_missing_report_is_harness_broken_and_claims_are_honest(self):
        http = core.Report('HTTP')
        for c in core.CATALOG:
            if c['level'] == 'HTTP':
                http.record(c['id'], 'PASS' if c['kind'] == 'assertion' else 'OBSERVATION')
        merged = core.merge_evidence({'HTTP': http.finalize(), 'EMULATOR': None}, {'head': 'abc', 'runId': '1'})
        self.assertEqual(merged['result'], 'HARNESS_BROKEN')
        self.assertEqual(merged['label'], 'DISPOSABLE EMULATOR evidence')
        self.assertFalse(merged['claims']['realProvider'])
        self.assertFalse(merged['claims']['physicalHandset'])
        self.assertFalse(merged['claims']['hostedAuthDashboardAllowlistChecked'])
        emu = [a for a in merged['assertions'] if a['id'].startswith('E')]
        self.assertTrue(emu and all(a['status'] == 'NOT_RUN' for a in emu))
        both = core.merge_evidence({'HTTP': http.finalize(), 'EMULATOR': {'result': 'FINDINGS', 'counts': {}, 'assertions': []}}, {})
        self.assertEqual(both['result'], 'FINDINGS')
        self.assertEqual(core.worst_result(['PASS', 'PARTIAL']), 'PARTIAL')


if __name__ == '__main__':
    unittest.main()
