// Conservative UTF-16 storage budget for retained data URIs. This does not
// estimate native decoded bitmaps or the whole process's memory consumption.
export const PHOTO_CACHE_MAX_BYTES = 16 * 1024 * 1024;
export function createPhotoMemoryCache(maxBytes = PHOTO_CACHE_MAX_BYTES, maxEntries = 32, ttlMs = 15 * 60_000) {
  const entries = new Map<string, { uri: string; at: number; bytes: number }>();
  let retainedBytes = 0, generation = 0;
  const remove = (key: string) => {
    const previous = entries.get(key);
    if (previous) { retainedBytes -= previous.bytes; entries.delete(key); }
  };
  return {
    mark: () => generation,
    clear() { entries.clear(); retainedBytes = 0; generation++; },
    get(key: string, now = Date.now()): string | undefined {
      const found = entries.get(key);
      if (!found) return undefined;
      const age = now - found.at;
      if (age < 0 || age >= ttlMs) { remove(key); return undefined; }
      entries.delete(key); entries.set(key, found);
      return found.uri;
    },
    set(key: string, uri: string, mark: number, now = Date.now()) {
      if (mark !== generation) return;
      remove(key);
      const bytes = uri.length * 2;
      if (bytes > maxBytes) return;
      for (const [oldKey, old] of entries) {
        if (now < old.at || now - old.at >= ttlMs) remove(oldKey);
      }
      entries.set(key, { uri, at: now, bytes }); retainedBytes += bytes;
      while (entries.size > maxEntries || retainedBytes > maxBytes) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        remove(oldest);
      }
    },
    get retainedBytes() { return retainedBytes; },
    get size() { return entries.size; },
  };
}
