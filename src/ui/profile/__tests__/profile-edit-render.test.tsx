import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The pieces of "Lični podaci" (it was "Izmeni profil" until the approved draft of the product, 8 Oct 2026) drawn by the REAL components (the route tests stand in the press and the text with named
 * elements): nothing here may throw, every touch target is at least 44 dp, every word is at least 12 px, and the green
 * words and marks are the system's own. This is the closest a unit test gets to looking at the screen.
 */
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
import { EDIT_PHOTO, NameSaveButton, ProfileFactRows, ProfilePhotoBlock, SHARED_ONLY_BY_RULES, VISIBLE_TO_OTHERS, VisibilityNote, WORK_NAME_NOT_WRITTEN, WorkNameNotice } from '../ProfileEditPresentation';
import { DisplayNameForm, type NameSaveControl } from '../DisplayNameForm';
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

it('draws "O meni" and the city as two rows of at least 56 dp, each a button that goes where the thing is changed, and says nothing about where', async () => {
  const about = jest.fn(), city = jest.fn();
  await draw(<ProfileFactRows about={{ kind: 'text', text: 'Radim sa bratom.' }} city={{ kind: 'city', city: 'Novi Sad' }} onAbout={about} onCity={city} />);
  const rows = tree.root.findAll(node => node.props.accessibilityRole === 'button' && ['O meni', 'Područje rada'].includes(node.props.accessibilityLabel));
  expect([...new Set(rows.map(node => node.props.accessibilityLabel))]).toEqual(['O meni', 'Područje rada']);
  for (const row of rows) expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(56);
  expect(words()).toContain('Radim sa bratom.'); expect(words()).toContain('Novi Sad');
  // The owner's phone, 8 Oct 2026: a row with an arrow that says in a sentence under it that the city is changed somewhere else.
  expect(words()).not.toContain('Grad se menja u području rada.');
  await act(async () => { rows.find(node => node.props.accessibilityLabel === 'Područje rada')!.props.onPress(); });
  expect(city).toHaveBeenCalledTimes(1); expect(about).not.toHaveBeenCalled();
});

it('draws the actual work-area city as the value below its correctly named row', async () => {
  await draw(<ProfileFactRows about={{ kind: 'none' }} city={{ kind: 'city', city: 'Novi Sad' }} onAbout={jest.fn()} onCity={jest.fn()} />);
  const row = tree.root.findAll(node => node.props.title === 'Područje rada' && typeof node.props.onPress === 'function')[0];
  expect(row.props.value).toBe('Novi Sad'); expect(row.props.subtitle).toBeUndefined();
  expect(words()).toContain('Dodaj opis');
});

it('draws what is public as ONE sentence with its picture and a small "ⓘ" at its end for the other half, with no title and nothing else to press', async () => {
  await draw(<VisibilityNote />);
  expect(words()).toBe(VISIBLE_TO_OTHERS);
  expect(words()).not.toContain('Javno i privatno'); expect(words()).not.toContain('Privatnost i podaci'); expect(words()).not.toContain(SHARED_ONLY_BY_RULES);
  // The only control is the mark, spoken as the explanation it opens.
  expect([...new Set(tree.root.findAll(node => node.props.accessibilityRole === 'button').map(node => node.props.accessibilityLabel))]).toEqual(['Objašnjenje: Javno i privatno']);
  const info = tree.root.findAll(node => node.props.testID === 'profile-visibility-info' && Array.isArray(node.props.lines))[0];
  expect(info.props.title).toBe('Javno i privatno'); expect(info.props.lines).toEqual([VISIBLE_TO_OTHERS, SHARED_ONLY_BY_RULES]);
  for (const node of hostTexts()) {
    const size = StyleSheet.flatten(node.props.style)?.fontSize;
    if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12);
  }
});

// ONE NAME (owner, 8 Oct 2026): the name saved on the account that the work profile did not take is said, never silent, with the one thing that can be done.
describe('the name that the work profile did not take', () => {
  it('says so in a warning note with its one retry, spoken as an alert, and the retry waits while it runs', async () => {
    const retry = jest.fn();
    await draw(<WorkNameNotice retrying={false} onRetry={retry} />);
    expect(words()).toContain(WORK_NAME_NOT_WRITTEN); expect(WORK_NAME_NOT_WRITTEN).toBe('Ime je sačuvano na nalogu, ali nije upisano u radni profil.');
    const button = () => tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Pokušaj ponovo' && typeof node.props.onPress === 'function')[0];
    await act(async () => { button().props.onPress(); }); expect(retry).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<WorkNameNotice retrying onRetry={retry} />));
    expect(button().props.disabled).toBe(true);
  });
});

