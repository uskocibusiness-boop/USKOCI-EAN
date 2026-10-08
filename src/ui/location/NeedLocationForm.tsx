import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { V2Action as Button } from '../v2/V2Action';
import { brandAction, sys } from '../system/tokens';
import { FactArt } from '../system/FactArt';
import { FlowFooter } from '../system/FlowFooter';
import { Surface } from '../system/Surface';
import { layout as grid } from '../system/layout';
import { T } from '../Text';
import { LocationChoice, LocationDetails, LocationField, PrivateLocationNote, locationStyles as s } from './LocationControls';
import { CountryField, countryName, selectableCountry, useCountryOptions, type CountryOptions } from './CountryField';
import { LocationPointEditor } from './LocationPointEditor';
import type { createConfiguredLocationResolver } from '../../data/configuredLocationResolver';

const MODES: ReadonlyArray<[NeedTaskGeography['mode'], string]> = [
  ['STATIONARY', 'Na jednom mestu'], ['POINT_TO_POINT', 'Od mesta do mesta'],
  ['MULTI_STOP', 'Više stanica'], ['AREA_BASED', 'Na području'], ['REMOTE', 'Na daljinu'],
];

/** One place of the task, as fields on the page: no box of its own (a card inside the form's groups was a card in a card). */
function PlaceFields({ title, value, disabled, onChange }: { title: string; value: NeedTaskGeographyPoint;
  disabled: boolean; onChange: (value: NeedTaskGeographyPoint) => void }) {
  const field = (key: 'city' | 'area' | 'label', text: string) => {
    const next = { ...value };
    if (text) next[key] = text; else delete next[key];
    onChange(next);
  };
  return <View style={s.section}>
    {/* The name of the place stands once, as the label of its field; the full names stay for a screen reader. */}
    <LocationField label={`${title} — grad ili mesto`} shownLabel={title} value={value.city ?? ''} maxLength={160}
      editable={!disabled} onChangeText={text => field('city', text)} />
    <LocationDetails label={`${title} — dodatni javni opis`} shownLabel="Dodatni javni opis" disabled={disabled}
      summary={[value.area, value.label].filter(Boolean).join(' · ') || 'Deo grada i opis područja, opciono'}>
    <LocationField label={`${title} — deo grada (opciono)`} shownLabel="Deo grada (opciono)" value={value.area ?? ''} maxLength={160}
      editable={!disabled} onChangeText={text => field('area', text)} />
    <LocationField label={`${title} — javni opis (opciono)`} shownLabel="Javni opis (opciono)" value={value.label ?? ''} maxLength={240}
      hint="Ovo je javno. Unesi samo približno područje, bez adrese, broja stana ili kontakta."
      editable={!disabled} onChangeText={text => field('label', text)} />
    </LocationDetails>
  </View>;
}

/** The head of one of the two groups: what everybody sees, and what only a Dogovor reveals. */
function GroupHeader({ art, label }: { art: 'eye' | 'lock'; label: string }) {
  return <View style={f.groupHeader}>
    <FactArt kind={art} size={20} />
    <T variant="heading" accessibilityRole="header" style={f.groupTitle}>{label}</T>
  </View>;
}

type FormProps = {
  review: NeedLocationReview; busy: boolean; uncertain: boolean; onSave: (value: NeedLocationInput) => void;
  resolver?: ReturnType<typeof createConfiguredLocationResolver>;
  /** V5 prepares this value for the one final review; it does not confirm facts. */
  reviewOnly?: boolean;
  /**
   * `inline` (default) is the form alone, for a caller that scrolls it. `screen` is a whole step: the form scrolls on its
   * own and the one save stands in a footer under it, always in reach.
   */
  layout?: 'inline' | 'screen';
  /** The countries to choose from, when the caller already holds them (the design gallery, which reads nothing). */
  countries?: CountryOptions;
};

export function NeedLocationForm(props: FormProps) {
  return props.countries ? <LocationFormBody {...props} options={props.countries} /> : <WithCountries {...props} />;
}
function WithCountries(props: FormProps) {
  const options = useCountryOptions();
  return <LocationFormBody {...props} options={options} />;
}

