import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NeedLocationInput } from '../../../contracts/location';
import type { NeedFactV2Key, NeedTaskGeography } from '../../../contracts/needFactsV2';
import type { PrilikaProjekcija } from '../../../contracts/projections';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
import { FactRow } from '../../system/FactRow';
import { PublicNeedPresentation } from '../../v2/PublicNeedPresentation';
import { taskPlace } from '../../v2/TaskFace';
import { needRequirementRows } from '../../../data/needDetailPresentation';
import { NO_PART, REQUIREMENT_ART, ReviewDetail, type ReviewDetailParts } from '../ReviewDetail';
import { reviewAsTask, type ReviewSource } from '../reviewAsTask';

/**
 * "Ovako izgleda kad ga otvore" is the page of a task somebody else posted, not a drawing of it (owner, 8 Oct 2026: "čovek vidi kako će izgledati kad je
 * objavljen"). The review draws it from the same parts (`TaskDecision*`, `DetailDescription`) over the projection the review is made into, and
 * this holds the two to the same facts, in the same words and the same order, so a change of the published page cannot leave the review behind: the
 * facts of the published page (what it pays, where, when, how many people, what it asks) are the facts of the review, and the only things the review
 * adds are the owner's (the pencils, the frame of the exact address, the deadline) and the only things it leaves out are what is for somebody who
 * applies (the button, the questions, the report of a person).
 */
type Fact = ReviewSource['publicProjection'][number];
const fact = (key: NeedFactV2Key, value: unknown): Fact => ({ key, value, privacyClass: 'PUBLIC', status: 'CONFIRMED' });
const STATIONARY: NeedTaskGeography = { mode: 'STATIONARY', start: { city: 'Novi Sad', area: 'Detelinara', label: 'Bulevar Evrope' } };
const ROUTE: NeedTaskGeography = { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', area: 'Grbavica', label: 'Bulevar oslobođenja' }, end: { city: 'Sremska Kamenica', label: 'Rade Končara' } };
const placed = (geography: NeedTaskGeography): NeedLocationInput => ({ taskCountryCode: 'RS', geography, exactAddress: null, accessNotes: null,
  resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress: null }, points: [{ slot: 'start', latitudeE6: 45243210, longitudeE6: 19842100, origin: { kind: 'MANUAL_PIN' } }] } });
const FULL: Fact[] = [fact('need.title', 'Čišćenje stana posle renoviranja'), fact('need.description', 'Stan od 60 m² posle renoviranja. Treba očistiti prozore, podove i kupatilo.'),
  fact('need.category', 'Čišćenje'), fact('need.price_mode', 'MY_PRICE'), fact('need.price_rsd', 6000), fact('need.price_basis', 'PER_PERSON'), fact('need.people_needed', 3),
  fact('need.schedule_kind', 'FIXED_WINDOW'), fact('need.starts_at', '2026-10-11T07:00:00.000Z'), fact('need.ends_at', '2026-10-11T11:00:00.000Z'),
  fact('need.task_geography', STATIONARY), fact('need.task_country_code', 'RS'), fact('need.required_skills', ['Čišćenje prozora', 'Poliranje']), fact('need.required_tools', ['Usisivač']),
  fact('need.required_vehicles', ['Kombi']), fact('need.required_licenses', ['Rad na visini']), fact('need.critical_conditions', ['Bez kućnih ljubimaca']),
  fact('need.minimum_experience_years', 2), fact('need.verified_identity_required', true)];
const swap = (facts: Fact[], ...changes: Fact[]) => [...facts.filter(item => !changes.some(change => change.key === item.key)), ...changes];
const PERSON = { profileId: 'profile-1', name: 'Miloš P.', rating: '4,7', reviewCount: 3 };

const CASES: [string, Fact[], NeedLocationInput | null][] = [
  ['a task with an amount for three people, every requirement and an identity condition', FULL, placed(STATIONARY)],
  ['a task asking for offers, with a term nobody fixed and nothing it asks', swap(FULL.filter(item => !item.key.startsWith('need.required') && item.key !== 'need.critical_conditions'
    && item.key !== 'need.minimum_experience_years' && item.key !== 'need.verified_identity_required'), fact('need.price_mode', 'OFFERS'), fact('need.schedule_kind', 'FLEXIBLE'),
    fact('need.people_needed', 1)), placed(STATIONARY)],
  ['a route', swap(FULL, fact('need.task_geography', ROUTE), fact('need.people_needed', 2)), placed(ROUTE)],
  ['remote work', swap(FULL, fact('need.task_geography', { mode: 'REMOTE' })), null],
  ['a task with nothing yet: no title, no price, no term, no place', [], null],
];

