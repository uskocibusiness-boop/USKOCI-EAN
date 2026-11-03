"""Validate captured PostgreSQL function DDL without executing or rewriting it.

The fresh metadata capture is authoritative. Historical source matches are useful
provenance, not a substitute for current definition/body hashes or database parity.
This module neither writes artifacts nor connects to a database. Risk reports never
include matched secret values, function bodies, or snippets.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import subprocess
from typing import Any, Iterable, Iterator, Mapping, Sequence


class FunctionSourceError(ValueError):
    """Incomplete, inconsistent, or unsupported function source."""


@dataclass(frozen=True)
class Token:
    kind: str
    text: str
    start: int
    end: int


@dataclass(frozen=True)
class FunctionSource:
    schema: str
    name: str
    identity_arguments: str
    arguments: str
    language: str
    body: str
    definition: str
    source: str

    @property
    def key(self) -> tuple[str, str, str]:
        return self.schema, self.name, self.identity_arguments

    @property
    def body_md5(self) -> str:
        return md5(self.body)

    @property
    def definition_md5(self) -> str:
        return md5(self.definition)

    @property
    def sql(self) -> str:
        return self.definition.rstrip().removesuffix(";") + ";\n"


def md5(value: str) -> str:
    return hashlib.md5(value.encode("utf-8"), usedforsecurity=False).hexdigest()


_DOLLAR = re.compile(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$")
_WORD = re.compile(r"[A-Za-z_\u0080-\uffff][A-Za-z_0-9$\u0080-\uffff]*")
_CREATE = re.compile(r"\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b", re.I)


def sql_tokens(text: str) -> Iterator[Token]:
    """Lex just enough PostgreSQL SQL to preserve literals and statement bounds.

    Comments (including nested block comments) and whitespace are skipped. Dollar
    bodies remain single tokens, so their internal SQL cannot become a second DDL
    statement. Unsupported or unterminated quoting fails closed.
    """
    pos = 0
    while pos < len(text):
        start = pos
        char = text[pos]
        if char.isspace():
            pos += 1
            continue
        if text.startswith("--", pos):
            end = text.find("\n", pos)
            pos = len(text) if end < 0 else end + 1
            continue
        if text.startswith("/*", pos):
            depth, pos = 1, pos + 2
            while pos < len(text) and depth:
                if text.startswith("/*", pos):
                    depth, pos = depth + 1, pos + 2
                elif text.startswith("*/", pos):
                    depth, pos = depth - 1, pos + 2
                else:
                    pos += 1
            if depth:
                raise FunctionSourceError("Unterminated SQL block comment")
            continue
        dollar = _DOLLAR.match(text, pos)
        if dollar:
            tag = dollar.group()
            end = text.find(tag, dollar.end())
            if end < 0:
                raise FunctionSourceError("Unterminated SQL dollar quote")
            pos = end + len(tag)
            yield Token("dollar", text[start:pos], start, pos)
            continue
        if char in "'\"":
            quote, pos = char, pos + 1
            while pos < len(text):
                if text[pos] == quote:
                    if pos + 1 < len(text) and text[pos + 1] == quote:
                        pos += 2
                        continue
                    pos += 1
                    break
                # E-prefixed strings are tokenized, but rejected as function bodies
                # rather than implementing PostgreSQL escape/encoding semantics.
                if text[pos] == "\\" and start and text[start - 1] in "Ee":
                    pos += 2
                else:
                    pos += 1
            else:
                raise FunctionSourceError("Unterminated SQL quoted token")
            yield Token("string" if quote == "'" else "identifier", text[start:pos], start, pos)
            continue
        word = _WORD.match(text, pos)
        if word:
            pos = word.end()
            yield Token("word", word.group(), start, pos)
            continue
        pos += 1
        yield Token("symbol", char, start, pos)


def _identifier(token: Token) -> str:
    if token.kind == "identifier":
        return token.text[1:-1].replace('""', '"')
    if token.kind == "word":
        return token.text.lower()
    raise FunctionSourceError("Expected SQL identifier")


def parse_function_definition(
    definition: str, *, source: str = "capture", identity_arguments: str = ""
) -> FunctionSource:
    """Parse one complete, schema-qualified CREATE [OR REPLACE] FUNCTION.

    SQL/plpgsql string bodies are supported. SQL-standard BEGIN ATOMIC bodies,
    procedures and native extension functions intentionally require separate work.
    """
    tokens = list(sql_tokens(definition))
    if tokens and tokens[-1].text == ";":
        tokens.pop()
    if any(t.text == ";" for t in tokens):
        raise FunctionSourceError(f"Multiple statements in {source}")
    values = [t.text.upper() if t.kind == "word" else t.text for t in tokens]
    at = 1
    if not values or values[0] != "CREATE":
        raise FunctionSourceError(f"Expected CREATE FUNCTION in {source}")
    if values[at:at + 2] == ["OR", "REPLACE"]:
        at += 2
    if values[at:at + 1] != ["FUNCTION"]:
        raise FunctionSourceError(f"Expected CREATE FUNCTION in {source}")
    at += 1
    if len(tokens) < at + 5 or values[at + 1] != "." or values[at + 3] != "(":
        raise FunctionSourceError(f"Function must be schema-qualified in {source}")
    schema, name = _identifier(tokens[at]), _identifier(tokens[at + 2])
    opening, depth, at = at + 3, 1, at + 4
    while at < len(tokens) and depth:
        if tokens[at].text == "(":
            depth += 1
        elif tokens[at].text == ")":
            depth -= 1
        at += 1
    if depth:
        raise FunctionSourceError(f"Unclosed function arguments in {source}")
    arguments = definition[tokens[opening].end:tokens[at - 1].start]
    language = None
    body = None
    while at < len(tokens):
        token = tokens[at]
        if token.kind == "word" and token.text.upper() == "LANGUAGE":
            if language is not None or at + 1 >= len(tokens):
                raise FunctionSourceError(f"Invalid LANGUAGE in {source}")
            language = _identifier(tokens[at + 1])
            at += 2
            continue
        if token.kind == "word" and token.text.upper() == "AS":
            if body is not None or at + 1 >= len(tokens):
                raise FunctionSourceError(f"Invalid function AS body in {source}")
            literal = tokens[at + 1]
            if literal.kind == "dollar":
                tag = _DOLLAR.match(literal.text).group()
                body = literal.text[len(tag):-len(tag)]
            elif literal.kind == "string":
                body = literal.text[1:-1].replace("''", "'")
            else:
                raise FunctionSourceError(f"Unsupported function body encoding in {source}")
            at += 2
            continue
        at += 1
    if language not in {"sql", "plpgsql"} or body is None:
        raise FunctionSourceError(f"Unsupported or missing language/body in {source}")
    return FunctionSource(schema, name, identity_arguments, arguments, language, body, definition, source)


def load_captured_functions(
    capture: Mapping[str, Any] | str | Path,
    *, schemas: Sequence[str] = ("public", "private", "rls_private"),
) -> list[FunctionSource]:
    """Validate every captured definition/inventory pair, then select app schemas.

    Both bare capture JSON and the managed-evidence wrapper with a ``data`` member
    are accepted. Definition hashes bind every header byte; argument hashes bind
    defaults and modes; body hashes bind every body byte. No normalization is used.
    Managed Auth helpers are validated but excluded from the default result.
    """
    if isinstance(capture, (str, Path)):
        capture = json.loads(Path(capture).read_text(encoding="utf-8-sig"))
    data = capture.get("data", capture)
    inventory = data.get("function_inventory")
    definitions = data.get("function_definitions")
    if not isinstance(inventory, list) or not isinstance(definitions, list) or not inventory:
        raise FunctionSourceError("Capture needs full function_inventory and function_definitions")

    def key(row: Mapping[str, Any]) -> tuple[str, str, str]:
        values = tuple(row.get(k) for k in ("schema", "name", "identity_arguments"))
        if not all(isinstance(value, str) for value in values):
            raise FunctionSourceError("Invalid function identity fields")
        return values

    by_key = {key(row): row for row in inventory}
    if len(by_key) != len(inventory):
        raise FunctionSourceError("Duplicate function inventory identity")
    seen: set[tuple[str, str, str]] = set()
    selected = []
    for row in definitions:
        ident = key(row)
        label = ".".join(ident[:2]) + "(" + ident[2] + ")"
        if ident[0] not in {"public", "private", "rls_private", "auth"}:
            raise FunctionSourceError(f"Function outside captured application/Auth scope: {label}")
        if ident[0] == "auth" and (ident[1] not in {"uid", "jwt", "role", "email"} or ident[2]):
            raise FunctionSourceError(f"Unexpected managed Auth helper: {label}")
        if ident in seen or ident not in by_key:
            raise FunctionSourceError(f"Duplicate or uninventoried definition: {label}")
        seen.add(ident)
        expected = by_key[ident]
        definition = row.get("definition")
        if not isinstance(definition, str):
            raise FunctionSourceError(f"Missing definition: {label}")
        actual = parse_function_definition(definition, source=label, identity_arguments=ident[2])
        checks = {
            "identity": actual.key == ident,
            "body_md5": actual.body_md5 == expected.get("body_md5"),
            "body_chars": len(actual.body) == expected.get("body_chars"),
            "definition_md5": actual.definition_md5 == expected.get("pinned_definition_md5"),
            "arguments_md5": md5(actual.arguments) == expected.get("pinned_arguments_md5"),
            "language": actual.language == expected.get("language"),
            "kind": expected.get("kind") == "f",
        }
        failed = [name for name, passed in checks.items() if not passed]
        if failed:
            raise FunctionSourceError(f"Capture mismatch for {label}: {', '.join(failed)}")
        if actual.schema in schemas:
            selected.append(actual)
    missing = set(by_key) - seen
    if missing:
        raise FunctionSourceError(f"Missing {len(missing)} captured function definitions")
    return sorted(selected, key=lambda item: item.key)


_SECRET_PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "jwt_literal": re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b"),
    "supabase_secret_key": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{16,}\b"),
    "openai_secret_key": re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b"),
    "github_token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b"),
    "aws_access_key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "database_password_url": re.compile(r"\bpostgres(?:ql)?://[^\s'\"/:]+:[^\s'\"/@]+@", re.I),
    "literal_bearer_token": re.compile(r"\bBearer[ \t]+[A-Za-z0-9_./+~-]{24,}", re.I),
}
_WARNING_PATTERNS = {
    "outbound_http": re.compile(r"\b(?:net\s*\.\s*http_\w+|extensions\s*\.\s*http\w*|http_(?:get|post|put|delete))\s*\(", re.I),
    "database_link": re.compile(r"\bdblink\w*\s*\(", re.I),
    "vault_secret_access": re.compile(r"\bvault\s*\.\s*(?:decrypted_secrets|secrets)\b", re.I),
    "dynamic_sql": re.compile(r"\bEXECUTE\b", re.I),
    "server_file_access": re.compile(r"\b(?:pg_read_(?:binary_)?file|pg_ls_dir|lo_import|lo_export)\s*\(", re.I),
    "server_program": re.compile(r"\bCOPY\b[\s\S]{0,200}?\bPROGRAM\b", re.I),
    "scheduled_execution": re.compile(r"\b(?:cron\s*\.\s*(?:schedule|schedule_in_database)|pg_background_launch)\s*\(", re.I),
    "url_literal": re.compile(r"https?://[^\s'\"<>]+", re.I),
}


def scan_publication_risks(functions: Iterable[FunctionSource]) -> dict[str, list[dict[str, Any]]]:
    """Heuristic publication/execution review hints, not a security certification.

    Secret-shaped literals block publication pending review. Dynamic/outbound calls
    require review before executing synthetic fixtures, even when function creation
    itself is harmless. Return identities and line numbers only; never match text.
    """
    report: dict[str, list[dict[str, Any]]] = {"blocking": [], "warnings": []}
    for function in functions:
        for level, patterns in (("blocking", _SECRET_PATTERNS), ("warnings", _WARNING_PATTERNS)):
            for rule, pattern in patterns.items():
                matches = list(pattern.finditer(function.definition))
                if matches:
                    report[level].append({
                        "rule": rule,
                        "schema": function.schema,
                        "name": function.name,
                        "identity_arguments": function.identity_arguments,
                        "count": len(matches),
                        "lines": sorted({function.definition.count("\n", 0, match.start()) + 1 for match in matches}),
                    })
    return report


def scan_sql_fragments(fragments: Iterable[tuple[str, str]]) -> dict[str, list[dict[str, Any]]]:
    """Scan catalog expressions as well as bodies; never return matched values."""
    report: dict[str, list[dict[str, Any]]] = {"blocking": [], "warnings": []}
    for identity, sql in fragments:
        for level, patterns in (("blocking", _SECRET_PATTERNS), ("warnings", _WARNING_PATTERNS)):
            for rule, pattern in patterns.items():
                matches = list(pattern.finditer(sql))
                if matches:
                    report[level].append({"rule": rule, "identity": identity, "count": len(matches)})
    return report


def _json_strings(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        if _CREATE.search(value):
            yield value
        if value.lstrip().startswith(("[", "{")):
            try:
                nested = json.loads(value)
            except (ValueError, RecursionError):
                return
            yield from _json_strings(nested)
    elif isinstance(value, dict):
        for nested in value.values():
            yield from _json_strings(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _json_strings(nested)


def extract_function_sources(text: str, *, source: str) -> Iterator[FunctionSource]:
    """Best-effort historical DDL extraction; never used for current DDL authority.

    Scan raw SQL, nested JSON strings, and JSON double-quoted strings embedded in
    MJS/Python/text. Only complete parseable function statements are returned.
    """
    candidates = [text]
    try:
        candidates.extend(_json_strings(json.loads(text)))
    except (ValueError, RecursionError):
        for match in re.finditer(r'"(?:[^"\\]|\\.)*"', text):
            if _CREATE.search(match.group()):
                try:
                    candidates.extend(_json_strings(json.loads(match.group())))
                except (ValueError, RecursionError):
                    pass
    seen: set[tuple[str, str, str, str]] = set()
    for candidate in candidates:
        for start in _CREATE.finditer(candidate):
            tail = candidate[start.start():]
            try:
                end = len(tail)
                for token in sql_tokens(tail):
                    if token.text == ";":
                        end = token.end
                        break
                function = parse_function_definition(tail[:end], source=source)
            except FunctionSourceError:
                continue
            key = (function.schema, function.name, function.body_md5, function.definition_md5)
            if key not in seen:
                seen.add(key)
                yield function


def bind_tracked_sources(
    functions: Iterable[FunctionSource], repo_root: str | Path,
    *, extra_paths: Iterable[str | Path] = (),
) -> dict[tuple[str, str, str], list[dict[str, str]]]:
    """Find exact schema/name/body-hash matches in Git-tracked source and inputs.

    Missing historical matches do not permit substitutions; the validated fresh
    definition remains the sole bootstrap source. Paths are reported without body
    content. Git's file list avoids node_modules junctions and untracked evidence.
    """
    root = Path(repo_root).resolve()
    desired = list(functions)
    wanted = {(f.schema, f.name, f.body_md5) for f in desired}
    matches: dict[tuple[str, str, str], list[dict[str, str]]] = {key: [] for key in wanted}
    result = subprocess.run(["git", "ls-files", "-z"], cwd=root, check=True, capture_output=True)
    paths: list[tuple[Path, str]] = []
    for name in result.stdout.decode("utf-8").split("\0"):
        if name and Path(name).suffix.lower() in {".sql", ".json", ".mjs", ".py", ".txt"}:
            paths.append((root / name, name))
    for extra in extra_paths:
        path = Path(extra).resolve()
        candidates = sorted(path.rglob("*.json")) if path.is_dir() else [path]
        paths.extend((item, str(item)) for item in candidates)
    for path, label in paths:
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8-sig")
        except UnicodeError:
            continue
        if not _CREATE.search(text):
            continue
        for source in extract_function_sources(text, source=label):
            key = (source.schema, source.name, source.body_md5)
            if key in matches and not any(item["path"] == label for item in matches[key]):
                matches[key].append({"path": label, "body_md5": source.body_md5})
    return {f.key: matches[(f.schema, f.name, f.body_md5)] for f in desired}
