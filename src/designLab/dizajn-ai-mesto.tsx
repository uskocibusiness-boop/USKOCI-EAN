import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams, type Href } from 'expo-router';
// Historical fixture destinations are deliberately absent from product route types.
// These scenes are mounted by tests; a future isolated lab host must supply their routes.
import type { ConfirmedLocationPoint } from '../contracts/location';
import type { ConfiguredLocationResolution, LocationResolverCandidate } from '../data/configuredLocationResolver';
import { AiConversationShell } from '../ui/aiFirst/AiConversationShell';
import { LocationPointEditor } from '../ui/location/LocationPointEditor';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';
import { sys } from '../ui/system/tokens';

/** Exact DEV package only. These local scenes never mount a conversation reader,
 * run an AI/geocoder/GPS command or save a point. Only the real map's public
 * basemap and attribution remain; no account or backend fixture is created.
 */
type Scene = 'proposal' | 'ambiguous' | 'unavailable' | 'saved';
const scenes: readonly Scene[] = ['proposal', 'ambiguous', 'unavailable', 'saved'];
const noop = () => {};
const candidates: readonly LocationResolverCandidate[] = [
  { label: 'Probni predlog · Dunavski park, Novi Sad', countryCode: 'RS',
    position: { latitude: 45.2546, longitude: 19.8507 },
    origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'inert-gallery', candidateHint: 'local-one' } },
  { label: 'Drugi probni predlog · Trg slobode, Novi Sad', countryCode: 'RS',
    position: { latitude: 45.2551, longitude: 19.8451 },
    origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'inert-gallery', candidateHint: 'local-two' } },
];
const saved: ConfirmedLocationPoint = { slot: 'start', latitudeE6: 45254600, longitudeE6: 19850700,
  origin: { kind: 'MANUAL_PIN' }, address: 'Probna sačuvana tačka · Dunavski park', accessNotes: 'Lokalni primer napomene' };
const leave = () => { if (router.canGoBack()) router.back(); else router.replace('/dizajn-ai' as Href); };

export default function AiLocationGallery() {
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const internal = Constants.expoConfig?.android?.package === 'rs.uskoci.dev';
  const scene = params.scene === undefined ? 'proposal' : params.scene;
  if (!internal || typeof scene !== 'string' || !scenes.includes(scene as Scene)) return <View style={{ flex: 1, padding: sys.space.lg }}>
    <T>{internal ? 'Nepoznat prikaz galerije.' : 'Nije dostupno.'}</T>
    <V2Action label="Izađi iz galerije" onPress={leave} />
  </View>;
  return <LocalScene key={scene} scene={scene as Scene} />;
}

function LocalScene({ scene }: { scene: Scene }) {
  const [epoch, setEpoch] = useState(0), [mode, setMode] = useState<'editor' | 'confirmed' | 'correction'>('editor');
  const [value, setValue] = useState('');
  const resolver = useMemo(() => ({
    cancel: noop,
    search: async (): Promise<ConfiguredLocationResolution> => scene === 'unavailable' ? { status: 'UNAVAILABLE' }
      : { status: 'PROPOSALS', requiresConfirmation: true, candidates: scene === 'ambiguous' ? candidates : candidates.slice(0, 1) },
    reverse: async (): Promise<ConfiguredLocationResolution> => ({ status: 'UNAVAILABLE' }),
  }), [scene]);
  const reset = () => { setEpoch(value => value + 1); setMode('editor'); setValue(''); };
  return <AiConversationShell conversationKey={`local-ai-place:${scene}:${epoch}`} title="Proba mesta zadatka"
    card={() => null} messages={[{ id: 'local-only', fromAi: false, body: 'Probni zadatak u Novom Sadu, blizu Dunavskog parka.' }]}
    welcome="" welcomeDetail="" value={value} onChange={setValue} canEdit canSend={false} pending={false} busy={false}
    onSend={noop} onBack={leave} placeholder="Probni tekst · bez slanja"
    sendBlockedReason={mode === 'editor' ? 'Prvo potvrdi mesto ili izaberi ispravku.' : 'Lokalna proba nema slanje poruka.'}
    status={<View style={{ gap: sys.space.sm }}>
      <T variant="meta" tone="muted">DEV · {scene} · lokalni primer, bez čuvanja</T>
      {mode === 'editor' ? <LocationPointEditor key={epoch} slot="start" title="Mesto rada" countryCode="RS"
        point={scene === 'saved' ? saved : undefined} scopeKey={`local-ai-place:${scene}:${epoch}`}
        initialQuery="Dunavski park, Novi Sad" presentation="conversation" autoLocate resolver={resolver}
        disabled={false} onInvalidate={noop} onConfirm={() => setMode('confirmed')}
        onCorrectInConversation={() => setMode('correction')} /> : <>
        <T accessibilityLiveRegion="polite">{mode === 'confirmed' ? 'Tačka je potvrđena samo u ovoj probi.'
          : 'Možeš da probaš unos ispravke. Tekst ostaje samo na ovom ekranu.'}</T>
        <V2Action label="Ponovi prikaz" kind="quiet" onPress={reset} />
      </>}
    </View>} />;
}
