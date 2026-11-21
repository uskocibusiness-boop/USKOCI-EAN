/** Versioned opt-in for provisional assistant text. Only a client that sends this
 * header receives `text_delta` events with `provisional: true`; older installed
 * clients keep the exact earlier event shape. Provisional text is display-only:
 * the `final` receipt and canonical readback always replace it, and it is never
 * persisted. */
export const AI_PROVISIONAL_STREAM_HEADER = 'x-uskoci-ai-provisional-stream' as const;
export const AI_PROVISIONAL_STREAM_VERSION = 'v1' as const;
