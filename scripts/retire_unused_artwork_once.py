"""One-shot, fail-closed retirement of non-runtime legacy PNG art.

Works only in the isolated R11 art cleanup branch. Requires full Git history.
Never removes active natural-v1 WebP subjects, brand icons, fonts, or generated entry assets.
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess

ROOT = Path.cwd()
BASE = "d3fba6e5a52508469daa54f0f5da05f6a8307e5c"
ART = Path("assets/illustrations")
REPORT = Path("docs/continuation/ARHIVIRANA_IZVORNA_ILUSTRACIJA_20261104")
SOURCE_SUFFIXES = {".js",".jsx",".ts",".tsx",".mjs",".cjs",".mts",".cts",".py",
                   ".sql",".sh",".yml",".yaml",".xml",".json",".gradle",".toml"}


def git(*args, raw=False):
    result = subprocess.check_output(["git", *args])
    return result if raw else result.decode("utf-8").strip()


def fail(message):
    raise RuntimeError(message)


def main():
    if git("rev-parse", "HEAD") == BASE or os.getenv("BASE_SHA") != BASE:
        fail("BASE_SHA_NOT_PINNED")
    if git("status", "--porcelain"):
        fail("DIRTY_BRANCH")
    changed=set(git("diff","--name-only",BASE,"HEAD").splitlines())
    expected={"scripts/retire_unused_artwork_once.py",
              ".github/workflows/uskoci-retire-artwork-once.yml"}
    if changed!=expected:
        fail("BRANCH_DELTA_NOT_EXACT: "+repr(sorted(changed^expected)))
    tracked=[p.decode("utf-8") for p in git("ls-files","-z",raw=True).split(b"\0") if p]
    recorded=set(tracked)
    group=sorted(p for p in tracked if p.startswith(ART.as_posix()+"/")
                 and "/" not in p[len(ART.as_posix())+1:])
    retained={
        "assets/illustrations/uskoci-clock-v1.png",
        "assets/illustrations/uskoci-messages-v2.png",
    }
    removable=[p for p in group if p not in retained]
    image_paths=[p for p in removable if p.endswith(".png")]
    metadata=[p for p in removable if p.endswith(".json")]
    if len(group)!=22 or len(removable)!=20 or len(image_paths)!=18 or len(metadata)!=2 or set(metadata)!={
            "assets/illustrations/MANIFEST.json","assets/illustrations/PROVENANCE.json"}:
        fail("LEGACY_ASSET_INVENTORY_CHANGED "+repr(group))
    if not all(p.startswith("assets/illustrations/uskoci-") for p in image_paths):
        fail("NON_LEGACY_ASSET_SELECTED")
    if "assets/illustrations/natural-v1/home.webp" not in recorded:
        fail("CURRENT_ASSET_SET_MISSING")

    # Treat any executable/configuration/test use of the exact basename as a blocker.
    # Documents, archived provenance metadata, and this one-shot selector are source
    # history, not an active runtime or test consumer; log their names separately.
    tokens={p:Path(p).name for p in image_paths}
    references={p:[] for p in image_paths}
    historic_refs={p:[] for p in image_paths}
    for p in tracked:
        if p in removable or p=="scripts/retire_unused_artwork_once.py":
            continue
        suffix=Path(p).suffix.lower()
        if suffix not in SOURCE_SUFFIXES and suffix not in {".md",".txt",".csv"}:
            continue
        try:
            content=(ROOT/p).read_text("utf-8")
        except UnicodeDecodeError:
            fail("UNREADABLE_TRACKED_SOURCE "+p)
        for asset,basename in tokens.items():
            if basename in content:
                if p.startswith("docs/") or suffix in {".md",".txt",".csv"}:
                    historic_refs[asset].append(p)
                else:
                    references[asset].append(p)
    blocked={p:users for p,users in references.items() if users}
    if blocked:
        fail("ACTIVE_REFERENCES_PREVENT_RETIREMENT "+json.dumps(blocked,ensure_ascii=False))

    # Additional soft guard against runtime directory enumeration/loaders.
    indirect=[]
    for p in tracked:
        if p in removable or p=="scripts/retire_unused_artwork_once.py":
            continue
        if not p.startswith(("src/","scripts/","config/","plugins/","modules/","tests/","__mocks__/")):
            continue
        if Path(p).suffix.lower() not in SOURCE_SUFFIXES:
            continue
        source=(ROOT/p).read_text("utf-8")
        if "assets/illustrations" in source or "assets', 'illustrations" in source:
            if "/natural-v1/" not in source and "natural-v1" not in source and not any(
                    Path(keep).name in source for keep in retained):
                indirect.append(p)
    if indirect:
        fail("POTENTIAL_INDIRECT_ASSET_LOADER "+json.dumps(indirect))

    original=[]
    for p in removable:
        current=(ROOT/p).read_bytes()
        ancestor=git("show",BASE+":"+p,raw=True)
        if current!=ancestor:fail("ART_PREIMAGE_DRIFT "+p)
        original.append({
            "path":p,"bytes":len(current),
            "sha256":hashlib.sha256(current).hexdigest(),
            "gitBlob":git("hash-object",p),
            "historicalDocReferences":historic_refs.get(p,[]),
            "activeReferences":references.get(p,[])
        })
    manifest={
        "date":"2026-11-04",
        "sourceCommit":BASE,
        "status":"RETIRED_FROM_ACTIVE_TREE_EXACT_GIT_HISTORY_RECOVERY",
        "reason":"The working renderer reads original natural-v1 WebP, not these legacy large PNGs.",
        "pngFiles":len(image_paths),"metadataFiles":len(metadata),
        "retainedLegacyPngUsedByActiveUI":sorted(retained),
        "retiredFiles":len(original),"retiredBytes":sum(r["bytes"] for r in original),
        "original":original,
        "scope":{
            "mobileRuntimeChanged":False,"edgeOrDatabaseChanged":False,
            "currentWebPRemoved":False,"fontsRemoved":False,"brandLogosRemoved":False,
            "metroBundleParity":"To be established by workflow before publishing"
        }
    }
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.with_suffix(".json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    rows=[
        "# Arhivirane stare PNG ilustracije — 04.11.2026","",
        "Ovo je indeks, NE novi Product/UX master. Stari PNG originali su uklonjeni samo iz aktivnog radnog stabla.",
        "Svi originalni bajtovi ostali su u punoj Git istoriji na commitu "+BASE+".",
        "Aktivne WebP ilustracije, dva koristena stara PNG-a (sat i razgovor), i aktuelni USKOCI vizuelni sistem ostaju.",
        "Vraćanje pojedinačnog fajla: git show "+BASE+":PUTANJA > lokalni-fajl",
        "Za plitak klon prvo: git fetch origin "+BASE+".","",
        "| Originalni fajl | Bajtova | SHA-256 |",
        "| --- | ---: | --- |"
    ]
    for f in original:
        rows.append("| "+f["path"]+" | "+str(f["bytes"])+" | "+f["sha256"]+" |")
    rows.extend(["","Detaljan manifest i reference: ARHIVIRANA_IZVORNA_ILUSTRACIJA_20261104.json.",
        "Ovo ne znači manji APK niti izmenu grafike koju korisnik vidi; potreban je Android izvozni i native test.",""])
    REPORT.with_suffix(".md").write_text("\n".join(rows),encoding="utf-8")

    plan=ROOT/"docs/plan/CODEX_PLAN_RADA.md"
    code=plan.read_text("utf-8")
    header="# USKOČI — jedinstveni plan dovršavanja proizvoda i objavljivanja\n"
    if not code.startswith(header):fail("EXECUTIVE_MASTER_HEADER_CHANGED")
    line=(
        "\n> **R11 — arhiviranje neupotrebljenih starih ilustracija, 04.11.2026:** "
        "izdvojeno "+str(len(image_paths))+" starih velikih PNG-a i "+str(len(metadata))
        +" originalna manifesta/provenance uz ocuvanje Git bajtova i SHA-256. "
        "[Inventar](../continuation/ARHIVIRANA_IZVORNA_ILUSTRACIJA_20261104.md). "
        "Aktivni natural-v1 WebP, ikonice, brand, server, migracije i native fontovi nisu "
        "menjani. Validacija Metro exporta i testova mora proci pre objave grane; "
        "samo broj uklonjenih originala nije APK/UX dokaz.\n"
    )
    plan.write_text(code.replace(header,header+line,1),encoding="utf-8")

    subprocess.run(["git","rm","--",*removable],check=True)
    out=Path("/tmp/uskoci-r11-artwork")
    out.mkdir(exist_ok=True,parents=True)
    (out/"preflight.json").write_text(json.dumps({
        "sourceCommit":BASE,"retiredFiles":len(removable),
        "pngFiles":len(image_paths),"bytes":manifest["retiredBytes"],
        "activeReferences":[],"allFilesRecoveredFromCommit":True
    },indent=2)+"\n")
    print(json.dumps({"retiredFiles":len(removable),"oldPng":len(image_paths),
         "retiredBytes":manifest["retiredBytes"]}))


if __name__=="__main__":
    main()
