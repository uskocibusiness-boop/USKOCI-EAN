import sys,time,json,re,subprocess,statistics,math
from pathlib import Path
from datetime import datetime,timezone
sys.argv=['native_probe.py','noop']
# Load only audited setup/helpers; do not execute the original dispatch.
src=(Path(__file__).parent/'native_probe.py').read_text(encoding='utf-8').split('action=sys.argv[1]')[0]
exec(src)
results=[]
def checkpoint():
    (OUT/'bounded-launch-followup.json').write_text(json.dumps({'at':datetime.now(timezone.utc).isoformat(),'samples':results,'limits':['5 samples per mode; small-sample percentiles descriptive only. UIAutomator visible Home polling is an upper bound, not frame-level TTI.','Warm resumes use launcher MAIN/LAUNCHER NEW_TASK/RESET_TASK flags, unlike failed am start -W harness.','Shared Windows host, x86 emulator, DEV APK, preserved existing session. No claim for physical phone, first install or production load.','Original30-cold loop lost samples after warm timeout120s; no metrics reconstructed.']},indent=2),encoding='utf-8')
for kind in ['cold_process','warm_resume']:
    for i in range(5):
        if kind=='cold_process': d.adb('shell','am','force-stop',package,timeout=15)
        else: d.adb('shell','input','keyevent','3',timeout=15)
        time.sleep(.6); start=time.perf_counter()
        raw=d.adb('shell','am','start','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER','-f','0x10200000','-n',package+'/.MainActivity',timeout=15)
        ready=False; polls=0; first=None
        while time.perf_counter()-start<35:
            xml=d.uia_dump();polls+=1
            ready='Objavi zadatak' in xml and 'Uskoči i zaradi' in xml
            if ready:break
            time.sleep(.5)
        result={'kind':kind,'i':i,'ready':ready,'visibleHomeUpperBoundMs':round((time.perf_counter()-start)*1000,2),'polls':polls}
        results.append(result);checkpoint();print(json.dumps(result),flush=True)
        if not ready:save('launch-followup-failure');break
        time.sleep(.5)
save('launch-followup-home')
(OUT/'memory-after.txt').write_text(d.adb('shell','dumpsys','meminfo',package),encoding='utf-8')
