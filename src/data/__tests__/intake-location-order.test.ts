import { intakeLocationMemory, orderIntakeLocation, type IntakeLocationOrder } from '../../ui/v2/intakeLocationOrder';
import type { AiNeedMessage } from '../../contracts/aiNeedV2';

const m = (id: string, fromAi = true): AiNeedMessage => ({ id, fromAi, body: id, safety: null, proposedFactIds: [] });
const base = { scope: 'account:conversation', messages: [m('user', false), m('next')], roles: {}, causalMessageId: 'next',
  pendingLocation: true, confirmedLocation: false, canRelease: true, preserveHistory: false, confirmationKey: 'city' };
const ids = (result: ReturnType<typeof orderIntakeLocation>) => result.messages.map(message => message.id);

it('holds only the known continuation, keeps location clarification, then releases below its stable confirmation anchor', () => {
  let state: IntakeLocationOrder | null = null;
  const run = (patch: Partial<Parameters<typeof orderIntakeLocation>[1]> = {}) => {
    const result = orderIntakeLocation(state, { ...base, ...patch }); state = result.state; return result;
  };
  expect(ids(run())).toEqual(['user']);
  const messages = [...base.messages, m('place-answer', false), m('clarify'), m('correct')];
  expect(ids(run({ messages, roles: { clarify: 'CLARIFY', correct: 'CORRECT' } }))).toEqual(['user', 'place-answer', 'clarify', 'correct']);
  // Partial save / dismissed editor does not satisfy canonical all-slot confirmation.
  expect(ids(run({ messages, canRelease: false }))).not.toContain('next');
  expect(ids(run({ messages, confirmedLocation: true, pendingLocation: false, canRelease: false }))).not.toContain('next');
  const released = run({ messages, confirmedLocation: true, pendingLocation: false });
  expect(ids(released)).toEqual(['user', 'place-answer', 'clarify', 'correct', 'next']);
  expect(released.placement?.after).toBe('correct');
  expect(ids(run({ messages: [...messages, m('later-user', false), m('later-ai')], pendingLocation: false, confirmedLocation: true })))
    .toEqual(['user', 'place-answer', 'clarify', 'correct', 'next', 'later-user', 'later-ai']);
  expect(base.messages.map(message => message.id)).toEqual(['user', 'next']);
});

it('does not guess the type of old history or hide an explicit contextual reply', () => {
  expect(ids(orderIntakeLocation(null, { ...base, causalMessageId: undefined }))).toEqual(['user', 'next']);
  expect(ids(orderIntakeLocation(null, { ...base, roles: { next: 'CLARIFY' } }))).toEqual(['user', 'next']);
  expect(ids(orderIntakeLocation(null, { ...base, roles: { next: 'CORRECT' } }))).toEqual(['user', 'next']);
  expect(ids(orderIntakeLocation(null, { ...base, pendingLocation: false }))).toEqual(['user', 'next']);
  expect(ids(orderIntakeLocation(null, { ...base, messages: [...base.messages, m('answered', false), m('unknown-next')] })))
    .toEqual(['user', 'next', 'answered', 'unknown-next']);
});

it('retains ID placements across remount but clears them on account revision changes', () => {
  const store = intakeLocationMemory('test-owner:1');
  const held = orderIntakeLocation(null, base);
  const released = orderIntakeLocation(held.state, { ...base, pendingLocation: false, confirmedLocation: true,
    messages: [...base.messages, m('clarify-user', false), m('clarification')], roles: { clarification: 'CLARIFY' } });
  store.write(base.scope, released.state);
  const restored = orderIntakeLocation(intakeLocationMemory('test-owner:1').read(base.scope), { ...base, pendingLocation: false,
    confirmedLocation: true, messages: [...base.messages, m('clarify-user', false), m('clarification')] });
  expect(ids(restored)).toEqual(['user', 'clarify-user', 'clarification', 'next']);
  expect(restored.placement?.after).toBe('clarification');
  expect(intakeLocationMemory('test-owner:2').read(base.scope)).toBeNull();
  store.write(base.scope, released.state); // retained old account callback cannot repopulate the current owner
  expect(intakeLocationMemory('test-owner:2').read(base.scope)).toBeNull();
});

it('keeps CONTINUE and CONFIRM_DISPLAYED behind the canonical all-slot gate', () => {
  const first = orderIntakeLocation(null, base);
  const next = orderIntakeLocation(first.state, { ...base, messages: [...base.messages, m('continue'), m('confirmed')],
    roles: { continue: 'CONTINUE', confirmed: 'CONFIRM_DISPLAYED' } });
  expect(ids(next)).toEqual(['user']);
  expect(ids(orderIntakeLocation(next.state, { ...base, messages: [...base.messages, m('continue'), m('confirmed')],
    confirmedLocation: true, pendingLocation: false }))).toEqual(['user', 'next', 'continue', 'confirmed']);
});

it('places the final spoken confirmation answer after the location even when its readback already contains every saved point', () => {
  const first = orderIntakeLocation(null, base);
  const result = orderIntakeLocation(first.state, { ...base, messages: [...base.messages, m('yes', false), m('final-confirm')],
    roles: { 'final-confirm': 'CONFIRM_DISPLAYED' }, pendingLocation: false, confirmedLocation: true });
  expect(ids(result)).toEqual(['user', 'yes', 'next', 'final-confirm']);
  expect(result.placement?.after).toBe('yes');
});

it('keeps history recoverable on terminal/safety states and discards memory across account/conversation scopes', () => {
  const held = orderIntakeLocation(null, base);
  expect(ids(orderIntakeLocation(held.state, { ...base, preserveHistory: true }))).toEqual(['user', 'next']);
  const reset = orderIntakeLocation(held.state, { ...base, scope: 'other', pendingLocation: false });
  expect(ids(reset)).toEqual(['user', 'next']); expect(reset.state.active).toBeNull(); expect(reset.state.released).toEqual([]);
});
