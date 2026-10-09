import assert from 'node:assert/strict';

export function measureEnvelope(samples, statementTimeoutS = 90) {
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 12, 'MEASURE_BOUNDED_SAMPLES');
  assert.ok(Number.isInteger(statementTimeoutS) && statementTimeoutS > 0 && statementTimeoutS <= 300, 'MEASURE_BOUNDED_TIMEOUT');
  return { plannedSamples: samples, statementTimeoutS, processTimeoutMs: (samples * statementTimeoutS + 30) * 1000 };
}

/** One connection/transaction and one reader call per statement. The cold reply pins every later sample's anchor. */
export function measureSql({ viewerId, request, runs = 11, q }) {
  measureEnvelope(runs + 1);
  assert.ok(runs >= 1, 'MEASURE_REQUIRES_WARM_SAMPLE');
  const statements = Array.from({ length: runs + 1 }, (_, index) => `do $dg_measure$
declare t0 timestamptz; r jsonb; ms numeric; previous jsonb; req jsonb := ${q(JSON.stringify(request))}::jsonb;
begin
  previous := current_setting('dg.last')::jsonb;
  ${index ? `if jsonb_typeof(previous->'anchor') is distinct from 'object' then raise exception 'DG_MEASURE_ANCHOR_MISSING'; end if;
  req := req || jsonb_build_object('anchor',previous->'anchor');` : ''}
  raise notice 'DG_MEASURE_BEGIN:${index}';
  t0 := clock_timestamp();
  r := public.rpc_discovery_v1(req);
  ms := round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,1);
  ${index ? `if r->'anchor' is distinct from previous->'anchor' then raise exception 'DG_MEASURE_ANCHOR_CHANGED'; end if;` : ''}
  perform set_config('dg.last', jsonb_build_object('times',coalesce(previous->'times','[]'::jsonb)||to_jsonb(ms),
    'version',r->'version','mode',r->'mode','anchor',r->'anchor',
    'memberCount',(select coalesce(sum(case when b->>'kind'='TASK' then 1 else (b->>'taskCount')::bigint end),0)
      from jsonb_array_elements(coalesce(r->'buckets','[]'::jsonb)) b),
    'rows',coalesce(jsonb_array_length(r->'items'),jsonb_array_length(r->'buckets'),0),
    'counted',coalesce((r#>>'{counts,listed}')::bigint,(r#>>'{counts,mapped}')::bigint,(r#>>'{counts,everywhere}')::bigint,0))::text,true);
  raise notice 'DG_MEASURE_DONE:${index}:%',ms;
end $dg_measure$;`);
  return `begin;
select set_config('request.jwt.claims',${q(JSON.stringify({ sub: viewerId, role: 'authenticated' }))},true);
select set_config('request.jwt.claim.sub',${q(viewerId)},true);
set local role authenticated;
select set_config('dg.last','{}',true);
${statements.join('\n')}
select current_setting('dg.last');
rollback;`;
}

/** Only numeric marker fields escape stderr; malformed order never becomes a successful partial sample. */
export function measureProgress(stderr, plannedSamples) {
  measureEnvelope(plannedSamples);
  const completed = []; let activeSample = null, valid = true;
  for (const line of String(stderr ?? '').split(/\r?\n/)) {
    if (!/NOTICE:.*DG_MEASURE_/.test(line)) continue;
    const match = line.match(/NOTICE:\s+(?:00000:\s+)?DG_MEASURE_(BEGIN|DONE):(\d+)(?::(\d+(?:\.\d+)?))?\s*$/);
    if (!match) { valid = false; break; }
    const index = Number(match[2]);
    if (index >= plannedSamples || index !== completed.length) { valid = false; break; }
    if (match[1] === 'BEGIN') {
      if (activeSample !== null || match[3] !== undefined) { valid = false; break; }
      activeSample = index;
    } else {
      const elapsedMs = Number(match[3]);
      if (activeSample !== index || !Number.isFinite(elapsedMs) || elapsedMs < 0) { valid = false; break; }
      completed.push({ index, elapsedMs }); activeSample = null;
    }
  }
  return { valid, plannedSamples, completedSamples: completed.length, activeSample, completed };
}

export function measureResult(result, runs) {
  const envelope = measureEnvelope(runs + 1);
  if (!result.ok) return { ...result, ...envelope }; // preserve the bounded original failure, never publish a partial median
  const last = result.output.split('\n').filter(Boolean).at(-1);
  const value = JSON.parse(last), times = value.times;
  assert.ok(Array.isArray(times) && times.length === runs + 1 && times.every(time => typeof time === 'number' && Number.isFinite(time) && time >= 0), 'MEASURE_COMPLETE_TIMES');
  const warm = times.slice(1).sort((a, b) => a - b);
  return { ...envelope, completedSamples: times.length, coldMs: times[0], medianMs: warm[Math.floor(warm.length / 2)], minMs: warm[0], maxMs: warm.at(-1),
    rows: value.rows, counted: value.counted, version: value.version, mode: value.mode, anchor: value.anchor, memberCount: value.memberCount };
}
