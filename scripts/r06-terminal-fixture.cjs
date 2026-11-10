'use strict';

// Preserve the existing R06 fixture, but exercise the newly changed QA expiry
// branch with its actual captured constraints, RLS and closure trigger.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=require('./r06-pre-provider-input-fixture.cjs');
const {tableSql}=require('./r06-prepared-dev-package.cjs');
const captured=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_terminal_dev_20261110.dependencies.json'),'utf8')).tables[0];
const quote=value=>'"'+value.replaceAll('"','""')+'"';
async function fixture(options={}){
 const f=await base.fixture(options);
 try{
  assert.equal(captured.relation,'private.qa_ai_commands');
  for(const column of captured.columns){
   if(column.default)await f.db.exec(`alter table private.qa_ai_commands alter column ${quote(column.name)} set default ${column.default}`);
   if(column.not_null)await f.db.exec(`alter table private.qa_ai_commands alter column ${quote(column.name)} set not null`);
  }
  for(const constraint of captured.constraints)await f.db.exec(`alter table private.qa_ai_commands add constraint ${quote(constraint.name)} ${constraint.definition}`);
  for(const trigger of captured.triggers)await f.db.exec(trigger.definition);
  await f.db.exec('alter table private.qa_ai_commands enable row level security');
  if(captured.force_rls)await f.db.exec('alter table private.qa_ai_commands force row level security');
  const actual=(await f.db.query(tableSql("'private.qa_ai_commands'"))).rows[0].jsonb_build_object;
  // PGlite's PostgreSQL 18 also stores NOT NULL as catalog constraints; PG17
  // represents the same rule in attnotnull. Column nullability remains exact,
  // and the operation test uses the full actual local metadata, including n.
  assert.deepEqual({...actual,constraints:actual.constraints.filter(c=>c.type!=='n')},captured,
   'QA fixture must match the live captured dependency and nullability');
  return {...f,terminalDependencies:{projectRef:'leqcwgzvjsxugfgzdmth',tables:[actual]}};
 }catch(error){await f.db.close();throw error;}
}
module.exports={...base,fixture};
