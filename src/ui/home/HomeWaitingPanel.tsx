import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { homeAgreementPromptRow, type HomeSnapshot, type HomeTarget } from '../../data/homeSnapshot';
import { HomeAgreementPromptOwner, type HomeAgreementPromptSource, type HomeAgreementPromptState } from '../../data/homeAgreementPromptOwner';
import { ProductSheet } from '../product/ProductSheet';
import { ListRow } from '../system/ListRow';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';

/** The panel alone starts Agreement prompt paging. It retains one page while a
 * request is pending or failed, and only a deliberate next/refresh reads again.
 * The independent attention RPC still has a capped preview, reported honestly. */
export function HomeWaitingPanel({ home, stale, refreshing, onClose, onOpen, onRatings,
  onMyTasks, onMyApplications, onAgreements, onRefresh, agreementPromptSource }: {
  home: HomeSnapshot; stale: boolean; refreshing: boolean; onClose: () => void;
  onOpen: (target: HomeTarget) => void; onRatings: (id: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onAgreements: () => void; onRefresh: () => void;
  agreementPromptSource?: HomeAgreementPromptSource;
}) {
  const bounded = home.agreementPrompts;
  const owner = useRef<HomeAgreementPromptOwner | null>(null);
  const [paging, setPaging] = useState<HomeAgreementPromptState | null>(null);
  const accountId = bounded?.accountId, asOf = bounded?.asOf, total = bounded?.total ?? 0;
  useEffect(() => {
    setPaging(null);
    if (!accountId || !agreementPromptSource || total === 0) return;
    const current = new HomeAgreementPromptOwner(accountId, agreementPromptSource);
    owner.current = current;
    const unsubscribe = current.subscribe(() => setPaging(current.getSnapshot()));
    void current.start();
    return () => { unsubscribe(); current.dispose(); if (owner.current === current) owner.current = null; };
  }, [accountId, asOf, total, agreementPromptSource]);
  const agreementRows = bounded ? paging?.page?.items.map(homeAgreementPromptRow) ?? bounded.preview : [];
  const unique = new Map([...home.attention, ...(home.allPrompts ?? home.prompts ?? []), ...agreementRows].map(row => [row.id, row]));
  const missingPager = !!bounded && total > 0 && !agreementPromptSource;
  const omitted = home.attentionMore + (bounded ? missingPager ? Math.max(0, total - agreementRows.length) : 0
    : home.allPrompts ? 0 : home.promptsMore ?? 0);
  const incomplete = stale || home.partial || home.attentionState === 'unavailable' || omitted > 0 || missingPager
    || !!bounded && total > 0 && (!paging?.page || !!paging.error || paging.page.counts.total > 0);
  // A successful overview refresh changes asOf and starts one new traversal.
  // Do not race that read with a duplicate page refresh here.
  const refresh = () => { if (!refreshing && !paging?.loading) onRefresh(); };
  return <ProductSheet title="Čeka Vas" closeLabel="Zatvorite pregled" onClose={onClose}
    contentKey={paging?.page ? `${paging.page.viewAt}:${paging.index}` : undefined}>
    {dismiss => {
      const go = (action: () => void) => { dismiss(); action(); };
      return <View style={{ gap: sys.space.md }}>
        {stale ? <T accessibilityRole="alert" variant="note">Prikazano je poslednje učitano. Osvežite pregled pre odluke.</T> : null}
        {home.partial || home.attentionState === 'unavailable' ? <T variant="note" tone="muted">Deo obaveza trenutno nije učitan.</T> : null}
        {[...unique.values()].map(row => <ListRow key={row.id} title={row.title} subtitle={[row.taskTitle, row.detail].filter(Boolean).join(' · ')}
          onPress={() => go(() => onOpen(row.target))} accessibilityLabel={[row.title, row.taskTitle, row.detail].filter(Boolean).join('. ')} />)}
        {bounded && total > 0 ? <View testID="home-agreement-prompts-page" style={{ gap: sys.space.sm }}>
          {paging?.loading ? <T variant="note" accessibilityLiveRegion="polite">Učitavamo obaveze iz Dogovora…</T> : null}
          {paging?.error || missingPager ? <T variant="note" accessibilityRole="alert">
            {paging?.error === 'expired' ? 'Pregled je istekao. Osvežite ga da nastavite.'
              : paging?.page ? 'Obaveze nisu osvežene. Prikazana je poslednja učitana strana.' : 'Preostale obaveze iz Dogovora trenutno nisu učitane.'}
          </T> : null}
          {paging?.page ? <T variant="note" tone="muted">Strana {paging.index + 1}. Prikazano {paging.page.items.length} od {paging.page.counts.total} obaveza iz Dogovora.</T> : null}
          {paging?.error === 'unavailable' ? <V2Action label="Pokušajte ponovo" kind="quiet" compact disabled={paging.loading}
            onPress={() => { void owner.current?.retry(); }} /> : null}
          {paging?.page?.hasMore && !paging.error ? <V2Action label="Sledeće obaveze" kind="quiet" compact
            disabled={paging.loading} loading={paging.loading} onPress={() => { void owner.current?.next(); }} /> : null}
          {paging && (paging.index > 0 || paging.error === 'expired') ? <V2Action label="Prikažite od početka" kind="quiet" compact
            disabled={paging.loading} onPress={() => { void owner.current?.refresh(); }} /> : null}
        </View> : null}
        {home.ratingsDue === null ? <ListRow title="Proverite ocene" subtitle="Broj saradnji za ocenjivanje nije potvrđen."
          onPress={() => go(() => onRatings(null))} /> : home.ratingsDue > 0 ? <ListRow title="Ocenite saradnju"
          subtitle={home.ratingsDue === 1 ? 'Jedna saradnja čeka Vašu ocenu.' : `${home.ratingsDue} saradnji čeka Vašu ocenu.`}
          onPress={() => go(() => onRatings(home.ratingDueAgreementId))} /> : null}
        {!unique.size && home.ratingsDue === 0 && !incomplete ? <T variant="note">Trenutno nema učitanih obaveza koje čekaju Vašu odluku.</T> : null}
        {omitted > 0 ? <T testID="home-waiting-omitted" variant="note" tone="muted">Još {omitted} obaveza nije prikazano u ovom pregledu. Otvorite odgovarajuću listu ispod.</T> : null}
        <ListRow title="Moji zadaci" subtitle="Objave i izbor prijava" onPress={() => go(onMyTasks)} />
        <ListRow title="Moje prijave" subtitle="Status i izmene zadataka" onPress={() => go(onMyApplications)} />
        <ListRow title="Dogovori" subtitle="Potvrde, uslovi i završetak saradnje" onPress={() => go(onAgreements)} last />
        <V2Action label="Osvežite pregled" kind="quiet" compact disabled={refreshing || !!paging?.loading} loading={refreshing || !!paging?.loading} onPress={refresh} />
      </View>;
    }}
  </ProductSheet>;
}
