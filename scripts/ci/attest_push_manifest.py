"""Validate the actual compiled manifest, including apkanalyzer's known raw-JSON quote output."""
import re
import sys
from pathlib import Path
from attest_ota_preview import _manifest_fields, require


def validate_manifest(xml):
    identity, metadata = _manifest_fields(xml)
    require(identity['package'] == 'rs.uskoci.preview', 'WRONG_PUSH_PROOF_PACKAGE')
    require(identity['debuggable'] == 'false', 'PUSH_PROOF_DEBUGGABLE')
    # Preserve the former fail-closed check across every scope. The OTA fallback
    # returns a dictionary; a nested duplicate must not overwrite app-level false.
    auto_init = [tag for tag in re.findall(r'<meta-data\b[^>]*>', xml, re.DOTALL)
                 if re.search(r'\bandroid:name="firebase_messaging_auto_init_enabled"', tag)]
    require(len(auto_init) <= 1, 'PUSH_PROOF_AUTO_INIT_DUPLICATE')
    for tag in auto_init:
        require(re.search(r'\bandroid:value="true"(?:\s|/|>)', tag), 'PUSH_PROOF_AUTO_INIT_NOT_ENABLED')
    require(metadata.get('firebase_messaging_auto_init_enabled') in (None, 'true'), 'PUSH_PROOF_AUTO_INIT_NOT_ENABLED')
    require(re.search(r'<action\b[^>]*\bandroid:name="com\.google\.firebase\.MESSAGING_EVENT"(?:\s|/|>)', xml),
            'PUSH_PROOF_MESSAGING_EVENT_MISSING')
    return identity


if __name__ == '__main__':
    validate_manifest(Path(sys.argv[1]).read_text(encoding='utf-8'))
    print('PASS compiled push-proof manifest package, release mode, Firebase event and auto-init')
