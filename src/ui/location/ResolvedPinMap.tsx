import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Camera, Map, Marker, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { sys } from '../system/tokens';
import { V2Action as Button } from '../v2/V2Action';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { useReducedMotion } from '../system/motion';
import { MapCredits, MapSources } from '../v2/discovery/MapCredits';
import { cameraHintBounds, displayedPinPosition, type ResolvedPinMapProps } from './ResolvedPinMap.types';
import { panFinishedProposal, type PanStart } from './resolvedPinPan';
import { useMapStyle } from './mapStyle';
export type { ResolvedPinMapProps, ResolvedPinPosition } from './ResolvedPinMap.types';

type FocusOwner = { active: boolean; key: string; epoch: number };
type MapStatus = 'loading' | 'ready' | 'failed';
type Pixel = [number, number];
type PinDrag = { token: object; start: Pixel; origin: Promise<Pixel | null>; cancelled: Promise<null>; stop: () => void;
  released: boolean; timeout: ReturnType<typeof setTimeout> };
const pixel = (value: unknown): Pixel | null => Array.isArray(value) && value.length === 2
  && value.every(item => typeof item === 'number' && Number.isFinite(item)) ? [value[0], value[1]] : null;

/** A branded approximate marker: its halo still makes the public two-decimal location visibly imprecise. */
const AREA = 64;

