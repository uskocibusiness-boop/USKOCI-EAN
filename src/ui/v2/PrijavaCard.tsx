import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FactRow } from '../system/FactRow';
import { STATUS_CHIPS, StatusChip, type StatusKey } from '../system/StatusChip';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { MoneyLine } from './offer/RecordParts';

/**
 * PrijavaCard: an application ("prijava") as ONE recognisable object, for both people who see it (plan 2.12, owner 2026-10-07;
 * composition spec 4.7, 2026-10-08). The worker meets it in "Moje prijave", the requester among the candidates of a task. It is the
 * same anatomy in both, so a prijava never looks like something else, and only the head differs, because each of them already knows
 * one half of it:
 *
 *   1. the state, as the one `StatusChip` of the app: Poslata, Viđena, Izabrana, Nije izabrana, Povučena. EVERY card has one;
 *   2. who it is about: the TASK's title for the worker, the PERSON (face, name, rating) for the requester;
 *   3. what it is worth, on ONE line: the offered total, what it covers and how many people ("4.500 RSD ukupno · 2 osobe"), and the
 *      term as a fact of its own. The worker's term comes before the offer (it says which job this is), the requester's after it (the
 *      person and the offer are what is chosen between, and a term is shown there only when the person proposed one);
 *   4. the message, in quotes, quietly (two lines on a list, all of it where it is read in full).
 *
 * A price that was not stored says so in words ("Cena nije navedena") and never wears an amount's weight. Nothing here invents a
 * rating, a count, a time or a state: the adapters that build the model (`ApplicationFace` for the worker, `CandidateFace` for the
 * requester) pass only what the read carried.
 *
 * This file draws the CONTENT of the card. The frame (a `Surface record`), the press target and the one action beside it belong to the
 * list that holds it, because they differ with the interaction (the worker's card has a body and a separate foot, the requester's is
 * one press).
 */

/** The statuses an application can wear: the five words of the owner's decision. */
export type PrijavaStatus = Extract<StatusKey, `application.${string}`>;

/** What stands in the price row: the total and what it covers, or the quiet words for a price that was not stored. */
export type PrijavaPrice = { kind: 'amount'; amount: string; basis: string } | { kind: 'unpriced' };
export const PRICE_NOT_STORED = 'Cena nije navedena';

export type PrijavaWho =
  /** The worker's view: which task this application is for. */
  | { kind: 'task'; title: string }
  /** The requester's view: the person, with their picture and the rating line the adapter built (a star only beside a real figure). */
  | { kind: 'person'; name: string; avatar: ReactNode; trust: ReactNode };

export type PrijavaModel = {
  status: PrijavaStatus;
  /** An exceptional line under the state, only when it says something the chip does not ("Zadatak je izmenjen."). */
  reason?: { text: string; tone: 'warn' | 'muted' } | null;
  who: PrijavaWho;
  /** The term, written once by the app's one time format. */
  term: string;
  /** False when the term is not drawn: the requester's list says it only for a time the person proposed. The term is still heard. */
  showTerm?: boolean;
  price: PrijavaPrice;
  /** "1 osoba", "2 osobe". */
  people: string;
  /** What the person says they have (a vehicle, a tool), only on the requester's card: "Ima: Kombi · Trake za nošenje". It is information, never a condition. */
  has?: { art: 'vehicle' | 'tool'; text: string } | null;
  /** The message exactly as it is shown, or null when there is none. */
  message: string | null;
  /** The application is over (withdrawn or not chosen). The chip says so; the words stay as readable as ever. */
  quiet?: boolean;
};

/** The word of the model's state, as the chip says it. */
export const prijavaStatusWord = (status: PrijavaStatus) => STATUS_CHIPS[status].word;

/** The price as it is heard. */
export const prijavaPriceSpoken = (price: PrijavaPrice) => price.kind === 'amount' ? `${price.amount} ${price.basis}` : PRICE_NOT_STORED;

/**
 * Everything the card shows, as one sentence after its command name, in the order it is drawn. Empty parts are left out. The
 * message is spoken as the card shows it unless the adapter hands the words to say (the worker says "tvoja poruka" over his own
 * words without their quotation marks; the requester's list reads a bounded preview).
 */
