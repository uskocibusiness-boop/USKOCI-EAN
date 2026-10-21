import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { applicationDeadlineIso, decodeTaskApplicationDeadlineFact } from '../../contracts/taskApplicationDeadline';
import { decodeAiTaskReview } from '../aiTaskReviewClientService';
import { deadlineWords } from '../../ui/objava/reviewFacts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const CONVERSATION = '22222222-2222-4222-8222-222222222222';
const REVIEW = '33333333-3333-4333-8333-333333333333';
const future = '2026-10-26T10:00:00+01:00';
const fact = (value: unknown) => ({ id: '44444444-4444-4444-8444-444444444444', key: 'need.response_deadline', value,
  displayValue: 'Rok za prijave', privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'NEEDS_CONFIRMATION' });
const envelope = (value?: unknown, responseDeadline: string | null = null) => ({
  reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2',
  draftId: null, draftRevision: 0, displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64),
  sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64), expiresAt: '2026-11-01T00:00:00Z',
  responseDeadline, publicProjection: value === undefined ? [] : [fact(value)], ownerPrivateProjection: [],
  location: null, missingRequired: [], canAccept: false, safety: 'ALLOW',
});

describe('application deadline as a separate, signed AI fact', () => {
  it('distinguishes missing, explicit no deadline, and a real instant', () => {
    expect(decodeTaskApplicationDeadlineFact(undefined)).toBeNull();
    expect(decodeTaskApplicationDeadlineFact({ kind: 'NONE' })).toEqual({ kind: 'NONE' });
    expect(applicationDeadlineIso({ kind: 'NONE' })).toBeNull();
    expect(decodeTaskApplicationDeadlineFact({ kind: 'AT', at: future })).toEqual({ kind: 'AT', at: future });
    expect(decodeAiTaskReview(envelope(), OWNER)?.publicProjection).toHaveLength(0);
    expect(decodeAiTaskReview({ ...envelope(), canAccept: true,
      location: { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null } }, OWNER)?.canAccept).toBe(true);
    expect(decodeAiTaskReview(envelope({ kind: 'NONE' }), OWNER)?.responseDeadline).toBeNull();
    expect(decodeAiTaskReview(envelope({ kind: 'AT', at: future }, future), OWNER)?.responseDeadline).toBe(future);
    expect(deadlineWords(null, 'UNSPECIFIED')).toBe('Rok za prijave još nije određen');
    expect(deadlineWords(null, 'NONE')).toBe('Bez posebnog roka');
  });

  it.each([
    { kind: 'AT', at: '2026-02-30T10:00:00+01:00' },
    { kind: 'AT', at: '2026-10-26T10:00:00' },
    { kind: 'AT', at: '2026-10-26T10:00:00+14:30' },
    { kind: 'NONE', at: future },
    { kind: 'AT', at: future, executionStartsAt: future },
  ])('rejects malformed or conflated fact %j', value => {
    expect(decodeTaskApplicationDeadlineFact(value)).toBeNull();
    expect(decodeAiTaskReview(envelope(value), OWNER)).toBeNull();
  });

  it('rejects a signed deadline that disagrees with the displayed deadline fact', () => {
    expect(decodeAiTaskReview(envelope({ kind: 'AT', at: future }, null), OWNER)).toBeNull();
    expect(decodeAiTaskReview(envelope({ kind: 'NONE' }, future), OWNER)).toBeNull();
    // Existing reviews have no deadline fact; keep their old readback compatible.
    expect(decodeAiTaskReview({ ...envelope(), missingRequired: [] }, OWNER)?.responseDeadline).toBeNull();
  });
});

type Turn = { safety: string; assistantMessage: string; proposals: { key: string; value: unknown; evidence: string }[];
  dialogue: { next: string; questionKey: string } };
