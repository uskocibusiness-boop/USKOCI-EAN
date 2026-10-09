import sys,json,re,xml.etree.ElementTree as ET
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0,str(Path.cwd()/'scripts'));import qa_device
qa_device.ADB_BIN='C:/Users/user/AppData/Local/Android/Sdk/platform-tools/adb.exe'
d=qa_device.Device(qa_device.pick(prefer='emulator',environ={}))
root=Path('C:/Users/user/Documents/Codex/uskoci-finish-20261008')
tag,action,*args=sys.argv[1:]
def snapshot():return ET.fromstring(d.uia_dump())
if action=='url':
 assert args[0].startswith('uskociapp://dizajn-prijav') or args[0]=='uskociapp://profil/o-aplikaciji'
 d.adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',args[0],'rs.uskoci.dev')
elif action in ('tap','type'):
 nodes=list(snapshot().iter('node'));elements=[e for e in nodes if e.get('content-desc')==args[0]] or [e for e in nodes if e.get('text')==args[0]]
 assert len(elements)==1,[(e.get('text'),e.get('bounds')) for e in elements]
 e=elements[0];assert e.get('enabled')=='true', 'NODE_DISABLED'
 x1,y1,x2,y2=map(int,re.findall(r'\d+',e.get('bounds')));assert x2>x1 and y2>y1
 d.adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
 if action=='type':
  assert re.fullmatch(r'[0-9]*',args[1])
  # This field selects the existing value on focus; input replaces that selection.
  d.adb('shell','input','keyevent','123','67','67','67','67')
  if args[1]:d.adb('shell','input','text',args[1])
  else:d.adb('shell','input','keyevent','67')
elif action=='back':d.adb('shell','input','keyevent','4')
elif action=='swipe':d.adb('shell','input','swipe',*args)
elif action!='shot':raise ValueError(action)
xml=d.uia_dump();(root/(tag+'.xml')).write_text(xml,encoding='utf-8')
(root/(tag+'.png')).write_bytes(d.screenshot_png())
print(json.dumps({'foreground':d.foreground(),'nodes':[{k:e.get(k) for k in ['text','content-desc','bounds','enabled']} for e in ET.fromstring(xml).iter('node') if any(w in ((e.get('text') or '')+' '+(e.get('content-desc') or '')) for w in ['osob','ljudi','RSD','prijavu','najviše','Upiši','Unesi','Sačuvaj','Broj','Nazad','ce23'])]},ensure_ascii=False))
