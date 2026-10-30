import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snapshot } from './r01_fixture.mjs';
import { DEV_ORIGIN, runDevColumnProbe } from './r01-dev-column-probe.mjs';

const userId='11111111-1111-4111-8111-111111111111';
const sessionId='22222222-2222-4222-8222-222222222222';
const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt=overrides=>`${encoded({alg:'HS256',typ:'JWT'})}.${encoded({sub:userId,role:'authenticated',
  aud:'authenticated',iss:DEV_ORIGIN+'/auth/v1',session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600,
  ...overrides})}.SYNTHETIC_SIGNATURE`;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const options=extra=>({origin:DEV_ORIGIN,expectedUserId:userId,accessToken:jwt(),
  publicApiKey:'sb_publishable_SYNTHETIC_PUBLIC_KEY',...extra});
function fixture(handler){
  const calls=[];
  const fetch=async(url,init)=>{
    const parsed=new URL(url);calls.push({url:parsed,init});
    if(parsed.pathname==='/auth/v1/user')return json({id:userId,role:'authenticated',email:'DO_NOT_REPORT_EMAIL'});
    return handler?handler(parsed,init,calls):json([]);
  };
  return {calls,fetch};
}

test('R01 SQL allowlist and current 42-column proof agree with the entire HTTP exclusion set',async()=>{
  // This intentionally fails on an unreviewed new column or changed SQL allowlist.
  const sql=readFileSync(new URL('../../candidates/r01_needs_column_privileges.sql',import.meta.url),'utf8');
  const match=sql.match(/allowed CONSTANT text\[\] := ARRAY\[([\s\S]*?)\];/);
  assert.ok(match,'candidate public allowlist must exist');
  const allowed=[...match[1].matchAll(/'([a-z_]+)'/g)].map(x=>x[1]);
  const current=snapshot.columns.map(x=>x.name);
  const excluded=current.filter(x=>!allowed.includes(x)).sort();
  assert.equal(allowed.length,38);
  assert.equal(new Set(allowed).size,38);
  assert.equal(current.length,42);
  assert.equal(new Set(current).size,42);
  assert.deepEqual(excluded,['category_id','remaining_search_close_reason',
    'remaining_search_closed_by_account_id','requester_account_id'].sort());
  assert.deepEqual(allowed.filter(x=>!current.includes(x)),[]);
  const f=fixture();const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.deepEqual([...new Set(report.private_results.filter(x=>x.column!=='*')
    .map(x=>x.column))].sort(),excluded);
  assert.equal(report.expected_private_probes,17);
  assert.equal(report.limits.max_get_requests,20);
  assert.equal(report.request_count,20);
  assert.equal(report.r01_accepted,false);
});

test('only verified end-user GETs with zero rows and no count; public controls bracket all private forms',async()=>{
  const f=fixture();const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'COMPLETED');assert.equal(report.actual_user_verified,true);
  assert.equal(report.r01_accepted,false);assert.equal(report.private_results.length,17);
  assert.equal(report.private_projection_outcome,'AT_LEAST_ONE_PRIVATE_PROJECTION_ACCEPTED');
  assert.ok(report.private_results.every(row=>row.classification==='accepted_private_projection'));
  assert.equal(f.calls.length,20);
  assert.equal(f.calls[0].url.pathname,'/auth/v1/user');
  const reads=f.calls.slice(1);
  assert.equal(reads[0].url.searchParams.get('select'),'id');
  assert.equal(reads.at(-1).url.searchParams.get('select'),'id');
  for(const {url,init} of f.calls){
    assert.equal(url.origin,DEV_ORIGIN);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');
    assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(init.body,undefined);
    assert.equal(new Headers(init.headers).has('prefer'),false);
    if(url.pathname==='/rest/v1/needs')assert.equal(url.searchParams.get('limit'),'0');
  }
  for(const column of ['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason','category_id']){
    assert.ok(reads.some(({url})=>url.searchParams.get('select')===column));
    assert.ok(reads.some(({url})=>url.searchParams.get('select')===`probe_value:${column}`));
    assert.ok(reads.some(({url})=>url.searchParams.get(column)==='is.null'));
    assert.ok(reads.some(({url})=>url.searchParams.get('order')===`${column}.asc`));
  }
  assert.ok(reads.some(({url})=>url.searchParams.get('select')==='*'));
  const text=JSON.stringify(report);assert.ok(!text.includes('DO_NOT_REPORT_EMAIL'));
  assert.ok(!text.includes('SYNTHETIC_SIGNATURE'));assert.ok(!text.includes(userId));
});

