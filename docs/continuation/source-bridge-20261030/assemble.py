#!/usr/bin/env python3
"""Reconstruct the referenced read-only evidence package, checking every part and SHA-256.

Usage: python docs/continuation/source-bridge-20261030/assemble.py [--restore ../USKOCI_ANALIZE]
Without --restore this verifies the archive but changes nothing.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import io
import json
import pathlib
import stat
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', type=pathlib.Path, default=None,
                        help='Optional workspace directory in which to restore the verified archive')
    args = parser.parse_args()
    manifest = json.loads((HERE/'BUNDLE_MANIFEST.json').read_text(encoding='utf-8'))
    assert manifest['format']=='USKOCI_GITHUB_BRIDGE_PARTS_V1'
    raw_parts = []
    expected_names = {entry['name'] for entry in manifest['parts']}
    found_names = {p.name for p in (HERE/'parts').glob('*.b64.txt')}
    if expected_names != found_names:
        raise ValueError('Mismatched part inventory; missing/extra evidence component')
    for entry in manifest['parts']:
        p = HERE/'parts'/entry['name']
        data = p.read_bytes()
        if len(data) != entry['bytes'] or digest(data) != entry['sha256']:
            raise ValueError('Part content mismatch: '+entry['name'])
        raw_parts.append(b''.join(data.split()))
    archive = base64.b64decode(b''.join(raw_parts),validate=True)
    if len(archive) != manifest['archive_bytes'] or digest(archive) != manifest['archive_sha256']:
        raise ValueError('ZIP digest/size mismatch')
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        items = [i for i in z.infolist() if not i.is_dir()]
        if len(items)!=manifest['zip_files'] or z.testzip() is not None:
            raise ValueError('Archive size/members/CRC invalid')
        names = [pathlib.PurePosixPath(i.filename) for i in items]
        if len(set(names)) != len(names):
            raise ValueError('Duplicate paths')
        for name,item in zip(names,items):
            if (name.is_absolute() or '..' in name.parts or '\\' in str(name) or ':' in str(name)
                    or stat.S_ISLNK(item.external_attr >> 16)):
                raise ValueError('Unsafe archive member: '+str(name))
        if args.restore is None:
            print(f"PASS: {len(manifest['parts'])} GitHub evidence parts, {len(items)} files, SHA-256 {digest(archive)}")
            return
        root=args.restore.resolve()
        writes=[]
        for name,item in zip(names,items):
            path=root.joinpath(*name.parts)
            if not path.resolve().is_relative_to(root):
                raise ValueError('Escaping target')
            for component in [path,*path.parents]:
                if component==root:break
                if component.is_symlink() or (hasattr(component,'is_junction') and component.is_junction()):
                    raise ValueError('Unsafe symlink/junction')
            data=z.read(item)
            if path.exists():
                if not path.is_file() or path.read_bytes()!=data:
                    raise ValueError('Existing file conflict: '+str(path))
            else:
                writes.append((path,data))
        for path,data in writes:
            path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('xb') as f:f.write(data)
        inner=root/'USKOCI_CODEX_BRIDGE_2026-10-30/alati/proveri.py'
        print(f'PASS: {len(items)} verified members; {len(writes)} files restored to {root}')
        print(f'Run: python "{inner}"')

if __name__=='__main__':
    try:run()
    except Exception as exc:
        print('FAIL:',str(exc),file=sys.stderr)
        sys.exit(1)