// The owner's phone, 8 Oct 2026: a grey "Sačuvaj ime" stood there all the time with "Ovo ime je već sačuvano." under it.
describe('the name', () => {
  const form = (patch: Partial<React.ComponentProps<typeof DisplayNameForm>> = {}) => <DisplayNameForm savedName="Ana Petrović" busy={false} uncertain={false}
    saved={false} error={null} checking={false} check={jest.fn()} save={jest.fn(async () => {})} {...patch} />;
  const saveButton = () => tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Sačuvaj ime')[0];
  const field = () => tree.root.findAll(node => node.props.accessibilityLabel === 'Ime za prikaz' && typeof node.props.onChangeText === 'function')[0];

  it('draws no save button, no "already saved" line and no paragraph about who sees it while the name is the saved one', async () => {
    await draw(form());
    expect(saveButton()).toBeUndefined();
    expect(words()).not.toContain('Ovo ime je već sačuvano.'); expect(words()).not.toContain('Ovo ime vide ljudi');
    expect(words()).toContain('Ime za prikaz');
  });

  it('draws the one green save once the name has been changed, and saves the typed name once', async () => {
    const save = jest.fn(async (_name: string, _requestId: string) => {});
    await draw(form({ save }));
    await act(async () => { field().props.onChangeText('Ana Petrović-Ilić'); });
    expect(saveButton()).toBeTruthy(); expect(saveButton().props.accessibilityState.disabled).toBe(false);
    await act(async () => { saveButton().props.onPress(); });
    expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0]).toBe('Ana Petrović-Ilić');
  });

  it('takes the save away again when the change is undone, and says why a name emptied cannot be saved', async () => {
    await draw(form());
    await act(async () => { field().props.onChangeText('Ana'); }); expect(saveButton()).toBeTruthy();
    await act(async () => { field().props.onChangeText('Ana Petrović'); }); expect(saveButton()).toBeUndefined();
    await act(async () => { field().props.onChangeText('   '); });
    expect(saveButton().props.accessibilityState.disabled).toBe(true); expect(words()).toContain('Ime ne može da ostane prazno.');
  });

  it('says the name is saved once it is, and asks to read the saved name after an unknown outcome instead of drawing the save', async () => {
    await draw(form({ saved: true }));
    expect(words()).toContain('Ime je sačuvano.'); expect(saveButton()).toBeUndefined();
    await act(async () => tree.update(form({ uncertain: true, error: 'Čuvanje nije potvrđeno.' })));
    expect(saveButton()).toBeUndefined();
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Proveri sačuvane podatke').length).toBeGreaterThan(0);
  });
});

