import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { T } from '../Text';
import { Press } from '../Press';
import { Surface } from '../system/Surface';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { Avatar } from '../system/Avatar';
import { StateView } from '../system/StateView';
import { ScreenChrome } from '../system/ScreenChrome';
import { sys } from '../system/tokens';
import { layout, ruleWidth } from '../system/layout';
import { ProfilePhoto } from '../media/ContextPhotos';
import { cenaSaOsnovom } from '../../lib/novac';
import type { DogovorProjekcija } from '../../contracts/projections';
import { ownAgreementView, type OwnAgreementGroup } from '../../data/ownAgreementGroupsPage';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { agreementAttention, agreementChip } from './agreementListModel';
import { AgreementStatusChip } from './AgreementStatusChip';
import { agreementTaskSummary, fillText, isOpenAgreement, type AgreementTaskPerson } from './agreementTaskModel';

type Role = 'narucilac' | 'uskocer';
type Loaded = { items: DogovorProjekcija[] } | { error: true } | null;

/** All my Dogovori of one task, in both sections. The list searches by title; only this exact task and role is kept. */
async function readTaskAgreements(source: ReturnType<typeof useIzvor>, needId: string, role: Role, title: string): Promise<DogovorProjekcija[] | null> {
  const found: DogovorProjekcija[] = [];
  for (const section of ['active', 'history'] as const) {
    const view = ownAgreementView({ section, role, outcome: 'all', confirmationOnly: false, query: title });
    const page = await source.mojiDogovoriStrana({ view, limit: 20, cursor: null });
    for (const group of page.items as OwnAgreementGroup[]) {
      if (group.needId === needId && group.role === role) for (const item of group.items) if (!found.some(x => x.id === item.id)) found.push(item);
    }
  }
  return found;
}

function Face({ person, size = 48 }: { person: { profileId: string | null; initials: string }; size?: 40 | 48 }) {
  const letters = <Avatar initials={person.initials} size={size} edge />;
  return person.profileId ? <ProfilePhoto profileId={person.profileId} size={size} fallback={letters} /> : letters;
}

