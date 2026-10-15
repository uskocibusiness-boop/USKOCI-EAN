import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';

type Proposal = { key: string; value: unknown; evidence?: string };
type Fact = { fact_key: string; fact_value: unknown; status: string };
type Dialogue = { next: 'ASK' | 'ACK' | 'REVIEW' | 'ANSWER'; questionKey: string; taskRelation: string;
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
  ['need.exact_address', 'Ulica za test, Novi Sad'],
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
  it('asks for the start when the date is genuinely missing, not the invented end', () => {
    const input = facts().map(f => f.fact_key === 'need.schedule_kind' ? { ...f, fact_value: 'FIXED_WINDOW' } : f);
    const result = call(reply('REVIEW', 'Spremno za pregled.'), input);
    expect(result.assistantMessage).toBe('Kog datuma i u koliko sati posao počinje?');
  });
  it('keeps a natural ACK even when no facts changed', () => {
    const msg = 'Razumem. Ako želiš, možeš još da dopuniš zadatak.';
    const result = call(reply('ACK', msg));
    expect(result.assistantMessage).toBe(msg);
    expect(result.proposals).toHaveLength(0);
  });
  it('keeps a location-context answer about the current point rather than generic review', () => {
    const msg = 'Koja ulica je u pitanju?';
    const result = guard(reply('REVIEW', msg), 'Kod stare stanice', facts('need.task_country_code'), { localDate: '2026-10-12' }, true);
    expect(result.assistantMessage).toBe(msg);
  });
  it('does not allow a per-hour amount to become a confirmed task price', () => {
    const turn = reply('ACK', 'Zabeležio sam 1.200 po satu.', [{ key: 'need.price_rsd', value: 1200 }]);
    turn.dialogue.priceUnit = 'PER_HOUR';
    const result = call(turn);
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toHaveLength(0);
  });
  it('keeps a city-only task in conversation instead of claiming review readiness', () => {
    const found = facts('need.exact_address');
    const result = call(reply('REVIEW', 'Otvori pregled zadatka. Tamo proveri podatke pre objave.'), found);
    expect(result.assistantMessage).toContain('U kom delu grada');
    expect(result.assistantMessage).toContain('orijentir');
    expect(result.proposals).toHaveLength(0);
  });
  it('retargets stale ASK to a human location hint when all machine-required facts exist', () => {
    const result = call(reply('ASK', 'Otvori pregled zadatka.'), facts('need.exact_address'));
    expect(result.assistantMessage).toContain('ulica');
  });
  it('preserves a real direct answer without hijacking into a map question', () => {
    const result = call(reply('ACK', 'To obično znači jednu ruku premaza.'), facts('need.exact_address'));
    result.dialogue.next = 'ANSWER';
    const spoken = call({ ...result, assistantMessage: 'Mogu to da objasnim.', dialogue: {...result.dialogue, next:'ANSWER'} }, facts('need.exact_address'));
    expect(spoken.assistantMessage).toBe('Mogu to da objasnim.');
  });
  it('does not require a private street for REMOTE tasks', () => {
    const remote = facts('need.exact_address').map(row => row.fact_key === 'need.task_geography'
      ? { ...row, fact_value: { mode: 'REMOTE' } } : row);
    expect(call(reply('REVIEW', 'Pogledaj nacrt.'), remote).assistantMessage).toBe('Pogledaj nacrt.');
  });
  it('keeps the BLOCK safety result intact', () => {
    const blocked = reply('REVIEW', 'Ne mogu da pomognem sa tim zahtevom.');
    blocked.safety = 'BLOCK';
    expect(call(blocked)).toBe(blocked);
  });
});
