import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { ReactNode } from 'react';
import type { DogovorProjekcija } from '../../contracts/projections';
import { T } from '../Text';
import { AgreementPrivateLocation } from '../AgreementPrivateLocation';
import { FactArt } from '../system/FactArt';
import { InfoButton } from '../system/InfoButton';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { sys } from '../system/tokens';
import { telHref, myNumberOffer } from './agreementContactModel';

/** What sharing the number means, behind the "ⓘ" at the end of the section's title: the row says what it does, and this says what it does not (J3, J4). */
const NUMBER_LINES = ['Deljenje je odvojeno u oba smera.', 'Kad podeliš svoj broj, druga strana ne deli automatski svoj.'] as const;

/**
 * "Kontakt i mesto" (plan 2.6; composition spec 4.9): ONE open section where a closed "Kontakt" and a closed "Lokacija i pristup" used to
 * stand, made of the rows of the one list. The number of the other side and what the person can do with it ("Pozovi" when it was shared),
 * the one command that shares or withdraws mine, and the place - which is private: its exact address and its map, with the map's own "open
 * in maps" action, appear only through the location grant that `AgreementPrivateLocation` reads and fences, exactly as before.
 *
 * Nothing is offered that cannot succeed (R01a). "Podeli svoj broj" is for an account that HAS a number; one that has none is told, in one
 * row, where contact happens: in Poruke ("Kontakt kroz Poruke"), which takes them there. See `agreementContactModel`.
 *
 * Back from the background the page keeps its last content while it is read again, but nothing private is drawn until the fresh read has
 * landed (`concealed`): not the number and not the place. The section keeps its place, so the page does not jump.
 */
export function AgreementContactPlace({ agreement, enabled, concealed = false, canShare, accountHasNumber = false, onTogglePhone, onOpenMessages, onRequestAddress, onLayout, locationSlot }: {
  agreement: DogovorProjekcija; enabled: boolean;
  /** The screen reads where the section stands, to take a person to it ("Podeli lokaciju" in the menu). The section draws nothing at all when it has nothing to say. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** The page is showing its last content while a fresh read is on the way: the private part waits for it. */
  concealed?: boolean;
  /** I am a side of an agreed Dogovor: the sharing command is mine to give. */
  canShare: boolean;
  /** The signed-in account carries a phone number (the session's user): only then can "Podeli svoj broj" succeed. */
  accountHasNumber?: boolean;
  onTogglePhone: () => void;
  /** "Kontakt kroz Poruke": the way to the conversation, for an account that has no number to share. */
  onOpenMessages?: () => void;
  /** "Zatraži adresu": puts the question into the conversation and takes the person there; the route owns the draft. */
  onRequestAddress?: () => void;
  /** Stands where the private location stands. Only for a gallery that must read nothing; the screen leaves it out. */
  locationSlot?: ReactNode;
}) {
  const active = agreement.stanje === 'CONFIRMED' || agreement.stanje === 'AWAITING_REQUESTER';
  const shared = agreement.kontakt.mojTelefonPodeljen, theirs = agreement.kontakt.njihovTelefon;
  const physical = agreement.rezim !== 'DALJINSKI' && agreement.kontakt.lokacijaPostoji;
  const offer = myNumberOffer({ active, canShare, shared, accountHasNumber });
  const call = telHref(theirs);
  // A call that cannot be started (no dialler, a number the system refuses) is not an error screen: the number stays on the row to be read.
  const dial = () => { if (call) void Promise.resolve(Linking.openURL(call)).catch(() => undefined); };
  const phone = <FactArt kind="phone" size={32} />;
  const rows: ((last: boolean) => ReactNode)[] = [];
  if (concealed) rows.push(last => <ListRow key="theirs" leading={phone} title="Broj druge strane" subtitle="Proveravamo broj druge strane…" last={last} />);
  else if (theirs && call) rows.push(last => <ListRow key="theirs" leading={phone} title="Pozovi" subtitle={theirs} last={last}
    accessibilityLabel={`Pozovi, ${theirs}`} onPress={dial} />);
  else if (theirs) rows.push(last => <ListRow key="theirs" leading={phone} title="Broj druge strane" subtitle={theirs} last={last} />);
  else if (active) rows.push(last => <ListRow key="theirs" leading={phone} title="Broj druge strane" subtitle="Još nije podeljen." last={last} />);
  // A row says what it does by its title; a line under it is a fact about the row (J4): that my number is shared, or why there is none to share.
  // What the number is for - sharing goes one way, and the other side shares theirs on their own - is said to a screen reader.
  if (offer === 'share') rows.push(last => <ListRow key="mine" leading={phone} title="Podeli svoj broj" last={last} disabled={!enabled}
    accessibilityLabel="Podeli svoj broj" accessibilityHint="Deljenje je odvojeno u oba smera: druga strana ne deli automatski svoj broj." onPress={onTogglePhone} />);
  else if (offer === 'withdraw') rows.push(last => <ListRow key="mine" leading={phone} title="Opozovi deljenje broja" last={last} disabled={!enabled}
    subtitle="Druga strana vidi tvoj broj." accessibilityLabel="Opozovi deljenje broja" onPress={onTogglePhone} />);
  else if (offer === 'messages') rows.push(last => <ListRow key="mine" leading={<FactArt kind="chat" size={32} />} title="Kontakt kroz Poruke" last={last}
    subtitle="Na tvom nalogu nema broja telefona." accessibilityLabel="Kontakt kroz Poruke" onPress={onOpenMessages} />);
  const tail = physical ? (active ? (locationSlot ?? <AgreementPrivateLocation agreement={agreement} enabled={enabled && !concealed} onRequestAddress={onRequestAddress} />)
    : <T variant="note" tone="muted">Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.</T>) : null;
  if (!rows.length && !tail) return null;
  // A Dogovor that is over with no number to show says only that the place is closed: that is a quiet sentence, not a section with a title.
  if (!rows.length && physical && !active) return <View testID="agreement-contact-place" onLayout={onLayout}>{tail}</View>;
  const title = agreement.rezim === 'DALJINSKI' ? 'Kontakt' : 'Kontakt i mesto';
  // Where the number can be shared or taken back, the title carries the "ⓘ"; `Section` draws no title then, and this is its title's line.
  const explained = offer === 'share' || offer === 'withdraw';
  return <View testID="agreement-contact-place" onLayout={onLayout}>
    {explained ? <View style={s.head}>
      <T variant="heading" accessibilityRole="header" style={s.title}>{title}</T>
      <InfoButton title="Kako se deli broj" lines={NUMBER_LINES} />
    </View> : null}
    <Section title={explained ? undefined : title}>
      <View>{rows.map((row, index) => row(index === rows.length - 1))}</View>
      {tail}
    </Section>
  </View>;
}

const s = StyleSheet.create({
  // `Section`'s own title line: the `heading` type in ink, 12 above what the section holds.
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, marginBottom: layout.group },
  title: { flexGrow: 1, flexShrink: 1, color: sys.color.ink },
});
