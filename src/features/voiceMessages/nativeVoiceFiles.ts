import { Directory, File, Paths } from 'expo-file-system';
import type { VoiceFilePort } from './ports';

/**
 * The file seam of the voice messages on a device: recordings and downloaded messages exist only as files in the app's PRIVATE cache, and only while they are
 * needed. Nothing here touches a photo library, a content URI or another app's document: a path outside the cache, a path with a traversal or an
 * encoded separator, or a leaf that is not a plain file name is refused.
 */
export const VOICE_CACHE_DIRECTORY = 'uskoci-voice';
/** The server refuses more than 4 MiB; reading more than that is never useful. */
export const VOICE_FILE_MAX_BYTES = 4_194_304;
const LEAF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

function insideCache(uri: string): boolean {
  if (typeof uri !== 'string' || uri.length === 0 || uri.length > 1024) return false;
  const root = Paths.cache.uri + (Paths.cache.uri.endsWith('/') ? '' : '/');
  if (!uri.startsWith(root) || uri.length === root.length) return false;
  return !(uri.includes('/../') || uri.includes('/./') || uri.endsWith('/..') || uri.endsWith('/.') || /%2e|%2f|%5c/i.test(uri) || uri.includes('\\'));
}
const voiceDirectory = () => new Directory(Paths.cache, VOICE_CACHE_DIRECTORY);

// Expo 57.0.5 writes recorder output here before finalization into uskoci-voice.
// Native source: Android AudioRecorder.createRecordingFilePath; iOS AudioUtils.createRecordingUrl.
const EXPO_RECORDING_DIRS = ['Audio', 'ExpoAudio'] as const;
const EXPO_RECORDING_LEAF = /^recording-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.m4a$/i;
const nativeCleanup = new Set<() => Promise<void>>();
export type VoiceFileOwner = Readonly<{ generation: number }>;
let generation = 0;
let currentOwner: VoiceFileOwner = Object.freeze({ generation });
const owners = new Set<VoiceFileOwner>([currentOwner]);
let erasureTail: Promise<void> = Promise.resolve();
let erasureFailed = false;

/** A native adapter belongs to the incarnation that created it, including pending starts. */
export const captureVoiceFileOwner = (): VoiceFileOwner => currentOwner;
export const voiceFileOwnerCurrent = (owner: VoiceFileOwner): boolean => owners.has(owner);

/** Admission and native cleanup registration happen together, before another erasure can capture them. */
export async function withVoiceFileAccess<T>(owner: VoiceFileOwner, work: () => T | Promise<T>): Promise<T> {
  for (;;) {
    const pending = erasureTail;
    await pending;
    if (!voiceFileOwnerCurrent(owner)) throw new Error('VOICE_FILES_RETIRED');
    if (pending !== erasureTail) continue;
    if (erasureFailed) throw new Error('VOICE_ERASURE_INCOMPLETE');
    const value = await work();
    if (!voiceFileOwnerCurrent(owner)) throw new Error('VOICE_FILES_RETIRED');
    return value;
  }
}

/** Registration is passive: importing file helpers does not import/initialize ExpoAudio. */
export function registerVoiceNativeCleanup(cleanup: () => Promise<void>): () => void {
  nativeCleanup.add(cleanup);
  return () => { nativeCleanup.delete(cleanup); };
}
export function isExpoVoiceRecordingUri(uri: string): boolean {
  if (!insideCache(uri)) return false;
  return EXPO_RECORDING_DIRS.some(name => {
    const directory = new Directory(Paths.cache, name);
    const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
    return uri.startsWith(prefix) && EXPO_RECORDING_LEAF.test(uri.slice(prefix.length));
  });
}
async function stopNativeAudioBeforePurge(captured: readonly (() => Promise<void>)[]): Promise<void> {
  const results = await Promise.allSettled(captured.map(async cleanup => cleanup()));
  // No cache removal while native code might still be writing/playing one of its files.
  if (results.some(result => result.status === 'rejected')) throw new Error('VOICE_NATIVE_RELEASE_FAILED');
}

export type VoiceFileErasure = Readonly<{ confirm(): Promise<void>; cancel(): Promise<void> }>;

/** Reserve before Auth. New files/native starts wait; only confirmed old owners are retired. */
export function prepareVoiceFileErasure(): VoiceFileErasure {
  const capturedOwners = [...owners], capturedNative = [...nativeCleanup], previous = erasureTail;
  currentOwner = Object.freeze({ generation: ++generation }); owners.add(currentOwner);
  let decided: boolean | null = null;
  let decide!: (confirmed: boolean) => void;
  const decision = new Promise<boolean>(resolve => { decide = resolve; });
  const operation = previous.then(async () => {
    if (!await decision) return;
    try {
      await stopNativeAudioBeforePurge(capturedNative);
      const directory = voiceDirectory();
      if (directory.exists) directory.delete();
      // Pending old prepares/finalizations have settled before scanning SDK output.
      // Only SDK UUID M4A leaves belong to voice; never delete an Expo directory.
      for (const name of EXPO_RECORDING_DIRS) {
        const recordings = new Directory(Paths.cache, name);
        if (!recordings.exists) continue;
        for (const entry of recordings.list()) {
          if (entry instanceof File && isExpoVoiceRecordingUri(entry.uri)) entry.delete();
        }
      }
      erasureFailed = false;
    } catch (error) {
      // A failed native release keeps its handle/file. New voice work fails
      // closed until a later successful purge; logout itself can still succeed.
      erasureFailed = true; throw error;
    }
  });
  erasureTail = operation.then(() => undefined, () => undefined);
  return {
    confirm() {
      if (decided === null) {
        decided = true;
        for (const owner of capturedOwners) owners.delete(owner);
        decide(true);
      }
      return operation;
    },
    cancel() { if (decided === null) { decided = false; decide(false); } return operation; },
  };
}

export const nativeVoiceFiles: VoiceFilePort = {
  async read(uri) {
    return withVoiceFileAccess(captureVoiceFileOwner(), async () => {
      if (!insideCache(uri)) throw new Error('VOICE_FILE_PATH');
      const file = new File(uri);
      if (!file.exists) throw new Error('VOICE_FILE_MISSING');
      const size = file.size;
      if (!Number.isInteger(size) || size <= 0 || size > VOICE_FILE_MAX_BYTES) throw new Error('VOICE_FILE_SIZE');
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength !== size) throw new Error('VOICE_FILE_SIZE');
      return bytes;
    });
  },
  async writeTemp(name, bytes) {
    return withVoiceFileAccess(captureVoiceFileOwner(), () => {
      if (!LEAF.test(name) || /^\.+$/.test(name)) throw new Error('VOICE_FILE_NAME');
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength <= 0 || bytes.byteLength > VOICE_FILE_MAX_BYTES) throw new Error('VOICE_FILE_SIZE');
      const directory = voiceDirectory();
      directory.create({ intermediates: true, idempotent: true });
      const file = new File(directory, name);
      file.create({ overwrite: true, intermediates: true });
      file.write(new Uint8Array(bytes));
      return file.uri;
    });
  },
  async remove(uri) {
    if (!insideCache(uri)) throw new Error('VOICE_FILE_PATH');
    const file = new File(uri);
    if (file.exists) file.delete();
  },
  async purgeAll() {
    await prepareVoiceFileErasure().confirm();
  },
};

/** Logout and account change: every voice file this app ever wrote is removed. Never throws into the caller's flow. */
export async function purgeVoiceFiles(): Promise<void> {
  try { await nativeVoiceFiles.purgeAll(); } catch { /* the operating system evicts the cache */ }
}
