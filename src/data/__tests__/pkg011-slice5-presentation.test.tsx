import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerDraft } from '../../ui/workerProfile/workerProfileDraft';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { WorkerProfileFooter, WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus } from '../../ui/workerProfile/WorkerProfilePresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const inputs = () => tree.root.findAllByType('TextInput' as React.ElementType).map(node => node.props.accessibilityLabel);
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const draft = (patch: Partial<WorkerDraft> = {}): WorkerDraft => ({ ime: 'Marko Marić', capacity: '2', capacityRevision: 3, vestine: ['Selidbe', 'Montaža'], newSkill: '', alati: ['Kolica'], newTool: '',
  vozila: [], newVehicle: '', licence: [], newLicense: '', grad: 'Novi Sad', radius: '25', biografija: '', dostupanOdmah: false, ...patch } as WorkerDraft);
const change = jest.fn(), navigate = jest.fn(), openConversation = jest.fn();
beforeEach(() => { change.mockClear(); navigate.mockClear(); openConversation.mockClear(); });
function Screen({ value, status = 'DRAFT', disabled = false }: { value: WorkerDraft; status?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null; disabled?: boolean }) {
  return <WorkerProfileFrame back={() => {}}><WorkerProfileForm draft={value} change={change} disabled={disabled} status={status} navigate={navigate} openConversation={openConversation} /></WorkerProfileFrame>;
}
test('the personal profile leads to AI setup and shows saved facts with one manual correction section at a time', async () => {
  await act(async () => { tree = create(<Screen value={draft()} />); });
  const copy = texts();
  expect(copy).toContain('Radni profil'); expect(copy).not.toMatch(/Ja mogu|Meni treba/);
  expect(tree.root.findAll(node => node.props && 'initials' in node.props)).toHaveLength(0);
  expect(copy).toContain('Marko Marić');
  expect(copy).toContain('Radni profil je još nacrt'); expect(copy).toContain('zadaci ti se ne nude'); expect(copy).toContain('Selidbe'); expect(copy).toContain('Montaža');
  expect(inputs()).toEqual([]);
  expect(labels()).not.toContain('Brzi izbor alata');
  await act(async () => byLabel('Uredi profil kroz razgovor').props.onPress()); expect(openConversation).toHaveBeenCalledTimes(1);
  await act(async () => byLabel('Izmeni: O meni').props.onPress());
  // ONE NAME (owner, 8 Oct 2026): there is no field for the name here; it is the name of the account, said as the title.
  expect(inputs()).toEqual(['O meni']);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ime na radnom profilu' })).toHaveLength(0);
  await act(async () => byLabel('Izmeni: Alat i oprema').props.onPress());
  expect(inputs()).toEqual(['Nova stavka: Alat i oprema']);
  expect(labels()).toContain('Ukloni alat i oprema: Kolica');
  await act(async () => byLabel('Izmeni: Veštine i usluge').props.onPress());
  expect(inputs()).toEqual(['Nova stavka: Veštine i usluge']);
  await act(async () => byLabel('Ukloni veštine i usluge: Selidbe').props.onPress()); expect(change).toHaveBeenCalledWith(expect.objectContaining({ vestine: ['Montaža'] }));
  await act(async () => byLabel('Dostupnost').props.onPress()); expect(navigate).toHaveBeenCalledWith('/profil/dostupnost');
});
test('status follows the server state and availability is a read-only summary, never a switch', async () => {
  await act(async () => { tree = create(<Screen value={draft({ dostupanOdmah: true })} status="ACTIVE" />); });
  expect(texts()).toContain('Profil je aktivan'); expect(texts()).toContain('Mogu odmah'); expect(texts()).not.toContain('Mogu odmah · dostupnost');
  expect(tree.root.findAllByType('Switch' as React.ElementType)).toHaveLength(0);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={draft()} status="SUSPENDED" />); });
  expect(texts()).toContain('Profil je trenutno suspendovan');
  await act(async () => byLabel('Obrati se podršci').props.onPress()); expect(navigate).toHaveBeenCalledWith('/podrska');
});
test('status block: loading is spoken, an error keeps the one reload action', async () => {
  const retry = jest.fn();
  await act(async () => { tree = create(<WorkerProfileFrame back={() => {}}><WorkerProfileStatus loading error={null} retry={retry} /></WorkerProfileFrame>); });
  expect(texts()).toContain('Učitavamo radni profil…');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<WorkerProfileFrame back={() => {}}><WorkerProfileStatus loading={false} error="Profil nije učitan." retry={retry} /></WorkerProfileFrame>); });
  expect(texts()).toContain('Profil nije učitan.'); await act(async () => byLabel('Ponovo učitaj profil').props.onPress()); expect(retry).toHaveBeenCalledTimes(1);
});
// Review of step 9 (2026-09-24): on a 320 × 640 phone the sticky footer rose with the keyboard and left under 100 dp for the
// field being typed. It steps aside while the keyboard is up, stays mounted (a button keeps its state), and comes back.
test('the sticky footer steps aside while the keyboard is up and comes back when it closes', async () => {
  const { Keyboard, StyleSheet } = jest.requireActual('react-native');
  const events: Record<string, () => void> = {}, remove = jest.fn();
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, callback: () => void) => {
    events[name] = callback; return { remove }; }) as never);
  try {
    await act(async () => { tree = create(<WorkerProfileFrame back={() => {}} footer={React.createElement('T', null, 'Sačuvaj izmene')}>
      <WorkerProfileForm draft={draft()} change={change} disabled={false} status="ACTIVE" navigate={navigate} /></WorkerProfileFrame>); });
    const footer = () => tree.root.findByProps({ testID: 'worker-profile-footer' });
    const aside = () => StyleSheet.flatten(footer().props.style).display === 'none';
    const event = (suffix: RegExp) => events[Object.keys(events).find(name => suffix.test(name))!];
    expect(aside()).toBe(false); expect(footer().props.importantForAccessibility).toBe('auto');
    await act(async () => event(/Show$/)());
    expect(aside()).toBe(true); expect(footer().props.accessibilityElementsHidden).toBe(true);
    expect(footer().props.importantForAccessibility).toBe('no-hide-descendants'); expect(texts()).toContain('Sačuvaj izmene');
    await act(async () => event(/Hide$/)());
    expect(aside()).toBe(false); expect(footer().props.accessibilityElementsHidden).toBe(false);
    await act(async () => tree.unmount());
    expect(remove).toHaveBeenCalledTimes(2);
    tree = undefined as unknown as ReactTestRenderer;
  } finally { spy.mockRestore(); }
});
// Round 5c: a row tapped while typing refuses into the footer ("Sačuvaj unos pre…"), and "Dopuni osnovne podatke" writes its
// instruction there and then focuses a field. Hiding the whole footer made the tap look dead and hid the instruction, so a
// WorkerProfileFooter keeps its answer on screen while typing and steps aside only with its actions and the held line.
test('while the keyboard is up the footer keeps its answer visible and hides only its actions', async () => {
  const { Keyboard, StyleSheet } = jest.requireActual('react-native');
  const events: Record<string, () => void> = {};
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, callback: () => void) => {
    events[name] = callback; return { remove: jest.fn() }; }) as never);
  const hidden = (node: { props: Record<string, unknown>; parent: unknown }) => {
    for (let at: any = node; at; at = at.parent) {
      if (at.props && (StyleSheet.flatten(at.props.style)?.display === 'none' || at.props.accessibilityElementsHidden === true)) return true;
    }
    return false;
  };
  const sentence = 'Sačuvaj unos pre otvaranja drugog podešavanja.';
  const screen = (error: string | null) => <WorkerProfileFrame back={() => {}} footer={<WorkerProfileFooter error={error} held>
    {React.createElement('T', null, 'Sačuvaj izmene')}</WorkerProfileFooter>}>
    <WorkerProfileForm draft={draft()} change={change} disabled={false} status="ACTIVE" navigate={navigate} /></WorkerProfileFrame>;
  const node = (text: string) => tree.root.findAll(n => String(n.type) === 'T' && n.children.includes(text))[0];
  try {
    await act(async () => { tree = create(screen(null)); });
    const event = (suffix: RegExp) => events[Object.keys(events).find(name => suffix.test(name))!];
    await act(async () => event(/Show$/)());
    // Typing with nothing to say: no answer, no strip on the keyboard, the actions stay mounted but hidden.
    expect(tree.root.findAllByProps({ testID: 'worker-profile-answer' })).toHaveLength(0);
    const footer = tree.root.findByProps({ testID: 'worker-profile-footer' });
    expect(StyleSheet.flatten(footer.props.style).paddingVertical).toBe(0);
    expect(hidden(node('Sačuvaj izmene'))).toBe(true); expect(hidden(node('Tvoj tekst nije izgubljen. Ispod je prikazano samo ono što je sačuvano.'))).toBe(true);
    // A tap refuses while the keyboard stays up: its sentence is on screen and announced, the buttons still step aside.
    await act(async () => tree.update(screen(sentence)));
    expect(hidden(node(sentence))).toBe(false); expect(node(sentence).props.accessibilityRole).toBe('alert');
    expect(hidden(node('Sačuvaj izmene'))).toBe(true);
    await act(async () => event(/Hide$/)());
    expect(hidden(node(sentence))).toBe(false); expect(hidden(node('Sačuvaj izmene'))).toBe(false);
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'worker-profile-footer' }).props.style).paddingVertical).toBe(12);
  } finally { spy.mockRestore(); }
});
test('the body closes the keyboard on a drag, so the footer can come back without a return key', async () => {
  await act(async () => { tree = create(<Screen value={draft()} />); });
  expect(['on-drag', 'interactive']).toContain(tree.root.findByType('ScrollView' as React.ElementType).props.keyboardDismissMode);
});
test('unknown or absent profile state does not expose retired licenses or a capacity prerequisite', async () => {
  await act(async () => { tree = create(<WorkerProfileFrame back={() => {}}><WorkerProfileForm draft={draft({ capacityRevision: null, licence: ['B, C'] })} change={change}
    disabled={false} status={null} navigate={navigate} profileExists /></WorkerProfileFrame>); });
  expect(texts()).not.toMatch(/Kapacitet profila|Licence|B, C|Sačuvaj profil da bi se broj ljudi potvrdio/);
  expect(inputs()).toEqual([]);
  await act(async () => tree.update(<WorkerProfileFrame back={() => {}}><WorkerProfileForm draft={draft({ capacityRevision: null })} change={change}
    disabled={false} status={null} navigate={navigate} /></WorkerProfileFrame>));
  expect(texts()).not.toMatch(/Kapacitet profila|Sačuvaj profil da bi se broj ljudi potvrdio/);
  // The people count and the equipment note are behind the "ⓘ" in the bar, not on the screen.
  expect(texts()).not.toContain('njihov broj navodiš u toj ponudi');
});
