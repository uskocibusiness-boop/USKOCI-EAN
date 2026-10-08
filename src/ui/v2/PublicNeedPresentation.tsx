import type { TaskRelation } from '../../data/taskRelation';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { inicijali } from '../../lib/inicijali';
import { vreme } from '../../lib/vreme';
import { DetailDescription, DetailRoute, routeAddsToArea, ProductFooterAction, ProductHeader,
  productPriceParts, useDetailMenu, useDetailScrollTitle } from '../product/ProductDetails';
import type { SheetAction } from '../system/ActionSheet';
import { FactArt } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { FlowFooter } from '../system/FlowFooter';
import { ListRow } from '../system/ListRow';
import { PublicProfileSheet, type PublicProfileState, type SafetyEntry } from '../system/PublicProfileSheet';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { SkeletonCard } from '../system/Skeleton';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import type { TaskFitContext } from './detail/taskFit';
import { useUrgencyClock } from './NeedUrgencyBadge';
import { CardStatus } from './TaskFace';
import { OFFERS_INFO, TaskDecisionFacts, TaskDecisionPublisher, TaskDecisionRequirements, TaskDecisionTitle, TaskDecisionValue, TaskPlacePrivacy,
  applyActionLabel } from './detail/TaskDecision';

/**
 * Why a person cannot apply to a task they could otherwise apply to, in one short line, from the facts the screen
 * already has (owner step 5b, 2026-09-24). It used to be one sentence for every case, which said nothing about whether
 * waiting would help. Full places first (nothing will open them), then a deadline that has passed, then the task's own
 * gate, which may open again. Never a guess: a deadline is named only when the route says it has passed.
 */
export function applyClosedReason(need: Pick<PrilikaProjekcija, 'pokrivenost' | 'rokZaPrijaveIso'>, deadlinePassed: boolean): string {
  if (need.pokrivenost.preostalo <= 0) return 'Sva mesta su popunjena';
  const day = deadlinePassed ? vreme(need.rokZaPrijaveIso).split(' · ')[0] : '';
  if (day) return `Rok za prijave je prošao ${day}`;
  return 'Nove prijave trenutno nisu dostupne';
}

/** What the page says about this account's own part in the task, as the state at its head. Not known (a failed read) says nothing here: the foot says it. */
const relationStatus = (relation: TaskRelation): { text: string; quiet: boolean } | null => relation.kind === 'OWNER' ? { text: 'Tvoj zadatak', quiet: false }
  : relation.kind === 'APPLIED' ? { text: relation.agreementId ? 'Prijava je izabrana' : 'Prijava poslata', quiet: false } : null;

/** What the worker's own plans and work area say about this task (UX plan R25), drawn as two quiet rows under the facts; see `detail/taskFit`. A row without its fact is not drawn. */
export type { TaskFitContext };

