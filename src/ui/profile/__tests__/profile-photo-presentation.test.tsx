import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Fotografija profila" (owner's phone, 8 Oct 2026): the photo was drawn as an OVAL 213 dp wide and 160 high (the 4:3 frame of the authorized
 * photo won over the width), the loading state was a grey slab with a spinner, "Ukloni fotografiju profila" stood indented under two full-width
 * buttons, and the note named a button ("Sačuvaj fotografiju") that the screen did not have. The real presentation draws it here; the authorized
 * photo is a named element, so what the screen hands it (its frame, its stand-in while the picture is on its way) can be read.
 */
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
import { PHOTO_CIRCLE, PHOTO_LIMIT, PHOTO_SEEN_AFTER_SAVE, PHOTO_STRIPPED, PREVIEW, ProfilePhotoEditor, photoInfoLines, type ProfilePhotoMode, type ProfilePhotoStage } from '../ProfilePhotoPresentation';
import { sys } from '../../system/tokens';

let tree: ReactTestRenderer;
const noop = () => {};
const draw = async (stage: ProfilePhotoStage | null, mode: ProfilePhotoMode = 'pick', extra: Partial<React.ComponentProps<typeof ProfilePhotoEditor>> = {}) => {
  await act(async () => { tree = create(<ProfilePhotoEditor onBack={noop} stage={stage} notice={null} error={null} permissionDenied={false} mode={mode}
    retryable={false} running={null} canAct waiting={false} hasPhoto onLibrary={noop} onCamera={noop} onRemove={noop} onApply={noop} onDiscard={noop}
    onRetry={noop} onCheck={noop} {...extra} />); });
};
afterEach(async () => { await act(async () => tree?.unmount()); });
const words = () => tree.root.findAll(node => (node.type as unknown) === 'Text').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const photo = () => tree.root.findByType('AuthorizedPhoto' as unknown as React.ElementType);

describe('the circle', () => {
  it('is a circle: as wide as it is high, with its own aspect ratio of 1 that overrides the 4:3 of the frame it is drawn in', async () => {
    await draw({ kind: 'photo', assetId: 'asset-1', staged: false });
    const style = StyleSheet.flatten(photo().props.style);
    expect(style).toMatchObject({ width: PREVIEW, height: PREVIEW, aspectRatio: 1 });
    expect(style.borderRadius).toBeGreaterThanOrEqual(PREVIEW / 2);
    expect(PHOTO_CIRCLE.aspectRatio).toBe(1);
  });

  it('asks for the saved photograph to be remembered, because it is the person\'s own, but not for a chosen picture that is not saved yet', async () => {
    await draw({ kind: 'photo', assetId: 'asset-1', staged: false });
    expect(photo().props.own).toBe(true);
    await act(async () => tree.unmount());
    await draw({ kind: 'photo', assetId: 'asset-2', staged: true }, 'staged');
    expect(photo().props.own).toBe(false);
  });

  it('stands in for the picture while it is on its way with the person\'s initials in a circle, not with a grey slab and a spinner', async () => {
    await draw({ kind: 'photo', assetId: 'asset-1', staged: false }, 'pick', { initials: 'MŠ' });
    const pending = photo().props.pending as React.ReactElement;
    await act(async () => { tree.update(<>{pending}</>); });
    expect(words()).toContain('MŠ');
    const disc = tree.root.findAll(node => { const style = StyleSheet.flatten(node.props.style); return style?.width === PREVIEW && style?.height === PREVIEW; })[0];
    expect(StyleSheet.flatten(disc.props.style)).toMatchObject({ width: PREVIEW, height: PREVIEW, aspectRatio: 1 });
  });

  it('draws the same circle of letters while the profile is read, and a person when there are no letters', async () => {
    await draw({ kind: 'loading' }, 'pick', { initials: 'MŠ', canAct: false });
    expect(words()).toContain('MŠ');
    await act(async () => tree.update(<ProfilePhotoEditor onBack={noop} stage={{ kind: 'loading' }} notice={null} error={null} permissionDenied={false} mode="pick"
      retryable={false} running={null} canAct={false} waiting={false} hasPhoto={false} onLibrary={noop} onCamera={noop} onRemove={noop} onApply={noop}
      onDiscard={noop} onRetry={noop} onCheck={noop} initials={null} />));
    expect(words()).not.toContain('MŠ');
    expect(tree.root.findAll(node => node.props.kind === 'person').length).toBeGreaterThan(0);
  });

  it('draws no letters for a picture that cannot be read: that is a failure, not a person without a photo', async () => {
    await draw({ kind: 'unavailable' }, 'reconcile', { initials: 'MŠ' });
    expect(words()).not.toContain('MŠ');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Fotografija trenutno nije dostupna.').length).toBeGreaterThan(0);
  });
});

