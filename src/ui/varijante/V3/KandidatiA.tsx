import { Animated, StyleSheet, View } from 'react-native';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';
import { ProductHeader } from '../../product/ProductDetails';
import { FactRow } from '../../system/FactRow';
import { layout } from '../../system/layout';
import { ListRow } from '../../system/ListRow';
import { osoba, prijava } from '../../system/plural';
import { Screen } from '../../system/Screen';
import { StateView } from '../../system/StateView';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { T } from '../../Text';
import { V2Action } from '../../v2/V2Action';
import { candidateHas, candidateTerm, candidateTrust, candidateValue, UNPRICED } from '../../v2/CandidateFace';
import { Lice, Ocena, nazadNaSpisak, naScenu, useSat, uskok, KadarOznaka } from './pomocno';
import { razdvojIznos, razlogPrijave, type Razlog } from './podaci';

/**
 * Kandidati · varijanta A „Ponude preko stola“ (iz osobe i predmeta; pravac C.13, B1 odozgo + B4 lice + B5 iznos).
 *
 * Šta vodi: red lica (56) sa IZNOSOM desno u istom redu, kao ponude položene preko stola: osoba i njena cena su jedno. Svaka
 * kartica je isti šablon od pet redova (R1 R-14): lice · ime + zvezdica · iznos 20/700 desno; termin; „Ima“; oznaka RAZLOGA
 * umesto čipa „Poslata“ (svaka prijava ovde je poslata, pa to ne piše; piše ono što se meri: najniža cena, najviša ocena, ima
 * kombi, dolazi u terminu zadatka; upozorenje kad se ne može izabrati); poruka u navodnicima, dva reda. Kartica je jedan zapis
 * koji se dodiruje (`Surface record`) i ništa drugo u njoj nije kontrola.
 *
 * Pokret: pri prvom učitavanju ponude STIŽU odozgo (tuđe ulazi odozgo, B1), 240 ms, 40 ms razmaka, najviše šest; ništa se
 * drugo ne pomera. U laboratoriji dodir kartice vodi pravo na trenutak „Dogovoreno!“ ove varijante (`dogovoreno-A`); u
 * aplikaciji bi vodio na ponudu i njen izbor, kao danas. Bez servera: svaki podatak je iz `podaci.ts`.
 */
export function KandidatiA({ need, candidates, holdAt }: { need: PotrebaProjekcija; candidates: readonly KandidatProjekcija[]; holdAt?: number }) {
  const rows = Math.min(candidates.length, 6);
  const sat = useSat(sys.motion.enter + rows * sys.motion.stagger, holdAt);
  const places = need.pokrivenost.preostalo > 0 ? `Slobodna mesta: ${need.pokrivenost.preostalo} od ${need.pokrivenost.ukupno}` : 'Sva mesta su popunjena';
  const birljive = candidates.filter(k => k.stanje === 'SELECTABLE').length;
  const brojanje = `${prijava(candidates.length)}${birljive !== candidates.length ? ` · ${birljive} za izbor` : ''}`;
  return <Screen kind="detail" scroll={candidates.length > 0}
    header={<ProductHeader title="Prijave" backLabel="Nazad na zadatak" back={nazadNaSpisak}
      right={candidates.length > 1 ? <V2Action label="Uporedi" kind="quiet" compact onPress={() => naScenu('kandidati-B')} /> : undefined} />}>
    <View style={s.glava}>
      <ListRow title={readableTitle(need.naslov)} subtitle={places} last accessibilityLabel={`Zadatak: ${readableTitle(need.naslov)}. ${places}`} />
      {candidates.length ? <T variant="note" tone="muted">{brojanje}</T> : null}
    </View>
    {candidates.length ? <View style={s.lista}>
      {candidates.map((k, index) => <Animated.View key={k.prijavaId} style={index < rows ? uskok(sat.clock, index * sys.motion.stagger, 'above') : undefined}>
        <Ponuda candidate={k} need={need} razlog={razlogPrijave(k, candidates, need.taskTimezone)} onOpen={() => naScenu('dogovoreno-A')} />
      </Animated.View>)}
    </View> : <StateView kind="empty" art="offers" title="Još nema prijava" body="Kad neko pošalje prijavu za ovaj zadatak, videćeš je ovde."
      quiet={{ label: 'Osveži prijave', onPress: () => undefined }} />}
    <KadarOznaka t={holdAt} />
  </Screen>;
}

