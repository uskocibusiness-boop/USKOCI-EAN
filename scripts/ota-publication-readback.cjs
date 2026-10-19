'use strict';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function expectedPublication(sourceSha, runId) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || !/^\d+$/.test(String(runId || '')))
    throw new Error('OTA_READBACK_EXPECTATION_INVALID');
  return { sourceSha, message: `DEV Android preview ${sourceSha} run ${runId}`,
    branch: 'preview', runtimeVersion: 'uskoci-v1-preview-r1', platform: 'android' };
}

/** update:list is presentation data: its message may include quotes/age/author.
 * It selects one candidate only. It never establishes publication identity. */
function selectPublicationGroup(list, expected) {
  if (!Array.isArray(list?.currentPage)) throw new Error('OTA_READBACK_LIST_INVALID');
  const quoted = JSON.stringify(expected.message);
  const matchesMessage = message => typeof message === 'string' && (message === expected.message
    || message.startsWith(`${quoted} (`) && /^\([^\r\n]*\)$/.test(message.slice(quoted.length + 1)));
  const rows = list.currentPage.filter(row => row && UUID.test(row.group || '')
    && row.branch === expected.branch && row.runtimeVersion === expected.runtimeVersion
    && row.platforms === expected.platform && row.isRollBackToEmbedded === false
    && matchesMessage(row.message));
  if (rows.length !== 1) throw new Error(rows.length ? 'OTA_READBACK_GROUP_AMBIGUOUS' : 'OTA_READBACK_GROUP_MISSING');
  return rows[0].group;
}

/** update:view is raw structured evidence. Do not trim, parse decoration, or
 * infer any identity field here; each field must match the checked release. */
function verifyPublicationView(view, group, expected) {
  if (!UUID.test(group || '') || !Array.isArray(view) || view.length !== 1)
    throw new Error('OTA_READBACK_VIEW_MISSING_OR_AMBIGUOUS');
  const row = view[0];
  if (!row || !UUID.test(row.id || '') || row.group !== group
    || row.message !== expected.message || row.gitCommitHash !== expected.sourceSha
    || row.branch !== expected.branch || row.runtimeVersion !== expected.runtimeVersion
    || row.platform !== expected.platform || row.isRollBackToEmbedded !== false)
    throw new Error('OTA_READBACK_PUBLICATION_IDENTITY_MISMATCH');
  // Explicit allowlist: never copy manifestPermalink or arbitrary provider fields.
  return { sourceSha: expected.sourceSha, group: row.group, updateId: row.id,
    runtime: row.runtimeVersion, branch: row.branch, platform: row.platform };
}

module.exports = { expectedPublication, selectPublicationGroup, verifyPublicationView };
