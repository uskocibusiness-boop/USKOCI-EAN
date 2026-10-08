import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { readinessCopy, type NeedPublicationReadiness } from '../../data/needPublicationReadiness';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { DetailDescription, DetailRoute, routeAddsToArea, ProductFooterAction, ProductHeader,
  productPriceParts, useDetailMenu, useDetailScrollTitle } from '../product/ProductDetails';
import type { SheetAction } from '../system/ActionSheet';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { FlowFooter } from '../system/FlowFooter';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { OUTCOME_ACTION } from '../system/outcomeCopy';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { SkeletonCard } from '../system/Skeleton';
import { StateView } from '../system/StateView';
import { StatusChip } from '../system/StatusChip';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';
import { osoba, prijava as prijave } from '../system/plural';
import { countryName } from '../location/CountryField';
import { TaskDecisionRequirements, TaskDecisionTitle } from './detail/TaskDecision';
import { NO_APPLICATIONS_HELP_LABEL, ownTaskOverview, type NoApplicationsHelp, type NoApplicationsHelpAction, type OverviewSearch } from './ownTaskOverview';

export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  remainingClosed: boolean;
  onBack: () => void; onRefresh: () => void; onReview: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
  /** Opens the existing personal Agreements list, not a task-filtered list. */
  onAgreements?: () => void;
  /** What the publish gate says about a draft, asked of the gate itself. Absent means not asked. */
  readiness?: NeedPublicationReadiness | null;
  photos?: ReactNode;
  /** Where the job is, as an approximate pin. The map owns a focus lifetime, so the route builds it. */
  map?: ReactNode;
  /** The lifecycle's recovery (NeedLifecycleActions in its "···" placement): drawn only while it has something to say. */
  lifecycleActions?: ReactNode;
  /** The lifecycle's own ways in (cancel, delete a draft, the Dogovori), for the "···" beside the edits. */
  lifecycleMenu?: readonly SheetAction[];
  /** Deleting this draft: the same callback the "···" calls (it asks first, in the centred dialog). Present only for a draft that can be deleted. */
  onDeleteDraft?: () => void;
  /** One contextual footer action may temporarily outrank applications/Dogovori; it never adds a second primary button. */
  primaryOverride?: { label: string; accessibilityLabel?: string; disabled?: boolean; arrow?: boolean; onPress: () => void };
  qaAction?: ReactNode;
  /**
   * What the screen read about the search for the missing places, and whether its own section about it is on the screen. The
   * page says "Dogovor je otkazan" and "Tvoj zadatak opet prima prijave" only from this (see `ownTaskOverview`); without it
   * the page says what the task itself shows.
   */
  search?: { state: OverviewSearch | null; speaks: boolean };
  /**
   * UX needs R16: a published task that has had no application for a day. The words and the ways come from `noApplicationsHelp`
   * (`ownTaskOverview`), which says them only when it KNOWS the task has waited that long and nobody applied (it needs when the task was
   * published, which the owner's read of a task does not carry yet: behind its switch, OFF). Each way is one row of one section, and
   * `onWaitingHelp` is told which; without it the page says nothing about waiting.
   */
  waitingHelp?: NoApplicationsHelp | null;
  onWaitingHelp?: (action: NoApplicationsHelpAction) => void;
};

/** What each of the ways of R16 looks like as a row: a picture, and one grey line only where it says something the words do not. */
const HELP_ROW: Readonly<Record<NoApplicationsHelpAction, { art: FactArtKind; subtitle?: string }>> = {
  PHOTO: { art: 'photo', subtitle: 'Fotografija pokazuje šta treba uraditi.' },
  WIDEN_TERM: { art: 'calendar', subtitle: 'Širi termin ostavlja više ljudi koji mogu da stignu.' },
  SHARE: { art: 'send' },
  EDIT: { art: 'document' },
};