// Approved draft of the product, 8 Oct 2026, P2: "Sačuvaj u zaglavlju tek kad se nešto promeni". With `onSaveControl` the form draws no action under the field: it
// reports the bar's "Sačuvaj" (or `null` while there is nothing to save) and the screen draws it in the bar.
describe('the name with its save in the bar', () => {
  const save = jest.fn(async (_name: string, _requestId: string) => {});
  let reported: Array<NameSaveControl | null> = [];
  const report = (control: NameSaveControl | null) => { reported.push(control); };
  const last = () => reported[reported.length - 1];
  const form = (patch: Partial<React.ComponentProps<typeof DisplayNameForm>> = {}) => <DisplayNameForm savedName="Ana Petrović" busy={false} uncertain={false}
    saved={false} error={null} checking={false} check={jest.fn()} save={save} onSaveControl={report} {...patch} />;
  const field = () => tree.root.findAll(node => node.props.accessibilityLabel === 'Ime za prikaz' && typeof node.props.onChangeText === 'function')[0];
  const underField = () => tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Sačuvaj ime');
  beforeEach(() => { reported = []; save.mockClear(); });

  it('reports nothing to save while the name is the saved one, a control the moment it changes, and nothing again when the change is undone', async () => {
    await draw(form());
    expect(last()).toBeNull();
    await act(async () => { field().props.onChangeText('Ana Petrović-Ilić'); });
    expect(last()).toMatchObject({ disabled: false, loading: false }); expect(typeof last()!.press).toBe('function');
    await act(async () => { field().props.onChangeText('Ana Petrović'); });
    expect(last()).toBeNull();
  });

  it('draws no action of its own under the field, with a change in it or without', async () => {
    await draw(form({ typed: 'Ana Petrović-Ilić' }));
    expect(underField()).toHaveLength(0);
    expect(last()).toMatchObject({ disabled: false });
    expect(words()).not.toContain('Sačuvaj ime');
  });

  it('says why a save waits as a muted line under the field, and reports a control that cannot be pressed meanwhile', async () => {
    await draw(form({ typed: '  ' }));
    expect(last()).toMatchObject({ disabled: true }); expect(words()).toContain('Ime ne može da ostane prazno.');
    await act(async () => tree.update(form({ checking: true })));
    await act(async () => { field().props.onChangeText('Ana P.'); });
    expect(last()).toMatchObject({ disabled: true }); expect(words()).toContain('Učitavamo sačuvano ime…');
  });

  it('reports a control that is loading while the save runs, and the one it reports saves the typed name once with its request id', async () => {
    await draw(form());
    await act(async () => { field().props.onChangeText('  Ana P.  '); });
    await act(async () => { last()!.press(); });
    expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0]).toBe('Ana P.'); expect(typeof save.mock.calls[0][1]).toBe('string');
    await act(async () => tree.update(form({ busy: true })));
    expect(last()).toMatchObject({ loading: true });
  });

  it('reports nothing after an unknown outcome (the one action is to read the saved name), and when the form goes away', async () => {
    await draw(form({ typed: 'Ana P.' }));
    expect(last()).not.toBeNull();
    await act(async () => tree.update(form({ typed: 'Ana P.', uncertain: true, error: 'Čuvanje nije potvrđeno.' })));
    expect(last()).toBeNull();
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Proveri sačuvane podatke').length).toBeGreaterThan(0);
    await act(async () => tree.update(form({ typed: 'Ana P.' })));
    expect(last()).not.toBeNull();
    await act(async () => tree.unmount());
    expect(last()).toBeNull();
  });

  it('draws the bar\'s "Sačuvaj" as a green pill with a check, grey while it cannot be pressed, and says "Čuvamo…" while it runs', async () => {
    const press = jest.fn();
    await draw(<NameSaveButton control={{ disabled: false, loading: false, press }} />);
    const button = () => tree.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Sačuvaj ime' && typeof node.props.onPress === 'function')[0];
    expect(words()).toBe('Sačuvaj'); expect(button().props.disabled).toBe(false);
    await act(async () => { button().props.onPress(); }); expect(press).toHaveBeenCalledTimes(1);
    expect(styleOf('Sačuvaj').color).toBe(sys.color.green);
    await act(async () => tree.update(<NameSaveButton control={{ disabled: true, loading: false, press }} />));
    expect(button().props.disabled).toBe(true); expect(styleOf('Sačuvaj').color).toBe(sys.color.muted);
    await act(async () => tree.update(<NameSaveButton control={{ disabled: false, loading: true, press }} />));
    expect(words()).toBe('Čuvamo…'); expect(button().props.disabled).toBe(true);
    // No word is smaller than 12.
    for (const node of hostTexts()) { const size = StyleSheet.flatten(node.props.style)?.fontSize; if (typeof size === 'number') expect(size).toBeGreaterThanOrEqual(12); }
  });
});

it('the green of the photo word is the system\'s green, and a disabled one is grey', async () => {
  await draw(<ProfilePhotoBlock photo={<Text>foto</Text>} ready onOpen={jest.fn()} />);
  expect(styleOf('Promeni fotografiju').color).toBe(sys.color.green);
  await act(async () => tree.update(<ProfilePhotoBlock photo={<Text>foto</Text>} ready={false} onOpen={jest.fn()} />));
  expect(styleOf('Promeni fotografiju').color).toBe(sys.color.muted);
});
