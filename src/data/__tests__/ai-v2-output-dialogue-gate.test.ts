import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';

// Execute the real Edge parser, not a duplicated mock implementation. The
// permitted registry and provider types are supplied as closed, test-only stubs.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function parseV2Output(');
const end = source.indexOf('\n}\n\nasync function callGemini(', start);
if (start < 0 || end < 0) throw new Error('NEED_PARSER_SOURCE_MISSING');
const js = ts.transpileModule(source.slice(start, end + 2), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const logs: unknown[][] = [];
const scope: Record<string, unknown> = {
  exact: (raw: any, fields: string[]) => raw && typeof raw === 'object' && !Array.isArray(raw)
    && Object.keys(raw).length === fields.length && fields.every(field => Object.hasOwn(raw, field)),
  parseSafety: (value: string) => value,
  rejectManualOnlyFacts: () => undefined,
  interviewFactKeySet: new Set(['need.people_needed']),
  valueMatchesContract: (key: string, value: unknown) => key === 'need.people_needed'
    && typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 50,
  DIALOGUE_VALUES: {
    next: ['ASK', 'CLARIFY', 'REVIEW', 'ACK', 'ANSWER'],
    questionKey: ['', 'need.description', 'need.people_needed', 'need.price_mode', 'need.price_rsd',
      'need.schedule_kind', 'need.starts_at', 'need.task_geography'],
    taskRelation: ['CONTINUE', 'DIFFERENT_TASK', 'UNCLEAR'],
    priceUnit: ['WHOLE_JOB', 'PER_DAY', 'PER_HOUR', 'UNSPECIFIED'],
    schedulePattern: ['SINGLE', 'FLEXIBLE_RANGE', 'REPEATED', 'UNSPECIFIED'],
  },
  console: { info: (...args: unknown[]) => { logs.push(args); } },
};
runInNewContext(js + '\n;globalThis.__parse = parseV2Output;', scope);
const parse = scope.__parse as (data: any) => any;
const response = (next: string, questionKey: string, facts: unknown[] = []) => ({
  safety: 'ALLOW', assistantMessage: 'U kom delu grada je posao?', facts,
  dialogue: { next, questionKey, taskRelation: 'CONTINUE',
    priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
});

beforeEach(() => { logs.length = 0; });
describe('Gemini NEED V2 private structured output gate', () => {
  it('accepts a bounded flexible range as private interpretation metadata', () => {
    const input = response('ACK', 'NONE');
    input.dialogue.schedulePattern = 'FLEXIBLE_RANGE';
    expect(parse(input).dialogue.schedulePattern).toBe('FLEXIBLE_RANGE');
  });
  it('normalizes ASK without question key while preserving user-visible text', () => {
    const result = parse(response('ASK', 'NONE'));
    expect(result.assistantMessage).toBe('U kom delu grada je posao?');
    expect(result.dialogue.next).toBe('ANSWER');
    expect(result.dialogue.questionKey).toBe('');
    expect(logs).toContainEqual(['NEED_AI_OUTPUT_GATE', 'ASK_KEY_REPAIRED']);
  });
  it('normalizes unexpected question key on non-ASK without inventing a new question', () => {
    const result = parse(response('REVIEW', 'need.people_needed'));
    expect(result.dialogue.next).toBe('REVIEW');
    expect(result.dialogue.questionKey).toBe('');
    expect(logs).toContainEqual(['NEED_AI_OUTPUT_GATE', 'NON_ASK_KEY_REPAIRED']);
  });
  it('never repairs an unknown enum value or a malformed structural envelope', () => {
    expect(() => parse(response('SOME_NEW_PROVIDER_ACTION', 'NONE'))).toThrow('AI_V2_OUTPUT_INVALID');
    expect(logs).toContainEqual(['NEED_AI_OUTPUT_GATE', 'DIALOGUE_ENUM']);
    logs.length = 0;
    expect(() => parse({ ...response('ACK', 'NONE'), facts: 'bad' })).toThrow('AI_V2_OUTPUT_INVALID');
    expect(logs).toContainEqual(['NEED_AI_OUTPUT_GATE', 'ROOT_SHAPE']);
  });
  it('keeps unsafe typed facts fail-closed after a repaired dialogue hint', () => {
    const secret = 'PRIVATE_ADDRESS_NEVER_LOG_THIS';
    const malicious = [{ key: 'need.people_needed', valueJson: JSON.stringify(secret),
      displayValue: secret, evidence: secret, confidence: 0.9 }];
    expect(() => parse(response('ASK', 'NONE', malicious))).toThrow('AI_V2_FACT_INVALID');
    expect(JSON.stringify(logs)).not.toContain(secret);
    expect(logs).toContainEqual(['NEED_AI_OUTPUT_GATE', 'FACT_VALUE_INVALID']);
  });
  it('preserves valid typed proposals when only presentation hints are inconsistent', () => {
    const proposals = [{ key: 'need.people_needed', valueJson: '1', displayValue: '1',
      evidence: 'jedan majstor', confidence: 0.98 }];
    const result = parse(response('ASK', 'NONE', proposals));
    expect(result.proposals).toEqual([{key:'need.people_needed',value:1,
      displayValue:'1',evidence:'jedan majstor',confidence:0.98}]);
  });
});