/** The applications row's quiet line: how many can be chosen, and the total when it says something more. */
function applicationsDetail(need: PotrebaProjekcija): { text: string; attention: boolean } {
  const selectable = need.brojPrijavaZaIzbor;
  if (typeof selectable === 'number' && selectable > 0) return { attention: true,
    text: need.brojPrijava > selectable ? `${prijave(selectable)} za izbor · ukupno ${prijave(need.brojPrijava)}` : `${prijave(selectable)} za izbor` };
  if (selectable == null) return { attention: false, text: need.brojPrijava ? `Ukupno ${prijave(need.brojPrijava)}` : 'Još nema prijava' };
  return { attention: false, text: need.brojPrijava ? `Trenutno nema prijava za izbor. Ukupno ${prijave(need.brojPrijava)}` : 'Još nema prijava' };
}

/**
 * The owner's own Task, recomposed from zero (owner, 2026-09-23) and given one voice (owner, 2026-10-07: "vidno i lako
 * razumljivo"), and set on the one grid (composition spec 2026-10-07, T3 and 4.6): the page of the task somebody else sees
 * (`PublicNeedPresentation`) and this one are the same page from two sides, so they have the same frame (`Screen kind="detail"`,
 * the edge 20, parts 24 apart and never parted by a line) and the same one foot.
 *
 * The owner comes here to see whether the task is live and what is theirs to do, so the screen reads: ONE state (the chip every
 * list of tasks wears), the name, ONE grey sentence about what happens next (`ownTaskOverview` says both, from the task and
 * nothing else), what happened to a command they sent (only while there is something to say), the facts, the two ways in
 * (the applications, the Dogovori), real photos, the same compact terms and work description a stranger sees, requirements, the
 * questions people asked (the waiting ones first, with the way to answer) and the place. What changes the task is needed rarely,
 * so it waits behind the bar's "···" (owner step 5b, 2026-09-24): the edit, closing the remaining search, cancelling or
 * deleting, each with its own confirmation; a draft also has them as two rows at the end of the page (owner, 2026-10-07).
 * At most ONE green action at the foot, and only when something is the owner's to do: review for a draft, compare the applications
 * that wait, open the Dogovor. Where nothing is, there is no green button and the sentence says what the task is waiting for.
 * Only existing controller callbacks act.
 */
