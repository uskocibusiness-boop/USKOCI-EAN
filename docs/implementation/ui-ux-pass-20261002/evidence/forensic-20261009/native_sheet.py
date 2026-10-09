import sys,time,re,json
from pathlib import Path
sys.argv=['native_probe.py','noop'];exec((Path(__file__).parent/'native_probe.py').read_text(encoding='utf-8').split('action=sys.argv[1]')[0])
def taptext(text):
    xml=d.uia_dump()
    e=next(e for e in ET.fromstring(xml).iter('node') if e.get('text')==text)
    x1,y1,x2,y2=map(int,re.findall(r'\d+',e.get('bounds')))
    d.adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(.8)
for i in range(3):
    taptext('1 zadatak');save('sheet-cycle-'+str(i+1))
taptext('Pomoć oko nošenja kesa do stana');save('task-readonly-detail')
d.adb('shell','input','keyevent','4');time.sleep(.8);save('map-detail-back')
# Read-only overhead calibration: ready UI remains unchanged during all five dumps.
samples=[]
for i in range(5):
    t=time.perf_counter();d.uia_dump();samples.append(round((time.perf_counter()-t)*1000,2))
(OUT/'uia-observer-overhead.json').write_text(json.dumps({'samplesMs':samples,'limits':'UIAutomator idle wait and ADB overhead are included in visibleHome upper bounds; do not publish those upper bounds as user TTI or warm-resume latency.'},indent=2),encoding='utf-8');print(json.dumps({'uiaObserverOverheadMs':samples}))