function LocationFormBody({ review, busy, uncertain, onSave, resolver, reviewOnly = false, layout = 'inline', options: countryOptions }:
  FormProps & { options: CountryOptions }) {
  const current = review.value.geography;
  const [country, setCountry] = useState<string | null>(review.value.taskCountryCode);
  const [mode, setMode] = useState<NeedTaskGeography['mode']>(current?.mode ?? 'STATIONARY');
  const [start, setStart] = useState<NeedTaskGeographyPoint>(current?.start ?? {});
  const [areaStart, setAreaStart] = useState<NeedTaskGeographyPoint | null>(current?.mode === 'AREA_BASED' ? current.start ?? null : null);
  const [end, setEnd] = useState<NeedTaskGeographyPoint>(current?.end ?? {});
  const [area, setArea] = useState<NeedTaskGeographyPoint>(current?.serviceArea ?? {});
  const [waypoints, setWaypoints] = useState<NeedTaskGeographyPoint[]>(current?.waypoints ?? []);
  const [address, setAddress] = useState(review.value.exactAddress ?? '');
  const [notes, setNotes] = useState(review.value.accessNotes ?? '');
  const [invalid, setInvalid] = useState(false);
  const [points, setPoints] = useState<readonly ConfirmedLocationPoint[]>(review.value.resolvedLocation?.points ?? []);
  const [pinEpoch, setPinEpoch] = useState(0);
  const [activeSlot, setActiveSlot] = useState<LocationSlot | null>(null);
  const [pendingPoint, setPendingPoint] = useState(false);
  const disabled = busy || uncertain || !review.editable;
  const change = (fn: () => void, invalidatePins = true) => {
    if (disabled) return;
    fn(); setInvalid(false);
    if (invalidatePins) { setPoints([]); setPinEpoch(value => value + 1); setActiveSlot(null); setPendingPoint(false); }
  };
  function currentLocation() {
    let geography: NeedTaskGeography;
    switch (mode) {
      case 'REMOTE': geography = { mode }; break;
      case 'STATIONARY': geography = { mode, start }; break;
      case 'POINT_TO_POINT': geography = { mode, start, end }; break;
      case 'MULTI_STOP': geography = { mode, start, ...(Object.keys(end).length ? { end } : {}), waypoints }; break;
      case 'AREA_BASED': geography = { mode, ...(areaStart ? { start: areaStart } : {}),
        ...(Object.keys(area).length ? { serviceArea: area } : {}) }; break;
    }
    return normalizeNeedLocation({ taskCountryCode: country, geography, exactAddress: mode === 'REMOTE' ? null : address.trim() || null,
      accessNotes: mode === 'REMOTE' ? null : notes.trim() || null });
  }
  const baseValue = currentLocation();
  const slots = baseValue ? locationSlots(baseValue.geography) : [];
  const titleForSlot = (slot: LocationSlot) => slot === 'start' ? (mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište')
    : slot === 'end' ? 'Odredište' : slot === 'serviceArea' ? 'Područje rada' : `Stanica ${Number(slot.split('/')[1]) + 1}`;
  const selectedSlot = activeSlot && slots.includes(activeSlot) ? activeSlot : slots[0];
  // Keep the last confirmed value as the editor's restore baseline. A pending
  // draft is neither counted as confirmed nor eligible for the form's save.
  const confirmedPoints = points.filter(point => !pendingPoint || point.slot !== selectedSlot);
  function submit() {
    if (disabled || pendingPoint || !selectableCountry(countryOptions.countries, country)) return;
    if (!baseValue) { setInvalid(true); return; }
    const value = normalizeNeedLocation({ ...baseValue, resolvedLocation: mode !== 'REMOTE' && points.length ? {
      version: 1, binding: { taskCountryCode: baseValue.taskCountryCode, geography: baseValue.geography, exactAddress: baseValue.exactAddress }, points,
    } : null });
    if (!value) { setInvalid(true); return; }
    onSave(value);
  }
  const discardPending = () => { if (!disabled) { setPendingPoint(false); setPinEpoch(value => value + 1); } };
  const reason = saveBlockReason({ busy, uncertain, editable: review.editable, pendingPoint,
    countryChosen: !!country, countrySelectable: selectableCountry(countryOptions.countries, country) });

  const body = <>
    {!review.editable ? <Surface kind="note" tone="warn"><T accessibilityRole="alert">Ovaj pregled više nije dostupan za izmene. Vrati se na zadatak.</T></Surface> : null}
    {/* The country and the working mode are chosen once and rarely changed, so they fold into one row that says what is
        chosen (owner's rule of place, 2026-09-23) — open from the start only while the country is unset. */}
    <LocationDetails label="Država i način rada" disabled={disabled} initiallyOpen={!country || !selectableCountry(countryOptions.countries, country)}
      summary={`${countryName(country) ?? 'Država nije izabrana'} · ${MODES.find(([value]) => value === mode)?.[1] ?? ''}`}>
      <CountryField label="Država zadatka" value={country} disabled={disabled} options={countryOptions}
        onChange={code => change(() => setCountry(code))} />
      <LocationChoice label="Način rada" value={mode} options={MODES.map(([value, label]) => ({ value, label }))}
        disabled={disabled} onChange={value => change(() => setMode(value as NeedTaskGeography['mode']))} />
    </LocationDetails>
    {mode === 'REMOTE' ? <View style={s.notice}><T>Rad na daljinu nema adresu, pin ili radijus. Čuvanjem se uklanjaju podaci o fizičkom mestu iz ovog pregleda.</T></View> : <>
      <View style={f.group}>
        <GroupHeader art="eye" label="Vide svi" />
        {mode !== 'AREA_BASED' ? <PlaceFields title={mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište'} value={start}
          disabled={disabled} onChange={value => change(() => setStart(value))} /> : <PlaceFields title="Područje rada" value={area}
          disabled={disabled} onChange={value => change(() => setArea(value))} />}
        {mode === 'AREA_BASED' ? areaStart ? <View style={s.section}>
          <PlaceFields title="Početna tačka" value={areaStart} disabled={disabled}
            onChange={value => change(() => setAreaStart(value))} />
          <Button label="Ukloni početnu tačku" kind="quiet" disabled={disabled}
            onPress={() => { if (!disabled) change(() => setAreaStart(null)); }} />
        </View> : <Button label="Dodaj početnu tačku (opciono)" kind="secondary" disabled={disabled}
          onPress={() => { if (!disabled) change(() => setAreaStart({})); }} /> : null}
        {mode === 'MULTI_STOP' ? <View style={s.section}>
          {waypoints.map((point, index) => <View key={index} style={s.section}>
            <PlaceFields title={`Stanica ${index + 1}`} value={point} disabled={disabled}
              onChange={value => change(() => setWaypoints(points => points.map((old, i) => i === index ? value : old)))} />
            <View style={f.stopActions}>
              <Button label={`Ukloni stanicu ${index + 1}`} kind="quiet" disabled={disabled}
                onPress={() => change(() => setWaypoints(points => points.filter((_, i) => i !== index)))} />
              {index > 0 ? <Button label={`Pomeri stanicu ${index + 1} ranije`} kind="quiet" disabled={disabled}
                onPress={() => change(() => setWaypoints(old => { const next = [...old];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }))} /> : null}
            </View>
          </View>)}
          <Button label="Dodaj stanicu" kind="secondary" disabled={disabled || waypoints.length >= 20}
            onPress={() => change(() => setWaypoints(points => [...points, {}]))} />
        </View> : null}
        {mode === 'POINT_TO_POINT' || mode === 'MULTI_STOP' ? <PlaceFields title="Odredište" value={end}
          disabled={disabled} onChange={value => change(() => setEnd(value))} /> : null}
      </View>
      <View style={f.group}>
        <GroupHeader art="lock" label="Samo u Dogovoru" />
        <PrivateLocationNote />
        {!baseValue || !slots.length ? <T>Prvo unesi državu i javno mesto za potrebne tačke.</T> : <>
          <T variant="body">Potvrđeno tačaka: {confirmedPoints.length} od {slots.length}</T>
          {slots.length > 1 ? <LocationChoice label="Tačka koju uređuješ" value={selectedSlot}
            options={slots.map(slot => ({ value: slot, label: `${titleForSlot(slot)}${pendingPoint && slot === selectedSlot
              ? ' · čeka potvrdu' : confirmedPoints.some(point => point.slot === slot) ? ' · potvrđeno' : ''}` }))}
            disabled={disabled || pendingPoint} onChange={slot => { if (!disabled && !pendingPoint) setActiveSlot(slot as LocationSlot); }} /> : null}
          {selectedSlot ? <LocationPointEditor key={`${pinEpoch}:${selectedSlot}`} slot={selectedSlot} title={titleForSlot(selectedSlot)}
            countryCode={baseValue.taskCountryCode}
            initialQuery={[mode === 'STATIONARY' ? address : '', selectedSlot === 'start' ? start.city : selectedSlot === 'end' ? end.city
              : selectedSlot === 'serviceArea' ? area.city : waypoints[Number(selectedSlot.split('/')[1])]?.city].filter(Boolean).join(', ')}
            resolver={resolver} confirmAsPrimary={false}
            point={points.find(point => point.slot === selectedSlot)} disabled={disabled}
            scopeKey={`${review.accountId}:${review.conversationId}:${review.revision}:${pinEpoch}:${selectedSlot}`}
            onInvalidate={() => change(() => setPendingPoint(true), false)}
            onConfirm={point => change(() => { setPoints(old => [...old.filter(item => item.slot !== selectedSlot), point]); setPendingPoint(false); }, false)} /> : null}
          {confirmedPoints.length < slots.length ? <T variant="meta" tone="muted">Mesto je potpuno potvrđeno tek kada potvrdiš sve tačke.</T> : null}
        </>}
        <LocationDetails label="Privatni detalji zadatka" disabled={disabled} summary={address || notes ? 'Adresa ili napomene su unete. Otvori za pregled.' : 'Tačna adresa i pristup, opciono'}>
        <LocationField label="Tačna adresa (privatno, opciono)" value={address} maxLength={1000}
          editable={!disabled} onChangeText={text => change(() => setAddress(text))} />
        <LocationField label="Napomene za pristup (privatno, opciono)" value={notes} maxLength={2000} multiline
          editable={!disabled} onChangeText={text => change(() => setNotes(text), false)} />
        </LocationDetails>
      </View>
    </>}
    {invalid ? <T accessibilityRole="alert" tone="danger">Unesi mesto za svaku potrebnu tačku. Ruta sa više stanica mora imati odredište ili bar jednu stanicu.</T> : null}
  </>;
  // The one green action of the step, with its reason under it when it is grey (owner rule, 2026-09-23); while a point
  // waits for its confirmation, the one way to drop it stands right here, where the grey save is.
  const save = <>
    <Button style={brandAction} label={reviewOnly ? 'Primeni izmenu mesta' : 'Sačuvaj mesto'} loading={busy}
      disabled={disabled || pendingPoint || !selectableCountry(countryOptions.countries, country)} onPress={submit} />
    {pendingPoint ? <Button label="Odbaci nepotvrđenu tačku" kind="quiet" disabled={disabled} onPress={discardPending} /> : null}
  </>;
  const consequence = !reason && !busy ? <T variant="note" tone="muted">{reviewOnly ? 'Mesto će biti prikazano u završnom pregledu. Zadatak još nije objavljen.'
    : 'Čuva se mesto u istom pregledu. Zadatak još nije objavljen.'}</T> : null;
  if (layout === 'screen') return <View style={f.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={f.scroll}>{body}{consequence}</ScrollView>
    <FlowFooter reason={reason ?? undefined}>{save}</FlowFooter>
  </View>;
  return <View style={f.inline}>{body}{reason ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">{reason}</T> : consequence}{save}</View>;
}

/** Why the one save is grey, or null when it is live (or while it is at work: its spinner says so). */
export function saveBlockReason(state: { busy: boolean; uncertain: boolean; editable: boolean; pendingPoint: boolean;
  countryChosen: boolean; countrySelectable: boolean }): string | null {
  if (state.busy) return null;
  if (!state.editable) return 'Ovaj pregled više nije dostupan za izmene.';
  if (state.uncertain) return 'Ne znamo da li je prethodna radnja uspela.';
  if (state.pendingPoint) return 'Potvrdi tačku na mapi, pa sačuvaj mesto.';
  if (!state.countryChosen) return 'Izaberi državu u „Država i način rada“, pa sačuvaj mesto.';
  if (!state.countrySelectable) return 'Izabrana država još nije dostupna. Izaberi dostupnu u „Država i način rada“.';
  return null;
}

const f = StyleSheet.create({
  inline: { gap: grid.section },
  screen: { flex: 1 },
  scroll: { paddingHorizontal: grid.gutter, paddingTop: sys.space.sm, gap: grid.section, paddingBottom: grid.section },
  group: { gap: sys.space.base },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  groupTitle: { flex: 1, color: sys.color.ink },
  stopActions: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
});
