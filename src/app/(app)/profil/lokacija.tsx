import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { CoarsePosition, WorkerLocation, WorkerLocationInput } from '../../../contracts/location';
import { workerLocationClientService } from '../../../data/locationClientService';
import { normalizeWorkerLocation } from '../../../lib/location';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useUnsavedProfileBack } from '../../../hooks/useUnsavedProfileBack';
import { LocationField, locationStyles } from '../../../ui/location/LocationControls';
import { layout } from '../../../ui/system/layout';
import { brandAction, sys } from '../../../ui/system/tokens';
import { V2Action } from '../../../ui/v2/V2Action';
import { T } from '../../../ui/Text';
import { Press } from '../../../ui/Press';
import { FactArt } from '../../../ui/system/FactArt';
import { StateView } from '../../../ui/system/StateView';
import { CountryField, selectableCountry, useCountryOptions } from '../../../ui/location/CountryField';
import { ResolvedPinMap } from '../../../ui/location/ResolvedPinMap';
import { displayedPinPosition } from '../../../ui/location/ResolvedPinMap.types';
import { WorkerAreaSearch } from '../../../ui/location/WorkerAreaSearch';
import { WorkerProfileFrame } from '../../../ui/workerProfile/WorkerProfilePresentation';
import type { createConfiguredLocationResolver } from '../../../data/configuredLocationResolver';

/** The form's two parts: fields and the save action that stays above the keyboard. */
export type WorkerLocationParts = { body: ReactNode; footer: ReactNode };
type WorkerLocationFormProps = { location: WorkerLocation; busy: boolean; uncertain: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  resolver?: Pick<ReturnType<typeof createConfiguredLocationResolver>, 'search' | 'cancel'>; onSave: (value: WorkerLocationInput) => void;
  /** Where the route places the parts (the screen's sticky footer); by default they are drawn one under the other. */
  children?: (parts: WorkerLocationParts) => ReactElement;
  /** Why the last save did not go through, drawn under the save. */ error?: string | null;
  /** Reads the saved state again; after an unknown outcome or a failed read it replaces the save. */ onRetry?: () => void;
  /** The saved state is being read again (the form stays on screen): the save waits and says why, without a spinner. */
  reading?: boolean;
  /** The last save was confirmed: while nothing has changed since, the footer says so instead of asking for a confirmation. */
  saved?: boolean;
  /** Countries handed in (the design gallery, which reads nothing); otherwise the market list is read here. */
  countryOptions?: CountryOptions };
type CountryOptions = ReturnType<typeof useCountryOptions>;
export function WorkerLocationForm(props: WorkerLocationFormProps) {
  const key = `${props.location.accountId}:${props.location.profileId}:${props.location.revision}`;
  return props.countryOptions ? <ScopedWorkerLocationForm key={key} {...props} countryOptions={props.countryOptions} />
    : <LiveWorkerLocationForm key={key} {...props} />;
}
function LiveWorkerLocationForm(props: WorkerLocationFormProps) {
  const countryOptions = useCountryOptions();
  return <ScopedWorkerLocationForm {...props} countryOptions={countryOptions} />;
}
/** Common distances, one tap each. They only fill the field; nothing stores them as a vocabulary. */
const RADII = [5, 10, 20, 50, 100] as const;
const stacked = ({ body, footer }: WorkerLocationParts) => <View style={{ gap: 24 }}>{body}{footer}</View>;
const samePosition = (a: CoarsePosition | null, b: CoarsePosition | null) =>
  a === b || (!!a && !!b && a.latitude === b.latitude && a.longitude === b.longitude);
