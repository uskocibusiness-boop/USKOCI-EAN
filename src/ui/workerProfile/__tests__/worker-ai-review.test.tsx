import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAiReview } from '../../../data/workerAiClientService';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'TextInput', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));

import { WorkerAiActivation, WorkerAiManual, WorkerAiReviewDetails } from '../WorkerAiPresentation';
import { sys } from '../../system/tokens';

/**
 * The frozen review of the AI worker profile (2026-09-24): dates as "24. sep", windows in the one time format without
 * seconds, no raw zone name for Serbian time, and one word for anything not given.
 */
const review = (patch: Partial<WorkerAiReview['profile']['availability']> = {}, profile: Partial<WorkerAiReview['profile']> = {}): WorkerAiReview => ({
  schemaVersion: 'WORKER_PROFILE_V1', reviewId: 'r', conversationId: 'c', accountId: 'a', profileId: 'p', revision: 1, activate: false,
  missingRequired: [], canAccept: true, expiresAt: '2026-09-24T12:00:00Z', displayedContentDigest: 'd'.repeat(64),
  profile: { displayName: 'Ana', bio: '', skills: ['Selidbe'], tools: [], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false,
      rules: [{ id: 'rule', weekdays: [1], startTime: '08:00', endTime: '16:00', startsOn: '2026-09-24', endsOn: null, label: '', active: true }],
      windows: [{ id: 'w', startsAt: '2026-09-26T08:00:00Z', endsAt: '2026-09-26T10:30:00Z', state: 'AVAILABLE', label: '' }], ...patch },
    ...profile },
} as WorkerAiReview);

let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
afterEach(async () => { await act(async () => tree?.unmount()); });

it('writes a rule start as a day, a window without seconds, and no zone line for Serbian time', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review()} />); });
  const copy = texts();
  expect(copy).toContain('08:00–16:00 · od 24. sep'); expect(copy).not.toContain('2026-09-24');
  expect(copy).toContain('26. sep'); expect(copy).toContain('10:00–12:30'); expect(copy).not.toMatch(/\d\d:\d\d:\d\d/);
  expect(copy).not.toContain('Vremenska zona');
});

it('names the zone only when it is not Serbian time', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ timezone: 'Europe/Vienna' })} />); });
  expect(texts()).toContain('Vremenska zona');
});

it('uses one empty label without legacy licence/team rows or an empty biography section', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({}, { skills: [], location: { operatingCountryCode: null, city: '', radiusKm: 20, approximatePosition: null } })} />); });
  const copy = texts();
  expect(copy).not.toMatch(/Još nije navedeno/);
  // Three parts have nothing in them: the skills, the area, and the tools and vehicles (one word for the two lists).
  expect(copy.split('Nije navedeno').length - 1).toBe(3);
  expect(copy).not.toMatch(/Licenc|licenc|Broj ljudi|kapacitet|O tebi/);
});

it('writes the year of a rule day only when it is not the current one', async () => {
  const next = String(new Date().getFullYear() + 1), now = String(new Date().getFullYear());
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ rules: [{ id: 'rule', weekdays: [1], startTime: '08:00', endTime: '16:00',
    startsOn: `${now}-09-24`, endsOn: `${next}-01-05`, label: '', active: true }] })} />); });
  const copy = texts();
  expect(copy).toContain(`od 24. sep do 5. jan ${next}`); expect(copy).not.toContain(`24. sep ${now}`);
});

// Round 5c: the rule day is the shared civilDay, so a value that is not a calendar date is shown as it came, never as
// "Invalid Date".
it('shows a malformed rule day as it came instead of an invented date', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ rules: [{ id: 'rule', weekdays: [1], startTime: '08:00', endTime: '16:00',
    startsOn: '2026-02-31', endsOn: null, label: '', active: true }] })} />); });
  const copy = texts();
  expect(copy).toContain('od 2026-02-31'); expect(copy).not.toMatch(/Invalid|NaN/);
});


