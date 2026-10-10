'use strict';

// Narrow, evidence-backed source candidates. Never automatically call the old RPC
// or infer that a successor has identical permissions / business semantics.
// Only report a candidate when the named new API is present in a screen-reachable
// source module. The canonical live server must still be verified independently.
const CANDIDATES = Object.freeze({
  rpc_list_my_agreements: {
    candidate: 'rpc_list_my_agreements_page',
    path: 'src/data/agreementClientService.ts',
    reason: 'Current personal-agreements reader uses a paginated RPC.',
  },
  rpc_send_agreement_message: {
    candidate: 'rpc_send_agreement_message_v2',
    path: 'src/data/agreementMessageClientService.ts',
    reason: 'Current agreement text-message sender selects the v2 RPC.',
  },
  rpc_get_push_device: {
    candidate: 'rpc_get_push_device_owned',
    path: 'src/data/pushDeviceClientService.ts',
    reason: 'Current push-device read is ownership-scoped; session reader is separate.',
  },
});

function tokenPresent(source, token) {
  if (typeof source !== 'string') return false;
  return new RegExp("['\\"`]" + token + "['\\"`]").test(source);
}

function rpcSuccessorEvidence(rpc, sourceFiles, screenReachableFiles) {
  const item = CANDIDATES[rpc];
  if (!item) return { status_poziva: 'NIJE_DIREKTNO_REFERENCIRANO_NAMENA_ZA_PROVERU' };
  const source = sourceFiles?.[item.path];
  const reachable = screenReachableFiles?.has(item.path) === true;
  if (!reachable || !tokenPresent(source, item.candidate))
    return { status_poziva: 'NIJE_DIREKTNO_REFERENCIRANO_NAMENA_ZA_PROVERU' };
  return {
    status_poziva: 'MOGUCA_NOVIJA_KLIJENTSKA_ZAMENA',
    kandidat_novijeg_rpc: item.candidate,
    kandidat_izvor: item.path,
    napomena_zamene: item.reason,
    dokaz: 'SOURCE_ONLY_NOT_RUNTIME_OR_SEMANTIC_PARITY',
  };
}

module.exports = rpcSuccessorEvidence;
module.exports.CANDIDATES = CANDIDATES;