/** One person of this task: avatar, name, state, agreed price and term; a private message and (owner, open) remove. */
function PersonCard({ person, owner, now, onOpen, onMessage, onRemove }: {
  person: AgreementTaskPerson; owner: boolean; now: Date;
  onOpen: () => void; onMessage: () => void; onRemove?: () => void;
}) {
  const item = person.agreement;
  const attention = agreementAttention(item);
  const price = item.cena.prikaz ? cenaSaOsnovom(item.cena.prikaz, item.osnovaCene) : 'Cena po dogovoru';
  return <Surface kind="record">
    <View style={s.personRow}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvorite Dogovor sa: ${person.name}`}
        accessibilityHint="Otvara uslove, poruke i završetak za ovu osobu." onPress={onOpen} haptic="select" style={s.personMain}>
        <Face person={person} />
        <View style={s.personCopy}>
          <View style={s.nameRow}>
            <T variant="bodyStrong" numberOfLines={1} style={s.flex}>{person.name}</T>
            <AgreementStatusChip chip={agreementChip(item, now)} />
          </View>
          <T variant="note" style={s.money} numberOfLines={1}>{price}</T>
          <View style={s.fact}><FactArt kind="calendar" size={16} /><T variant="meta" tone="muted" numberOfLines={1} style={s.flex}>{item.vremeTekst || 'Termin po dogovoru'}</T></View>
          {attention ? <View style={s.fact}><View style={s.dot} /><T variant="note" style={s.warn} numberOfLines={2}>{attention.title}</T></View> : null}
          {item.problemOtvoren ? <T variant="note" tone="danger">Prijavljen je problem</T> : null}
        </View>
      </Press>
      <View style={s.personActions}>
        <Press accessibilityRole="button" accessibilityLabel={`Pošaljite privatnu poruku: ${person.name}`} onPress={onMessage}
          haptic="select" style={s.iconButton}>
          <Glyph name="messages" size={24} tone="green" />
        </Press>
        {onRemove ? <Press accessibilityRole="button" accessibilityLabel={`Otkažite Dogovor sa: ${person.name}`}
          accessibilityHint="Otvara otkazivanje uz razlog. Pre slanja vidite pregled." onPress={onRemove} haptic="select" style={s.iconButton}>
          <Glyph name="close" size={24} tone="danger" />
        </Press> : null}
      </View>
    </View>
  </Surface>;
}

type Tab = { key: 'agreed' | 'applications' | 'group' | 'edit'; label: string; art?: 'agreements' | 'applications'; glyph?: 'messages' | 'edit'; onPress?: () => void };

/**
 * The Dogovor of one task (owner's design, 22.11.2026): an overview of the task, then four icons — 🤝 Dogovoreni,
 * ✈️ Prijave (the app's blue paper plane), 💬 grupni razgovor, ✏️ uređivanje — and one card per agreed person.
 * A worker sees the task owner and the group conversation, never other workers or their applications.
 */
export function AgreementTaskHub({ needId, role, title, fallbackAgreementId }: { needId: string; role: Role; title: string; fallbackAgreementId?: string }) {
  const router = useRouter(), source = useIzvor(), { user, accountRevision } = useSesija();
  const [loaded, setLoaded] = useState<Loaded>(null);
  const generation = useRef(0), focused = useRef(false), navigating = useRef(false);
  const load = useCallback(async () => {
    const run = ++generation.current, owner = user?.id;
    const items = await readTaskAgreements(source, needId, role, title).catch(() => null);
    if (run !== generation.current || sesijaSada().user?.id !== owner || sesijaSada().accountRevision !== accountRevision || izvorSada() !== source) return;
    setLoaded(items ? { items } : { error: true });
  }, [source, needId, role, title, user?.id, accountRevision]);
  useFocusEffect(useCallback(() => {
    focused.current = true; navigating.current = false; void load();
    return () => { focused.current = false; generation.current++; };
  }, [load]));
  const go = (action: () => void) => {
    if (!focused.current || navigating.current || AppState.currentState !== 'active') return;
    navigating.current = true; action();
  };
  const items = loaded && 'items' in loaded ? loaded.items : null;
  const summary = useMemo(() => items?.length ? agreementTaskSummary({ key: needId, items }) : null, [items, needId]);
  const now = new Date();
  const owner = role === 'narucilac';
  const anchor = items?.find(isOpenAgreement) ?? items?.[0] ?? null;
  const openAgreement = (id: string, tab?: 'poruke') => go(() => router.navigate({ pathname: '/dogovor/[id]', params: tab ? { id, tab } : { id } }));
  const tabs: Tab[] = [
    { key: 'agreed', label: owner ? 'Dogovoreni' : 'Dogovor', art: 'agreements' },
    ...(owner ? [{ key: 'applications' as const, label: 'Prijave', art: 'applications' as const,
      onPress: () => go(() => router.navigate({ pathname: '/potrebe/[id]/kandidati', params: { id: needId } })) }] : []),
    ...(anchor ? [{ key: 'group' as const, label: 'Grupa', glyph: 'messages' as const,
      onPress: () => go(() => router.navigate({ pathname: '/dogovor/[id]/grupa', params: { id: anchor.id } })) }] : []),
    ...(owner ? [{ key: 'edit' as const, label: 'Zadatak', glyph: 'edit' as const,
      onPress: () => go(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: needId } })) }] : []),
  ];
  const back = () => go(() => (router.canGoBack() ? router.back() : router.navigate('/dogovori')));
  const people = summary ? (owner ? summary.people : summary.owner ? [summary.owner] : []) : [];
  const open = people.filter(p => isOpenAgreement(p.agreement)), earlier = people.filter(p => !isOpenAgreement(p.agreement));

  return <SafeAreaView edges={['top']} style={s.screen}>
    <ScreenChrome variant="detail" title={summary?.title ?? title} backLabel="Nazad na Dogovore" onBack={back} />
    {!loaded ? <StateView skeleton={{ rows: 3, face: true }} title="Učitavamo Dogovor…" body="Proveravamo dogovorene osobe i uslove." />
      : 'error' in loaded ? <StateView kind="error" art="agreements" title="Dogovor nije učitan" body="Proverite vezu i pokušajte ponovo."
        primary={{ label: 'Pokušajte ponovo', onPress: () => { setLoaded(null); void load(); } }} />
        : !summary ? <StateView art="agreements" title="Dogovor nije pronađen" body="Možda je zadatak promenjen ili je Dogovor otkazan."
          primary={fallbackAgreementId ? { label: 'Otvorite Dogovor', onPress: () => openAgreement(fallbackAgreementId) } : { label: 'Nazad na Dogovore', onPress: back }} />
          : <ScrollView contentContainerStyle={s.content}>
            <Surface kind="record">
              <View style={s.overview}>
                <T variant="title" accessibilityRole="header">{summary.title}</T>
                <View style={s.fact}><FactArt kind="money" size={20} /><T variant="bodyStrong" style={[s.money, s.flex]}>{summary.priceText ?? 'Cena po dogovoru'}</T></View>
                <View style={s.fact}><FactArt kind={summary.remote ? 'remote' : 'pin'} size={20} /><T variant="body" style={s.flex}>{summary.placeText}</T></View>
                <View style={s.fact}><FactArt kind="calendar" size={20} /><T variant="body" style={s.flex}>{summary.whenText}</T></View>
                {summary.description ? <T variant="copy" tone="muted">{summary.description}</T> : null}
                {owner ? <View style={s.fill}><FactArt kind="users" size={18} /><T variant="note" style={s.fillText}>Dogovoreno: {fillText(summary)}</T></View> : null}
              </View>
            </Surface>
            <View style={s.tabs} accessibilityRole="tablist">
              {tabs.map(tab => {
                const selected = tab.key === 'agreed';
                return <Press key={tab.key} accessibilityRole={selected ? 'tab' : 'button'} accessibilityState={{ selected }}
                  accessibilityLabel={tab.label} onPress={tab.onPress} disabled={!tab.onPress && !selected} haptic="select"
                  style={[s.tab, selected && s.tabOn]}>
                  {tab.art ? <FactArt kind={tab.art} size={28} /> : <Glyph name={tab.glyph!} size={26} tone={selected ? 'green' : 'ink'} />}
                  <T variant="meta" style={selected ? s.tabTextOn : undefined} numberOfLines={1}>{tab.label}</T>
                </Press>;
              })}
            </View>
            {open.length ? open.map(person => <PersonCard key={person.agreementId} person={person} owner={owner} now={now}
              onOpen={() => openAgreement(person.agreementId)} onMessage={() => openAgreement(person.agreementId, 'poruke')}
              onRemove={owner ? () => go(() => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id: person.agreementId, start: 'cancel' } })) : undefined} />)
              : <StateView compact art="agreements" title={owner ? 'Trenutno nema aktivnih Dogovora' : 'Dogovor nije aktivan'}
                body={owner ? 'Pogledajte prijave i izaberite ljude za ovaj zadatak.' : 'Ranije saradnje su ispod.'} />}
            {earlier.length ? <View style={s.earlier}>
              <T variant="label" tone="muted">Ranije</T>
              {earlier.map(person => <PersonCard key={person.agreementId} person={person} owner={owner} now={now}
                onOpen={() => openAgreement(person.agreementId)} onMessage={() => openAgreement(person.agreementId, 'poruke')} />)}
            </View> : null}
          </ScrollView>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { padding: layout.gutter, gap: sys.space.md, paddingBottom: sys.space.xl * 2 },
  overview: { gap: sys.space.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  money: { color: sys.color.money },
  fill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: sys.color.greenSoft },
  fillText: { color: sys.color.green, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: sys.space.sm },
  tab: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: sys.radius.control,
    borderWidth: ruleWidth, borderColor: sys.color.line, backgroundColor: sys.color.surface, paddingHorizontal: 4 },
  tabOn: { borderColor: sys.color.green, borderWidth: 2, backgroundColor: sys.color.greenSoft },
  tabTextOn: { color: sys.color.green, fontWeight: '700' },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  personMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, minWidth: 0 },
  personCopy: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  personActions: { alignItems: 'center', gap: 4 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sys.color.warn },
  warn: { color: sys.color.warn, flexShrink: 1 },
  earlier: { gap: sys.space.sm, marginTop: sys.space.sm },
});