function ScopedWorkerLocationForm({ location, busy, uncertain, onSave, resolver, children = stacked, error: refusal, onRetry, countryOptions,
  reading = false, saved = false, onDirtyChange }: WorkerLocationFormProps & { countryOptions: CountryOptions }) {
  const [city, setCity] = useState(location.city);
  const [country, setCountry] = useState<string | null>(location.operatingCountryCode);
  const [radius, setRadius] = useState(String(location.radiusKm));
  const [error, setError] = useState(false);
  const [position, setPosition] = useState(location.approximatePosition);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [searchEpoch, setSearchEpoch] = useState(0);
  const disabled = busy || uncertain;
  const changePlace = (change: () => void) => {
    if (disabled) return;
    change(); setPosition(null); setMapEpoch(value => value + 1); setError(false);
  };
  // Typing a radius and tapping a preset both prepare it; pressing save confirms the whole area.
  const changeRadius = (text: string) => { setRadius(text); setError(false); };
  // Right after a confirmed save the form is what was saved; until something changes the footer says so, instead of an
  // empty confirmation and a grey save that read as "confirm it again" (review of step 9, 2026-09-24).
  const dirty = city !== location.city || country !== location.operatingCountryCode || radius !== String(location.radiusKm)
    || !samePosition(position, location.approximatePosition);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const settled = saved && !dirty;
  const submit = () => {
    if (disabled || reading || settled || !selectableCountry(countryOptions.countries, country)) return;
    const value = normalizeWorkerLocation({ operatingCountryCode: country, city: city.trim(), radiusKm: /^\d+$/.test(radius) ? Number(radius) : NaN,
      approximatePosition: position });
    if (!value) { setError(true); return; }
    onSave(value);
  };
  const selectable = selectableCountry(countryOptions.countries, country);
  // A grey save says why (owner rule, 2026-09-23): a country that cannot be chosen, then a
  // read of the saved area that is still running (a save during it would be refused without a word). Once saved, the
  // line above the button already says why.
  const reason = settled ? null : !selectable ? 'Izaberi dostupnu državu.'
    : reading ? 'Učitavamo sačuvano područje…' : null;
  const body = <View style={{ gap: 24 }}>
    {/* Privacy wording, word for word. "Izaberi područje u kom radiš." and a second title under the bar are gone. */}
    <View style={s.note}><FactArt kind="lock" size={20} />
      <T variant="copy" tone="muted" style={s.grow}>Kućna adresa i GPS dozvola nisu potrebni.</T></View>
    <CountryField label="Država rada" value={country} disabled={disabled} options={countryOptions}
      onChange={code => changePlace(() => setCountry(code))} />
    <LocationField label="Grad ili mesto rada" value={city} maxLength={160} editable={!disabled}
      onChangeText={text => changePlace(() => setCity(text))} />
    <View style={s.radius}>
      <LocationField label="Radijus rada u kilometrima" value={radius} keyboardType="number-pad" maxLength={3}
        editable={!disabled} hint="Od 1 do 200 km oko sačuvanog područja." onChangeText={changeRadius} />
      <View accessibilityRole="radiogroup" accessibilityLabel="Brzi izbor radijusa" style={s.pills}>
        {RADII.map(km => { const checked = Number(radius) === km;
          return <Press key={km} accessibilityRole="radio" accessibilityLabel={`${km} km`} accessibilityState={{ checked, disabled }}
            disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={0.97} onPress={() => { if (!disabled) changeRadius(String(km)); }}
            style={[s.pill, checked && s.pillOn]}>
            <T variant="note" style={checked ? s.pillTextOn : s.pillText}>{`${km} km`}</T>
          </Press>; })}
      </View>
    </View>
    {country && city.trim() ? <View style={locationStyles.section}>
      <T variant="heading" accessibilityRole="header">Približno područje na mapi</T>
      <T variant="note" tone="muted">Označi centar područja rada. Čuva se približna tačka, zaokružena na oko kilometar, bez kućne adrese.</T>
      <WorkerAreaSearch city={city} countryCode={country} disabled={disabled} resolver={resolver}
        scopeKey={`${location.accountId}:${location.profileId}:${location.revision}:${mapEpoch}:${searchEpoch}`}
        onChoose={next => { if (!disabled) { setPosition(next); setError(false); } }} />
      <ResolvedPinMap key={mapEpoch} coarse position={position} disabled={disabled}
        scopeKey={`${location.accountId}:${location.profileId}:${location.revision}:${mapEpoch}`}
        onChoose={next => { if (!disabled) {
          const coarse = displayedPinPosition(next, true);
          if (!coarse) return;
          setPosition(coarse); setError(false); setSearchEpoch(value => value + 1);
        } }} />
      {position ? <V2Action label="Ukloni približnu tačku" kind="quiet" disabled={disabled} style={quietStart}
        onPress={() => { if (!disabled) { setPosition(null); setMapEpoch(value => value + 1); } }} /> : null}
    </View> : null}
    {error ? <T accessibilityRole="alert" tone="danger">Unesi mesto rada i ceo broj od 1 do 200 km.</T> : null}
  </View>;
  // After an unknown outcome, or a read that failed while the form stayed, the read replaces the save: the editor refuses
  // any save until the saved state is read again.
  const retry = (uncertain || !!refusal) && onRetry;
  const footer = <>
    {settled && !retry ? <View style={s.saved}><FactArt kind="check" size={20} />
      <T accessibilityRole="alert" tone="success" style={s.grow}>Područje rada je sačuvano.</T></View>
      : null}
    {retry ? <V2Action label="Pokušaj ponovo" onPress={retry} disabled={busy || reading} loading={reading} style={brandAction}
      error={refusal ?? undefined} />
      : <V2Action label="Sačuvaj područje rada" onPress={submit} loading={busy} style={brandAction}
        disabled={disabled || reading || settled || !selectable} reason={busy ? null : reason} error={refusal ?? undefined} />}
  </>;
  return children({ body, footer });
}

