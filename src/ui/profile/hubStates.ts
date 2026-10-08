import type { LegalBundleStatus } from '../../contracts/legal';
import type { MyBlockedAccounts } from '../../data/safetyClientService';
import type { SupportInbox } from '../../data/supportCaseTypes';
import type { DataExportStatus } from '../../contracts/dataExport';
import { exportPhase, type ExportPhase } from '../privacy/ExportPresentation';
import { plural } from '../system/plural';

/**
 * What the rows of the profile and of "Privatnost i podaci" say about their own state (approved draft of the product, 8 Oct 2026, P1 and P5: "Podrška (broj
 * otvorenih)", "Blokirane osobe (Nema / 2)", "Izvoz podataka (Nije tražen)", "Pravila i saglasnosti (Još nisu objavljena)", "O aplikaciji (Verzija 1.0.0)").
 * Every word is read from data the app already has, and a state that could not be read is NOT said: a row never claims "Nema" for a list it could not read, and
 * never says "nije dostupno" in its place (J4: a row says a second thing only when that thing is a fact).
 */
export type HubStates = {
  /** The cases of the person's own support inbox that are not closed (the first page; older ones are not counted). */ support?: number;
  /** The blocked people of the first page, and whether there are more pages. */ blocked?: { count: number; more: boolean };
  /** Where the copy of the person's data is. */ exportPhase?: ExportPhase;
  /** The legal documents: not published, waiting for the person's acceptance, or accepted. */ legal?: 'UNPUBLISHED' | 'PENDING' | 'ACCEPTED';
};

/** The words of the four rows, from what was read; a part that was not read has no word. */
export type HubWords = { support?: string; blocked?: string; export?: string; legal?: string };

/** "2 otvorena zahteva": only when there is at least one open request; none is not worth a word on a row that opens the inbox. */
export const supportWord = (open: number | undefined): string | undefined =>
  open === undefined || open < 1 ? undefined : plural(open, 'otvoren zahtev', 'otvorena zahteva', 'otvorenih zahteva');

/** "Nema" for nobody, otherwise how many ("2", and "50+" when another page follows). */
export const blockedWord = (blocked: HubStates['blocked']): string | undefined =>
  !blocked ? undefined : blocked.count === 0 ? 'Nema' : `${blocked.count}${blocked.more ? '+' : ''}`;

/** The state of the export in the row's own gender ("Izvoz podataka: Nije tražen"). */
export const EXPORT_WORDS: Readonly<Record<ExportPhase, string>> = {
  NONE: 'Nije tražen', REQUESTED: 'Zahtev poslat', PROCESSING: 'U pripremi', READY_AVAILABLE: 'Spreman',
  READY_UNAVAILABLE: 'Nije dostupan', EXPIRED: 'Istekao', FAILED: 'Nije uspeo', CANCELLED: 'Otkazan',
};
export const exportWord = (phase: ExportPhase | undefined): string | undefined => phase === undefined ? undefined : EXPORT_WORDS[phase];

/** The legal documents as one short answer. */
export const LEGAL_WORDS: Readonly<Record<NonNullable<HubStates['legal']>, string>> = {
  UNPUBLISHED: 'Još nisu objavljena', PENDING: 'Čekaju tvoju saglasnost', ACCEPTED: 'Prihvaćena',
};
export const legalWord = (legal: HubStates['legal']): string | undefined => legal === undefined ? undefined : LEGAL_WORDS[legal];

export const hubWords = (states: HubStates): HubWords => ({ support: supportWord(states.support), blocked: blockedWord(states.blocked),
  export: exportWord(states.exportPhase), legal: legalWord(states.legal) });

/** "Verzija 1.0.0": the version the build records, or nothing (never a version made up). */
export const versionWord = (version: string | null | undefined): string | undefined => version ? `Verzija ${version}` : undefined;

// ---- from the answers of the services (each answer is read only if it is a real one) ----

/** The cases that are not closed. */
export function openSupportCases(inbox: SupportInbox | null | undefined): number | undefined {
  return inbox ? inbox.cases.filter(row => row.status !== 'CLOSED').length : undefined;
}
export function blockedFrom(list: MyBlockedAccounts | null | undefined): HubStates['blocked'] {
  return list ? { count: list.items.length, more: list.nextCursor !== null } : undefined;
}
export function legalFrom(bundle: LegalBundleStatus | null | undefined): HubStates['legal'] {
  return !bundle ? undefined : !bundle.ready ? 'UNPUBLISHED' : bundle.acceptedCurrentBundle ? 'ACCEPTED' : 'PENDING';
}
export function exportPhaseFrom(status: DataExportStatus | null | undefined, now: number): ExportPhase | undefined {
  return status ? exportPhase(status, now) : undefined;
}
