/** Local RN-web layout proof of the production DiscoverySearchPanel; no route, service or app state. */
import React, { useCallback, useMemo, useState } from 'react';
const { createRoot } = require('react-dom/client');
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { discoveryV1SearchPreviewKey, type DiscoveryV1SearchSnapshot, type SearchPreviewView } from '../../src/data/discoveryV1SearchOwner';
import { initialMarketplaceView, type PublicBounds } from '../../src/data/marketplaceView';
import { DiscoverySearchPanel, type SearchPreviewDraft } from '../../src/ui/v2/discovery/DiscoverySearchPanel';

const AREA: PublicBounds = [19.7, 45.2, 19.9, 45.3];
const VIEW = { ...initialMarketplaceView(), mode: 'map' as const };
const noop = () => {};

function Proof() {
  const [preview, setPreview] = useState<SearchPreviewView>({ ...VIEW, placeSearch: '' });
  const onDraft = useCallback((draft: SearchPreviewDraft) => {
    const next = { ...VIEW, ...draft, placeSearch: draft.placeSearch ?? '' };
    setPreview(current => discoveryV1SearchPreviewKey(current, AREA) === discoveryV1SearchPreviewKey(next, AREA) ? current : next);
  }, []);
  const snapshot = useMemo<DiscoveryV1SearchSnapshot>(() => ({
    active: true, generation: 1, key: discoveryV1SearchPreviewKey(preview, AREA), status: 'ready' as const,
    count: 41, undated: 0, availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
    places: [], parts: [], placeHasMore: false, placePaging: false, everywhere: 41, inMapArea: 7, facetError: false,
  }), [preview]);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <View style={{ flex: 1, backgroundColor: '#edf2ee', justifyContent: 'center', padding: 16 }}>
      <Text style={{ color: '#19634b', fontSize: 12 }}>LOKALNA RN-WEB PROBA · bez servera i naloga</Text>
      <DiscoverySearchPanel items={[]} view={VIEW} mine={undefined} now={new Date('2026-10-20T12:00:00Z')}
        mapArea={AREA} mode="filters" reduced p6Search={{ snapshot, onDraft, onNextPlaces: noop }}
        placeResolver={{ search: async () => ({ status: 'PROPOSALS', candidates: [], requiresConfirmation: true }), cancel: noop }}
        onApply={noop} onClose={noop} />
    </View>
  </SafeAreaProvider></GestureHandlerRootView>;
}

createRoot(document.getElementById('root')!).render(<Proof />);
