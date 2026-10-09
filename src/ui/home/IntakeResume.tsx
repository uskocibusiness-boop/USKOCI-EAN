import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { aiNeedV2Izvor } from '../../data';
import type { OpenIntake, OpenIntakePage } from '../../data/aiOpenIntakes';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { vreme } from '../../lib/vreme';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt } from '../system/FactArt';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

const readFirstPage = () => aiNeedV2Izvor.listOpenIntakes();

/** A saved conversation is not yet a task. This independent read must never delay Home's real work. */
export function IntakeResume({ onOpen }: { onOpen: (id: string) => void }) {
  const resource = useFocusedResource(readFirstPage);
  const { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), pending = useRef<string | null>(null);
  const [token, setToken] = useState<object | null>(null);
  const [sheet, setSheet] = useState<object | null>(null), sheetOwner = useRef<object | null>(null);
  useFocusEffect(useCallback(() => {
    const activate = () => { const owner = {}; focus.current = owner; setToken(owner); };
    activate();
    const retire = () => { focus.current = null; pending.current = null; sheetOwner.current = null; setSheet(null); };
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') activate();
      else retire();
    });
    return () => { subscription.remove(); retire(); };
  }, []));
  const current = () => !!token && focus.current === token && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const page = resource.data;
  if (!page?.rows.length && !resource.error) return null;
  return <>
    <ListRow leading={<FactArt kind="chat" size={32} />} title="Nastavi razgovor o zadatku" last accessibilityLabel="Nastavi razgovor o zadatku"
      accessibilityHint={resource.error ? 'Razgovori nisu učitani. Pokušaj ponovo.'
        : page?.rows.length === 1 && !page.next ? `Otvara razgovor započet ${vreme(page.rows[0].createdAt)}.` : 'Otvara listu započetih razgovora.'}
      subtitle={resource.error ? 'Razgovori nisu učitani. Dodirni da pokušaš ponovo.'
        : page?.rows.length === 1 && !page.next ? `Započeto ${vreme(page.rows[0].createdAt)}` : 'Izaberi započeti razgovor.'}
      onPress={() => {
        if (!current()) return;
        if (resource.error) { void resource.refresh(true); return; }
        if (page?.rows.length === 1 && !page.next) onOpen(page.rows[0].id);
        else if (!sheetOwner.current) { const owner = {}; sheetOwner.current = owner; setSheet(owner); }
      }} />
    {sheet && page ? <ProductSheet title="Započeti razgovori" backdropHint="Zatvara listu razgovora." onClose={() => {
      if (sheetOwner.current !== sheet) return;
      const selected = pending.current; pending.current = null; sheetOwner.current = null; setSheet(null);
      if (selected && current()) onOpen(selected);
    }}>{dismiss => <IntakePages initial={page} current={current} onSelect={id => {
      if (!current() || sheetOwner.current !== sheet || pending.current) return;
      pending.current = id; dismiss();
    }} />}</ProductSheet> : null}
  </>;
}

/** At most twenty rows mounted, with keyset paging. A failed page keeps the preceding rows and its retry. */
function IntakePages({ initial, current, onSelect }: {
  initial: OpenIntakePage; current: () => boolean; onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(initial), [cursors, setCursors] = useState<(OpenIntake | null)[]>([null]);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const flight = useRef<object | null>(null), alive = useRef(false), pageOwner = useRef<object>({});
  const pageToken = pageOwner.current;
  useFocusEffect(useCallback(() => {
    alive.current = true;
    return () => { alive.current = false; flight.current = null; };
  }, []));
  const move = async (nextCursors: (OpenIntake | null)[]) => {
    if (!current() || !alive.current || pageOwner.current !== pageToken || flight.current) return;
    const request = {}; flight.current = request; setBusy(true); setFailed(false);
    try {
      const next = await aiNeedV2Izvor.listOpenIntakes(nextCursors[nextCursors.length - 1]);
      if (!alive.current || flight.current !== request || !current()) return;
      pageOwner.current = {}; setPage(next); setCursors(nextCursors);
    } catch {
      if (alive.current && flight.current === request && current()) setFailed(true);
    } finally {
      if (alive.current && flight.current === request) { flight.current = null; setBusy(false); }
    }
  };
  return <Section>
    {page.rows.map((item, i) => <ListRow key={item.id} title="Razgovor o zadatku" subtitle={`Započeto ${vreme(item.createdAt)}`}
      accessibilityLabel={`Razgovor o zadatku. Započeto ${vreme(item.createdAt)}`}
      last={i === page.rows.length - 1} onPress={() => { if (alive.current && pageOwner.current === pageToken) onSelect(item.id); }} />)}
    {!page.rows.length ? <T variant="note">Ovde više nema otvorenih razgovora.</T> : null}
    {failed ? <T variant="note" accessibilityRole="alert">Razgovori nisu učitani. Pokušaj ponovo istim dugmetom.</T> : null}
    {cursors.length > 1 ? <V2Action label="Noviji razgovori" kind="secondary" disabled={busy} onPress={() => { void move(cursors.slice(0, -1)); }} /> : null}
    {page.next ? <V2Action label="Stariji razgovori" kind="secondary" loading={busy} disabled={busy} onPress={() => { void move([...cursors, page.next]); }} /> : null}
  </Section>;
}
