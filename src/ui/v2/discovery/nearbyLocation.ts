import Constants from 'expo-constants';
/** Kept lazy even outside native resolution; useNearbyMap declines capture on web before calling it. */
export const loadNearbyLocation = () => import('expo-location');

// Temporary bounded device diagnosis: enum only, no coordinates, IDs, permission payloads or request text.
let traceLines = 0;
export function traceNearby(stage: 'start' | 'fix' | 'retired' | 'background' | 'idle' | 'locating' | 'denied' | 'services-off' | 'timeout' | 'unavailable' | 'unsupported') {
  const pkg = Constants.expoConfig?.android?.package;
  if ((pkg !== 'rs.uskoci.preview' && pkg !== 'rs.uskoci.dev') || traceLines >= 60) return;
  traceLines++; console.info('[USKOCI_NEARBY_STAGE] ' + stage);
}
