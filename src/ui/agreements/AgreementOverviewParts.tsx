import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { vreme } from '../../lib/vreme';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { Screen } from '../system/Screen';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { field, sys } from '../system/tokens';
import { ProductHeader } from '../product/ProductDetails';
import { V2Action } from '../v2/V2Action';
import { AgreementSection } from '../v2/AgreementPresentation';
import { NextStepCard, type AgreementStep } from './AgreementWorkspace';
import { AgreementSteps } from './AgreementSteps';

/**
 * The pieces of a Dogovor's overview that the route and its gallery draw the same way (composition spec 4.9, template T3): the head with
 * the work's name and where the Dogovor stands, the note for a Dogovor without a term (R02), the rows that lead elsewhere, a reported
 * problem and the three ways on after it (R04). Presentation only: every press is the route's own command, behind its own guards, and
 * nothing here reads or writes anything.
 */

/**
 * The scroll of the overview, in the grid of every screen: 20 from the edge, 8 under the bar, 24 between one part and the next, and 24
 * under the last one before the foot. (`Screen` is the frame of every static screen; the Dogovor needs the scroll's own handle, to take a
 * person to the section a menu entry names, so it keeps the same measures here until `Screen` hands its scroll out.)
 */
export const overviewContent = { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.section, gap: layout.section } as const;

/**
 * The head: the work's own name large (what this Dogovor is about, first), then where it stands - the dot, the state, the next step - and
 * the four steps of its way. When the next step waits for me, it is one tinted note and what it is about (a proposal's lines) stands in it.
 * `steps` is the step bar's own props, so the same state is read in one place (`agreementStepModel`).
 */
export function AgreementHead({ title, step, steps, children }: {
  /** The work's title, readable ("Prenos ormana do kombija"). */
  title: string; step: AgreementStep; steps: ComponentProps<typeof AgreementSteps>;
  /** What a waiting step is about: the lines of a proposal, the way to read permissions again. Inside the step. */
  children?: ReactNode;
}) {
  return <View style={s.head}>
    <T accessibilityRole="header" variant="pageTitle" style={s.title}>{title}</T>
    <NextStepCard tone={step.tone} title={step.title} body={step.body}>{children}</NextStepCard>
    <AgreementSteps {...steps} />
  </View>;
}

/**
 * A Dogovor with no term yet (idea R02): the one thing the two of them still have to do, said where the person reads what comes next.
 * One tinted sentence, never a card of its own, and "Predloži termin" at its end in the system's green words: the way to the existing
 * change of the terms, opened on the term. It stands until a proposal for the term is accepted.
 */
export function AgreementTermNote({ onPropose, disabled = false }: { onPropose: () => void; disabled?: boolean }) {
  return <Surface kind="note" tone="warn" testID="agreement-term-note" style={s.termNote}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.title}>Termin još nije dogovoren</T>
    <T variant="copy" tone="muted">Dogovorite tačno vreme u Porukama, pa ga upišite.</T>
    <Press accessibilityRole="button" accessibilityLabel="Predloži termin" accessibilityState={{ disabled }} disabled={disabled} haptic="select"
      onPress={onPropose} style={s.termAction}>
      <T variant="copy" tone="green" style={s.actionWord}>Predloži termin</T>
    </Press>
  </Surface>;
}

/** What one row of the links is: its press, and whether the screen is working (then it is grey and cannot be pressed). */
type LinkRow = { onPress: () => void; disabled?: boolean };

/**
 * The few things that lead elsewhere from a Dogovor, as ONE group of the one row: the source task, my application (the worker's), the
 * change and cancelling of the terms, a problem, safety, and the Dogovor's history. A row that leads somewhere has the arrow; the ones
 * needed once in a long while are quiet. Each row's spoken label is the one it always had.
 */
