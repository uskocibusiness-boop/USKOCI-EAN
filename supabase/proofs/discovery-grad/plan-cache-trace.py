"""Project native nested PLACES plans; raw stderr/query/filter literals never leave this process."""
import hashlib
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'discovery'))
from p6_cost_parse import project_plan, walk


def plans(stderr):
    decoder = json.JSONDecoder()
    result = []
    for marker in re.finditer(r'plan:\s*(?=\{)', stderr):
        raw, _ = decoder.raw_decode(stderr[marker.end():])
        query = raw.get('Query Text', '')
        if not re.match(r'\s*with place_base as materialized\s*\(', query, re.I):
            continue
        # Source-derived SPI query: first WITH token, PL/pgSQL INTO target and final semicolon
        # removed, terminal whitespace stripped (PostgreSQL make_execsql_stmt). No token normalization.
        digest = hashlib.sha256(query.replace('\r\n', '\n').encode()).hexdigest()
        if digest != '3f63aaf71e9aff49e00ad0afc1a6224fe79c147010c67e0d8568808e0148133b':
            raise ValueError('PLAN_QUERY_SOURCE_BINDING_CHANGED')
        projected = project_plan(raw['Plan'])
        nodes = list(walk(projected))
        if not any(n.get('Relation Name') == 'needs' for n in nodes):
            raise ValueError('PLAN_NEEDS_RELATION_MISSING')
        if not any('Actual Loops' in n and 'Shared Hit Blocks' in n for n in nodes):
            raise ValueError('PLAN_ACTUAL_BUFFERS_MISSING')
        result.append({'queryTextSha256': digest, 'sample': 0, 'plan': projected, 'nodeCount': len(nodes)})
    if len(result) > 1:
        raise ValueError('PLAN_MULTIPLE_INNER_QUERIES')
    return result


if __name__ == '__main__':
    print(json.dumps(plans(sys.stdin.read()), separators=(',', ':')))
