import type { ComponentProps, ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { AgreementPeople, AgreementTerms, agreementTaskPlace, isGroupAgreement } from '../v2/AgreementPresentation';
import { AgreementContactPlace } from './AgreementContactPlace';
import { AgreementHead, AgreementLinks, AgreementTermNote } from './AgreementOverviewParts';
import type { AgreementSteps } from './AgreementSteps';
import type { AgreementStep } from './AgreementWorkspace';

/**
 * The overview of a Dogovor (Pregled), composed ONCE for the route and for its gallery (composition spec 4.9, template T3): the head
 * with the work's name and where the Dogovor stands; the note for a Dogovor with no term (R02); a reported problem and the three
 * ways on after it (R04); the terms; the people of a group; the number and the place; and the few rows that lead elsewhere, ending in
 * the form that reports a problem. Sections are parted by the space of the scroll it stands in (24) and by nothing else - no line, no box.
 *
 * It decides nothing: whether a row is drawn is whether the route handed it a command (`on`), and what each command does, behind which
 * guard, is the route's. It reads nothing and writes nothing. It is meant to be the children of the page's own scroll
 * (`overviewContent`), so its blocks become that scroll's children and the scroll's gap is the only space between them.
 */
export type AgreementOverviewProps = {
  agreement: DogovorProjekcija;
  /** Where the Dogovor stands and what comes next, and the step bar's own props (all of it computed in one place by the route). */
  step: AgreementStep; steps: ComponentProps<typeof AgreementSteps>;
  /** What the step is about: the lines of a proposal, the way to read the permissions again. Inside the step. */
  headExtra?: ReactNode;
  /** I am a side of the Dogovor, and which: the worker's own application is a row only for the worker. */
  party: boolean;
  /** The page can take a command now; every row is grey and cannot be pressed while it cannot. */
  enabled: boolean;
  /** Back from the background: the private part waits for the fresh read. */
  concealed?: boolean;
  /** The signed-in account carries a phone number to share (R01a). */
  accountHasNumber: boolean;
  /** A reported problem (or one whose details could not be read), the ways on after it, and the form that reports one. At most one of note and form. */
  problem?: { note?: ReactNode; exits?: ReactNode; form?: ReactNode };
  /** The entry to the conversation of a group Dogovor (it reads the group, so the route owns it). */
  group?: ReactNode;
  /** Replaces the private location of the place section. For a gallery that must read nothing; the route leaves it out. */
  location?: ReactNode;
  /**
   * What can be done from the page, as the route allows it. A row, a word at the end of a title or a note is drawn only for a command
   * that is given. The contact section and the layout callbacks are always the route's.
   */
  on: {
    /** The note "Termin još nije dogovoren" and its "Predloži termin". Given only for an agreed Dogovor with no term and nothing else waiting. */
    proposeTerm?: () => void;
    /** "Izmeni" at the end of the title of the terms. */
    changeTerms?: () => void;
    togglePhone: () => void; openMessages: () => void; requestAddress?: () => void;
    /** Rows of the links. */
    openTask?: () => void; openApplication?: () => void; openChange?: () => void; openProblem?: () => void; openSafety?: () => void;
    /** Where the place section and the problem form stand, to take a person to them. */
    placeLayout?: (event: LayoutChangeEvent) => void; problemLayout?: (event: LayoutChangeEvent) => void;
  };
};

export function AgreementOverview({ agreement, step, steps, headExtra, party, enabled, concealed = false, accountHasNumber, problem, group, location, on }: AgreementOverviewProps) {
  const title = readableTitle(agreement.naslov);
  const link = (command: (() => void) | undefined) => command ? { disabled: !enabled, onPress: command } : undefined;
  return <>
    <AgreementHead title={title} step={step} steps={steps}>{headExtra}</AgreementHead>
    {on.proposeTerm ? <AgreementTermNote disabled={!enabled} onPropose={on.proposeTerm} /> : null}
    {problem?.note}
    {problem?.exits}
    <AgreementTerms agreement={agreement} onChange={on.changeTerms} />
    {/* A 1:1 Dogovor names its one other person in the bar; the list of both sides is kept for a group (A13). */}
    {isGroupAgreement(agreement) ? <AgreementPeople agreement={agreement} /> : null}
    {group}
    {/* One open section for the number and the place (it was a closed "Kontakt" and a closed "Lokacija i pristup"). */}
    <AgreementContactPlace agreement={agreement} enabled={enabled} concealed={concealed} canShare={party} accountHasNumber={accountHasNumber}
      locationSlot={location} onLayout={on.placeLayout} onTogglePhone={on.togglePhone} onOpenMessages={on.openMessages} onRequestAddress={on.requestAddress} />
    <AgreementLinks
      task={on.openTask ? { title, place: agreementTaskPlace(agreement), ...link(on.openTask)! } : undefined}
      application={link(on.openApplication)} change={link(on.openChange)} problem={link(on.openProblem)} safety={link(on.openSafety)}
      history={agreement.hronologija} />
    {problem?.form ? <View onLayout={on.problemLayout}>{problem.form}</View> : null}
  </>;
}
