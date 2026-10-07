import type { SheetAction } from '../system/ActionSheet';

/**
 * The "···" menu of a Dogovor (plan 2.6): the rare actions, out of the page and one tap from the top bar. In this order:
 *
 *   Izmeni uslove · Podeli svoj broj / Opozovi deljenje broja · Podeli lokaciju (only the requester) · Prijavi problem
 *   ----
 *   Otkaži Dogovor · Prijavi ili blokiraj osobu            (both in the danger colour)
 *
 * The rows that exist in the page stay there; this is a second way to the same commands, so each entry is offered under the same
 * condition as its row, and an action the page cannot take right now is shown grey with its reason, never hidden and never faded.
 * Pure: it builds the entries, the route gives them their commands. `ActionSheet` puts the destructive ones last and draws the rule.
 */
export type AgreementMenuInput = {
  /** I am one of the two sides. Nothing is offered to anyone else. */
  party: boolean;
  /** The Dogovor names the other person (the safety entry needs someone to report or block). */
  hasOther: boolean;
  /** Agreed or waiting for the confirmation: the only states with something left to change, share or report. */
  active: boolean;
  requester: boolean;
  /** The page offers "Izmene i otkazivanje" (not to the requester once the work is reported done, not on a finished Dogovor). */
  canChange: boolean;
  phoneShared: boolean;
  /** A physical Dogovor with an exact location behind the grant. */
  hasLocation: boolean;
  /** No problem is open yet: an open one is shown on the page instead. */
  problemFree: boolean;
  /** The page can take a command now (read, not busy, not unconfirmed). */
  enabled: boolean;
};

export type AgreementMenuCommands = {
  onChange: () => void; onCancel: () => void; onPhone: () => void; onLocation: () => void; onProblem: () => void; onSafety: () => void;
};

/** Why a row is grey: the page is reading or saving something. */
export const MENU_WAIT_REASON = 'Sačekaj da se Dogovor osveži.';

export function agreementMenuActions(input: AgreementMenuInput, commands: AgreementMenuCommands): SheetAction[] {
  if (!input.party) return [];
  const off = !input.enabled;
  const live = { disabled: off, reason: off ? MENU_WAIT_REASON : undefined };
  const rows: SheetAction[] = [];
  if (input.active && input.canChange) rows.push({ key: 'change', label: 'Izmeni uslove', icon: 'document', onPress: commands.onChange, ...live });
  if (input.active) rows.push({ key: 'phone', label: input.phoneShared ? 'Opozovi deljenje broja' : 'Podeli svoj broj', icon: 'phone', onPress: commands.onPhone, ...live });
  if (input.active && input.requester && input.hasLocation) {
    // The share state is read inside the section it opens, so the entry takes the person there instead of guessing.
    rows.push({ key: 'location', label: 'Podeli lokaciju', icon: 'pin', onPress: commands.onLocation, hint: 'Otvara odeljak Kontakt i mesto.', ...live });
  }
  if (input.active && input.problemFree) rows.push({ key: 'problem', label: 'Prijavi problem', icon: 'alert', onPress: commands.onProblem, ...live });
  if (input.active && input.canChange) {
    rows.push({ key: 'cancel', label: 'Otkaži Dogovor', icon: 'tasks', destructive: true, onPress: commands.onCancel, ...live });
  }
  if (input.hasOther) rows.push({ key: 'safety', label: 'Prijavi ili blokiraj osobu', icon: 'shield', destructive: true, onPress: commands.onSafety, ...live });
  return rows;
}
