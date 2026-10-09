// Runs only inside the existing disposable loopback load harness. Not a promotion package.
import assert from 'node:assert/strict';
import {areaExperiment} from './area-dedup.mjs';

export function areaExperimentSummary(proof) {
  const lines = ['', '### Isolated location formatter experiment', '', proof.limits,
    '', `Result: ${proof.state}; candidate ${proof.hashes.candidate}; final reader ${proof.finalReaderMd5}.`,
    `Corpus: ${proof.corpusRows} tasks; NULL/key projection: ${JSON.stringify(proof.nullKeyCorpus)}.`,
    'Five warm SQL samples and three HTTP samples per request and stage. Ratios are observations, not automatic performance acceptance or p95 capacity.'];
  for (const [label, result] of Object.entries(proof.fixtures)) {
    lines.push('', '#### ' + label, '', `${result.exact.fullResponseComparisons} full JSON comparisons; timestamps unmasked; terminal pages ${JSON.stringify(result.exact.terminalPages)}.`, '',
      '| Request | Baseline SQL ms | Candidate SQL ms | Reverted SQL ms | Candidate / baseline | Baseline HTTP ms | Candidate HTTP ms | Reverted HTTP ms |',
      '|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const [key, before] of Object.entries(result.stages.baseline)) {
      const after = result.stages.candidate[key], reverted = result.stages.revertedBaseline[key];
      lines.push(`| ${key} | ${before.medianMs} | ${after.medianMs} | ${reverted.medianMs} | ${(after.medianMs / before.medianMs).toFixed(3)} | ${before.httpMedianMs} | ${after.httpMedianMs} | ${reverted.httpMedianMs} |`);
    }
  }
  return lines.join('\n') + '\n';
}

// One bounded request/page keeps all three calls in the same SQL statement clock.
// Return the next request as PostgreSQL JSON text so JS cannot round a numeric cursor.
export function areaExactRequestSql({auth, root, experiment, q, label, key, page, requestJson}) {
  return `begin; set local lock_timeout='5s';
    do $area_exact$ declare req jsonb:=${q(requestJson)}::jsonb; baseline jsonb; answer jsonb;
    begin
      ${auth}
      raise notice 'AREA_PROBE:%:baseline:%:%',${q(label)},${q(key)},${page};
      baseline:=public.rpc_discovery_v1(req);
      if ${q(key)} in ('corpus1','corpus2','corpus3','corpus4') and ${page}=0 and jsonb_array_length(baseline->'items')=0 then
        raise exception 'AREA_CROSS_FIELD_FIXTURE_EMPTY:%',${q(key)}; end if;
      if ${q(key)}='corpus5' and jsonb_array_length(baseline->'items')<>0 then raise exception 'AREA_LICENSE_LEAK'; end if;
      if ${q(key)}='mapCrossField' and jsonb_array_length(baseline->'buckets')=0 then raise exception 'AREA_MAP_FIXTURE_EMPTY'; end if;
      if ${q(key)} in ('corpus0','placesCorpus') and not coalesce((baseline->>'hasMore')::boolean,false)
        and baseline->'nextCursor' is distinct from 'null'::jsonb then raise exception 'AREA_TERMINAL_CURSOR'; end if;
      ${root}
      ${experiment.applyBlock}
      ${auth}
      raise notice 'AREA_PROBE:%:candidate:%:%',${q(label)},${q(key)},${page};
      answer:=public.rpc_discovery_v1(req);
      if answer is distinct from baseline then raise exception 'AREA_FULL_RESPONSE_DIFF:candidate:%',${q(key)}; end if;
      ${root}
      ${experiment.revertBlock}
      ${auth}
      raise notice 'AREA_PROBE:%:reverted:%:%',${q(label)},${q(key)},${page};
      answer:=public.rpc_discovery_v1(req);
      if answer is distinct from baseline then raise exception 'AREA_FULL_RESPONSE_DIFF:reverted:%',${q(key)}; end if;
      ${root}
      perform set_config('dg.area_exact',jsonb_build_object('comparisons',2,
        'hasMore',coalesce((baseline->>'hasMore')::boolean,false),
        'nextRequestJson',(req||jsonb_build_object('anchor',baseline->'anchor','after',baseline->'nextCursor'))::text)::text,false);
    end $area_exact$;
    select current_setting('dg.area_exact'); rollback;`;
}

