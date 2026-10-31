import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { decodeServiceHandoff } from '../../contracts/serviceHandoff';

type Proposal = { key: string; value: unknown; evidence?: string };
type Fact = { fact_key: string; fact_value: unknown; status: string };
type Dialogue = { next: 'ASK' | 'ACK' | 'REVIEW' | 'ANSWER'; questionKey: string; taskRelation: string;
  priceUnit: string; schedulePattern: string };
type Turn = { safety: string; assistantMessage: string; proposals: Proposal[]; dialogue: Dialogue };
type Result = Turn;
type LocationContext = import('../../../supabase/functions/_shared/locationReply').LocationContext;
type Guard = (turn: Turn, input: string, facts: Fact[], time: { localDate: string }, contextualLocation?: LocationContext) => Result;
type SourceGuard = (turn: Turn, input: string, history: unknown[], facts: Fact[], time: { localDate: string }, contextualLocation?: LocationContext) => Result;

// Exercise the existing server-side guard in isolation, without reimplementing its decisions.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function guardConversationTurn(');
const end = source.indexOf('\n}\n\nDeno.serve(', start);
const timeStart = source.indexOf('function serbiaTimeParts(');
const timeEnd = source.indexOf('\nfunction response(', timeStart);
if (start < 0 || end < 0 || timeStart < 0 || timeEnd < 0) throw new Error('AI_GUARD_SOURCE_NOT_FOUND');
const candidate = source.slice(timeStart, timeEnd) + source.slice(start, end + 2);
const transformed = ts.transpileModule(candidate, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
let explicitFinish = false;
const scope: Record<string, unknown> = {
  decodeServiceHandoff,
  applicationDeadlineEnabled: () => false,
  taskFinishOnly: () => explicitFinish,
  explicitPublicationOnly: () => false,
  sameFactValue: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b),
  NEED_FACT_V2_DEFINITIONS: {
    'need.title': { requiredForDraft: true },
    'need.category': { requiredForDraft: true },
  },
};
runInNewContext(transformed + '\n;globalThis.__guard = guardConversationTurn;', scope);
const sourceGuard = scope.__guard as SourceGuard;
const guard: Guard = (turn, input, activeFacts, time, contextualLocation) =>
  sourceGuard(turn, input, [], activeFacts, time, contextualLocation);
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
const call = (turn: Turn, active = facts()) => guard(turn, 'U redu, to je sve', active, { localDate: '2026-10-12' });
const location: LocationContext = { version: 1, promptToken: '2dce6cd8-599b-4d04-ae4e-a48b36027e60',
  reviewRevision: 'a'.repeat(64), slot: 'start', phase: 'PROPOSAL', question: 'Da li je ovo mesto?',
  query: 'Stara stanica, Novi Sad', proposal: { id: 'd197b144-d66c-4b37-bff7-4e6bd7ab3af9', label: 'Stara stanica' }, alternatives: [] };

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
    const msg = 'Mapa proverava da li je to pravo mesto. Javni zadatak prikazuje približnu lokaciju.';
    const result = guard(reply('ANSWER', msg), 'Zašto mapa?', facts('need.task_country_code'), { localDate: '2026-10-12' }, location);
    expect(result.assistantMessage).toBe(msg);
  });
  it('does not promise review readiness while the displayed location is unconfirmed', () => {
    const result = guard(reply('REVIEW', 'Sve je potvrđeno, objavi.'), 'Kod stare stanice', facts(), { localDate: '2026-10-12' }, location);
    expect(result.assistantMessage).toContain('proveriš predloženo mesto na mapi');
    expect(result.proposals).toHaveLength(0);
  });
  it('does not accept an hourly price without a consistent MY_PRICE/HOURLY contract', () => {
    const turn = reply('ACK', 'Zabeležio sam 1.200 po satu.', [{ key: 'need.price_rsd', value: 1200 }]);
    turn.dialogue.priceUnit = 'PER_HOUR';
    const result = call(turn);
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toHaveLength(0);
  });
  const hourlyTurn = (basis = 'HOURLY') => {
    const turn = reply('ACK', 'Satnica je 1200 RSD po osobi po satu.', [
      { key: 'need.price_mode', value: 'MY_PRICE' },
      { key: 'need.price_rsd', value: 1200, evidence: '1200 RSD' },
      { key: 'need.price_basis', value: basis },
      { key: 'need.people_needed', value: 2 },
    ]);
    turn.dialogue.priceUnit = 'PER_HOUR';
    return turn;
  };
  it.each(['Cena je 1200 RSD na sat.', 'Cena je 1200 RSD po osobi po satu.', 'Цена је 1200 РСД по особи по сату.'])(
    'accepts the D06 unit rate without multiplying by two people or inventing a duration: %s', input => {
      const turn = hourlyTurn();
      const result = guard(turn, input, facts('need.people_needed'), { localDate: '2026-10-12' });
      expect(result.safety).toBe('ALLOW');
      expect(result.proposals).toEqual(turn.proposals);
      expect(result.proposals.find(p => p.key === 'need.price_rsd')?.value).toBe(1200);
      expect(result.proposals.some(p => p.key === 'need.ends_at')).toBe(false);
    });
  it.each(['TOTAL', 'PER_PERSON'])('cannot relabel an hourly quote as %s', basis => {
    const result = guard(hourlyTurn(basis), 'Cena je 1200 RSD na sat.', facts('need.people_needed'), { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
    expect(result.assistantMessage).toContain('po osobi po satu');
  });
  it.each(['Cena je 1200 RSD na sat za celu ekipu.', 'Cena je 1200 RSD za dve osobe po satu.',
    'Цена је 1200 РСД на сат за целу екипу.'])(
    'does not turn a team or ambiguous multi-person hourly quote into an individual rate: %s', input => {
      const result = guard(hourlyTurn(), input, facts('need.people_needed'), { localDate: '2026-10-12' });
      expect(result.safety).toBe('CLARIFY');
      expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
      expect(result.assistantMessage).toContain('po osobi po satu');
    });
  it('uses provider interpretation for team wording beyond the narrow deterministic phrases', () => {
    const turn = hourlyTurn(); turn.dialogue.priceUnit = 'PER_TEAM_HOUR';
    const result = guard(turn, 'Naša trojka deli 1200 RSD za svaki sat.', facts('need.people_needed'), { localDate: '2026-10-12' });
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
    expect(result.safety).toBe('CLARIFY');
  });
  it('keeps currency correction and its price retraction ahead of hourly clarification', () => {
    const result = guard(hourlyTurn(), 'Cena je 1200 EUR po osobi po satu.', [
      ...facts('need.people_needed'), { fact_key: 'need.price_rsd', fact_value: 5000, status: 'CONFIRMED' },
    ], { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result).toMatchObject({ priceRetraction: 'UNSUPPORTED_CURRENCY' });
    expect(result.assistantMessage).toContain('Prethodna cena više nije potvrđena');
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
  });
  it('preserves an explicit offers choice despite an invalid team hourly amount', () => {
    const turn = hourlyTurn();
    turn.proposals[0] = { key: 'need.price_mode', value: 'OFFERS', evidence: 'želim ponude' };
    turn.dialogue.priceUnit = 'PER_TEAM_HOUR';
    const result = guard(turn, 'Cena 1200 EUR na sat za celu ekipu; ipak želim ponude.',
      facts('need.people_needed').filter(f => f.fact_key !== 'need.price_mode'), { localDate: '2026-10-12' });
    expect(result.proposals).toEqual([turn.proposals[0], { key: 'need.people_needed', value: 2 }]);
    expect(result.assistantMessage).toContain('tražiš ponude');
    expect(result).not.toHaveProperty('priceRetraction');
  });
  it('does not turn a spurious hourly amount inferred from headcount into a price question', () => {
    const turn = hourlyTurn(); turn.proposals[1] = { key: 'need.price_rsd', value: 2, evidence: '2 radnika' };
    const result = guard(turn, '2 radnika', facts('need.people_needed'), { localDate: '2026-10-12' });
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
    expect(result.assistantMessage).not.toContain('Koji iznos');
  });
  it('preserves policy REVIEW without leaking a team hourly price into its writer', () => {
    const turn = hourlyTurn(); turn.safety = 'REVIEW';
    const result = guard(turn, 'Cena je 1200 RSD na sat za celu ekipu.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('REVIEW');
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
    expect(result.assistantMessage).toContain('dodatno proveriti');
  });
  it('retracts the old individual rate when the person corrects it to a team rate', () => {
    const active = [...facts(), { fact_key: 'need.price_rsd', fact_value: 1200, status: 'CONFIRMED' },
      { fact_key: 'need.price_basis', fact_value: 'HOURLY', status: 'CONFIRMED' }];
    const result = guard(hourlyTurn(), 'Mislio sam 1200 RSD za celu ekipu na sat.', active, { localDate: '2026-10-12' });
    expect(result).toMatchObject({ safety: 'CLARIFY', priceRetraction: 'UNSUPPORTED_PRICE_BASIS', proposals: [] });
    expect(result.assistantMessage).toContain('Prethodna cena više nije potvrđena');
  });
  it.each(['PER_DAY', 'PER_HOUR'])('does not retract old consent for a schedule or provider-basis mismatch alone: %s', priceUnit => {
    const turn = reply('ACK', 'Razumem.', []); turn.dialogue.priceUnit = priceUnit;
    turn.dialogue.schedulePattern = 'REPEATED';
    const result = guard(turn, 'Termin treba da bude u više dana.', [
      ...facts(), { fact_key: 'need.price_rsd', fact_value: 1200, status: 'CONFIRMED' },
    ], { localDate: '2026-10-12' });
    expect(result).toMatchObject({ safety: 'CLARIFY' });
    expect((result as any).priceRetraction).toBeUndefined();
  });
  it.each(['Treba poneti rukavice.', 'Treba poneti rukavice za celu ekipu.', 'Nije za celu ekipu.', 'Za celu ekipu?'])(
    'does not revoke a confirmed rate using a hallucinated team hint: %s', input => {
      const turn = reply('ACK', 'Razumem.', []); turn.dialogue.priceUnit = 'PER_TEAM_HOUR';
      const result = guard(turn, input, [...facts(),
        { fact_key: 'need.price_rsd', fact_value: 1200, status: 'CONFIRMED' },
        { fact_key: 'need.price_basis', fact_value: 'HOURLY', status: 'CONFIRMED' },
      ], { localDate: '2026-10-12' });
      expect((result as any).priceRetraction).toBeUndefined();
      expect(result.assistantMessage).not.toContain('Prethodna cena više nije potvrđena');
    });
  it('accepts a real short team-scope correction to an already confirmed hourly rate', () => {
    const turn = reply('ACK', 'Razumem.', []); turn.dialogue.priceUnit = 'PER_TEAM_HOUR';
    const result = guard(turn, 'Mislio sam za celu ekipu.', [...facts(),
      { fact_key: 'need.price_rsd', fact_value: 1200, status: 'CONFIRMED' },
      { fact_key: 'need.price_basis', fact_value: 'HOURLY', status: 'CONFIRMED' },
    ], { localDate: '2026-10-12' });
    expect(result).toMatchObject({ safety: 'CLARIFY', priceRetraction: 'UNSUPPORTED_PRICE_BASIS', proposals: [] });
  });
  it.each(['100 EUR', '100 evra', '€100', '100 евра'])(
    'keeps an explicit euro amount out of the RSD price fact: %s', amount => {
      const people = { key: 'need.people_needed', value: 3 };
      const turn = reply('REVIEW', 'Cena je upisana.', [people,
        { key: 'need.price_mode', value: 'MY_PRICE' },
        { key: 'need.price_rsd', value: 100, evidence: amount },
        { key: 'need.title', value: 'Prenos za 100 evra' }]);
      const result = guard(turn, `Prenesi sto za ${amount}, trebaju tri osobe.`, facts(), { localDate: '2026-10-12' });
      expect(result.safety).toBe('CLARIFY');
      expect(result.proposals).toEqual([people]);
      expect(result.assistantMessage).toContain('RSD');
      expect(result.assistantMessage).toContain('ponude');
    });
  it('keeps an explicit dinar correction when the proposal evidence quotes only its amount', () => {
    const turn = reply('ACK', 'Promenio sam cenu.', [{ key: 'need.price_rsd', value: 15000, evidence: '15000' }]);
    const result = guard(turn, 'Ne 100 EUR, nego 15000 dinara.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('ALLOW');
    expect(result.proposals).toEqual(turn.proposals);
  });
  it('withholds a later euro amount even when the earlier clause explicitly named dinars', () => {
    const turn = reply('ACK', 'Promenio sam cenu na 100 RSD.', [
      { key: 'need.price_rsd', value: 100, evidence: '100' }]);
    const result = guard(turn, 'Ne 15000 dinara, nego 100 EUR.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toEqual([]);
    expect(result.assistantMessage).toContain('nisam upisao');
    expect(result.assistantMessage).not.toContain('100 RSD');
  });
  it('keeps a clean task title and scope from the same message as an unsupported euro budget', () => {
    const title = { key: 'need.title', value: 'Prenos stola' };
    const description = { key: 'need.description', value: 'Preneti sto do stana na Limanu.' };
    const turn = reply('ACK', 'Razumem.', [title, description,
      { key: 'need.price_rsd', value: 100, evidence: '100 EUR' }]);
    const result = guard(turn, 'Prenesi sto do stana na Limanu, budžet 100 EUR.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toEqual([title, description]);
  });
  it('allows an explicitly evidenced dinar correction in a message that rejects euros', () => {
    const turn = reply('ACK', 'Cena je sada 15.000 dinara.', [
      { key: 'need.price_rsd', value: 15000, evidence: '15000 dinara' }]);
    const result = guard(turn, 'Ne 100 EUR, nego 15000 dinara.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('ALLOW');
    expect(result.proposals).toEqual(turn.proposals);
  });
  it('lets a user explicitly choose offers after mentioning a euro amount', () => {
    const turn = reply('REVIEW', 'Tražim ponude.', [{ key: 'need.price_mode', value: 'OFFERS', evidence: 'želim ponude' }]);
    const active = facts().map(f => f.fact_key === 'need.price_mode' ? { ...f, fact_value: 'MY_PRICE' } : f);
    active.push({ fact_key: 'need.price_rsd', fact_value: 10000, status: 'CONFIRMED' });
    const result = guard(turn, 'Ne stavljaj 100 EUR, želim ponude.', active, { localDate: '2026-10-12' });
    expect(result.safety).toBe('ALLOW');
    expect(result.proposals).toEqual(turn.proposals);
  });
  it('clarifies an acknowledged euro price correction when the model omitted the price fact', () => {
    const active = facts().map(f => f.fact_key === 'need.price_mode' ? { ...f, fact_value: 'MY_PRICE' } : f);
    active.push({ fact_key: 'need.price_rsd', fact_value: 9000, status: 'CONFIRMED' });
    const people = { key: 'need.people_needed', value: 3 };
    const turn = reply('ACK', 'Cena je promenjena.', [people]);
    const result = guard(turn, 'Promeni cenu na 100 EUR, a trebaju tri osobe.', active, { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result.dialogue.next).toBe('CLARIFY');
    expect(result.proposals).toEqual([people]);
    expect(result.assistantMessage).toContain('RSD');
    expect(result.assistantMessage).not.toContain('Cena je promenjena');
  });
  it('does not downgrade policy REVIEW for an acknowledged euro correction without a price fact', () => {
    const turn = reply('ACK', 'Cena je promenjena.');
    turn.safety = 'REVIEW';
    const result = guard(turn, 'Promeni cenu na 100 EUR.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('REVIEW');
    expect(result.proposals).toEqual([]);
    expect(result.assistantMessage).toContain('nisam upisao');
  });
  it('keeps an explicit offer choice on ACK when there is no euro price proposal', () => {
    const offers = { key: 'need.price_mode', value: 'OFFERS', evidence: 'želim ponude' };
    const turn = reply('ACK', 'Tražićemo ponude.', [offers]);
    const active = facts().map(f => f.fact_key === 'need.price_mode' ? { ...f, fact_value: 'MY_PRICE' } : f);
    active.push({ fact_key: 'need.price_rsd', fact_value: 9000, status: 'CONFIRMED' });
    const result = guard(turn, 'Ne menjaj cenu na 100 EUR, želim ponude.', active, { localDate: '2026-10-12' });
    expect(result.safety).toBe('ALLOW');
    expect(result.proposals).toEqual([offers]);
  });
  it('keeps explicitly evidenced offers but drops a simultaneous euro-derived price', () => {
    const offers = { key: 'need.price_mode', value: 'OFFERS', evidence: 'želim ponude' };
    const people = { key: 'need.people_needed', value: 3 };
    const turn = reply('REVIEW', 'Cena 100 RSD je sačuvana.', [offers,
      { key: 'need.price_rsd', value: 100, evidence: '100 EUR' },
      { key: 'need.price_basis', value: 'TOTAL', evidence: 'ukupno' }, people]);
    const active = facts().map(f => f.fact_key === 'need.price_mode' ? { ...f, fact_value: 'MY_PRICE' } : f);
    active.push({ fact_key: 'need.price_rsd', fact_value: 9000, status: 'CONFIRMED' });
    const result = guard(turn, 'Ne stavljaj 100 EUR; želim ponude i trebaju mi tri osobe.', active, { localDate: '2026-10-12' });
    expect(result.safety).toBe('ALLOW');
    expect(result.proposals).toEqual([offers, people]);
    expect(result.assistantMessage).toContain('tražiš ponude');
    expect(result.assistantMessage).not.toContain('100 RSD');
  });
  it('keeps policy REVIEW while dropping a simultaneous euro price beside evidenced offers', () => {
    const offers = { key: 'need.price_mode', value: 'OFFERS', evidence: 'желим понуде' };
    const turn = reply('ACK', 'Cena 100 RSD je sačuvana.', [offers,
      { key: 'need.price_rsd', value: 100, evidence: '100 евра' }]);
    turn.safety = 'REVIEW';
    const result = guard(turn, 'Не стављај 100 евра, желим понуде.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('REVIEW');
    expect(result.proposals).toEqual([offers]);
    expect(result.assistantMessage).toContain('tražiš ponude');
    expect(result.assistantMessage).toContain('nisam upisao');
    expect(result.assistantMessage).not.toContain('sačuvana');
  });
  it('does not accept a hallucinated offer choice when only a euro price was requested', () => {
    const turn = reply('ACK', 'Tražićemo ponude.', [
      { key: 'need.price_mode', value: 'OFFERS', evidence: 'ponude' },
      { key: 'need.price_rsd', value: 100, evidence: '100 EUR' }]);
    const result = guard(turn, 'Budžet je 100 EUR.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toEqual([]);
    expect(result.assistantMessage).toContain('RSD');
  });
  it('does not treat a rejected offer choice as consent to offers', () => {
    const turn = reply('ACK', 'Tražićemo ponude.', [
      { key: 'need.price_mode', value: 'OFFERS', evidence: 'Ne želim ponude' },
      { key: 'need.price_rsd', value: 100, evidence: '100 EUR' }]);
    const result = guard(turn, 'Ne želim ponude; cena je 100 EUR.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toEqual([]);
  });
  it('does not mistake a geographic Europe mention for a price', () => {
    const turn = reply('ACK', 'Zabeleženo.', [{ key: 'need.price_rsd', value: 5000, evidence: '5000 dinara' }]);
    const result = guard(turn, 'Posao je u Evropi, cena je 5000 dinara.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('ALLOW');
    expect(result.proposals).toEqual(turn.proposals);
  });
  it('preserves policy REVIEW while withholding a false RSD price from explicit euros', () => {
    const turn = reply('ACK', 'Cena 100 RSD je sačuvana.', [
      { key: 'need.people_needed', value: 2 }, { key: 'need.price_rsd', value: 100, evidence: '100 EUR' }]);
    turn.safety = 'REVIEW';
    const result = guard(turn, 'Potrebne su dve osobe za 100 EUR.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('REVIEW');
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
    expect(result.assistantMessage).toContain('dodatno proveriti');
    expect(result.assistantMessage).toContain('nisam upisao');
    expect(result.assistantMessage).not.toContain('100 RSD je sačuvana');
  });
  it('corrects a policy REVIEW claim even when the model omitted the euro price fact', () => {
    const turn = reply('REVIEW', 'Cena 100 RSD je sačuvana.', [
      { key: 'need.price_mode', value: 'MY_PRICE' }, { key: 'need.people_needed', value: 2 }]);
    turn.safety = 'REVIEW';
    const result = guard(turn, 'Dve osobe za 100 evra.', facts(), { localDate: '2026-10-12' });
    expect(result.safety).toBe('REVIEW');
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 2 }]);
    expect(result.assistantMessage).toContain('nisam upisao');
  });
  it.each(['PER_HOUR', 'PER_DAY'])('retains independent answers while clarifying %s pricing', priceUnit => {
    const people = { key: 'need.people_needed', value: 3 };
    const place = { key: 'need.task_geography', value: { mode: 'REMOTE' } };
    const turn = reply('REVIEW', 'Sve je spremno.', [people, place,
      { key: 'need.price_mode', value: 'MY_PRICE' }, { key: 'need.price_rsd', value: 1200 },
      { key: 'need.price_basis', value: 'PER_PERSON' },
      { key: 'need.description', value: 'Tri osobe po 1200 dinara za posao.' }]);
    turn.dialogue.priceUnit = priceUnit;
    const result = call(turn);
    expect(result.safety).toBe('CLARIFY');
    expect(result.proposals).toEqual([people, place]);
    expect(result.dialogue.next).toBe('CLARIFY');
    expect(result.assistantMessage).toContain(priceUnit === 'PER_HOUR' ? 'po osobi po satu' : 'ceo posao');
  });
  it('retains people and location without turning repeated shifts into one appointment or a total price', () => {
    const people = { key: 'need.people_needed', value: 4 };
    const turn = reply('REVIEW', 'Sačuvane smene.', [people,
      { key: 'need.schedule_kind', value: 'FIXED_WINDOW' },
      { key: 'need.starts_at', value: '2026-10-13T15:00:00+02:00' },
      { key: 'need.ends_at', value: '2026-10-17T19:00:00+02:00' },
      { key: 'need.price_rsd', value: 5000 },
      { key: 'need.title', value: 'Rad svako popodne' }]);
    turn.dialogue.schedulePattern = 'REPEATED';
    const result = call(turn);
    expect(result.proposals).toEqual([people]);
    expect(result.safety).toBe('CLARIFY');
    expect(result.dialogue.next).toBe('CLARIFY');
    expect(result.assistantMessage.toLowerCase()).toContain('odvojene smene');
  });
  it('clarifies the repeated schedule first while retaining an independently stated country', () => {
    const country = { key: 'need.task_country_code', value: 'RS' };
    const turn = reply('ACK', 'Zabeleženo.', [country, { key: 'need.price_rsd', value: 5000 },
      { key: 'need.starts_at', value: '2026-10-13T15:00:00+02:00' }]);
    turn.dialogue.priceUnit = 'PER_DAY'; turn.dialogue.schedulePattern = 'REPEATED';
    const result = call(turn, facts('need.task_country_code'));
    expect(result.proposals).toEqual([country]);
    expect(result.assistantMessage.toLowerCase()).toContain('odvojene smene');
    expect(result.assistantMessage.match(/\?/g)).toHaveLength(1);
  });
  it('still validates a separate timestamp in a partial reply about hourly pricing', () => {
    const turn = reply('ACK', 'Zabeleženo.', [{ key: 'need.people_needed', value: 3 },
      { key: 'need.price_rsd', value: 1200 },
      { key: 'need.starts_at', value: '2026-10-13T15:00:00Z', evidence: 'sutra u 15' }]);
    turn.dialogue.priceUnit = 'PER_HOUR';
    const result = call(turn);
    expect(result.proposals).toEqual([{ key: 'need.people_needed', value: 3 }]);
    expect(result.safety).toBe('CLARIFY');
  });
  it('does not bypass relative-date consistency when clarifying a daily rate', () => {
    const turn = reply('ACK', 'Zabeleženo.', [{ key: 'need.price_rsd', value: 1200 },
      { key: 'need.starts_at', value: '2026-10-14T15:00:00+02:00', evidence: 'sutra' }]);
    turn.dialogue.priceUnit = 'PER_DAY';
    const result = guard(turn, 'Sutra, dnevnica je 1200.', facts(), { localDate: '2026-10-12' });
    expect(result.proposals).toEqual([]);
    expect(result.safety).toBe('CLARIFY');
    expect(result.assistantMessage).toContain('datum');
  });
  it('withholds an incomplete bounded period alongside hourly price, retaining the people count', () => {
    const people = { key: 'need.people_needed', value: 3 };
    const turn = reply('ACK', 'Zabeleženo.', [people, { key: 'need.price_rsd', value: 1200 },
      { key: 'need.schedule_kind', value: 'FLEXIBLE' },
      { key: 'need.starts_at', value: '2026-10-13T15:00:00+02:00' }]);
    turn.dialogue.priceUnit = 'PER_HOUR'; turn.dialogue.schedulePattern = 'FLEXIBLE_RANGE';
    const result = call(turn);
    expect(result.proposals).toEqual([people]);
    expect(result.safety).toBe('CLARIFY');
  });
  it('never carries partial answers into a different task or through a policy block', () => {
    const turn = reply('ACK', 'Novi posao.', [{ key: 'need.people_needed', value: 3 }]);
    turn.dialogue.taskRelation = 'DIFFERENT_TASK'; turn.dialogue.priceUnit = 'PER_DAY';
    expect(call(turn).proposals).toEqual([]);
    const blocked = { ...turn, safety: 'BLOCK', proposals: [] };
    expect(call(blocked)).toBe(blocked);
  });
  it('keeps a city-only task in conversation instead of claiming review readiness', () => {
    const found = facts('need.exact_address');
    const result = call(reply('REVIEW', 'Otvori pregled zadatka. Tamo proveri podatke pre objave.'), found);
    expect(result.assistantMessage).toContain('U kom delu grada');
    expect(result.assistantMessage).toContain('orijentir');
    expect(result.proposals).toHaveLength(0);
  });
  it.each(['area', 'label'] as const)('treats a spoken %s POI as map-search input, not another city question', slot => {
    const local = facts('need.exact_address').map(f => f.fact_key === 'need.task_geography'
      ? { ...f, fact_value: { mode: 'STATIONARY', start: { city: 'Užice', [slot]: 'kod bolnice u Užicu' } } } : f);
    const review = call(reply('REVIEW', 'Pogledaj nacrt zadatka.'), local);
    expect(review.assistantMessage).toContain('proverimo predlog mesta na mapi');
    expect(review.assistantMessage).not.toContain('U kom delu grada');
    expect(review.proposals).toHaveLength(0);
    const staleAsk = call(reply('ASK', 'U kom delu grada je posao?'), local);
    expect(staleAsk.assistantMessage).toContain('potvrdi tačku');
  });
  it('does not replace a natural ACK after a landmark is already recorded', () => {
    const local = facts('need.exact_address').map(f => f.fact_key === 'need.task_geography'
      ? { ...f, fact_value: { mode: 'STATIONARY', start: { city: 'Užice', area: 'kod bolnice u Užicu' } } } : f);
    const msg = 'Važi, sačuvana je izmena. Možeš još nešto da dopuniš.';
    expect(call(reply('ACK', msg), local).assistantMessage).toBe(msg);
    expect(call(reply('ANSWER', 'To znači da pin još nije potvrđen.'), local).assistantMessage)
      .toBe('To znači da pin još nije potvrđen.');
  });
  it('does not confuse the city repeated as an area with a usable search hint', () => {
    const local = facts('need.exact_address').map(f => f.fact_key === 'need.task_geography'
      ? { ...f, fact_value: { mode: 'STATIONARY', start: { city: 'Užice', area: 'Užice' } } } : f);
    expect(call(reply('REVIEW', 'Spremno.'), local).assistantMessage).toContain('U kom delu grada');
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
  it.each([
    { required: false },
    { required: true, shippingCountries: ['RS'] },
    { required: true, localExchange: { countryCode: 'RS', city: 'Novi Sad' } },
  ])('does not require a private street for REMOTE with explicit handoff %j', handoff => {
    const remote = facts('need.exact_address').map(row => row.fact_key === 'need.task_geography'
      ? { ...row, fact_value: { mode: 'REMOTE' } } : row);
    remote.push({ fact_key: 'need.handoff', fact_value: handoff, status: 'CONFIRMED' });
    const result = call(reply('REVIEW', 'Pogledaj nacrt.'), remote);
    expect(result.assistantMessage).toBe('Pogledaj nacrt.');
    expect(result.proposals).toEqual([]);
  });
  it.each([undefined, {}, { required: true }, { required: false }])(
    'asks about handoff for REMOTE when absent, invalid or UNKNOWN (%j)', handoff => {
      const remote = facts('need.exact_address').map(row => row.fact_key === 'need.task_geography'
        ? { ...row, fact_value: { mode: 'REMOTE' } } : row);
      if (handoff !== undefined) remote.push({ fact_key: 'need.handoff', fact_value: handoff,
        status: handoff.required === false ? 'UNKNOWN' : 'CONFIRMED' });
      const result = call(reply('REVIEW', 'Sve je spremno.'), remote);
      expect(result.assistantMessage).toContain('Kako preuzimaš rezultat');
      expect(result.proposals).toEqual([]);
    });
  it('keeps the BLOCK safety result intact', () => {
    const blocked = reply('REVIEW', 'Ne mogu da pomognem sa tim zahtevom.');
    blocked.safety = 'BLOCK';
    expect(call(blocked)).toBe(blocked);
  });
});
