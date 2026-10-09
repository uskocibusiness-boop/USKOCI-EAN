import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../ui/system/ScreenHeader';
import { ActualUserAvatar } from '../../ui/system/ActualUserAvatar';
import { AppState } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import { agreementCancellationService, type AgreementCancellations } from '../../data/agreementCancellationClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { filterAgreementRole, groupAgreementTasks, isActiveAgreementTask, type HistoryFilter, type AgreementRoleFilter } from '../../ui/agreements/agreementListModel';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';

export default function Dogovori() {
  const { user, accountRevision } = useSesija();
  return <AgreementListSession key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function AgreementListSession() {
  // Display choices contain no private rows. Keep them through the foreground
  // privacy gate, but retire them with the account incarnation above.
  // The profile's "završeni Dogovori" lands on the section that holds the finished ones (`odeljak=istorija`), also when the tab is
  // already mounted; without the param nothing changes.
  const { odeljak } = useLocalSearchParams<{ odeljak?: string }>();
  const [section, setSection] = useState<AgreementCollectionSection>(odeljak === 'istorija' ? 'history' : 'active');
  const [confirmationOnly, setConfirmationOnly] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [roleFilter, setRoleFilter] = useState<AgreementRoleFilter>('all');
  const [expandedTaskKey, setExpandedTaskKey] = useState<string | null>(null);
  // The profile's total means every role. Consume this explicit entry once so
  // back from a detail preserves filters and a later profile entry resets again.
  useEffect(() => {
    if (odeljak !== 'istorija') return;
    setSection('history'); setConfirmationOnly(false); setHistoryFilter('all'); setRoleFilter('all');
    router.setParams({ odeljak: undefined });
  }, [odeljak]);
  const foreground = useRef({ active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive', generation: 0 });
  const [, render] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => {
      const active = value === 'active';
      if (foreground.current.active === active) return;
      foreground.current.active = active; foreground.current.generation++;
      render(foreground.current.generation);
    });
    return () => subscription.remove();
  }, []);
  // Retire private rows and callbacks synchronously, including a batched
  // background→foreground transition; returning creates a fresh owned read.
  return foreground.current.active ? <OwnedAgreements key={foreground.current.generation}
    foreground={foreground.current} section={section} confirmationOnly={confirmationOnly} historyFilter={historyFilter} roleFilter={roleFilter}
    expandedTaskKey={expandedTaskKey} onExpandedTask={setExpandedTaskKey}
    onSection={setSection} onConfirmationOnly={setConfirmationOnly} onHistoryFilter={setHistoryFilter} onRoleFilter={setRoleFilter} /> : null;
}
function OwnedAgreements({ foreground, section, confirmationOnly, historyFilter, roleFilter, expandedTaskKey, onExpandedTask, onSection, onConfirmationOnly, onHistoryFilter, onRoleFilter }: {
  foreground: { active: boolean; generation: number }; section: AgreementCollectionSection; confirmationOnly: boolean; historyFilter: HistoryFilter; roleFilter: AgreementRoleFilter;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void; onHistoryFilter: (value: HistoryFilter) => void; onRoleFilter: (value: AgreementRoleFilter) => void;
  expandedTaskKey: string | null; onExpandedTask: (key: string | null) => void;
}) {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const readGeneration = useRef(0), foregroundGeneration = foreground.generation;
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    setScope(owner);
    return () => { if (focus.current === owner) focus.current = null; };
  }, [source]));
  const load = useCallback(async () => {
    readGeneration.current++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([source.mojiDogovori(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AGREEMENTS_READ_TIMEOUT')), 15_000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load);
  const renderedReadGeneration = readGeneration.current;
  const latest = useRef(resource); latest.current = resource;
  const current = () => foreground.active && foreground.generation === foregroundGeneration && renderedReadGeneration === readGeneration.current
    && !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => {
    if (current() && !navigating.current) { navigating.current = true; action(); }
  };
  // A card is acted on only while it is a row of the list on screen: a retained card from an older read is refused.
  const shown = (agreement: DogovorProjekcija) => {
    const value = latest.current;
    return !value.loading && !value.error && value.data === resource.data && !!value.data?.includes(agreement);
  };
  const open = (agreement: DogovorProjekcija) => {
    if (!shown(agreement)) return;
    navigate(() => router.navigate({ pathname: '/dogovor/[id]', params: { id: agreement.id } }));
  };
  // The rating strip of a finished Dogovor goes straight to its rating (round-1 critique A2), the same route the
  // Dogovor's own footer opens, behind the same guards. The list offers it only while the Dogovor says the rating is
  // possible; the rating screen reads for itself whether mine is still due. `from` names where Back returns.
  const rate = (agreement: DogovorProjekcija) => {
    if (!shown(agreement) || agreement.stanje !== 'COMPLETED' || !agreement.ocenaMoguca) return;
    navigate(() => router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: agreement.id, from: 'dogovori' } }));
  };
  const onProfile = () => navigate(() => router.navigate('/profil'));
  // One bounded read for cancelled collaborations in this section, including siblings of an active task.
  // A failed or stale read leaves the authoritative status visible without inventing a reason.
  const cancelledIds = useMemo(() => groupAgreementTasks(filterAgreementRole(resource.data ?? [], roleFilter))
    .filter(task => isActiveAgreementTask(task) === (section === 'active'))
    .flatMap(task => task.items.filter(item => item.stanje === 'CANCELLED').map(item => item.id)), [resource.data, section, roleFilter]);
  const cancelledKey = cancelledIds.join('|');
  const [cancellations, setCancellations] = useState<{ key: string; value: AgreementCancellations; scope: object | null;
    generation: number; data: typeof resource.data } | null>(null);
  useEffect(() => {
    if (!current() || resource.loading || resource.refreshing || resource.error || !cancelledIds.length || !user?.id) return;
    let live = true;
    void agreementCancellationService.read(cancelledIds, { accountId: user.id, accountRevision })
      .then(result => { if (live && current() && result.ok) setCancellations({ key: cancelledKey, value: result.podatak,
        scope, generation: renderedReadGeneration, data: resource.data }); }).catch(() => undefined);
    return () => { live = false; };
  }, [cancelledKey, user?.id, accountRevision, scope, renderedReadGeneration, resource.data, resource.loading, resource.refreshing, resource.error]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AgreementCollectionPresentation header={<ScreenHeader title="Dogovori" onProfile={onProfile} profileEntry={<ActualUserAvatar onPress={onProfile} />} />} items={resource.data ?? []} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    cancellations={!resource.loading && !resource.refreshing && !resource.error && current() && cancellations?.key === cancelledKey && cancellations.scope === scope
      && cancellations.generation === renderedReadGeneration && cancellations.data === resource.data ? cancellations.value : null}
    section={section} confirmationOnly={confirmationOnly} historyFilter={historyFilter} roleFilter={roleFilter}
    expandedTaskKey={expandedTaskKey} onExpandedTask={(key, witness) => { if (current() && shown(witness)) onExpandedTask(key); }}
    onSection={value => { if (current()) onSection(value); }}
    onConfirmationOnly={value => { if (current()) onConfirmationOnly(value); }}
    onHistoryFilter={value => { if (current()) onHistoryFilter(value); }}
    onRoleFilter={value => { if (current()) { onRoleFilter(value); onConfirmationOnly(false); } }}
    onRefresh={() => { if (current()) void resource.refresh(true); }} onOpen={open} onRate={rate}
    onCalendar={() => navigate(() => router.navigate('/raspored'))}
    onProfile={onProfile}
    onHome={() => navigate(() => router.navigate('/'))}
    // The two ways a first Dogovor begins, for the empty list: apply to a task, or publish one.
    onTasks={() => navigate(() => router.navigate('/zadaci'))} onPublish={() => navigate(() => router.navigate('/nova'))} />;
}
