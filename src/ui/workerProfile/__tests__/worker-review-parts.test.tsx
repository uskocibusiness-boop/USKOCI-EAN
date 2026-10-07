import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAiReview } from '../../../data/workerAiClientService';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'TextInput', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ReviewedWorkAreaMap' }));

import { WORKER_PROFILE_NOTIFICATIONS_NOTE, WorkerAiManual, WorkerAiNotificationsNote, WorkerAiProgress, WorkerAiReviewDetails } from '../WorkerAiPresentation';
import { TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY, capturedParts, toolsAndVehiclesNote, toolsAndVehiclesTag, type WorkerAiPart } from '../workerProfileFacts';
import { sys } from '../../system/tokens';

/**
 * T4b1 (2026-10-07), M2 and the progress of M1. The review is the profile in parts, each with "Izmeni" at its side; the
 * conversation shows what it has understood from the draft itself; the editors that "Izmeni" and "+" open send only their
 * own part. Nothing here is asked of the server: these are the presentations, with the draft handed in.
 */
const review = (patch: Partial<WorkerAiReview['profile']> = {}, availability: Partial<WorkerAiReview['profile']['availability']> = {}): WorkerAiReview => ({
  schemaVersion: 'WORKER_PROFILE_V1', reviewId: 'r', conversationId: 'c', accountId: 'a', profileId: 'p', revision: 1, activate: false,
  missingRequired: [], canAccept: true, expiresAt: '2026-09-24T12:00:00Z', displayedContentDigest: 'd'.repeat(64),
  profile: { displayName: 'Ana', bio: '', skills: ['Selidbe'], tools: [], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false,
      rules: [{ id: 'rule', weekdays: [1], startTime: '08:00', endTime: '16:00', startsOn: '2026-09-24', endsOn: null, label: '', active: true }],
      windows: [], ...availability },
    ...patch },
} as WorkerAiReview);
const full = review({ skills: ['Montaža nameštaja', 'Farbanje'], tools: ['Bušilica', 'Merdevine'], vehicles: ['Kombi'], bio: 'Radim vikendom.',
  location: { operatingCountryCode: 'RS', city: 'Novi Beograd', radiusKm: 15, approximatePosition: null } });

let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const press = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0];
const box = (label: string) => tree.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label)[0];
const groupIds = () => tree.root.findAll(node => typeof node.type === 'string' && /^worker-review-(skills|area|time|tools|identity)$/.test(String(node.props.testID)))
  .map(node => node.props.testID as string);
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the review in parts (M2)', () => {
  it('draws skills, area, time, tools and vehicles, then the name and "O meni", in that order', async () => {
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} />); });
    expect(groupIds()).toEqual(['worker-review-skills', 'worker-review-area', 'worker-review-time', 'worker-review-tools', 'worker-review-identity']);
    const copy = texts();
    expect(copy).toContain('Montaža nameštaja'); expect(copy).toContain('Farbanje');
    expect(copy).toContain('Novi Beograd · RS · do 15 km');
    expect(copy).toContain('Bušilica · Merdevine'); expect(copy).toContain('Kombi');
    expect(copy).toContain('Radim vikendom.'); expect(copy).toContain('Ana');
    for (const title of ['Veštine', 'Područje', 'Kada imaš vremena', 'Alat i vozilo', 'O meni']) expect(copy).toContain(title);
  });

  it('puts "Izmeni" at the side of every part, naming it, and opens exactly that part', async () => {
    const edit = jest.fn<void, [WorkerAiPart]>();
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} onEdit={edit} />); });
    const labels = ['Izmeni: Veštine', 'Izmeni: Područje', 'Izmeni: Kada imaš vremena', 'Izmeni: Alat i vozilo', 'Izmeni: O meni'];
    for (const label of labels) expect(press(label)).toBeTruthy();
    for (const label of labels) await act(async () => { press(label).props.onPress(); });
    expect(edit.mock.calls.map(call => call[0])).toEqual(['skills', 'area', 'time', 'tools', 'identity']);
    // A 44 dp target, spoken as a button.
    expect(press('Izmeni: Veštine').props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(press('Izmeni: Veštine').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('is only read when nothing can edit it (the gallery), and cannot be edited while disabled', async () => {
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} />); });
    expect(tree.root.findAll(node => String(node.type) === 'Press')).toHaveLength(0);
    const edit = jest.fn();
    await act(async () => tree.update(<WorkerAiReviewDetails review={full} onEdit={edit} editDisabled />));
    expect(press('Izmeni: Veštine').props.disabled).toBe(true);
    await act(async () => { press('Izmeni: Veštine').props.onPress(); });
    expect(edit).not.toHaveBeenCalled();
  });

  it('says what tools and vehicles do TODAY, and the owner-decided words stay one switch away', async () => {
    expect(TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY).toBe(false);
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} />); });
    const note = tree.root.findByProps({ testID: 'worker-tools-note' }).children.join('');
    expect(note).toBe('Ako zadatak traži alat ili vozilo koje nemaš na spisku, taj zadatak ti se ne nudi i ne možeš da se prijaviš na njega.');
    expect(texts()).not.toContain('samo informacija');
    // The switch: the owner's decision of 2026-10-07, drawn only when the server really treats the lists as information.
    expect(toolsAndVehiclesNote(true)).toBe('Samo informacija: ne utiču na pretragu ni na obaveštenja.');
    expect(toolsAndVehiclesTag(true)).toBe('samo informacija'); expect(toolsAndVehiclesTag(false)).toBeNull();
  });

  it('keeps the missing required fields on top and never invents a part that was not given', async () => {
    const missing = { ...review({ displayName: '', skills: [] }), missingRequired: ['Ime', 'Veštine'], canAccept: false } as WorkerAiReview;
    await act(async () => { tree = create(<WorkerAiReviewDetails review={missing} />); });
    const alert = tree.root.findAll(node => node.props.accessibilityRole === 'alert');
    expect(alert).toHaveLength(1); expect(alert[0].children.join('')).toBe('Dopuni: Ime, Veštine.');
    expect(texts()).not.toMatch(/undefined|null|NaN/);
    // The skills, the tools and vehicles, and the name: three parts with nothing in them, each said with the one word.
    expect(texts().split('Nije navedeno').length - 1).toBe(3);
  });

  it('the constant sentence with the bell says only what the profile is used for, in ink', async () => {
    await act(async () => { tree = create(<WorkerAiNotificationsNote />); });
    expect(WORKER_PROFILE_NOTIFICATIONS_NOTE).toBe('Podaci iz tvog radnog profila koriste se za obaveštenja o novim i već otvorenim zadacima koji odgovaraju tvojim veštinama, području i vremenu.');
    const note = tree.root.findByProps({ testID: 'worker-review-notifications-note' });
    expect(note.props.children).toBe(WORKER_PROFILE_NOTIFICATIONS_NOTE); expect(note.props.tone).toBeUndefined();
    expect(note.props.variant).not.toBe('meta');
  });
});

