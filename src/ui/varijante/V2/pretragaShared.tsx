import { useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { serbianToday, type DateRange, type MarketplaceView, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { Press } from '../../Press';
import { T } from '../../Text';
import { TurningCaret } from '../../system/Disclosure';
import { FlowFooter } from '../../system/FlowFooter';
import { useReducedMotion } from '../../system/motion';
import { osoba, zadataka } from '../../system/plural';
import { useLayoutClass } from '../../system/textScale';
import { brandAction, sys } from '../../system/tokens';
import { V2Action } from '../../v2/V2Action';
import { DateRangeGrid } from '../../v2/discovery/DateRangeGrid';
import { ANY_WHAT, CLEAR_ALL, PRICE, SECTION_LABEL, WHEN, WHERE, datesWords, quoted, said, whenWords } from '../../v2/discovery/discoveryWords';
import { PLACE_WORDS } from '../../v2/discovery/PlacePicker';
import { POPULAR_CITIES, foldPlace } from '../../v2/discovery/popularCities';
import { Choice, GroupTitle, PlaceRow, SearchField, Stepper } from '../../v2/discovery/SearchParts';
import { SEARCH_STEPS, type SearchStep } from '../../v2/discovery/SearchSection';
import { SearchSheet } from '../../v2/discovery/SearchSheet';
import { DELOVI_LIMAN, GRADOVI, NA_DALJINU_BROJ, OBLAST_BROJ, SADA, SVUDA_BROJ, type Grad } from './fixtures';

/**
 * Zajednički deo tri varijante pretrage: isti okvir panela kao danas (`SearchSheet`), isti nacrt izbora, iste reči (`discoveryWords`), isti
 * urednici koraka (`SearchParts`, `DateRangeGrid`), isto podnožje sa jednom zelenom radnjom. Varijante se razlikuju samo po tome KAKO su
 * koraci složeni: redovi sa brojem i panelom (A), rečenica od čipova (B), jedan korak po kadru (C). Brojevi su laboratorijska tabela
 * (`fixtures`), nikad izmišljeni u aplikaciji.
 */
export type Korak = SearchStep;
export const KORACI: readonly Korak[] = SEARCH_STEPS;

export type Nacrt = { place: string | null; area: boolean; nearby: boolean; when: WhenFilter; dates: DateRange | null; query: string;
  price: MarketplaceView['price']; places: number; where: WhereFilter };
export const PRAZAN: Nacrt = { place: null, area: false, nearby: false, when: 'any', dates: null, query: '', price: 'all', places: 1, where: 'any' };
export type Izmena = (patch: Partial<Nacrt>, complete?: boolean) => void;

const noop = () => undefined;

/** Koliko zadataka pokazuje list za ovaj nacrt, iz laboratorijske tabele: mesto ima svoj broj, oblast svoj, daljina svoj, inače svi. */
export function brojZadataka(n: Nacrt): number {
  if (n.where === 'remote') return NA_DALJINU_BROJ;
  if (n.place) return [...GRADOVI, ...DELOVI_LIMAN].find(place => foldPlace(place.text) === foldPlace(n.place ?? ''))?.count ?? 0;
  if (n.area) return OBLAST_BROJ;
  return SVUDA_BROJ;
}

/** „Gde“ u rečima, kao što ga danas kaže pilula. */
export function gdeReci(n: Nacrt): string {
  if (n.where === 'remote') return 'Na daljinu';
  if (n.nearby) return 'U blizini';
  if (n.place) return n.place;
  return n.area ? 'Ova oblast' : 'Svi zadaci';
}

/** Zatvoren odeljak kaže šta je u njemu izabrano, istim rečima kao danas. */
export function rezime(step: Korak, n: Nacrt): string {
  switch (step) {
    case 'gde': return gdeReci(n);
    case 'kada': return whenWords({ when: n.when, dates: n.dates }, SADA);
    case 'sta': return n.query.trim() ? quoted(n.query) : ANY_WHAT;
    case 'cena': return said(PRICE, n.price);
    case 'koliko': return osoba(n.places);
    case 'kako': return said(WHERE, n.where);
  }
}

/** Gradovi bez zadataka (laboratorija: iz spiska velikih gradova koji nisu u serverskoj listi). */
export const GRADOVI_BEZ: readonly string[] = POPULAR_CITIES.filter(city => !GRADOVI.some(grad => foldPlace(grad.text) === foldPlace(city))).slice(0, 5);

/** Da li mesto odgovara otkucanim slovima (bez dijakritika), kao što `PlacePicker` traži. */
export const slovaPogadjaju = (text: string, typed: string) => foldPlace(typed) === '' || foldPlace(text).includes(foldPlace(typed));

/* ----------------------------------------------------------------------------------------------- urednici koraka */

/** „Gde“ kao danas: polje, pa redovi sa predmetom (klipbord, mapa, osoba, pin) i brojem ispod imena. Koriste ga B i C. */
export function UrednikGde({ n, onChange, typed, onType }: { n: Nacrt; onChange: Izmena; typed: string; onType: (text: string) => void }) {
  const typing = foldPlace(typed) !== '';
  const gradovi = GRADOVI.filter(grad => slovaPogadjaju(grad.text, typed));
  const delovi = typing ? DELOVI_LIMAN.filter(deo => slovaPogadjaju(deo.text, typed)) : [];
  const bez = GRADOVI_BEZ.filter(city => slovaPogadjaju(city, typed));
  const svuda = !n.place && !n.area && !n.nearby;
  const pick = (patch: Partial<Nacrt>) => { onType(''); onChange({ place: null, area: false, nearby: false, ...patch }, true); };
  return <View style={s.urednik}>
    <SearchField value={typed} onChangeText={onType} label={PLACE_WORDS.field} placeholder={PLACE_WORDS.placeholder} clearLabel={PLACE_WORDS.clear}
      returnKeyType="search" onSubmit={Keyboard.dismiss} />
    <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.lista}>
      {typing ? null : <>
        <PlaceRow art="tasks" text="Svi zadaci" note={zadataka(SVUDA_BROJ)} label={`Svi zadaci, ${zadataka(SVUDA_BROJ)}`} checked={svuda} onPress={() => pick({})} />
        <PlaceRow art="map" text="Ova oblast" note={zadataka(OBLAST_BROJ)} label={`Ova oblast, ${zadataka(OBLAST_BROJ)}`} checked={n.area} onPress={() => pick({ area: true })} />
        <PlaceRow art="person" text="U blizini" note={PLACE_WORDS.nearbyNote} label="U blizini" hint={PLACE_WORDS.nearbyHint} checked={n.nearby} onPress={() => pick({ nearby: true })} />
      </>}
      {gradovi.length ? <GroupTitle>{PLACE_WORDS.citiesWithTasks}</GroupTitle> : null}
      {gradovi.map(grad => <PlaceRow key={grad.text} art="pin" text={grad.text} note={zadataka(grad.count ?? 0)} label={`${grad.text}, ${zadataka(grad.count ?? 0)}`}
        checked={n.place === grad.text} onPress={() => pick({ place: grad.text })} />)}
      {delovi.length ? <GroupTitle>{PLACE_WORDS.parts}</GroupTitle> : null}
      {delovi.map(deo => <PlaceRow key={deo.text} art="pin" text={deo.text} note={zadataka(deo.count ?? 0)} label={`${deo.text}, ${zadataka(deo.count ?? 0)}`}
        checked={n.place === deo.text} onPress={() => pick({ place: deo.text })} />)}
      {bez.length ? <GroupTitle>{PLACE_WORDS.popular}</GroupTitle> : null}
      {bez.map(city => <PlaceRow key={city} art="pin" text={city} note={PLACE_WORDS.noTasksYet} label={`${city}, ${PLACE_WORDS.noTasksYet}`}
        checked={n.place === city} onPress={() => pick({ place: city })} />)}
    </View>
  </View>;
}

export function UrednikKada({ n, onChange }: { n: Nacrt; onChange: Izmena }) {
  const [open, setOpen] = useState(!!n.dates);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const today = serbianToday(SADA);
  const tapDay = (day: string) => {
    if (day < today) return;
    if (rangeStart === null || day < rangeStart) { setRangeStart(day); onChange({ dates: { from: day, to: day }, when: 'any' }); return; }
    setRangeStart(null);
    onChange({ dates: { from: rangeStart, to: day }, when: 'any' });
  };
  return <View style={s.urednik}>
    <Choice compact label="Kada" options={WHEN} value={n.dates ? null : n.when} onChange={when => { setRangeStart(null); onChange({ when, dates: null }, true); }} />
    <Press accessibilityRole="button" accessibilityLabel="Datumi" accessibilityValue={{ text: n.dates ? datesWords(n.dates, SADA) : 'Izaberi datume' }}
      accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} haptic="select" hitSlop={0} scaleTo={sys.motion.scale.row} style={s.datumi}>
      <T variant="copy" style={[s.grow, n.dates ? s.datumiOn : s.ink]}>{n.dates ? datesWords(n.dates, SADA) : 'Izaberi datume'}</T>
      <TurningCaret open={open} />
    </Press>
    {open ? <View style={s.kalendar}>
      <DateRangeGrid today={today} from={rangeStart ?? n.dates?.from ?? null} to={rangeStart ? null : n.dates?.to ?? null} now={SADA} onDay={tapDay} />
      <T variant="note" tone="muted" accessibilityLiveRegion="polite">{rangeStart ? 'Izaberi poslednji dan.' : 'Izaberi prvi i poslednji dan.'}</T>
      {n.dates ? <V2Action label="Gotovo" kind="secondary" onPress={() => { setOpen(false); setRangeStart(null); onChange({}, true); }} /> : null}
    </View> : null}
  </View>;
}

