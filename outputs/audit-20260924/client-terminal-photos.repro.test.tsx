import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OutboxSnapshot } from '../../src/data/agreementOutbox';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../src/ui/Text', () => ({ T: 'T' }));
jest.mock('../../src/ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../src/ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../src/ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../src/data/supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementChat } from '../../src/ui/AgreementChat';

const account = '10000000-0000-4000-8000-000000000001';
const agreement = '20000000-0000-4000-8000-000000000001';
const command = { accountId: account, agreementId: agreement, clientMessageId: 'poruka_retry_123', body: 'Stižem uskoro.' };
const outbox = { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined) } as any;
let state: OutboxSnapshot;
let tree: ReactTestRenderer;
let props: React.ComponentProps<typeof AgreementChat>;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
// Review r4 rd item 2: a bubble is heard as the message itself ("Ti: <tekst>, Danas, 12:00"); it was "Poruka: <ime>", which
// hid the text and the time. A bubble is found by who wrote it, the start of that label.
const held = (who: string) => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string'
  && node.props.accessibilityLabel.startsWith(`${who}: `))[0];
const scrollToEnd = jest.fn();
async function render(overrides: Partial<typeof props> = {}) {
  await act(async () => { tree = create(<AgreementChat {...props} {...overrides} />, {
    createNodeMock: element => element.type === ('ScrollView' as any) ? { scrollToEnd } : null,
  }); });
}
beforeEach(() => {
  jest.clearAllMocks();
  state = { phase: 'ready', draft: 'Nova poruka', capturing: false, entries: [], error: null };
  props = { messages: [], loading: false, error: false, writable: true, terminal: false,
    refresh: jest.fn().mockResolvedValue(undefined), refreshWorkspace: jest.fn().mockResolvedValue(undefined), outbox, state };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

// Real AgreementChat + AgreementPhotoComposer; only IO/media rendered pixels are mocked.
it('AUDIT CF02: closing an Agreement keeps cancellation of its unsent photo reachable', async () => {
  const assetId = '40000000-0000-4000-8000-000000000001';
  const ref = { agreementId: agreement, agreementVersion: 1, clientRequestId: '50000000-0000-4000-8000-000000000001' };
  const photos = { agreementId: agreement, loaded: true, busy: false, ready: true, hasSelection: true, saved: [],
    message: null, versionConflict: false, available: true, reserved: () => false, canRetry: () => false,
    items: [{ ref, receipt: { state: 'READY', assetId, attachedMessageId: null, photo: { assetId, width: 800, height: 600 } } }],
    remove: jest.fn(), refresh: jest.fn(), canSubmit: () => false } as any;
  await render({ photos });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ukloni pripremljenu fotografiju 1' }).length).toBeGreaterThan(0);
  await act(async () => tree.update(<AgreementChat {...props} photos={{ ...photos, available: false }} terminal writable={false} />));
  // It is correct to remove the NEW message composer; cancellation of this already prepared upload is still allowed.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ukloni pripremljenu fotografiju 1' }).length).toBeGreaterThan(0);
});
