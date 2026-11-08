#!/usr/bin/env python3
"""Execute the actual QA workflow guards with local fixtures.

The installed Expo template supplies the real wrapper bytes. Bootstrap commands
use inert local executables: no download, Android build, CI or device proof.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / '.github/workflows/uskoci-qa-apk.yml').read_text()
PREPARE = 'Prepare pinned Gradle distribution with bounded retry'
BUILD = 'Build standalone installable release JS bundle and APK'
UPLOAD = 'Upload installable APK and bounded receipt'
ATTEST = 'Attest isolated APK and source identity'
SHA256 = 'b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06'


def step_span(text: str, name: str) -> tuple[int, int]:
    matches = list(re.finditer(r'^      - name: ' + re.escape(name) + r'\n', text, re.M))
    if len(matches) != 1:
        raise AssertionError(f'Expected one workflow step: {name}')
    start, end = matches[0].span()
    for line in text[end:].splitlines(keepends=True):
        if line.strip() and not line.startswith('        '):
            break
        end += len(line)
    return start, end


def actual_scripts() -> tuple[str, str]:
    start, end = step_span(WORKFLOW, PREPARE)
    lines = WORKFLOW[start:end].splitlines()
    run = lines.index('        run: |')
    body = []
    for line in lines[run + 1:]:
        if line.strip() and not line.startswith('          '):
            raise AssertionError('Unexpected workflow run indentation')
        body.append(line[10:] if line.strip() else '')
    begin = body.index("python - <<'PY'")
    finish = body.index('PY', begin + 1)
    return ('\n'.join(body[begin + 1:finish]) + '\n',
            '\n'.join(body[:begin] + body[finish + 1:]) + '\n')


PREPARE_PYTHON, BOOTSTRAP_BASH = actual_scripts()


def properties(text: str) -> dict[str, str]:
    return dict(line.split('=', 1) for line in text.splitlines() if '=' in line and not line.lstrip().startswith('#'))


class DistributionPreparation(unittest.TestCase):
    def setUp(self):
        self.fixture = tempfile.TemporaryDirectory(prefix='uskoci-gradle-prep-')
        self.addCleanup(self.fixture.cleanup)
        self.root = Path(self.fixture.name)
        self.wrapper = self.root / 'android/gradle/wrapper'
        self.wrapper.mkdir(parents=True)
        with tarfile.open(ROOT / 'node_modules/expo/template.tgz', 'r:gz') as template:
            for name in ('gradle-wrapper.properties', 'gradle-wrapper.jar'):
                member = template.extractfile('package/android/gradle/wrapper/' + name)
                if member is None:
                    raise AssertionError('Expo wrapper file missing: ' + name)
                (self.wrapper / name).write_bytes(member.read())
        self.props = self.wrapper / 'gradle-wrapper.properties'
        self.jar = self.wrapper / 'gradle-wrapper.jar'

    def prepare(self):
        return subprocess.run([sys.executable, '-c', PREPARE_PYTHON], cwd=self.root,
                              capture_output=True, text=True, timeout=10)

    def refused_without_mutation(self, code):
        before = (self.props.read_bytes(), self.jar.read_bytes())
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(code, result.stderr)
        self.assertEqual((self.props.read_bytes(), self.jar.read_bytes()), before)

    def test_real_expo_template_pins_same_distribution_and_preserves_other_properties(self):
        original = self.props.read_text()
        for existing_checksum in (False, True):
            with self.subTest(existing_checksum=existing_checksum):
                self.props.write_text(original + ('\ndistributionSha256Sum=' + SHA256 + '\n' if existing_checksum else ''))
                result = self.prepare()
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                actual = properties(self.props.read_text())
                expected = properties(original)
                expected['distributionUrl'] = r'https\://downloads.gradle.org/distributions/gradle-9.3.1-bin.zip'
                expected['distributionSha256Sum'] = SHA256
                self.assertEqual(actual, expected)
                self.assertEqual(self.props.read_text().count('distributionSha256Sum='), 1)

    def test_wrong_distribution_is_refused_before_mutation(self):
        self.props.write_text(self.props.read_text().replace('gradle-9.3.1-bin.zip', 'gradle-9.3.2-bin.zip'))
        self.refused_without_mutation('UNEXPECTED_GRADLE_DISTRIBUTION')

    def test_wrong_existing_checksum_is_refused_before_mutation(self):
        self.props.write_text(self.props.read_text() + '\ndistributionSha256Sum=' + '0' * 64 + '\n')
        self.refused_without_mutation('UNEXPECTED_GRADLE_CHECKSUM')

    def test_tampered_actual_wrapper_jar_is_refused_before_mutation(self):
        self.jar.write_bytes(self.jar.read_bytes() + b'fixture tampering')
        self.refused_without_mutation('UNEXPECTED_GRADLE_WRAPPER')

    def test_disabled_url_validation_is_refused_before_mutation(self):
        self.props.write_text(self.props.read_text().replace('validateDistributionUrl=true', 'validateDistributionUrl=false'))
        self.refused_without_mutation('GRADLE_URL_VALIDATION_REQUIRED')


def executable(path: Path, source: str):
    path.write_text('#!' + sys.executable + '\n' + source)
    path.chmod(0o755)


def read_trace(path: Path):
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def bootstrap(outcomes):
    with tempfile.TemporaryDirectory(prefix='uskoci-gradle-bootstrap-') as directory:
        root = Path(directory)
        (root / 'android').mkdir()
        (root / 'bin').mkdir()
        (root / 'runner-temp').mkdir()
        (root / 'outcomes.json').write_text(json.dumps(outcomes))
        # Each invocation is observable; only --version is allowed. This cannot
        # build the application or execute the extracted real wrapper JAR.
        executable(root / 'android/gradlew', '''import json, os, sys
from pathlib import Path
root = Path(os.environ['USKOCI_BOOTSTRAP_FIXTURE'])
trace = root / 'gradle.jsonl'
index = len(trace.read_text().splitlines()) if trace.exists() else 0
with trace.open('a') as out: out.write(json.dumps(sys.argv[1:]) + '\\n')
if sys.argv[1:] != ['--version']:
    print('Unexpected Gradle task in bootstrap fixture')
    sys.exit(91)
values = json.loads((root / 'outcomes.json').read_text())
result = values[min(index, len(values) - 1)]
print(result['message'])
sys.exit(result['exit'])
''')
        executable(root / 'bin/timeout', '''import json, os, subprocess, sys
from pathlib import Path
root = Path(os.environ['USKOCI_BOOTSTRAP_FIXTURE'])
args = sys.argv[1:]
with (root / 'timeout.jsonl').open('a') as out: out.write(json.dumps(args) + '\\n')
while args and args[0].startswith('-'): args = args[1:]
if not args: sys.exit(92)
# Consume the requested duration without waiting; the child supplies deterministic
# exit codes including 124. The test separately checks timeout and kill bounds.
args = args[1:]
sys.exit(subprocess.run(args, check=False).returncode)
''')
        executable(root / 'bin/sleep', '''import json, os, sys
from pathlib import Path
with (Path(os.environ['USKOCI_BOOTSTRAP_FIXTURE']) / 'sleep.jsonl').open('a') as out:
    out.write(json.dumps(sys.argv[1:]) + '\\n')
''')
        environment = dict(os.environ, USKOCI_BOOTSTRAP_FIXTURE=str(root), RUNNER_TEMP=str(root / 'runner-temp'))
        environment['PATH'] = str(root / 'bin') + os.pathsep + environment.get('PATH', '')
        result = subprocess.run(['bash', '-c', BOOTSTRAP_BASH], cwd=root, env=environment,
                                capture_output=True, text=True, timeout=10)
        return result, read_trace(root / 'gradle.jsonl'), read_trace(root / 'timeout.jsonl'), read_trace(root / 'sleep.jsonl')


class BoundedBootstrap(unittest.TestCase):
    def check_invocations(self, calls, timeouts, count):
        self.assertEqual(calls, [['--version']] * count)
        self.assertEqual(timeouts, [['--kill-after=10s', '180s', './gradlew', '--version']] * count)

    def test_transient_provider_failure_then_success_retries_only_bootstrap(self):
        for status in (429, 503, 504):
            with self.subTest(status=status):
                result, calls, timeouts, sleeps = bootstrap([
                    {'exit': 1, 'message': f'Server returned HTTP response code: {status} for URL: synthetic'},
                    {'exit': 0, 'message': 'Gradle 9.3.1'},
                ])
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.check_invocations(calls, timeouts, 2)
                self.assertEqual(sleeps, [['2']])

    def test_checksum_jvm_and_nontransient_http_fail_immediately(self):
        for message in ('Verification of Gradle distribution failed! SHA-256 mismatch',
                        'UnsupportedClassVersionError: incompatible JVM',
                        'Server returned HTTP response code: 404 for URL: synthetic'):
            with self.subTest(message=message):
                result, calls, timeouts, sleeps = bootstrap([{'exit': 42, 'message': message}])
                self.assertEqual(result.returncode, 42, result.stdout + result.stderr)
                self.check_invocations(calls, timeouts, 1)
                self.assertEqual(sleeps, [])

    def test_three_transient_failures_stop_without_an_application_build(self):
        result, calls, timeouts, sleeps = bootstrap([{'exit': 1, 'message': 'HTTP response code: 503'}])
        self.assertNotEqual(result.returncode, 0)
        self.check_invocations(calls, timeouts, 3)
        self.assertEqual(sleeps, [['2'], ['4']])

    def test_timeout_status_124_is_bounded_to_three_attempts(self):
        result, calls, timeouts, sleeps = bootstrap([{'exit': 124, 'message': 'synthetic timeout exit'}])
        self.assertNotEqual(result.returncode, 0)
        self.check_invocations(calls, timeouts, 3)
        self.assertEqual(sleeps, [['2'], ['4']])


NODE_GUARD = r'''
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const filename = path.resolve('scripts/verify-native-patches.cjs');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
// Test-only export from the actual source; no verifier implementation is copied.
loaded._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.testQaWorkflow = checkQaApkWorkflow;', filename);
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const problems = [];
loaded.exports.testQaWorkflow(loaded.exports.workflowCode(input), (code, message) => problems.push({code, message}));
process.stdout.write(JSON.stringify(problems));
'''


def guard(workflow):
    result = subprocess.run(['node', '-e', NODE_GUARD], input=json.dumps(workflow), cwd=ROOT,
                            capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    return [problem['code'] for problem in json.loads(result.stdout)]


def conditional(text, name):
    start, _ = step_span(text, name)
    end = text.index('\n', start)
    return text[:end] + '\n        if: false' + text[end:]


class ActualWorkflowGuard(unittest.TestCase):
    def test_real_workflow_accepts_separate_bootstrap_source_artifacts_and_apk(self):
        self.assertEqual(guard(WORKFLOW), [])

    def test_conditional_application_build_is_not_hidden_by_bootstrap(self):
        self.assertIn('WORKFLOW_PATCH_STEP_CONDITIONAL', guard(conditional(WORKFLOW, BUILD)))

    def test_missing_application_build_is_not_replaced_by_bootstrap(self):
        start, end = step_span(WORKFLOW, BUILD)
        self.assertIn('WORKFLOW_APK_VERIFY_STEP', guard(WORKFLOW[:start] + WORKFLOW[end:]))

    def test_apk_upload_before_attestation_is_refused(self):
        start, end = step_span(WORKFLOW, UPLOAD)
        upload = WORKFLOW[start:end]
        remaining = WORKFLOW[:start] + WORKFLOW[end:]
        before, _ = step_span(remaining, ATTEST)
        changed = remaining[:before] + upload + remaining[before:]
        self.assertIn('WORKFLOW_APK_ATTESTATION_ORDER', guard(changed))

    def test_conditional_apk_upload_is_not_hidden_by_source_uploads(self):
        self.assertIn('WORKFLOW_PATCH_STEP_CONDITIONAL', guard(conditional(WORKFLOW, UPLOAD)))


if __name__ == '__main__':
    unittest.main(verbosity=2)
