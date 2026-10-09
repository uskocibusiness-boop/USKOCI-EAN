import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { MapCredits, MapSources } from '../v2/discovery/MapCredits';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';
import { MAP_STYLE_URL, latinLabels } from './mapStyle';
import { uskociMapColors } from './mapAppearance';

const CAMERA = { center: [20.4572, 44.8176] as [number, number], zoom: 15 };
type Variant = 'URL' | 'JSON' | 'USKOČI';

/** Inert A/B fixture, mounted only by dizajn-mapa's exact DEV-package gate. Public map assets only. */
export function MapLabelsProbe({ onBack }: { onBack: () => void }) {
  const [variant, setVariant] = useState<Variant>('URL');
  const [styles, setStyles] = useState<{ JSON: string; 'USKOČI': string } | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [status, setStatus] = useState('Učitavanje');
  const [sources, setSources] = useState(false);
  const reduced = useReducedMotion();
  const token = useMemo(() => ({}), [variant]);
  const latest = useRef(token); latest.current = token;
  const active = useRef(true);
  const mark = (value: string) => { if (active.current && latest.current === token) setStatus(value); };
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    let fetching = true;
    const timer = setTimeout(() => controller.abort(), 15_000);
    void (async () => {
      try {
        const response = await fetch(MAP_STYLE_URL, { signal: controller.signal });
        if (!response.ok) throw new Error('style');
        const raw = await response.json();
        if (raw?.version !== 8 || !Array.isArray(raw.layers) || !raw.sources) throw new Error('style');
        const ready = { JSON: JSON.stringify(raw), 'USKOČI': JSON.stringify(latinLabels(uskociMapColors(raw))) };
        if (fetching) setStyles(ready);
      } catch { if (fetching) setReadFailed(true); }
      finally { clearTimeout(timer); }
    })();
    return () => { fetching = false; active.current = false; clearTimeout(timer); controller.abort(); };
  }, []);
  const style = variant === 'URL' ? MAP_STYLE_URL : styles?.[variant];
  return <SafeAreaView style={s.screen}>
    <View style={s.header}>
      <T variant="bodyStrong">DEV · nazivi na mapi</T>
      <View style={s.choices}>{(['URL', 'JSON', 'USKOČI'] as const).map(value => <V2Action key={value}
        label={value} kind={variant === value ? 'primary' : 'secondary'} disabled={value !== 'URL' && !styles}
        onPress={() => { if (value !== variant) { setStatus('Učitavanje'); setVariant(value); } }} />)}</View>
      <T variant="note">{variant} · {status}{readFailed ? ' · Čitanje stila nije uspelo' : ''}</T>
    </View>
    <View style={s.map}>
      {style ? <Map key={variant} style={s.map} mapStyle={style} androidView="texture"
        attribution={false} compass={false} logo={false} touchPitch={false} touchRotate={false}
        accessibilityLabel={`Probna mapa: ${variant}`} onDidFinishLoadingMap={() => mark('Mapa učitana')}
        onDidFinishRenderingFrameFully={() => mark('Kadar iscrtan')} onDidFailLoadingMap={() => mark('Greška mape')}>
        <Camera initialViewState={CAMERA} />
      </Map> : null}
      <MapCredits locate={false} onPress={() => setSources(true)} />
    </View>
    <View style={s.header}><V2Action label="Zatvori proveru" kind="quiet" onPress={onBack} /></View>
    {sources ? <MapSources reduced={reduced} onClose={() => setSources(false)} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  header: { padding: sys.space.base, gap: sys.space.sm },
  choices: { flexDirection: 'row', gap: sys.space.sm },
  map: { flex: 1 },
});