export function AgreementLinks({ task, application, change, problem, safety, history }: {
  /** "Otvori zadatak": only when the source task is known and the person may open it. The row says the title of the work and its coarse area (never the private address) to a screen reader only: the page already shows both. */
  task?: LinkRow & { title: string; place: string };
  /** "Tvoja prijava": the worker's own application. */
  application?: LinkRow;
  /** "Izmene i otkazivanje": what can still be changed. */
  change?: LinkRow;
  /** "Prijavi problem": opens the form. */
  problem?: LinkRow;
  /** "Bezbednost i prijava": blocking and the private report to support. */
  safety?: LinkRow;
  /** "Tok Dogovora": the saved events. */
  history?: readonly { vremeTekst: string; tekst: string }[];
}) {
  const rows: ((last: boolean) => ReactNode)[] = [];
  if (task) rows.push(last => <ListRow key="task" leading={<FactArt kind="tasks" size={32} />} title="Otvori zadatak" last={last}
    accessibilityLabel={`Otvori zadatak: ${task.title}. ${task.place}`} accessibilityHint="Otvara detalje zadatka iz kog je nastao ovaj Dogovor."
    disabled={task.disabled} onPress={task.onPress} />);
  if (application) rows.push(last => <ListRow key="application" leading={<FactArt kind="offers" size={32} />} title="Tvoja prijava" last={last}
    accessibilityLabel="Tvoja prijava" disabled={application.disabled} onPress={application.onPress} />);
  if (change) rows.push(last => <ListRow key="change" leading={<FactArt kind="document" size={32} />} tone="quiet" title="Izmene i otkazivanje" last={last}
    subtitle="Cena, obim, termin ili otkazivanje uz razlog" accessibilityLabel="Izmene i otkazivanje Dogovora"
    accessibilityHint="Cena, obim, termin ili otkazivanje uz razlog" disabled={change.disabled} onPress={change.onPress} />);
  if (problem) rows.push(last => <ListRow key="problem" leading={<FactArt kind="alert" size={32} />} tone="quiet" title="Prijavi problem" last={last}
    subtitle="Zaustavlja automatski završetak, a druga strana vidi prijavu" accessibilityLabel="Prijavi problem" disabled={problem.disabled} onPress={problem.onPress} />);
  if (safety) rows.push(last => <ListRow key="safety" leading={<FactArt kind="shield" size={32} />} tone="quiet" title="Bezbednost i prijava" last={last}
    subtitle="Blokiranje i poverljiva prijava podršci" accessibilityLabel="Bezbednost i privatna prijava"
    accessibilityHint="Blokiranje i poverljiva prijava podršci" disabled={safety.disabled} onPress={safety.onPress} />);
  const events = history?.length ? history : null;
  if (!rows.length && !events) return null;
  return <View>
    {rows.map((row, index) => row(!events && index === rows.length - 1))}
    {events ? <AgreementSection art="clock" label="Tok Dogovora" summary="Događaji u Dogovoru">
      {events.map((event, index) => <View key={index} style={s.event}>
        <View style={s.eventLine} /><View style={s.eventCopy}><T variant="body">{event.tekst}</T><T variant="meta" tone="muted">{event.vremeTekst}</T></View>
      </View>)}
    </AgreementSection> : null}
  </View>;
}

/** The sentence under a reported problem while the Dogovor is still open: the automatic completion stops, the confirmation does not. */
const STOPPED = 'Automatski završetak je zaustavljen. Završetak se i dalje može potvrditi. Prijavljeni problem sam po sebi ne određuje krivicu ili dug.';

/**
 * A problem that was reported, as the one tinted note it is (a problem is what waits for both): who reported it and when, the words that
 * were written - both sides read them, and they are kept in Poruke - and, while the Dogovor is open, that the automatic completion has
 * stopped. `keptFirst`: this screen holds a second description that was NOT added (only the first one is stored).
 */
export function AgreementProblemNote({ mine, openedAt, narrative, active, keptFirst = false }: {
  mine: boolean; openedAt: string; narrative: string;
  /** The Dogovor is agreed or waiting for its confirmation. */
  active: boolean; keptFirst?: boolean;
}) {
  return <Surface kind="note" tone="warn" testID="agreement-problem-note" style={s.problem}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.title}>{mine ? 'Problem je prijavljen sa tvog naloga.' : 'Problem je prijavila druga strana.'}</T>
    <T variant="note" tone="muted">{vreme(openedAt)}</T>
    <T variant="body" style={s.title}>{narrative}</T>
    <T variant="note" tone="muted">Ovaj opis vide oba učesnika i sačuvan je u Porukama.</T>
    {keptFirst ? <T variant="note" tone="muted">Sačuvan je prvi opis problema. Tvoj novi opis nije dodat. Za dopunu koristi Poruke.</T> : null}
    {active ? <T variant="note" tone="muted">{STOPPED}</T> : null}
  </Surface>;
}

/**
 * A problem is open but its details could not be shown: an older report that this view cannot read (`legacy`: nothing to do about it), or
 * a read that did not answer (then `onRefresh` reads it again). The problem itself is certain either way: the Dogovor says it is open.
 */
export function AgreementProblemUnknown({ legacy, active, onRefresh, disabled = false }: {
  legacy: boolean; active: boolean; onRefresh?: () => void; disabled?: boolean;
}) {
  return <Surface kind="note" tone="warn" testID="agreement-problem-note" style={s.problem}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.title}>Problem je prijavljen</T>
    <T variant="note" tone="muted">{legacy
      ? 'Detalji ranije prijavljenog problema nisu dostupni. Problem ostaje sačuvan.'
      : 'Detalji prijave trenutno nisu učitani. Osveži status Dogovora da pokušaš ponovo.'}</T>
    {active ? <T variant="note" tone="muted">{STOPPED}</T> : null}
    {onRefresh ? <V2Action label="Osveži detalje prijave" kind="quiet" disabled={disabled} onPress={onRefresh} /> : null}
  </Surface>;
}

