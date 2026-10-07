import type { ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Avatar } from '../system/Avatar';
import { ScreenChrome } from '../system/ScreenChrome';
import { Disclosure } from '../system/Disclosure';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { MoneyArt } from '../system/MoneyArt';
import { Segmented } from '../system/Segmented';
import { sys } from '../system/tokens';
import { useLayoutClass } from '../system/textScale';
import { osoba } from '../system/plural';
import { BEZ_IZNOSA } from '../../lib/novac';
import { T } from '../Text';

export type AgreementTab = 'pregled' | 'poruke';
/** Named destinations keep the conversation discoverable without squeezing the person's header. */
export function AgreementTabs({ tab, onChange }: { tab: AgreementTab; onChange: (tab: AgreementTab) => void }) {
  return <Segmented options={[{ key: 'pregled', label: 'Pregled' }, { key: 'poruke', label: 'Poruke' }]}
    value={tab} onChange={onChange} contentSized />;
}

const states: Record<DogovorProjekcija['stanje'], string> = {
  CONFIRMED: 'Dogovoreno', AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno', CANCELLED: 'Otkazano',
};
export const agreementStateText = (state: DogovorProjekcija['stanje']) => states[state];

/**
 * What the OTHER person is to me, in the third person, from the Dogovor's own participants (owner, 2026-09-19): their
 * name stands first, so a sentence about me beside it ("Uskočio si") read as if it were about them. The card, the
 * Dogovor's bar and its people rows say it with these words. Empty when the Dogovor does not say.
 */
export function agreementRole(person: Pick<UcesnikProjekcija, 'uloga'> | null | undefined): string {
  return person?.uloga === 'narucilac' ? 'Traži pomoć' : person?.uloga === 'uskocer' ? 'Uskače na tvoj zadatak' : '';
}

/** The adapter's sentence for an accepted term with neither end (agreementClientService.acceptedSchedule). */
const NO_TERM = 'Termin nije potvrđen';
/** A Dogovor that is over never had an exact time, and is no longer waiting for one (round-1 critique A3). */
export const NO_EXACT_TERM = 'Bez tačnog termina';
const SERBIAN_TIME = /\s*\(po vremenu u Srbiji\)/;

/**
 * The accepted term as a list and the overview draw it (round-1 critique A3, B15): the date as one line, and the zone
 * note, which a phone set outside Serbia carries, on a quiet line of its own instead of breaking the date over three.
 * The words are the adapter's, in Serbian time; only where they stand changes. A finished or cancelled Dogovor whose term
 * never had an end or a start says "Bez tačnog termina": "Termin nije potvrđen" read as a step still to come.
 */
export function agreementTerm({ vremeTekst, stanje }: Pick<DogovorProjekcija, 'vremeTekst' | 'stanje'>): { line: string; zone: string | null } {
  const text = vremeTekst.trim();
  if (text === NO_TERM && (stanje === 'COMPLETED' || stanje === 'CANCELLED')) return { line: NO_EXACT_TERM, zone: null };
  const zone = SERBIAN_TIME.exec(text);
  if (!zone) return { line: text, zone: null };
  return { line: `${text.slice(0, zone.index)}${text.slice(zone.index + zone[0].length)}`.trim(), zone: 'Po vremenu u Srbiji' };
}

/**
 * A Dogovor on a task for more than one person. Only there does the list of both sides say something the bar does not;
 * on a 1:1 Dogovor the bar already names the one other person (round-1 critique A13).
 */
export const isGroupAgreement = (agreement: Pick<DogovorProjekcija, 'pokrivenost' | 'ucesnici'>) =>
  agreement.pokrivenost.ukupno > 1 || agreement.ucesnici.length > 2;

/** How many people this Dogovor covers, said only when it is not the one person the bar already shows (A13). */
export const agreementPeople = (agreement: Pick<DogovorProjekcija, 'pokrivenost'>): string | null =>
  agreement.pokrivenost.popunjeno === 1 ? null : osoba(agreement.pokrivenost.popunjeno);

