CREATE OR REPLACE FUNCTION private.work_kinds_v5(p_values text[])
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE PARALLEL SAFE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  closed constant text[] := array['SELIDBE_PREVOZ', 'FIZICKI_POSLOVI', 'MONTAZA_NAMESTAJA', 'SITNE_POPRAVKE', 'MOLERSKI_RADOVI', 'ELEKTRO', 'VODOINSTALATER', 'CISCENJE', 'PRANJE_PEGLANJE', 'BASTA_DVORISTE', 'DOSTAVA'];
  fold_from constant text :=
    chr(269)||chr(263)||chr(353)||chr(273)||chr(382)||chr(268)||chr(262)||chr(352)||
    chr(272)||chr(381)||chr(1040)||chr(1072)||chr(1041)||chr(1073)||chr(1042)||chr(1074)||
    chr(1043)||chr(1075)||chr(1044)||chr(1076)||chr(1026)||chr(1106)||chr(1045)||chr(1077)||
    chr(1046)||chr(1078)||chr(1047)||chr(1079)||chr(1048)||chr(1080)||chr(1032)||chr(1112)||
    chr(1050)||chr(1082)||chr(1051)||chr(1083)||chr(1052)||chr(1084)||chr(1053)||chr(1085)||
    chr(1054)||chr(1086)||chr(1055)||chr(1087)||chr(1056)||chr(1088)||chr(1057)||chr(1089)||
    chr(1058)||chr(1090)||chr(1035)||chr(1115)||chr(1059)||chr(1091)||chr(1060)||chr(1092)||
    chr(1061)||chr(1093)||chr(1062)||chr(1094)||chr(1063)||chr(1095)||chr(1064)||chr(1096);
  fold_to constant text := 'ccsdzccsdzaabbvvggddddeezzzziijjkkllmmnnoopprrssttccuuffhhccccss';
  folded text[];
begin
  -- EX-06 ex06b (S06). The hidden kinds of work (PKG-031b): a closed set of ELEVEN kinds recognised by word stems. The NAMES of the kinds are fixed HERE (a twelfth kind is an owner decision and
  -- needs a new body, never a data row); the STEMS are data: private.marketplace_config rows work_kind:<KIND> (a JSON array of literal lower-case substrings, at least 4 letters) and the
  -- classification version in the row work_kinds_head. Each value is folded first: lower case, Serbian Latin diacritics and the Serbian Cyrillic alphabet to plain Latin letters (the three
  -- Cyrillic digraph letters first), so one Latin stem serves every spelling. A kind is named when a stem occurs inside ONE value (never across two values). Text that names no kind returns
  -- nothing, so an unknown word never matches another unknown word. A registry that is not exactly the head row and the eleven kind rows is refused loudly, never half used; an extra
  -- row work_kind:<anything else> is ignored, so no data row can ever add a kind.
  if p_values is null or cardinality(p_values) = 0 then return '{}'::text[]; end if;
  if not exists(select 1 from private.marketplace_config c
                 where c.key = 'work_kinds_head' and c.value ->> 'schema' = 'WORK_KINDS_HEAD_V1'
                   and c.value -> 'kinds' = to_jsonb(closed) and c.value ->> 'foldVersion' = 'SR_LATIN_CYRILLIC_V1')
     or (select count(*) from private.marketplace_config c
          where starts_with(c.key, 'work_kind:') and substr(c.key, 11) = any(closed)
            and c.value ->> 'schema' = 'WORK_KIND_V1' and c.value ->> 'kind' = substr(c.key, 11)
            and jsonb_typeof(c.value -> 'stems') = 'array') <> cardinality(closed) then
    raise exception 'WORK_KINDS_REGISTRY_INVALID' using errcode = '55000';
  end if;
  select coalesce(array_agg(lower(translate(replace(replace(replace(replace(replace(replace(btrim(v), chr(1033), 'lj'), chr(1113), 'lj'), chr(1034), 'nj'), chr(1114), 'nj'), chr(1039), 'dz'), chr(1119), 'dz'), fold_from, fold_to))), '{}'::text[]) into folded
    from unnest(p_values) v where v is not null;
  return coalesce((
    select array_agg(distinct r.kind order by r.kind)
      from (select substr(c.key, 11) as kind, c.value -> 'stems' as stems
              from private.marketplace_config c
             where starts_with(c.key, 'work_kind:') and substr(c.key, 11) = any(closed)) r
     cross join lateral jsonb_array_elements_text(r.stems) s(stem)
     where length(s.stem) >= 4 and exists(select 1 from unnest(folded) t where strpos(t, s.stem) > 0)
  ), '{}'::text[]);
end;
$function$
