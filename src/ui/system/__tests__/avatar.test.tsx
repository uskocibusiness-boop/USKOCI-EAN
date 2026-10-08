import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Avatar, FACE_EDGE, FaceEdge, type AvatarSize } from '../Avatar';
import { T } from '../../Text';
import { inicijali } from '../../../lib/inicijali';
import { sys } from '../tokens';

/** One stand-in for a person's photo (2026-09-24). A missing name draws a person, never letters of its own. */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });
/** FactArt is memoised, so it is found by what it draws. */
const art = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.kind !== undefined && node.props.size !== undefined);
const disc = () => StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style);

it.each([32, 40, 56] as AvatarSize[])('draws the initials in a %i px disc, never under 12 px, and keeps them inside it', async size => {
  await render(<Avatar initials={inicijali('Miloš Šljivić')} size={size} />);
  const letters = tree.root.findByType(T);
  expect(letters.props.children).toBe('MŠ');
  expect(StyleSheet.flatten(letters.props.style).fontSize).toBeGreaterThanOrEqual(12);
  expect(letters.props.maxFontSizeMultiplier).toBe(1);
  expect(disc()).toMatchObject({ width: size, height: size, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft });
  expect(art()).toHaveLength(0);
});

it.each([null, undefined, '', '  '])('no initials (%j) draw a person, not letters', async initials => {
  await render(<Avatar initials={initials} size={56} />);
  expect(tree.root.findAllByType(T)).toHaveLength(0);
  expect(art().map(node => node.props.kind)).toContain('person');
});

it('a name with no letters in it reaches the disc as the person, through inicijali()', async () => {
  await render(<Avatar initials={inicijali('—')} />);
  expect(art().map(node => node.props.kind)).toContain('person');
  expect(disc()).toMatchObject({ width: 40, height: 40 });
});

it('is decoration beside the name: a screen reader does not hear it', async () => {
  await render(<Avatar initials="AN" />);
  const root = tree.root.findAllByType(View)[0];
  expect(root.props.accessible).toBe(false);
  expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(root.props.accessibilityElementsHidden).toBe(true);
});

// The sticker edge of the face a screen is about (owner's picks of 8 Oct 2026: the rating, my profile, the public profile) and the ring that
// carries a state. Both are off by default, so a face in a row is exactly what it always was.
describe('the sticker edge and the ring', () => {
  const outer = () => StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style);

  it('are off by default: the disc is the whole of the face, with no wrapper, no edge and no shadow', async () => {
    await render(<Avatar initials="AN" size={72} />);
    expect(tree.root.findAllByType(View)).toHaveLength(1);
    expect(outer()).toMatchObject({ width: 72, height: 72, backgroundColor: sys.color.greenSoft });
    expect(outer().shadowOpacity).toBeUndefined();
  });

  it('with edge wraps the same disc in two dp of white and one soft shadow, centred, so the face lies on the screen as a sticker', async () => {
    expect(FACE_EDGE).toBe(2);
    await render(<Avatar initials="AN" size={96} edge />);
    expect(outer()).toMatchObject({ padding: 2, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignSelf: 'center', shadowOpacity: sys.elevation.soft.shadowOpacity });
    expect(outer().borderWidth).toBeUndefined();
    const discs = tree.root.findAllByType(View).filter(node => StyleSheet.flatten(node.props.style)?.width === 96);
    expect(discs).toHaveLength(1);
    expect(tree.root.findAllByType(T)[0].props.children).toBe('AN');
  });

  it('with ring adds a ring outside the edge: green for a live Dogovor, the strong line for one that is over', async () => {
    await render(<Avatar initials="AN" size={56} ring="live" />);
    expect(outer()).toMatchObject({ borderWidth: 2, borderColor: sys.color.green, padding: 2 });
    await act(async () => tree.update(<Avatar initials="AN" size={56} ring="over" />));
    expect(outer()).toMatchObject({ borderWidth: 2, borderColor: sys.color.lineStrong });
  });

  it('wraps anything that is a face, the photo included, and is decoration like the face: a screen reader does not hear it', async () => {
    await render(<FaceEdge ring="live"><View testID="photo" /></FaceEdge>);
    expect(outer()).toMatchObject({ borderColor: sys.color.green });
    expect(tree.root.findAllByProps({ testID: 'photo' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(View)[0].props.accessible).toBe(false);
  });
});