/**
 * The top bar of a Dogovor: the arrow back, then the person on the other side, their face or initials and their name,
 * with what they are to me under it. It is the same on Pregled and Poruke, so a tab never changes whom the screen is
 * about. The Dogovor's state is said once, in the next step, not here as well (round-1 critique A13). It is
 * the one chrome's detail bar with the face as its lead. No rating is drawn: the Dogovor does not carry one, and
 * "Još nema ocena" would be a claim about someone who may have many.
 */
export function AgreementPersonBar({ person, back, right }: { person: UcesnikProjekcija; back: () => void; right?: ReactNode }) {
  // The one Avatar: a missing name draws the person, never an empty disc.
  const initials = <Avatar initials={person.inicijali} size={40} />;
  return <ScreenChrome variant="detail" onBack={back} title={person.ime} subtitle={agreementRole(person) || undefined}
    lead={person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials} right={right} />;
}

/**
 * A fact keeps its spoken label and full value together. The overview also shows the label and promotes the saved
 * total; compact chat keeps its smaller values. No fixed height or line limit clips long terms or enlarged text.
 * It is heard as one sentence, "Termin: 24. sep · 17:00–19:00, Po vremenu u Srbiji". An amount wears the money colour
 * with its basis beside it; a word about money ("Iznos nije sačuvan") stays ink and has no basis.
 */
