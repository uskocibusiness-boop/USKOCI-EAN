export type PublicPushTarget = { kind: 'INBOX' } | { kind: 'MESSAGE_EVENT' | 'OPPORTUNITY_EVENT'; eventId: string };

/** Provider metadata supplies an opaque event, never a route or message body. */
export function publicPushTarget(value: unknown): PublicPushTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.kind !== 'INBOX') return null;
  if (Object.keys(data).length === 1) return { kind: 'INBOX' };
  if (Object.keys(data).length !== 3 || !['MESSAGE_RECEIVED', 'OPPORTUNITY_AVAILABLE'].includes(String(data.eventType))
    || typeof data.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.eventId)) return null;
  return { kind: data.eventType === 'MESSAGE_RECEIVED' ? 'MESSAGE_EVENT' : 'OPPORTUNITY_EVENT', eventId: data.eventId.toLowerCase() };
}