/** MapLibre rendering and lifetime pattern adapted from PR67; no provider or save authority. */
function NativePinSession(props: ResolvedPinMapProps & { owns: () => boolean; retry: () => void }) {
  const { position, coarse = false, disabled = false, compact = false } = props;
  const pin = displayedPinPosition(position, coarse);
  // The public approximate view (a Task's place before a Dogovor) draws an area; every editable map and the exact
  // private point keep the pin.
  const area = coarse && disabled;
  const [status, setStatus] = useState<MapStatus>('loading');
  const [sourcesToken, setSourcesToken] = useState<object | null>(null);
  const reduced = useReducedMotion();
  const load = useRef<MapStatus>('loading');
  const failure = useRef<'deadline' | 'native-error' | null>(null);
  const active = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);
  const frameSize = useRef<Pixel | null>(null);
  const drag = useRef<PinDrag | null>(null);
  const panStart = useRef<PanStart | null>(null);
  const [dragOffset, setDragOffset] = useState<{ token: object; delta: Pixel } | null>(null);
  const [imageToken, setImageToken] = useState<object | null>(null);
  const [idleToken, setIdleToken] = useState<object | null>(null);
  const idle = useRef<object | null>(null);
  const [centeredToken, setCenteredToken] = useState<object | null>(null);
  const token = useMemo(() => ({}), [position?.latitude, position?.longitude, coarse, disabled]);
  const latest = useRef({ token, props }); latest.current = { token, props };
  // Initial context fits every real resolver candidate, without choosing any of them.
  // Keep it initial-only: ordinary rerenders must not undo the person's pan/zoom.
  const hintBounds = cameraHintBounds(props.cameraHint, coarse);
  const detailZoom = coarse ? 10 : compact ? 17 : 15;
  const singleHint = props.cameraHint?.length === 1 ? displayedPinPosition(props.cameraHint[0], coarse) : null;
  const requestedHintZoom = typeof props.cameraHintZoom === 'number' && Number.isFinite(props.cameraHintZoom)
    ? Math.max(0, Math.min(coarse ? 13 : 18, props.cameraHintZoom)) : null;
  const initial = useRef(pin ? { center: [pin.longitude, pin.latitude] as [number, number], zoom: detailZoom }
    : singleHint && requestedHintZoom !== null
      ? { center: [singleHint.longitude, singleHint.latitude] as [number, number], zoom: requestedHintZoom }
      : hintBounds ? { bounds: hintBounds, padding: { top: 24, bottom: 24, left: 24, right: 24 } }
        : { center: [0, 0] as [number, number], zoom: 1 });
  const owns = () => active.current && props.owns() && latest.current.token === token;
  const cancelDrag = () => {
    if (drag.current) { clearTimeout(drag.current.timeout); drag.current.stop(); }
    drag.current = null;
    if (active.current) setDragOffset(null);
  };
  const mark = (next: MapStatus) => {
    if (!owns() || (next === 'ready' && load.current !== 'loading' && failure.current !== 'deadline')) return;
    if (next === 'failed') cancelDrag();
    failure.current = next === 'failed' ? 'native-error' : null;
    load.current = next; clearTimeout(timer.current); setStatus(next);
  };
  useEffect(() => {
    active.current = true;
    timer.current = setTimeout(() => {
      if (active.current && latest.current.props.owns() && load.current === 'loading') {
        failure.current = 'deadline'; load.current = 'failed'; setStatus('failed');
      }
    }, 15_000);
    return () => { active.current = false; clearTimeout(timer.current); cancelDrag(); };
  }, []);
  useEffect(() => () => cancelDrag(), [token]);
  useEffect(() => {
    if (pin && status === 'ready' && owns()) {
      camera.current?.jumpTo({ center: [pin.longitude, pin.latitude], zoom: detailZoom });
    }
  }, [pin?.latitude, pin?.longitude, coarse, disabled, status]);
  const observeCenter = (value: unknown) => {
    if (!owns() || !pin || load.current !== 'ready') return;
    const state = value as { center?: unknown; zoom?: unknown } | null;
    const center = Array.isArray(state?.center) && state.center.length === 2
      ? displayedPinPosition({ longitude: state.center[0], latitude: state.center[1] }) : null;
    idle.current = center && typeof state?.zoom === 'number' && Number.isFinite(state.zoom)
      && state.zoom >= 0 && state.zoom <= (coarse ? 13 : 18) ? token : null;
    setIdleToken(idle.current);
    const centered = center && typeof state?.zoom === 'number' && Number.isFinite(state.zoom)
      && Math.abs(state.zoom - detailZoom) < 0.01
      && Math.abs(center.latitude - pin.latitude) < 0.00001 && Math.abs(center.longitude - pin.longitude) < 0.00001;
    setCenteredToken(centered ? token : null);
  };
  const coordinateText = pin ? `Geografska širina ${(Math.round(pin.latitude * 1e6) / 1e6).toFixed(coarse ? 2 : 6)}; geografska dužina ${(Math.round(pin.longitude * 1e6) / 1e6).toFixed(coarse ? 2 : 6)}.` : null;
  const choose = (lngLat: unknown) => {
    if (!owns() || load.current !== 'ready' || latest.current.props.disabled
      || !Array.isArray(lngLat) || lngLat.length !== 2) return;
    const chosen = displayedPinPosition({ latitude: lngLat[1], longitude: lngLat[0] }, coarse);
    if (chosen) latest.current.props.onChoose(chosen);
  };
  const canDrag = () => owns() && !!pin && load.current === 'ready' && !disabled
    && idle.current === token && idleToken === token && imageToken === token && !!map.current && !!frameSize.current;
  const touch = (event: GestureResponderEvent) => event.nativeEvent.touches?.length > 1 ? null
    : pixel([event.nativeEvent.pageX, event.nativeEvent.pageY]);
  const currentDrag = (session: PinDrag) => owns() && drag.current === session && session.token === token
    && idle.current === token && load.current === 'ready' && !latest.current.props.disabled;
  const beginDrag = (event: GestureResponderEvent) => {
    const start = touch(event), nativeMap = map.current;
    if (!canDrag() || !start || !nativeMap || !pin || drag.current) return;
    event.stopPropagation();
    // Both projection directions come from the native map. Screen movement is
    // the real marker responder delta in DIP, matching Map.project/unproject.
    let stop!: () => void;
    const cancelled = new Promise<null>(resolve => { stop = () => resolve(null); });
    const session: PinDrag = { token, start, released: false, cancelled, stop,
      origin: Promise.resolve(null), timeout: setTimeout(() => {
        if (drag.current === session) cancelDrag();
      }, 15_000) };
    drag.current = session; setDragOffset({ token, delta: [0, 0] });
    try { session.origin = nativeMap.project([pin.longitude, pin.latitude]).then(pixel, () => null); }
    catch { cancelDrag(); }
  };
  const moveDrag = (event: GestureResponderEvent) => {
    const session = drag.current, point = touch(event);
    if (!session || !currentDrag(session) || session.released) return;
    if (!point) { cancelDrag(); return; }
    event.stopPropagation();
    setDragOffset({ token, delta: [point[0] - session.start[0], point[1] - session.start[1]] });
  };
  const endDrag = async (event: GestureResponderEvent) => {
    const session = drag.current, point = touch(event), nativeMap = map.current;
    if (!session || !currentDrag(session) || session.released) return;
    event.stopPropagation(); session.released = true;
    try {
      if (!point || !nativeMap) return;
      const delta: Pixel = [point[0] - session.start[0], point[1] - session.start[1]];
      if (Math.hypot(...delta) < 4) return;
      const origin = await Promise.race([session.origin, session.cancelled]);
      if (!currentDrag(session) || !origin) return;
      const target: Pixel = [origin[0] + delta[0], origin[1] + delta[1]], size = frameSize.current;
      if (!size || target.some((value, index) => value < 0 || value > size[index])) return;
      const lngLat = await Promise.race([nativeMap.unproject(target), session.cancelled]);
      if (currentDrag(session)) choose(lngLat);
    } catch { /* Failed projection leaves the parent-owned point untouched. */ }
    finally { if (drag.current === session) cancelDrag(); }
  };
  const offset = dragOffset?.token === token ? dragOffset.delta : null;
  // Place names in Serbian Latin (2026-09-24): the map mounts once the style is known, and meanwhile shows the same
  // loading state it shows while its tiles arrive.
  const mapStyle = useMapStyle();
  // Read-only: the point no longer prints under the map, so the frame carries it for a screen reader instead of losing
  // it. The native map under it is then hidden from the reader: on the emulator it spoke a second time, as a proposal
  // ("Mapa predložene lokacije") over a point that was shared or fixed.
  const spokenByFrame = disabled && !!pin;
  const mapName = area ? 'Mapa približnog područja' : disabled ? 'Mapa prikazane tačke'
    : coarse ? 'Mapa približnog područja rada' : 'Mapa predložene lokacije';
  return <View style={[styles.container, props.fill && styles.fill]}>
    {/* Credits overlay the map, outside its accessible frame so all source links remain reachable. */}
    <View style={props.fill ? styles.fill : undefined}>
    <View style={[styles.frame, props.fill ? styles.fillFrame : props.height ? { height: props.height } : null]}
      accessible={spokenByFrame} accessibilityRole={spokenByFrame ? 'image' : undefined}
      accessibilityLabel={spokenByFrame ? `${area ? 'Približno područje na mapi' : 'Tačka na mapi'}. ${coordinateText}` : undefined}
      onLayout={event => {
      if (!owns()) return;
      const size = pixel([event.nativeEvent.layout.width, event.nativeEvent.layout.height]);
      if (size && size.every(value => value > 0)) {
        if (frameSize.current && size.some((value, index) => value !== frameSize.current![index])) {
          idle.current = null; cancelDrag(); setIdleToken(null); setCenteredToken(null);
        }
        frameSize.current = size;
      }
    }}>
      {mapStyle ? <Map ref={map} style={styles.map} mapStyle={mapStyle} androidView="texture" dragPan={!offset}
        attribution={false} compass={false} logo={false}
        touchPitch={false} touchRotate={false} accessibilityLabel={mapName}
        importantForAccessibility={spokenByFrame ? 'no-hide-descendants' : 'auto'}
        onDidFinishLoadingMap={() => mark('ready')} onDidFailLoadingMap={() => mark('failed')}
        onRegionWillChange={event => {
          if (!owns()) return;
          const state = event.nativeEvent;
          panStart.current = typeof state.zoom === 'number' && Number.isFinite(state.zoom)
            ? { zoom: state.zoom, userInteraction: state.userInteraction === true } : null;
          idle.current = null; cancelDrag(); setIdleToken(null); setCenteredToken(null);
        }}
        onRegionDidChange={event => {
          if (!owns()) return;
          observeCenter(event.nativeEvent);
          const point = panFinishedProposal({
            start: panStart.current, finish: event.nativeEvent, current: pin,
            editable: !disabled && !coarse && !drag.current && (pin !== null || hintBounds !== null),
          });
          panStart.current = null;
          if (point) choose([point.longitude, point.latitude]);
        }}
        onPress={event => { if (!drag.current) choose(event.nativeEvent.lngLat); }}>
        <Camera ref={camera} initialViewState={initial.current} minZoom={0} maxZoom={coarse ? 13 : 18} />
        {pin && area ? <Marker id="location-area" lngLat={[pin.longitude, pin.latitude]} anchor="center">
          {/* The brand mark gives the task detail the same identity as Discovery's pins. The halo, rather than a
              sharp pin tip, continues to say that this public point is approximate. */}
          <View collapsable={false} accessible accessibilityRole="image" accessibilityLabel="Približno područje na mapi"
            pointerEvents="none" style={styles.area}>
            <View style={styles.areaFill} />
            <Image source={require('../../../assets/entry-splash-mark.png')} resizeMode="contain" accessible={false} style={styles.areaMark} />
          </View>
        </Marker> : pin ? <Marker id="location-proposal" lngLat={[pin.longitude, pin.latitude]} anchor="bottom">
          {/* Marker uses a real Android view on the native map projection.
              Image decode is readiness only; screenshots verify visible pixels. */}
          <View collapsable={false} accessible accessibilityRole="image" accessibilityLabel="Oznaka izabrane tačke na mapi"
            onStartShouldSetResponder={canDrag}
            onResponderGrant={beginDrag} onResponderMove={moveDrag} onResponderRelease={event => { void endDrag(event); }}
            onResponderTerminate={() => { if (owns()) cancelDrag(); }} onResponderTerminationRequest={() => !owns() || !drag.current}
            style={[styles.marker, offset ? { transform: [{ translateX: offset[0] }, { translateY: offset[1] }] } : null]}>
          <Image key={`${pin.latitude}:${pin.longitude}:${coarse}:${disabled}`}
            source={require('../../../assets/resolved-location-pin.png')}
            accessible={false} fadeDuration={0} resizeMode="contain" style={styles.marker}
            onLoad={() => { if (owns()) setImageToken(token); }}
            onError={() => { if (owns()) { setImageToken(null); mark('failed'); } }} />
          </View>
        </Marker> : null}
      </Map> : null}
      {status !== 'ready' ? <View style={styles.feedback}>
        {status === 'loading' ? <><ActivityIndicator color={sys.color.green} accessibilityLabel="Učitavanje mape" /><T>Učitavamo mapu…</T></>
          : <><T accessibilityRole="alert" variant="bodyStrong">Mapa nije učitana.</T><T variant="meta" tone="muted">Proveri vezu. Uneti podaci ostaju u obrascu.</T>
            <Button label="Pokušaj ponovo sa mapom" kind="secondary" onPress={() => { if (owns()) props.retry(); }} /></>}
      </View> : null}
      {/* Drawn after the loading/failure layer so it stays reachable while the tiles arrive; a real 44 dp target. */}
      {props.expand ? <Press accessibilityRole="button" accessibilityLabel={props.expand.label}
        accessibilityHint="Otvara mapu preko celog ekrana." accessibilityState={{ disabled: !!props.expand.disabled }}
        disabled={props.expand.disabled} haptic={props.expand.disabled ? 'none' : 'select'} hitSlop={0}
        onPress={() => { const expand = latest.current.props.expand; if (expand && !expand.disabled && owns()) expand.onPress(); }}
        style={styles.expand}>
        <Glyph name="expand" size={20} tone={props.expand.disabled ? 'muted' : 'ink'} />
      </Press> : null}
    </View>
    {status === 'ready' ? <MapCredits locate={false} onPress={() => {
      if (!owns() || load.current !== 'ready') return;
      cancelDrag(); setSourcesToken(token);
    }} /> : null}
    </View>
    {sourcesToken === token && status === 'ready' ? <MapSources reduced={reduced} onClose={() => setSourcesToken(null)} /> : null}
    {/* One usable instruction, not a coordinate readout. The precise point remains available
        to assistive technology and the parent still owns explicit confirmation. */}
    {!compact ? (pin && !disabled ?
      <T accessible accessibilityRole="text" accessibilityLiveRegion="polite"
        accessibilityLabel={`${coarse ? 'Približna tačka na mapi' : 'Predložena tačka na mapi'}. ${coordinateText}`}
        variant="meta" tone="muted">{centeredToken === token && imageToken === token && status === 'ready' && !offset
          ? 'Tačka je na sredini mape. Pomeri oznaku ako treba.'
          : 'Dodirni mapu ili prevuci oznaku do pravog mesta.'}</T>
      : !disabled ? <T variant="meta" tone="muted">Tačka nije izabrana. Pronađi područje i dodirni mapu.</T> : null) : null}
  </View>;
}

