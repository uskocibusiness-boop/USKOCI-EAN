import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { T } from '../Text';
import { AgreementPrivateLocation } from '../AgreementPrivateLocation';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';

/**
 * "Kontakt i mesto" (plan 2.6): ONE open section where a closed "Kontakt" and a closed "Lokacija i pristup" used to stand. The
 * number of the other side, the one command that shares or withdraws mine, and the place - which is private: its exact address
 * and its map, with the map's own "open in maps" action, appear only through the location grant that `AgreementPrivateLocation`
 * reads and fences, exactly as before. Opening the screen now starts that read; it used to start when the closed row was opened.
 *
 * Back from the background the page keeps its last content while it is read again, but nothing private is drawn until the fresh
 * read has landed (`concealed`): not the number and not the place. The section keeps its place, so the page does not jump.
 */
export function AgreementContactPlace({ agreement, enabled, concealed = false, canShare, onTogglePhone }: {
  agreement: DogovorProjekcija; enabled: boolean;
  /** The page is showing its last content while a fresh read is on the way: the private part waits for it. */
  concealed?: boolean;
  /** I am a side of an agreed Dogovor: the sharing command is mine to give. */
  canShare: boolean;
  onTogglePhone: () => void;
}) {
  const active = agreement.stanje === 'CONFIRMED' || agreement.stanje === 'AWAITING_REQUESTER';
  const shared = agreement.kontakt.mojTelefonPodeljen, theirs = agreement.kontakt.njihovTelefon;
  const physical = agreement.rezim !== 'DALJINSKI' && agreement.kontakt.lokacijaPostoji;
  return <View testID="agreement-contact-place" style={s.section}>
    <View style={s.head}>
      <View style={s.art}><FactArt kind="phone" size={26} /></View>
      <T accessibilityRole="header" variant="bodyStrong" style={s.title}>Kontakt i mesto</T>
    </View>
    <View style={s.body}>
      <T variant="note" tone="muted">{shared ? 'Tvoj broj je podeljen.' : 'Tvoj broj nije podeljen.'}</T>
      {concealed ? <T variant="body" tone="muted">Proveravamo broj druge strane…</T>
        : <T variant="body" style={s.ink}>Broj druge strane: {theirs ?? 'još nije podeljen'}</T>}
      <T variant="meta" tone="muted">Deljenje je odvojeno u oba smera. Kada podeliš svoj broj, druga strana ne deli automatski svoj.</T>
      {active && canShare ? <V2Action label={shared ? 'Opozovi deljenje broja' : 'Podeli svoj broj'} disabled={!enabled} onPress={onTogglePhone} /> : null}
      {physical ? (active ? <AgreementPrivateLocation agreement={agreement} enabled={enabled && !concealed} />
        : <T variant="note" tone="muted">Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.</T>) : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  section: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: sys.space.md, gap: sys.space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  art: { width: 32, alignItems: 'center' },
  title: { color: sys.color.ink, flex: 1 },
  body: { gap: sys.space.md, paddingBottom: sys.space.sm },
  ink: { color: sys.color.ink },
});
