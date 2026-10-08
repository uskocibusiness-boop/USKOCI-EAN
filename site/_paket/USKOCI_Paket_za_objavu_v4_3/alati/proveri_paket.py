#!/usr/bin/env python3
"""Offline HTML links/anchors and package structure. Does not test the app or live URLs."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import sys
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
def main():
 errors=[]; total=0
 for p in sorted(ROOT.rglob('*.html')):
  total+=1; soup=BeautifulSoup(p.read_text(encoding='utf-8'),'html.parser')
  ids=[str(t['id']) for t in soup.select('[id]')]
  if len(ids)!=len(set(ids)):errors.append(f'{p.relative_to(ROOT)}: duplicate id')
  for a in soup.select('a[href]'):
   ref=urlsplit(a['href'])
   if ref.scheme or ref.netloc:continue
   target=(p.parent/unquote(ref.path)).resolve() if ref.path else p
   if not target.exists():errors.append(f'{p.relative_to(ROOT)}: missing {a["href"]}');continue
   if ref.fragment:
    doc=soup if target==p else BeautifulSoup(target.read_text(encoding='utf-8'),'html.parser')
    if not doc.find(id=unquote(ref.fragment)):errors.append(f'{p.relative_to(ROOT)}: missing anchor {a["href"]}')
 report={'scope':'Local HTML links/anchors only; no legal or Google approval','html_files':total,'errors':errors}
 (ROOT/'provera').mkdir(exist_ok=True)
 (ROOT/'provera/veze.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(f'HTML: {total}; greške veza: {len(errors)}')
 for e in errors:print(e)
 return 1 if errors else 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError) as e:print(str(e),file=sys.stderr);sys.exit(1)
