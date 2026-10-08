import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { BEZ_IZNOSA } from '../../../lib/novac';
import { AgreementLinks } from '../../agreements/AgreementOverviewParts';
import { agreementAttention, agreementWhen, type AgreementAttention } from '../../agreements/agreementListModel';
import { deadlineNote } from '../../agreements/agreementStepsModel';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { Glyph } from '../../system/Glyph';
import { layout, ruleWidth } from '../../system/layout';
import { ChromeIconButton, ScreenChrome } from '../../system/ScreenChrome';
import { Segmented } from '../../system/Segmented';
import { StateView } from '../../system/StateView';
import { sys } from '../../system/tokens';
import { AgreementTabs, AgreementTerms, agreementRole, agreementTaskPlace, agreementTerm, isNoTermText } from '../../v2/AgreementPresentation';
import { NOW } from './fixtures';
import { noop } from './lab';
import { TackaCeka } from './parts';

/**
 * What the three Dogovor variants share and do not argue about: the root bar and the controls of the list (production's, unchanged),
 * the frame of the detail (bar, tabs, scroll, foot), the terms and the links of the detail (production's `AgreementTerms` and
 * `AgreementLinks`), the words of a time and of a move, and the orange foot of a card that waits for me. The variants differ in the
 * card and in the head of the detail, which is where the owner has to choose.
 */
export const otherOf = (item: DogovorProjekcija): UcesnikProjekcija | undefined => item.ucesnici.find(person => !person.viSte);
export const meOf = (item: DogovorProjekcija): UcesnikProjekcija | undefined => item.ucesnici.find(person => person.viSte);
export const nameOf = (person: UcesnikProjekcija | undefined): string => person?.ime?.trim() || 'Druga strana';
export const amountOf = (item: DogovorProjekcija): string | null => item.cena.prikaz || null;

/** The agreed time as the first line of a record: "Danas · 14:00–16:00", "7. okt · 09:00–11:00", or the term's own sentence when there is none. */
export function leadWhen(item: DogovorProjekcija): string {
  const when = agreementWhen(item, NOW);
  return when ? when.replace(/^(Danas|Sutra) /, '$1 · ') : agreementTerm(item).line;
}
/** The clock alone, for a record under a day heading ("Danas") that already says the day. */
export function clockOnly(item: DogovorProjekcija): string {
  return leadWhen(item).replace(/^(Danas|Sutra) · /, '');
}
/** "Potvrda do 9. okt · 09:00", the server's window, only while the confirmation is awaited. */
export const deadlineOf = (item: DogovorProjekcija): string | null => deadlineNote({ state: item.stanje, deadlineIso: item.rokPotvrdeIso, problemOpen: item.problemOtvoren });

export type Move = {
  /** The move is mine: the orange accent. The same rule as the list's "Čeka tebe" (`agreementAttention`). */
  mine: boolean;
  /** Whose face stands by the move: me when it is mine, the other person otherwise. */
  who: UcesnikProjekcija | undefined;
  sentence: string;
  detail: string | null;
};
/** Whose move it is and what it is, in one short sentence to the person ("ti"), from the Dogovor's state alone. */
export function moveOf(item: DogovorProjekcija): Move {
  const other = otherOf(item), me = meOf(item), requester = me?.uloga === 'narucilac', name = nameOf(other);
  const attention = agreementAttention(item);
  if (attention?.kind === 'change') return { mine: true, who: me, sentence: 'Odgovori na predlog izmene.', detail: attention.line };
  if (attention?.kind === 'confirm') return { mine: true, who: me, sentence: 'Potvrdi da je gotovo.', detail: `${name} javlja da je zadatak gotov.${deadlineOf(item) ? ` ${deadlineOf(item)}, bez odgovora se Dogovor zatvara sam.` : ''}` };
  if (attention?.kind === 'rate') return { mine: true, who: me, sentence: 'Kako je prošla saradnja?', detail: 'Ocena pomaže drugima da biraju i ne može da se menja.' };
  if (attention?.kind === 'check-rating') return { mine: true, who: me, sentence: 'Proveri ocenu.', detail: attention.line };
  if (item.stanje === 'COMPLETED') return { mine: false, who: other, sentence: 'Dogovor je završen.', detail: null };
  if (item.stanje === 'CANCELLED') return { mine: false, who: other, sentence: 'Dogovor je otkazan.', detail: null };
  if (item.stanje === 'AWAITING_REQUESTER') return { mine: false, who: other, sentence: `Čekaš da ${name} potvrdi završetak.`, detail: deadlineOf(item) };
  if (isNoTermText(item.vremeTekst)) return { mine: false, who: other, sentence: 'Dogovorite termin.', detail: 'Dogovorite tačno vreme u Porukama, pa ga upišite.' };
  return requester ? { mine: false, who: other, sentence: `Čekaš da ${name} javi da je gotovo.`, detail: null }
    : { mine: false, who: me, sentence: 'Kad završiš, javi da je gotovo.', detail: null };
}

