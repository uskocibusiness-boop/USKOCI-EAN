import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readBuildIdentity } from '../buildIdentity';
import { BuildIdentity } from '../../ui/BuildIdentity';

const mockConfig = { schemaVersion: 1, version: '1.0.0', sourceCommit: 'a'.repeat(40), sourceDirty: false, backendTarget: 'local',
  runtimeVersion: 'uskoci-v1-preview-r1', updateChannel: 'preview' };
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { extra: { uskociBuild: mockConfig } }; } } }));
const mockLaunch = { embedded: false };
jest.mock('expo-updates', () => ({ runtimeVersion: 'uskoci-v1-preview-r1', channel: 'preview', updateId: '12345678-1234-4234-8234-123456789abc',
  get isEmbeddedLaunch() { return mockLaunch.embedded; } }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'Pressable', 'Text'].includes(String(key)) ? key : Reflect.get(target, key); } });
});

it('uses only the explicitly supported public identity fields', () => {
  expect(readBuildIdentity({ ...mockConfig, secret: 'private', backendRelease: 'untrusted-live-claim' })).toEqual({
    version: '1.0.0', sourceCommit: 'a'.repeat(40), sourceDirty: false, backendTarget: 'local',
    runtimeVersion: 'uskoci-v1-preview-r1', updateChannel: 'preview',
  });
});
it.each([null, {}, { ...mockConfig, schemaVersion: 2 }])('does not invent identity when unavailable: %p', raw => {
  expect(readBuildIdentity(raw)).toEqual({ version: null, sourceCommit: null, sourceDirty: null, backendTarget: 'unconfigured', runtimeVersion: null, updateChannel: null });
});
it('refuses unbounded identity or endpoint fields rather than echoing arbitrary config', () => {
  expect(readBuildIdentity({ schemaVersion: 1, version: '1'.repeat(100) + '.2.3', sourceCommit: 'private-token', sourceDirty: 'false', backendTarget: 'https://private' }))
    .toEqual({ version: null, sourceCommit: null, sourceDirty: null, backendTarget: 'unconfigured', runtimeVersion: null, updateChannel: null });
});
it('expands in place with an accessible button and no account or network mutation', async () => {
  let tree!: ReactTestRenderer;
  try {
    await act(async () => { tree = create(<BuildIdentity />); });
    const button = () => tree.root.findByType('Pressable' as React.ElementType);
    expect(button().props.accessibilityState).toEqual({ expanded: false });
    expect(JSON.stringify(tree.toJSON())).not.toContain('Lokalno test okruženje');
    await act(async () => button().props.onPress());
    expect(button().props.accessibilityState).toEqual({ expanded: true });
    expect(JSON.stringify(tree.toJSON())).toContain('Lokalno test okruženje');
    expect(JSON.stringify(tree.toJSON())).toContain('a'.repeat(40));
    expect(JSON.stringify(tree.toJSON())).toContain('uskoci-v1-preview-r1');
    expect(JSON.stringify(tree.toJSON())).toContain('preview');
    expect(JSON.stringify(tree.toJSON())).toContain('OTA ažuriranje · 12345678');
    await act(async () => button().props.onPress());
    expect(button().props.accessibilityState).toEqual({ expanded: false });
  } finally { await act(async () => tree?.unmount()); }
});
it('names the embedded bundle as such even though it carries its own update id', async () => {
  let tree!: ReactTestRenderer;
  mockLaunch.embedded = true;
  try {
    await act(async () => { tree = create(<BuildIdentity />); });
    await act(async () => tree.root.findByType('Pressable' as React.ElementType).props.onPress());
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('ugrađena verzija · 12345678');
    expect(text).not.toContain('OTA ažuriranje');
  } finally { mockLaunch.embedded = false; await act(async () => tree?.unmount()); }
});
