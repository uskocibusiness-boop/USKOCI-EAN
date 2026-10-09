import React from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AuthorizedPhoto } from '../AuthorizedPhoto';

let mockFocused = true;
let mockSession: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
const mockRead = jest.fn();
jest.mock('../../../data/mediaClientService', () => ({ mediaClientService: { readMedia: (...args: unknown[]) => mockRead(...args) } }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(
  () => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('expo-image', () => ({ Image: 'NativeImage' }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/FactArt', () => ({ FactArt: 'FactArt' }));

type Props = React.ComponentProps<typeof AuthorizedPhoto>;
const initial: Props = { assetId: 'asset-a', agreementId: 'agreement-a', messageId: 'message-a', label: 'Fotografija poruke 1' };
const failure = { ok: false, kod: 'MEDIA_UNAVAILABLE', poruka: 'Nije dostupno.' };
const success = () => ({ ok: true, podatak: { assetId: 'asset-a', contentType: 'image/jpeg', bytes: new Uint8Array([255, 216, 255, 217]).buffer } });
const deferred = () => {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAllByType(type as React.ElementType);
const retry = () => tree.root.findByProps({ accessibilityLabel: `Pokušaj ponovo · ${initial.label}` }).props.onPress as () => void;
const signal = (call = mockRead.mock.calls.length - 1): AbortSignal => mockRead.mock.calls[call][2].signal;
const render = async (props: Partial<Props> = {}) => act(async () => { tree = create(<AuthorizedPhoto {...initial} {...props} />); });
const update = async (props: Partial<Props> = {}) => act(async () => tree.update(<AuthorizedPhoto {...initial} {...props} />));

beforeEach(() => {
  mockRead.mockReset().mockResolvedValue(success()); mockFocused = true;
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('reads the exact Agreement/message context into a non-cached image without retrying ordinary rerenders', async () => {
  await render();
  expect(mockRead).toHaveBeenCalledWith('asset-a', { agreementId: 'agreement-a', messageId: 'message-a' }, { signal: expect.anything() });
  expect(host('NativeImage')[0].props).toMatchObject({ cachePolicy: 'none', accessible: true, transition: 0,
    source: { uri: expect.stringMatching(/^data:image\/jpeg;base64,/) }, style: { width: '100%', height: '100%' } });
  await update({ label: 'Nova oznaka', style: { width: 96, height: 96 } });
  expect(mockRead).toHaveBeenCalledTimes(1); expect(host('Press')).toHaveLength(0);
});

it('retries a failed read only on explicit press and recovers the same private photo', async () => {
  mockRead.mockResolvedValueOnce(failure); await render();
  expect(host('NativeImage')).toHaveLength(0);
  expect(host('Press')[0].props).toMatchObject({ accessibilityRole: 'button',
    accessibilityHint: expect.stringContaining('Fotografija trenutno nije dostupna'),
    style: expect.objectContaining({ minHeight: 48 }) });
  await update(); expect(mockRead).toHaveBeenCalledTimes(1);
  const firstSignal = signal(); await act(async () => retry()());
  expect(firstSignal.aborted).toBe(true); expect(signal().aborted).toBe(false);
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockRead.mock.calls[1].slice(0, 2)).toEqual(mockRead.mock.calls[0].slice(0, 2));
  expect(host('NativeImage')).toHaveLength(1); expect(host('Press')).toHaveLength(0);
});

it('reserves one retry synchronously across rapid and retained presses', async () => {
  const held = deferred(); mockRead.mockResolvedValueOnce(failure).mockReturnValueOnce(held.promise);
  await render(); const press = retry();
  await act(async () => { press(); press(); press(); });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(host('ActivityIndicator')).toHaveLength(1); expect(host('Press')).toHaveLength(0);
  await act(async () => held.resolve(failure));
  await act(async () => press()); expect(mockRead).toHaveBeenCalledTimes(2);
  await act(async () => retry()()); expect(mockRead).toHaveBeenCalledTimes(3); expect(host('NativeImage')).toHaveLength(1);
});

it.each(['reject', 'throw'])('turns a %s from the reader into explicit recovery without exposing its error', async mode => {
  if (mode === 'reject') mockRead.mockRejectedValueOnce(new Error('private transport detail'));
  else mockRead.mockImplementationOnce(() => { throw new Error('private transport detail'); });
  await render(); expect(host('NativeImage')).toHaveLength(0); expect(retry()).toEqual(expect.any(Function));
  expect(JSON.stringify(tree.toJSON())).not.toContain('private transport detail');
  await act(async () => retry()()); expect(host('NativeImage')).toHaveLength(1);
});

it('recovers native image decode errors and ignores an old image error during and after retry', async () => {
  await render(); const onError = host('NativeImage')[0].props.onError;
  await act(async () => onError({ error: 'native decoder detail' }));
  expect(host('NativeImage')).toHaveLength(0); expect(JSON.stringify(tree.toJSON())).not.toContain('native decoder detail');
  const held = deferred(); mockRead.mockReturnValueOnce(held.promise);
  await act(async () => retry()());
  await act(async () => onError({ error: 'queued old event' }));
  expect(host('ActivityIndicator')).toHaveLength(1); expect(host('Press')).toHaveLength(0);
  await act(async () => held.resolve(success()));
  await act(async () => onError({ error: 'queued old event' }));
  expect(host('NativeImage')).toHaveLength(1); expect(host('Press')).toHaveLength(0); expect(mockRead).toHaveBeenCalledTimes(2);
});

it('retires a retry across blur/refocus and ignores its late rejection without clearing the fresh request', async () => {
  const old = deferred(), fresh = deferred();
  mockRead.mockResolvedValueOnce(failure).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  await render(); const press = retry(); await act(async () => press()); const oldSignal = signal();
  mockFocused = false; await update(); expect(oldSignal.aborted).toBe(true);
  await act(async () => press()); expect(mockRead).toHaveBeenCalledTimes(2); expect(host('NativeImage')).toHaveLength(0);
  mockFocused = true; await update(); expect(mockRead).toHaveBeenCalledTimes(3);
  await act(async () => old.reject(new Error('retired read')));
  expect(host('Press')).toHaveLength(0); expect(host('ActivityIndicator')).toHaveLength(1); expect(signal().aborted).toBe(false);
  await act(async () => fresh.resolve(success())); expect(host('NativeImage')).toHaveLength(1);
});

it('rejects a retained retry after an account changes before React rerenders', async () => {
  mockRead.mockResolvedValueOnce(failure); await render(); const press = retry();
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  await act(async () => press()); expect(mockRead).toHaveBeenCalledTimes(1);
});

it('rejects late success for an old account revision even after the same account returns', async () => {
  const old = deferred(), middle = deferred(), fresh = deferred();
  mockRead.mockReturnValueOnce(old.promise).mockReturnValueOnce(middle.promise).mockReturnValueOnce(fresh.promise);
  await render(); const oldSignal = signal();
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
  mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
  expect(oldSignal.aborted).toBe(true);
  await act(async () => { old.resolve(success()); middle.resolve(success()); });
  expect(host('NativeImage')).toHaveLength(0); expect(host('ActivityIndicator')).toHaveLength(1);
  await act(async () => fresh.resolve(success())); expect(host('NativeImage')).toHaveLength(1);
});

it('hides an existing image on logout and cannot read again through an old retry', async () => {
  mockRead.mockResolvedValueOnce(failure); await render(); const press = retry();
  await act(async () => press()); expect(host('NativeImage')).toHaveLength(1);
  mockSession = { user: null, accountRevision: 2 }; await update();
  expect(host('NativeImage')).toHaveLength(0); expect(signal().aborted).toBe(true);
  await act(async () => press()); expect(mockRead).toHaveBeenCalledTimes(2);
});

it.each(['assetId', 'agreementId', 'messageId'] as const)('retires pending bytes and callbacks when %s changes', async field => {
  const old = deferred(), fresh = deferred();
  mockRead.mockResolvedValueOnce(failure).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  await render(); const press = retry(); await act(async () => press()); const oldSignal = signal();
  await update({ [field]: `${field}-b` }); expect(oldSignal.aborted).toBe(true);
  await act(async () => { press(); old.resolve(success()); });
  expect(mockRead).toHaveBeenCalledTimes(3); expect(host('NativeImage')).toHaveLength(0);
  await act(async () => fresh.resolve(success())); expect(host('NativeImage')).toHaveLength(1);
});

it('aborts on unmount and ignores subsequent completion and retained retry', async () => {
  const held = deferred(); mockRead.mockResolvedValueOnce(failure).mockReturnValueOnce(held.promise);
  await render(); const press = retry(); await act(async () => press()); const currentSignal = signal();
  await act(async () => tree.unmount()); expect(currentSignal.aborted).toBe(true);
  await act(async () => { press(); held.resolve(success()); }); expect(mockRead).toHaveBeenCalledTimes(2);
});

it('preserves custom avatar fallbacks without adding a hidden retry or opening target', async () => {
  mockRead.mockResolvedValueOnce(failure);
  await render({ unavailable: <View testID="initials" />, open: { label: 'Otvori portret', onPress: jest.fn() } });
  expect(tree.root.findByProps({ testID: 'initials' })).toBeTruthy(); expect(host('Press')).toHaveLength(0);
});

it('offers the open action only for a loaded image and cannot open through its retired native-error state', async () => {
  const open = { label: 'Otvori fotografiju', hint: 'Prikaz preko celog ekrana', onPress: jest.fn() };
  const held = deferred(); mockRead.mockReturnValueOnce(held.promise); await render({ open });
  expect(host('Press')).toHaveLength(0);
  await act(async () => held.resolve(success()));
  expect(host('NativeImage')[0].props.accessible).toBe(false);
  const action = host('Press')[0].props;
  expect(action).toMatchObject({ accessibilityLabel: open.label, accessibilityHint: open.hint,
    style: { width: '100%', height: '100%' } });
  await act(async () => action.onPress()); expect(open.onPress).toHaveBeenCalledTimes(1);
  await act(async () => { host('NativeImage')[0].props.onError({ error: 'decode failed' }); action.onPress(); });
  expect(open.onPress).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: open.label })).toHaveLength(0);
  expect(retry()).toEqual(expect.any(Function));
});

it('retires image-open callbacks when the parent action, account or focus changes', async () => {
  const open = { label: 'Otvori fotografiju', onPress: jest.fn() };
  await render({ open }); const oldPress = host('Press')[0].props.onPress;
  const replacement = { label: 'Otvori novi pregled', onPress: jest.fn() };
  await update({ open: replacement }); await act(async () => oldPress());
  expect(open.onPress).not.toHaveBeenCalled(); expect(mockRead).toHaveBeenCalledTimes(1);
  const currentPress = host('Press')[0].props.onPress;
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  await act(async () => currentPress()); expect(replacement.onPress).not.toHaveBeenCalled();
  mockFocused = false; await update({ open: replacement });
  await act(async () => currentPress()); expect(replacement.onPress).not.toHaveBeenCalled();
});


it('the actual loaded-photo press owns long-press support and retires it with its authorization',async()=>{
 const open={label:'Otvori fotografiju',onPress:jest.fn(),onLongPress:jest.fn()};await render({open});
 const hold=host('Press')[0].props.onLongPress;await act(async()=>hold());
 expect(open.onLongPress).toHaveBeenCalledTimes(1);expect(open.onPress).not.toHaveBeenCalled();
 mockSession={...mockSession,accountRevision:2};await act(async()=>hold());expect(open.onLongPress).toHaveBeenCalledTimes(1);
 await update({open});const nextHold=host('Press')[0].props.onLongPress;
 await act(async()=>host('NativeImage')[0].props.onError({error:'decode'}));
 await act(async()=>nextHold());expect(open.onLongPress).toHaveBeenCalledTimes(1);
 expect(host('Press')[0].props.onLongPress).toBeUndefined();
});
