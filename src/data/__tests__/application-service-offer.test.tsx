import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
let mockAccount=A,mockRevision=1,mockFocused=true;
const mockRead=jest.fn(),mockSave=jest.fn(),openProfile=jest.fn();
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(key==='View')return 'View';return Reflect.get(target,key);}});});
jest.mock('expo-router',()=>({useFocusEffect:(fn:()=>void)=>require('react').useEffect(()=>mockFocused?fn():undefined,[fn,mockFocused])}));
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/system/Section',()=>({Section:({children}:any)=>children}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
jest.mock('../applicationServiceClientService',()=>({applicationServiceAccountCurrent:(i:any)=>i.accountId===mockAccount&&i.accountRevision===mockRevision,
 applicationServiceClientService:{read:(...args:any[])=>mockRead(...args),save:(...args:any[])=>mockSave(...args)}}));
import {ApplicationServiceOffer} from '../../ui/workerProfile/ApplicationServiceOffer';
const input=()=>({accountId:mockAccount,accountRevision:mockRevision,applicationId:B,needId:B,profileId:B});
const result=(state:string)=>({ok:true,podatak:{state,service:'Lektura tekstova',categoryId:B,mode:'REMOTE',review:{reviewId:B}}});
const fail=(kod='UNKNOWN')=>({ok:false,kod,poruka:'Ishod još nije potvrđen.'});
const deferred=()=>{let resolve!:(v:unknown)=>void;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
let tree:ReactTestRenderer;
const screen=()=> <ApplicationServiceOffer input={input()} openProfile={openProfile}/>;
const render=async()=>{await act(async()=>{tree=create(screen());});};
const update=async()=>{await act(async()=>tree.update(screen()));};
const actions=()=>tree.root.findAllByType('Action' as any);
const press=async()=>{await act(async()=>{actions()[0].props.onPress();});};
const text=()=>tree.root.findAllByType('T' as any).map(n=>n.props.children).join(' ');
beforeEach(()=>{mockAccount=A;mockRevision=1;mockFocused=true;mockRead.mockReset().mockResolvedValue(result('NONE'));
 mockSave.mockReset().mockResolvedValue({ok:true,podatak:null});openProfile.mockReset();});
afterEach(async()=>{await act(async()=>tree?.unmount());jest.useRealTimers();});
test('opening the offer reads only; one explicit click prepares, saves and confirms',async()=>{
 await render();expect(mockRead.mock.calls[0][1]).toBe(false);expect(mockSave).not.toHaveBeenCalled();
 mockRead.mockResolvedValueOnce(result('READY')).mockResolvedValueOnce(result('CONFIRMED'));
 await press();expect(mockRead.mock.calls.map(c=>c[1])).toEqual([false,true,undefined]);
 expect(mockSave).toHaveBeenCalledTimes(1);expect(text()).toContain('Dodato u radni profil.');expect(actions()).toHaveLength(0);
});
test.each(['READY','EXPIRED'])('a cold read of %s never restores consent or calls Save',async state=>{
 mockRead.mockResolvedValue(result(state));await render();expect(mockRead).toHaveBeenCalledTimes(1);expect(mockSave).not.toHaveBeenCalled();
 expect(actions()[0].props.label).toBe('Dodaj');expect(text()).not.toContain('Dodato u radni profil.');
});
test('an already present service has no duplicate addition action',async()=>{
 mockRead.mockResolvedValue(fail('APPLICATION_SERVICE_ALREADY_PRESENT'));await render();
 expect(actions()).toHaveLength(0);expect(text()).toContain('već u Vašem profilu');expect(mockSave).not.toHaveBeenCalled();
});
test('lost Save acknowledgement only permits readback, never automatic Save replay',async()=>{
 await render();mockRead.mockResolvedValueOnce(result('READY'));mockSave.mockResolvedValue(fail());
 await press();expect(mockSave).toHaveBeenCalledTimes(1);expect(text()).not.toContain('Dodato u radni profil.');
 mockRead.mockResolvedValueOnce(result('CONFIRMED'));await press();
 expect(mockRead.mock.calls.at(-1)[1]).toBe(false);expect(mockSave).toHaveBeenCalledTimes(1);expect(text()).toContain('Dodato u radni profil.');
});
test('duplicate taps while preparation is pending cannot issue another prepare or Save',async()=>{
 await render();const pending=deferred();mockRead.mockReturnValueOnce(pending.promise);
 const tap=actions()[0].props.onPress;await act(async()=>{tap();tap();});
 expect(mockRead).toHaveBeenCalledTimes(2);expect(mockSave).not.toHaveBeenCalled();
 mockRead.mockResolvedValueOnce(result('CONFIRMED'));await act(async()=>pending.resolve(result('READY')));
 expect(mockSave).toHaveBeenCalledTimes(1);
});
test.each(['account','reincarnation','blur','unmount'])('late prepared review cannot save after %s',async kind=>{
 await render();const pending=deferred();mockRead.mockReturnValueOnce(pending.promise);await press();
 if(kind==='unmount')await act(async()=>tree.unmount());
 else if(kind==='blur'){mockFocused=false;await update();}
 else{mockAccount=B;mockRevision++;await update();if(kind==='reincarnation'){mockAccount=A;mockRevision++;await update();}}
 await act(async()=>pending.resolve(result('READY')));expect(mockSave).not.toHaveBeenCalled();
});
test('a refresh error hides an older confirmation until the server confirms again',async()=>{
 mockRead.mockResolvedValueOnce(result('CONFIRMED'));await render();expect(text()).toContain('Dodato u radni profil.');
 mockFocused=false;await update();mockRead.mockResolvedValueOnce(fail());mockFocused=true;await update();
 expect(text()).not.toContain('Dodato u radni profil.');expect(actions()[0].props.label).toBe('Pokušajte ponovo');
 expect(mockSave).not.toHaveBeenCalled();
});
test.each(['APPLICATION_SERVICE_PROFILE_DRAFT_OPEN','APPLICATION_SERVICE_AREA_REQUIRED','APPLICATION_SERVICE_TASK_CHANGED'])(
 'a refused %s addition leaves the original application alone and offers profile recovery',async code=>{
 mockRead.mockResolvedValue(fail(code));await render();expect(mockSave).not.toHaveBeenCalled();
 expect(actions()[0].props.label).toBe('Otvorite radni profil');await press();expect(openProfile).toHaveBeenCalledTimes(1);
});
test('SAVED uses at most four read-only followups and never claims confirmed capability',async()=>{
 jest.useFakeTimers();mockRead.mockResolvedValue(result('SAVED'));await render();
 for(let i=0;i<4;i++)await act(async()=>jest.advanceTimersByTimeAsync(1200));
 expect(mockRead).toHaveBeenCalledTimes(5);expect(mockRead.mock.calls.every(c=>c[1]!==true)).toBe(true);
 expect(mockSave).not.toHaveBeenCalled();expect(text()).toContain('Dodavanje je u toku.');expect(text()).not.toContain('Dodato u radni profil.');
});