test('exact table permission errors become denials only with successful public controls',async()=>{
  const f=fixture(url=>url.search==='?select=id&limit=0'?json([]):
    json({code:'42501',message:'permission denied for table needs',details:null,hint:null},403));
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'COMPLETED');
  assert.equal(report.private_projection_outcome,'ALL_PRIVATE_PROJECTIONS_DENIED_ZERO_ROWS_ONLY');
  assert.equal(report.r01_accepted,false);
  assert.ok(report.private_results.every(row=>row.classification==='denied_private_projection'));
});

test('mixed zero-row privileges keep a blocking verdict when only one private projection succeeds',async()=>{
  let tableReads=0;
  const f=fixture(()=>{
    tableReads++;
    if(tableReads===1||tableReads===2||tableReads===19)return json([]);
    return json({code:'42501',message:'permission denied for table needs'},403);
  });
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'COMPLETED');
  assert.equal(report.private_projection_outcome,'AT_LEAST_ONE_PRIVATE_PROJECTION_ACCEPTED');
  assert.equal(report.private_results.filter(row=>row.classification==='accepted_private_projection').length,1);
  assert.equal(report.private_results.filter(row=>row.classification==='denied_private_projection').length,16);
  assert.equal(report.r01_accepted,false);
  assert.equal(f.calls.length,20);
});

test('category_id alone remains a blocking direct projection outside the reviewed public columns',async()=>{
  const f=fixture(url=>{
    if(url.searchParams.get('select')==='id'&&url.searchParams.size===2)return json([]);
    if(url.searchParams.get('select')==='category_id')return json([]);
    return json({code:'42501',message:'permission denied for table needs'},403);
  });
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'COMPLETED');
  assert.equal(report.private_projection_outcome,'AT_LEAST_ONE_PRIVATE_PROJECTION_ACCEPTED');
  assert.deepEqual(report.private_results.filter(x=>x.classification==='accepted_private_projection')
    .map(x=>[x.column,x.form]),[['category_id','select']]);
  assert.equal(report.private_results.filter(x=>x.classification==='denied_private_projection').length,16);
  assert.equal(report.request_count,20);
  assert.equal(report.r01_accepted,false);
});

for(const [label,change] of [
  ['other project',{origin:'https://another.supabase.co'}],
  ['origin path',{origin:DEV_ORIGIN+'/rest/v1'}],
  ['service JWT',{accessToken:jwt({role:'service_role'})}],
  ['anon JWT',{accessToken:jwt({role:'anon'})}],
  ['different subject',{accessToken:jwt({sub:sessionId})}],
  ['no session',{accessToken:jwt({session_id:undefined})}],
  ['anonymous user',{accessToken:jwt({is_anonymous:true})}],
  ['expired JWT',{accessToken:jwt({exp:1})}],
  ['wrong issuer',{accessToken:jwt({iss:'https://another.supabase.co/auth/v1'})}],
  ['secret API key',{publicApiKey:'sb_secret_SYNTHETIC_SECRET'}],
  ['service API key',{publicApiKey:jwt({role:'service_role'})}],
])test('refuses '+label+' before any network request',async()=>{
  const f=fixture();const report=await runDevColumnProbe(options({...change,fetch:f.fetch}));
  assert.equal(report.result,'REFUSED');assert.equal(f.calls.length,0);
});

test('legacy anon public key is accepted; it is never used as the user bearer',async()=>{
  const key=jwt({role:'anon',session_id:undefined});const f=fixture();
  assert.equal((await runDevColumnProbe(options({publicApiKey:key,fetch:f.fetch}))).result,'COMPLETED');
  assert.equal(new Headers(f.calls[0].init.headers).get('apikey'),key);
  assert.notEqual(new Headers(f.calls[0].init.headers).get('authorization'),'Bearer '+key);
});

test('Auth identity mismatch refuses all table requests and never includes raw Auth body',async()=>{
  let calls=0;const report=await runDevColumnProbe(options({fetch:async()=>{calls++;return json({id:sessionId,email:'SECRET_EMAIL'});}}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'AUTH_IDENTITY_MISMATCH');assert.equal(calls,1);
  assert.ok(!JSON.stringify(report).includes('SECRET_EMAIL'));
});

for(const message of ['ACCOUNT_CLOSING','permission denied for schema public','AUTH_REQUIRED','permission denied for table other']){
  test('does not misclassify broad42501 '+message,async()=>{
    let reads=0;const f=fixture(()=>++reads===1?json([]):json({code:'42501',message},403));
    const report=await runDevColumnProbe(options({fetch:f.fetch}));
    assert.equal(report.result,'INCONCLUSIVE');
    assert.ok(report.private_results.every(row=>row.classification==='inconclusive'));
    assert.ok(!JSON.stringify(report).includes(message));
  });
}

test('a failed final public control invalidates all preceding private classifications',async()=>{
  let reads=0;const f=fixture(()=>++reads===19?json({code:'42501',message:'ACCOUNT_CLOSING'},403):json([]));
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'INCONCLUSIVE');assert.equal(report.reason,'PUBLIC_CONTROL_FAILED');
  assert.equal(report.private_projection_outcome,'NOT_VERIFIED');
  assert.ok(report.private_results.every(row=>row.classification==='inconclusive'));
});

