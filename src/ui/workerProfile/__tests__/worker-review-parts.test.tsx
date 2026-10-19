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

import { WORKER_PROFILE_NOTIFICATIONS_NOTE, WORKER_PROFILE_PENDING_NOTIFICATIONS_NOTE, WorkerAiCard, WorkerAiModeConfirmation, WorkerAiNotificationsNote, WorkerAiReviewDetails } from '../WorkerAiPresentation';
import { TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY, capturedParts, toolsAndVehiclesNote } from '../workerProfileFacts';

/**
 * The review shows signed service modes and the facts understood from the draft. Ordinary edits return to the AI
 * conversation. These presentation tests receive a draft directly and never ask the server to change it.
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
const groupIds = () => tree.root.findAll(node => typeof node.type === 'string' && /^worker-review-(skills|area|time|tools|identity)$/.test(String(node.props.testID)))
  .map(node => node.props.testID as string);
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the review in parts (M2)', () => {
  it('keeps each service beside its own signed mode and retains the AI correction action', async () => {
    const edit=jest.fn();
    const signed:WorkerAiReview={...review({skills:['Montaža nameštaja','3D štampa']}),classificationState:'READY',
      reviewedServiceModes:[{service:'Montaža nameštaja',mode:'ON_SITE'},{service:'3D štampa',mode:'REMOTE'}]};
    await act(async()=>{tree=create(<WorkerAiReviewDetails review={signed} onEdit={edit}/>);});
    const rows=tree.root.findAllByProps({testID:'worker-review-service'}).map(row=>row.findAll(node=>String(node.type)==='T').map(node=>node.props.children));
    expect(rows).toEqual([['Montaža nameštaja','Na lokaciji'],['3D štampa','Na daljinu']]);
    await act(async()=>press('Izmeni kroz razgovor').props.onPress());
    expect(edit).toHaveBeenCalledWith();
    await act(async()=>tree.update(<WorkerAiReviewDetails review={{...signed,classificationState:'SERVICE_MODE_CONFIRMATION_REQUIRED',reviewedServiceModes:[]}} onEdit={edit}/>));
    expect(tree.root.findByProps({testID:'worker-classification-pending'}).props.children).toContain('automatsko povezivanje čeka');
    const pending=tree.root.findAllByProps({testID:'worker-review-service'}).map(row=>row.findAll(node=>String(node.type)==='T').map(node=>node.props.children));
    expect(pending).toEqual([['Montaža nameštaja'],['3D štampa']]);
  });

  it('shows all supplied profile facts without duplicating the account identity', async () => {
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} />); });
    expect(groupIds()).toEqual(expect.arrayContaining(['worker-review-skills', 'worker-review-area', 'worker-review-time', 'worker-review-tools', 'worker-review-identity']));
    const copy = texts();
    expect(copy).toContain('Montaža nameštaja'); expect(copy).toContain('Farbanje');
    expect(copy).toContain('Novi Beograd · RS · grad profila');
    expect(copy).not.toContain('15 km');
    expect(copy).toContain('Bušilica · Merdevine'); expect(copy).toContain('Kombi');
    expect(copy).toContain('Radim vikendom.'); expect(copy).not.toContain('Ana'); expect(copy.split(' | ')).not.toContain('Ime');
    for (const title of ['Usluge koje nudiš', 'Područje', 'Kada imaš vremena', 'Alat i vozilo', 'O meni']) expect(copy).toContain(title);
  });

  it('shows the proposed catalog place and keeps remote work independent of the profile city', async () => {
    const signed:WorkerAiReview={...review({skills:['Izrada 3D figurica']}),
      classificationState:'READY',classificationCatalogVersion:9,
      classificationCatalogFingerprint:'a'.repeat(32),
      reviewedServiceModes:[{service:'Izrada 3D figurica',mode:'REMOTE'}],
      classificationCandidates:[{action:'CREATE_CHILD',service:'Izrada 3D figurica',mode:'REMOTE',
        parentId:'11111111-1111-4111-8111-111111111111',parentLabel:'Digitalne usluge',
        path:['3D izrada','Izrada 3D figurica'],catalogVersion:9,
        reason:'Verified owner-reviewed category proposal'}]};
    await act(async()=>{tree=create(<WorkerAiReviewDetails review={signed}/>);});
    expect(texts()).toContain('Izrada 3D figurica');
    expect(texts()).not.toContain('Predlog za katalog');
    expect(texts()).toContain('Novi Sad · RS · grad profila');
    expect(texts()).toContain('Rad na daljinu nije vezan za grad profila.');
    expect(texts()).not.toContain('Novi Sad · RS · do 20 km');
    expect(tree.root.findAll(node=>String(node.type)==='ReviewedWorkAreaMap')).toHaveLength(0);
  });

  it('offers one accessible AI correction action for the whole review', async () => {
    const edit = jest.fn();
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} onEdit={edit} />); });
    const actions=tree.root.findAll(node=>String(node.type)==='Press');
    expect(actions).toHaveLength(1);
    const correction=press('Izmeni kroz razgovor');
    await act(async()=>correction.props.onPress());
    expect(edit).toHaveBeenCalledTimes(1); expect(edit).toHaveBeenCalledWith();
    expect(correction.props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(correction.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('is only read when nothing can edit it (the gallery), and cannot be edited while disabled', async () => {
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} />); });
    expect(tree.root.findAll(node => String(node.type) === 'Press')).toHaveLength(0);
    const edit = jest.fn();
    await act(async () => tree.update(<WorkerAiReviewDetails review={full} onEdit={edit} editDisabled />));
    expect(press('Izmeni kroz razgovor').props.disabled).toBe(true);
    await act(async () => { press('Izmeni kroz razgovor').props.onPress(); });
    expect(edit).not.toHaveBeenCalled();
  });

  it('says tools and vehicles are information only now that MATCH-V1 is applied, and the old words stay one switch away', async () => {
    expect(TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY).toBe(true);
    await act(async () => { tree = create(<WorkerAiReviewDetails review={full} />); });
    const note = tree.root.findByProps({ testID: 'worker-tools-note' }).children.join('');
    expect(note).toBe('Samo informacija: ne utiču na pretragu ni na obaveštenja.');
    // One sentence says it, once: no chip "samo informacija" explains nothing next to the title (owner's phone, 8 Oct 2026).
    expect(texts()).not.toContain('samo informacija');
    // The switch: the words are the owner's decision of 2026-10-07, drawn only while the server really treats the lists as information (a server without MATCH-V1 needs the old ones).
    expect(toolsAndVehiclesNote(true)).toBe('Samo informacija: ne utiču na pretragu ni na obaveštenja.');
    expect(toolsAndVehiclesNote(false)).toBe('Ako zadatak traži alat ili vozilo koje nemaš na spisku, taj zadatak ti se ne nudi i ne možeš da se prijaviš na njega.');
  });

  it('keeps the missing required fields on top and never invents a part that was not given', async () => {
    const missing = { ...review({ displayName: '', skills: [] }), missingRequired: ['Ime', 'Veštine'], canAccept: false } as WorkerAiReview;
    await act(async () => { tree = create(<WorkerAiReviewDetails review={missing} />); });
    const alert = tree.root.findAll(node => node.props.accessibilityRole === 'alert');
    // The server names the missing name "Ime"; it is the ACCOUNT's name now, which is what the person is told to add.
    expect(alert).toHaveLength(1); expect(alert[0].children.join('')).toBe('Dopuni: Ime naloga, Veštine.');
    expect(texts()).not.toMatch(/undefined|null|NaN/);
    // The skills, the tools and vehicles, and "O meni": three parts with nothing in them, each said with the one word.
    expect(texts().split('Nije navedeno').length - 1).toBe(2);
    expect(groupIds()).not.toContain('worker-review-tools');
  });

  it('the constant sentence with the bell says only what the profile is used for, in ink', async () => {
    await act(async () => { tree = create(<WorkerAiNotificationsNote />); });
    expect(WORKER_PROFILE_NOTIFICATIONS_NOTE).toBe('Zadatke povezujemo sa potvrđenim uslugama, načinom rada, područjem i vremenom. Obaveštenja su tvoj izbor.');
    const note = tree.root.findByProps({ testID: 'worker-review-notifications-note' });
    expect(note.props.children).toBe(WORKER_PROFILE_NOTIFICATIONS_NOTE); expect(note.props.tone).toBeUndefined();
    expect(note.props.variant).not.toBe('meta');
  });

  it('does not promise matching notifications when signed worker classification is pending', async () => {
    await act(async () => { tree = create(<WorkerAiNotificationsNote matchingReady={false} />); });
    const note = tree.root.findByProps({ testID: 'worker-review-notifications-note' });
    expect(note.props.children).toBe(WORKER_PROFILE_PENDING_NOTIFICATIONS_NOTE);
    expect(note.props.children).toMatch(/neće stizati dok kategorija i način rada/);
    expect(note.props.children).not.toBe(WORKER_PROFILE_NOTIFICATIONS_NOTE);
  });
});

describe('the conversation draft is not matching readiness', () => {
  const draft = (patch: Partial<WorkerAiReview['profile']> = {}) => review({ skills: [], location: { operatingCountryCode: null, city: '', radiusKm: 20, approximatePosition: null }, ...patch },
    { rules: [], windows: [] }).profile;

  it.each([
    ['empty', draft()],
    ['services and city only', draft({ skills: ['3D štampa'], location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null } })],
  ] as const)('%s: offers review without inferring completion from candidate fields', async (_name, profile) => {
    const openReview = jest.fn();
    await act(async () => { tree = create(<WorkerAiCard profile={profile} compact={false} disabled={false} review={openReview} />); });
    expect(texts()).toContain('Nacrt radnog profila');
    expect(texts()).toContain('Proveri usluge i način rada pre čuvanja.');
    expect(texts()).not.toMatch(/sprem|potvrđen|aktivan|obaveštenja|od 2|od 5/i);
    expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
    expect(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Pregledaj profil')).toHaveLength(1);
    expect(openReview).not.toHaveBeenCalled();
    await act(async () => { press('Pregledaj profil').props.onPress(); });
    expect(openReview).toHaveBeenCalledTimes(1);
  });

  it('does not present an inherited city/radius as confirmed on-site coverage for a remote draft', async () => {
    const profile = draft({ skills: ['3D štampa'], bio: 'Izrađujem kod sebe, uz slanje ili preuzimanje.',
      location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null } });
    await act(async () => { tree = create(<WorkerAiCard profile={profile} compact={false} disabled={false} review={jest.fn()} />); });
    await act(async () => { tree.root.findByProps({ testID: 'worker-draft-disclosure' }).props.onPress(); });
    expect(texts()).toContain('Grad u nacrtu: Novi Sad · RS');
    expect(texts()).not.toMatch(/20 km|terenski krug|područje je potvrđeno/i);
    expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  });

  it('counts a week or a special date as time, and "Mogu odmah" alone too', () => {
    const time = (patch: Partial<WorkerAiReview['profile']['availability']>) => capturedParts(review({}, { rules: [], windows: [], ...patch }).profile).find(part => part.key === 'time')!.done;
    expect(time({})).toBe(false); expect(time({ availableNow: true })).toBe(true);
    expect(time({ rules: [{ id: 'r', weekdays: [1], startTime: '08:00', endTime: '16:00', startsOn: '2026-09-24', endsOn: null, label: '', active: true }] })).toBe(true);
    expect(time({ windows: [{ id: 'w', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:30:00Z', state: 'AVAILABLE', label: '' }] })).toBe(true);
  });

  it('does not ask for optional equipment or a mandatory area checklist before review', async () => {
    const withoutEquipment = review({}, { availableNow: true, rules: [], windows: [] });
    await act(async () => { tree = create(<WorkerAiCard profile={withoutEquipment.profile} compact={true} disabled={false} review={jest.fn()} />); });
    expect(texts()).not.toMatch(/još treba|nije navedeno|alat|vozilo|područje/i);
    expect(press('Pregledaj profil').props.disabled).toBe(false);
    expect(capturedParts(withoutEquipment.profile).find(part => part.key === 'tools')?.done).toBe(false);
  });
});

describe('explicit worker mode confirmation',()=>{
 it('does not preselect a delivery mode or grant any notification authority',async()=>{
  const change=jest.fn();
  await act(async()=>{tree=create(<WorkerAiModeConfirmation skills={['Časovi matematike','Sklapanje nameštaja']}
   choices={{}} disabled={false} onChange={change}/>);});
  expect(tree.root.findByProps({testID:'worker-explicit-mode-confirmation'})).toBeTruthy();
  const radios=tree.root.findAll(x=>String(x.type)==='Press'&&x.props.accessibilityRole==='radio');
  expect(radios).toHaveLength(6);
  expect(radios.every(x=>x.props.accessibilityState.checked===false)).toBe(true);
  await act(async()=>{radios[2].props.onPress();});
  expect(change).toHaveBeenCalledWith('Časovi matematike','BOTH');
   expect(texts()).toContain('Potvrdi za svaku uslugu: na lokaciji, na daljinu ili oba načina.');
 });
});