type Guard = (turn: Turn, input: string, facts: unknown[], time: { nowUtc: string; localDate: string }, pendingDeadlineQuestion?: boolean) => Turn;
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function serbiaTimeParts(');
const end = source.indexOf('\nfunction response(', start);
if (start < 0 || end < 0) throw new Error('TASK_DEADLINE_GUARD_SOURCE_MISSING');
const transformed = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const context: Record<string, unknown> = { decodeTaskApplicationDeadlineFact };
runInNewContext(transformed + '\n;globalThis.__guard = guardTimestampProposals;', context);
const guard = context.__guard as Guard;
const time = { nowUtc: '2026-10-21T10:00:00Z', localDate: '2026-10-21' };
const proposal = (value: unknown, evidence: string) => ({ key: 'need.response_deadline', value, evidence });
const turn = (value: unknown, evidence: string): Turn => ({ safety: 'ALLOW', assistantMessage: 'Rok je u nacrtu.',
  proposals: [proposal(value, evidence), { key: 'need.people_needed', value: 2, evidence: 'dvoje ljudi' }],
  dialogue: { next: 'ACK', questionKey: '' } });

describe('Edge time and evidence guard before the owned writer', () => {
  it('keeps a Belgrade winter deadline and an independent answer', () => {
    const result = guard(turn({ kind: 'AT', at: future }, 'prijave do 26. oktobra u 10'),
      'Prijave do 26. oktobra u 10, trebaju mi dvoje ljudi.', [], time);
    expect(result.proposals).toHaveLength(2);
  });
  it('allows an explicit clear but not an inferred clear', () => {
    expect(guard(turn({ kind: 'NONE' }, 'bez roka za prijave'), 'Želim bez roka za prijave.', [], time).proposals).toHaveLength(2);
    const invalid = guard(turn({ kind: 'NONE' }, 'ne znam rok'), 'Ne znam rok, trebaju mi dvoje ljudi.', [], time);
    expect(invalid.safety).toBe('CLARIFY');
    expect(invalid.proposals.map(item => item.key)).toEqual(['need.people_needed']);
  });
  it('accepts a bare time reply only for a pending deadline question', () => {
    const answer = turn({ kind: 'AT', at: '2026-10-22T10:00:00+02:00' }, 'sutra u 10');
    expect(guard(answer, 'Sutra u 10.', [], time).proposals.map(item => item.key)).toEqual(['need.people_needed']);
    expect(guard(answer, 'Sutra u 10.', [], time, true).proposals).toHaveLength(2);
  });
  it.each([
    ['execution time alone', { kind: 'AT', at: future }, 'sutra u 10', 'Posao je sutra u 10.'],
    ['past date', { kind: 'AT', at: '2026-10-20T10:00:00+02:00' }, 'prijave do juče', 'Prijave do juče.'],
    ['wrong DST offset', { kind: 'AT', at: '2026-10-26T10:00:00+02:00' }, 'prijave do 26. oktobra u 10', 'Prijave do 26. oktobra u 10.'],
    ['no evidence in this message', { kind: 'AT', at: future }, 'prijave do 26. oktobra', 'Dvoje ljudi.'],
    ['held manual value', { kind: 'AT', at: future }, 'prijave do 26. oktobra', 'Ne menjaj rok za prijave do 26. oktobra.'],
    ['wrong relative date', { kind: 'AT', at: future }, 'prijave do sutra u 10', 'Prijave do sutra u 10.'],
  ])('withholds %s without losing people', (_case, value, evidence, input) => {
    const result = guard(turn(value, evidence), input, [], time);
    expect(result.proposals.map(item => item.key)).toEqual(['need.people_needed']);
    expect(result.safety).toBe('CLARIFY');
  });
});

it('candidate SQL derives both signed review variants from the locked fact and preserves accept/publish', () => {
  const sql = readFileSync(resolve(process.cwd(), 'docs/candidates/task-ai-deadline-20261021/forward_candidate.sql'), 'utf8');
  expect(sql).toContain('public.rpc_prepare_ai_task_review_deadline(');
  expect(sql).toContain('public.rpc_prepare_ai_task_review_deadline_taxonomy(');
  expect(sql.match(/select x into deadline_fact from jsonb_array_elements\(review->'facts'\)/g)).toHaveLength(2);
  expect(sql).not.toContain("missing:=missing||jsonb_build_array('need.response_deadline')");
  expect(sql).toContain("if p_value is null or jsonb_typeof(p_value) is distinct from 'object' then");
  expect(sql).toContain("when 'need.response_deadline' then");
  expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.rpc_accept_ai_task_review');
  expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.rpc_publish_accepted_ai_task_review');
});
