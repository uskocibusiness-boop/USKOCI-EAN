import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from '../aiTaskReviewClientService';
import { publishedTaskRoute, readPublicationHandoff, rememberPublication } from '../publicationHandoff';

const mockSession = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));

/**
 * Where a confirmed publication lands (owner, 2026-10-07): the task's OWN overview, not the Zadaci map. The hand-off still proves
 * account, revision and the read-back before anything opens; only the destination changed. The Zadaci landing that reads the same
 * hand-off from the URL (an old link) is still tested with the route (published-task-discovery-route).
 */
const OWNER = '11111111-1111-4111-8111-111111111111', NEED = '55555555-5555-4555-8555-555555555555';
const REVIEW = '33333333-3333-4333-8333-333333333333';
const review = { reviewId: REVIEW, accountId: OWNER } as AiTaskReviewEnvelope;
const command = (patch: Partial<AiTaskPublicationCommand> = {}) => ({ reviewId: REVIEW, needId: NEED, needRevision: 4, state: 'PUBLISHED',
  authoritative: true, ...patch }) as AiTaskPublicationCommand;
const owner = { accountId: OWNER, accountRevision: 1 };

it('is the overview of the task that was read back, with its id and nothing else', () => {
  const handoff = rememberPublication({ review, command: command(), publishedReadback: true }, owner)!;
  expect(handoff).not.toBeNull();
  expect(publishedTaskRoute(handoff)).toEqual({ pathname: '/potrebe/[id]/pregled', params: { id: NEED } });
  expect(JSON.stringify(publishedTaskRoute(handoff))).not.toMatch(/zadaci|published|token|publication/i);
});

it('is only ever reached through a hand-off the review made after the read-back: no read-back, no hand-off, no route', () => {
  expect(rememberPublication({ review, command: command(), publishedReadback: false }, owner)).toBeNull();
  expect(rememberPublication({ review, command: command({ state: 'ACCEPTED' }), publishedReadback: true }, owner)).toBeNull();
  expect(rememberPublication({ review, command: command({ authoritative: false as never }), publishedReadback: true }, owner)).toBeNull();
  expect(rememberPublication({ review: { ...review, accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as AiTaskReviewEnvelope, command: command(),
    publishedReadback: true }, owner)).toBeNull();
  expect(rememberPublication({ review, command: command({ needId: 'not-a-uuid' }), publishedReadback: true }, owner)).toBeNull();
  expect(rememberPublication({ review, command: command(), publishedReadback: true }, { accountId: OWNER, accountRevision: 2 })).toBeNull();
});

it('does not turn an address into proof of ownership: the route carries no hand-off for the old Zadaci landing to read', () => {
  const handoff = rememberPublication({ review, command: command(), publishedReadback: true }, owner)!;
  const route = publishedTaskRoute(handoff);
  expect(readPublicationHandoff(route.params as Record<string, unknown>)).toBeNull();
});
