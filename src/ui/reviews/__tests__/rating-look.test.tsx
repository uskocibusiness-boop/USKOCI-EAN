import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { ReviewTag } from '../../../data/reviewsClientService';

/**
 * The rating screen as the owner picked it on 8 Oct 2026: "Zvezde kao nalepnice" (the person's face at 72 inside its sticker edge, centred
 * over the name; five 48 dp stickers; the word of the rating under them) and "Pilula pada, sjaj" (the saved rating: the stars as given, the
 * pill "Ocenjeno" and the glow, both only for a rating that has just been saved). The behaviour of the screen (what is saved, when) is
 * tested in `review-screen.test.tsx`; this is its look and its moments, drawn from fixtures, with the drawings as named elements.
 */
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../system/DetailTopBar', () => ({ DetailTopBar: 'DetailTopBar' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../system/Avatar', () => ({ Avatar: 'Avatar', FaceEdge: 'FaceEdge' }));
jest.mock('../../system/Glyph', () => ({ Glyph: 'Glyph' }));
jest.mock('../RatingStar', () => ({ RatingStar: 'RatingStar', StarGlow: 'StarGlow', STARS_WIDTH: 272, STAR_SLOT: 48 }));
jest.mock('../../system/Pecat', () => ({ Pecat: 'Pecat', PECAT_FALL_MS: 140 }));
import { AgreementReviewPresentation, SACUVANO_NOTE, type ReviewPerson, type ReviewView } from '../AgreementReviewPresentation';

const TAGS: readonly ReviewTag[] = ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'];
const PERSON: ReviewPerson = { name: 'Marko Jovanović', initials: 'MJ', profileId: null, role: 'Uskače na tvoj zadatak', task: 'Prenos ormana do kombija' };
const noop = () => {};
const eligible = (patch: Partial<Extract<ReviewView, { kind: 'eligible' }>> = {}): ReviewView => ({ kind: 'eligible', catalog: { maxTags: 3, tags: TAGS }, rating: 4, tags: ['ON_TIME'],
  editable: true, attempt: false, onRate: noop, onToggleTag: noop, save: { label: 'Sačuvaj ocenu', loading: false, disabled: false, reason: null, onPress: noop }, ...patch });
const saved = (patch: Partial<Extract<ReviewView, { kind: 'saved' }>> = {}): ReviewView => ({ kind: 'saved', rating: 4, tags: ['ON_TIME', 'RELIABLE'], fresh: false, ...patch });

let tree: ReactTestRenderer;
const draw = async (view: ReviewView, person: ReviewPerson | null = PERSON, photo?: (id: string, fallback: React.ReactNode, size?: number) => React.ReactNode) => {
  await act(async () => { tree = create(<AgreementReviewPresentation backLabel="Nazad na Dogovor" onBack={noop} view={view} person={person} photo={photo}
    notice={null} retry={{ label: 'Ponovo učitaj ocenu', disabled: false, onPress: noop }} />); });
};
const hosts = (name: string) => tree.root.findAll(node => String(node.type) === name);
const texts = () => hosts('T').map(node => node.children.filter(child => typeof child === 'string').join('')).filter(Boolean);
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('the rating, before saving', () => {
  it('stands the person centred over the rating: the face at 72 inside its sticker edge, then the name, what they are to me and the task', async () => {
    await draw(eligible());
    const person = tree.root.findAll(node => node.props.accessibilityLabel === 'Marko Jovanović, Uskače na tvoj zadatak, Prenos ormana do kombija')[0];
    expect(flat(person)).toMatchObject({ alignItems: 'center' });
    expect(hosts('FaceEdge')).toHaveLength(1);
    expect(hosts('Avatar').map(node => [node.props.initials, node.props.size])).toEqual([['MJ', 72]]);
    const inPerson = person.findAll(node => String(node.type) === 'T').map(node => node.children.join(''));
    expect(inPerson).toEqual(['Marko Jovanović', 'Uskače na tvoj zadatak', 'Prenos ormana do kombija']);
    expect(person.findAll(node => String(node.type) === 'T').every(node => flat(node).textAlign === 'center')).toBe(true);
  });

  it('asks for the photo at 72 and puts it, or the letters, inside the same sticker edge', async () => {
    const photo = jest.fn((_id: string, fallback: React.ReactNode, _size?: number) => <>{fallback}</>);
    await draw(eligible(), { ...PERSON, profileId: 'profile-9' }, photo);
    expect(photo.mock.calls.map(call => [call[0], call[2]])).toEqual([['profile-9', 72]]);
    expect(hosts('FaceEdge')[0].findAll(node => String(node.type) === 'Avatar')).toHaveLength(1);
  });

  it('draws no person and no face when the Dogovor did not say who, and leads with the question in the title size', async () => {
    await draw(eligible(), null);
    expect(hosts('FaceEdge')).toHaveLength(0); expect(hosts('Avatar')).toHaveLength(0);
    expect(hosts('T').find(node => node.children.includes('Kako je prošla saradnja?'))!.props.variant).toBe('title');
  });

  it('draws five stars as 48 dp stickers in a radio group of 272, full up to the rating and empty after it, and the word of the rating under them', async () => {
    await draw(eligible({ rating: 4 }));
    const group = tree.root.findAll(node => node.props.accessibilityRole === 'radiogroup')[0];
    expect(flat(group)).toMatchObject({ flexDirection: 'row', width: 272, alignSelf: 'center' });
    const radios = hosts('Press').filter(node => node.props.accessibilityRole === 'radio');
    expect(radios).toHaveLength(5);
    for (const radio of radios) expect(flat(radio)).toMatchObject({ width: 48, height: 48 });
    expect(radios.map(radio => radio.findAll(node => String(node.type) === 'RatingStar')[0].props.full)).toEqual([true, true, true, true, false]);
    expect(radios.map(radio => radio.props.accessibilityState.checked)).toEqual([false, false, false, true, false]);
    expect(texts()).toContain('Vrlo dobro');
  });

  it('has no glow, no pill and nothing that moves before saving: a rating is chosen, not announced', async () => {
    await draw(eligible());
    expect(hosts('Pecat')).toHaveLength(0); expect(hosts('StarGlow')).toHaveLength(0);
  });

  it('marks a chosen tag with the check of the one icon source, and no other tag', async () => {
    await draw(eligible({ tags: ['ON_TIME'] }));
    const chosen = hosts('Press').filter(node => node.props.accessibilityRole === 'checkbox' && node.props.accessibilityState.checked);
    expect(chosen.map(node => node.props.accessibilityLabel)).toEqual(['Na vreme']);
    expect(chosen[0].findAll(node => String(node.type) === 'Glyph').map(node => node.props.name)).toEqual(['check']);
    expect(hosts('Glyph')).toHaveLength(1);
  });
});

