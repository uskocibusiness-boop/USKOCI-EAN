import { announceBlockChange, blockWords } from '../../ui/safety/blockOutcome';

const OWNER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
let session={user:{id:OWNER},accountRevision:1};
let active=true;
const mockShow=jest.fn(),mockSetBlock=jest.fn();
jest.mock('../../store/sesija',()=>({sesijaSada:()=>session}));
jest.mock('../../ui/system/Poruka',()=>({poruka:{show:(...args:unknown[])=>mockShow(...args)}}));
jest.mock('../safetyClientService',()=>({safetyClientService:{setBlock:(...args:unknown[])=>mockSetBlock(...args)}}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=> '33333333-3333-4333-8333-333333333333'}));

const owner={accountId:OWNER,accountRevision:1},receipt={targetAccountId:OTHER,blocked:true,revision:6};
const announce=(onSettled=jest.fn())=>{
  announceBlockChange(receipt,owner,{stillCurrent:()=>active,onSettled});
  return onSettled;
};
beforeEach(()=>{mockShow.mockReset();mockSetBlock.mockReset();session={user:{id:OWNER},accountRevision:1};active=true;});

it('does not show confirmed toast if the account changed before receipt announcement',()=>{
  session={user:{id:OTHER},accountRevision:2};
  announce();
  expect(mockShow).not.toHaveBeenCalled();
});
it('does not show confirmed toast if the same account left the source screen',()=>{
  active=false;
  announce();
  expect(mockShow).not.toHaveBeenCalled();
});
it('keeps existing confirmed toast and undo only within the original screen and account',async()=>{
  const settled=announce();
  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(mockShow.mock.calls[0][0]).toMatchObject({text:blockWords.saved,confirmed:true,action:{label:'Vrati'}});
  mockSetBlock.mockResolvedValue({ok:true});
  await mockShow.mock.calls[0][0].action.onPress();
  await Promise.resolve();await Promise.resolve();
  expect(mockSetBlock).toHaveBeenCalledWith({targetAccountId:OTHER,blocked:false,expectedRevision:6,
    clientRequestId:'33333333-3333-4333-8333-333333333333'});
  expect(mockShow.mock.calls[1][0]).toMatchObject({text:blockWords.removed,confirmed:true});
  expect(settled).toHaveBeenCalledTimes(1);
});
it('old undo cannot write after leaving the source screen',async()=>{
  announce();
  const press=mockShow.mock.calls[0][0].action.onPress;
  active=false;
  await press();
  expect(mockSetBlock).not.toHaveBeenCalled();
  expect(mockShow).toHaveBeenCalledTimes(1);
});
it('old undo result cannot announce or refresh after screen blur during network wait',async()=>{
  const settled=announce();
  let resolve!: (value:{ok:boolean})=>void;
  mockSetBlock.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
  const press=mockShow.mock.calls[0][0].action.onPress;
  press();
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
  active=false;
  resolve({ok:true});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(settled).not.toHaveBeenCalled();
});
it('old undo result cannot announce after account round-trip with same ID but new revision',async()=>{
  announce();
  let resolve!: (value:{ok:boolean})=>void;
  mockSetBlock.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
  mockShow.mock.calls[0][0].action.onPress();
  session={user:{id:OTHER},accountRevision:2};
  session={user:{id:OWNER},accountRevision:3};
  resolve({ok:true});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  expect(mockShow).toHaveBeenCalledTimes(1);
});
