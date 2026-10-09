import unittest
from attest_push_manifest import validate_manifest


def manifest(value=None, package='rs.uskoci.preview', event=True, raw_json=False):
    metadata = '' if value is None else f'<meta-data android:name="firebase_messaging_auto_init_enabled" android:value="{value}"/>'
    if raw_json:
        metadata += '<meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{"expo-channel-name":"preview"}"/>'
    action = '<service android:name="Firebase"><intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT"/></intent-filter></service>' if event else ''
    return f'<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="{package}"><application android:debuggable="false">{metadata}{action}</application></manifest>'


class PushManifestTest(unittest.TestCase):
    def test_valid_compiled_metadata_and_known_quote_rendering(self):
        for raw in [False, True]:
            for value in [None, 'true']:
                self.assertEqual(validate_manifest(manifest(value, raw_json=raw))['package'], 'rs.uskoci.preview')

    def test_disabled_or_unresolved_metadata_never_passes(self):
        for raw in [False, True]:
            for value in ['false', '', '@bool/unknown']:
                with self.assertRaisesRegex(ValueError, 'AUTO_INIT'):
                    validate_manifest(manifest(value, raw_json=raw))

    def test_wrong_package_and_missing_event_fail(self):
        for raw in [False, True]:
            with self.assertRaisesRegex(ValueError, 'PACKAGE'):
                validate_manifest(manifest(package='rs.uskoci', raw_json=raw))
            with self.assertRaisesRegex(ValueError, 'EVENT_MISSING'):
                validate_manifest(manifest(event=False, raw_json=raw))

    def test_event_name_in_metadata_is_not_an_action(self):
        xml = manifest(event=False).replace('</application>', '<meta-data android:name="com.google.firebase.MESSAGING_EVENT" android:value="true"/></application>')
        with self.assertRaisesRegex(ValueError, 'EVENT_MISSING'):
            validate_manifest(xml)

    def test_nested_duplicate_cannot_hide_disabled_application_metadata(self):
        for raw in [False, True]:
            xml = manifest('false', raw_json=raw).replace('</application>', '<service android:name="Other"><meta-data android:name="firebase_messaging_auto_init_enabled" android:value="true"/></service></application>')
            with self.assertRaisesRegex(ValueError, 'AUTO_INIT_DUPLICATE'):
                validate_manifest(xml)

    def test_disabled_nested_metadata_is_also_refused(self):
        xml = manifest().replace('</application>', '<service android:name="Other"><meta-data android:name="firebase_messaging_auto_init_enabled" android:value="false"/></service></application>')
        with self.assertRaisesRegex(ValueError, 'AUTO_INIT_NOT_ENABLED'):
            validate_manifest(xml)

    def test_debuggable_is_refused_with_either_renderer(self):
        for raw in [False, True]:
            with self.assertRaisesRegex(ValueError, 'DEBUGGABLE'):
                validate_manifest(manifest(raw_json=raw).replace('android:debuggable="false"', 'android:debuggable="true"'))


if __name__ == '__main__':
    unittest.main()
