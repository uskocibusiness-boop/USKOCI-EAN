import { Redirect } from 'expo-router';

/** Compatibility URL only. History stays in Dogovori, Moji zadaci and Moje prijave.
 * The old root accepted no entity/domain parameters; its planner entry now opens
 * previous collaborations directly. Replace, never add another Back stop or read
 * three private domains just to forward a legacy link. */
export default function Arhiva() {
  return <Redirect href={{ pathname: '/dogovori', params: { odeljak: 'istorija' } }} />;
}
