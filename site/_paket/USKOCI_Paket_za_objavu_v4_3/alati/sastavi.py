#!/usr/bin/env python3
"""Local document assembly only. Does not publish a website or call an app backend.
Python 3.10+; install requirements.txt. No credentials or network access required.
"""
from __future__ import annotations
import argparse, datetime, hashlib, html, json, re, shutil, sys, tempfile, unicodedata
import bleach
from pathlib import Path
from urllib.parse import quote, urlsplit
import mistune
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
MD=mistune.create_markdown(escape=False,plugins=['table'])
H=html.escape
RELEASE_STAGE: Path | None = None

def load(path:str):
    return json.loads((ROOT/path).read_text(encoding='utf-8'))

def slugify(s:str)->str:
    s=s.translate(str.maketrans({'đ':'dj','Đ':'dj','ć':'c','č':'c','š':'s','ž':'z'}))
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-') or 'deo'

def valid_email(s:str)->bool:
    return bool(re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+',s)) and not s.endswith(('.example','.invalid','.test'))

def fact_warnings(f:dict)->list[str]:
    out=[]
    for k in load('podaci/oznake.json'):
        if not isinstance(f.get(k),str) or not f[k].strip(): out.append('Nedostaje: '+k)
    if f.get('public_email') and not valid_email(f['public_email']):out.append('Neispravan javni imejl.')
    u=urlsplit(f.get('base_url',''))
    if u.scheme!='https' or not u.netloc or u.username or u.password or u.query or u.fragment: out.append('Domen mora biti apsolutan HTTPS URL bez pristupnih podataka.')
    if f.get('effective_date'):
        try: datetime.date.fromisoformat(f['effective_date'])
        except (ValueError,TypeError): out.append('Datum primene mora biti stvaran datum oblika YYYY-MM-DD.')
    for k in ('zvanicno_ime_i_javni_podaci_potvrdjeni','stvarni_model_operatera_razresen','tekst_odgovara_stvarnom_izdanju','rokovi_i_pruzaoci_potvrdjeni','odobreno_javno_izdvajanje'):
        if f.get('_odobrenje',{}).get(k) is not True: out.append('Nije potvrđeno: '+k)
    placeholder = re.compile(r'\{\{|\bTODO\b|\[(?:POTVRDITI|STVARNI|UNETI|CONFIRM|ENTER)[^\]]*\]', re.I)
    for key in load('podaci/oznake.json'):
        if isinstance(f.get(key), str) and placeholder.search(f[key]):
            out.append('Nepopunjena urednička oznaka: '+key)
    return out

def body(src:str,f:dict,doc_slug:str,combined=False,release=False):
    labels=load('podaci/oznake.json')
    def replace(m):
        key=m.group(1)
        if key=='deletion_email_action':
            em=f.get('public_email','')
            if valid_email(em):
                msg='Molim da obrišete moj USKOČI nalog i povezane podatke za koje ne postoji preostali zakonit razlog čuvanja. Nalog: [unesite identifikator]. Molim potvrdu prijema i obaveštenje o završetku.'
                uri='mailto:'+quote(em,safe='@.+')+'?subject='+quote('USKOČI — brisanje naloga')+'&body='+quote(msg)
                return '<p><a class="action" href="'+H(uri,quote=True)+'">Otvori imejl sa zahtevom</a></p>'
            return '<p class="pending action-pending">Kontakt za javno izdanje još nije potvrđen. U ovom pregledu se zahtev ne šalje.</p>'
        value=f.get(key,'')
        if key=='operator_name' and value and not release and not f.get('_odobrenje',{}).get('zvanicno_ime_i_javni_podaci_potvrdjeni'):
            return '<span class="pending" data-field="operator_name">'+H(str(value))+' — potvrditi zvaničan zapis</span>'
        if isinstance(value,str) and value.strip(): return value
        if release: raise ValueError('Nedostaje činjenica '+key)
        return '<span class="pending" data-field="'+H(key)+'">[Potvrditi: '+H(labels.get(key,key))+']</span>'
    src=re.sub(r'\{\{([a-z_]+)\}\}',replace,src)
    soup=BeautifulSoup(MD(src),'html.parser')
    # Plain document sources may contain markup; do not allow active/untrusted elements.
    for node in soup.find_all(['script','iframe','object','embed','form','input','style','link','meta']):node.decompose()
    for node in soup.find_all(True):
        for attr in list(node.attrs):
            if attr.lower().startswith('on'):del node[attr]
    ids=set();toc=[]
    for node in soup.find_all(re.compile(r'^h[2-6]$')):
        text=node.get_text()
        explicit=re.search(r'\s*\{#([a-z0-9_-]+)\}\s*$',text)
        if explicit:
            sid=explicit.group(1)
            # Explicit ID marker appears at the end of heading text.
            for leaf in reversed(list(node.descendants)):
                if isinstance(leaf,str) and '{#' in leaf:
                    leaf.replace_with(re.sub(r'\s*\{#[a-z0-9_-]+\}\s*$','',str(leaf))); break
        else:sid=slugify(text)
        base=sid;n=2
        while sid in ids:sid=f'{base}-{n}';n+=1
        ids.add(sid)
        node['id']=doc_slug+'--'+sid if combined else sid
        if node.name=='h2':toc.append((node['id'],node.get_text(' ',strip=True)))
    for a in soup.find_all('a',href=True):
        href=a['href']
        if href.startswith('doc:'):
            target,sep,frag=href[4:].partition('#')
            if combined:
                a['href']='#'+('javno' if target=='pravno' else target)+(('--'+frag) if sep else '')
            else:
                a['href']='../'+target+'/index.html'+(('#'+frag) if sep else '')
        elif href.startswith('#') and combined:
            a['href']='#'+doc_slug+'--'+href[1:]
        elif urlsplit(href).scheme not in ('','https','http','mailto'):
            del a['href']
        if href.startswith(('https://','http://')):a['rel']='noopener noreferrer'
    for t in soup.find_all('table'):
        wrapper=soup.new_tag('div',attrs={'class':'table-wrap','tabindex':'0','aria-label':'Tabela, po potrebi pomeri vodoravno'})
        t.wrap(wrapper)
        for th in t.find_all('th'):th['scope']='col'
    # Strict allowlist, after internal doc links have been resolved. No images,
    # network embeds, inline styling, event handlers or executable markup from facts.
    clean = bleach.clean(str(soup), tags=['p','br','hr','strong','em','b','i','u','s',
        'a','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','pre','code',
        'table','thead','tbody','tfoot','tr','th','td','div','span'],
        attributes={'*':['id','class'], 'a':['href','title','rel'],
            'span':['data-field'], 'th':['scope'], 'div':['tabindex','aria-label']},
        protocols=['http','https','mailto'], strip=True, strip_comments=True)
    if release and ('class="pending' in clean or re.search(r'\{\{[a-z_]+\}\}', clean)):
        raise ValueError('Preostala oznaka za dopunu u javnom dokumentu '+doc_slug)
    return clean,toc

CSS=r'''
:root{--green:#134c36;--ink:#172b23;--muted:#52665c;--line:#dfe7e1;--wash:#f4f7f3;--amber:#fff1d4}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:26px}body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.72 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}a{color:var(--green);text-underline-offset:3px;overflow-wrap:anywhere}a:hover{text-decoration-thickness:2px}a:focus-visible,summary:focus-visible,button:focus-visible{outline:3px solid #c97935;outline-offset:4px}header.brandbar{background:var(--green);color:#fff;padding:16px max(22px,calc((100% - 1160px)/2));display:flex;gap:18px;justify-content:space-between;align-items:center}.brand{font-size:1.32rem;font-weight:820;letter-spacing:.045em;color:#fff;text-decoration:none}.brandbar span{font-size:.82rem;text-align:right}.wrap{max-width:1204px;padding:0 22px;margin:auto}.hero{padding:45px 0 22px}.eyebrow{font-size:.76rem;font-weight:760;letter-spacing:.1em;text-transform:uppercase;color:var(--green)}h1,h2,h3{letter-spacing:-.025em;line-height:1.22;overflow-wrap:break-word}h1{font-size:clamp(2.1rem,5vw,3.7rem);max-width:820px;margin:.9rem 0 1.1rem}h2{font-size:1.52rem;margin:2.2rem 0 .85rem}h3{font-size:1.15rem;margin:1.7rem 0 .6rem}p{margin:.7rem 0 1.05rem}.lead{font-size:1.14rem;max-width:800px;color:var(--muted)}.notice{padding:17px 20px;border-left:4px solid #b87923;background:var(--amber);margin:20px 0;color:#61461d;font-size:.94rem}.notice p:last-child{margin-bottom:0}.statusline{display:flex;gap:7px;flex-wrap:wrap;font-size:.79rem;color:var(--muted)}.statusline span{padding:5px 10px;background:#fff;border:1px solid var(--line);border-radius:4px}.layout{display:grid;grid-template-columns:226px minmax(0,1fr);gap:30px;padding-top:22px}.sidebar{position:sticky;top:22px;padding:0 7px 15px 0;max-height:calc(100vh - 44px);overflow:auto;font-size:.86rem}.sidebar p{font-weight:730;margin:.6rem 0}.sidebar a{display:block;text-decoration:none;line-height:1.5;margin:0;padding:8px 0;border-bottom:1px solid var(--line)}.sidebar .small{color:var(--muted);font-size:.8rem}.main{min-width:0}.band{border-top:2px solid var(--green);padding:18px 0 2px;margin:0 0 20px}.band h2{margin:.15rem 0;font-size:1.68rem}.band p{color:var(--muted);font-size:.92rem}.doc{border:1px solid var(--line);background:#fff;border-radius:7px;margin:0 0 17px;overflow:hidden}.doc>summary{cursor:pointer;list-style:none;padding:22px 26px;position:relative;padding-right:52px}.doc>summary::-webkit-details-marker{display:none}.doc>summary::after{content:'+';font-size:1.6rem;position:absolute;right:24px;top:21px;color:var(--green)}.doc[open]>summary::after{content:'−'}.doc[open]>summary{border-bottom:1px solid var(--line)}.doc>summary .num{display:block;color:var(--green);font-size:.73rem;letter-spacing:.08em;font-weight:750;text-transform:uppercase;margin-bottom:7px}.doc>summary strong{font-size:1.27rem;line-height:1.3;display:block}.doc>summary .sub{font-size:.9rem;color:var(--muted);display:block;margin-top:6px}.docbody{padding:12px 29px 30px}.docbody>:first-child{margin-top:15px}.docbody blockquote{border-left:3px solid var(--green);background:#f0f6ef;padding:13px 19px;margin:19px 0}.docbody blockquote p{margin:.2rem 0}.docbody strong{font-weight:710}.pending{background:var(--amber);color:#754f19;border-radius:3px;padding:1px 4px;box-decoration-break:clone;overflow-wrap:anywhere}.action-pending{display:block;padding:12px 16px;border:1px dashed #bb8d40}.action{display:inline-block;background:var(--green);color:#fff;text-decoration:none;padding:10px 16px;border-radius:5px;font-weight:680}.table-wrap{overflow-x:auto;width:100%;margin:18px 0 25px;border:1px solid var(--line);border-radius:3px}table{border-collapse:collapse;width:100%;font-size:.88rem;line-height:1.52;min-width:510px}th{background:#edf3ec;text-align:left;font-weight:730}th,td{padding:12px 13px;vertical-align:top;border-bottom:1px solid var(--line)}tr:last-child td{border-bottom:0}td:first-child{font-weight:610}code{font: .88em ui-monospace,Consolas,monospace;overflow-wrap:anywhere;background:#edf2ed;padding:1px 4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf2ed;padding:15px;line-height:1.5}.doctoc{background:#f7f9f6;border:1px solid var(--line);padding:11px 14px;margin:18px 0;font-size:.85rem}.doctoc summary{font-weight:720;cursor:pointer}.doctoc a{display:block;padding:4px 0;line-height:1.4}.docfooter{margin-top:25px;padding-top:13px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}.footer{margin-top:30px;border-top:1px solid var(--line);padding:25px 0 35px;color:var(--muted);font-size:.8rem}.single{max-width:960px}.single article{background:#fff;border:1px solid var(--line);border-radius:7px;margin:24px 0;padding:5px 38px 35px}.single .hero{padding-top:32px}.single h1{font-size:clamp(2rem,4vw,3rem)}.breadcrumb{margin:16px 0;font-size:.82rem}.indexlinks{display:grid;grid-template-columns:1fr 1fr;gap:14px}.indexlinks a{display:block;background:#fff;border:1px solid var(--line);padding:20px;text-decoration:none;border-radius:6px}.indexlinks strong{display:block;font-size:1.04rem}.indexlinks span{display:block;font-size:.88rem;color:var(--muted);margin-top:5px}.factpanel{padding:18px 23px;background:#fff;border:1px solid var(--line);border-radius:7px;margin-bottom:24px}.factpanel summary{font-weight:730;cursor:pointer}.factpanel h3{font-size:1.08rem}.muted{color:var(--muted)}.printbutton{border:1px solid var(--line);border-radius:4px;padding:7px 11px;background:white;color:var(--green);font:inherit;font-size:.83rem;cursor:pointer;margin:10px 0}.subtle{font-size:.85rem;color:var(--muted)}
@media(max-width:850px){.layout{grid-template-columns:1fr;gap:15px}.sidebar{position:static;max-height:none;background:#fff;padding:12px 18px;border:1px solid var(--line);border-radius:5px}.sidebar nav{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}.hero{padding-top:31px}.single article{padding:3px 25px 25px}}
@media(max-width:520px){.wrap{padding:0 15px}.brandbar{padding:14px 17px}.brandbar span{max-width:150px;font-size:.74rem}h1{font-size:2.1rem}.lead{font-size:1.04rem}.notice{padding:13px 15px}.doc>summary{padding:18px 20px;padding-right:43px}.doc>summary strong{font-size:1.13rem}.doc>summary::after{right:17px;top:16px}.docbody{padding:6px 18px 23px}.docbody h2{font-size:1.32rem}.indexlinks{grid-template-columns:1fr}.single article{padding:3px 18px 23px}.factpanel{padding:15px 18px}.table-wrap{margin-bottom:20px}table{min-width:480px;font-size:.83rem}.sidebar nav{display:block}.docbody blockquote{padding:12px 15px}.statusline{font-size:.73rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:#fff;font-size:10pt;line-height:1.5}.brandbar,.sidebar,.doctoc,.printbutton,.breadcrumb{display:none!important}.wrap{max-width:none;padding:0}.hero{padding:0}.hero h1{font-size:25pt}.layout{display:block}.doc{border:0;border-radius:0;break-before:page;overflow:visible}.doc>summary{padding:0 0 12px!important;border-bottom:1px solid #bbb}.doc>summary::after{display:none}.docbody{padding:0}.single article{border:0;padding:0}.table-wrap{overflow:visible;border:0}table{min-width:0;table-layout:fixed;font-size:8pt}th,td{padding:6px;overflow-wrap:anywhere}tr{break-inside:avoid}h2,h3{break-after:avoid}p{orphans:3;widows:3}.notice{background:none;border:1px solid #888}.pending{background:#eee;color:#333}.footer{margin-top:15px}}
'''
JS=r'''<script>
(function(){
 function showTarget(){if(!location.hash)return;let el=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(!el)return;for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;setTimeout(()=>el.scrollIntoView(),40);}
 window.addEventListener('hashchange',showTarget);showTarget();
 window.addEventListener('beforeprint',()=>{document.querySelectorAll('details').forEach(d=>{d.dataset.wasOpen=d.open?'1':'0';d.open=true;});});
 window.addEventListener('afterprint',()=>{document.querySelectorAll('details[data-was-open]').forEach(d=>{d.open=d.dataset.wasOpen==='1';delete d.dataset.wasOpen;});});
})();
</script>'''

def shell(title:str,inner:str,kind='Pregled pre objave',single=False,release=False):
    robots='' if release else '<meta name="robots" content="noindex,nofollow">'
    return '<!doctype html>\n<html lang="sr-Latn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+robots+'<meta name="color-scheme" content="light"><title>'+H(title)+' — USKOČI</title><style>'+CSS+'</style></head><body><header class="brandbar"><a href="#vrh" class="brand">USKOČI</a><span>'+H(kind)+' · v4.3</span></header><main class="wrap'+(' single' if single else '')+'" id="vrh">'+inner+'<footer class="footer">USKOČI · Dokumentacija v4.3 · Redakcija 8. oktobra 2026. '+('' if release else 'Lokalni pregled, bez slanja podataka i bez javne objave.')+'</footer></main>'+JS+'</body></html>'

def note():
    return '<aside class="notice"><strong>Uređen tekst za dopunu stvarnih činjenica — nije još javno izdanje.</strong><p>Žute oznake nisu namenjene krajnjim korisnicima. Tekst ne potvrđuje ugrađene funkcije, zakonit status operatera ili Google odobrenje. Prikaz ne šalje zahteve i ne menja aplikaciju.</p></aside>'

def toc_html(items):
    return '<details class="doctoc"><summary>Sadržaj ove celine</summary>'+''.join('<a href="#'+H(i)+'">'+H(t)+'</a>' for i,t in items)+'</details>'

def refresh_data_form(facts: dict):
    """Keep the offline form aligned with the current local facts, without granting approvals."""
    p=ROOT/'USKOCI_Dopuna_podataka_v4_3.html'
    if not p.exists(): return
    text=p.read_text(encoding='utf-8')
    pattern=r'(<script id="data" type="application/json">)(.*?)(</script>)'
    match=re.search(pattern,text,re.S)
    if not match: raise ValueError('Obrazac nema blok podataka.')
    config=json.loads(match.group(2))
    config['facts']=json.loads(json.dumps(facts))
    for key in config['facts'].get('_odobrenje',{}): config['facts']['_odobrenje'][key]=False
    config['labels']=load('podaci/oznake.json')
    payload=json.dumps(config,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    text=text[:match.start(2)]+payload+text[match.end(2):]
    p.write_text(text,encoding='utf-8')

def assemble(release=False):
    global RELEASE_STAGE
    facts=load('podaci/cinjenice.json');docs=load('podaci/dokumenti.json');internals=load('podaci/interno.json')
    warnings=fact_warnings(facts)
    if not release: refresh_data_form(facts)
    if release and warnings:
        print('Javno izdvajanje nije pripremljeno:')
        for w in warnings:print(' - '+w)
        return 2
    final_dest=ROOT/('javno_za_objavu' if release else 'pregled/sajt')
    if release and final_dest.exists():
        print('Javni izlaz već postoji. Sačuvaj prethodno izdanje pa ga ukloni pre novog izdvajanja.'); return 2
    if release:
        dest=Path(tempfile.mkdtemp(prefix='.javni_stage_', dir=ROOT)); RELEASE_STAGE=dest
    else:
        dest=final_dest
        if dest.exists(): shutil.rmtree(dest)
        dest.mkdir(parents=True,exist_ok=True)
    (ROOT/'provera').mkdir(exist_ok=True)
    for d in docs:
        content,toc=body((ROOT/d['source']).read_text(encoding='utf-8'),facts,d['slug'],release=release)
        head='<div class="breadcrumb"><a href="../pravno/index.html">Pravni centar</a></div><section class="hero"><span class="eyebrow">Pravila za korisnike · izdanje 4.3</span><h1>'+H(d['title'])+'</h1><p class="lead">'+H(d['subtitle'])+'</p><p class="subtle">Datum primene: '+H(facts.get('effective_date') or 'određuje se pre objave')+'</p></section>'
        content=head+('' if release else note())+'<article class="docbody">'+toc_html(toc)+content+'<div class="docfooter"><a href="../pravno/index.html">Sve pravne celine</a> · <a href="#vrh">Na početak</a></div></article>'
        p=dest/d['slug']/'index.html';p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(shell(d['title'],content,'Pravni centar' if release else 'Javni tekst — pregled',True,release),encoding='utf-8')
    intro='<section class="hero"><span class="eyebrow">USKOČI · informacije za korisnike</span><h1>Jasna pravila.<br>Na jednom mestu.</h1><p class="lead">Kako se dogovaramo, kako čuvamo podatke i kome se obraćaš kada ti treba pomoć.</p></section>'+('' if release else note())
    links='<div class="indexlinks">'+''.join('<a href="../'+d['slug']+'/index.html"><strong>'+H(d['title'])+'</strong><span>'+H(d['subtitle'])+'</span></a>' for d in docs)+'</div>'
    p=dest/'pravno/index.html';p.parent.mkdir(exist_ok=True);p.write_text(shell('Pravni centar',intro+links,release=release),encoding='utf-8')
    # A plain local landing index does not replace the existing product home page.
    if not release:
        (dest/'index.html').write_text(shell('Pravni paket','<section class="hero"><h1>Pravni centar USKOČI</h1><p><a class="action" href="pravno/index.html">Otvori pravne celine</a></p><p class="subtle">Pri ugradnji zadržati postojeću početnu stranicu proizvoda.</p></section>',release=release),encoding='utf-8')
    if release:
        (dest/'README_OBJAVA.txt').write_text('Samo odobrene javne HTML stranice. Ugraditi u postojeći sajt; izdvajaju se sedam ruta i pravni centar, bez zamene početne stranice. Interni dokumenti i podaci ne idu u web root. Statična stranica ne izvršava serverske radnje.\n',encoding='utf-8')
        records=[]
        for page in sorted(dest.rglob('*.html')):
            rel=page.relative_to(dest).as_posix()
            records.append({'path':rel,'local_file_sha256':hashlib.sha256(page.read_bytes()).hexdigest(),
                'planned_url':facts['base_url'].rstrip('/')+'/'+rel.removesuffix('index.html')})
        handoff=ROOT/'predaja'; handoff.mkdir(exist_ok=True)
        (handoff/'otisci_javnih_fajlova.json').write_text(json.dumps({
            'status':'LOCAL_EXPORT_NOT_DEPLOYED','package_version':'4.3',
            'hash_definition':'SHA-256 of local HTML file bytes; NOT verified as server registry hash',
            'effective_date':facts['effective_date'],'files':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        dest.rename(final_dest); RELEASE_STAGE=None
        print('Izdvojene javne stranice:',final_dest,'— nisu objavljene na internetu.');return 0
    # All-in-one offline reader; internal content clearly separated.
    hero='<section class="hero"><span class="eyebrow">Milošev pregled · 8. oktobar 2026.</span><h1>Dokumenti za objavu.<br>Bez viška papira.</h1><p class="lead">Sedam javnih celina za USKOČI, priprema za Google Play i jasno izdvojeno ono što još traži stvaran podatak.</p><div class="statusline"><span>Prvo Srbija</span><span>Platforma 0 RSD</span><span>Jedan nalog · dva izbora</span><span>Bez javne objave u ovoj isporuci</span></div></section>'+note()
    hero+='<details class="factpanel" id="dopune"><summary>Šta još treba uneti pre javne objave?</summary><p>Ne pišeš dokumente ponovo. Na jednom mestu potvrđuju se operater i kontakt, stvarna obrada podataka, rokovi i nekoliko činjenica o konkretnom izdanju.</p><div class="table-wrap"><table><thead><tr><th>Grupa</th><th>Stvarni podaci</th></tr></thead><tbody><tr><td>Operater</td><td>Zvanično ime, razrešeno svojstvo, zakonita adresa, javni kontakt i potrebna registracija.</td></tr><tr><td>Podaci</td><td>Pružaoci i države obrade, zvuk, izvoz, backup, rokovi i web tehnologije.</td></tr><tr><td>Aplikacija</td><td>Stvarni javni profil, rangiranje, AI izbor, put brisanja/podrške, kopija Dogovora i propisani obrazac.</td></tr><tr><td>Objava</td><td>Datum primene, odobrena publika, aktivne veze i istiniti odgovori u Play Console.</td></tr></tbody></table></div><p><a class="action" href="USKOCI_Dopuna_podataka_v4_3.html">Otvori lokalnu dopunu podataka</a></p><p class="subtle">Detalji: <a href="#vodic">Vodič</a>. Unosi: <code>podaci/cinjenice.json</code>; potvrđeni rokovi: <code>retention_schedule</code>; uputstvo: <code>podaci/rokovi.md</code>. Privatni dokumenti i šifre se ne traže.</p></details>'
    sidebar='<aside class="sidebar"><p>ZA KORISNIKE</p><nav>'+''.join('<a href="#'+d['slug']+'">'+H(d['title'])+'</a>' for d in docs)+'</nav><p>SAMO ZA PRIPREMU</p><nav>'+''.join('<a href="#'+d['slug']+'">'+H(d['title'])+'</a>' for d in internals)+'</nav><p class="small">Klik na naslov otvara ceo tekst. Puni pregled ne postavljati na sajt.</p></aside>'
    main='<section class="band" id="javno"><h2>Za korisnike</h2><p>Puni tekstovi, uređeni u sedam logičnih celina. Otvori naslov za čitanje.</p></section>'
    for i,d in enumerate(docs,1):
        content,toc=body((ROOT/d['source']).read_text(encoding='utf-8'),facts,d['slug'],combined=True)
        main+='<details class="doc" id="'+d['slug']+'"><summary><span class="num">Javna celina '+str(i).zfill(2)+'</span><strong>'+H(d['title'])+'</strong><span class="sub">'+H(d['subtitle'])+'</span></summary><div class="docbody">'+toc_html(toc)+content+'<div class="docfooter">Planirana putanja: /'+d['slug']+'/ · <a href="#javno">Pregled celina</a></div></div></details>'
    main+='<section class="band" id="interno"><h2>Za pripremu objave</h2><p>Ovi delovi ostaju kod vlasnika i saradnika. Ne idu u javni pravni centar.</p></section>'
    for d in internals:
        content,toc=body((ROOT/d['source']).read_text(encoding='utf-8'),facts,d['slug'],combined=True)
        main+='<details class="doc" id="'+d['slug']+'"><summary><span class="num">Interno · nije za javni sajt</span><strong>'+H(d['title'])+'</strong></summary><div class="docbody">'+toc_html(toc)+content+'<div class="docfooter"><a href="#interno">Pregled pripreme</a></div></div></details>'
    out=ROOT/'USKOCI_Paket_za_objavu_v4_3_pregled.html'
    out.write_text(shell('Paket za objavu v4.3',hero+'<div class="layout">'+sidebar+'<div class="main">'+main+'</div></div>'),encoding='utf-8')
    # Compact owner-only standalone file.
    d=internals[0];content,toc=body((ROOT/d['source']).read_text(encoding='utf-8'),facts,'vodic',True)
    o=ROOT/'USKOCI_Kratko_uputstvo_v4_3.html'
    o.write_text(shell('Kratko uputstvo za objavu','<section class="hero"><span class="eyebrow">Interno · za Miloša</span><h1>Šta je pripremljeno.<br>Šta ide sledeće.</h1></section>'+note()+'<article class="docbody">'+content+'<p><a href="USKOCI_Paket_za_objavu_v4_3_pregled.html#izvori">Izvori i kompletan paket</a></p></article>',single=True),encoding='utf-8')
    (ROOT/'provera/podaci_koji_nedostaju.txt').write_text('\n'.join(warnings)+'\n',encoding='utf-8')
    print('Sastavljen lokalni pregled; 7 javnih celina. Javno izdvajanje još nije odobreno.')
    return 0

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--javno',action='store_true',help='Izdvoji samo javne fajlove posle dopune i potvrde; ne šalje ih na hosting.')
    parser.add_argument('--proveri-podatke',action='store_true',help='Prikaži preostale podatke bez promene fajlova.')
    args=parser.parse_args()
    if args.proveri_podatke:
        problems=fact_warnings(load('podaci/cinjenice.json'))
        for p in problems:print(p)
        return 2 if problems else 0
    return assemble(args.javno)
if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as e:
        print('Greška: '+str(e),file=sys.stderr);sys.exit(1)
    finally:
        if RELEASE_STAGE is not None and RELEASE_STAGE.exists(): shutil.rmtree(RELEASE_STAGE)
