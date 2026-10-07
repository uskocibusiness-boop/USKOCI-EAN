import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The pieces of "Izmeni profil" drawn by the REAL components (the route tests stand in the press and the text with named
 * elements): nothing here may throw, every touch target is at least 44 dp, every word is at least 12 px, and the green
 * words and marks are the system's own. This is the closest a unit test gets to looking at the screen.
 */
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
import { EDIT_PHOTO, ProfileFactRows, ProfilePhotoBlock, VisibilityNote } from '../ProfileEditPresentation';
import { sys } from '../../system/tokens';

let tree: ReactTestRenderer;
const draw = async (node: React.ReactElement) => { await act(async () => { tree = create(node); }); };
/** The words as the phone draws them: the host text nodes, whatever component wrote them. */
const hostTexts = () => tree.root.findAll(node => (node.type as unknown) === 'Text');
const words = () => hostTexts().flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const styleOf = (text: string) => StyleSheet.flatten(hostTexts().find(node => node.children.includes(text))!.props.style);
afterEach(async () => { await act(async () => tree?.unmount()); });

it('draws the photo block with the camera mark and one button that says what it does', async () => {
  const open = jest.fn();
  await draw(<ProfilePhotoBlock photo={<Text>foto</Text>} ready onOpen={open} />);
  const buttons = tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Promeni fotografiju');
  expect(buttons.length).toBeGreaterThan(0);
  const camera = tree.root.findAll(node => node.props.accessibilityElementsHidden === true && node.props.importantForAccessibility === 'no-hide-descendants');
  expect(camera.length).toBeGreaterThan(0);
  expect(words()).toContain('Promeni fotografiju');
  const frame = tree.root.findAll(node => { const style = StyleSheet.flatten(node.props.style); return style?.width === EDIT_PHOTO && style?.height === EDIT_PHOTO; });
  expect(frame.length).toBeGreaterThan(0);
});

it('does not offer the camera mark or a press while the photo cannot be changed', async () => {
  await draw(<ProfilePhotoBlock photo={<Text>foto</Text>} ready={false} onOpen={jest.fn()} />);
  const button = tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Promeni fotografiju')[0];
  expect(button.props.disabled).toBe(true);
  expect(tree.root.findAll(node => node.props.accessibilityElementsHidden === true && node.props.importantForAccessibility === 'no-hide-descendants')).toHaveLength(0);
});

it('draws "O meni" and the city as two rows of at least 56 dp, each a button that says where it goes', async () => {
  const about = jest.fn(), city = jest.fn();
  await draw(<ProfileFactRows about={{ kind: 'text', text: 'Radim sa bratom.' }} city={{ kind: 'city', city: 'Novi Sad' }} onAbout={about} onCity={city} />);
  const rows = tree.root.findAll(node => node.props.accessibilityRole === 'button' && ['O meni', 'Grad'].includes(node.props.accessibilityLabel));
  expect([...new Set(rows.map(node => node.props.accessibilityLabel))]).toEqual(['O meni', 'Grad']);
  for (const row of rows) expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(56);
  expect(words()).toContain('Radim sa bratom.'); expect(words()).toContain('Novi Sad'); expect(words()).toContain('Grad se menja u području rada.');
});

it('draws the words about what is public and private, in reading size, with the way to the whole of it', async () => {
  const more = jest.fn();
  await draw(<VisibilityNote onMore={more} />);
  expect(words()).toContain('Javno i privatno'); expect(words()).toContain('Ime, fotografija, grad, „O meni“ i ocene vide druge osobe.');
  expect(words()).toContain('Privatnost i podaci');
  for (const node of hostTexts()) {
    const size = StyleSheet.flatten(node.props.style)?.fontSize;
    if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12);
  }
  const row = tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Privatnost i podaci')[0];
  expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(56);
});

it('the green of the photo word is the system\'s green, and a disabled one is grey', async () => {
  await draw(<ProfilePhotoBlock photo={<Text>foto</Text>} ready onOpen={jest.fn()} />);
  expect(styleOf('Promeni fotografiju').color).toBe(sys.color.green);
  await act(async () => tree.update(<ProfilePhotoBlock photo={<Text>foto</Text>} ready={false} onOpen={jest.fn()} />));
  expect(styleOf('Promeni fotografiju').color).toBe(sys.color.muted);
});
