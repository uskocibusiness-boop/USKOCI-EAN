import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
let mockPlatform='android';
const mockCheck=jest.fn(),mockPermission=jest.fn(),mockIosPermission=jest.fn(),mockAdd=jest.fn(),mockRemove=jest.fn();
const mockLastKnown=jest.fn(),mockRemoveAll=jest.fn();
const native={Platform:{get OS(){return mockPlatform;}},PermissionsAndroid:{
 PERMISSIONS:{ACCESS_FINE_LOCATION:'fine',ACCESS_COARSE_LOCATION:'coarse'},RESULTS:{GRANTED:'granted'},
 check:(...args:unknown[])=>mockCheck(...args),
 requestMultiple:(...args:unknown[])=>mockPermission(...args)}};
const maplibre={LocationManager:{
 requestPermissions:(...args:unknown[])=>mockIosPermission(...args),addListener:(...args:unknown[])=>mockAdd(...args),
 removeListener:(...args:unknown[])=>mockRemove(...args),removeAllListeners:(...args:unknown[])=>mockRemoveAll(...args),
 getCurrentPosition:(...args:unknown[])=>mockLastKnown(...args)}};
// Expo's Jest preset preserves dynamic import(), which needs an unavailable VM
// ESM loader. Compile the exact production bytes with the installed TypeScript
// compiler; only the native module boundary is substituted, never control logic.
const compiled=ts.transpileModule(readFileSync(join(__dirname,'../nativeCurrentLocation.ts'),'utf8'),{
 fileName:'nativeCurrentLocation.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
expect(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error)).toEqual([]);
const moduleExports:typeof import('../nativeCurrentLocation')=new Function('exports','require',compiled.outputText+'\nreturn exports;')({},(name:string)=>{
 if(name==='react-native')return native;if(name==='@maplibre/maplibre-react-native')return maplibre;throw new Error('Unexpected native dependency '+name);
});
const {captureCurrentLocation}=moduleExports;
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
const flush=async()=>{for(let n=0;n<14;n++)await Promise.resolve();};
const sample=(patch:Record<string,unknown>={})=>({timestamp:Date.now(),coords:{latitude:45.25,longitude:19.85,accuracy:7},...patch});
const emit=(value=sample())=>mockAdd.mock.calls[0][0](value);
beforeEach(()=>{jest.useFakeTimers();jest.setSystemTime(new Date('2026-09-13T12:00:00Z'));jest.clearAllMocks();
 for(const mock of [mockCheck,mockPermission,mockIosPermission,mockAdd,mockRemove])mock.mockReset();mockPlatform='android';
 mockCheck.mockResolvedValue(false);mockPermission.mockResolvedValue({fine:'granted',coarse:'granted'});mockIosPermission.mockResolvedValue(true);});
afterEach(()=>{expect(mockLastKnown).not.toHaveBeenCalled();expect(mockRemoveAll).not.toHaveBeenCalled();jest.useRealTimers();});
it('takes exactly one fresh foreground observation, accepts coarse permission, and removes only its own listener',async()=>{
 mockPermission.mockResolvedValue({fine:'denied',coarse:'granted'});const abort=new AbortController();
 const removeAbort=jest.spyOn(abort.signal,'removeEventListener');const pending=captureCurrentLocation(abort.signal,()=>true);await flush();
 expect(mockPermission).toHaveBeenCalledWith(['fine','coarse']);expect(mockAdd).toHaveBeenCalledTimes(1);jest.advanceTimersByTime(1);emit();
 expect(await pending).toEqual({kind:'POINT',point:{latitude:45.25,longitude:19.85,accuracyMeters:7,capturedAt:new Date(Date.now()).toISOString()}});
 expect(mockRemove).toHaveBeenCalledWith(mockAdd.mock.calls[0][0]);expect(mockRemove).toHaveBeenCalledTimes(1);expect(removeAbort).toHaveBeenCalledWith('abort',expect.any(Function));
 emit(sample({coords:{latitude:0,longitude:0,accuracy:1}}));abort.abort();expect(mockRemove).toHaveBeenCalledTimes(1);expect(jest.getTimerCount()).toBe(0);
});
it.each(['web','windows'])('does not request native permission on %s',async platform=>{
 mockPlatform=platform;expect(await captureCurrentLocation(new AbortController().signal,()=>true)).toEqual({kind:'UNSUPPORTED'});
 expect(mockPermission).not.toHaveBeenCalled();expect(mockAdd).not.toHaveBeenCalled();
});
it.each(['signal','scope'])('rejects an already retired %s before native permission',async kind=>{
 const abort=new AbortController();if(kind==='signal')abort.abort();expect(await captureCurrentLocation(abort.signal,()=>kind!=='scope')).toEqual({kind:'CANCELLED'});
 expect(mockPermission).not.toHaveBeenCalled();expect(mockAdd).not.toHaveBeenCalled();
});
it.each(['abort','scope','timeout'])('never registers after late permission resolution following %s',async reason=>{
 const permission=deferred<Record<string,string>>();mockPermission.mockReturnValue(permission.promise);let current=true;
 const abort=new AbortController(),pending=captureCurrentLocation(abort.signal,()=>current);await flush();expect(mockAdd).not.toHaveBeenCalled();
 if(reason==='abort')abort.abort();else if(reason==='scope')current=false;else jest.advanceTimersByTime(20_000);
 permission.resolve({fine:'granted',coarse:'granted'});await flush();expect(await pending).toEqual({kind:reason==='timeout'?'UNAVAILABLE':'CANCELLED'});
 expect(mockAdd).not.toHaveBeenCalled();expect(jest.getTimerCount()).toBe(0);
});
it('denied permission never starts a native listener',async()=>{
 mockPermission.mockResolvedValue({fine:'denied',coarse:'never_ask_again'});expect(await captureCurrentLocation(new AbortController().signal,()=>true)).toEqual({kind:'DENIED'});
 expect(mockAdd).not.toHaveBeenCalled();expect(jest.getTimerCount()).toBe(0);
});
it('uses only iOS foreground permission and cancels a pending observation',async()=>{
 mockPlatform='ios';const abort=new AbortController(),pending=captureCurrentLocation(abort.signal,()=>true);await flush();
 expect(mockIosPermission).toHaveBeenCalledTimes(1);expect(mockPermission).not.toHaveBeenCalled();abort.abort();
 expect(await pending).toEqual({kind:'CANCELLED'});expect(mockRemove).toHaveBeenCalledWith(mockAdd.mock.calls[0][0]);
});
it('ignores old cached, future and malformed points before accepting a fresh valid coordinate',async()=>{
 mockAdd.mockImplementation(callback=>callback(sample({timestamp:Date.now()-1})));const pending=captureCurrentLocation(new AbortController().signal,()=>true);await flush();
 expect(()=>mockAdd.mock.calls[0][0](null)).not.toThrow();
 expect(mockRemove).not.toHaveBeenCalled();for(const value of [sample({timestamp:Date.now()+5001}),sample({timestamp:NaN}),
  sample({coords:{latitude:91,longitude:19,accuracy:2}}),sample({coords:{latitude:45,longitude:181,accuracy:2}}),
  sample({coords:{latitude:45,longitude:19,accuracy:-1}}),sample({coords:{latitude:NaN,longitude:19,accuracy:2}})])emit(value);
 expect(mockRemove).not.toHaveBeenCalled();jest.advanceTimersByTime(1);emit();expect((await pending).kind).toBe('POINT');
});
it('does not accept MapLibre’s synchronously replayed cached sample even within the same clock millisecond',async()=>{
 mockAdd.mockImplementation(callback=>callback(sample()));const pending=captureCurrentLocation(new AbortController().signal,()=>true);await flush();
 expect(mockRemove).not.toHaveBeenCalled();jest.advanceTimersByTime(1);emit();expect((await pending).kind).toBe('POINT');
});
it.each(['timeout','scope'])('stops its listener when %s retires an observation',async reason=>{
 let current=true;const pending=captureCurrentLocation(new AbortController().signal,()=>current);await flush();
 if(reason==='scope'){current=false;emit();}else jest.advanceTimersByTime(20_000);
 expect(await pending).toEqual({kind:reason==='scope'?'CANCELLED':'UNAVAILABLE'});expect(mockRemove).toHaveBeenCalledTimes(1);expect(jest.getTimerCount()).toBe(0);
});
it('registration failure has a bounded unavailable result and releases the attempted listener',async()=>{
 mockAdd.mockImplementation(()=>{throw new Error('bridge failed');});expect(await captureCurrentLocation(new AbortController().signal,()=>true)).toEqual({kind:'UNAVAILABLE'});
 expect(mockRemove).toHaveBeenCalledTimes(1);expect(jest.getTimerCount()).toBe(0);
});
it('cleanup bridge failure cannot strand the settled caller or retain its deadline',async()=>{
 mockRemove.mockImplementation(()=>{throw new Error('stop failed');});const pending=captureCurrentLocation(new AbortController().signal,()=>true);await flush();
 let outcome:unknown;void pending.then(value=>{outcome=value;});expect(()=>emit()).not.toThrow();await flush();
 expect(outcome).toEqual({kind:'UNAVAILABLE'});expect(mockRemove).toHaveBeenCalledTimes(2);expect(jest.getTimerCount()).toBe(0);
});

it.each(['fine', 'coarse'])('a held %s grant starts capture without another permission request', async held => {
 mockCheck.mockImplementation(async permission => permission === held);
 const pending = captureCurrentLocation(new AbortController().signal, () => true); await flush();
 expect(mockCheck).toHaveBeenCalledTimes(2); expect(mockPermission).not.toHaveBeenCalled();
 expect(mockAdd).toHaveBeenCalledTimes(1); jest.advanceTimersByTime(1); emit(); expect((await pending).kind).toBe('POINT');
});
it('late permission reads cannot start a request or listener after abort', async () => {
 const held = deferred<boolean>(); mockCheck.mockReturnValue(held.promise);
 const abort = new AbortController(), pending = captureCurrentLocation(abort.signal, () => true); await flush();
 abort.abort(); held.resolve(false); await flush(); expect(await pending).toEqual({ kind: 'CANCELLED' });
 expect(mockPermission).not.toHaveBeenCalled(); expect(mockAdd).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});