let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
/** The lines of fact of a page: the picture, the words and the note under them, in the order they stand. The lock is the page of others' own line about the address. */
const facts = () => tree.root.findAllByType(FactRow).map(node => ({ art: node.props.art, value: node.props.value, note: node.props.note, size: node.props.size }))
  .filter(row => row.art !== 'lock');
const noop = () => undefined;
const NO_PARTS: ReviewDetailParts = { title: NO_PART, value: NO_PART, place: NO_PART, time: NO_PART, people: NO_PART, description: NO_PART, map: NO_PART, deadline: NO_PART, requirements: {} };

const real = (need: PrilikaProjekcija) => <PublicNeedPresentation need={need} loading={false} error={false} missing={false} stale={false} busy={false} canApply canRetry
  relation={{ kind: 'NONE' }} onOwnTask={noop} onOwnApplication={noop} back={noop} retry={noop} apply={noop} map={<React.Fragment>{null}</React.Fragment>} />;
const preview = (need: PrilikaProjekcija) => <ReviewDetail need={need} parts={NO_PARTS} person={need.narucilacIme ? { ...PERSON, profile: null } : null} />;

describe.each(CASES)('the review says what the published page says: %s', (_name, facts_, location) => {
  const need = () => reviewAsTask({ reviewId: 'review-1', draftId: null, responseDeadline: null, location, publicProjection: facts_ }, facts_.length ? PERSON : null);

  it('has the same lines of fact, with the same pictures and the same words, in the same order', async () => {
    await render(real(need())); const published = facts(); await act(async () => tree.unmount());
    await render(preview(need())); const review = facts();
    expect(review).toEqual(published);
    // Every line is made of what the review has: nothing is invented to fill a line.
    expect(review.every(row => typeof row.value === 'string' && row.value.trim().length > 0)).toBe(true);
  });

  it('puts the parts of the page in the same order: the name, what it pays, where, when, who asks, the work, what it asks', async () => {
    const task = need();
    const landmarks = [task.naslov, task.ponudjenaCena?.prikaz, task.rezimCene === 'OFFERS' ? 'Tražim ponude' : null, taskPlace(task).text, task.vremeTekst, task.narucilacIme ? 'Objavio' : null,
      task.narucilacIme || null, task.opis ? 'O zadatku' : null, task.opis, needRequirementRows(task).length ? 'Važno za ovaj zadatak' : null,
      ...needRequirementRows(task).map(row => row.label)].filter((word): word is string => !!word);
    for (const element of [real(task), preview(task)]) {
      await render(element);
      const order = (word: string) => texts().join('\n').indexOf(word);
      const found = landmarks.map(order);
      expect(found.every(position => position >= 0)).toBe(true);
      expect(found).toEqual([...found].sort((a, b) => a - b));
      await act(async () => tree.unmount());
    }
  });
});

describe('what the review adds and what it leaves out', () => {
  it('has no button of apply, no question and no report of a person: the page is the owner\'s own, and nobody applies to it', async () => {
    await render(preview(reviewAsTask({ reviewId: 'review-1', draftId: null, responseDeadline: null, location: placed(STATIONARY), publicProjection: FULL }, PERSON)));
    const copy = texts().join('\n');
    for (const gone of ['Pošalji prijavu', 'Pošalji ponudu', 'Pitanja', 'Prijavi ili blokiraj osobu', 'Tačna adresa: samo u Dogovoru']) expect(copy).not.toContain(gone);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi ili blokiraj osobu' })).toHaveLength(0);
  });

  it('adds the deadline the owner sets, said as the people who apply read it', async () => {
    const need = reviewAsTask({ reviewId: 'review-1', draftId: null, responseDeadline: '2026-10-12T10:15:00.000Z', location: null, publicProjection: FULL }, PERSON);
    await render(preview(need));
    expect(texts().join('\n')).toMatch(/Prijave do 12\. okt( \d{4})? · 12:15 \(po vremenu u Srbiji\)/);
  });

  it('holds the pictures of the requirement lines to the published page\'s (the table here is a copy of its private one)', () => {
    const rows = needRequirementRows(reviewAsTask({ reviewId: 'review-1', draftId: null, responseDeadline: null, location: null, publicProjection: FULL }, null));
    expect(rows.map(row => row.label)).toEqual(['Veštine', 'Alat', 'Vozilo', 'Dozvole', 'Bitni uslovi', 'Najmanje iskustva', 'Identitet']);
    for (const row of rows) expect(REQUIREMENT_ART[row.label]).toBeDefined();
  });
});
