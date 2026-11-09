'use strict';

// The manual phone target exists only to update an installed template-debug
// preview without losing its data. It is never EAS or Play signing.
const DEBUG_CERTIFICATE_SHA256 = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';

function selectTestCandidate({ target = 'isolated-qa', eventName, previewEnvironment }) {
  if (!['isolated-qa', 'phone-preview'].includes(target)) throw new Error('UNKNOWN_ANDROID_TEST_TARGET');
  const phone = target === 'phone-preview';
  if (phone && eventName !== 'workflow_dispatch') throw new Error('PHONE_PREVIEW_REQUIRES_EXPLICIT_MANUAL_DISPATCH');
  return {
    target,
    package: phone ? 'rs.uskoci.preview' : 'rs.uskoci.preview.qa',
    name: phone ? 'USKOČI' : 'USKOČI • QA',
    filenamePrefix: phone ? 'USKOCI-PHONE-PREVIEW' : 'USKOCI-QA',
    firebaseConfigured: phone,
    updatesEnabled: false,
    expectedCertificateSha256: DEBUG_CERTIFICATE_SHA256,
    environment: { ...previewEnvironment, USKOCI_PUSH_PROOF_BUILD: phone ? '1' : '0',
      EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: phone ? '1' : '0', USKOCI_PHONE_PREVIEW_BUILD: phone ? '1' : '0' },
  };
}

module.exports = { selectTestCandidate, DEBUG_CERTIFICATE_SHA256 };
