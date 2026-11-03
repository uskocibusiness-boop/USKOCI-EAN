import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readPublicSupabaseConfig } from '../../../data/publicSupabaseConfig';
import { useHoldToTalk } from '../useHoldToTalk';
import type { VoiceSession } from '../holdToTalk';
import type { SpeechAdapterOptions } from '../nativeSpeechAdapter';

const ACCOUNT = 'aaaaaaaa-1111-4111-8111-111111111111';
const CONVERSATION = 'bbbbbbbb-2222-4222-8222-222222222222';
let mockAccountId = ACCOUNT, mockRevision = 7, mockToken: string | null = 'owned-access-token';
let mockSpeechAdapterOptions: SpeechAdapterOptions | null = null;

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return {
      currentState: 'active', addEventListener: () => ({ remove: () => undefined }),
    };
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../../store/sesija', () => ({
  useSesija: () => ({ user: { id: mockAccountId }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccountId }, accountRevision: mockRevision,
    session: mockToken ? { access_token: mockToken } : null }),
}));
jest.mock('../../../data/supabaseClient', () => ({
  supabaseKonfigurisan: () => false,
  supabaseKlijent: () => { throw new Error('UNEXPECTED_AUTH_CLIENT'); },
}));
jest.mock('../../../lib/idempotencija', () => ({
  noviUuidZahtevId: () => 'cccccccc-3333-4333-8333-333333333333',
}));
jest.mock('../nativeSpeechAdapter', () => ({
  createNativeSpeechAdapter: (options: SpeechAdapterOptions) => {
    mockSpeechAdapterOptions = options;
    return { requestPermission: jest.fn(), createCapture: jest.fn() };
  },
}));
jest.mock('../holdToTalk', () => ({
  HoldToTalkController: jest.fn().mockImplementation(() => {
    const snapshot = { phase: 'IDLE' };
    return {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      contextChanged: () => undefined,
      setForeground: () => undefined,
      cancel: () => undefined,
    };
  }),
}));

function Probe() {
  useHoldToTalk({ conversationId: CONVERSATION, onTranscript: () => true });
  return null;
}
function ownedSession(patch: Partial<VoiceSession> = {}): VoiceSession {
  return { accountId: ACCOUNT, accountRevision: 7, conversationId: CONVERSATION,
    generation: 1, gestureId: 'gesture', startedAt: 0, mode: 'hold', ...patch };
}
async function connection(session = ownedSession(), signal = new AbortController().signal) {
  if (!mockSpeechAdapterOptions) throw new Error('VOICE_CONNECTION_NOT_MOUNTED');
  return mockSpeechAdapterOptions.getConnection(session, signal);
}

let renderer: ReactTestRenderer | null = null;
const savedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const savedKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  mockSpeechAdapterOptions = null;
  mockAccountId = ACCOUNT; mockRevision = 7; mockToken = 'owned-access-token';
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  renderer = null;
});
afterAll(() => {
  if (savedUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = savedUrl;
  if (savedKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = savedKey;
});
async function mount() {
  await act(async () => { renderer = create(<Probe />); });
}

describe('hold-to-talk uses the same public backend authority as Auth and other clients', () => {
  it('inherits the exact canonical DEV pair when both public Expo variables are absent', async () => {
    await mount();
    const expected = readPublicSupabaseConfig();
    expect(expected).not.toBeNull();
    expect(await connection()).toEqual({ ...expected, accessToken: 'owned-access-token' });
  });
  it('uses normalized complete custom public config without falling back to DEV', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = ' https://voice.example.test/ ';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ' test-public-key ';
    await mount();
    expect(await connection()).toEqual({
      url: 'https://voice.example.test', anonKey: 'test-public-key', accessToken: 'owned-access-token',
    });
  });
  it.each(['URL_ONLY', 'KEY_ONLY', 'EMPTY_KEY', 'UNSAFE_URL'])(
    'rejects partial or invalid public configuration: %s', async variant => {
      if (variant === 'URL_ONLY' || variant === 'UNSAFE_URL')
        process.env.EXPO_PUBLIC_SUPABASE_URL = variant === 'UNSAFE_URL'
          ? 'http://other.example.test' : 'https://voice.example.test';
      if (variant === 'KEY_ONLY' || variant === 'EMPTY_KEY')
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = variant === 'EMPTY_KEY' ? ' ' : 'test-public-key';
      await mount();
      expect(await connection()).toBeNull();
    },
  );
  it('never exposes a token to stale account, revision, conversation or aborted gesture', async () => {
    await mount();
    expect(await connection(ownedSession({ accountId: 'different-account' }))).toBeNull();
    expect(await connection(ownedSession({ accountRevision: 6 }))).toBeNull();
    expect(await connection(ownedSession({ conversationId: 'different-conversation' }))).toBeNull();
    const stopped = new AbortController(); stopped.abort();
    expect(await connection(ownedSession(), stopped.signal)).toBeNull();
    mockToken = null;
    expect(await connection()).toBeNull();
  });
});
