import { View } from 'react-native';
import type { DiscoveryMapProps } from './DiscoveryMap.types';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { sys } from '../system/tokens';
export function DiscoveryMap({ onList }: DiscoveryMapProps) {
  return <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center' }}>
    <T style={sys.type.title}>Mapa je dostupna u mobilnoj aplikaciji</T>
    <T style={sys.type.body}>Isti zadaci i izabrani filteri su u listi.</T>
    <V2Action label="Pogledaj listu" onPress={onList} />
  </View>;
}