export function ResolvedPinMap(props: ResolvedPinMapProps) {
  const [owner, setOwner] = useState<FocusOwner | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = useRef<FocusOwner | null>(null);
  const latestKey = useRef(props.scopeKey); latestKey.current = props.scopeKey;
  const generation = useRef(0);
  useFocusEffect(useCallback(() => {
    if (!props.scopeKey) return;
    const session = { active: true, key: props.scopeKey, epoch: ++generation.current };
    current.current = session; setOwner(session);
    return () => { session.active = false; if (current.current === session) current.current = null; setOwner(null); };
  }, [props.scopeKey]));
  const valid = owner?.active && owner.key === props.scopeKey && current.current === owner;
  if (!valid) return <View style={[styles.container, props.fill && styles.fill]}><T variant="meta" tone="muted">Mapa je dostupna dok je ovaj unos otvoren.</T></View>;
  const owns = () => current.current === owner && owner.active && latestKey.current === owner.key;
  return <NativePinSession key={`${owner.epoch}:${attempt}`} {...props} owns={owns}
    retry={() => { if (owns()) setAttempt(value => value + 1); }} />;
}

const styles = StyleSheet.create({
  container: { gap: sys.space.sm },
  fill: { flex: 1 },
  fillFrame: { flex: 1, minHeight: 280 },
  frame: { height: 320, borderRadius: sys.radius.card, overflow: 'hidden', backgroundColor: sys.color.greenSoft },
  map: { flex: 1 },
  feedback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: sys.space.lg,
    gap: sys.space.md, backgroundColor: sys.color.surface },
  marker: { width: 44, height: 48 },
  // A white map control (as Discovery's zoom), above the credits at the bottom of the rounded frame.
  expand: { position: 'absolute', top: sys.space.sm, right: sys.space.sm, width: 44, height: 44, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, alignItems: 'center', justifyContent: 'center',
    ...sys.elevation.soft },
  area: { width: AREA, height: AREA, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.greenEdge,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  areaFill: { ...StyleSheet.absoluteFill, backgroundColor: sys.color.green, opacity: 0.16 },
  areaMark: { width: 34, height: 34 },
});
