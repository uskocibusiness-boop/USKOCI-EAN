import sys,time,json
from pathlib import Path
from datetime import datetime,timezone
sys.argv=['native_probe.py','noop'];exec((Path(__file__).parent/'native_probe.py').read_text(encoding='utf-8').split('action=sys.argv[1]')[0])
routes=['zadaci','poruke','dogovori','profil','profil/radnik','profil/razgovor','nova','moje-prijave','potrebe','raspored','profil/dostupnost','profil/privatnost','profil/izvoz','profil/pravna','profil/obavestenja','profil/blokirani','profil/ocene','bezbednost','profil/prijava-greske','profil/o-aplikaciji']
rows=[]
for i,path in enumerate(routes):
    tag='route-'+path.replace('/','-');t=time.perf_counter()
    raw=d.adb('shell','am','start','-a','android.intent.action.VIEW','-d','uskociapp://'+path,package,timeout=20)
    time.sleep(1.2);xml=save(tag)
    rows.append({'route':path,'observedAt':datetime.now(timezone.utc).isoformat(),'snapshotElapsedMs':round((time.perf_counter()-t)*1000,2),'xml':tag+'.xml','image':tag+'.png','notProved':['all states/buttons','writes','real phone','screen-reader','network failures']})
    (OUT/'route-receipt.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    if 'permissioncontroller' in str(d.foreground()):
        print('permission dialog: stopped; no setting altered',flush=True);break