/**
 * A task somebody else posted, as a page read top to bottom (composition spec 2026-10-07, T3): its state when it has one, its name, then what it
 * pays, where, when and (only when it is more than one) how many people, as facts of one kind with their pictures, then what the work is, what it
 * asks, what was asked about it, who posted it and where it is, parted by space and never by a line. The same facts in the same words as its card in
 * the list and on the map.
 * The name comes into the bar once the large title has scrolled away. Sharing it is rare and waits behind the bar's "···"; reporting or blocking the
 * person who posted it is not hidden there but stands at the end of the page, in red (rule J15, the owner's "jedva se nađu", 8 Oct 2026). The one
 * action, chosen by what I am to this task, stays at the foot alone (no amount and no time beside it: both are above, in the page), with the reason
 * above it only when it cannot be pressed and the page does not say it already. When I can apply it is "Pošalji prijavu" for a task with a fixed
 * price and "Pošalji ponudu" for one with none (owner, 8 Oct 2026); either opens the form of the application, it sends nothing.
 * Presentation only; the route owns reads, deadline and guards.
 */
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, relation, back, retry, apply, onOwnTask, onOwnApplication, photos, qa, map,
  onRequesterProfile, requesterProfile = null, onCloseRequesterProfile, publicPhoto, safety, deadlinePassed = false, onOtherTasks, onShare, fit, reliabilityPercent }: {
  need: PrilikaProjekcija | null; loading: boolean; error: boolean; missing: boolean; stale: boolean; busy: boolean;
  canApply: boolean; canRetry: boolean; back: () => void; retry: () => void; apply: () => void;
  /** What this account is to this task, from its own tasks and applications. Never from an app mode. */
  relation: TaskRelation; onOwnTask: () => void; onOwnApplication: () => void;
  photos?: ReactNode; qa?: ReactNode;
  /** Where the job is, as an approximate pin. The map owns a focus lifetime, so the route builds it. */
  map?: ReactNode;
  /** Owner decision 3: the requester's public profile as a sheet over the existing read. */
  onRequesterProfile?: () => void; requesterProfile?: PublicProfileState; onCloseRequesterProfile?: () => void;
  /** The sheet wants a large portrait and the row a small one, so the caller is told which. */
  publicPhoto?: (profileId: string, size?: number) => ReactNode;
  /** PKG-047 (F05): report or block the person who posted this task, from their profile and from the bar's "···". */
  safety?: SafetyEntry;
  /** The route's own clock says the server deadline for applications has passed. */
  deadlinePassed?: boolean;
  /** The way on when applying is not possible here: back to the other tasks. */
  onOtherTasks?: () => void;
  /** Hands the task (its title and its public area, never an address) to the system's share sheet; the route owns the call (UX plan R35). */
  onShare?: () => void;
  /** R25: the worker's overlap and distance, when the route could read them. */
  fit?: TaskFitContext;
  /** "Dolazi kako je dogovoreno": the server's percentage for the person who posted it (the public work-trust read), only when the server says it; nothing is drawn without it. */
  reliabilityPercent?: number | null;
}) {
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  const ready = !!need && !loading && !error && !missing;
  // The stops of a route are public structure. They are shown only when they say more than the area the
  // facts already name: "Novi Sad · Novi Sad" under "Novi Sad" was the place a fourth time.
  // The stops of a route only for a task that moves: a task done in one place has its place in the facts and on the map.
  const moves = !!need?.detalji?.geografija && need.detalji.geografija.mode !== 'STATIONARY' && !remote;
  const route = need && moves && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  // Whether the task names a sum decides the word of the one action ("Pošalji prijavu" or "Pošalji ponudu"); the sum itself is drawn by `TaskDecisionValue`.
  const price = need ? productPriceParts(need, '') : null;
  // The server's own deadline, said only when there is one and a person can still apply before it.
  const deadline = canApply && typeof need?.rokZaPrijaveIso === 'string' ? vreme(need.rokZaPrijaveIso) : null;
  const scrollTitle = useDetailScrollTitle();
  const urgencyNow = useUrgencyClock([need?.urgency]);
  // Only sharing is rare enough for "···". Reporting or blocking the person is a way out that a person must find at once, so it is a row of the page (rule J15),
  // and it names the person: on a screen whose action is "Pošalji prijavu", a bare "Prijavi" reads as "apply" (review of step 5b). My own task has nobody to report.
  const rare: SheetAction[] = [
    ...(ready && onShare ? [{ key: 'share', label: 'Podeli', icon: 'send' as const, onPress: onShare }] : []),
  ];
  const reportable = ready && !!safety && relation.kind !== 'OWNER';
  const menu = useDetailMenu(rare, { disabled: busy });
  const status = ready ? relationStatus(relation) : null;
  const urgent = !!need?.urgency && ready;
  // The one foot: what I am to this task decides the one action, and the reason stands above it when there is one.
  const foot = !ready ? null : relation.kind === 'OWNER'
    ? <FlowFooter>
      <ProductFooterAction label="Otvori svoj zadatak" onPress={onOwnTask} disabled={busy} /></FlowFooter>
    : relation.kind === 'APPLIED'
      ? <FlowFooter>
        <ProductFooterAction label={relation.agreementId ? 'Otvori Dogovor' : 'Pogledaj svoju prijavu'} onPress={onOwnApplication} disabled={busy} /></FlowFooter>
      : relation.kind === 'UNKNOWN'
        ? <FlowFooter reason="Ne možemo da proverimo da li je ovo tvoj zadatak ili je prijava već poslata.">
          <V2Action label="Proveri ponovo" onPress={retry} disabled={busy || !canRetry} /></FlowFooter>
        : canApply
          ? <FlowFooter reason={deadline ? `Prijave do ${deadline}` : undefined}>
            <ProductFooterAction label={applyActionLabel(!!price?.isAmount)} onPress={apply} disabled={busy} /></FlowFooter>
          // Not the brand action: nothing here can be done about it, so the foot is one grey sentence of state (never an empty bar) and the way on.
          : <FlowFooter reason={applyClosedReason(need!, deadlinePassed)}>
            {onOtherTasks ? <V2Action label="Drugi zadaci" kind="quiet" disabled={busy} onPress={onOtherTasks} /> : null}
          </FlowFooter>;
  return <>
    <Screen kind="detail" header={<ProductHeader back={back} disabled={busy} title={need ? readableTitle(need.naslov) : undefined} titleVisible={scrollTitle.titleVisible}
      right={menu.button} />} footer={foot} onScroll={scrollTitle.onScroll}>
      {!need && loading ? <View style={s.state} accessibilityLiveRegion="polite">
        <View accessibilityLabel="Učitavamo zadatak"><SkeletonCard rows={3} /></View>
        <T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T>
      </View> : null}
      {!need && !loading && error ? <StateView kind="error" art="tasks" title="Ne možemo da učitamo zadatak" body="Proveri internet vezu i pokušaj ponovo."
        primary={canRetry ? { label: 'Pokušaj ponovo', onPress: retry, disabled: busy } : undefined} /> : null}
      {/* A task that is not there says so and leads back to the other tasks; a read that may only have failed can be tried again. */}
      {!need && !loading && !error && missing ? <StateView art="tasks" title="Ovaj zadatak više nije dostupan" body="Zadatak je možda zatvoren ili ga ne možeš da vidiš."
        primary={onOtherTasks ? { label: 'Nazad na zadatke', onPress: onOtherTasks, disabled: busy } : undefined}
        quiet={canRetry ? { label: 'Pokušaj ponovo', onPress: retry, disabled: busy } : undefined} /> : null}
      {need && stale ? <Surface kind="note" tone="warn">
        <T accessibilityLiveRegion="polite" variant="note">Vidiš starije podatke. Osveži zadatak pre nastavka.</T>
        {error && canRetry ? <V2Action label="Pokušaj ponovo" kind="quiet" onPress={retry} disabled={busy} style={s.refresh} /> : null}
      </Surface> : null}
      {need ? <>
        {ready && !stale ? photos : null}
        <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
          {status || urgent ? <CardStatus status={status} urgency={need.urgency} now={urgencyNow} /> : null}
          <TaskDecisionTitle onLayout={scrollTitle.onTitleLayout}>{readableTitle(need.naslov)}</TaskDecisionTitle>
          <View style={s.facts}>
            <TaskDecisionValue need={need} offersInfo={OFFERS_INFO.worker} />
            <TaskDecisionFacts need={need} />
            {ready && fit?.overlapTitle ? <FactRow size="detail" art="alert" value={`Preklapa se sa tvojim Dogovorom ${fit.overlapTitle}`} /> : null}
            {ready && typeof fit?.distanceKm === 'number' && fit.distanceKm >= 0 ? <FactRow size="detail" art="map"
              value={`Oko ${Math.max(1, Math.round(fit.distanceKm))} km od tvog područja rada`} /> : null}
          </View>
        </View>
        {/* Who asks stands right under what, where and when (the owner's pick of 8 Oct 2026, "Objavio kao kartica poverenja"): the one record of the page.
            A missing rating stays explicitly missing. */}
        <TaskDecisionPublisher name={need.narucilacIme || 'Ime trenutno nije dostupno'} rating={need.narucilacOcena} count={need.narucilacBrojOcena}
          reliabilityPercent={reliabilityPercent} initials={inicijali(need.narucilacIme)} photo={publicPhoto?.(need.narucilacProfilId, 56)} onPress={onRequesterProfile} disabled={busy}
          // The profile sheet announces its own reporting errors; avoid announcing the same error behind it.
          error={safety?.error && !requesterProfile ? safety.error : null} />
        {need.opis ? <Section title="O zadatku"><DetailDescription text={need.opis} /></Section> : null}
        <TaskDecisionRequirements rows={needRequirementRows(need)} />
        {/* What was asked about the work, and what its owner answered, is read with the work (owner, 2026-10-07: it was a
            link at the very end, and nobody who read the task saw it). The route builds the section: it owns the reads. */}
        {ready && !stale && qa ? qa : null}
        {/* The place is one section: the approximate pin, what is private, and the stops of a route. It used
            to be said three times — a fact, a map and a "Mesto izvršenja" row that opened into the same words. */}
        {!remote && (map || route.length) ? <Section title="Mesto">
          <View style={s.place}>
            {map}
            <TaskPlacePrivacy />
            {route.length ? <DetailRoute rows={route} /> : null}
          </View>
        </Section> : null}
        {/* Reporting or blocking the person who posted the task: at the end of the page, in red, and not only behind "···" (rule J15). */}
        {reportable ? <Section><ListRow leading={<FactArt kind="shield" size={32} />} title="Prijavi ili blokiraj osobu" accessibilityLabel="Prijavi ili blokiraj osobu"
          tone="danger" disabled={busy || !!safety?.busy} last onPress={safety!.onPress} /></Section> : null}
      </> : null}
    </Screen>
    {menu.sheet}
    {onCloseRequesterProfile ? <PublicProfileSheet state={requesterProfile} onClose={onCloseRequesterProfile} onRetry={onRequesterProfile ?? onCloseRequesterProfile}
      photo={publicPhoto} safety={safety} /> : null}
  </>;
}

const s = StyleSheet.create({
  state: { gap: sys.space.md },
  center: { textAlign: 'center' },
  // The title stays a direct child of this measured scroll block, so its handoff to the bar includes the real padding.
  // State, name and amount are 8 apart; the facts are 16 under the amount.
  hero: { gap: sys.space.sm },
  facts: { gap: sys.space.md, paddingTop: sys.space.sm },
  place: { gap: sys.space.md },
  refresh: { alignSelf: 'flex-start' },
});