export async function proveAreaDedup({env, run, sql, q, viewer, requester, requests, measure, httpMs, profile, report, write, pass}) {
  assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  assert.equal(env.DG_AREA_EXPERIMENT, 'DISPOSABLE_AREA_DEDUP');
  const experiment = areaExperiment();
  const proof = report.areaExperiment = {state: 'RUNNING', hashes: experiment.hashes, s3Applied: false, fixtures: {},
    limits: 'Serial read experiment on two Auth accounts. Not lifecycle, concurrency or a DEV promotion. Bulk fixtures use disabled triggers.'};
  const execute = (text, timeoutS = 180) => {
    const result = run(text, {timeoutS});
    if (!result.ok) { proof.sqlFailure = {phase: {...proof.phase}, timeoutS, ...result}; write(); }
    assert.ok(result.ok, 'AREA_EXPERIMENT_SQL:' + result.error);
    return result.output;
  };
  const current = () => sql("select md5(prosrc) from pg_proc where oid='public.rpc_discovery_v1(jsonb)'::regprocedure");
  const claims = JSON.stringify({sub: viewer.id, role: 'authenticated'});
  const auth = `perform set_config('request.jwt.claims',${q(claims)},true); perform set_config('request.jwt.claim.sub',${q(viewer.id)},true); execute 'set local role authenticated';`;
  const root = "execute 'reset role';";
  assert.equal(current(), experiment.hashes.baseline);

  // Existing rows remain the same size population. These marked rows exercise cross-field phrases and raw formatter keys.
  const cases = [
    ['Liman', 'Novi Sad', false], ['Liman', 'Novi Sad', true], ['', '', false], ['', 'Novi Sad', false], ['Liman', '', false],
    ['"Liman"', 'Novi Sad', false], ['„Liman“', 'Novi Sad', false], ['“Liman”', 'Novi Sad', false], ["'Liman'", 'Novi Sad', false],
    ['Liman, Novi Sad', 'Novi Sad', false], ['liman, NOVI SAD', 'novi sad', false], ['ab', 'c', false], ['a', 'bc', false],
    ['a:b', 'c', false], ['Čačak', 'Čačak', false], ['Чачак', 'Чачак', false], ['Đorđe', 'Niš', false], ['Ђорђе', 'Ниш', false],
    ['\u00a0Liman\u2003', '\ufeffNovi Sad ', false], ["O'Grad", 'Novi Sad', false], ['Љ Њ Џ', 'Beograd', false],
    ['C\u030cac\u030cak', 'Novi Sad', false], ['Liman 📦', 'Novi Sad', false], ['""', 'Novi Sad', false],
    ['AreaFacetOne', 'Novi Sad', false], ['AreaFacetTwo', 'Novi Sad', false], ['AreaFacetThree', 'Novi Sad', false],
  ].map(([area, city, remote], index) => ({n: index + 1, area, city, remote}));
  execute(`begin; set local session_replication_role=replica;
    with targets as (select id,row_number() over(order by id) as n from public.needs
      where requester_account_id=${q(requester.id)}::uuid and category='DG load'),
    corpus as (select * from jsonb_to_recordset(${q(JSON.stringify(cases))}::jsonb) as x(n bigint,area text,city text,remote boolean))
    update public.needs n set title='AreaProof Pomoc',approximate_area=c.area,approximate_city=c.city,
      execution_location_mode=case when c.remote then 'REMOTE' else 'STATIONARY' end,
      schedule_kind=case when c.remote then 'REMOTE_ANYTIME' else 'FLEXIBLE' end,starts_at=null,ends_at=null,
      required_skills=array['Selidba'],required_tools=array['Kartonske kutije'],required_vehicles=array['kombi'],required_licenses=array['LICENSE_ONLY_NEEDLE'],
      approximate_lat=case when c.n%3=0 then null else 45.27 end,approximate_lng=case when c.n%3=0 then null else 19.83 end,
      published_at=statement_timestamp()-interval '1 hour'
    from targets t join corpus c using(n) where n.id=t.id;
    commit; analyze public.needs;`);
  proof.corpusRows = Number(sql(`select count(*) from public.needs where requester_account_id=${q(requester.id)}::uuid and category='DG load' and title='AreaProof Pomoc'`));
  assert.equal(proof.corpusRows, cases.length, 'AREA_CORPUS_ROW_COUNT');
  // Table constraints disallow some NULL inputs. Exercise the helper/key projection directly without weakening them.
  proof.nullKeyCorpus = JSON.parse(execute(`with raw as materialized (
      select a.v as area,c.v as city,r.v as remote from (values(null::text),(''),('Liman')) a(v)
      cross join (values(null::text),(''),('Novi Sad')) c(v) cross join (values(null::boolean),(false),(true)) r(v)
    ), keyed as materialized (select *,jsonb_build_array(area,city,remote) as k from raw)
    select jsonb_build_object('cases',count(*),'distinctKeys',count(distinct k),'mismatches',count(*) filter(where
      (k->>0) is distinct from area or (k->>1) is distinct from city or (k->>2)::boolean is distinct from remote
      or public.p6_discovery_area(area,city,remote) is distinct from public.p6_discovery_area(k->>0,k->>1,(k->>2)::boolean))) from keyed;`));
  assert.deepEqual(proof.nullKeyCorpus, {cases: 27, distinctKeys: 27, mismatches: 0});
  const basePage = requests.pageDefault;
  const extra = Object.fromEntries(['areaproof', 'pomoc liman', 'sad selidba', 'selidba kartonske', 'kutije kombi', 'LICENSE_ONLY_NEEDLE',
    'Čačak', 'Cacak', 'Чачак', 'Đorđe', 'Djordje', 'Ђорђе', "O'Grad"].map((text, i) => ['corpus' + i, {...basePage, filter: {...basePage.filter, text}, limit: 2}]));
  const comparisons = {...requests, ...extra,
    mapCrossField: {...requests.mapDefault, filter: {...basePage.filter, text: 'pomoc liman'}},
    mapRemoteText: {...requests.mapDefault, filter: {...basePage.filter, text: 'areaproof', where: 'remote'}},
    placesCorpus: {...requests.placesDefault, prefix: 'areafacet', limit: 1},
  };
  const exact = label => {
    const result = proof.fixtures[label].exact = {requests: 0, fullResponseComparisons: 0,
      timestampMasking: false, terminalPages: {}, pagesByRequest: {}, timeoutSPerTriple: 90, complete: false};
    for (const [key, request] of Object.entries(comparisons)) {
      let requestJson = JSON.stringify(request), pages = 0;
      while (true) {
        proof.phase = {fixture: label, stage: 'exact', request: key, page: pages, transport: 'SQL', timeoutS: 90}; write();
        const output = execute(areaExactRequestSql({auth, root, experiment, q, label, key, page: pages, requestJson}), 90);
        assert.equal(current(), experiment.hashes.baseline);
        const triple = JSON.parse(output.split('\n').filter(Boolean).at(-1));
        assert.equal(triple.comparisons, 2);
        assert.equal(typeof triple.hasMore, 'boolean');
        result.requests++; result.fullResponseComparisons += triple.comparisons; pages++; result.pagesByRequest[key] = pages;
        if (!triple.hasMore) {
          if (key === 'corpus0' || key === 'placesCorpus') result.terminalPages[key] = pages;
          write(); break;
        }
        write();
        if (key !== 'corpus0' && key !== 'placesCorpus' && pages >= 2) break;
        assert.ok(pages < 32, 'AREA_CORPUS_PAGE_BOUND');
        assert.equal(typeof triple.nextRequestJson, 'string');
        requestJson = triple.nextRequestJson;
      }
    }
    assert.deepEqual(result.terminalPages, {corpus0: 14, placesCorpus: 3});
    assert.deepEqual(Object.keys(result.pagesByRequest).sort(), Object.keys(comparisons).sort(), 'AREA_EXACT_REQUEST_KEYS');
    for (const [key, pages] of Object.entries(result.pagesByRequest)) {
      assert.ok(Number.isInteger(pages) && pages >= 1 && pages <= (key === 'corpus0' || key === 'placesCorpus' ? 32 : 2), 'AREA_REQUEST_PAGE_COVERAGE');
    }
    assert.equal(result.requests, Object.values(result.pagesByRequest).reduce((sum, n) => sum + n, 0));
    assert.equal(result.fullResponseComparisons, 2 * result.requests);
    // Repeated coverage is pinned to the actual preceding proof. Unique distribution
    // has not completed before; all keys/pages are checked without inventing its total.
    if (label === 'repeatedLocations') {
      assert.equal(result.requests, 62, 'AREA_EXACT_REQUEST_COVERAGE');
      assert.equal(result.fullResponseComparisons, 124, 'AREA_EXACT_COMPARISON_COVERAGE');
    }
    result.complete = true; write();
    return result;
  };
  const measureStage = async (fixture, stage) => {
    const result = proof.fixtures[fixture].stages[stage] = {};
    for (const [key, request] of Object.entries(requests)) {
      proof.phase = {fixture, stage, request: key, transport: 'SQL'}; write();
      const metric = measure(viewer.id, request, 5);
      assert.ok(!metric.error, 'AREA_MEASURE:' + fixture + ':' + stage + ':' + key + ':' + metric.error);
      result[key] = metric; proof.phase.transport = 'HTTP'; write();
      const http = await httpMs(viewer.client, {...request, anchor: metric.anchor}, 3, metric);
      assert.equal(typeof http, 'number', 'AREA_HTTP:' + fixture + ':' + stage + ':' + key);
      result[key] = {...metric, httpMedianMs: http}; write();
    }
    return result;
  };
  const fixture = async label => {
    const result = proof.fixtures[label] = {exact: null, stages: {}, profiles: {}};
    exact(label); write();
    await measureStage(label, 'baseline');
    try {
      execute(experiment.apply); assert.equal(current(), experiment.hashes.candidate);
      await measureStage(label, 'candidate');
      for (const key of ['pageDefault', 'pageTextCiscenje', 'pageTextNoHit', 'pagePlaceAndText']) result.profiles[key] = profile(viewer.id, requests[key]);
      write();
    } finally {
      if (current() === experiment.hashes.candidate) execute(experiment.revert);
    }
    assert.equal(current(), experiment.hashes.baseline);
    await measureStage(label, 'revertedBaseline');
  };
  await fixture('repeatedLocations');
  // Adversarial performance case: most rows have a unique area. Marked corpus remains unchanged for exact cross-field assertions.
  execute(`begin; set local session_replication_role=replica;
    update public.needs set approximate_area='Jedinstvena lokacija '||id::text
    where requester_account_id=${q(requester.id)}::uuid and category='DG load' and title<>'AreaProof Pomoc';
    commit; analyze public.needs;`);
  await fixture('uniqueLocations');
  proof.state = 'SEMANTICS_PASS_PERFORMANCE_REPORTED';
  proof.finalReaderMd5 = current(); assert.equal(proof.finalReaderMd5, experiment.hashes.baseline);
  pass('AREA_DEDUP_EXACT_REPEATED_UNIQUE_AND_REVERT');
}
