"""Build a guarded disposable application schema from a pinned catalog capture.

This is source generation, not deployment or a parity verdict. Inputs and generated
artifacts belong in managed evidence storage. No connection or application row is
read. The generated SQL refuses nonempty targets and needs an explicit local-only
session marker supplied by the independent disposable runtime.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

from function_sources import load_captured_functions, scan_publication_risks, scan_sql_fragments

APP = frozenset(("public", "private", "rls_private"))
PINNED_CAPTURE_SHA256 = "c222414ac222f2beee07f954165abf61ad4bf8b8ba4eebea91e0143784b1a36e"
ACL_PRIVILEGES = {
    "TABLE": dict(r="SELECT", a="INSERT", w="UPDATE", d="DELETE", D="TRUNCATE", x="REFERENCES", t="TRIGGER", m="MAINTAIN"),
    "SEQUENCE": dict(r="SELECT", w="UPDATE", U="USAGE"),
    "FUNCTION": dict(X="EXECUTE"),
    "SCHEMA": dict(U="USAGE", C="CREATE"),
    "COLUMN": dict(r="SELECT", a="INSERT", w="UPDATE", x="REFERENCES"),
}


class BootstrapError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise BootstrapError(message)


def qi(value: str) -> str:
    require(isinstance(value, str) and bool(value) and "\x00" not in value, "Invalid identifier")
    return '"' + value.replace('"', '""') + '"'


def ql(value: str) -> str:
    require(isinstance(value, str) and "\x00" not in value, "Invalid SQL string")
    return "'" + value.replace("'", "''") + "'"


def qualified(schema: str, name: str) -> str:
    return qi(schema) + "." + qi(name)


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def acl_entries(acl: str | None, kind: str) -> list[dict[str, Any]]:
    """Strict observed ACL grammar. Unreviewed quoted role names fail closed."""
    if acl is None:
        return []
    require(acl.startswith("{") and acl.endswith("}"), "Malformed ACL array")
    if acl == "{}":
        return []
    result = []
    for item in acl[1:-1].split(","):
        m = re.fullmatch(r"([A-Za-z_][A-Za-z_0-9$]*|)=([A-Za-z*]*)/([A-Za-z_][A-Za-z_0-9$]*)", item)
        require(m is not None, "Unsupported ACL quoting or shape")
        role, letters, grantor = m.groups()
        privileges = []
        i = 0
        while i < len(letters):
            code = letters[i]
            require(code in ACL_PRIVILEGES[kind], f"Unsupported {kind} ACL privilege code")
            grantable = i + 1 < len(letters) and letters[i + 1] == "*"
            privileges.append((ACL_PRIVILEGES[kind][code], grantable))
            i += 2 if grantable else 1
        result.append(dict(role=role or "PUBLIC", grantor=grantor, privileges=privileges))
    require(len({(r["role"], r["grantor"]) for r in result}) == len(result), "Duplicate ACL entry")
    return result


def role_sql(role: str) -> str:
    return "PUBLIC" if role == "PUBLIC" else qi(role)


def grant_statements(kind: str, target: str, acl: str | None, owner: str, *, column: str | None = None) -> list[str]:
    result = []
    for entry in acl_entries(acl, "COLUMN" if column else kind):
        require(entry["grantor"] == owner, f"Non-owner ACL grantor requires explicit handling: {target}")
        for grantable in (False, True):
            privileges = [name for name, flag in entry["privileges"] if flag == grantable]
            if privileges:
                names = ", ".join(p + (" (" + qi(column) + ")" if column else "") for p in privileges)
                result.append(f"GRANT {names} ON {kind} {target} TO {role_sql(entry['role'])}" +
                              (" WITH GRANT OPTION" if grantable else "") + ";")
    return result


def sequence_options(sequence: dict[str, Any]) -> str:
    require(sequence["type"] in ("smallint", "integer", "bigint"), "Unsupported sequence type")
    numbers = [sequence[k] for k in ("start", "increment", "min", "max", "cache")]
    # JSON numbers lose int64 precision in JavaScript transports. Format 3 uses
    # decimal strings, never a rounded float or scientific notation.
    require(all(isinstance(x, str) and re.fullmatch(r"0|-?[1-9][0-9]*", x) for x in numbers), "Sequence options must be canonical decimal strings")
    start, increment, minimum, maximum, cache = map(int, numbers)
    bounds = {"smallint": (-32768, 32767), "integer": (-2147483648, 2147483647), "bigint": (-9223372036854775808, 9223372036854775807)}
    low, high = bounds[sequence["type"]]
    require(low <= minimum <= start <= maximum <= high and increment != 0 and cache >= 1,
            "Sequence options exceed source type bounds")
    require(isinstance(sequence["cycle"], bool), "Sequence cycle must be boolean")
    return (f"START WITH {sequence['start']} INCREMENT BY {sequence['increment']} "
            f"MINVALUE {sequence['min']} MAXVALUE {sequence['max']} CACHE {sequence['cache']} "
            + ("CYCLE" if sequence["cycle"] else "NO CYCLE"))


def stable_key(section: str, row: dict[str, Any]) -> str:
    if section == "function_inventory":
        return f"{row['schema']}.{row['name']}({row['identity_arguments']})"
    if section in ("constraints", "indexes", "policies", "triggers"):
        return f"{row['schema']}.{row['relation']}.{row['name']}"
    if section == "schemas":
        return row["name"]
    if section == "default_acl":
        return f"{row['owner']}:{row['schema']}:{row['kind']}"
    return f"{row['schema']}.{row['name']}"


def is_app_hook(row: dict[str, Any]) -> bool:
    return row["schema"] in APP or any(row["function_signature"].startswith(s + ".") for s in APP)


def default_acl_statements(rows: list[dict[str, Any]]) -> list[str]:
    """Restore only postgres defaults in the three application namespaces.

    Global defaults and managed owners are separate platform contracts. A fresh
    target must not have postgres global defaults absent from this capture.
    """
    require(all(r["owner"] == "postgres" and r["schema"] in APP and r["kind"] in ("r", "S", "f") for r in rows),
            "Unsupported application default ACL")
    result = ["DO $r01_default_reset$ DECLARE target record; principal oid; BEGIN",
        "  IF EXISTS (SELECT 1 FROM pg_default_acl WHERE defaclrole='postgres'::regrole AND defaclnamespace=0) THEN",
        "    RAISE EXCEPTION 'R01_UNEXPECTED_GLOBAL_POSTGRES_DEFAULT_ACL'; END IF;",
        "  FOR target IN SELECT d.defaclobjtype AS kind,n.nspname AS schema,d.defaclacl AS acl",
        "    FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace",
        "    WHERE d.defaclrole='postgres'::regrole AND n.nspname IN ('public','private','rls_private') LOOP",
        "    IF target.kind NOT IN ('r','S','f') THEN RAISE EXCEPTION 'R01_UNSUPPORTED_APP_DEFAULT_ACL'; END IF;",
        "    FOR principal IN SELECT DISTINCT grantee FROM aclexplode(target.acl) LOOP",
        "      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL PRIVILEGES ON %s FROM %s',",
        "        target.schema,CASE target.kind WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' ELSE 'FUNCTIONS' END,",
        "        CASE WHEN principal=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(principal)) END);",
        "    END LOOP;",
        "  END LOOP; END $r01_default_reset$;"]
    for row in rows:
        kind, plural = {"r": ("TABLE", "TABLES"), "S": ("SEQUENCE", "SEQUENCES"), "f": ("FUNCTION", "FUNCTIONS")}[row["kind"]]
        for entry in acl_entries(row["acl"], kind):
            require(entry["grantor"] == "postgres", "Non-owner default ACL grantor")
            for grantable in (False, True):
                privileges = [name for name, flag in entry["privileges"] if flag == grantable]
                if privileges:
                    result.append(f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA {qi(row['schema'])} GRANT "
                        + ", ".join(privileges) + f" ON {plural} TO {role_sql(entry['role'])}"
                        + (" WITH GRANT OPTION" if grantable else "") + ";")
    return result


def build(capture_path: Path, expected_sha256: str) -> tuple[str, dict[str, Any], dict[str, Any]]:
    raw = capture_path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == expected_sha256, "Capture SHA256 mismatch")
    wrapper = json.loads(raw)
    data = wrapper.get("data", wrapper)
    require(data.get("format_version") == 3 and data.get("unit") == "R01_BOOTSTRAP_METADATA_ONLY", "Expected lossless capture format 3")
    require(data.get("transaction_read_only") == "on", "Capture is not read-only")
    require(data.get("normalization", {}).get("search_path") == "pg_catalog", "Unpinned capture search_path")
    require(data.get("server_version_num", 0) // 10000 == 17, "Expected PostgreSQL 17 capture")
    require(all(data.get("required_objects", {}).values()) and len(data.get("required_objects", {})) == 5, "Incomplete source admission")
    require(data.get("unsupported_shapes") and all(v == [] for v in data["unsupported_shapes"].values()), "Unsupported source catalog objects")
    sections = data["catalog_sections"]
    for name, rows in sections.items():
        require(isinstance(rows, list) and len(rows) == data["normalized_sections"][name]["row_count"], f"Section cardinality mismatch: {name}")
    functions = load_captured_functions(data)
    risks = scan_publication_risks(functions)
    require(not risks["blocking"], "Publication scan found a high-confidence secret; do not export")
    inventory = {(f["schema"], f["name"], f["identity_arguments"]): f for f in sections["function_inventory"] if f["schema"] in APP}
    require(len(inventory) == len(functions) == 682, "Unexpected application function inventory")
    relations = sections["application_relations"]
    require(len({(r['schema'], r['name']) for r in relations}) == len(relations) == 176, "Application relation inventory changed")
    tables = [r for r in relations if r["kind"] == "r"]
    fragments = [(f"column:{r['schema']}.{r['name']}.{c['name']}", c["default_or_generated"])
                 for r in tables for c in r["columns"] if c["default_or_generated"]]
    for name in ("constraints", "indexes", "policies"):
        for row in sections[name]:
            for field in ("definition", "using_expression", "with_check_expression"):
                if row.get(field):
                    fragments.append((f"{name}:{stable_key(name,row)}:{field}", row[field]))
    expression_risks = scan_sql_fragments(fragments)
    for level in risks:
        risks[level].extend(expression_risks[level])
    require(not risks["blocking"], "Catalog expression publication scan found a high-confidence secret")
    sequences = data["sequences"]
    require(len(tables) == 167 and len(sequences) == 9, "Unexpected table/sequence coverage")
    require(all(r["schema"] in APP and r["owner"] == "postgres" for r in relations), "Unsupported relation owner/schema")
    require(all(f["owner"] == "postgres" for f in inventory.values()), "Unsupported function owner")
    require(all(r["persistence"] == "p" and not r["is_partition"] and not r["options"] and r["tablespace"] is None
                and r["replica_identity"] in ("d", "n") for r in relations), "Unsupported physical relation options")
    require(all(r["access_method"] == "heap" for r in tables), "Unsupported table access method")
    require(all(r["replica_identity"] == "d" for r in tables), "Unsupported table replica identity")
    app_defaults = [r for r in sections["default_acl"] if r["owner"] == "postgres" and r["schema"] in APP]
    require(not any(r["owner"] == "postgres" and r["schema"] is None for r in sections["default_acl"]),
            "Global postgres defaults require explicit bootstrap handling")
    seq_by_column = {}
    for sequence in sequences:
        require(sequence["schema"] in APP and len(sequence["owned_by"]) == 1, "Sequence needs one application owner")
        owner = sequence["owned_by"][0]
        key = owner["schema"], owner["relation"], owner["column"]
        require(key not in seq_by_column and owner["dependency_kind"] in ("a", "i"), "Ambiguous sequence ownership")
        seq_by_column[key] = sequence
        sequence_options(sequence)
    early = [f for f in functions if f.key == ("private", "taxonomy_normalize_v1", "p_value text")]
    require(len(early) == 1, "Missing exact generated-column normalizer")
    sql = ["-- Generated disposable R01 application schema. No business/reference/certificate rows.",
           "-- This source is NOT a product migration or a successful parity/HTTP proof.",
           f"-- Input SHA256: {expected_sha256}", "BEGIN;", "SET LOCAL statement_timeout = '120s';",
           "SET LOCAL lock_timeout = '5s';", "SET LOCAL search_path = pg_catalog;",
           "SET LOCAL check_function_bodies = off;",
           "DO $r01_admission$ BEGIN",
           "  IF current_setting('uskoci.r01.bootstrap', true) IS DISTINCT FROM 'LOCAL_ONLY'",
           "     OR current_setting('server_version_num')::integer / 10000 <> 17",
           "     OR current_user <> 'postgres' OR current_database() <> 'postgres' THEN",
           "    RAISE EXCEPTION 'R01_BOOTSTRAP_NOT_ADMITTED'; END IF;",
           "  IF current_setting('supautils.privileged_role',true) IS DISTINCT FROM 'postgres'",
           "     OR (SELECT rolsuper FROM pg_roles WHERE rolname='postgres') THEN",
           "    RAISE EXCEPTION 'R01_SUPAUTILS_PRIVILEGED_NONSUPER_POSTGRES_REQUIRED'; END IF;",
           "  IF EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('private','rls_private') AND n.nspowner<>'postgres'::regrole)",
           "     OR (SELECT nspowner FROM pg_namespace WHERE nspname='public') IS DISTINCT FROM 'pg_database_owner'::regrole THEN",
           "    RAISE EXCEPTION 'R01_APPLICATION_SCHEMA_OWNER_MISMATCH'; END IF;",
           "  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
           "      WHERE n.nspname IN ('public','private','rls_private') AND c.relkind IN ('r','p','v','m','f','S','c')",
           "      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid",
           "        AND d.refclassid='pg_extension'::regclass AND d.deptype='e')) THEN",
           "    RAISE EXCEPTION 'R01_BOOTSTRAP_APPLICATION_TARGET_NOT_EMPTY'; END IF;",
           "  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace",
           "      WHERE n.nspname IN ('public','private','rls_private') AND NOT EXISTS",
           "      (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid",
           "        AND d.refclassid='pg_extension'::regclass AND d.deptype='e')) THEN",
           "    RAISE EXCEPTION 'R01_BOOTSTRAP_FUNCTION_TARGET_NOT_EMPTY'; END IF;",
           "  IF to_regclass('auth.users') IS NULL OR to_regclass('auth.identities') IS NULL",
           "     OR to_regclass('auth.sessions') IS NULL OR to_regclass('auth.refresh_tokens') IS NULL",
           "     OR to_regclass('storage.objects') IS NULL OR to_regclass('realtime.messages') IS NULL THEN",
           "    RAISE EXCEPTION 'R01_BOOTSTRAP_MANAGED_PLATFORM_MISSING'; END IF;",
           "END $r01_admission$;",
           "CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;",
           "CREATE SCHEMA IF NOT EXISTS rls_private AUTHORIZATION postgres;"]
    # Extensions are platform prerequisites, never silently installed/upgraded here.
    extension_checks = []
    for extension in data["extensions"]:
        extension_checks.append(f"({ql(extension['name'])},{ql(extension['schema'])},{ql(extension['version'])})")
    sql[8:8] = ["-- Exact extension versions/schemas are checked before any application DDL."]
    guard_end = sql.index("END $r01_admission$;")
    sql[guard_end:guard_end] = [
        "  IF EXISTS (SELECT 1 FROM (VALUES " + ",".join(extension_checks) + ") expected(name,schema,version)",
        "      LEFT JOIN pg_extension e ON e.extname=expected.name LEFT JOIN pg_namespace n ON n.oid=e.extnamespace",
        "      WHERE e.oid IS NULL OR n.nspname<>expected.schema OR e.extversion<>expected.version) THEN",
        "    RAISE EXCEPTION 'R01_BOOTSTRAP_EXTENSION_PREREQUISITE_MISMATCH'; END IF;"]
    sql.extend(default_acl_statements(app_defaults))
    sql.append(early[0].sql)
    for sequence in sequences:
        if sequence["owned_by"][0]["dependency_kind"] == "a":
            sql.append(f"CREATE SEQUENCE {qualified(sequence['schema'], sequence['name'])} AS {sequence['type']} {sequence_options(sequence)};")
    dropped_columns = []
    deferred_defaults = []
    for table in tables:
        target = qualified(table["schema"], table["name"])
        columns = {c["position"]: c for c in table["columns"]}
        dropped = set(table["dropped_column_positions"])
        positions = set(columns) | dropped
        require(positions == set(range(1, max(positions, default=0) + 1)), f"Unknown column ordinal gap: {target}")
        definitions = []
        for position in sorted(positions):
            if position in dropped:
                name = f"_r01_dropped_ordinal_{position}"
                require(name not in {c['name'] for c in columns.values()}, "Dropped-slot placeholder collision")
                definitions.append(qi(name) + " integer")
                dropped_columns.append(f"ALTER TABLE {target} DROP COLUMN {qi(name)};")
                continue
            column = columns[position]
            definition = qi(column["name"]) + " " + column["type"]
            if column["collation"]:
                definition += " COLLATE " + column["collation"]
            if column["identity"]:
                sequence = seq_by_column.get((table["schema"], table["name"], column["name"]))
                require(sequence and sequence["owned_by"][0]["dependency_kind"] == "i", "Identity sequence metadata missing")
                require(column["identity"] in ("a", "d") and not column["generated"], "Unsupported identity declaration")
                definition += " GENERATED " + ("ALWAYS" if column["identity"] == "a" else "BY DEFAULT")
                definition += f" AS IDENTITY (SEQUENCE NAME {qualified(sequence['schema'],sequence['name'])} {sequence_options(sequence)})"
            elif column["generated"]:
                require(column["generated"] == "s" and column["default_or_generated"], "Unsupported generated column")
                require((table["schema"], table["name"], column["name"]) in {
                    ("private", "work_taxonomy_aliases", "normalized_key"),
                    ("public", "needs", "approx_geog"),
                    ("public", "worker_match_preferences", "approximate_geog")}, "Unreviewed generated-column dependency")
                definition += " GENERATED ALWAYS AS (" + column["default_or_generated"] + ") STORED"
            elif column["default_or_generated"] is not None:
                deferred_defaults.append(f"ALTER TABLE {target} ALTER COLUMN {qi(column['name'])} SET DEFAULT {column['default_or_generated']};")
            if column["not_null"]:
                definition += " NOT NULL"
            definitions.append(definition)
        sql.append(f"CREATE TABLE {target} (\n  " + ",\n  ".join(definitions) + "\n);")
    sql.extend(dropped_columns)
    for sequence in sequences:
        owner = sequence["owned_by"][0]
        if owner["dependency_kind"] == "a":
            sql.append(f"ALTER SEQUENCE {qualified(sequence['schema'],sequence['name'])} OWNED BY {qualified(owner['schema'],owner['relation'])}.{qi(owner['column'])};")
    sql.extend(f.sql for f in functions if f not in early)
    sql.extend(deferred_defaults)
    # Restore explicit TOAST storage/compression rather than assuming type defaults.
    storage_names = dict(p="PLAIN", e="EXTERNAL", m="MAIN", x="EXTENDED")
    for table in tables:
        for column in table["columns"]:
            require(column["storage"] in storage_names and column["compression"] in ("", "p", "l"), "Unsupported column storage")
            sql.append(f"ALTER TABLE {qualified(table['schema'],table['name'])} ALTER COLUMN {qi(column['name'])} SET STORAGE {storage_names[column['storage']]};")
            if column["compression"]:
                sql.append(f"ALTER TABLE {qualified(table['schema'],table['name'])} ALTER COLUMN {qi(column['name'])} SET COMPRESSION " +
                           ("pglz" if column["compression"] == "p" else "lz4") + ";")
    constraints = [r for r in sections["constraints"] if r["schema"] in APP]
    order = dict(p=0, u=1, c=2, x=3, f=4, t=5)
    require(all(r["kind"] in order for r in constraints), "Unsupported constraint kind")
    for row in sorted(constraints, key=lambda r: (order[r["kind"]], stable_key("constraints", r))):
        if row["kind"] != "t":
            sql.append(f"ALTER TABLE {qualified(row['schema'],row['relation'])} ADD CONSTRAINT {qi(row['name'])} {row['definition']};")
    indexes = [r for r in sections["indexes"] if r["schema"] in APP]
    for row in indexes:
        require(row["valid"] and row["ready"] and row["live"] and not row["replica_identity"], "Nonstandard index state")
        if not row["constraints"]:
            sql.append(row["definition"].rstrip(";") + ";")
    policies = [r for r in sections["policies"] if r["schema"] in APP or r["schema"] == "storage"]
    commands = {"r": "SELECT", "a": "INSERT", "w": "UPDATE", "d": "DELETE", "*": "ALL"}
    for row in policies:
        require(row["command"] in commands, "Unsupported RLS command")
        statement = f"CREATE POLICY {qi(row['name'])} ON {qualified(row['schema'],row['relation'])} AS "
        statement += ("PERMISSIVE" if row["permissive"] else "RESTRICTIVE") + " FOR " + commands[row["command"]]
        statement += " TO " + ", ".join(role_sql(r) for r in row["roles"])
        if row["using_expression"] is not None:
            statement += " USING (" + row["using_expression"] + ")"
        if row["with_check_expression"] is not None:
            statement += " WITH CHECK (" + row["with_check_expression"] + ")"
        sql.append(statement + ";")
    for table in tables:
        target = qualified(table["schema"], table["name"])
        sql.append(f"ALTER TABLE {target} " + ("ENABLE" if table["rls"] else "DISABLE") + " ROW LEVEL SECURITY;")
        sql.append(f"ALTER TABLE {target} " + ("FORCE" if table["force_rls"] else "NO FORCE") + " ROW LEVEL SECURITY;")
    hooks = [r for r in sections["triggers"] if is_app_hook(r)]
    constraint_trigger_keys = {(r['schema'],r['relation'],r['name']) for r in constraints if r['kind']=='t'}
    require(constraint_trigger_keys <= {(r['schema'],r['relation'],r['name']) for r in hooks}, "Constraint trigger definition missing")
    for row in hooks:
        sql.append(row["definition"].rstrip(";") + ";")
        enable = {"O": "ENABLE", "A": "ENABLE ALWAYS", "R": "ENABLE REPLICA", "D": "DISABLE"}
        require(row["enabled"] in enable, "Unknown trigger state")
        # CREATE TRIGGER already yields O. Avoid an unnecessary owner-only ALTER
        # on managed Auth/Storage tables where postgres has TRIGGER privileges.
        if row["enabled"] != "O":
            sql.append(f"ALTER TABLE {qualified(row['schema'],row['relation'])} {enable[row['enabled']]} TRIGGER {qi(row['name'])};")
    # Object ACL reset uses the target's actual catalog, including unexpected grants.
    acl_targets = []
    for row in relations:
        kind = "SEQUENCE" if row["kind"] == "S" else "TABLE"
        acl_targets.append((kind, qualified(row['schema'],row['name']), row["acl"], row["owner"]))
    for function in functions:
        row = inventory[function.key]
        acl_targets.append(("FUNCTION", qualified(function.schema,function.name) + "(" + function.identity_arguments + ")", row["acl"], row["owner"]))
    for row in sections["schemas"]:
        if row["name"] in APP:
            acl_targets.append(("SCHEMA", qi(row["name"]), row["acl"], row["owner"]))
    # Identity arguments include argument names, which are valid in GRANT but
    # invalid in regprocedure text input. Match their pinned catalog rendering.
    function_keys = {qualified(f.schema,f.name) + "(" + f.identity_arguments + ")": f.key for f in functions}
    values_rows = []
    for kind, target, acl, _ in acl_targets:
        fields = [ql(kind), ql(target), "NULL" if acl is None else ql(acl)]
        if kind == "FUNCTION":
            fields.extend(ql(v) for v in function_keys[target])
        else:
            fields.extend(["NULL"] * 3)
        values_rows.append("(" + ",".join(fields) + ")")
    values = ",\n".join(values_rows)
    sql.extend(["DO $r01_acl_reset$ DECLARE target record; prior aclitem[]; principal oid; owner_id oid; BEGIN",
        "FOR target IN SELECT * FROM (VALUES " + values + ") v(kind,object_name,expected_acl,object_schema,object_basename,identity_arguments) LOOP",
        "  IF target.kind='FUNCTION' THEN SELECT p.proacl,p.proowner INTO STRICT prior,owner_id FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace",
        "    WHERE n.nspname=target.object_schema AND p.proname=target.object_basename AND pg_get_function_identity_arguments(p.oid)=target.identity_arguments;",
        "  ELSIF target.kind='SCHEMA' THEN SELECT nspacl,nspowner INTO prior,owner_id FROM pg_namespace WHERE oid=to_regnamespace(target.object_name);",
        "  ELSE SELECT relacl,relowner INTO prior,owner_id FROM pg_class WHERE oid=to_regclass(target.object_name); END IF;",
        "  IF owner_id IS NULL THEN RAISE EXCEPTION 'R01_ACL_TARGET_MISSING'; END IF;",
        "  IF target.expected_acl IS NULL THEN",
        "    IF prior IS NOT NULL THEN RAISE EXCEPTION 'R01_NULL_ACL_PREDECESSOR_MISMATCH: %',target.object_name; END IF;",
        "  ELSE",
        "    FOR principal IN SELECT DISTINCT grantee FROM aclexplode(coalesce(prior,acldefault(",
        "      CASE target.kind WHEN 'FUNCTION' THEN 'f' WHEN 'SCHEMA' THEN 'n' WHEN 'SEQUENCE' THEN 'S' ELSE 'r' END::\"char\",owner_id))) LOOP",
        "      EXECUTE format('REVOKE ALL PRIVILEGES ON %s %s FROM %s',target.kind,target.object_name,",
        "        CASE WHEN principal=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(principal)) END);",
        "    END LOOP;",
        "  END IF; END LOOP; END $r01_acl_reset$;"])
    for kind, target, acl, owner in acl_targets:
        sql.extend(grant_statements(kind, target, acl, owner))
    for table in tables:
        for column in table["columns"]:
            if column["acl"] is not None:
                sql.extend(grant_statements("TABLE", qualified(table['schema'],table['name']), column["acl"], table["owner"], column=column["name"]))
    # Only the application pre-request hook is configured; no hosted URL or secret.
    pre_request = [r for r in sections["safe_role_settings"] if r["role"] == "authenticator" and r["database"] is None
                   and r["setting"].startswith("pgrst.db_pre_request=")]
    require(len(pre_request) == 1 and pre_request[0]["setting"] == "pgrst.db_pre_request=public.rpc_closure_api_guard", "Unexpected pre-request authority")
    sql.append("ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.rpc_closure_api_guard';")
    events = [r for r in data["event_triggers"] if any(r["function_signature"].startswith(s + ".") for s in APP)]
    for row in events:
        require(row["owner"] == "postgres" and row["event"] in ("ddl_command_end", "ddl_command_start", "sql_drop", "table_rewrite"), "Unsupported event trigger")
        statement = f"CREATE EVENT TRIGGER {qi(row['name'])} ON {row['event']}"
        if row["tags"]:
            statement += " WHEN TAG IN (" + ",".join(ql(t) for t in row["tags"]) + ")"
        statement += " EXECUTE FUNCTION " + row["function_signature"] + ";"
        sql.append(statement)
        sql.append(f"ALTER EVENT TRIGGER {qi(row['name'])} " + {"O":"ENABLE", "A":"ENABLE ALWAYS", "R":"ENABLE REPLICA", "D":"DISABLE"}[row["enabled"]] + ";")
    sql.extend(["SET LOCAL check_function_bodies = on;", "NOTIFY pgrst, 'reload schema';", "NOTIFY pgrst, 'reload config';", "COMMIT;"])
    text = "\n\n".join(sql) + "\n"
    # Sanitized manifest carries identities and hashes, not raw catalog rows or SQL.
    selected = {
        "application_relations": relations,
        "function_inventory": [inventory[f.key] for f in functions],
        "constraints": constraints, "indexes": indexes, "policies": policies,
        "triggers": hooks,
        "schemas": [r for r in sections["schemas"] if r["name"] in APP],
        "default_acl": app_defaults,
    }
    manifest_sections = {}
    for name, rows in selected.items():
        keyed = sorted(((stable_key(name, row), row) for row in rows), key=lambda pair: pair[0])
        require(len({key for key, _ in keyed}) == len(keyed), f"Duplicate object identity: {name}")
        manifest_sections[name] = {"row_count": len(keyed), "sha256": digest([row for _,row in keyed]),
            "objects": [{"identity": key, "sha256": digest(row)} for key,row in keyed]}
    manifest = dict(format_version=1, unit="R01_BOOTSTRAP_OBJECT_PROVENANCE", status="GENERATED_NOT_EXECUTED",
        input_capture_sha256=expected_sha256, source_head=wrapper.get("source_head"),
        sql_sha256=hashlib.sha256(text.encode()).hexdigest(), canonical_json="UTF-8; recursive sorted object keys; compact separators; non-ASCII literal",
        sections=manifest_sections, sequence_options_sha256=digest(sequences),
        application_event_triggers_sha256=digest(events), pre_request=pre_request[0]["setting"],
        prerequisite_extensions=[{k:r[k] for k in ('name','schema','version')} for r in data["extensions"]],
        managed_platform_mutations="Only captured application policies/hooks on existing Storage/Auth relations and the application pre-request setting.",
        excluded_from_generated_ddl=["4 managed Auth helper functions", "managed Auth/Storage/Realtime table definitions", "2 managed Storage triggers",
            "hosted operational roles/memberships", "managed owner default ACL", "managed event triggers", "business/reference/certificate/cron state"],
        limitations=["Generated source is not a successful bootstrap, catalog parity, Auth or PostgREST proof.",
            "Runtime must confirm a new disposable loopback target, platform prerequisites and actual post-bootstrap parity.",
            "No reference/policy/certificate rows are copied; proof fixtures require their own explicit contract."])
    coverage = dict(format_version=1, unit="R01_BOOTSTRAP_GENERATION_COVERAGE", result="SOURCE_GENERATED_RUNTIME_UNVERIFIED",
        counts=dict(tables=len(tables), sequences=len(sequences), functions=len(functions), constraints=len(constraints),
            explicit_constraints=sum(r['kind'] != 't' for r in constraints),
            indexes=len(indexes), standalone_indexes=sum(not r['constraints'] for r in indexes), policies=len(policies),
            triggers=len(hooks), dropped_column_slots=len(dropped_columns), application_event_triggers=len(events)),
        publication_risks=risks, input_capture_sha256=expected_sha256, output_sql_sha256=manifest['sql_sha256'])
    return text, manifest, coverage


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", type=Path, required=True)
    parser.add_argument("--capture-sha256", default=PINNED_CAPTURE_SHA256)
    parser.add_argument("--output-directory", type=Path, required=True, help="Prepared managed temporary artifact directory, outside the repository")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[4]
    output = args.output_directory.resolve()
    require(not output.is_relative_to(repo), "Generated evidence/source must be staged outside the repository")
    require(output.is_dir(), "Prepare the managed temporary output directory before generation")
    text, manifest, coverage = build(args.capture, args.capture_sha256)
    artifacts = {"current-application.sql": text,
        "current-generation-manifest.json": json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        "current-generation-coverage.json": json.dumps(coverage, ensure_ascii=False, indent=2) + "\n"}
    require(not any((output/name).exists() for name in artifacts), "Output already exists; use a fresh managed staging directory")
    for name, content in artifacts.items():
        (output/name).write_text(content, encoding="utf-8", newline="\n")
    print(json.dumps({"status": coverage["result"], "counts": coverage["counts"], "sql_sha256": manifest["sql_sha256"],
        "publication_blockers": len(coverage["publication_risks"]["blocking"]),
        "publication_warnings": len(coverage["publication_risks"]["warnings"])}))


if __name__ == "__main__":
    try:
        main()
    except (BootstrapError, ValueError, KeyError) as error:
        raise SystemExit(f"R01_GENERATION_REFUSED: {error}") from error
