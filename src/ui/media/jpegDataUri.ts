/** Bounded in-memory representation of JPEG bytes; no signed URL, file copy or persistent image cache. */
export function jpegDataUri(bytes: ArrayBuffer): string {
  // Fast path (Hermes has a native btoa): build the binary string in 32 KB slices and let the engine encode it.
  // The character-by-character loop below took tens of milliseconds per photo on the JS thread and stalled scrolling.
  const encode = (globalThis as { btoa?: (value: string) => string }).btoa;
  if (typeof encode === 'function') {
    const view = new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode.apply(null, view.subarray(i, i + 0x8000) as unknown as number[]);
    return 'data:image/jpeg;base64,' + encode(binary);
  }
  const data = new Uint8Array(bytes), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = []; let part = '';
  for (let i = 0; i < data.length; i += 3) {
    const word = (data[i] << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    part += alphabet[(word >>> 18) & 63] + alphabet[(word >>> 12) & 63]
      + (i + 1 < data.length ? alphabet[(word >>> 6) & 63] : '=') + (i + 2 < data.length ? alphabet[word & 63] : '=');
    if (part.length >= 16384) { chunks.push(part); part = ''; }
  }
  chunks.push(part); return 'data:image/jpeg;base64,' + chunks.join('');
}
