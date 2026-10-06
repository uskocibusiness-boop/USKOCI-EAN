"""Offline grammar + bounded exact source contract, never a DB/runtime claim."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
import pglast
from pglast.parser import parse_plpgsql_json
d=Path(__file__).resolve().parent
subprocess.run([sys.executable,str(d/'build_sql_candidate.py'),'--check'],check=True)
m=json.loads((d/'sql-manifest.json').read_text())
checks=[]
for name in ['canonical.sql','candidate.sql','compatible-rollback.sql','resume.sql']:
 text=(d/name).read_text(encoding='utf-8'); pglast.parse_sql(text)
 for f in re.finditer(r'create (?:or replace )?function .*?\$function\$;',text,re.S|re.I):
  definition=f.group(0)
  if re.search(r'language plpgsql',definition,re.I):
   syntax=re.sub(r'\bn public\.needs', 'n record',definition)
   syntax=re.sub(r'\bpref public\.worker_match_preferences','pref record',syntax)
   if re.search(r'\ndeclare',syntax,re.I):
    start=syntax.lower().index('declare');end=syntax.lower().index('\nbegin',start)
    dec=re.sub(r'\b(?:public|private)\.[a-z_][a-z_0-9]*(?:%rowtype)?\b','record',syntax[start:end],flags=re.I)
    syntax=syntax[:start]+dec+syntax[end:]
   parse_plpgsql_json(syntax)
  else: pglast.parse_sql(definition.split('$function$')[1])
 for block in re.finditer(r'do (\$[a-z_]+\$)(.*?)\1;',text,re.S|re.I):
  parse_plpgsql_json('create function f() returns void language plpgsql as $syntax$'+block.group(2)+'$syntax$')
 checks.append(name+' SQL/PLpgSQL grammar')
candidate=(d/'candidate.sql').read_text(encoding='utf-8')
rollback=(d/'compatible-rollback.sql').read_text(encoding='utf-8')
assert "'40001'" not in candidate and "'40001'" not in rollback
assert len(m['functions'])==3 and len(m['newFunctions'])==4
assert 'create function public.' not in candidate.lower()
assert 'drop ' not in rollback.lower()
assert "'WORKER_PREFERENCES_V2_PAUSED'" in rollback
assert 'work_notes' not in rollback.split('create or replace function private.worker_work_dispatch_blockers_v2')[1].split('$function$')[1]
assert 'years_experience=' not in candidate and 'set years_experience' not in candidate
assert 'rpc_save_worker_ai_review' not in candidate
assert "'responseAllowed', cardinality(hard) = 0" in candidate
writer=candidate.split('create function private.worker_work_preferences_replace_v2')[1].split('$function$')[1]
assert writer.index('perform private.closure_assert_open(aid)')<writer.index('select * into p from public.app_profiles')<writer.index('perform 1 from public.worker_match_preferences')
assert "p.profile_status not in ('DRAFT','ACTIVE')" in writer
assert all(s in rollback for s in ['to_regprocedure(', 'p.proargnames=', 'p.prosecdef=', 'p.provolatile=', "pg_get_userbyid(p.proowner)='postgres'", 'p.proacl::text=', 'count(*)'])
for name,expected in m['artifact_sha256'].items():
 assert hashlib.sha256((d/name).read_bytes()).hexdigest()==expected,(name,'SHA256')
checks += ['three exact existing body replacements / four private helpers',
 'PT409 / no public entry / no experience or V1 save rewrite',
 'compatible rollback retains all columns and notes, fail-closes opted-in automatic filters',
 'closure-first lock order / editable profile status / rollback exact signature and security metadata']
print('PASS WPP02 '+str(len(checks))+' source/grammar boundaries; PostgreSQL execution remains pending')