describe('the actions', () => {
  it('stand in one column with the same width: the red removal is not indented under the two above it', async () => {
    await draw({ kind: 'photo', assetId: 'asset-1', staged: false }, 'pick');
    const labels = ['Izaberi iz galerije', 'Fotografiši', 'Ukloni fotografiju profila'];
    // The column of the three actions: the one view with the screen's gap that holds all of them.
    const column = tree.root.findAll(node => (node.type as unknown) === 'View' && StyleSheet.flatten(node.props.style)?.gap === sys.space.sm)
      .find(node => labels.every(label => node.findAll(inner => inner.props.accessibilityLabel === label).length > 0));
    expect(column).toBeTruthy();
    // No view between the column and the removal places it at the start of the row (that was what indented it).
    const placed = column!.findAll(node => (node.type as unknown) === 'View' && StyleSheet.flatten(node.props.style)?.alignSelf === 'flex-start'
      && node.findAll(inner => inner.props.accessibilityLabel === labels[2]).length > 0);
    expect(placed).toHaveLength(0);
    for (const label of labels) {
      const button = column!.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label)[0];
      expect([label, StyleSheet.flatten(button.props.style)?.alignSelf]).not.toEqual([label, 'flex-start']);
    }
  });

  it('offers the removal only when there is a photo to remove', async () => {
    await draw({ kind: 'none' }, 'pick', { hasPhoto: false });
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Ukloni fotografiju profila')).toHaveLength(0);
  });
});

describe('the explanation', () => {
  const bar = () => tree.root.findAll(node => node.props.testID === 'photo-info' && Array.isArray(node.props.info))[0];
  it('is behind the "ⓘ" in the bar: the size and what is removed before sending; there is no lock and no note under the buttons', async () => {
    await draw({ kind: 'none' }, 'pick');
    expect(PHOTO_LIMIT).toBe('Najviše 10 MB.'); expect(PHOTO_STRIPPED).toBe('Pre slanja uklanjamo podatke o mestu i vremenu snimanja.');
    expect(bar().props.info).toEqual([PHOTO_LIMIT, PHOTO_STRIPPED]); expect(bar().props.title).toBe('Fotografija profila');
    expect(words()).not.toContain('Pre slanja'); expect(words()).not.toContain('MB');
    expect(tree.root.findAll(node => node.props.kind === 'lock')).toHaveLength(0);
    expect(words()).not.toContain('Sačuvaj fotografiju');
  });

  it('says when others see a new picture only once one has been chosen, because only then the screen has that button, and only behind the "ⓘ"', async () => {
    await draw({ kind: 'photo', assetId: 'asset-1', staged: true }, 'staged');
    expect(photoInfoLines(true)).toEqual([PHOTO_STRIPPED, PHOTO_SEEN_AFTER_SAVE]);
    expect(bar().props.info).toEqual([PHOTO_STRIPPED, PHOTO_SEEN_AFTER_SAVE]);
    expect(words()).not.toContain(PHOTO_SEEN_AFTER_SAVE);
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Sačuvaj fotografiju').length).toBeGreaterThan(0);
  });
});
