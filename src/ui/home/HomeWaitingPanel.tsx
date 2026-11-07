import { View } from 'react-native';
import type { HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import { ProductSheet } from '../product/ProductSheet';
import { ListRow } from '../system/ListRow';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';

/** On-demand access to confirmed actions already read for this Home visit.
 * The current server preview is capped at three; expose its remaining count
 * honestly and provide the real domain lists, never manufacture hidden rows. */
export function HomeWaitingPanel({ home, stale, refreshing, onClose, onOpen, onRatings,
  onMyTasks, onMyApplications, onAgreements, onRefresh }: {
  home: HomeSnapshot; stale: boolean; refreshing: boolean; onClose: () => void;
  onOpen: (target: HomeTarget) => void; onRatings: (id: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onAgreements: () => void; onRefresh: () => void;
}) {
  const unique = new Map([...home.attention, ...(home.allPrompts ?? home.prompts ?? [])].map(row => [row.id, row]));
  const omitted = home.attentionMore + (home.allPrompts ? 0 : home.promptsMore ?? 0);
  const incomplete = stale || home.partial || home.attentionState === 'unavailable' || omitted > 0;
  return <ProductSheet title="Čeka Vas" closeLabel="Zatvorite pregled" onClose={onClose}>
    {dismiss => {
      const go = (action: () => void) => { dismiss(); action(); };
      return <View style={{ gap: sys.space.md }}>
        {stale ? <T accessibilityRole="alert" variant="note">Prikazano je poslednje učitano. Osvežite pregled pre odluke.</T> : null}
        {home.partial || home.attentionState === 'unavailable' ? <T variant="note" tone="muted">Deo obaveza trenutno nije učitan.</T> : null}
        {[...unique.values()].map(row => <ListRow key={row.id} title={row.title} subtitle={[row.taskTitle, row.detail].filter(Boolean).join(' · ')}
          onPress={() => go(() => onOpen(row.target))} accessibilityLabel={[row.title, row.taskTitle, row.detail].filter(Boolean).join('. ')} />)}
        {home.ratingsDue === null ? <ListRow title="Proverite ocene" subtitle="Broj saradnji za ocenjivanje nije potvrđen."
          onPress={() => go(() => onRatings(null))} /> : home.ratingsDue > 0 ? <ListRow title="Ocenite saradnju"
          subtitle={home.ratingsDue === 1 ? 'Jedna saradnja čeka Vašu ocenu.' : `${home.ratingsDue} saradnji čeka Vašu ocenu.`}
          onPress={() => go(() => onRatings(home.ratingDueAgreementId))} /> : null}
        {!unique.size && home.ratingsDue === 0 && !incomplete ? <T variant="note">Trenutno nema učitanih obaveza koje čekaju Vašu odluku.</T> : null}
        {omitted > 0 ? <T testID="home-waiting-omitted" variant="note" tone="muted">Još {omitted} obaveza nije prikazano u ovom pregledu. Otvorite odgovarajuću listu ispod.</T> : null}
        <ListRow title="Moji zadaci" subtitle="Objave i izbor prijava" onPress={() => go(onMyTasks)} />
        <ListRow title="Moje prijave" subtitle="Status i izmene zadataka" onPress={() => go(onMyApplications)} />
        <ListRow title="Dogovori" subtitle="Potvrde, uslovi i završetak saradnje" onPress={() => go(onAgreements)} last />
        <V2Action label="Osvežite pregled" kind="quiet" compact disabled={refreshing} loading={refreshing} onPress={onRefresh} />
      </View>;
    }}
  </ProductSheet>;
}
