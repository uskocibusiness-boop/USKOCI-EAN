import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';

type Proposal = { key: string; value: unknown; evidence?: string };
type Fact = { fact_key: string; fact_value: unknown; status: string };
type Dialogue = { next: 'ASK' | 'ACK' | 'REVIEW'; questionKey: string; taskRelation: string;
  priceUnit: string; schedulePattern: string };
type Turn = { safety: string; assistantMessage: string; proposals: Proposal[]; dialogue: Dialogue };
type Result = Turn;
type Guard = (turn: Turn, input: string, facts: Fact[], time: { localDate: string }, contextualLocation?: boolean) => Result;

// Exercise the existing server-side guard in isolation, without reimplementing its decisions.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
const start = source.indexOf('function guardConversationTurn(');
const end = source.indexOf('\n}\n\nDeno.serve(', start);
if (start < 0 || end < 0) throw new Error('AI_GUARD_SOURCE_NOT_FOUND');
const candidate = source.slice(start, end + 2);
const transformed = ts.transpileModule(candidate, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let explicitFinish = false;
const scope: Record<string, unknown> = {
  taskFinishOnly: () => explicitFinish,
  explicitPublicationOnly: () => false,
  sameFactValue: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
  serverTimeContext: (value: Date) => ({ localDate: value.toISOString().slice(0, 10) }),
  NEED_FACT_V2_DEFINITIONS: {
    'need.title': { requiredForDraft: true },
    'need.category': { requiredForDraft: true },
  },
};
runInNewContext(transformed + '\n;globalThis.__guard = guardConversationTurn;', scope);
const guard = scope.__guard as Guard;
const current = [
  ['need.title', 'Prenos ormara'], ['need.category', 'Selidba'], ['need.description', 'Preneti ormar do kombija'],
  ['need.people_needed', 2], ['need.price_mode', 'OFFERS'], ['need.schedule_kind', 'FLEXIBLE'],
  ['need.task_country_code', 'RS'], ['need.task_geography', { mode: 'STATIONARY', start: { city: 'Novi Sad' } }],
] as const;
const facts = (drop?: string): Fact[] => current.filter(([key]) => key !== drop)
  .map(([fact_key, fact_value]) => ({ fact_key, fact_value, status: 'CONFIRMED' }));
const reply = (next: Dialogue['next'], text: string, proposals: Proposal[] = []): Turn => ({
  safety: 'ALLOW', assistantMessage: text, proposals,
  dialogue: { next, questionKey: next === 'ASK' ? 'need.people_needed' : 'NONE',
    taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
});
const call = (turn: Turn, active = facts()) => guard(turn, 'U redu, to je sve', active, { localDate: '2026-10-12' }, false);

describe('natural server AI response without bypassing authoritative review', () => {
  beforeEach(() => { explicitFinish = false; });
  it('preserves the actual model REVIEW answer when all facts are present', () => {
    const model = 'Sve imam za sada. Pogledaj nacrt kad budeš spreman.';
    expect(call(reply('REVIEW', model)).assistantMessage).toBe(model);
  });
  it('does not demand an invented end for a known fixed start', () => {
    const input = facts().map(f => f.fact_key === 'need.schedule_kind' ? { ...f, fact_value: 'FIXED_WINDOW' } : f);
    input.push({ fact_key: 'need.starts_at', fact_value: '2026-10-13T05:00:00Z', status: 'CONFIRMED' });
    const spoken = 'Zabeležio sam početak u sedam; završetak možeš ostaviti otvoren.';
    expect(call(reply('REVIEW', spoken), input).assistantMessage).toBe(spoken);
  });
  it('preserves a specific ACK after a genuine correction, instead of repeated boilerplate', () => {
    const msg = 'U redu, zabeležio sam ispravku opisa.';
    const result = call(reply('ACK', msg, [{ key: 'need.description', value: 'Drugi opis' }]));
    expect(result.assistantMessage).toBe(msg);
    expect(result.proposals).toHaveLength(1);
  });
  it('still corrects an unsafe REVIEW when required people count is missing', () => {
    const result = call(reply('REVIEW', 'Sve je spremno za objavu.'), facts('need.people_needed'));
    expect(result.assistantMessage).toBe('Koliko ljudi ti treba?');
  });
  it('does not turn an explicit finish request into an automatic publication', () => {
    explicitFinish = true;
    const result = call(reply('REVIEW', 'Objavljeno.'), facts('need.people_needed'));
    expect(result.assistantMessage).toContain('Otvori pregled zadatka');
    expect(result.proposals).toHaveLength(0);
  });
  it('retargets an ASK for an already-known fact to the actual missing one', () => {
    const result = call(reply('ASK', 'Koliko ljudi ti treba?'), facts('need.task_country_code'));
    expect(result.assistantMessage).toBe('U kojoj državi je zadatak?');
  });
});