describe('what the conversation has understood (the progress of M1)', () => {
  const draft = (patch: Partial<WorkerAiReview['profile']> = {}) => review({ skills: [], location: { operatingCountryCode: null, city: '', radiusKm: 20, approximatePosition: null }, ...patch },
    { rules: [], windows: [] }).profile;

  it('is nothing but the draft: an empty draft is four grey bars, and nothing counts questions', async () => {
    await act(async () => { tree = create(<WorkerAiProgress profile={draft()} />); });
    const bar = tree.root.findByProps({ testID: 'worker-draft-progress' });
    expect(bar.props.accessibilityLabel).toBe('U nacrtu profila još nema ničega. Još nema: veštine, područje, vreme i alat.');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 0 });
    expect(texts()).toBe('Veštine | Područje | Vreme | Alat'); expect(texts()).not.toMatch(/od 5|Pitanje/);
  });

  it('colours exactly the parts the draft holds, and a place only with a country and a city', async () => {
    const some = draft({ skills: ['Selidbe'], tools: ['Bušilica'], location: { operatingCountryCode: null, city: 'Novi Sad', radiusKm: 20, approximatePosition: null } });
    await act(async () => { tree = create(<WorkerAiProgress profile={some} />); });
    const colour = (key: string) => StyleSheet.flatten(tree.root.findByProps({ testID: `worker-draft-progress-${key}` }).props.style).backgroundColor;
    expect(colour('skills')).toBe(sys.color.green); expect(colour('area')).toBe(sys.color.line);
    expect(colour('time')).toBe(sys.color.line); expect(colour('tools')).toBe(sys.color.green);
    expect(tree.root.findByProps({ testID: 'worker-draft-progress' }).props.accessibilityLabel).toBe('U nacrtu profila: veštine i alat. Još nema: područje i vreme.');
    const all = draft({ skills: ['Selidbe'], tools: ['Bušilica'], location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
      availability: { timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: [] } });
    await act(async () => tree.update(<WorkerAiProgress profile={all} />));
    const bar = tree.root.findByProps({ testID: 'worker-draft-progress' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 4 });
    expect(bar.props.accessibilityLabel).toBe('U nacrtu profila: veštine, područje, vreme i alat.');
  });

  it('counts a week or a special date as time, and "Mogu odmah" alone too', () => {
    const time = (patch: Partial<WorkerAiReview['profile']['availability']>) => capturedParts(review({}, { rules: [], windows: [], ...patch }).profile).find(part => part.key === 'time')!.done;
    expect(time({})).toBe(false); expect(time({ availableNow: true })).toBe(true);
    expect(time({ rules: [{ id: 'r', weekdays: [1], startTime: '08:00', endTime: '16:00', startsOn: '2026-09-24', endsOn: null, label: '', active: true }] })).toBe(true);
    expect(time({ windows: [{ id: 'w', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:30:00Z', state: 'AVAILABLE', label: '' }] })).toBe(true);
  });
});

describe('the focused editors of "Izmeni" and "+" send only their own part', () => {
  const profile = full.profile;
  const submit = async () => { await act(async () => { press('Primeni na pregled profila').props.onPress(); }); };
  const open = async (only: 'identity' | 'skills' | 'area' | 'tools') => {
    const apply = jest.fn();
    await act(async () => { tree = create(<WorkerAiManual profile={profile} disabled={false} apply={apply} only={only} />); });
    return apply;
  };

  it('skills: the list editor, a word left in the box is kept, and nothing else is written', async () => {
    const apply = await open('skills');
    expect(texts()).toContain('Montaža nameštaja');
    expect(tree.root.findAll(node => String(node.type) === 'TextInput').map(node => node.props.accessibilityLabel)).toEqual(['Nova stavka: Veštine i usluge']);
    await act(async () => { press('Ukloni: Farbanje').props.onPress(); });
    await act(async () => { box('Nova stavka: Veštine i usluge').props.onChangeText('Čišćenje'); });
    await submit();
    expect(apply).toHaveBeenCalledTimes(1); expect(apply.mock.calls[0][0]).toEqual({ skills: ['Montaža nameštaja', 'Čišćenje'] });
  });

  it('tools: tools and vehicles as two lists, and only those two fields', async () => {
    const apply = await open('tools');
    await act(async () => { box('Nova stavka: Vozila').props.onChangeText('Prikolica'); });
    await act(async () => { press('Dodaj stavku: Vozila').props.onPress(); });
    await submit();
    expect(apply.mock.calls[0][0]).toEqual({ tools: ['Bušilica', 'Merdevine'], vehicles: ['Kombi', 'Prikolica'] });
  });

  it('area: country, city and radius, the radius refused outside 1-200 km before anything is written', async () => {
    const apply = await open('area');
    await act(async () => { box('Radijus rada u km').props.onChangeText('500'); });
    await submit();
    expect(apply).not.toHaveBeenCalled(); expect(texts()).toContain('Proveri državu i radijus 1–200 km.');
    await act(async () => { box('Radijus rada u km').props.onChangeText('25'); });
    await act(async () => { box('Grad ili mesto rada').props.onChangeText('Zemun'); });
    await submit();
    expect(apply.mock.calls[0][0]).toEqual({ location: { city: 'Zemun', operatingCountryCode: 'RS', radiusKm: 25 } });
  });

  it('identity: the name and "O meni", with the length limit of the review', async () => {
    const apply = await open('identity');
    await act(async () => { box('O meni').props.onChangeText('x'.repeat(4001)); });
    await submit(); expect(apply).not.toHaveBeenCalled(); expect(texts()).toContain('O meni može imati do 4.000 znakova.');
    await act(async () => { box('O meni').props.onChangeText('Radim brzo.'); });
    await act(async () => { box('Ime na profilu').props.onChangeText('Ana P.'); });
    await submit(); expect(apply.mock.calls[0][0]).toEqual({ displayName: 'Ana P.', bio: 'Radim brzo.' });
  });

  it('reports a word still in a list box as an unsaved change, so Back asks before dropping it', async () => {
    const changes: boolean[] = [];
    await act(async () => { tree = create(<WorkerAiManual profile={profile} disabled={false} apply={jest.fn()} only="skills"
      onDraftChange={(_value, dirty) => changes.push(dirty)} />); });
    expect(changes.at(-1)).toBe(false);
    await act(async () => { box('Nova stavka: Veštine i usluge').props.onChangeText('Čišćenje'); });
    expect(changes.at(-1)).toBe(true);
  });

  it('the whole form keeps writing the whole proposal, as before, and its primary is the one green action', async () => {
    const apply = jest.fn();
    await act(async () => { tree = create(<WorkerAiManual profile={profile} disabled={false} apply={apply} />); });
    await submit();
    expect(Object.keys(apply.mock.calls[0][0]).sort()).toEqual(['bio', 'displayName', 'location', 'skills', 'tools', 'vehicles']);
  });
});