/** Jedna ponuda: šablon od pet redova, jedan dodir. */
function Ponuda({ candidate: k, need, razlog, onOpen }: { candidate: KandidatProjekcija; need: PotrebaProjekcija; razlog: Razlog | null; onOpen: () => void }) {
  const value = candidateValue(k), has = candidateHas(k), trust = candidateTrust(k);
  const termin = candidateTerm(k, need.taskTimezone, need.vremeTekst);
  const poruka = k.napomena?.trim();
  const spoken = [k.ime, trust.spoken, value.kind === 'amount' ? `${value.amount} ${value.basis}` : UNPRICED, termin, has?.text, razlog?.text,
    poruka ? `poruka: ${poruka}` : null].filter(Boolean).join(', ');
  return <Surface kind="record" onPress={onOpen} accessibilityLabel={`Pogledaj prijavu: ${spoken}`} accessibilityHint="Otvara celu prijavu.">
    <View style={s.red1}>
      <Lice inicijali={k.inicijali} size={layout.slotFace} />
      <View style={s.osoba}>
        <T variant="bodyStrong" style={s.ime}>{k.ime}</T>
        <Ocena candidate={k} />
      </View>
      <View style={s.iznos}>
        {value.kind === 'amount' ? <>
          <T variant="priceSmall" style={s.novac}>{razdvojIznos(value.amount)[0]}</T>
          <T variant="meta" tone="muted" style={s.valuta}>{`${razdvojIznos(value.amount)[1]} ${value.basis}`.trim()}</T>
        </> : <T variant="note" tone="muted" style={s.bezCene}>{UNPRICED}</T>}
      </View>
    </View>
    <FactRow art="calendar" value={termin} />
    <FactRow art="users" value={osoba(k.pokrivaMesta)} />
    {has ? <FactRow art={has.art} value={has.text} /> : null}
    {razlog ? <View style={s.razlog}>
      <View style={[s.tacka, razlog.tone === 'warn' ? s.tackaWarn : razlog.tone === 'green' ? s.tackaGreen : s.tackaMuted]} />
      <T variant="note" style={[s.razlogText, razlog.tone === 'warn' && s.razlogWarn]}>{razlog.text}</T>
    </View> : null}
    {poruka ? <T variant="note" tone="muted" numberOfLines={2}>{`„${poruka}“`}</T> : null}
  </Surface>;
}

const s = StyleSheet.create({
  glava: { gap: sys.space.sm },
  lista: { gap: layout.group },
  red1: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, marginBottom: sys.space.md },
  osoba: { flex: 1, minWidth: 0, gap: sys.space.xs },
  ime: { color: sys.color.ink },
  // Broj drži svoju širinu, ime popušta (nikad obrnuto); valuta i osnova su jedna tiha reč ispod.
  iznos: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '40%' },
  novac: { color: sys.color.money, textAlign: 'right' },
  valuta: { textAlign: 'right' },
  bezCene: { textAlign: 'right', maxWidth: 110 },
  razlog: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, marginTop: sys.space.md },
  tacka: { width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill },
  tackaGreen: { backgroundColor: sys.color.green }, tackaMuted: { backgroundColor: sys.color.muted }, tackaWarn: { backgroundColor: sys.color.orange },
  razlogText: { flexShrink: 1, fontWeight: '600', color: sys.color.ink },
  razlogWarn: { color: sys.color.warn },
});
