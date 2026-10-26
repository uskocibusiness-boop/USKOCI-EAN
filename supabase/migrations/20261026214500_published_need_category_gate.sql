-- Forward-only publication invariant. Existing historical rows are deliberately
-- not rewritten: NOT VALID admits their audit/repair while enforcing every new
-- PUBLISHED transition.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $category_gate_preflight$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.needs'::regclass
       and conname = 'needs_published_category_required'
  ) then
    raise exception 'PUBLISHED_CATEGORY_GATE_ALREADY_EXISTS';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.needs'::regclass
       and conname = 'needs_category_id_fkey'
       and contype = 'f'
  ) then
    raise exception 'NEEDS_CATEGORY_FOREIGN_KEY_MISSING';
  end if;
end;
$category_gate_preflight$;

alter table public.needs
  add constraint needs_published_category_required
  check (status <> 'PUBLISHED' or category_id is not null) not valid;

comment on constraint needs_published_category_required on public.needs is
  'Forward gate: newly published Needs require the existing canonical taxonomy FK. Historical rows remain auditable until separately repaired.';

commit;