/** The root bar as the Dogovori tab draws it, with a bell that reads nothing, and the controls under it (production's, unchanged by the variants). */
export function ListFrame({ children, empty = false }: { children: ReactNode; empty?: boolean }) {
  return <View style={s.fill}>
    <ScreenChrome variant="root" title="Dogovori" onProfile={noop} bell={<ChromeIconButton label="Obaveštenja" glyph="notifications" onPress={noop} />} />
    <View style={s.controls}>
      <View style={s.tabs}><Segmented options={[{ key: 'active', label: 'Aktivni' }, { key: 'history', label: 'Istorija' }]} value="active" onChange={noop} /></View>
      <ChromeIconButton glyph="calendar" label="Raspored" onPress={noop} />
    </View>
    {empty ? <View style={s.emptyHost}>
      <StateView art="agreements" title="Još nemaš Dogovor" body="Kada izabereš nekoga za svoj zadatak, ili kada tvoja prijava bude izabrana, Dogovor se pojavljuje ovde."
        primary={{ label: 'Pogledaj zadatke', onPress: noop }} quiet={{ label: 'Objavi zadatak', onPress: noop }} />
    </View> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>{children}</ScrollView>}
  </View>;
}

/** The frame of the Dogovor: the bar the variant hands in, the two tabs, the scroll in the grid of every screen, and the foot. */
export function DetaljFrame({ bar, footer, children }: { bar: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return <View style={s.fill}>
    {bar}
    <View style={s.tabRow}><AgreementTabs tab="pregled" onChange={noop} /></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>{children}</ScrollView>
    {footer}
  </View>;
}

/** The bar of the Dogovor as production draws it (the face at 40, the name, what the person is to me); variants B and C keep it. */
export function PersonBar({ item }: { item: DogovorProjekcija }) {
  const other = otherOf(item);
  return <ScreenChrome variant="detail" onBack={noop} title={nameOf(other)} subtitle={agreementRole(other) || undefined}
    lead={<View style={s.barFace}><Avatar initials={other?.inicijali} size={40} /></View>} />;
}

/** The terms and the rows that lead elsewhere, production's own components: the variants change nothing below the head. */
export function UsloviILinkovi({ item }: { item: DogovorProjekcija }) {
  const open = item.stanje === 'CONFIRMED';
  return <>
    <AgreementTerms agreement={item} onChange={open ? noop : undefined} />
    <AgreementLinks task={{ title: readableTitle(item.naslov), place: agreementTaskPlace(item), onPress: noop }}
      change={open ? { onPress: noop } : undefined} problem={item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER' ? { onPress: noop } : undefined}
      safety={{ onPress: noop }} history={item.hronologija} />
  </>;
}

/** The orange foot of a record that waits for me: the one rule a record draws, the dot, the verb and the arrow (as `AgreementListCard` has it). */
export function Noga({ attention }: { attention: AgreementAttention }) {
  return <View style={s.foot}>
    <View style={s.footRule} />
    <View style={s.footRow}>
      <TackaCeka />
      <T variant="note" style={s.footWord}>{attention.title}</T>
      <Glyph name="arrow-right" size={20} tone="muted" />
    </View>
  </View>;
}

/** An amount, or the words for a missing one, never a figure that was not saved. */
export function Iznos({ item, style }: { item: DogovorProjekcija; style?: object }) {
  const amount = amountOf(item);
  return amount ? <T variant="priceRow" style={[s.amount, style]}>{amount}</T> : <T variant="note" tone="muted" style={style}>{BEZ_IZNOSA}</T>;
}

export const sh = StyleSheet.create({
  ink: { color: sys.color.ink },
  /** The agreed time as the lead of a record or a head (pravac B5: 18/700, tabular). `heading` is 18/24 at 600; the number is 700 like every amount. */
  timeLead: { ...sys.type.heading, fontWeight: '700', fontVariant: ['tabular-nums'], color: sys.color.ink },
  /** The agreed time as the one figure a detail is built around (variant B): the `priceLarge` measure, 24/30/700 tabular. */
  timeHero: { ...sys.type.priceLarge, color: sys.color.ink },
  group: { gap: layout.group },
  quiet: { textAlign: 'center', paddingVertical: sys.space.xs },
  actionWord: { fontWeight: '600' },
});

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: sys.color.ground },
  controls: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  tabs: { flex: 1, minWidth: 0 },
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md, paddingBottom: layout.zone, gap: layout.group },
  emptyHost: { flex: 1, paddingHorizontal: layout.gutter },
  tabRow: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.md },
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.section, gap: layout.section },
  barFace: { marginRight: sys.space.xs },
  foot: { marginTop: sys.space.md, marginBottom: -layout.card },
  footRule: { height: ruleWidth, backgroundColor: sys.color.line },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch },
  footWord: { flex: 1, minWidth: 0, color: sys.color.warn },
  amount: { color: sys.color.money },
});
