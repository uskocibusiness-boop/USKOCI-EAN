import sys,json,time,re,hashlib,statistics,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime,timezone
REPO=Path('C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN-spoj-20261006')
OUT=Path(__file__).parent/'native';OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(REPO/'scripts'));import qa_device
qa_device.ADB_BIN='C:/Users/user/AppData/Local/Android/Sdk/platform-tools/adb.exe'
d=qa_device.Device(qa_device.pick(prefer='emulator',environ={}))
assert d.kind=='emulator';package='rs.uskoci.dev'
def save(tag):
    xml=d.uia_dump();(OUT/(tag+'.xml')).write_text(xml,encoding='utf-8');(OUT/(tag+'.png')).write_bytes(d.screenshot_png())
    texts=[e.get('text') for e in ET.fromstring(xml).iter('node') if e.get('text')]
    print(json.dumps({'tag':tag,'foreground':d.foreground(),'texts':texts[:35]},ensure_ascii=False),flush=True)
    return xml
action=sys.argv[1]
if action=='start':
    info=d.package_info(package);assert info['apkSha256']=='3a3da9ea72f39b7d278384ddc869d5b1b6da53bb256a529b82b3725082db999b'
    info.update(recordedAt=datetime.now(timezone.utc).isoformat(),screen=d.screen_size(),font=d.adb('shell','settings','get','system','font_scale').strip(),android=d.getprop('ro.build.version.release'),sdk=d.getprop('ro.build.version.sdk'))
    (OUT/'device.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8');save('initial')
elif action=='url':
    url=sys.argv[2];assert url.startswith('uskociapp://')
    allowed=['profil','zadaci','dogovori','poruke','nova','moji-zadaci','moje-prijave','raspored','obavestenja']
    path=url.split('://',1)[1].split('?')[0]
    assert path.split('/')[0] in allowed or path.startswith('dizajn-')
    d.adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',url,package);time.sleep(.7);save(sys.argv[3])
elif action=='back':d.adb('shell','input','keyevent','4');save(sys.argv[2])
elif action=='shot':save(sys.argv[2])
elif action=='launches':
    before=d.adb('shell','dumpsys','activity','exit-info',package);(OUT/'exit-info-before.txt').write_text(before,encoding='utf-8')
    results=[]
    for kind in ['cold_process','warm_activity']:
        for i in range(30):
            if kind=='cold_process':d.adb('shell','am','force-stop',package)
            else:d.adb('shell','input','keyevent','3')
            t=time.perf_counter();raw=d.adb('shell','am','start','-W','-n',package+'/.MainActivity');wall=round((time.perf_counter()-t)*1000,2)
            fields={k:v for k,v in re.findall(r'^(Status|LaunchState|ThisTime|TotalTime|WaitTime):\s*(.+)$',raw,re.M)}
            results.append({'kind':kind,'i':i,'hostWallMs':wall,'fields':fields})
            time.sleep(.2)
        print(kind+' done',flush=True)
    def stats(xs):
        a=sorted(xs);return {'n':len(a),'p50':statistics.median(a),'p95':a[max(0,__import__('math').ceil(len(a)*.95)-1)],'max':max(a)}
    summary={k:{'hostWallMs':stats([x['hostWallMs'] for x in results if x['kind']==k]),'amTotalMs':stats([int(x['fields']['TotalTime']) for x in results if x['kind']==k and 'TotalTime'in x['fields']]) if any(x['kind']==k and 'TotalTime'in x['fields'] for x in results) else None} for k in ['cold_process','warm_activity']}
    after=d.adb('shell','dumpsys','activity','exit-info',package);(OUT/'exit-info-after.txt').write_text(after,encoding='utf-8')
    (OUT/'launch-metrics.json').write_text(json.dumps({'recordedAt':datetime.now(timezone.utc).isoformat(),'device':d.serial,'package':package,'samples':results,'summary':summary,'limits':['Android ActivityManager display/launch timing, NOT JS screen readiness or user time-to-interactive.','Cold process keeps app data, OS caches and authenticated session; not first-install/cold-device.','Emulator on shared Windows host; no physical device or production capacity claim.','No data clear/logout/uninstall. Repeated cold launches cause existing normal startup reads; not business writes.']},indent=2)+'\n',encoding='utf-8')
    (OUT/'memory-after.txt').write_text(d.adb('shell','dumpsys','meminfo',package),encoding='utf-8');save('after-launches');print(json.dumps(summary),flush=True)
else:raise ValueError(action)