it('says what the name and "O meni" do, without claiming verification or a score', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review()} />); });
  const explanation = tree.root.findByProps({ testID: 'worker-matching-explanation' });
  const copy = explanation.children.filter(child => typeof child === 'string').join('');
  expect(copy).toContain('vide osobe koje otvore tvoj profil'); expect(copy).toContain('ne menjaju koji ti zadaci stižu');
  expect(copy).not.toMatch(/licenc|kapacitet/); expect(copy).not.toMatch(/verifikovan|%|skor/i);
});

it('summarizes only actual schedule rules and keeps paused rules and exceptions visible', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ rules: [
    { id: 'rule-a', weekdays: [1, 3], startTime: '08:00:00', endTime: '16:00:00', startsOn: '2026-09-24', endsOn: null, label: 'Pre podne', active: true },
    { id: 'rule-b', weekdays: [6], startTime: '10:00', endTime: '14:00', startsOn: '2026-09-24', endsOn: null, label: '', active: false },
  ] })} />); });
  const copy = texts();
  expect(copy).toContain('Ponedeljak · Sreda'); expect(copy).toContain('Subota'); expect(copy).toContain('pauzirano');
  expect(copy).toContain('Pre podne'); expect(copy).toContain('Slobodno za rad');
  expect(copy).not.toContain('Nema redovnih termina'); expect(copy).not.toContain('08:00:00'); expect(copy).not.toContain('Utorak');
});

it('does not invent availability for an empty calendar', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review({ rules: [], windows: [] })} />); });
  const copy = texts();
  expect(copy).toContain('Redovni termini nisu podešeni.');
  expect(copy).not.toContain('Ponedeljak'); expect(copy).not.toContain('Slobodno za rad'); expect(copy).not.toContain('Posebni datumi');
});

it('manual personal-profile correction does not erase or write hidden legacy fields', async () => {
  const profile = review({}, { licenses: ['LEGACY_LICENSE'], teamCapacity: 37 }).profile;
  const apply = jest.fn();
  await act(async () => { tree = create(<WorkerAiManual profile={profile} disabled={false} apply={apply} />); });
  const fields = tree.root.findAllByType('TextInput' as React.ElementType);
  expect(fields.some(node => /licenc|ljudi/i.test(node.props.accessibilityLabel))).toBe(false);
  const submit = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.props.accessibilityLabel === 'Primeni na pregled profila')[0];
  await act(async () => { submit.props.onPress(); });
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply.mock.calls[0][0]).not.toHaveProperty('licenses');
  expect(apply.mock.calls[0][0]).not.toHaveProperty('teamCapacity');
  expect(profile.licenses).toEqual(['LEGACY_LICENSE']); expect(profile.teamCapacity).toBe(37);
});

it('draws the activation choice on a flat tint with a white thumb', async () => {
  await act(async () => { tree = create(<WorkerAiActivation activate={false} disabled={false} change={() => {}} />); });
  const toggle = tree.root.findByType('Switch' as React.ElementType);
  expect(toggle.props.thumbColor).toBe(sys.color.surface);
  expect(toggle.props.accessibilityLabel).toBe('Aktiviraj profil posle čuvanja');
});

jest.mock('../../location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ReviewedWorkAreaMap' }));
it('P5 worker review: map belongs to the frozen review and is read-only, not a new live location', async () => {
  const saved = review({}, { location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20,
    approximatePosition: { latitude: 45.25, longitude: 19.83 } } });
  await act(async () => { tree = create(<WorkerAiReviewDetails review={saved} />); });
  const map = tree.root.findByType('ReviewedWorkAreaMap' as React.ElementType);
  expect(map.props).toMatchObject({ coarse: true, disabled: true, height: 220, position: saved.profile.location.approximatePosition });
  expect(map.props.scopeKey).toContain(saved.reviewId); expect(map.props.scopeKey).toContain(saved.accountId);
  expect(texts()).not.toContain('tačka radnog područja je sačuvana');
});
it('P5 worker review: missing coordinates never render a fabricated map', async () => {
  await act(async () => { tree = create(<WorkerAiReviewDetails review={review()} />); });
  expect(tree.root.findAllByType('ReviewedWorkAreaMap' as React.ElementType)).toHaveLength(0);
});