/** A quiet action beside content keeps to its own width, as the location screens have always drawn it. */
const quietStart = { alignSelf: 'flex-start' } as const;

export default function PodrucjeRada() {
  const read = useCallback(() => workerLocationClientService.read(), []);
  const editor = useOwnedEditor(read);
  const [dirty, setDirty] = useState(false);
  const leave = useUnsavedProfileBack({ dirty: !!editor.data && dirty, busy: editor.busy, uncertain: editor.uncertain,
    revision: editor.data?.revision ?? null, onBack: () => router.canGoBack() ? router.back() : router.replace('/profil') });
  const refresh = () => { void editor.refresh(); };
  const location = editor.data;
  // The form stays on screen while it is read again; only a first read or a failed one without data replaces it.
  if (!location) return <WorkerProfileFrame title="Područje rada" backLabel="Nazad" back={leave.back}>
    {editor.error && !editor.loading ? <StateView kind="error" title="Područje rada nije učitano" body={editor.error}
      primary={{ label: 'Pokušaj ponovo', onPress: refresh }} />
      : <StateView kind="loading" title="Učitavamo područje rada…" skeleton={{ count: 2, rows: 1 }} />}
  </WorkerProfileFrame>;
  // The saved line stands in the footer above the save (it used to sit at the top of the body, out of sight of the button).
  return <WorkerLocationForm key={location.revision} location={location} busy={editor.busy} uncertain={editor.uncertain}
    onDirtyChange={setDirty} reading={editor.loading} saved={editor.saved} error={editor.error} onRetry={refresh}
    onSave={value => {
      void editor.save(async () => { const result = await workerLocationClientService.save({ expectedRevision: location.revision, confirmed: true, value });
        return result.ok ? { ok: true, podatak: result.podatak.location } : result; });
    }}>
    {({ body, footer }) => <WorkerProfileFrame title="Područje rada" backLabel="Nazad" back={leave.back} footer={footer}>{body}{leave.sheet}</WorkerProfileFrame>}
  </WorkerLocationForm>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  saved: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  radius: { gap: sys.space.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  pill: { minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  // The chosen distance is the green selection: the same edge in green on the soft green, so choosing never moves the row.
  pillOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  pillText: { color: sys.color.ink, fontWeight: '600' },
  pillTextOn: { color: sys.color.green, fontWeight: '700' },
});
