'use strict';

// Pure, pinned source transformations. This module never connects to a database or writes files.
const crypto = require('node:crypto');
const captures = require('./before.json');
const md5 = text => crypto.createHash('md5').update(text).digest('hex');
const body = definition => {
  const parts = definition.split('$function$');
  if (parts.length !== 3) throw new Error('FUNCTION_DELIMITER_DRIFT');
  return parts[1];
};
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const replaceOnce = (text, before, after) => {
  if (!before || text.split(before).length !== 2) throw new Error('PATCH_SITE_DRIFT');
  return text.replace(before, after);
};

function replacements(capture) {
  if (!capture.signature.startsWith('rpc_list_open_tasks_v3(')) {
    return [["errcode='40001'", "errcode='PT409'"]];
  }
  return [
    ['  v_need_id uuid;', '  v_need_id uuid;\n  v_home_preview boolean := false;'],
    ["'startsTo','needId']", "'startsTo','needId','homePreview']"],
    ['  -- Exact public landing is a separate mode, not another arbitrary search combination.',
      `  -- Home is a bounded public preview, not matching or a marketplace count.
  -- Reject mixed filters/cursors so ownership and eligibility are applied before the limit.
  if v_filters ? 'homePreview' then
    if v_filters->'homePreview' is distinct from 'true'::jsonb
       or v_filters - 'homePreview' <> '{}'::jsonb or p_limit <> 3
       or p_bbox is not null or p_before_at is not null or p_before_id is not null then
      raise exception 'INVALID_FILTER' using errcode = '22023';
    end if;
    v_home_preview := true;
  end if;
  -- Exact public landing is a separate mode, not another arbitrary search combination.`],
    ["          and (v_remote = 'INCLUDE'", `          and (not v_home_preview or (
            m.requester_account_id <> v_uid
            and m.required_slots > public.covered_slots(jsonb_populate_record(null::public.needs, jsonb_build_object('id', m.id)))
            and (m.response_deadline is null or m.response_deadline > statement_timestamp())
          ))
          and (v_remote = 'INCLUDE'`],
  ];
}

function plan() {
  if (captures.length !== 4 || new Set(captures.map(row => row.signature)).size !== 4) throw new Error('CAPTURE_TARGET_DRIFT');
  const pins = {
    'rpc_list_open_tasks_v3': '602113d52d64c775893752ff74bfc324',
    'rpc_taxonomy_prepare_admission_service': '575d5eaaa2fa991c84b203b0639fb4b9',
    'rpc_taxonomy_commit_admission_service': '0c158a005f739891a0c210a5307d27c1',
    'rpc_taxonomy_commit_reviewed_batch_service': '6ff6db358e4f5a3ee7f6566533ef403a',
  };
  return captures.map(capture => {
    if (md5(body(capture.definition)) !== capture.body_md5 || capture.body_md5 !== pins[capture.signature.split('(')[0]]) {
      throw new Error('CAPTURE_PREIMAGE_DRIFT');
    }
    const changes = replacements(capture);
    const after = changes.reduce((definition, [before, next]) => replaceOnce(definition, before, next), capture.definition);
    return { ...capture, changes, after, after_md5: md5(body(after)) };
  });
}

function sql(direction = 'forward') {
  if (!['forward', 'revert'].includes(direction)) throw new Error('INVALID_DIRECTION');
  const targets = plan();
  const reverse = direction === 'revert';
  const operations = targets.map(target => {
    const from = reverse ? target.after_md5 : target.body_md5;
    const to = reverse ? target.body_md5 : target.after_md5;
    const changes = reverse ? [...target.changes].reverse().map(([a, b]) => [b, a]) : target.changes;
    return `
  v_oid := to_regprocedure(${literal('public.' + target.signature)});
  if v_oid is null then raise exception 'LOCAL_RELIABILITY_TARGET_MISSING'; end if;
  select * into strict v_before from pg_proc where oid = v_oid;
  if md5(v_before.prosrc) <> ${literal(from)}
     or v_before.prosecdef is distinct from ${target.security_definer}
     or v_before.provolatile::text <> ${literal(target.volatility)}
     or v_before.proconfig::text is distinct from ${literal('{' + target.proconfig.map(x => x.includes(' ') ? '"' + x + '"' : x).join(',') + '}')}
     or v_before.proacl::text is distinct from ${literal(target.acl)}
     or pg_get_userbyid(v_before.proowner) <> ${literal(target.owner)}
     or obj_description(v_oid, 'pg_proc') is distinct from ${target.comment === null ? 'null' : literal(target.comment)} then
    raise exception 'LOCAL_RELIABILITY_PREIMAGE_OR_AUTHORITY_DRIFT';
  end if;
  v_comment := obj_description(v_oid, 'pg_proc');
  v_definition := pg_get_functiondef(v_oid);
${changes.map(([before, after]) => `  if (length(v_definition) - length(replace(v_definition, ${literal(before)}, ''))) / length(${literal(before)}) <> 1 then
    raise exception 'LOCAL_RELIABILITY_PATCH_SITE_DRIFT';
  end if;
  v_definition := replace(v_definition, ${literal(before)}, ${literal(after)});`).join('\n')}
  execute v_definition;
  select * into strict v_after from pg_proc where oid = v_oid;
  if md5(v_after.prosrc) <> ${literal(to)}
     or (to_jsonb(v_before) - 'prosrc') is distinct from (to_jsonb(v_after) - 'prosrc')
     or obj_description(v_oid, 'pg_proc') is distinct from v_comment then
    raise exception 'LOCAL_RELIABILITY_POSTIMAGE_OR_AUTHORITY_DRIFT';
  end if;`;
  }).join('\n');
  return `-- LOCAL CANDIDATE ONLY, NOT APPLIED. Generated by package.cjs; ${direction}.
-- No table, policy, grant, closure certificate or business-data changes.
-- Exact preimages only; repeat application and drift are refused, not silently overwritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog;
do $local_reliability$
declare
  v_oid oid; v_before pg_proc%rowtype; v_after pg_proc%rowtype;
  v_definition text; v_comment text; v_closure text;
begin
  v_closure := private.closure_source_digest_v5();
  if v_closure is null then raise exception 'LOCAL_RELIABILITY_CLOSURE_UNAVAILABLE'; end if;
${operations}
  if private.closure_source_digest_v5() is distinct from v_closure then
    raise exception 'LOCAL_RELIABILITY_CLOSURE_DRIFT';
  end if;
end $local_reliability$;
commit;
`;
}

// The hosted apply_migration transport owns BEGIN + ledger insert + COMMIT.
// Never let the candidate commit before its migration-history write succeeds.
function migrationSql() {
  let source = sql();
  source = replaceOnce(source, '\nbegin;\n', '\n');
  source = replaceOnce(source, '\ncommit;\n', '\n');
  return replaceOnce(source,
    '-- LOCAL CANDIDATE ONLY, NOT APPLIED. Generated by package.cjs; forward.',
    '-- Owner-authorized DEV forward migration. Generated by package.cjs; transaction belongs to the migration runner.');
}

module.exports = { body, md5, replaceOnce, plan, sql, migrationSql };
if (require.main === module) process.stdout.write(JSON.stringify({ forward: sql(), revert: sql('revert') }));