describe('the saved rating', () => {
  it('keeps the column of the rating: the face over the name, the title, the stars as they were given, then what the rating said', async () => {
    await draw(saved({ rating: 4, tags: ['ON_TIME', 'RELIABLE'] }));
    expect(texts()).toEqual(['Marko Jovanović', 'Ocena je sačuvana.', 'Tvoja ocena: 4 od 5', 'Na vreme · Pouzdano', SACUVANO_NOTE]);
    expect(SACUVANO_NOTE).toBe('Ocena pomaže drugima da biraju i ne može da se menja.');
    expect(hosts('Avatar').map(node => node.props.size)).toEqual([72]);
    expect(hosts('RatingStar').map(node => node.props.full)).toEqual([true, true, true, true, false]);
    expect(hosts('T').find(node => node.children.includes('Ocena je sačuvana.'))!.props.accessibilityRole).toBe('header');
  });

  it('hides the stars from a screen reader: the line "Tvoja ocena: 4 od 5" says them once', async () => {
    await draw(saved());
    const row = tree.root.findAll(node => node.props.accessibilityElementsHidden === true && node.props.importantForAccessibility === 'no-hide-descendants')
      .find(node => node.findAll(child => String(child.type) === 'RatingStar').length === 5)!;
    expect(row.props.accessible).toBe(false);
  });

  it('right after saving the pill "Ocenjeno" falls with the success tick and the glow follows it, as the stamp lands', async () => {
    await draw(saved({ fresh: true }));
    expect(hosts('Pecat').map(node => node.props)).toEqual([expect.objectContaining({ label: 'Ocenjeno', tone: 'green', shape: 'check', tickKind: 'success', play: true })]);
    expect(hosts('StarGlow').map(node => node.props)).toEqual([expect.objectContaining({ play: true, delay: 140, width: 272 })]);
  });

  it('reopened later it is still: the same pill and the same stars, nothing falls, nothing glows, nothing ticks', async () => {
    await draw(saved({ fresh: false }));
    expect(hosts('Pecat')[0].props.play).toBe(false);
    expect(hosts('StarGlow')[0].props.play).toBe(false);
  });

  it('lands the pill on the top right corner of the stars, half over their edge', async () => {
    await draw(saved({ fresh: true }));
    expect(flat(hosts('Pecat')[0])).toMatchObject({ position: 'absolute' });
    expect(flat(hosts('Pecat')[0]).top).toBeLessThan(0); expect(flat(hosts('Pecat')[0]).right).toBeLessThan(0);
  });

  it('draws no person when there is none, and keeps the written comment between the tags and the sentence that it cannot change', async () => {
    await draw(saved({ comment: 'Sve je proteklo kako treba.' }), null);
    expect(hosts('Avatar')).toHaveLength(0);
    const all = texts();
    expect(all.indexOf('Tvoj komentar')).toBeGreaterThan(all.indexOf('Na vreme · Pouzdano'));
    expect(all.indexOf(SACUVANO_NOTE)).toBeGreaterThan(all.indexOf('Tvoj komentar'));
  });

  it('keeps the one way back as the green action', async () => {
    await draw(saved());
    expect(hosts('Action').map(node => node.props.label)).toEqual(['Nazad na Dogovor']);
  });
});

describe('what the screen no longer does', () => {
  const source = readFileSync(join(__dirname, '../AgreementReviewPresentation.tsx'), 'utf8');
  it('imports no icon package of its own, reads no window width and spells no colour: the stars, the check and the sizes come from the system', () => {
    expect(source).not.toMatch(/phosphor-react-native/);
    expect(source).not.toMatch(/useWindowDimensions|Dimensions\./);
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/SuccessMark/);
  });
});
