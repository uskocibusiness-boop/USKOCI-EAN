"""One-shot, fail-closed archive retirement on isolated cleanup branch; never execute against DEV."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

BASE = "f554e77144840b960b74d4240d23936e365a8594"
ROOT = Path.cwd()

def git(*args, binary=False):
    data = subprocess.check_output(["git", *args])
    return data if binary else data.decode().strip()

def edit_once(relative, old, new):
    file = ROOT / relative
    data = file.read_text(encoding="utf-8")
    if data.count(old) != 1:
        raise RuntimeError("SOURCE_ANCHOR_CHANGED: " + relative + ": " + old[:40])
    file.write_text(data.replace(old, new, 1), encoding="utf-8")

def main():
    if git("rev-parse", "--show-toplevel") != str(ROOT):
        raise RuntimeError("NOT_REPO_ROOT")
    if os.environ.get("BASE_SHA") != BASE:
        raise RuntimeError("UNPINNED_SOURCE")
    if git("status", "--porcelain"):
        raise RuntimeError("DIRTY_WORKTREE")
    changed = set(git("diff","--name-only",BASE,"HEAD").splitlines())
    expected = {".github/workflows/uskoci-retire-archives-once.yml", "scripts/archive_cleanup_once.py"}
    if changed != expected:
        raise RuntimeError("UNEXPECTED_WORKTREE_CHANGES: " + str(changed ^ expected))
    legacy = json.loads((ROOT / "docs/continuation/MANIFEST.json").read_text())
    bridge = json.loads((ROOT / "docs/continuation/source-bridge-20261030/BUNDLE_MANIFEST.json").read_text())
    if len(legacy["archives"]) != 3 or len(bridge["parts"]) != 17:
        raise RuntimeError("ARCHIVE_INVENTORY_CHANGED")
    wanted = ([
        ("docs/continuation/" + r["file"],r["bytes"],r["sha256"]) for r in legacy["archives"]
    ] + [
        ("docs/continuation/source-bridge-20261030/parts/" + r["name"],r["bytes"],r["sha256"]) for r in bridge["parts"]
    ])
    if len(wanted) != 20 or len({p for p,_,_ in wanted}) != 20:
        raise RuntimeError("ARCHIVE_TARGET_COUNT")
    receipt = []
    for p,size,digest in wanted:
        f=ROOT/p
        content=f.read_bytes()
        if len(content) != size or hashlib.sha256(content).hexdigest() != digest:
            raise RuntimeError("ARCHIVE_PREIMAGE_MISMATCH: " + p)
        if git("show", BASE + ":" + p, binary=True) != content:
            raise RuntimeError("ARCHIVE_NOT_RECOVERABLE_FROM_HISTORY: " + p)
        receipt.append({"path":p,"bytes":size,"sha256":digest,"gitBlob":git("hash-object",p)})
    edit_once("docs/continuation/restore.py",
        "import zipfile\n", "import zipfile\nimport io\nimport subprocess\n")
    edit_once("docs/continuation/restore.py", "def run():\n",
        '''ARCHIVED_SOURCE = "f554e77144840b960b74d4240d23936e365a8594"

def archive_bytes(base, file):
    if file.is_file():
        return file.read_bytes()
    repo = base.parent.parent
    relative = file.relative_to(repo).as_posix()
    result = subprocess.run(
        ["git", "-C", str(repo), "show", ARCHIVED_SOURCE + ":" + relative],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise FileNotFoundError(
            "Historical archive missing: " + relative
            + ". Fetch commit " + ARCHIVED_SOURCE + " using git fetch origin " + ARCHIVED_SOURCE)
    return result.stdout

def run():
''')
    edit_once("docs/continuation/restore.py",
        "        raw = file.read_bytes()\n", "        raw = archive_bytes(base, file)\n")
    edit_once("docs/continuation/restore.py",
        "        with zipfile.ZipFile(file) as z:\n", "        with zipfile.ZipFile(io.BytesIO(raw)) as z:\n")
    sub="docs/continuation/source-bridge-20261030/assemble.py"
    edit_once(sub,"import zipfile\n","import zipfile\nimport re\nimport subprocess\n")
    edit_once(sub, "def run():\n",
        '''ARCHIVED_SOURCE = "f554e77144840b960b74d4240d23936e365a8594"

def archived_part_bytes(name):
    if not re.fullmatch(r"chunk-[0-9]{3}[.]b64[.]txt", name):
        raise ValueError("Invalid evidence part")
    file = HERE / "parts" / name
    if file.is_file():
        return file.read_bytes()
    repo = HERE.parents[2]
    relative = file.relative_to(repo).as_posix()
    result = subprocess.run(
        ["git", "-C", str(repo), "show", ARCHIVED_SOURCE + ":" + relative],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise FileNotFoundError(
            "Historical bridge part missing: " + relative
            + ". Fetch commit " + ARCHIVED_SOURCE + " using git fetch origin " + ARCHIVED_SOURCE)
    return result.stdout

def run():
''')
    edit_once(sub, "    if expected_names != found_names:\n", "    if found_names - expected_names:\n")
    edit_once(sub,
        "        p = HERE/'parts'/entry['name']\n        data = p.read_bytes()\n",
        "        data = archived_part_bytes(entry['name'])\n")
    def doc_banner(relative,banner):
        file=ROOT/relative
        content=file.read_text(encoding="utf-8")
        line,sep,tail=content.partition("\n")
        if not line.startswith("# ") or not sep: raise RuntimeError("DOC_HEADER_CHANGED: "+relative)
        file.write_text(line+"\n\n"+banner+"\n"+tail,encoding="utf-8")
    doc_banner("docs/continuation/NASTAVAK_RADA.md",
        "> ISTORIJSKI PAKETI ARHIVIRANI 04.11.2026: 3 ZIP-a i 17 bridge-delova nisu vise u aktivnom checkout-u. Originali su u Git istoriji commita "+BASE+". Postojece restore.py i assemble.py automatski citaju iz tog commita i proveravaju sve hash-eve. Detalji u ARHIVIRANI_IZVORI_20261104.md. Starije tvrdnje ispod da su ZIP-ovi u payload folderu su istorijski opisi.")
    doc_banner("docs/continuation/source-bridge-20261030/README.md",
        "> ARHIVIRANO 04.11.2026: 17 delova arhive iz parts/ je povuceno iz aktivnog stabla. assemble.py ih sada dobija iz celovite Git istorije na commitu "+BASE+" uz istu proveru SHA-256. Za shallow klon: git fetch origin "+BASE+". Link: ../ARHIVIRANI_IZVORI_20261104.md.")
    doc_banner("docs/plan/CODEX_PLAN_RADA.md",
        "> R11 IZVRSENI KORAK 04.11.2026: uklonjen je prenosni teret od 20 istorijskih arhivskih fajlova iz izdvojene grane, uz Git SHA-256 i potpunu obnovu postojeceg dokaza. Original ostaje u Git istoriji "+BASE+". Vidi docs/continuation/ARHIVIRANI_IZVORI_20261104.md. App, server, migracije, testovi, dizajn i postojece poslovne funkcije nisu menjani. Ovo nije novi master niti zavrsena celovita optimizacija.")
    manifest={"date":"2026-11-04","sourceCommit":BASE,"removed":receipt,
        "removedBytes":sum(x["bytes"] for x in receipt),
        "scope":"recoverable old evidence only","runtimeChanged":False}
    dest=ROOT/"docs/continuation"
    (dest/"ARHIVIRANI_IZVORI_20261104.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    md=["# Arhivirani prenosni paketi, 04.11.2026","",
        "Ovo je indeks, a ne novi master. Originali nisu obrisani iz Git istorije: commit "+BASE+".",
        "Postojece komande za proveru i obnovu ostaju: python docs/continuation/restore.py i python docs/continuation/source-bridge-20261030/assemble.py.",
        "U plitkom klonu prethodno: git fetch origin "+BASE+".",
        "Za pojedinacni original: git show "+BASE+":PUTANJA > lokalna-kopija.",
        "",
        "| Putanja | Bajtova | SHA-256 |",
        "| --- | ---: | --- |"]
    for row in receipt: md.append("| "+row["path"]+" | "+str(row["bytes"])+" | "+row["sha256"]+" |")
    md.extend(["","Git blob SHA-i i velicine su u ARHIVIRANI_IZVORI_20261104.json.",
        "Smanjuje se aktivno stablo, ne velicina celokupne istorije repozitorijuma.",
        "Nijedan aktuelni SQL/Edge/UX/AI/CI fajl nije povucen ovim paketom.",""])
    (dest/"ARHIVIRANI_IZVORI_20261104.md").write_text("\n".join(md),encoding="utf-8")
    subprocess.run(["git","rm","--",*[p for p,_,_ in wanted]],check=True)
    out=Path("/tmp/uskoci-archive-cleanup")
    out.mkdir(exist_ok=True,parents=True)
    (out/"preflight.json").write_text(json.dumps({"source":BASE,"count":len(wanted),"bytes":manifest["removedBytes"]},indent=2))
    print("STAGED_ARCHIVES:",len(wanted),manifest["removedBytes"])

if __name__ == "__main__":
    main()
