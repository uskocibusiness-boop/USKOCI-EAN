// Voice messages B2-a (2026-10-01): the device file seam touches only the app's private cache and only plain leaves.
const mockStore = { files: new Map<string, Uint8Array>(), dirs: new Set<string>(), deleted: [] as string[], failDelete: false };
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) => parts.map(part => (typeof part === 'string' ? part : (part as { uri: string }).uri))
    .reduce((left, right) => left + (left.endsWith('/') || right.startsWith('/') ? '' : '/') + right);
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return mockStore.dirs.has(this.uri); }
    create() { mockStore.dirs.add(this.uri); }
    delete() {
      if (mockStore.failDelete) throw new Error('DELETE');
      mockStore.dirs.delete(this.uri); mockStore.deleted.push(this.uri);
      for (const key of [...mockStore.files.keys()]) if (key.startsWith(this.uri + '/')) mockStore.files.delete(key);
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return mockStore.files.has(this.uri); }
    get size() { return mockStore.files.get(this.uri)?.byteLength ?? 0; }
    async arrayBuffer() { const bytes = mockStore.files.get(this.uri)!; return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }
    create(options?: { overwrite?: boolean }) { if (options?.overwrite || !mockStore.files.has(this.uri)) mockStore.files.set(this.uri, new Uint8Array(0)); }
    write(content: Uint8Array) { mockStore.files.set(this.uri, content); }
    delete() { mockStore.files.delete(this.uri); mockStore.deleted.push(this.uri); }
  }
  return { Directory, File, Paths: { cache: new Directory('file:///cache/') } };
});
import { nativeVoiceFiles, purgeVoiceFiles, VOICE_CACHE_DIRECTORY, VOICE_FILE_MAX_BYTES } from '../nativeVoiceFiles';

const root = 'file:///cache/', voiceDirectory = root + VOICE_CACHE_DIRECTORY;
const bytesOf = (...values: number[]) => new Uint8Array(values).buffer;
beforeEach(() => { mockStore.files.clear(); mockStore.dirs.clear(); mockStore.deleted.length = 0; mockStore.failDelete = false; });

it('writes a downloaded message into the private voice directory and returns exactly that file', async () => {
  const uri = await nativeVoiceFiles.writeTemp('voice-abc.m4a', bytesOf(1, 2, 3, 4));
  expect(uri).toBe(`${voiceDirectory}/voice-abc.m4a`); expect(mockStore.dirs.has(voiceDirectory)).toBe(true);
  expect([...mockStore.files.get(uri)!]).toEqual([1, 2, 3, 4]);
});
it.each(['', '.', '..', '../escape.m4a', 'a/b.m4a', 'a\\b.m4a', 'with space.m4a', '.hidden', '%2e%2e', 'x'.repeat(97)])('refuses the unsafe leaf %j and writes nothing', async name => {
  await expect(nativeVoiceFiles.writeTemp(name, bytesOf(1))).rejects.toThrow('VOICE_FILE_NAME'); expect(mockStore.files.size).toBe(0);
});
it('refuses an empty or oversize payload and never writes a half file', async () => {
  await expect(nativeVoiceFiles.writeTemp('a.m4a', new ArrayBuffer(0))).rejects.toThrow('VOICE_FILE_SIZE');
  await expect(nativeVoiceFiles.writeTemp('a.m4a', new ArrayBuffer(VOICE_FILE_MAX_BYTES + 1))).rejects.toThrow('VOICE_FILE_SIZE');
  expect(mockStore.files.size).toBe(0);
});
it('reads exactly the bytes of a cache file', async () => {
  mockStore.files.set(`${root}Audio/recording-1.m4a`, new Uint8Array([9, 8, 7]));
  expect([...new Uint8Array(await nativeVoiceFiles.read(`${root}Audio/recording-1.m4a`))]).toEqual([9, 8, 7]);
});
it.each([
  ['a path outside the private cache', 'file:///data/user/0/other/files/x.m4a'], ['a content URI', 'content://media/external/audio/1'],
  ['a traversal', `${root}../secret.m4a`], ['a traversal inside', `${root}Audio/../../secret.m4a`], ['an encoded separator', `${root}Audio%2f..%2fx.m4a`],
  ['a backslash', `${root}Audio\\x.m4a`], ['the cache root itself', root], ['an empty string', ''],
])('refuses to read %s', async (_name, uri) => {
  mockStore.files.set(uri, new Uint8Array([1]));
  await expect(nativeVoiceFiles.read(uri)).rejects.toThrow('VOICE_FILE_PATH');
});
it('refuses to read a missing, empty or oversize file', async () => {
  await expect(nativeVoiceFiles.read(`${root}missing.m4a`)).rejects.toThrow('VOICE_FILE_MISSING');
  mockStore.files.set(`${root}empty.m4a`, new Uint8Array(0)); await expect(nativeVoiceFiles.read(`${root}empty.m4a`)).rejects.toThrow('VOICE_FILE_SIZE');
  mockStore.files.set(`${root}huge.m4a`, new Uint8Array(VOICE_FILE_MAX_BYTES + 1)); await expect(nativeVoiceFiles.read(`${root}huge.m4a`)).rejects.toThrow('VOICE_FILE_SIZE');
});
it('removes a cache file, ignores one that is already gone and never touches a file outside the cache', async () => {
  mockStore.files.set(`${root}Audio/recording-1.m4a`, new Uint8Array([1]));
  await nativeVoiceFiles.remove(`${root}Audio/recording-1.m4a`); expect(mockStore.files.size).toBe(0);
  await expect(nativeVoiceFiles.remove(`${root}Audio/recording-1.m4a`)).resolves.toBeUndefined();
  mockStore.files.set('file:///data/other/x.m4a', new Uint8Array([1]));
  await expect(nativeVoiceFiles.remove('file:///data/other/x.m4a')).rejects.toThrow('VOICE_FILE_PATH'); expect(mockStore.files.has('file:///data/other/x.m4a')).toBe(true);
  await expect(nativeVoiceFiles.remove(`${root}../x.m4a`)).rejects.toThrow('VOICE_FILE_PATH');
});
it('purges only the voice directory: other cache files stay', async () => {
  await nativeVoiceFiles.writeTemp('one.m4a', bytesOf(1)); await nativeVoiceFiles.writeTemp('two.m4a', bytesOf(2));
  mockStore.files.set(`${root}photo-cache.jpg`, new Uint8Array([7]));
  await nativeVoiceFiles.purgeAll();
  expect([...mockStore.files.keys()]).toEqual([`${root}photo-cache.jpg`]); expect(mockStore.dirs.has(voiceDirectory)).toBe(false);
  await expect(nativeVoiceFiles.purgeAll()).resolves.toBeUndefined();
});
it('the logout purge never throws into the logout', async () => {
  await nativeVoiceFiles.writeTemp('one.m4a', bytesOf(1)); mockStore.failDelete = true;
  await expect(purgeVoiceFiles()).resolves.toBeUndefined();
});