export function UrednikSta({ n, onChange }: { n: Nacrt; onChange: Izmena }) {
  return <View style={s.urednik}>
    <SearchField value={n.query} onChangeText={query => onChange({ query })} label="Šta tražiš" placeholder="Npr. selidba, farbanje, košenje"
      clearLabel="Obriši reč" returnKeyType="done" onSubmit={() => onChange({}, true)} />
    <T variant="note" tone="muted">Traži se u naslovima, mestu i uslovima zadataka.</T>
  </View>;
}

export function UrednikCena({ n, onChange }: { n: Nacrt; onChange: Izmena }) {
  return <Choice label="Cena" options={PRICE} value={n.price} onChange={price => onChange({ price }, true)} />;
}

export function UrednikKoliko({ n, onChange }: { n: Nacrt; onChange: Izmena }) {
  const { stacked } = useLayoutClass();
  return <View style={s.urednik}>
    <View style={[s.ljudi, stacked && s.ljudiStacked]}><Stepper value={n.places} expanded={stacked} onChange={places => onChange({ places })} /></View>
    <T variant="note" tone="muted">Prikazujemo zadatke koji imaju dovoljno slobodnih mesta za toliko ljudi.</T>
    <V2Action label="Gotovo" kind="secondary" onPress={() => onChange({}, true)} />
  </View>;
}

