"""One-shot product-only checkout builder. No changes outside this isolated branch.

The original full QA, migration-candidate history, tests and archived evidence remain
in the pinned CLEANROOM source commit. This script does NOT delete Git history.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess

ROOT=Path.cwd()
BASE="357d767d9f7ad61b0cd452c9c3a0e44b1b69664f"
BRANCH="work/uskoci-cist-proizvod-20261104"
KEEP_SCRIPTS={
    "scripts/build-contract.cjs",
    "scripts/build-identity.cjs",
    "scripts/check-eas-preview.cjs",
    "scripts/sync-entry-reference-assets.cjs",
    "scripts/verify-native-patches.cjs",
}
KEEP_DOCS={
    "docs/plan/CODEX_PLAN_RADA.md",
    "docs/product/USKOCI_PRODUCT_UX_MASTER.md",
}
KEEP_WORKFLOWS={
    ".github/workflows/uskoci-qa-apk.yml",
}
OLD_STATUS={
    "STATUS.md",
    "USKOCI_CISTO_STATUS_I_KONTINUIRANI_PLAN_26-10-2026.md",
    "jest.config.cjs",
}


def git(*args,raw=False):
    data=subprocess.check_output(["git",*args])
    return data if raw else data.decode("utf8").strip()


def keep(path):
    p=path.replace("\\","/")
    if p.startswith("docs/"):
        return p in KEEP_DOCS
    if p.startswith(("supabase/candidates/","supabase/proofs/","supabase/operations/",
                     "src/designLab/","tests/","__mocks__/")):
        return False
    if p.startswith("supabase/") and p.count("/")==1 and p.endswith((".md",".csv",".json")):
        return False
    if p.startswith(".github/workflows/"):
        return p in KEEP_WORKFLOWS
    if p.startswith("scripts/"):
        return p in KEEP_SCRIPTS
    if "/__tests__/" in p or "/__mocks__/" in p:
        return False
    if re.search(r"\.(?:test|spec)\.[cm]?[jt]sx?$",p):
        return False
    if p in OLD_STATUS:
        return False
    return True


def guard():
    if os.environ.get("PRODUCT_BASE_SHA")!=BASE:
        raise RuntimeError("PRODUCT_SOURCE_NOT_PINNED")
    if os.environ.get("GITHUB_REF")!="refs/heads/"+BRANCH:
        raise RuntimeError("NOT_ISOLATED_PRODUCT_BRANCH")
    if git("status","--porcelain"):
        raise RuntimeError("DIRTY_SOURCE_CHECKOUT")
    changed=set(git("diff","--name-only",BASE,"HEAD").splitlines())
    required={
        "scripts/product_slim_once.py",
        ".github/workflows/uskoci-product-slim-once.yml",
    }
    if changed!=required:
        raise RuntimeError("UNEXPECTED_SOURCE_CHANGE: "+repr(sorted(changed^required)))


def main():
    guard()
    original=[p.decode() for p in git("ls-tree","-r","--name-only","-z",BASE,raw=True).split(b"\0") if p]
    if len(original)!=3900:
        raise RuntimeError("ORIGINAL_TRACKED_COUNT_CHANGED: "+str(len(original)))
    remove=sorted(p for p in original if not keep(p))
    surviving=sorted(p for p in original if keep(p))
    if len(remove)<2700 or len(remove)>3000:
        raise RuntimeError("UNEXPECTED_REMOVAL_SCOPE: "+str(len(remove)))
    if len(remove)+len(surviving)!=len(original):
        raise RuntimeError("FILE_CLASSIFICATION_INCOMPLETE")
    source_links=Path(os.environ["RUNNER_TEMP"])/"uskoci-product"/"source-audit"/"edges.json"
    graph=json.loads(source_links.read_text())
    deleted=set(remove)
    broken=[e for e in graph if e["from"] in surviving and e["to"] in deleted]
    if broken:
        raise RuntimeError("ACTIVE_SOURCE_DEPENDS_ON_REMOVED_FILE: "+json.dumps(broken[:20]))
    important=[
        "src/app/(app)/nova.tsx",
        "src/app/(app)/profil/razgovor.tsx",
        "src/ui/aiFirst/AiConversationShell.tsx",
        "src/ui/v2/IntakePresentation.tsx",
        "src/data/aiNeedTurnStream.ts",
        "src/contracts/serviceHandoff.ts",
        "supabase/functions/_shared/serviceHandoff.mjs",
        "supabase/functions/uskoci-ai-interview/index.ts",
        "supabase/functions/uskoci-worker-interview/index.ts",
        "assets/illustrations/natural-v1/home.webp",
        "assets/illustrations/uskoci-clock-v1.png",
        "assets/brand/reference-entry/provenance.json",
        "patches/react-native-reanimated+4.5.1.patch",
        "vendor/decode-uri-component-compat/package.json",
        "scripts/check-eas-preview.cjs",
        "docs/plan/CODEX_PLAN_RADA.md",
        "docs/product/USKOCI_PRODUCT_UX_MASTER.md",
        ".github/workflows/uskoci-qa-apk.yml",
    ]
    missing=[p for p in important if p not in surviving]
    if missing:
        raise RuntimeError("CRITICAL_PRODUCT_FILE_MISSING: "+repr(missing))
    # We preserve the *entire canonical migration history* instead of
    # falsely treating applied DB migrations as disposable build files.
    migrations=[p for p in surviving if p.startswith("supabase/migrations/")]
    if len(migrations)!=198:
        raise RuntimeError("DB_HISTORY_NOT_FULLY_PRESERVED: "+str(len(migrations)))
    removed=[]
    for p in remove:
        file=ROOT/p
        if not file.is_file():
            raise RuntimeError("REMOVAL_PREIMAGE_NOT_REGULAR_FILE: "+p)
        data=file.read_bytes()
        current=git("hash-object",p)
        historical=git("rev-parse",BASE+":"+p)
        if current!=historical:
            raise RuntimeError("HISTORY_BLOB_DIFFERS: "+p)
        removed.append({"path":p,"bytes":len(data),"gitBlob":historical})
    out=Path(os.environ["RUNNER_TEMP"])/"uskoci-product"
    out.mkdir(parents=True,exist_ok=True)
    receipt={
        "sourceBranch":"work/uskoci-cleanroom-audit-20261104",
        "sourceCommit":BASE,
        "targetBranch":BRANCH,
        "totalOriginalFiles":len(original),
        "removedFiles":len(remove),
        "retainedOriginalFiles":len(surviving),
        "removedBytes":sum(x["bytes"] for x in removed),
        "retainedCanonicalMigrations":len(migrations),
        "allRemovedOriginalsRecoverableFromHistory":True,
        "staticRuntimeEdgesToRemoved":len(broken),
        "unmodifiedCore":important,
        "removedFilesIndex":removed,
        "limitations":["No DELETE in any other branch, no live DEV/production change",
            "Original tests and proofs preserved by Git commit, can be rehydrated for QA",
            "Metro and TypeScript require additional execution before acceptance",
            "A clean product source is not a verified two-account/Gemini/native APK"]
    }
    (out/"PRODUCT_SOURCE_MANIFEST.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
    (out/"REMOVED_PATHS.txt").write_text("\n".join(remove)+"\n")
    subprocess.run(["git","rm","--",*remove],check=True)
    print("CLEAN_SOURCE_PRUNE_PREPARED",json.dumps({
        "original":len(original),"removed":len(remove),
        "retained":len(surviving),"removedBytes":receipt["removedBytes"],
        "missingRuntimeEdges":len(broken),"preservedMigrations":len(migrations)
    }))


if __name__=="__main__":
    main()
