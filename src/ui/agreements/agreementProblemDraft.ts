/** Unsent problem description. It survives leaving the Dogovor and coming back while the app runs, and a
 * network failure; it lives in process RAM for one account/Agreement incarnation, never in storage, and is
 * cleared only after the server's readback confirms the report. */
let cached: { scope: string; text: string } | null = null;

export const agreementProblemDraftScope = (accountId: string | undefined, accountRevision: number, agreementId: string) =>
  JSON.stringify([accountId ?? '', accountRevision, agreementId]);

export function readAgreementProblemDraft(scope: string): string {
  return cached?.scope === scope ? cached.text : '';
}

export function rememberAgreementProblemDraft(scope: string, text: string): void {
  if (text.length > 4000) return;
  if (text) cached = { scope, text };
  else if (cached?.scope === scope) cached = null;
}

export function clearAgreementProblemDraft(scope: string): void {
  if (cached?.scope === scope) cached = null;
}