export function AgreementFact({ art, label, value, note, basis, money = false, labelVisible = false, prominent = false, supporting = false }: {
  art: FactArtKind; label: string; value: string; note?: string | null; basis?: string | null; money?: boolean;
  labelVisible?: boolean; prominent?: boolean; supporting?: boolean;
}) {
  return <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={s.fact}>
    <View style={[s.factArt, labelVisible && s.labeledArt]}>{art === 'money' && money ? <MoneyArt size={24} /> : <FactArt kind={art} size={24} cut="art" tone={art === 'calendar' || art === 'users' ? 'quiet' : 'brand'} />}</View>
    <View style={s.factCopy}>
      {labelVisible ? <T variant="meta" tone="muted">{label}</T> : null}
      <T style={[money ? s.factMoney : s.factValue, supporting && s.supportingValue, prominent && s.prominentValue]}>{value}{money && basis ? <T style={s.factBasis}>{` ${basis}`}</T> : null}</T>
      {note ? <T variant="meta" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

/** Source task context stays open on the white surface. Only its authoritative route makes it a link;
 * accepted terms live separately from this current task context. Compact history keeps its existing row. */
export function AgreementTaskLink({ agreement: a, onOpenTask, disabled = false, compact = false }: {
  agreement: DogovorProjekcija;
  /** Only provided when the authoritative source task id is available. */
  onOpenTask?: () => void; disabled?: boolean;
  /** The chat keeps its existing compact, scrollable context. */ compact?: boolean;
}) {
  const title = readableTitle(a.naslov);
  const remote = a.rezim === 'DALJINSKI';
  const taskPlace = remote ? 'Na daljinu' : a.putanjaTekst || 'Mesto nije navedeno';
  const surface = compact ? s.heroCompact : s.hero;
  const content = compact ? <View style={s.titleRow}>
    <FactArt kind="document" size={24} cut="art" />
    <View style={s.taskCopy}>
      <T accessibilityRole="header" style={s.acceptedTitle}>{title}</T>
      <T variant="note" tone={onOpenTask ? 'ink' : 'muted'}>{onOpenTask ? 'Otvori zadatak' : 'Zadatak'}</T>
    </View>
    {onOpenTask ? <CaretRight size={22} color={sys.color.muted} /> : null}
  </View> : <View style={s.taskOverview}>
    <T accessibilityRole="header" variant="cardTitle" style={s.ink}>{title}</T>
    <View style={s.taskMeta}>
      {/* Source-task area is coarse context, never the Agreement's private location. */}
      <View style={s.taskPlace}><FactArt kind={remote ? 'remote' : 'pin'} size={24} cut="art" />
        <T variant="note" tone="muted" style={s.taskPlaceCopy}>{taskPlace}</T></View>
      <View style={s.taskDestination}>
        <T style={s.taskDestinationLabel} variant="note" tone={onOpenTask ? 'ink' : 'muted'}>{onOpenTask ? 'Otvori zadatak' : 'Zadatak'}</T>
        {onOpenTask ? <CaretRight size={18} color={sys.color.muted} /> : null}
      </View>
    </View>
  </View>;
  return onOpenTask ? <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}${compact ? '' : `. ${taskPlace}`}`}
    accessibilityHint="Otvara detalje zadatka iz kog je nastao ovaj Dogovor."
    accessibilityState={{ disabled }} disabled={disabled} haptic="select" onPress={onOpenTask} style={surface}>{content}</Press>
    : <View style={surface}>{content}</View>;
}

/** Accepted facts remain a readable record, separate from the source task's current detail. */
export function AgreementTerms({ agreement: a, compact = false }: { agreement: DogovorProjekcija; compact?: boolean }) {
  const { stacked } = useLayoutClass();
  // The overview states the accepted count even for one person; compact chat can omit that repeated fact.
  const people = compact ? agreementPeople(a) : osoba(a.pokrivenost.popunjeno);
  const scope = a.prihvacenObim;
  const discloseScope = scope ? Array.from(scope).length > 180 || /[\r\n]/.test(scope) : false;
  const term = agreementTerm(a), remote = a.rezim === 'DALJINSKI', amount = a.cena.prikaz;
  const facts = <View style={compact ? s.facts : s.acceptedDetails}>
    {compact ? <AgreementFact art={remote ? 'remote' : 'pin'} label="Mesto" value={remote ? 'Na daljinu' : a.putanjaTekst || 'Mesto nije navedeno'} /> : null}
    <AgreementFact art="calendar" label="Termin" value={term.line} note={term.zone} labelVisible={!compact} supporting={!compact} />
  </View>;
  const amountFact = <AgreementFact art="money" label={amount ? 'Dogovoreno ukupno' : 'Cena'} value={amount || BEZ_IZNOSA}
    basis={compact && amount ? 'ukupno' : null} money={/\d/.test(amount)} labelVisible={!compact} prominent={!compact && /\d/.test(amount)} />;
  const peopleFact = people ? <AgreementFact art="users" label={compact ? 'Ljudi' : 'Dogovoreni broj osoba'} value={people} supporting={!compact} /> : null;
  // The accepted total leads. Missing amounts and large text keep a full-width record; no value is shortened.
  const stackPrice = stacked || !/\d/.test(amount);
  const price = compact ? <View style={s.acceptedPrice}>{amountFact}{peopleFact}</View>
    : <View style={[s.overviewPrice, stackPrice && s.overviewPriceStacked]}>
      <View style={[s.overviewAmount, stackPrice && s.overviewTermStacked]}>{amountFact}</View>
      {peopleFact ? <View style={[s.overviewPeople, stackPrice && s.overviewTermStacked]}>{peopleFact}</View> : null}
    </View>;
  return <View style={s.terms}>
    <View style={s.termsHeading}>
      <T accessibilityRole="header" variant={compact ? 'bodyStrong' : 'heading'} style={s.ink}>Dogovoreni uslovi</T>
      {a.verzija > 1 ? <T variant="meta" tone="muted">Uslovi su izmenjeni.</T> : null}
    </View>
    {/* A Dogovor without a saved amount says so in words, in ink, and without "ukupno" beside it. */}
    {compact ? <>{facts}{price}</> : <>{price}{facts}</>}
    {scope ? discloseScope
      ? <Disclosure label="Obim zadatka" hint="Prihvaćeni opis zadatka" art="document" divider>
        <T selectable>{scope}</T>
      </Disclosure>
      : <View accessible accessibilityLabel={`Obim zadatka: ${scope}`} style={s.acceptedScope}>
        <T variant="meta" tone="muted">Obim zadatka</T>
        <T selectable>{scope}</T>
      </View> : null}
  </View>;
}

/** Combined context for compact chat and historical previews; the live overview inserts its next step between these. */
export function AgreementHero(props: Parameters<typeof AgreementTaskLink>[0]) {
  return <View style={s.context}><AgreementTaskLink {...props} compact /><AgreementTerms agreement={props.agreement} compact /></View>;
}

/**
 * Both sides of a group Dogovor, each with role and seats; you are marked in words. Flat rows, no card. A 1:1 Dogovor
 * does not draw it: the bar names the one other person (round-1 critique A13).
 */
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={s.people}>
    {/* pkg024a: the read names each side's public profile, so the person you agreed to work with
        has a face here. Without that id there is nothing to read a photograph by, and the initials
        stay — an account id must never be handed to the media service in its place. */}
    {agreement.ucesnici.map(person => <View key={person.id} style={s.person}>
      {person.profilId
        ? <ProfilePhoto profileId={person.profilId} size={56} fallback={<Avatar initials={person.inicijali} size={56} />} />
        : <Avatar initials={person.inicijali} size={56} />}
      <View style={s.grow}>
        <T variant="bodyStrong" style={s.ink}>{person.ime}</T>
        <T variant="note" tone="muted">{person.uloga === 'narucilac' ? (person.viSte ? 'Ti · tražiš pomoć' : 'Traži pomoć') : person.viSte ? 'Ti · uskačeš' : 'Uskače'}
          {person.mesta !== null ? ` · ${osoba(person.mesta)}` : ''}</T>
      </View>
    </View>)}
  </View>;
}

/** A row that opens in place under its hairline: the one `Disclosure`, closed until pressed; `expanded` is spoken. */
export function AgreementSection({ label, summary, art, children }: { label: string; summary?: string; art?: FactArtKind; children: ReactNode }) {
  return <Disclosure label={label} hint={summary} art={art} divider>{children}</Disclosure>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 }, ink: { color: sys.color.ink },
  hero: { minHeight: 48, paddingVertical: sys.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: sys.color.line },
  heroCompact: { minHeight: 48, justifyContent: 'center' },
  context: { gap: sys.space.base },
  terms: { gap: sys.space.sm, paddingVertical: sys.space.sm },
  termsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  taskCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  taskOverview: { gap: sys.space.sm },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, rowGap: sys.space.xs },
  taskPlace: { flexDirection: 'row', alignItems: 'flex-start', flexBasis: 160, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: sys.space.sm },
  taskPlaceCopy: { flex: 1, minWidth: 0 },
  taskDestination: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, flexShrink: 0, maxWidth: '100%' },
  taskDestinationLabel: { flexShrink: 1 },
  acceptedTitle: { ...sys.type.bodyStrong, color: sys.color.ink },
  facts: { gap: 4 },
  acceptedPrice: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: 12 },
  overviewPrice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: sys.space.md, rowGap: sys.space.xs },
  overviewPriceStacked: { flexDirection: 'column', alignItems: 'stretch' },
  overviewAmount: { flexBasis: 176, flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  overviewPeople: { flexBasis: 100, flexGrow: 0, flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  overviewTermStacked: { flexBasis: 'auto', flexGrow: 0, width: '100%' },
  acceptedDetails: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line, paddingTop: sys.space.sm, gap: sys.space.xs },
  acceptedScope: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line, paddingTop: sys.space.sm, gap: sys.space.xs },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 36, paddingVertical: 6 },
  // The box is the drawing's own 24, so it does not spill 1 px over and under (review r4 rd, small note).
  factArt: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  labeledArt: { marginTop: sys.space.sm },
  factCopy: { flex: 1, minWidth: 0 },
  factValue: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: sys.color.ink },
  factMoney: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: sys.color.money, fontVariant: ['tabular-nums'] },
  supportingValue: { ...sys.type.copy, color: sys.color.ink },
  prominentValue: { ...sys.type.title },
  factBasis: { fontSize: 14, lineHeight: 22, fontWeight: '500', color: sys.color.muted },
  people: { borderTopWidth: 1, borderTopColor: sys.color.line },
  person: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
