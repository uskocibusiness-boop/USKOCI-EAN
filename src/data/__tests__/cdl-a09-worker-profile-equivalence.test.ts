/** CDL-A09 single profile owner remains. W02 replaces unchecked transport/error
 * assumptions with owned receipts; the original creation/activation path stays. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workerProfileClientService } from '../workerProfileClientService';
import type { AzurirajProfilKomanda } from '../ports';

const A = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';
let mockAccount = { user: { id: A } as { id: string } | null, accountRevision: 1 };
const mockGetUser = jest.fn(), mockFrom = jest.fn(), mockRpc = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: { getUser: mockGetUser }, from: mockFrom, rpc: mockRpc }) }));
type Scenario = { userResult?: unknown; existingResult?: unknown; insertResult?: unknown; updateResult?: unknown; rpcResult?: unknown };
const row = { id: P, account_id: A, kind: 'WORKER' };
function configure(s: Scenario) {
  const trace: unknown[] = [];
  jest.clearAllMocks(); mockAccount = { user: { id: A }, accountRevision: 1 };
  mockGetUser.mockImplementation(async () => { trace.push(['auth.getUser']); return s.userResult ?? { data: { user: { id: A } }, error: null }; });
  mockFrom.mockImplementation((table: string) => {
    trace.push(['from', table]);
    const read = {
      eq: (column: string, value: unknown) => { trace.push(['eq', column, value]); return read; },
      maybeSingle: async () => s.existingResult ?? { data: row, error: null },
    };
    function write(result: unknown, type: string) {
      const query = {
        eq: (column: string, value: unknown) => { trace.push([type + '.eq', column, value]); return query; },
        select: (columns: string) => { trace.push([type + '.select', columns]); return query; },
        single: async () => result ?? { data: row, error: null },
      };
      return query;
    }
    return {
      select: (columns: string) => { trace.push(['select', columns]); return read; },
      insert: (payload: unknown) => { trace.push(['insert', payload]); return write(s.insertResult, 'insert'); },
      update: (payload: unknown) => { trace.push(['update', payload]); return write(s.updateResult, 'update'); },
    };
  });
  mockRpc.mockImplementation(async (name: string, params: unknown) => { trace.push(['rpc', name, params]); return s.rpcResult ?? { data: null, error: null }; });
  return trace;
}
async function run(k: AzurirajProfilKomanda, scenario: Scenario) {
  const trace=configure(scenario);
  return { value: await workerProfileClientService.azurirajRadnikProfil(k), trace };
}

describe('CDL-A09 — canonical Worker profile mutation contract', () => {
  it('physically eliminates both lower-precedence Worker profile mutation owners', () => {
    const dataDir=join(__dirname,'..');
    expect(readFileSync(join(dataDir,'productionAuthorityOverrides.ts'),'utf8')).not.toContain('azurirajRadnikProfil');
    const baseline=readFileSync(join(dataDir,'supabaseIzvor.ts'),'utf8');
    expect(baseline).not.toContain('async azurirajRadnikProfil('); expect(baseline).toContain("'azurirajRadnikProfil'");
    const canonical=readFileSync(join(dataDir,'workerProfileClientService.ts'),'utf8');
    expect(canonical).toContain('async azurirajRadnikProfil(');
    expect(canonical).toContain("supabase.rpc('rpc_complete_worker_profile'");
    expect(canonical).toContain('p_profile_id: profileId'); expect(canonical).toContain("profile_status: 'DRAFT'");
  });
  it('preserves auth-required behavior before any profile access', async () => {
    const result=await run({ ime:'Miloš' },{userResult:{data:{user:null},error:{message:'session missing'}}});
    expect(result.value).toEqual({ok:false,kod:'AUTH_REQUIRED',poruka:'Prijavi se da izmeniš profil.'});
    expect(result.trace).toEqual([['auth.getUser']]);
  });
  it('preserves the existing-profile patch and activation and binds update to owner and kind', async () => {
    const result=await run({ime:'Miloš',biografija:'Pouzdan.',vestine:['selidbe'],zavrsi:true},{});
    expect(result.value).toEqual({ok:true,podatak:null});
    expect(result.trace).toContainEqual(['update',{display_name:'Miloš',bio:'Pouzdan.',skills:['selidbe']}]);
    expect(result.trace).toContainEqual(['update.eq','account_id',A]); expect(result.trace).toContainEqual(['update.eq','kind','WORKER']);
    expect(result.trace).toContainEqual(['rpc','rpc_complete_worker_profile',{p_profile_id:P}]);
  });
  it('leaves geography and availability defaults to the server and preserves DRAFT creation and activates only the returned profile id', async () => {
    const result=await run({ime:'Ana',vestine:['čišćenje'],zavrsi:true},{existingResult:{data:null,error:null}});
    expect(result.trace).toContainEqual(['insert',{account_id:A,kind:'WORKER',display_name:'Ana',bio:'',skills:['čišćenje'],tools:[],vehicles:[],profile_status:'DRAFT'}]);
    expect(result.trace).toContainEqual(['rpc','rpc_complete_worker_profile',{p_profile_id:P}]);
    expect(result.value).toEqual({ok:true,podatak:null});
  });
  it('does not issue update or activation for an existing profile with no patch', async () => {
    const result=await run({},{}); expect(result.value).toEqual({ok:true,podatak:null});
    expect(result.trace.some(entry=>Array.isArray(entry)&&['update','rpc'].includes(entry[0]))).toBe(false);
  });
  it.each([
    ['profile read',{existingResult:{data:null,error:{code:'READ_DENIED'}}},{ime:'Ime'},'PROFILE_READ_FAILED'],
    ['profile create no data',{existingResult:{data:null,error:null},insertResult:{data:null,error:null}},{ime:'Ime'},'PROFILE_INVALID_RESPONSE'],
    ['profile update',{updateResult:{data:null,error:{message:'UPDATE_DENIED',code:'42501'}}},{ime:'Novo ime'},'PROFILE_UPDATE_FAILED'],
    ['profile activation',{rpcResult:{data:null,error:{message:'SKILL_REQUIRED',code:'P0001'}}},{zavrsi:true},'SKILL_REQUIRED'],
  ] as const)('maps %s without leaking arbitrary backend text', async (_label,scenario,k,expected) => {
    const result=await run(k,scenario); expect(result.value).toMatchObject({ok:false,kod:expected});
    if (!result.value.ok) expect(result.value.poruka).not.toMatch(/READ_DENIED|UPDATE_DENIED|P0001/);
  });
});

it.each([{grad:'Novi Sad'},{radijusKm:15},{dostupanOdmah:false}])('refuses a duplicate protected-fact writer before any SDK call: %j',async k=>{
  const trace=configure({});const result=await workerProfileClientService.azurirajRadnikProfil(k);
  expect(result.ok).toBe(false);expect(trace).toEqual([]);
});