export function UrednikKako({ n, onChange }: { n: Nacrt; onChange: Izmena }) {
  return <Choice label="Način rada" options={WHERE} value={n.where} onChange={where => onChange({ where }, true)} />;
}

/** Urednik jednog koraka, isti u svim varijantama osim „Gde“ varijante A. */
export function Urednik({ step, n, onChange, typed, onType }: { step: Korak; n: Nacrt; onChange: Izmena; typed: string; onType: (text: string) => void }) {
  switch (step) {
    case 'gde': return <UrednikGde n={n} onChange={onChange} typed={typed} onType={onType} />;
    case 'kada': return <UrednikKada n={n} onChange={onChange} />;
    case 'sta': return <UrednikSta n={n} onChange={onChange} />;
    case 'cena': return <UrednikCena n={n} onChange={onChange} />;
    case 'koliko': return <UrednikKoliko n={n} onChange={onChange} />;
    case 'kako': return <UrednikKako n={n} onChange={onChange} />;
  }
}

/* ------------------------------------------------------------------------------------------------- okvir i podnožje */

/** Podnožje svakog toka: tiho „Poništi filtere“ uz jednu zelenu „Prikaži N zadataka“; pri velikom tekstu jedno pod drugim. */
export function PretragaPodnozje({ count, onReset }: { count: number; onReset: () => void }) {
  const { stacked } = useLayoutClass();
  const show = count > 0 ? { label: `Prikaži ${zadataka(count)}`, disabled: false } : { label: 'Nema zadataka za ove uslove', disabled: true };
  return <FlowFooter reason={count > 0 ? undefined : 'Pokušaj sa širom oblašću ili drugim danom.'}>
    <View style={[s.actions, stacked && s.actionsStacked]}>
      <V2Action label={CLEAR_ALL} kind="quiet" tone="neutral" compact style={s.reset} onPress={onReset} />
      <View accessibilityLiveRegion="polite" style={[s.grow, stacked && s.showStacked]}>
        <V2Action label={show.label} disabled={show.disabled} onPress={noop} style={brandAction} />
      </View>
    </View>
  </FlowFooter>;
}

/** Današnji okvir panela (list od 85 %, zatamnjen ekran iza, × gore desno), sa sadržajem varijante i podnožjem. Ništa ne zatvara: laboratorija. */
export function PretragaList({ title = 'Pretraga', footer, children }: { title?: string; footer: ReactNode; children: ReactNode }) {
  const reduced = useReducedMotion();
  return <SearchSheet reduced={reduced} backdrop="dim" expanded={false} closing={false} title={title} closeLabel="Zatvori pretragu"
    closeHint="Lista ostaje kakva je bila." footer={footer} onCloseButton={noop} onRequestClose={noop} onClosed={noop}>
    {children}
  </SearchSheet>;
}

export { SECTION_LABEL };

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  urednik: { gap: sys.space.md },
  lista: { gap: sys.space.xs },
  datumi: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: sys.touch.min, paddingHorizontal: sys.space.md,
    paddingVertical: sys.space.sm, backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  datumiOn: { color: sys.color.ink, fontWeight: '600' },
  kalendar: { gap: sys.space.sm },
  ljudi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.md },
  ljudiStacked: { flexDirection: 'column', alignItems: 'stretch' },
  reset: { paddingHorizontal: 0, flexShrink: 1, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  actionsStacked: { flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  showStacked: { flex: 0, width: '100%' },
});
export type { Grad };
