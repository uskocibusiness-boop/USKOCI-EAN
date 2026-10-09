import React, { type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AgreementPhotosController } from '../../hooks/useAgreementPhotos';
import type { AgreementPhotoUpload } from '../agreementPhotoClientService';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementChat } from '../../ui/AgreementChat';

const account = '10000000-0000-4000-8000-000000000001', agreement = '20000000-0000-4000-8000-000000000001';
const request = '30000000-0000-4000-8000-000000000001', asset = '40000000-0000-4000-8000-000000000001';
const ref = { agreementId: agreement, agreementVersion: 2, clientRequestId: request };
const receipt: AgreementPhotoUpload = { ...ref, accountId: account, assetId: asset, state: 'READY', attachedMessageId: null,
  photo: { assetId: asset, width: 1600, height: 900, byteSize: 30, contentType: 'image/jpeg' }, authoritative: true };
type Props = ComponentProps<typeof AgreementChat>;
let tree: ReactTestRenderer, photos: AgreementPhotosController, props: Props;
const sendDraft = jest.fn().mockResolvedValue(undefined);
const buttons = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label });
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async () => act(async () => { tree = create(<AgreementChat {...props} photos={photos} />); });
const close = async () => act(async () => { tree.update(<AgreementChat {...props} photos={photos} terminal writable={false} />); });
beforeEach(() => {
  jest.clearAllMocks();
  photos = { agreementId: agreement, loaded: true, busy: false, items: [{ ref, receipt }], saved: [], message: null,
    available: true, hasSelection: true, selected: [{ ref, receipt }], versionConflict: false, ready: true,
    capture: jest.fn(() => ({ agreementVersion: 2, assetIds: [asset] })), canSubmit: () => true,
    preview: () => undefined, reserved: () => false, canRetry: () => true, refresh: jest.fn().mockResolvedValue(undefined), pick: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined), restore: jest.fn().mockResolvedValue(undefined) };
  props = { messages: [], loading: false, error: false, terminal: false, writable: true,
    refresh: jest.fn().mockResolvedValue(undefined), refreshWorkspace: jest.fn().mockResolvedValue(undefined),
    outbox: { setDraft: jest.fn(), sendDraft, retry: jest.fn(), start: jest.fn() } as unknown as Props['outbox'],
    state: { phase: 'ready', draft: 'Poruka', capturing: false, entries: [], error: null } };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each(['READY', 'PROCESSING', 'unknown'] as const)('retains exact %s photo recovery when an active Agreement closes, without new-photo commands', async state => {
  photos.items = [{ ref, receipt: state === 'unknown' ? null : { ...receipt, state, photo: state === 'READY' ? receipt.photo : null } }];
  await render();
  expect(buttons('Ukloni pripremljenu fotografiju 1')).toHaveLength(1);
  const retainedSend = button('Pošalji poruku').props.onPress;
  await close();
  expect(buttons('Ukloni pripremljenu fotografiju 1')).toHaveLength(1);
  expect(buttons('Osveži fotografije poruke')).toHaveLength(1);
  for (const label of ['Napiši poruku', 'Pošalji poruku', 'Dodaj fotografije', 'Galerija',
    'Kamera', 'Pošalji ponovo · fotografija 1']) expect(buttons(label)).toHaveLength(0);
  await act(async () => {
    button('Ukloni pripremljenu fotografiju 1').props.onPress();
    button('Osveži fotografije poruke').props.onPress(); retainedSend();
  });
  expect(photos.remove).toHaveBeenCalledWith(ref); expect(photos.refresh).toHaveBeenCalledTimes(1);
  expect(photos.pick).not.toHaveBeenCalled(); expect(photos.retry).not.toHaveBeenCalled(); expect(sendDraft).not.toHaveBeenCalled();
  // A command is not proof of cancellation; the receipt remains until the controller retires it.
  expect(buttons('Ukloni pripremljenu fotografiju 1')).toHaveLength(1);
  photos = { ...photos, items: [], selected: [], hasSelection: false }; await close();
  expect(buttons('Osveži fotografije poruke')).toHaveLength(0);
});

it('restores only an existing saved upload into recovery after closure', async () => {
  photos = { ...photos, items: [], selected: [], hasSelection: false, saved: [receipt] };
  await render(); await close();
  await act(async () => button('Prikaži ranije pripremljene fotografije').props.onPress());
  await act(async () => button('Prikaži ranije pripremljenu fotografiju 1').props.onPress());
  expect(photos.restore).toHaveBeenCalledWith(request);
  expect(photos.pick).not.toHaveBeenCalled(); expect(photos.retry).not.toHaveBeenCalled(); expect(sendDraft).not.toHaveBeenCalled();
});

it('keeps terminal photo-read failure and refresh visible until an authoritative empty result', async () => {
  photos = { ...photos, items: [], selected: [], saved: [], hasSelection: false, loaded: false,
    message: 'Sačuvani izbor nije učitan. Osveži fotografije.' };
  await render(); await close();
  expect(texts()).toContain(photos.message);
  await act(async () => button('Osveži fotografije poruke').props.onPress());
  expect(photos.refresh).toHaveBeenCalledTimes(1);
  for (const label of ['Ukloni pripremljenu fotografiju 1', 'Galerija', 'Kamera', 'Pošalji poruku']) {
    expect(buttons(label)).toHaveLength(0);
  }
  expect(photos.restore).not.toHaveBeenCalled(); expect(photos.pick).not.toHaveBeenCalled(); expect(sendDraft).not.toHaveBeenCalled();
  photos = { ...photos, loaded: true, message: null }; await close();
  expect(buttons('Osveži fotografije poruke')).toHaveLength(0);
});

it('keeps outbox-reserved photo recovery visible without permitting removal or upload retry', async () => {
  photos = { ...photos, hasSelection: false, selected: [], reserved: () => true };
  await render(); await close();
  expect(texts()).toContain('Fotografija je uz poruku. Prvo proveri da li je poslata.');
  expect(buttons('Osveži fotografije poruke')).toHaveLength(1);
  expect(buttons('Ukloni pripremljenu fotografiju 1')).toHaveLength(0);
  expect(buttons('Pošalji ponovo · fotografija 1')).toHaveLength(0);
});

it.each(['busy', 'capturing'] as const)('keeps recovery disabled while %s', async reason => {
  photos = { ...photos, busy: reason === 'busy', saved: [{ ...receipt, clientRequestId: `${request.slice(0, -1)}2` }] };
  props.state = { ...props.state, capturing: reason === 'capturing' };
  await render(); await close();
  for (const label of ['Ukloni pripremljenu fotografiju 1', 'Osveži fotografije poruke', 'Prikaži ranije pripremljene fotografije']) {
    expect(button(label).props.disabled).toBe(true);
  }
});

it.each(['empty', 'attached', 'CANCELLED', 'FAILED'] as const)('does not reopen photo tools for %s history alone', async state => {
  photos = { ...photos, hasSelection: false, selected: [], message: 'Ranija poruka o izboru fotografije.', items: state === 'empty' ? [] : [{ ref,
    receipt: state === 'attached' ? { ...receipt, attachedMessageId: request } : { ...receipt, state, photo: null } }] };
  await render(); await close();
  for (const label of ['Ukloni pripremljenu fotografiju 1', 'Osveži fotografije poruke', 'Galerija']) expect(buttons(label)).toHaveLength(0);
});
