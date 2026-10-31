"""Verify portable evidence; optionally restore without replacing differing files."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import zipfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_relative(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or '\\' in name or ':' in name or '..' in path.parts:
        raise ValueError(f'Unsafe archive path: {name!r}')
    return Path(*path.parts)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', type=Path, help='Destination workspace root; omit to verify only')
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    manifest = json.loads((base / 'MANIFEST.json').read_text(encoding='utf-8'))
    root = args.restore.resolve() if args.restore else None
    pending = []
    seen = set()
    # Validate every archive, member and existing destination BEFORE writing anything.
    for archive in manifest['archives']:
        file = base / safe_relative(archive['file'])
        raw = file.read_bytes()
        if len(raw) != archive['bytes'] or digest(raw) != archive['sha256']:
            raise ValueError(f'Archive hash/size mismatch: {file.name}')
        with zipfile.ZipFile(file) as z:
            members = [i for i in z.infolist() if not i.is_dir()]
            expected = {i['path']: i for i in archive['entries']}
            if len(members) != len(expected) or {i.filename for i in members} != set(expected):
                raise ValueError(f'Unexpected/duplicate archive members: {file.name}')
            for info in members:
                relative = safe_relative(info.filename)
                if stat.S_ISLNK(info.external_attr >> 16):
                    raise ValueError('Archive symlinks are not supported')
                prefix = archive['restore_prefix']
                if prefix:
                    relative = safe_relative(prefix) / relative
                key = relative.as_posix().casefold()
                if key in seen:
                    raise ValueError(f'Duplicate destination: {relative}')
                seen.add(key)
                data = z.read(info)
                record = expected[info.filename]
                if len(data) != record['bytes'] or digest(data) != record['sha256']:
                    raise ValueError(f'Member hash/size mismatch: {info.filename}')
                if root:
                    target = root / relative
                    if not target.resolve().is_relative_to(root):
                        raise ValueError(f'Destination escapes workspace: {relative}')
                    for parent in [target, *target.parents]:
                        if parent == root:
                            break
                        if parent.is_symlink() or (hasattr(parent, 'is_junction') and parent.is_junction()):
                            raise ValueError(f'Refusing linked destination: {relative}')
                    if target.exists() and (not target.is_file() or target.read_bytes() != data):
                        raise ValueError(f'Existing different file; nothing restored: {relative}')
                    pending.append((target, data))
    written = 0
    for target, data in pending:
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(data)
            written += 1
    print(f'PASS: {len(manifest["archives"])} archives, {len(seen)} exact files; {written} restored.')
    if root:
        print(f'Evidence root: {root}')


if __name__ == '__main__':
    run()
