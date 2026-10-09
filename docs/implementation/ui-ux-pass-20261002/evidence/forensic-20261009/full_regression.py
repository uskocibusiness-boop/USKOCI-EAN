import subprocess,json,time
from pathlib import Path
from datetime import datetime,timezone
r=Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006');o=Path(__file__).parent/'source';receipt={'at':datetime.now(timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),'runs':[]}
for name,args in [('tsc',['node','node_modules/typescript/bin/tsc','--noEmit']),('full-jest',['node','node_modules/jest/bin/jest.js','--runInBand','--json','--outputFile='+str(o/'full-jest.json')])]:
    start=time.perf_counter()
    with (o/(name+'.log')).open('w',encoding='utf-8') as f:
        p=subprocess.run(args,cwd=r,stdout=f,stderr=subprocess.STDOUT,timeout=900)
    receipt['runs'].append({'name':name,'exit':p.returncode,'seconds':round(time.perf_counter()-start,2)})
    (o/'full-regression-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt['runs'][-1]),flush=True)
