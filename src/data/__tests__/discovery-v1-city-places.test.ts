jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { createDiscoveryV1SupabaseTransport } from '../discoveryV1ClientTransport';
import { decodeDiscoveryV1Places } from '../discoveryV1SpatialContract';
import type { DiscoveryV1OwnerRequest, DiscoveryV1PlacesRequest } from '../discoveryV1Owner';

/**
 * DISCOVERY-GRAD (owner decision d14, applied to DEV 2026-10-08): the one optional key `groupBy: 'CITY'` of a PLACES request. The shapes of the answer are byte for byte those of
 * today, so the decoder is the one it always was; what the client has to hold is that the key goes to the server exactly as given, that the CITY rows keep every invariant the
 * decoder checks (the key rule, the order, the sum, the cursor), and that the two refusals of the key are no new words for the person.
 */
const AT = '2026-10-08T05:00:00.000000Z', EX = '2026-10-08T05:30:00.000000Z', A = 'a'.repeat(32);
const anchor = () => ({ version: 'DISCOVERY_V1', filterKey: A, timeAt: AT, publishedThrough: AT, expiresAt: EX });
const answer = (items: { key: string; text: string; count: number }[], more = false, everywhere = 80): unknown => ({
  version: 'DISCOVERY_V1', mode: 'PLACES', asOf: AT, filterKey: A, anchor: anchor(), items, hasMore: more,
  nextCursor: more ? { count: items[items.length - 1].count, text: items[items.length - 1].text, key: items[items.length - 1].key } : null,
  counts: { kind: 'exact_live', observedAt: AT, everywhere, inArea: null },
});
const request: DiscoveryV1PlacesRequest = { mode: 'PLACES', filter: { text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null },
  anchor: null, prefix: 'novi', facetArea: null, limit: 30, after: null, groupBy: 'CITY' };

describe('the city rows of PLACES decode as the places always did', () => {
  it('"Novi Sad · 23", with the key rule, the order and the sum of the places of before', () => {
    const decoded = decodeDiscoveryV1Places(answer([{ key: 'novi sad', text: 'Novi Sad', count: 23 }, { key: 'beograd', text: 'Beograd', count: 13 },
      { key: 'čačak', text: 'Čačak', count: 13 }], true), 30);
    expect(decoded.items.map(row => [row.text, row.count])).toEqual([['Novi Sad', 23], ['Beograd', 13], ['Čačak', 13]]);
    expect(decoded.nextCursor).toEqual({ count: 13, text: 'Čačak', key: 'čačak' });
    expect(decoded.counts).toMatchObject({ everywhere: 80, inArea: null });
  });

  it('a city row that breaks one of the old invariants is still refused: a wrong key, a wrong order, a repeated city, more tasks than exist', () => {
    expect(() => decodeDiscoveryV1Places(answer([{ key: 'novi-sad', text: 'Novi Sad', count: 23 }]), 30)).toThrow('DISCOVERY_V1_PLACE_KEY_MISMATCH');
    expect(() => decodeDiscoveryV1Places(answer([{ key: 'beograd', text: 'Beograd', count: 13 }, { key: 'novi sad', text: 'Novi Sad', count: 23 }]), 30)).toThrow('DISCOVERY_V1_PLACE_ORDER');
    expect(() => decodeDiscoveryV1Places(answer([{ key: 'novi sad', text: 'Novi Sad', count: 5 }, { key: 'novi sad', text: 'Novi Sad', count: 4 }]), 30)).toThrow('DISCOVERY_V1_PLACE_DUPLICATE');
    expect(() => decodeDiscoveryV1Places(answer([{ key: 'novi sad', text: 'Novi Sad', count: 90 }], false, 80), 30)).toThrow('DISCOVERY_V1_PLACE_COUNTS');
  });

  it('the answer carries no new field: a key the shape does not know is refused, as before', () => {
    expect(() => decodeDiscoveryV1Places({ ...(answer([{ key: 'novi sad', text: 'Novi Sad', count: 23 }]) as object), groupBy: 'CITY' }, 30)).toThrow('DISCOVERY_V1_PLACES_SHAPE');
  });
});

describe('the key on the wire', () => {
  const sent = async (value: DiscoveryV1PlacesRequest) => {
    const rpc = jest.fn(() => Promise.resolve({ data: { ok: true }, error: null }));
    await createDiscoveryV1SupabaseTransport({ rpc } as never)(value as DiscoveryV1OwnerRequest, new AbortController().signal);
    expect(rpc).toHaveBeenCalledTimes(1);
    return (rpc.mock.calls[0] as unknown as [string, { p_request: DiscoveryV1PlacesRequest }])[1].p_request;
  };

  it('goes to the server exactly as given, and a request without it carries none', async () => {
    expect(await sent(request)).toEqual(request);
    expect((await sent(request)).groupBy).toBe('CITY');
    const { groupBy: _left, ...of_before } = request;
    expect('groupBy' in (await sent(of_before as DiscoveryV1PlacesRequest))).toBe(false);
  });

  it('the two refusals of the key stay the generic failure: no provider text, no new code for the person', async () => {
    for (const message of ['P6_INVALID_REQUEST', 'P6_INVALID_ANCHOR']) {
      const rpc = jest.fn(() => Promise.resolve({ data: null, error: { message } }));
      await expect(createDiscoveryV1SupabaseTransport({ rpc } as never)(request as DiscoveryV1OwnerRequest, new AbortController().signal)).rejects.toThrow('DISCOVERY_V1_READ_FAILED');
    }
  });
});
