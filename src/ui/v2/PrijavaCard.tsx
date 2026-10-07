import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CalendarArt } from '../system/CalendarArt';
import { FactArt } from '../system/FactArt';
import { MoneyArt } from '../system/MoneyArt';
import { STATUS_CHIPS, StatusChip, type StatusKey } from '../system/StatusChip';
import { sys } from '../system/tokens';
import { T } from '../Text';

/**
 * PrijavaCard: an application ("prijava") as ONE recognisable object, for both people who see it (plan 2.12, owner 2026-10-07).
 * The worker meets it in "Moje prijave", the requester among the candidates of a task. It is the same anatomy in both, so a
 * prijava never looks like something else, and only the head differs, because each of them already knows one half of it:
 *
 *   1. the state, as the one `StatusChip` of the app: Poslata, Viđena, Izabrana, Nije izabrana, Povučena. EVERY card has one;
 *   2. who it is about: the TASK's title for the worker, the PERSON (picture, name, rating) for the requester;
 *   3. the facts, always in this order and each on its own row with its drawing: the term, the offered price, the people, the message
 *      (a row that has nothing to say is not drawn, except price and people, which are always said).
 *
 * A price that was not stored says so in words ("Iznos nije sačuvan") and never wears an amount's weight or colour. Nothing here
 * invents a rating, a count, a time or a state: the adapters that build the model (`ApplicationFace` for the worker, `CandidateFace`
 * for the requester) pass only what the read carried.
 *
 * This file draws the CONTENT of the card. The frame, the press target and the one action beside it belong to the list that holds
 * it, because they differ with the interaction (the worker's card has a body and a separate foot, the requester's is one press).
 */

/** The statuses an application can wear: the five words of the owner's decision. */
export type PrijavaStatus = Extract<StatusKey, `application.${string}`>;

/** What stands in the price row: the total and what it covers, or the quiet words for a price that was not stored. */
export type PrijavaPrice = { kind: 'amount'; amount: string; basis: string } | { kind: 'unpriced' };
export const PRICE_NOT_STORED = 'Iznos nije sačuvan';

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
  price: PrijavaPrice;
  /** "1 osoba", "2 osobe". */
  people: string;
  /** The message exactly as it is shown, or null when there is none. */
  message: string | null;
  /** The application is over (withdrawn or not chosen): its drawings are drawn quiet. */
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

/** The price, drawn: an amount keeps its whole width and wraps under its basis at large text; the words are a quiet label. */
export function PrijavaPriceText({ price, large }: { price: PrijavaPrice; large: boolean }) {
  if (price.kind === 'unpriced') return <T style={s.priceWord}>{PRICE_NOT_STORED}</T>;
  return <View style={[s.priceLine, large && s.priceStacked]}>
    <T style={s.amount}>{price.amount}</T>
    <T style={s.basis}>{price.basis}</T>
  </View>;
}

function FactRow({ art, children }: { art: ReactNode; children: ReactNode }) {
  return <View style={s.fact}><View style={s.art}>{art}</View><View style={s.factBody}>{children}</View></View>;
}

/**
 * The state and, under it, the reason a prijava is not simply open; the chip is the state, the line is only what it cannot say.
 * `silent` is for the state inside a card that is one press and is heard once, as one sentence (`prijavaSpoken`): the chip and the
 * line are then not stops of their own. On a sheet, where nothing else says the state, they are read.
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
export const PrijavaCard = memo(function PrijavaCard({ model, large, noteLines = 0, disabled = false, trailing }: {
  model: PrijavaModel; large: boolean; noteLines?: number; disabled?: boolean;
  /** One quiet mark at the end of the head (the requester's caret: the whole card opens the offer). */ trailing?: ReactNode;
}) {
  const quiet = disabled || !!model.quiet;
  const { who } = model;
  return <>
    <PrijavaState status={model.status} reason={model.reason} silent />
    <View style={s.head}>
      {who.kind === 'person' ? <>
        <View style={s.avatar}>{who.avatar}</View>
        <View style={s.person}><T style={s.title}>{who.name}</T>{who.trust}</View>
      </> : <View style={s.person}><T style={s.title}>{who.title}</T></View>}
      {trailing}
    </View>
    <View style={s.facts}>
      <FactRow art={<CalendarArt size={24} quiet={quiet} />}><T style={s.factText}>{model.term}</T></FactRow>
      <FactRow art={model.price.kind === 'amount' ? <MoneyArt size={24} quiet={quiet} /> : <FactArt kind="money" size={24} cut="art" tone="quiet" />}>
        <PrijavaPriceText price={model.price} large={large} />
      </FactRow>
      <FactRow art={<FactArt kind="users" size={24} cut="art" tone="quiet" />}><T style={s.factText}>{model.people}</T></FactRow>
      {model.message ? <FactRow art={<FactArt kind="chat" size={24} cut="art" tone="quiet" />}>
        <T style={s.factText} numberOfLines={noteLines || undefined}>{model.message}</T></FactRow> : null}
    </View>
  </>;
});

const s = StyleSheet.create({
  state: { gap: sys.space.sm, alignItems: 'flex-start' },
  // A reason is a sentence of fact, never a second chip: ink-grey, warn only for what blocks a choice that would otherwise be open.
  reason: { color: sys.color.muted },
  reasonWarn: { color: sys.color.warn },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  avatar: { flexShrink: 0 },
  person: { flex: 1, minWidth: 0, gap: sys.space.xs },
  title: { ...sys.type.heading, color: sys.color.ink },
  facts: { gap: sys.space.sm },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  art: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  factBody: { flex: 1, minWidth: 0, minHeight: 24, justifyContent: 'center' },
  factText: { ...sys.type.note, lineHeight: 21, color: sys.color.fact },
  priceLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm, rowGap: 2 },
  priceStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  // An amount is ink and bold with tabular figures; what it buys is a quiet word beside it.
  amount: { ...sys.type.bodyStrong, color: sys.color.money, fontVariant: ['tabular-nums'], flexShrink: 1, maxWidth: '100%', textAlign: 'left' },
  basis: { ...sys.type.note, color: sys.color.muted, flexShrink: 1, maxWidth: '100%' },
  // The words of a price that was not stored: regular weight, muted, and never the figure's weight or colour.
  priceWord: { ...sys.type.note, lineHeight: 21, color: sys.color.muted },
});