// The recorder's permission boundary reuses this suite's native file fixture; no capture starts here.
const mockAudioPermissionRead = jest.fn(), mockAudioPermissionRequest = jest.fn();
const mockAudioAppState = { currentState: 'active' };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android', isTV: false };
    if (key === 'AppState') return mockAudioAppState;
    return Reflect.get(target, key);
  } });
});
jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: () => mockAudioPermissionRead(),
  requestRecordingPermissionsAsync: () => mockAudioPermissionRequest(),
}));
import { createNativeVoiceRecorder } from '../nativeAudioAdapters';
import { answeringHost, holdingHost } from '../../../ui/permissions/testing/answeringHost';

describe('native recorder permission admission', () => {
  beforeEach(() => {
    mockAudioAppState.currentState = 'active';
    mockAudioPermissionRead.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
    mockAudioPermissionRequest.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  });
  it('reuses an already-granted microphone permission on repeated holds without requesting it again', async () => {
    const recorder = createNativeVoiceRecorder();
    expect(await recorder.requestPermission()).toBe('granted');
    expect(await recorder.requestPermission()).toBe('granted');
    expect(mockAudioPermissionRead).toHaveBeenCalledTimes(2);
    expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
  });
  it.each([
    [{ granted: true, canAskAgain: true }, 'granted'],
    [{ granted: false, canAskAgain: true }, 'denied'],
    [{ granted: false, canAskAgain: false }, 'blocked'],
  ])('requests an ungranted askable permission once and keeps its actual result %j', async (answer, expected) => {
    mockAudioPermissionRead.mockResolvedValue({ granted: false, canAskAgain: true });
    mockAudioPermissionRequest.mockResolvedValue(answer);
    expect(await createNativeVoiceRecorder().requestPermission()).toBe(expected);
    expect(mockAudioPermissionRequest).toHaveBeenCalledTimes(1);
  });
  it('does not reopen a blocked permission request', async () => {
    mockAudioPermissionRead.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await createNativeVoiceRecorder().requestPermission()).toBe('blocked');
    expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
  });
  it.each(['read', 'request'] as const)('rejects a late granted permission after cancellation during %s', async stage => {
    let settle!: (permission: { granted: boolean; canAskAgain: boolean }) => void;
    const pending = new Promise(resolve => { settle = resolve; });
    if (stage === 'read') mockAudioPermissionRead.mockReturnValue(pending);
    else {
      mockAudioPermissionRead.mockResolvedValue({ granted: false, canAskAgain: true });
      mockAudioPermissionRequest.mockReturnValue(pending);
    }
    const recorder = createNativeVoiceRecorder();
    const permission = recorder.requestPermission();
    await Promise.resolve();
    if (stage === 'request') expect(mockAudioPermissionRequest).toHaveBeenCalledTimes(1);
    await recorder.cancel();
    settle({ granted: true, canAskAgain: true });
    expect(await permission).toBe('unavailable');
    if (stage === 'read') expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
  });
  it('does not turn a foreground exit during permission read into a system request', async () => {
    mockAudioPermissionRead.mockImplementation(async () => {
      mockAudioAppState.currentState = 'background';
      return { granted: false, canAskAgain: true };
    });
    expect(await createNativeVoiceRecorder().requestPermission()).toBe('unavailable');
    expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
  });
  it('fails closed when permission cannot be read', async () => {
    mockAudioPermissionRead.mockRejectedValue(new Error('permission read failed'));
    expect(await createNativeVoiceRecorder().requestPermission()).toBe('unavailable');
    expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
  });

  // Design proposal N (owner, 2026-10-07): the first press of the microphone in a Dogovor is met by one question before the
  // system's window. It comes only when the system is about to ask, and what is asked of the system does not change.
  describe('the question before the microphone window', () => {
    let host: { stop(): void } | undefined;
    afterEach(() => { host?.stop(); host = undefined; });
    beforeEach(() => { mockAudioPermissionRead.mockResolvedValue({ granted: false, canAskAgain: true }); });

    it('"Dozvoli": the system\'s own window follows, and its actual answer is the result', async () => {
      const asking = answeringHost('allow'); host = asking;
      mockAudioPermissionRequest.mockResolvedValue({ granted: false, canAskAgain: true });
      expect(await createNativeVoiceRecorder().requestPermission()).toBe('denied');
      expect(asking.asked).toEqual(['microphone']); expect(mockAudioPermissionRequest).toHaveBeenCalledTimes(1);
    });

    it('"Ne sada": the system is not asked and it is not a refusal', async () => {
      const asking = answeringHost('later'); host = asking;
      expect(await createNativeVoiceRecorder().requestPermission()).toBe('later');
      expect(asking.asked).toEqual(['microphone']); expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
    });

    it.each([
      ['already allowed', { granted: true, canAskAgain: true }, 'granted'],
      ['refused for good, so the system will not open a window', { granted: false, canAskAgain: false }, 'blocked'],
    ])('is not asked when the microphone is %s', async (_name, state, expected) => {
      mockAudioPermissionRead.mockResolvedValue(state);
      const asking = answeringHost('later'); host = asking;
      expect(await createNativeVoiceRecorder().requestPermission()).toBe(expected);
      expect(asking.asked).toEqual([]); expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
    });

    it('lets the press go while the question is read: the attempt ends, but "Dozvoli" still reaches the system, for the next press', async () => {
      const held = holdingHost(); host = held;
      mockAudioPermissionRequest.mockResolvedValue({ granted: true, canAskAgain: true });
      const recorder = createNativeVoiceRecorder();
      const permission = recorder.requestPermission();
      for (let n = 0; n < 8; n++) await Promise.resolve();
      expect(held.open()?.kind).toBe('microphone');
      await recorder.cancel();
      held.answer('allow');
      // The cancelled attempt is told "unavailable" (it never gets a recording), but the person said yes and the system was asked.
      expect(await permission).toBe('unavailable');
      expect(mockAudioPermissionRequest).toHaveBeenCalledTimes(1);
    });

    it('does not open the system\'s window for an app that was left while the question was read', async () => {
      const held = holdingHost(); host = held;
      const permission = createNativeVoiceRecorder().requestPermission();
      for (let n = 0; n < 8; n++) await Promise.resolve();
      mockAudioAppState.currentState = 'background';
      held.answer('allow');
      expect(await permission).toBe('unavailable');
      expect(mockAudioPermissionRequest).not.toHaveBeenCalled();
    });

    it('goes straight to the system when no host can draw the question', async () => {
      expect(await createNativeVoiceRecorder().requestPermission()).toBe('granted');
      expect(mockAudioPermissionRequest).toHaveBeenCalledTimes(1);
    });
  });
});
