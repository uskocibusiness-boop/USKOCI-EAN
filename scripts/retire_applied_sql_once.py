"""Retire only historic APPLIED SQL candidate folders that no executable source references.
One-shot; unchanged runtime and DEV. Never used to authorize removal of current migrations/proofs.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT=Path.cwd()
BASE="127c3e0b3c96d629578a95b222b6726433a3150c"
CANDIDATES="supabase/candidates/"
HISTORIC=("cancel-info-20261007","discovery-grad-20261008","discovery-zamene-20261007",
          "inbox-naslov-20261008","match-v1-20261007",
          "match-v1b-remote-waves-20261007","profile-trust-20261007","zone-perf-20261007")
CODE_SUFFIXES={".ts",".tsx",".js",".jsx",".mjs",".cjs",".py",".sql",".sh",".yml",".yaml",".toml"}
CHECK_CONFIGS={"package.json","jest.config.cjs","metro.config.cjs","eas.json","app.config.js","tsconfig.json"}
OUTPUT=ROOT/"docs/continuation/ARHIVIRANI_APPLIED_KANDIDATI_20261104"

def git(*args, raw=False):
    b=subprocess.check_output(["git",*args])
    return b if raw else b.decode("utf-8").strip()

def main():
    if git("rev-parse","HEAD") == BASE:
        raise RuntimeError("CLEANUP_WORKFLOW_NOT_PINNED_TO_STAGED_COMMIT")
    if os.environ.get("BASE_SHA") != BASE:
        raise RuntimeError("UNPINNED_CLEANUP_BASE")
    if git("status","--porcelain"):
        raise RuntimeError("DIRTY_CHECKOUT")
    delta=set(git("diff","--name-only",BASE,"HEAD").splitlines())
    expect={".github/workflows/uskoci-retire-sql-once.yml","scripts/retire_applied_sql_once.py"}
    if delta!=expect:
        raise RuntimeError("OTHER_CHANGES_IN_BRANCH: "+str(delta^expect))
    tracked=git("ls-files","-z",raw=True).decode().split("\0")
    tracked=[p for p in tracked if p]
    groups={}
    for p in tracked:
        if not p.startswith(CANDIDATES):
            continue
        relative=p[len(CANDIDATES):]
        if "/" not in relative:
            continue
        prefix=relative.split("/")[0]
        groups.setdefault(prefix,[]).append(p)
    candidates={p:groups[p] for p in HISTORIC if p in groups}
    if len(candidates)!=len(HISTORIC):
        raise RuntimeError("CANDIDATE_APPLIED_FOLDERS_CHANGED")
    code_sources=[]
    documents=[]
    for p in tracked:
        ext=Path(p).suffix.lower()
        if ext in CODE_SUFFIXES or p in CHECK_CONFIGS or (p.startswith(".github/workflows/") and ext in (".yml",".yaml")):
            try:
                code_sources.append((p,(ROOT/p).read_text(encoding="utf-8")))
            except UnicodeDecodeError:
                raise RuntimeError("UNREADABLE_SOURCE: "+p)
        elif ext==".md" and not p.startswith(CANDIDATES):
            try: documents.append((p,(ROOT/p).read_text(encoding="utf-8")))
            except UnicodeDecodeError: pass
    report=[]
    selected=[]
    for name,paths in candidates.items():
        applied=ROOT/CANDIDATES/name/"APPLIED.md"
        status=applied.read_text(encoding="utf-8")
        if "APPLIED" not in status or "DEV" not in status:
            raise RuntimeError("NOT_VERIFIED_APPLIED: "+name)
        receipts=re.findall(r"supabase/operations/dev-alpha/ledger/[A-Za-z0-9_.-]+[.]json",status)
        if not receipts or any(not (ROOT/p).is_file() for p in receipts):
            raise RuntimeError("MISSING_DEPLOYMENT_LEDGER: "+name)
        # Only whole folders; any live executable or fixture referring to another applied
        # candidate keeps that folder in the working tree. Historic documentation is a
        # softer reference and is listed for recovery rather than used to infer execution.
        foreign=[p for p,content in code_sources
                 if not p.startswith(CANDIDATES+name+"/") and
                 (name in content or CANDIDATES+name in content)]
        docs=[p for p,content in documents if name in content]
        eligible=not foreign
        report.append({"folder":name,"files":len(paths),
                       "bytes":sum((ROOT/p).stat().st_size for p in paths),
                       "appliedLedgerReceipts":receipts,
                       "activeOrTestExternalReferences":foreign[:80],
                       "documentationReferences":docs[:80],
                       "retired":eligible})
        if eligible: selected.extend(paths)
    if not selected:
        raise RuntimeError("NO_UNREFERENCED_APPLIED_DIRS: "+json.dumps(report,ensure_ascii=False))
    # No generated source or a single partial SQL directory is deleted.
    if len(selected)>200:
        raise RuntimeError("SCOPE_TOO_LARGE")
    originals=[]
    for p in sorted(selected):
        content=(ROOT/p).read_bytes()
        history=git("show",BASE+":"+p,raw=True)
        if content!=history:
            raise RuntimeError("SOURCE_HISTORY_MISMATCH: "+p)
        originals.append({"path":p,"bytes":len(content),
                          "sha256":hashlib.sha256(content).hexdigest(),
                          "gitBlob":git("hash-object",p)})
    record={"date":"2026-11-04","base":BASE,
            "status":"APPLIED_HISTORIC_CANDIDATES_NO_EXTERNAL_CODE_REFERENCES",
            "checkedFolders":report,"removed":originals,
            "removedBytes":sum(x["bytes"] for x in originals),
            "runtimeChanged":False,"sqlMigrated":False,"serverDeployed":False,
            "warning":"No static external reference is not proof of semantics. Restore from pinned Git history if needed."}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.with_suffix(".json").write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    lines=["# Arhivirani stari SQL kandidati — 04.11.2026","",
          "Ovaj pregled ne menja aktivne SQL migracije, Edge funkcije ni server.",
          "Originalni sadržaj je u [Git commitu](https://github.com/uskocibusiness-boop/USKOCI-EAN/tree/"+BASE+").",
          "Za obnovu: git show "+BASE+":PUTANJA > fajl (uz proveru SHA-256 iz JSON indeksa).",
          "U plitkom klonu prvo git fetch origin "+BASE+".",
          "",
          "| Paket | Fajlova | MB | Aktuelne spoljašnje izvršne reference | Ishod |",
          "| --- | ---: | ---: | ---: | --- |"]
    for item in report:
        lines.append("| "+item["folder"]+" | "+str(item["files"])+" | "+
                     str(round(item["bytes"]/1000000,2))+" | "+
                     str(len(item["activeOrTestExternalReferences"]))+" | "+
                     ("Arhiviran" if item["retired"] else "Sačuvan u radu")+" |")
    lines.extend(["","Tačne putanje, SHA-256 i Git blob otisci su u [JSON indeksu](ARHIVIRANI_APPLIED_KANDIDATI_20261104.json).",
                  "Dokumenti sa istorijskim vezama zadržani su kao evidencija; za uklonjene stare kandidatske putanje koristi pinovan Git commit iz indeksa.",
                  "Ovo smanjuje samo trenutno stablo, ne trajnu veličinu istorije niti APK direktno.",""])
    OUTPUT.with_suffix(".md").write_text("\n".join(lines),encoding="utf-8")
    master=ROOT/"docs/plan/CODEX_PLAN_RADA.md"
    text=master.read_text(encoding="utf-8")
    headline="# USKOČI — jedinstveni plan dovršavanja proizvoda i objavljivanja\n"
    if not text.startswith(headline): raise RuntimeError("CODEX_MASTER_HEADER_CHANGED")
    text=text.replace(headline,headline+"\n> **R11, 04.11.2026 — kontrolisano arhiviranje starih APPLIED SQL kandidata:**"+
        " [izveštaj](../continuation/ARHIVIRANI_APPLIED_KANDIDATI_20261104.md) i"+
        " [SHA indeks](../continuation/ARHIVIRANI_APPLIED_KANDIDATI_20261104.json)."+
        " Iz Git stabla uklonjeni su samo istorijski paketi bez spoljašnjih izvršnih referenci;"+
        " dokaz primene je u postojećem ledger-u, svaki original je identičan čuvanoj Git verziji."+
        " Aktivni SQL/Edge/CI dokazi ostaju, istorijski kod može se vratiti iz pinovanog commita."+
        " Ovo ne menja aplikaciju ni DEV i ne dokazuje da je kompletno čišćenje završeno.\n",1)
    master.write_text(text,encoding="utf-8")
    subprocess.run(["git","rm","--",*selected],check=True)
    proofdir=Path("/tmp/uskoci-sql-cleanup")
    proofdir.mkdir(parents=True,exist_ok=True)
    (proofdir/"preflight.json").write_text(json.dumps(
        {"removed":len(originals),"bytes":record["removedBytes"],
         "retiredFolders":[row["folder"] for row in report if row["retired"]],
         "blockedFolders":[{"folder":row["folder"],"activeReferences":row["activeOrTestExternalReferences"]}
                           for row in report if not row["retired"]]},indent=2,ensure_ascii=False)+"\n")
    print(json.dumps({"removed":len(originals),"bytes":record["removedBytes"],
        "folders":[row["folder"] for row in report if row["retired"]]},ensure_ascii=False))

if __name__=="__main__":
    main()
