import { rememberAiCorrection, takeAiCorrection, taskCorrectionTarget } from '../aiCorrectionIntent';
const ACCOUNT='11111111-1111-4111-8111-111111111111', CONVERSATION='22222222-2222-4222-8222-222222222222', OTHER='33333333-3333-4333-8333-333333333333';
let mockSession={user:{id:ACCOUNT},accountRevision:1};
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockSession}));
const owner=()=>({accountId:mockSession.user.id,accountRevision:mockSession.accountRevision});
beforeEach(()=>{mockSession={user:{id:ACCOUNT},accountRevision:1};});

it('retains a topic only, without user text or facts, and consumes it once for the exact conversation',()=>{
  const hint=rememberAiCorrection(owner(),'task.price',CONVERSATION)!;
  expect(Object.keys(hint).sort()).toEqual(['hint','target','title','token']);
  expect(takeAiCorrection(hint.token,owner(),'task',OTHER)).toBeNull();
  expect(takeAiCorrection(hint.token,owner(),'worker',CONVERSATION)).toBeNull();
  expect(takeAiCorrection(hint.token,owner(),'task',CONVERSATION)).toEqual(hint);
  expect(takeAiCorrection(hint.token,owner(),'task',CONVERSATION)).toBeNull();
});
it.each(['switch','ABA'])('rejects a retired account generation after %s',reason=>{
  const old=owner(),hint=rememberAiCorrection(old,'worker.skills')!;
  mockSession={user:{id:OTHER},accountRevision:2};
  if(reason==='ABA')mockSession={user:{id:ACCOUNT},accountRevision:3};
  expect(takeAiCorrection(hint.token,owner(),'worker',CONVERSATION)).toBeNull();
  expect(rememberAiCorrection(old,'worker.skills')).toBeNull();
});
it('allows a saved-profile topic only after the owned worker conversation is known',()=>{
  const hint=rememberAiCorrection(owner(),'worker.identity')!;
  expect(takeAiCorrection(hint.token,owner(),'worker','')).toBeNull();
  expect(takeAiCorrection(hint.token,owner(),'worker',CONVERSATION)).toEqual(hint);
  expect(rememberAiCorrection(owner(),'task.price')).toBeNull();
  expect(takeAiCorrection('untrusted-url',owner(),'worker',CONVERSATION)).toBeNull();
});
it.each([
  ['need.price_rsd','task.price'],['need.price_basis','task.price'],['need.schedule_kind','task.time'],
  ['need.starts_at','task.time'],['need.people_needed','task.people'],['need.description','task.description'],
  ['need.title','task.title'],['need.required_tools','task.requirements'],
] as const)('maps %s to a visible correction topic, without changing its value', (key,target)=>{
  expect(taskCorrectionTarget(key)).toBe(target);
});