test('any nonempty table result aborts immediately without returning any row content',async()=>{
  let reads=0;const f=fixture(()=>++reads===1?json([]):json([{private:'DO_NOT_REPORT_BUSINESS_ROW'}]));
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'UNEXPECTED_ROWS');assert.equal(f.calls.length,3);
  assert.ok(!JSON.stringify(report).includes('DO_NOT_REPORT_BUSINESS_ROW'));
});

test('rejects HTTP redirects without following them',async()=>{
  let calls=0;const report=await runDevColumnProbe(options({fetch:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}});}}));
  assert.equal(report.reason,'REDIRECT_REFUSED');assert.equal(calls,1);
});

test('rejects oversized streamed response without retaining its content',async()=>{
  const report=await runDevColumnProbe(options({fetch:async()=>json({id:userId,extra:'X'.repeat(40000)})}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'BODY_LIMIT');
  assert.ok(!JSON.stringify(report).includes('XXX'));
});

test('request timeout also bounds a fetch that ignores abort',async()=>{
  const report=await runDevColumnProbe(options({requestTimeoutMs:5,totalTimeoutMs:100,fetch:()=>new Promise(()=>{})}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'REQUEST_TIMEOUT');
});

test('body timeout bounds a stream whose read never settles',async()=>{
  const fetch=async()=>new Response(new ReadableStream({pull:()=>new Promise(()=>{})}),{headers:{'content-type':'application/json'}});
  const report=await runDevColumnProbe(options({requestTimeoutMs:5,totalTimeoutMs:100,fetch}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'REQUEST_TIMEOUT');
});

test('pre-aborted caller signal performs no request',async()=>{
  const controller=new AbortController();controller.abort();const f=fixture();
  const report=await runDevColumnProbe(options({signal:controller.signal,fetch:f.fetch}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'CALLER_ABORTED');assert.equal(f.calls.length,0);
});

test('total deadline is enforced independently of the per-request deadline',async()=>{
  const report=await runDevColumnProbe(options({requestTimeoutMs:100,totalTimeoutMs:5,fetch:()=>new Promise(()=>{})}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'TOTAL_TIMEOUT');
});

test('header rejection aborts the transport before an oversized body can be read',async()=>{
  let signal;
  const report=await runDevColumnProbe(options({fetch:async(_url,init)=>{
    signal=init.signal;return new Response('{}',{headers:{'content-type':'application/json','content-length':'40000'}});
  }}));
  assert.equal(report.reason,'BODY_LIMIT');assert.equal(signal.aborted,true);
});

test('network errors never expose raw error strings or credentials',async()=>{
  const report=await runDevColumnProbe(options({fetch:async()=>{throw new Error('PRIVATE_ACCESS_TOKEN_DO_NOT_REPORT');}}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'NETWORK_OR_RESPONSE_FAILURE');
  assert.ok(!JSON.stringify(report).includes('PRIVATE_ACCESS_TOKEN_DO_NOT_REPORT'));
});

test('a row in the public control also aborts before any private requests',async()=>{
  const f=fixture(()=>json([{id:'PRIVATE_REAL_ID'}]));
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.reason,'UNEXPECTED_ROWS');assert.equal(f.calls.length,2);
  assert.deepEqual(report.private_results,[]);assert.ok(!JSON.stringify(report).includes('PRIVATE_REAL_ID'));
});

test('HTTP authentication failure cannot be classified as a private-column denial',async()=>{
  let reads=0;const f=fixture(()=>++reads===1?json([]):json({code:'42501',message:'permission denied for table needs'},401));
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'INCONCLUSIVE');
  assert.ok(report.private_results.every(row=>row.classification==='inconclusive'));
});

test('unexpected successful object responses abort without disclosing their content',async()=>{
  const f=fixture(()=>json({id:'PRIVATE_ROW_OBJECT'}));
  const report=await runDevColumnProbe(options({fetch:f.fetch}));
  assert.equal(report.result,'ABORTED');assert.equal(report.reason,'INVALID_TABLE_RESPONSE');
  assert.equal(f.calls.length,2);assert.ok(!JSON.stringify(report).includes('PRIVATE_ROW_OBJECT'));
});