/**
 * The form to report a problem in this Dogovor, in place of the row that opened it (it is the last thing on the page, where the person
 * pressed). What is written is seen by the other side in Poruke - this is not the private report to support - and once an attempt was
 * made the text is kept as it was (`kept`): only an explicit refresh may let a second one go, never a silent retry with other words.
 */
export function AgreementProblemForm({ value, onChange, editable, kept, busy, canSend, onSend, onCancel, disabled = false }: {
  value: string; onChange: (value: string) => void; editable: boolean;
  /** An attempt was made: the description stays as it was and cannot be changed or called off. */
  kept: boolean; busy: boolean; canSend: boolean; onSend: () => void; onCancel: () => void; disabled?: boolean;
}) {
  return <Section title="Problem u Dogovoru">
    <View style={s.form}>
      <T variant="note" tone="muted">Opis će videti druga strana u Porukama. Ovo nije poverljiva prijava podršci.</T>
      <TextInput accessibilityLabel="Opiši problem" value={value} onChangeText={onChange} multiline maxLength={4000} editable={editable}
        placeholder="Šta je ostalo nerešeno?" placeholderTextColor={sys.color.muted} style={s.input} />
      <V2Action label={busy ? 'Čuvamo prijavu…' : kept ? 'Pošalji ponovo' : 'Pošalji prijavu problema'} disabled={!canSend} onPress={onSend} />
      {!kept ? <V2Action label="Odustani od prijave problema" kind="quiet" disabled={disabled} onPress={onCancel} />
        : <T variant="note" tone="muted">Opis je sačuvan na ovom ekranu. Osveži Dogovor pa ga pošalji ponovo.</T>}
    </View>
  </Section>;
}

/**
 * The three ways on after a problem was reported (idea R04), so that a report is never a dead end: agree in Poruke; cancel the Dogovor
 * (with a reason, and then look for people again); or report that the other side did not come, which opens support with this Dogovor
 * already chosen. Rows of the one list under their own title; the cancelling is the one that cannot be taken back, so its words are red.
 */
export function AgreementProblemExits({ onMessages, onCancel, onNoShow, disabled = false }: {
  onMessages: () => void; onCancel?: () => void; onNoShow: () => void; disabled?: boolean;
}) {
  return <Section title="Šta dalje">
    <View>
      <ListRow leading={<FactArt kind="chat" size={32} />} title="Dogovorite se u Porukama" subtitle="Napišite šta je ostalo nerešeno." onPress={onMessages} disabled={disabled}
        accessibilityLabel="Dogovorite se u Porukama" last={false} />
      {/* Red words are a command, but this one opens the cancelling with its reason, so it keeps the arrow of a way onward. */}
      {onCancel ? <ListRow leading={<FactArt kind="tasks" size={32} />} tone="danger" arrow title="Otkaži Dogovor" subtitle="Uz razlog. Posle toga možeš ponovo da tražiš ljude."
        onPress={onCancel} disabled={disabled} accessibilityLabel="Otkaži Dogovor" /> : null}
      <ListRow leading={<FactArt kind="shield" size={32} />} title="Prijavi nedolazak" subtitle="Otvara podršku sa ovim Dogovorom." onPress={onNoShow}
        disabled={disabled} accessibilityLabel="Prijavi nedolazak" last />
    </View>
  </Section>;
}

/**
 * The Dogovor while it is being read, or when it could not be: the system's one state view in the frame of every opened screen
 * (template T7). Loading is the breathing shape of what is coming and one quiet sentence; a failed read says what happened and has the one
 * way forward; a Dogovor the person has no access to has nothing to retry, so its way forward is back to the list.
 */
export function AgreementStatusView({ loading = false, error = false, retry, back }: { loading?: boolean; error?: boolean; retry?: () => void; back: () => void }) {
  return <Screen kind="detail" header={<ProductHeader title="Dogovor" back={back} />}>
    {loading ? <StateView kind="loading" title="Učitavamo Dogovor…" skeleton={{ count: 2, rows: 3 }} />
      : error ? <StateView kind="error" art="document" title="Dogovor nije učitan" body="Proveri internet vezu i pokušaj ponovo."
        primary={retry ? { label: 'Ponovo učitaj Dogovor', onPress: retry } : undefined} />
        : <StateView kind="error" art="document" title="Dogovor nije dostupan" body="Veza je zastarela ili nemaš pristup ovom Dogovoru."
          primary={{ label: 'Nazad na Dogovore', onPress: back }} />}
  </Screen>;
}

const s = StyleSheet.create({
  head: { gap: sys.space.sm },
  title: { color: sys.color.ink },
  termNote: { gap: sys.space.xs },
  termAction: { minHeight: layout.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  actionWord: { fontWeight: '600' },
  problem: { gap: sys.space.sm },
  form: { gap: sys.space.md },
  input: { ...field, minHeight: 100, textAlignVertical: 'top' },
  event: { flexDirection: 'row', gap: sys.space.md },
  eventLine: { width: 2, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, marginVertical: sys.space.xs },
  eventCopy: { flex: 1, gap: sys.space.xs },
});