export function NeedPresentation(props: NeedPresentationProps) {
  const { need, loading, error, busy, remainingClosed } = props;
  // This is the owner's view of their own Zadatak: the route reads it through the owner-only read,
  // so there is no "other side of the app" from which it could be seen without the right to act.
  const draft = need?.stanje === 'NACRT';
  const usable = !!need && !loading && !error;
  const requirements = need ? needRequirementRows(need) : [];
  // A draft the gate refuses says why, once. What the one action does follows the reason (see `ownTaskOverview`): the place is
  // fixed in the conversation, the rest is read in the review, and what only time or the server can mend is waited for.
  const blocked = draft ? readinessCopy(props.readiness ?? { kind: 'UNKNOWN' }) : null;
  // `busy` is true while anything on the screen is loading, including the first read, so the one
  // action announced work in progress before anything had been asked for.
  const working = busy && !loading;
  const primaryOverride = props.primaryOverride;
  const overview = need ? ownTaskOverview({ need, remainingClosed, readiness: props.readiness, search: props.search,
    overridden: !!primaryOverride, canOpenAgreements: !!props.onAgreements }) : null;
  const primary = overview?.primary ?? null;
  const primaryLabel = working ? 'Samo trenutak…' : primaryOverride ? primaryOverride.label : primary?.label ?? '';
  const primaryAction = primaryOverride ? primaryOverride.onPress
    : primary?.kind === 'REVIEW' ? props.onReview : primary?.kind === 'EDIT' ? props.onEdit
      : primary?.kind === 'AGREEMENTS' ? props.onAgreements! : props.onCandidates;
  const remote = need?.detalji?.geografija?.mode === 'REMOTE';
  // The owner's own task shows the same price a stranger sees, totals included; only the line under an
  // open price speaks to the owner instead of to the person applying.
  const price = need ? productPriceParts(need, 'Svako u prijavi predlaže ukupan iznos.') : null;
  const selectable = need?.brojPrijavaZaIzbor;
  const counted = need ? applicationsDetail(need) : null;
  // The place as others see it, with the public stops of a route and the country when the task has them.
  const route = need?.detalji?.geografija && !remote && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  const country = need?.taskCountryCode ? countryName(need.taskCountryCode) ?? need.taskCountryCode : null;
  const canEdit = !!need && need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA';
  const canCloseRemaining = !!need && !remainingClosed && need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0;
  // "Stalno / ponekad / retko" (owner, 2026-09-23): changing the task is rare, so it waits behind "···". Every entry calls
  // the same callback the screen's own button called, and that callback asks before it acts.
  const rare: SheetAction[] = usable && need ? [
    ...(draft ? [{ key: 'edit', label: 'Izmeni nacrt', icon: 'document' as const, onPress: props.onEdit }]
      : canEdit ? [{ key: 'edit', label: 'Izmeni zadatak', icon: 'document' as const, onPress: props.onEdit }] : []),
    ...(canCloseRemaining ? [{ key: 'close-remaining', label: 'Ne traži više nikoga', icon: 'users' as const, destructive: true,
      hint: `Dogovoreno je ${need.pokrivenost.popunjeno} od ${need.pokrivenost.ukupno}. Zatvara potragu za preostala mesta.`, onPress: props.onCloseRemaining }] : []),
    ...(props.lifecycleMenu ?? []),
  ] : [];
  const menu = useDetailMenu(rare, { disabled: busy });
  const scrollTitle = useDetailScrollTitle();
  const help = props.waitingHelp && props.onWaitingHelp && props.waitingHelp.actions.length && !draft && usable ? props.waitingHelp : null;
  // The one foot: the one green action, or nothing. With nothing to do there is no foot and the sentence under the title says what the task waits for.
  const foot = primaryOverride || (need && (working || primary)) ? <FlowFooter>
    <ProductFooterAction label={primaryLabel}
      accessibilityLabel={working ? undefined : primaryOverride?.accessibilityLabel ?? (primaryOverride ? primaryOverride.label : primary?.spoken)}
      disabled={busy || !!primaryOverride?.disabled || (!primaryOverride && !usable)}
      arrow={!working && (primaryOverride?.arrow ?? true)} onPress={primaryAction} />
  </FlowFooter> : null;
  return <>
    <Screen kind="detail" header={<ProductHeader back={props.onBack} title={need ? readableTitle(need.naslov) : undefined}
      titleVisible={scrollTitle.titleVisible} right={menu.button} />} footer={foot} onScroll={scrollTitle.onScroll}>
      {/* The lifecycle's recovery stays on the screen whatever the read is doing: a retained command is checked, and its
          outcome shown, even while the task loads or cannot be read. */}
      {loading && !need ? <View style={s.state} accessibilityLiveRegion="polite">
        <SkeletonCard rows={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatak…</T>
        {props.lifecycleActions}
      </View>
        : !need ? <>
          <StateView kind="error" art="tasks" title="Zadatak nije dostupan" body={error ?? 'Pokušaj ponovo.'}
            primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
          {props.lifecycleActions}
        </> : <>
          <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
            {/* ONE state, in the owner's eight words (the chip every list of tasks wears); then the name; then ONE grey sentence about
                what happens next. People never see a category (owner decision 2026-09-21); the server reads kinds of work only to match. */}
            {overview?.chip || need.urgency ? <View style={s.badgeRow}>
              {overview?.chip ? <StatusChip status={overview.chip.status} detail={overview.chip.detail} /> : null}
              {need.urgency ? <NeedUrgencyBadge urgency={need.urgency} /> : null}
            </View> : null}
            <TaskDecisionTitle onLayout={scrollTitle.onTitleLayout}>{readableTitle(need.naslov)}</TaskDecisionTitle>
            {overview?.sentence ? <T variant="copy" tone="muted" testID="own-task-next">{overview.sentence}</T> : null}
            {overview?.note ? <T variant="note" tone="muted">{overview.note}</T> : null}
          </View>
          {loading || error ? <Surface kind="note"><View accessibilityLiveRegion="polite" style={s.notice}>
            <T variant="note" tone="muted">{loading ? 'Osvežavamo podatke…' : 'Vidiš starije podatke.'}</T>
            {error && !loading ? <T variant="note" tone="danger" accessibilityRole="alert">{error}</T> : null}
            {error && !loading ? <V2Action label={OUTCOME_ACTION.refresh} accessibilityLabel="Osveži zadatak" kind="quiet" compact onPress={props.onRefresh} style={s.noticeAction} /> : null}
          </View></Surface> : null}
          {/* A draft the publish gate refuses says why, once, where the owner reads first. */}
          {blocked ? <Surface kind="note" tone="warn"><View accessibilityLiveRegion="polite" style={s.notice}>
            <T variant="bodyStrong" style={s.warnTitle}>{blocked.title}</T>
            <T variant="note" style={s.ink}>{blocked.detail}</T>
            {/* What only time or the server can mend has no green action: the owner can read again, and the page says why it waits. */}
            {overview?.waits ? <V2Action label={OUTCOME_ACTION.refresh} accessibilityLabel="Osveži zadatak" kind="quiet" compact disabled={busy} onPress={props.onRefresh} style={s.noticeAction} /> : null}
          </View></Surface> : null}
          {/* What happened to a cancel or a delete the owner sent is said where they read first, never inside the "···"
              they pressed: the check, the command running, its uncertain, confirmed or refused outcome. It draws nothing
              while there is nothing to say. */}
          {props.lifecycleActions}
          <View style={s.facts}>
            {price ? <View accessible accessibilityLabel={`Budžet: ${price.value}${price.note ? `, ${price.note}` : ''}`} style={s.price}>
              <T style={price.isAmount ? s.amount : s.priceWords}>{price.value}</T>
              {price.note ? <T variant="note" tone="muted">{price.note}</T> : null}
            </View> : null}
            <FactRow size="detail" art={remote ? 'remote' : 'pin'} value={remote ? 'Na daljinu' : need.podrucjeTekst} />
            <FactRow size="detail" art="calendar" value={need.vremeTekst} />
            {/* A draft has no places that could be taken yet, so it says only how many people it needs. */}
            <FactRow size="detail" art="users"
              value={draft ? osoba(need.pokrivenost.ukupno) : `Dogovoreno ${need.pokrivenost.popunjeno}/${need.pokrivenost.ukupno}`} />
          </View>
          {/* A published task nobody has applied to for a day: the real ways to change it, each one row of one section (R16). Never a
              sentence about how many people would have applied, only what is true of this task. */}
          {help ? <Section title={help.sentence.replace(/\.$/, '')}>
            {help.actions.map((action, index) => <ListRow key={action} leading={<FactArt kind={HELP_ROW[action].art} size={32} />}
              title={NO_APPLICATIONS_HELP_LABEL[action]} subtitle={HELP_ROW[action].subtitle} accessibilityLabel={NO_APPLICATIONS_HELP_LABEL[action]}
              disabled={busy} last={index === help.actions.length - 1} onPress={() => props.onWaitingHelp?.(action)} />)}
          </Section> : null}
          {/* Quiet ways in that the green action does not already offer. The applications row is not drawn for an empty list (it led
              nowhere), nor beside a green "Uporedi prijave" that opens the same list. */}
          {overview && (overview.rows.applications || overview.rows.agreements) ? <Section>
            {overview.rows.applications && counted ? <ListRow leading={<FactArt kind="offers" size={32} role="people" />} title="Prijave" subtitle={counted.text}
              accessibilityLabel={`Otvori prijave. ${counted.text}`} disabled={busy || !usable} last={!overview.rows.agreements} onPress={props.onCandidates}
              trailing={counted.attention ? <View style={s.countPill}><T variant="label" style={s.countText}>{String(selectable)}</T></View> : undefined} /> : null}
            {overview.rows.agreements ? <ListRow leading={<FactArt kind="agreements" size={32} role="confirmed" />} title="Moji Dogovori"
              subtitle="Razgovor, uslovi i završetak zadatka." accessibilityLabel="Moji Dogovori" disabled={busy || !usable} last
              onPress={props.onAgreements!} /> : null}
          </Section> : null}
          {props.photos}
          {need.opis ? <Section title="O zadatku"><DetailDescription text={need.opis} /></Section> : null}
          <TaskDecisionRequirements rows={requirements} />
          {/* The questions people asked about this task and what the owner answered, where the work itself is read, in the
              same place a stranger finds them (owner, 2026-10-07). The route builds the section: it owns the reads. */}
          {props.qaAction}
          {/* A stranger saw this Task on a map before its owner did: the public projection carried the
              point and the owner's own read never asked for it. Same coarse pair, same map, one section. */}
          {!remote && (props.map || route.length) ? <Section title="Mesto zadatka">
            <View style={s.place}>
              {props.map}
              <FactRow art="lock" value="Ovako drugi vide mesto. Tačnu adresu i privatne napomene vide samo izabrani, u Dogovoru." />
              {route.length ? <DetailRoute rows={route} country={country} /> : null}
            </View>
          </Section> : null}
          {/* A draft is changed or deleted in plain sight (owner, 2026-10-07: "no easy way to delete it or edit it"), and ALSO behind the
              "···" as before. Neither is green: the footer's one action stays the only one. When that action already opens the
              conversation to complete the draft, it is the edit and is not drawn twice. A published task has its own "···" and no row. */}
          {draft && usable && (props.onDeleteDraft || primary?.kind !== 'EDIT') ? <Section>
            {primary?.kind !== 'EDIT' ? <ListRow leading={<FactArt kind="chat" size={32} />} title="Izmeni nacrt" accessibilityLabel="Izmeni nacrt"
              subtitle="Vrati se u razgovor. Nacrt ostaje sačuvan." disabled={busy} last={!props.onDeleteDraft} onPress={props.onEdit} /> : null}
            {props.onDeleteDraft ? <ListRow leading={<FactArt kind="document" size={32} />} title="Obriši nacrt" accessibilityLabel="Obriši nacrt"
              tone="danger" disabled={busy} last onPress={props.onDeleteDraft} /> : null}
          </Section> : null}
          {/* The "Upravljanje zadatkom" section that ended the screen is gone: its actions are behind "···", a closed
              remaining search is said in the line under the sentence, and the lifecycle's outcomes are shown under the title. */}
        </>}
    </Screen>
    {menu.sheet}
  </>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  center: { textAlign: 'center' },
  state: { gap: sys.space.base },
  // The state, the name and the sentence are 8 apart; the title is a direct child of the measured block, so the bar's handoff counts its real padding.
  hero: { gap: sys.space.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, flexWrap: 'wrap' },
  notice: { gap: sys.space.xs, alignItems: 'flex-start' },
  // A quiet action inside a note starts where the note's text starts (no padding of its own); the width keeps the 48 dp target and the label stays at the start of it.
  noticeAction: { alignSelf: 'flex-start', paddingHorizontal: 0, minWidth: layout.touch, justifyContent: 'flex-start' },
  warnTitle: { color: sys.color.warn },
  // The one amount, then where, when and how many: the facts stand 12 apart, the group has no frame.
  facts: { gap: layout.group },
  price: { gap: sys.space.xs },
  amount: { ...sys.type.priceLarge, color: sys.color.ink },
  priceWords: { ...sys.type.heading, color: sys.color.ink },
  place: { gap: layout.group },
  countPill: { minWidth: sys.space.xl, height: sys.space.xl, borderRadius: sys.radius.pill, paddingHorizontal: sys.space.sm, backgroundColor: sys.color.orange,
    alignItems: 'center', justifyContent: 'center' },
  countText: { color: sys.color.onOrange, letterSpacing: 0, lineHeight: sys.space.base },
});