export function prijavaSpoken(model: PrijavaModel, options: { message?: string | null; messageLabel?: string } = {}): string {
  const message = options.message === undefined ? model.message : options.message;
  return [prijavaStatusWord(model.status), model.reason?.text.replace(/\.$/, ''), model.term, `ponuda ${prijavaPriceSpoken(model.price)}`, model.people,
    message ? `${options.messageLabel ?? 'poruka'}: ${message}` : null].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/**
 * The price, drawn as the one money line: an amount keeps its whole width and wraps, what it buys is a quiet word beside it, the people
 * follow after a dot, and at large text the parts stand under each other. The words of a price that was not stored are a quiet label.
 */
export function PrijavaPriceText({ price, large, people }: { price: PrijavaPrice; large: boolean; people?: string }) {
  return price.kind === 'amount'
    ? <MoneyLine amount={price.amount} basis={price.basis} notes={[people]} stacked={large} />
    : <MoneyLine word={PRICE_NOT_STORED} notes={[people]} stacked={large} />;
}

/**
 * The state and the reason a prijava is not simply open, on one line when they fit: the chip is the state, the sentence beside it is
 * only what it cannot say ("Zadatak je izmenjen."). `silent` is for the state inside a card that is one press and is heard once, as one
 * sentence (`prijavaSpoken`): the chip and the line are then not stops of their own. On a sheet, where nothing else says the state,
 * they are read.
 */
export function PrijavaState({ status, reason, silent = false }: Pick<PrijavaModel, 'status' | 'reason'> & { silent?: boolean }) {
  const state = <View style={s.state}>
    <StatusChip status={status} />
    {reason ? <T variant="note" style={[s.reason, reason.tone === 'warn' && s.reasonWarn]}>{reason.text}</T> : null}
  </View>;
  return silent ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{state}</View> : state;
}

/**
 * The card's content. Data to pixels only, memoised on the model's own fields by the adapters (they hand in a model built from
 * memoised inputs), so a re-render of the list touches only the rows whose application changed. `noteLines` clamps the message
 * (0 = all of it); `large` is the layout class of the window (`useLayoutClass`), which the adapter reads once.
 */
export const PrijavaCard = memo(function PrijavaCard({ model, large, noteLines = 0, trailing }: {
  model: PrijavaModel; large: boolean; noteLines?: number;
  /** A card that is over or disabled keeps its words as they are; the argument stays so no caller breaks. */ disabled?: boolean;
  /** One quiet mark at the end of the head (the requester's caret: the whole card opens the offer). */ trailing?: ReactNode;
}) {
  const { who } = model;
  const money = <PrijavaPriceText price={model.price} large={large} people={model.people} />;
  const term = model.showTerm === false ? null : <FactRow art="calendar" value={model.term} />;
  return <>
    <PrijavaState status={model.status} reason={model.reason} silent />
    {who.kind === 'person' ? <View style={s.head}>
      <View style={s.avatar}>{who.avatar}</View>
      <View style={s.person}><T variant="heading" style={s.title}>{who.name}</T>{who.trust}</View>
      {trailing}
    </View> : <View style={s.head}><T variant="heading" style={[s.title, s.person]}>{who.title}</T>{trailing}</View>}
    {who.kind === 'task' ? <>{term}{money}</> : <>{money}{term}</>}
    {model.has ? <FactRow art={model.has.art} value={model.has.text} /> : null}
    {model.message ? <T variant="note" tone="muted" numberOfLines={noteLines || undefined}>{model.message}</T> : null}
  </>;
});

const s = StyleSheet.create({
  state: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, rowGap: sys.space.xs },
  // A reason is a sentence of fact, never a second chip: ink-grey, warn only for what blocks a choice that would otherwise be open.
  reason: { color: sys.color.muted, flexShrink: 1 },
  reasonWarn: { color: sys.color.warn },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  avatar: { flexShrink: 0 },
  person: { flex: 1, minWidth: 0, gap: sys.space.xs },
  title: { color: sys.color.ink },
});
