#!/usr/bin/env node
/** Dry by default. Fresh owned conversations only; never Save, activation,
 * publication or a service-role credential. Auth/isolation/unknown-outcome
 * guards are inherited from the existing acceptance harness. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run as runAcceptance, configuration } from './dev_taxonomy_fulltree_acceptance.mjs';

const allowed = new Set(['need-existing-tools','worker-existing-tools','need-novel-tools']);
export function toolsConfiguration(env = process.env, argv = process.argv.slice(2)) {
  if (argv.some(arg => !['--execute','--phase=conversation'].includes(arg)) || env.USKOCI_QA_SAVE_CASES || env.USKOCI_QA_PREPARED_REPORT)
    throw new Error('TOOLS_CONVERSATION_ONLY_NO_SAVE');
  const names = (env.USKOCI_QA_CASES ?? 'need-existing-tools,worker-existing-tools').split(',');
  if (names.length < 2 || names.length > 3 || names.some(name => !allowed.has(name))) throw new Error('TOOLS_CASES_REQUIRED');
  const maxAttempts = Number(env.USKOCI_QA_MAX_ATTEMPTS ?? 3);
  if (!Number.isInteger(maxAttempts) || maxAttempts < names.length || maxAttempts > 3) throw new Error('MAX_3_LOGICAL_REQUESTS');
  const scoped = {...env,USKOCI_QA_CASES:names.join(','),USKOCI_QA_MAX_ATTEMPTS:String(maxAttempts),
    USKOCI_QA_OUT:env.USKOCI_QA_OUT ?? resolve('work','taxonomy-fulltree-20261019','tools-live',new Date().toISOString().replace(/[:.]/g,'-'))};
  const args = argv.includes('--execute') ? ['--execute','--phase=conversation'] : ['--phase=conversation'];
  return {env:scoped,args,config:configuration(scoped,args)};
}

export async function runTools(env = process.env, argv = process.argv.slice(2)) {
  const scoped = toolsConfiguration(env,argv);
  return runAcceptance(scoped.env,scoped.args);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runTools().then(result => { console.log(JSON.stringify(result,null,2)); if(result.failure)process.exitCode=1; })
    .catch(error => { console.error(error instanceof Error ? error.message : 'TOOLS_ACCEPTANCE_FAILED'); process.exitCode=1; });
}
