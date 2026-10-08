"""USKOČI javni sajt — generator statičkih stranica.

python -P site/build.py            -> site/public   (produkcija: čisti URL-ovi /kako-radi/, kanonski domen)
python -P site/build.py --preview  -> site/preview  (relativne veze sa index.html, za pregled bez servera)

Pravni tekstovi dolaze iz paketa v4.3 (site/_paket/...) bez prepisivanja; prazna polja se prikazuju kao
vidljiva oznaka „nedostaje“, nikad kao izmišljen podatak. Sve stranice nose noindex dok vlasnik ne odobri objavu.
"""
import html, json, os, re, shutil, sys
import mistune

ROOT = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.join(ROOT, '_paket', 'USKOCI_Paket_za_objavu_v4_3')
PREVIEW = '--preview' in sys.argv
OUT = os.path.join(ROOT, 'preview' if PREVIEW else 'public')
LANG = 'sr-Latn'
BASE = 'https://uskoci.rs'
INDEXABLE = False  # vlasnikova reč za objavu; do tada noindex svuda
DOC_VERSION = 'v4.3'

# Javni kontakt iz vlasnikove komande (8. 10.). Čeka potvrdu da prima poruke — vidi IZVESTAJ.md.
PUBLIC_EMAIL = 'uskoci.support@gmail.com'

FACTS = json.load(open(os.path.join(PKG, 'podaci', 'cinjenice.json'), encoding='utf-8'))
LABELS = json.load(open(os.path.join(PKG, 'podaci', 'oznake.json'), encoding='utf-8'))
DOCS = json.load(open(os.path.join(PKG, 'podaci', 'dokumenti.json'), encoding='utf-8'))
FACTS['public_email'] = FACTS.get('public_email') or PUBLIC_EMAIL
# Ime operatera prikazujemo tek kad vlasnik potvrdi zvaničan zapis (cinjenice.json, _odobrenje).
if not FACTS.get('_odobrenje', {}).get('zvanicno_ime_i_javni_podaci_potvrdjeni'):
    FACTS['operator_name'] = ''

E = html.escape


# ---------------------------------------------------------------- veze
def url(slug, frm=''):
    """slug '' = početna. U pregledu relativno sa index.html, u produkciji čisto i apsolutno."""
    slug = slug.strip('/')
    if not PREVIEW:
        return '/' + (slug + '/' if slug else '')
    depth = len([p for p in frm.strip('/').split('/') if p])
    up = '../' * depth
    return up + (slug + '/' if slug else '') + 'index.html'


def asset(path, frm):
    if not PREVIEW:
        return '/' + path
    depth = len([p for p in frm.strip('/').split('/') if p])
    return '../' * depth + path


# ---------------------------------------------------------------- ikone (linijske, iz rečnika aplikacije)
ARROW = '<svg class="arr" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHECK_G = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#00845A"/><path d="m7 12.3 3.2 3.2L17 8.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3.5v17l16-8.5z" fill="#0B3D2E"/></svg>'
PLAY_W = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.8v18.4c0 .5.6.9 1 .6L21 12.6c.4-.3.4-.9 0-1.2L5 2.2c-.4-.3-1 .1-1 .6z" fill="#fff"/></svg>'


# ---------------------------------------------------------------- okvir
NAV = [('kako-radi', 'Kako radi'), ('meni-treba', 'Meni treba'), ('ja-mogu', 'Ja mogu'),
       ('aplikacija', 'Aplikacija'), ('bezbednost', 'Bezbednost'), ('pitanja', 'Pitanja'), ('pravno', 'Pravno')]

FOOT = [
    ('USKOČI', [('kako-radi', 'Kako radi'), ('aplikacija', 'Aplikacija'), ('o-proizvodu', 'O proizvodu'), ('preuzmi', 'Preuzimanje')]),
    ('Pomoć', [('podrska', 'Podrška i kontakt'), ('bezbednost', 'Bezbednost i poverenje'), ('pitanja', 'Česta pitanja'), ('dostupnost', 'Dostupnost')]),
    ('Pravno', [('privatnost', 'Privatnost'), ('uslovi-koriscenja', 'Uslovi korišćenja'), ('pravila-zajednice', 'Pravila zajednice'), ('brisanje-naloga', 'Brisanje naloga'), ('pravno', 'Pravni centar')]),
]


def layout(slug, title, desc, body, extra_head=''):
    t = 'USKOČI — Pomoć kad ti treba. Prilika kad možeš.' if not slug else f'{title} · USKOČI'
    canon = BASE + ('/' + slug + '/' if slug else '/')
    nav = ''.join(
        f'<a href="{url(s, slug)}"{" aria-current=\"page\"" if s == slug else ""}>{E(n)}</a>' for s, n in NAV)
    foot = ''.join(
        f'<div><h2>{E(h)}</h2><ul>' + ''.join(f'<li><a href="{url(s, slug)}">{E(n)}</a></li>' for s, n in links) + '</ul></div>'
        for h, links in FOOT)
    robots = 'index,follow' if INDEXABLE else 'noindex,nofollow'
    og = asset('img/og.png', slug) if PREVIEW else BASE + '/img/og.png'
    return f'''<!doctype html>
<html lang="{LANG}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(t)}</title>
<meta name="description" content="{E(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#FBFAF7">
<meta property="og:type" content="website">
<meta property="og:site_name" content="USKOČI">
<meta property="og:locale" content="sr_RS">
<meta property="og:title" content="{E(t)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="{asset('favicon.png', slug)}">
<link rel="apple-touch-icon" href="{asset('apple-touch-icon.png', slug)}">
<link rel="preload" href="{asset('fonts/inter-ExtraBold.woff2', slug)}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{asset('assets/site.css', slug)}">
{extra_head}
</head>
<body>
<a class="skip" href="#sadrzaj">Preskoči na sadržaj</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="{url('', slug)}" aria-label="USKOČI — početna"><img src="{asset('img/logo.webp', slug)}" width="720" height="248" alt="USKOČI"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Meni</button>
    <nav class="nav" id="nav" aria-label="Glavni meni">{nav}</nav>
    <span class="soon">{PLAY}Uskoro na Google Play-u</span>
  </div>
</header>
<main id="sadrzaj">
{body}
</main>
<footer class="foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="{url('', slug)}"><img src="{asset('img/logo.webp', slug)}" width="720" height="248" alt="USKOČI"></a>
        <p class="about">Aplikacija koja povezuje ljude kojima treba pomoć oko konkretnog zadatka sa onima koji mogu da uskoče.</p>
      </div>
      {foot}
      <div><h2>Kontakt</h2><ul><li><a href="mailto:{E(FACTS['public_email'])}">{E(FACTS['public_email'])}</a></li><li><a href="{url('operater-i-kontakt', slug)}">Ko stoji iza USKOČI-ja</a></li><li><a href="{url('dostupnost', slug)}">Srbija · regioni uskoro</a></li></ul></div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 USKOČI · Android aplikacija, uskoro na Google Play-u</span>
      <span>Početno izdanje: Srbija, 18+. Korišćenje platforme je besplatno.</span>
    </div>
  </div>
</footer>
<script src="{asset('assets/site.js', slug)}" defer></script>
</body>
</html>
'''


def page_hero(eyebrow, title, lead, img=None, slug=''):
    im = f'<img src="{asset("img/" + img + ".webp", slug)}" width="480" height="480" alt="" loading="eager">' if img else ''
    return f'''<section class="page-hero"><div class="wrap"><div>
<p class="eyebrow">{E(eyebrow)}</p><h1>{title}</h1><p class="lead">{lead}</p></div>{im}</div></section>'''


def card(img, title, text, slug, link=None):
    more = f'<a class="more" href="{url(link[0], slug)}">{E(link[1])} →</a>' if link else ''
    return f'<article class="card reveal"><img src="{asset("img/" + img + ".webp", slug)}" width="480" height="480" alt="" loading="lazy"><h3>{title}</h3><p>{text}</p>{more}</article>'


# ---------------------------------------------------------------- robot (lice + LED sloj, kao u studiji izraza)
def robot_svg(kind, label, slug):
    base = asset(f'img/robot-{kind}-face.webp', slug)
    reg = 'matrix(1 0 0 1 0 0)' if kind == 'task' else 'matrix(0.98603352 0 0 0.95833333 27.26256983 -0.83333333)'
    return f'''<svg class="robot" viewBox="0 0 1254 1254" role="img" aria-label="{E(label)}">
<image href="{base}" width="1254" height="1254"/>
<g transform="{reg}">
<path class="led" d="M 476 630 Q 519 592 574 614" stroke-width="17"/>
<path class="led" d="M 850 635 Q 903 612 936 663" stroke-width="16"/>
<g class="blink"><ellipse class="led" cx="520" cy="772" rx="72" ry="81" stroke-width="29"/><circle class="glint" cx="545" cy="741" r="15"/></g>
<g class="blink"><ellipse class="led" cx="878" cy="796" rx="65" ry="77" stroke-width="28"/><circle class="glint" cx="884" cy="765" r="14"/></g>
<path class="led" d="M 612 863 Q 692 945 773 874" stroke-width="18"/>
</g></svg>'''


# ---------------------------------------------------------------- ekrani telefona (crtani po stvarnoj aplikaciji)
def screens(slug):
    a = lambda p: asset(p, slug)
    map_svg = '''<svg viewBox="0 0 330 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="330" height="640" fill="#EEF1EC"/>
<path d="M-20 420 C 80 380 140 470 350 400" stroke="#9DC7E8" stroke-width="26" fill="none"/>
<path d="M40 -10 L 120 660 M -10 200 L 340 150 M -10 330 L 340 300 M 210 -10 L 260 660" stroke="#fff" stroke-width="12"/>
<path d="M-10 520 L 340 560 M 300 -10 L 160 660" stroke="#fff" stroke-width="7"/>
<rect x="140" y="210" width="60" height="70" rx="6" fill="#DCEBDD"/><rect x="230" y="470" width="80" height="60" rx="6" fill="#DCEBDD"/>
<g font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="12">
<g transform="translate(70 250)"><rect x="-30" y="-15" width="60" height="30" rx="15" fill="#fff" stroke="#DEDEDE"/><text x="0" y="4" text-anchor="middle" fill="#202020">2.500</text></g>
<g transform="translate(232 222)"><circle r="28" fill="#FF7A1A" opacity=".25"/><rect x="-34" y="-17" width="68" height="34" rx="17" fill="#fff" stroke="#FF7A1A" stroke-width="2.5"/><text x="0" y="4" text-anchor="middle" fill="#202020">3.000</text></g>
<g transform="translate(110 370)"><rect x="-26" y="-15" width="52" height="30" rx="15" fill="#fff" stroke="#DEDEDE"/><text x="0" y="4" text-anchor="middle" fill="#202020">Dogovor</text></g>
<g transform="translate(262 330)"><circle r="16" fill="#202020"/><text x="0" y="4" text-anchor="middle" fill="#fff">3</text></g>
</g>
<circle cx="170" cy="310" r="9" fill="#3979C4" stroke="#fff" stroke-width="4"/>
</svg>'''
    return [
        ('pocetna', f'''<div class="s-bar">Početna</div>
<div class="s-tile g"><b>Meni treba</b><span>Objavi zadatak</span></div>
<div class="s-tile o"><b>Ja mogu</b><span>Pronađi zadatke u blizini</span></div>
<div class="s-card"><div class="s-kv"><b>Čeka te</b><span>1</span></div><div class="t">Nova prijava za tvoj zadatak</div></div>
<div class="s-tabs"><span class="on">Početna</span><span>Zadaci</span><span>Dogovori</span></div>'''),
        ('opis', f'''<div class="s-ai"><img src="{a('img/robot-task.webp')}" alt="" width="34" height="34"><p>Reci šta ti treba.</p></div>
<div class="s-me">Treba mi neko da sastavi ormar u petak popodne.</div>
<div class="s-ai"><img src="{a('img/robot-task.webp')}" alt="" width="34" height="34"><p>Važi. U kom mestu je ormar, i koliko bi da platiš?</p></div>
<div class="s-me">Novi Beograd. Oko 3.000 dinara.</div>
<div class="s-compose">Piši ili drži za govor<span class="mic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" fill="#fff"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></span></div>'''),
        ('pregled', f'''<div class="s-bar"><span class="back">‹</span>Pregled pre objave</div>
<div class="s-card"><div class="t">Sastavljanje ormara</div><div class="row"><span class="chip"><i></i>Novi Beograd</span><span class="chip t"><i></i>Pet · 16:00</span></div><div class="s-price">3.000 RSD</div></div>
<div class="s-kv"><span>Tačna adresa</span><b>Vidiš samo ti</b></div>
<div class="s-rule"></div>
<p class="muted small">Ovako će drugi videti tvoj zadatak. Tačnu adresu dobija samo osoba sa kojom potvrdiš Dogovor.</p>
<div class="s-primary mt">Objavi zadatak</div>'''),
        ('mapa', f'''<div class="s-map">{map_svg}</div>
<div class="s-search"><div>Pretraži zadatke</div><i>≡</i></div>
<div class="s-caps"><span class="s-cap">Na daljinu</span><span class="s-cap on">Danas</span><span class="s-cap">Ovaj vikend</span></div>
<div class="s-sheet"><span class="s-grab"></span><div class="s-card"><div class="t">Sastavljanje ormara</div><div class="row"><span class="chip"><i></i>Novi Beograd · 1,2 km</span><span class="chip t"><i></i>Pet · 16:00</span></div><div class="s-price">3.000 RSD</div></div></div>'''),
        ('prijava', f'''<div class="s-bar"><span class="back">‹</span>Prijava</div>
<div class="s-card"><div class="t">Sastavljanje ormara</div><div class="s-kv"><span>Termin</span><b>Petak · 16:00</b></div><div class="s-kv"><span>Iznos</span><b>3.000 RSD</b></div></div>
<p class="small"><b>Poruka uz prijavu</b></p>
<div class="s-card"><span class="muted">Mogu u petak posle 15h. Imam svoj alat.</span></div>
<div class="s-primary mt">Pošalji prijavu</div>'''),
        ('dogovor', f'''<div class="s-bar"><span class="back">‹</span>Dogovor</div>
<div class="s-person"><img src="{a('img/photo-worker.webp')}" alt="" width="40" height="40"><div><b>Marko</b><span>Prihvatio uslove</span></div></div>
<div class="s-card"><div class="s-kv"><span>Posao</span><b>Sastavljanje ormara</b></div><div class="s-kv"><span>Termin</span><b>Pet · 16:00</b></div><div class="s-kv"><span>Iznos</span><b>3.000 RSD</b></div><div class="s-kv"><span>Plaćanje</span><b>Direktno</b></div></div>
<div class="s-step"><i>{CHECK}</i>Obe strane su potvrdile</div>
<div class="s-step wait"><i></i>Posao je gotov</div>
<div class="s-step wait"><i></i>Ocena</div>
<div class="s-primary mt">Poruke</div>'''),
    ]


def phone(scr_list, only=None, cls=''):
    inner = ''.join(f'<div class="scr{" on" if (only and k == only) else ""}" data-screen="{k}" aria-hidden="true">{h}</div>'
                    for k, h in scr_list if (only is None or k == only))
    return f'<div class="phone {cls}"><div class="screen">{inner}</div></div>'


# ---------------------------------------------------------------- početna
def home():
    s = ''
    scr = screens(s)
    stage = f'''<div class="stage-wrap rise d2">
<div class="stage" role="img" aria-label="Kratka scena: osoba objavi zadatak, USKOČI robot za zadatke pomogne da se opiše, robot sa šlemom kaže da može, i nastaje Dogovor.">
  <div class="st st-person"><div class="taskcard">
    <div class="who"><img src="{asset('img/photo-requester.webp', s)}" width="384" height="576" alt=""><div><b>Ana</b><span>treba joj pomoć</span></div></div>
    <p>Treba mi neko da sastavi ormar u petak popodne.</p>
    <div class="facts"><span class="chip"><i></i>Novi Beograd</span><span class="chip t"><i></i>Pet · 16:00</span></div>
  </div></div>
  <div class="st st-rtask">{robot_svg('task', 'USKOČI robot za zadatke', s)}</div>
  <div class="st st-rwork">{robot_svg('worker', 'USKOČI robot sa šlemom', s)}</div>
  <div class="st bubble l">Opisaćemo ga zajedno.</div>
  <div class="st bubble r">Petak mi odgovara. Uskačem!</div>
  <div class="st st-deal"><div class="deal"><span class="ok">{CHECK}</span><div><b>Dogovoreno</b><span>Petak · 16:00 · 3.000 RSD</span></div></div></div>
  <div class="st st-finale"><img src="{asset('img/logo.webp', s)}" width="720" height="248" alt="USKOČI"><p>Neko ima zadatak. <span>Neko može da uskoči.</span></p></div>
</div>
<div class="stage-ctl"><button class="ctl" id="replay" type="button">↻ Pogledaj ponovo</button><button class="ctl" id="still" type="button">Zaustavi pokret</button></div>
</div>'''
    steps = [
        ('pocetna', 'Jedna aplikacija', 'Dva izbora na početku.', 'Na Početnoj biraš: treba ti pomoć ili možeš da pomogneš. Sve što čeka tvoju odluku je odmah ispod.'),
        ('opis', 'Meni treba · 1', 'Kažeš šta ti treba.', 'Svojim rečima, kucanjem ili glasom. AI asistent pita samo ono što fali — mesto, vreme, iznos — i ti proveravaš svaki predlog.'),
        ('pregled', 'Meni treba · 2', 'Vidiš zadatak kao drugi.', 'Pre objave vidiš tačno kako će zadatak izgledati drugima. Tačnu adresu vidiš samo ti, dok ne potvrdiš Dogovor.'),
        ('mapa', 'Ja mogu · 1', 'Zadaci na mapi i u listi.', 'Mapa preko celog ekrana, lista koja se izvlači odozdo, brzi izbori kao „Danas“ i „Na daljinu“. Filteri su odvojeni od pretrage.'),
        ('prijava', 'Ja mogu · 2', 'Prijava sa porukom.', 'Javiš se za zadatak i napišeš kada možeš. Osoba koja je objavila bira sa kim će se dogovoriti.'),
        ('dogovor', 'Dogovor', 'Isti uslovi za obe strane.', 'Posao, termin, iznos i način plaćanja potvrđuju oboje. Posle posla: „Posao je gotov“, potvrda i ocena.'),
    ]
    step_html = ''.join(f'''<div class="step" data-screen="{k}"><span class="eyebrow">{E(e)}</span><h3>{E(h)}</h3><p>{E(p)}</p>
<div class="mini">{phone(scr, only=k)}</div></div>''' for k, e, h, p in steps)
    body = f'''
<section class="hero"><div class="wrap">
  <div class="hero-copy">
    <p class="eyebrow rise">USKOČI · aplikacija za Android</p>
    <h1 class="rise d1"><span>Pomoć <span class="g">kad ti treba.</span></span><span>Prilika <span class="o">kad možeš.</span></span></h1>
    <p class="lead rise d2">Objavi konkretan zadatak ili se prijavi za tuđi. Dogovorite posao, termin i iznos — jasno, od čoveka do čoveka, u Srbiji.</p>
    <div class="row rise d3">
      <a class="btn green" href="{url('meni-treba')}">Meni treba {ARROW}</a>
      <a class="btn ink" href="{url('ja-mogu')}">Ja mogu {ARROW}</a>
      <a class="btn ghost" href="{url('kako-radi')}">Kako radi</a>
    </div>
    <div class="meta rise d4"><span><span class="dot"></span><b>Uskoro na Google Play-u</b></span><span>Besplatno korišćenje</span><span>Bez provizije</span><span>18+</span></div>
  </div>
  {stage}
</div></section>

<section class="sec white" id="dva-puta"><div class="wrap">
  <div class="sec-head reveal"><p class="eyebrow">Jedan nalog, dva izbora</p><h2>Ti biraš sa koje strane uskačeš.</h2>
  <p class="lead">Isti ljudi nekad traže pomoć, a nekad je pružaju. Zato je USKOČI jedna aplikacija sa dva jasna puta.</p></div>
  <div class="paths">
    <a class="path need reveal" href="{url('meni-treba')}"><img class="bg" src="{asset('img/photo-requester.webp', s)}" width="384" height="576" alt="" loading="lazy">
      <div class="in"><span class="tag">MENI TREBA</span><h3>Opiši. Objavi. Izaberi.</h3>
      <ol><li>Kažeš šta ti treba, AI pomaže da opis bude jasan</li><li>Odrediš mesto i termin, pa objaviš</li><li>Pregledaš prijave i potvrdiš Dogovor</li></ol>
      <span class="go">Saznaj više {ARROW}</span></div></a>
    <a class="path work reveal" href="{url('ja-mogu')}"><img class="bg" src="{asset('img/photo-worker.webp', s)}" width="675" height="900" alt="" loading="lazy">
      <div class="in"><span class="tag">JA MOGU</span><h3>Pronađi. Prijavi se. Uskoči.</h3>
      <ol><li>Zadaci oko tebe na mapi, ili na daljinu</li><li>Prijaviš se porukom i terminom koji ti odgovara</li><li>Kad te izaberu, uslovi su jasni pre početka</li></ol>
      <span class="go">Saznaj više {ARROW}</span></div></a>
  </div>
</div></section>

<section class="sec" id="aplikacija"><div class="wrap">
  <div class="sec-head reveal"><p class="eyebrow">Aplikacija</p><h2>Od reči do Dogovora, u nekoliko koraka.</h2></div>
  <div class="show">
    <div class="steps">{step_html}</div>
    <div class="phone-col" aria-hidden="true">{phone(scr)}<p class="phone-note">Prikazi su složeni po ekranima aplikacije u razvoju. Snimci ekrana iz izdanja stižu sa objavom na Google Play-u.</p></div>
  </div>
</div></section>

<section class="sec forest"><div class="wrap deal-split">
  <div class="reveal"><p class="eyebrow">Dogovor</p><h2 style="font-size:clamp(36px,5vw,64px)">Sve važno je dogovoreno pre početka.</h2>
    <p class="lead" style="margin-top:18px">Dogovor je zapis koji obe strane potvrđuju. Ako nešto treba promeniti, menja se otvoreno i ponovo potvrđuje.</p>
    <ul class="checklist" style="margin-top:28px">
      <li>{CHECK_G}<span><b>Šta tačno</b> — obim posla, bez nagađanja.</span></li>
      <li>{CHECK_G}<span><b>Kada i gde</b> — termin po vremenu u Srbiji, a tačna adresa tek posle potvrde.</span></li>
      <li>{CHECK_G}<span><b>Koliko</b> — iznos i dodatni troškovi, plaćanje direktno između vas.</span></li>
    </ul></div>
  <div class="agreement reveal" aria-label="Primer Dogovora">
    <h3>Dogovor · Sastavljanje ormara</h3>
    <div class="s-kv"><span>Termin</span><b>Petak, 16:00</b></div>
    <div class="s-rule"></div>
    <div class="s-kv"><span>Mesto</span><b>Novi Beograd</b></div>
    <div class="s-rule"></div>
    <div class="s-kv"><span>Iznos</span><b>3.000 RSD</b></div>
    <div class="s-rule"></div>
    <div class="s-kv"><span>Plaćanje</span><b>Direktno, između vas</b></div>
    <div class="both"><div>{CHECK_G}Ana potvrdila</div><div>{CHECK_G}Marko potvrdio</div></div>
    <p class="small muted">Primer. Imena i iznos su ilustracija.</p>
  </div>
</div></section>

<section class="sec white"><div class="wrap">
  <div class="sec-head reveal"><p class="eyebrow">Jasno od prvog dana</p><h2>Šta USKOČI jeste, a šta nije.</h2></div>
  <div class="facts-grid reveal">
    <div><b>Besplatno</b><p>Korišćenje platforme u ovom izdanju ne košta ništa.</p></div>
    <div><b>Bez provizije</b><p>USKOČI ne uzima deo iznosa i ne prima novac za zadatke.</p></div>
    <div><b>Direktno plaćanje</b><p>Nema novčanika ni čuvanja novca. Plaćate jedno drugom, kako se dogovorite.</p></div>
    <div><b>Srbija, 18+</b><p>Zadaci se izvršavaju u Srbiji. Region i dijaspora dolaze kasnije.</p></div>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-head reveal"><p class="eyebrow">Poverenje</p><h2>Bezbednost je deo svakog koraka.</h2></div>
  <div class="cards">
    {card('ill-pin', 'Adresa ostaje tvoja', 'Drugi vide samo okvirno mesto. Tačnu adresu dobija osoba sa kojom potvrdiš Dogovor.', s)}
    {card('ill-people', 'Ti biraš sa kim', 'Nijedna prijava nije obaveza. Gledaš ko se javio i odlučuješ sam.', s)}
    {card('ill-support', 'Prijavi i blokiraj', 'Prijava problema i blokiranje osobe dostupni su u aplikaciji, uz podršku kada zatreba.', s, ('bezbednost', 'Bezbednost i poverenje'))}
  </div>
</div></section>

<section class="sec tight"><div class="wrap">
  <div class="cta reveal">
    <div><h2>Uskoro na Google Play-u.</h2><p>Prvo izdanje je za Android, za ljude u Srbiji. Javićemo kad bude spremno za preuzimanje.</p>
      <div class="row" style="margin-top:24px"><span class="badge-soon">{PLAY_W}<span><small>Uskoro na</small><b>Google Play</b></span></span><a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.35)" href="{url('pitanja')}">Česta pitanja</a></div></div>
    <div class="robots"><img src="{asset('img/robot-task.webp', s)}" width="720" height="720" alt="" loading="lazy"><img src="{asset('img/robot-worker.webp', s)}" width="720" height="720" alt="" loading="lazy"></div>
  </div>
</div></section>
'''
    return layout('', '', 'USKOČI povezuje ljude kojima treba pomoć oko konkretnog zadatka sa onima koji mogu da uskoče. Objavi zadatak ili se prijavi, pa potvrdite jasan Dogovor. Uskoro na Google Play-u.', body)


# ---------------------------------------------------------------- unutrašnje stranice
def simple(slug, title, desc, eyebrow, h1, lead, img, sections):
    body = page_hero(eyebrow, h1, lead, img, slug) + sections
    return layout(slug, title, desc, body)


def meni_treba():
    s = 'meni-treba'
    scr = screens(s)
    body = f'''<section class="sec tight"><div class="wrap show">
<div class="steps">
<div class="step on"><span class="eyebrow">Korak 1</span><h3>Reci šta ti treba.</h3><p>Opiši zadatak svojim rečima, kucanjem ili glasom. AI asistent postavlja samo pitanja o onome što nedostaje: gde, kada, koliko. Svaki predlog vidiš i menjaš pre objave.</p><div class="mini">{phone(scr, only='opis')}</div></div>
<div class="step on"><span class="eyebrow">Korak 2</span><h3>Mesto i termin.</h3><p>Odredi mesto na mapi ili označi da je posao na daljinu. Termin može biti tačan ili okviran. Vreme je uvek po vremenu u Srbiji.</p></div>
<div class="step on"><span class="eyebrow">Korak 3</span><h3>Pregled, pa objava.</h3><p>Pre objave vidiš zadatak tačno onako kako će ga videti drugi. Tačnu adresu vidiš samo ti.</p><div class="mini">{phone(scr, only='pregled')}</div></div>
<div class="step on"><span class="eyebrow">Korak 4</span><h3>Izaberi i potvrdi Dogovor.</h3><p>Pregledaš ko se prijavio i zašto. Kad izabereš, potvrđujete iste uslove. Posle posla potvrđuješ da je gotov i ostavljaš ocenu.</p></div>
</div>
<div class="phone-col" aria-hidden="true">{phone(scr, only='pregled')}</div>
</div></section>
<section class="sec white"><div class="wrap"><div class="sec-head reveal"><h2>Primeri zadataka</h2><p class="lead">Konkretni poslovi koje neko može da obavi u dogovorenom terminu.</p></div>
<div class="cards">{card('ill-tool', 'Kućne sitnice', 'Sastavljanje nameštaja, kačenje polica, sitne popravke.', s)}{card('ill-task-launch', 'Pomoć u selidbi', 'Nošenje kutija, pakovanje, pomoć u prenosu stvari.', s)}{card('ill-remote', 'Na daljinu', 'Poslovi koji ne zahtevaju dolazak — označeni su posebno i lako se pronalaze.', s)}</div>
<p class="small muted" style="margin-top:20px">Nisu sve vrste poslova dozvoljene; regulisane i rizične aktivnosti imaju ograničenja. Detalji su u <a href="{url('pravila-zajednice', s)}">Pravilima zajednice</a>. USKOČI nije hitna služba.</p></div></section>'''
    return simple(s, 'Meni treba', 'Kako da objaviš zadatak na USKOČI-ju: opiši šta ti treba, odredi mesto i termin, pregledaj i objavi, pa izaberi sa kim potvrđuješ Dogovor.',
                  'MENI TREBA', 'Treba ti pomoć? <span style="color:var(--green)">Reci šta.</span>', 'Od rečenice do objavljenog zadatka za nekoliko minuta — a sa kim ćeš raditi, biraš ti.', 'ill-task-launch', body)


def ja_mogu():
    s = 'ja-mogu'
    scr = screens(s)
    body = f'''<section class="sec tight"><div class="wrap show">
<div class="steps">
<div class="step on"><span class="eyebrow">Korak 1</span><h3>Zadaci oko tebe.</h3><p>Mapa preko celog ekrana i lista koja se izvlači odozdo. Brzi izbori „Danas“, „Ovaj vikend“ i „Na daljinu“; pretraga i filteri su odvojeni, pa uvek znaš šta si suzio.</p><div class="mini">{phone(scr, only='mapa')}</div></div>
<div class="step on"><span class="eyebrow">Korak 2</span><h3>Radni profil.</h3><p>Opišeš šta umeš i kada možeš — razgovorom sa asistentom ili sam. Profil pomaže da dobiješ zadatke koji ti odgovaraju.</p></div>
<div class="step on"><span class="eyebrow">Korak 3</span><h3>Prijava.</h3><p>Javiš se kratkom porukom i terminom. Osoba koja je objavila zadatak bira.</p><div class="mini">{phone(scr, only='prijava')}</div></div>
<div class="step on"><span class="eyebrow">Korak 4</span><h3>Dogovor, posao, ocena.</h3><p>Uslovi su potvrđeni pre početka. Kad završiš, označiš „Posao je gotov“, druga strana potvrđuje, i oboje ostavljate ocenu.</p></div>
</div>
<div class="phone-col" aria-hidden="true">{phone(scr, only='mapa')}</div>
</div></section>
<section class="sec white"><div class="wrap"><div class="sec-head reveal"><h2>Pošteno, bez obećanja koja ne zavise od nas</h2></div>
<div class="cards">{card('ill-calendar', 'Ti biraš termine', 'Prijavljuješ se samo za ono što ti odgovara.', s)}{card('ill-offers', 'Iznos je jasan', 'Iznos se vidi pre prijave i potvrđuje u Dogovoru. Plaćanje ide direktno.', s)}{card('ill-agreements', 'Nisi zaposlen kod nas', 'USKOČI povezuje ljude; nije poslodavac i ne garantuje angažovanje ili zaradu.', s)}</div></div></section>'''
    return simple(s, 'Ja mogu', 'Kako da pronađeš zadatke na USKOČI-ju: mapa i lista, radni profil, prijava i jasan Dogovor pre početka posla.',
                  'JA MOGU', 'Možeš da pomogneš? <span style="color:var(--orange)">Uskoči.</span>', 'Zadaci oko tebe i na daljinu, sa jasnim uslovima pre nego što kreneš.', 'ill-discover', body)


def aplikacija():
    s = 'aplikacija'
    scr = screens(s)
    items = [('pocetna', 'Početna'), ('opis', 'AI razgovor'), ('pregled', 'Pregled pre objave'), ('mapa', 'Zadaci na mapi'), ('prijava', 'Prijava'), ('dogovor', 'Dogovor')]
    grid = ''.join(f'<figure class="reveal" style="margin:0;display:grid;gap:12px;justify-items:center">{phone(scr, only=k)}<figcaption class="small muted">{E(n)}</figcaption></figure>' for k, n in items)
    body = f'''<section class="sec tight"><div class="wrap">
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:32px 20px">{grid}</div>
<p class="small muted" style="margin-top:28px;max-width:70ch">Prikazi su složeni po ekranima aplikacije u razvoju, sa primerima umesto stvarnih korisnika. Stvarni snimci ekrana iz izdanja biće objavljeni zajedno sa aplikacijom na Google Play-u.</p>
</div></section>
<section class="sec white"><div class="wrap"><div class="sec-head reveal"><h2>Tri mesta, uvek ista.</h2><p class="lead">Početna za pregled, Zadaci za pronalaženje, Dogovori za ono što je potvrđeno. Donja traka uvek pokazuje gde si.</p></div>
<div class="cards">{card('ill-messages', 'Poruke', 'Razgovor sa drugom stranom, vezan za zadatak i Dogovor.', s)}{card('ill-notification-bell', 'Obaveštenja', 'Nova prijava, potvrda ili promena Dogovora — na jednom mestu u aplikaciji.', s)}{card('ill-calendar', 'Raspored', 'Kalendar po mesecu, nedelji i danu za ono što si dogovorio.', s)}</div></div></section>'''
    return simple(s, 'Aplikacija', 'Pogled na USKOČI aplikaciju: Početna, AI razgovor, pregled pre objave, zadaci na mapi, prijava i Dogovor.',
                  'Aplikacija', 'Napravljena da bude jasna.', 'Svaki ekran ima jedan posao. Glavna radnja je uvek vidljiva, a ono što čeka tvoju odluku je na vrhu.', 'ill-document', body)


def kako_radi():
    s = 'kako-radi'
    legal = legal_body('kako-radi')
    body = page_hero('Kako radi', 'Jedna aplikacija, dva izbora i jasan Dogovor.', 'Kratko objašnjenje uloga, toka i granica usluge — isti tekst koji prati prijavu za Google Play.', 'ill-agreements', s)
    body += f'''<section class="sec tight"><div class="wrap">
<div class="cards" style="margin-bottom:56px">{card('ill-task-launch', '1 · Objava', 'Osoba kojoj treba pomoć opiše zadatak, mesto, termin i iznos, pa ga objavi.', s)}{card('ill-discover', '2 · Prijave', 'Oni koji mogu da pomognu pronađu zadatak i jave se.', s)}{card('ill-agreements', '3 · Dogovor', 'Izabrana osoba i naručilac potvrđuju iste uslove. Plaćanje je direktno između njih.', s)}</div>
<div class="prose">{legal}</div></div></section>'''
    return layout(s, 'Kako radi', 'Kako USKOČI radi: objava zadatka, prijave, izbor i Dogovor. Platforma je besplatna, bez provizije i bez čuvanja novca.', body)


def bezbednost():
    s = 'bezbednost'
    body = f'''<section class="sec tight"><div class="wrap">
<div class="cards">
{card('ill-pin', 'Privatna adresa', 'Pre Dogovora drugi vide samo okvirno mesto. Tačnu adresu dobija samo izabrana osoba.', s)}
{card('ill-people', 'Samo punoletni', 'USKOČI je namenjen osobama od 18 godina.', s)}
{card('ill-support', 'Prijava problema', 'Prijavi osobu, zadatak ili poruku iz aplikacije. Prijave razmatra podrška.', s)}
{card('ill-document', 'Blokiranje', 'Blokirana osoba više ne može da ti se javlja ni da vidi tvoje nove zadatke.', s)}
{card('ill-offers', 'Bez novca u aplikaciji', 'USKOČI ne prima i ne čuva novac. Ne plaćaj unapred nepoznatima i ne šalji podatke kartice.', s)}
{card('ill-clock', 'Nije hitna služba', 'Za hitne situacije pozovi 112 ili nadležnu službu.', s)}
</div>
<div class="prose" style="margin-top:56px"><h2>Šta USKOČI ne obećava</h2>
<p>Ne proveravamo identitet svakog korisnika, ne osiguravamo izvršenje posla i ne garantujemo ishod. Zato je Dogovor jasan, ocene vidljive posle saradnje, a prijava i blokiranje uvek dostupni.</p>
<p>Puna pravila su u dokumentu <a href="{url('pravila-zajednice', s)}">Pravila zajednice i bezbednost</a>.</p></div>
</div></section>'''
    return simple(s, 'Bezbednost i poverenje', 'Kako USKOČI štiti tvoju adresu i privatnost, kako se prijavljuje problem i blokira osoba, i šta platforma ne obećava.',
                  'Bezbednost i poverenje', 'Poverenje se gradi jasnoćom.', 'Privatna adresa, izbor sa kim radiš, prijava i blokiranje — i iskreno o tome šta ne garantujemo.', 'ill-support', body)


FAQ = [
    ('Šta je USKOČI?', 'Aplikacija u kojoj neko objavi konkretan zadatak, drugi se prijave, a izabrana osoba i naručilac potvrde Dogovor: šta, kada, gde i za koliko.'),
    ('Da li je besplatno?', 'Da. Korišćenje platforme u ovom izdanju je besplatno i nema provizije. Iznos zadatka je odvojen i plaća se direktno između učesnika.'),
    ('Kako se plaća posao?', 'Direktno, između vas, kako se dogovorite. USKOČI nema novčanik, ne prima i ne čuva novac namenjen zadacima.'),
    ('Gde mogu da koristim USKOČI?', 'Početno izdanje je za Srbiju. Dijaspora i države regiona su planirano širenje i biće posebno najavljene.'),
    ('Kada izlazi aplikacija?', 'Prvo izdanje je za Android i uskoro će biti na Google Play-u. Ovde ćemo objaviti vezu čim bude dostupna.'),
    ('Da li je USKOČI poslodavac ili agencija?', 'Ne. USKOČI povezuje ljude i pruža alat za dogovor. Ne zapošljava, ne preuzima izvršenje posla i ne garantuje zaradu.'),
    ('Ko vidi moju adresu?', 'Pre Dogovora drugi vide samo okvirno mesto. Tačnu adresu dobija osoba sa kojom potvrdiš Dogovor.'),
    ('Šta radi AI asistent?', 'Pomaže da opis zadatka ili radnog profila bude jasan: pita ono što nedostaje i predlaže tekst. Ti proveravaš i potvrđuješ pre objave ili čuvanja.'),
    ('Kako da obrišem nalog?', 'Zahtev možeš poslati i bez aplikacije, preko stranice Brisanje naloga. Tamo je opisano šta se briše, šta može privremeno ostati i u kom roku odgovaramo.'),
    ('Koliko godina moram da imam?', 'USKOČI je namenjen osobama od 18 godina.'),
]


def pitanja():
    s = 'pitanja'
    items = ''.join(f'<details><summary>{E(q)}</summary><div class="a"><p>{E(a)}</p></div></details>' for q, a in FAQ)
    ld = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ]}
    body = page_hero('Česta pitanja', 'Pitanja i odgovori.', 'Kratki odgovori. Ako ne nađeš svoj, piši podršci.', 'ill-messages', s)
    body += f'<section class="sec tight"><div class="wrap"><div class="faq">{items}</div><p style="margin-top:32px"><a class="btn ghost" href="{url("podrska", s)}">Podrška i kontakt {ARROW}</a></p></div></section>'
    # JSON-LD je jedini „script“ bez izvršavanja; CSP ga ne blokira jer se ne izvršava.
    head = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>'
    return layout(s, 'Česta pitanja', 'Odgovori na česta pitanja o USKOČI-ju: cena, plaćanje, dostupnost, privatnost adrese, AI asistent i brisanje naloga.', body, head)


def dostupnost():
    s = 'dostupnost'
    body = f'''<section class="sec tight"><div class="wrap"><div class="cards">
<article class="card reveal"><span class="pill ok" style="justify-self:start">Početno izdanje</span><h3>Srbija</h3><p>Zadaci se objavljuju i izvršavaju u Srbiji. Vreme u aplikaciji je po vremenu u Srbiji.</p></article>
<article class="card reveal"><span class="pill warn" style="justify-self:start">Planirano</span><h3>Dijaspora</h3><p>Ljudi iz dijaspore koji traže pomoć za nešto u Srbiji. Uvodi se tek posle posebne najave i usklađivanja.</p></article>
<article class="card reveal"><span class="pill warn" style="justify-self:start">Planirano</span><h3>Region</h3><p>Države regiona nisu otvorene ovim izdanjem.</p></article>
</div>
<div class="prose" style="margin-top:48px"><h2>Uređaji i jezik</h2><p>Prvo izdanje je Android aplikacija. iOS verzija za sada nije dostupna.</p><p>Jezik aplikacije i sajta je srpski, latinica. Sajt je pripremljen i za ćirilicu i buduće jezike regiona.</p></div>
</div></section>'''
    return simple(s, 'Dostupnost', 'Gde je USKOČI dostupan: početno izdanje za Srbiju na Androidu; dijaspora i region su planirano širenje.',
                  'Dostupnost', 'Počinjemo u Srbiji.', 'Jasno šta je dostupno danas, a šta tek dolazi.', 'ill-pin', body)


def o_proizvodu():
    s = 'o-proizvodu'
    body = f'''<section class="sec tight"><div class="wrap"><div class="prose">
<h2>Zašto USKOČI</h2><p>Mnogo malih poslova ostane neurađeno zato što je teško naći nekoga ko može baš tada, a mnogo ljudi bi rado pomoglo da zna gde. USKOČI spaja te dve strane oko konkretnog zadatka, sa jasnim dogovorom umesto dugih prepiski.</p>
<h2>Kako razmišljamo</h2><ul><li><b>Konkretno.</b> Zadatak ima mesto, vreme i iznos.</li><li><b>Pošteno.</b> Bez provizije u ovom izdanju, bez skrivenih uslova, bez obećanja zarade.</li><li><b>Privatno.</b> Adresa tek posle Dogovora; podaci samo koliko je potrebno.</li><li><b>Ljudski.</b> AI pomaže da opis bude jasan, a odluke donose ljudi.</li></ul>
<h2>Naši likovi</h2><p>Dva robota iz aplikacije prate razgovor sa asistentom: jedan pomaže da opišeš zadatak, drugi — sa šlemom — pomaže da sastaviš radni profil. Nisu stvarni ljudi i ne odlučuju umesto tebe.</p>
<h2>Ko stoji iza</h2><p>Podaci o operateru i kontakt nalaze se na stranici <a href="{url('operater-i-kontakt', s)}">Ko stoji iza USKOČI-ja</a>.</p>
</div></div></section>'''
    return simple(s, 'O proizvodu', 'Zašto postoji USKOČI, kako razmišljamo o poštenoj i privatnoj usluzi, i ko su roboti iz aplikacije.',
                  'O proizvodu', 'Mali poslovi, jasni dogovori.', 'USKOČI pravimo za svakodnevne situacije: kad nekome treba ruka više, a neko drugi ima vremena i znanja.', 'ill-people', body)


def mail_form(subject, kinds, placeholder, slug):
    opts = ''.join(f'<option>{E(k)}</option>' for k in kinds)
    em = FACTS['public_email']
    return f'''<form class="mail-box" data-mailto="{E(em)}" data-subject="{E(subject)}">
<div class="addr"><code>{E(em)}</code><button class="ctl" type="button" data-copy="{E(em)}" aria-describedby="copy-{slug}">Kopiraj adresu</button><span class="status-line" id="copy-{slug}" role="status"></span></div>
<label>Vrsta zahteva<select name="kind">{opts}</select></label>
<label>Imejl, telefon ili ID naloga<input name="id" autocomplete="email" placeholder="npr. imejl kojim se prijavljuješ"></label>
<label>Poruka<textarea name="body">{E(placeholder)}</textarea></label>
<p class="hint">Dugme otvara tvoj program za poštu sa popunjenom porukom. <b>Ništa se ne šalje sa ovog sajta</b>; poruka je poslata tek kad je pošalješ iz svoje pošte. Ne šalji lozinku, jednokratni kod ni kopiju dokumenta.</p>
<div class="row"><button class="btn green" type="submit">Sastavi imejl {ARROW}</button><span class="status-line" role="status"></span></div>
</form>'''


def podrska():
    s = 'podrska'
    body = f'''<section class="sec tight"><div class="wrap legal-grid"><div></div><div class="prose">
<h2>Piši nam</h2>
{mail_form('USKOČI — podrška', ['Pitanje o aplikaciji', 'Prijava problema ili zloupotrebe', 'Reklamacija', 'Zahtev u vezi sa podacima', 'Drugo'], 'Opiši ukratko šta se desilo i, ako postoji, o kom zadatku ili Dogovoru je reč.', s)}
<h2>Gde je šta</h2>
<ul><li>Postupak za reklamacije i žalbe: <a href="{url('podrska-i-reklamacije', s)}">Podrška, reklamacije i žalbe</a></li>
<li>Brisanje naloga: <a href="{url('brisanje-naloga', s)}">Brisanje naloga i podataka</a></li>
<li>Privatnost i tvoja prava: <a href="{url('privatnost', s)}">Politika privatnosti</a></li></ul>
<p>Za hitne situacije pozovi 112. USKOČI nije hitna služba.</p>
</div></div></section>'''
    return simple(s, 'Podrška i kontakt', 'Kontakt podrške USKOČI-ja za pitanja, prijave problema, reklamacije i zahteve u vezi sa podacima.',
                  'Podrška i kontakt', 'Tu smo kad zapne.', 'Jedan kontakt za pitanja, prijave i zahteve. Odgovaramo na srpskom.', 'ill-support', body)


def preuzmi():
    s = 'preuzmi'
    body = f'''<section class="sec tight"><div class="wrap"><div class="cta">
<div><h2>Uskoro na Google Play-u.</h2><p>USKOČI je trenutno u završnoj pripremi za prvo izdanje. Dugme za preuzimanje pojaviće se ovde kada aplikacija bude javno dostupna — ne pre toga.</p>
<div class="row" style="margin-top:24px"><span class="badge-soon">{PLAY_W}<span><small>Uskoro na</small><b>Google Play</b></span></span></div></div>
<div class="robots"><img src="{asset('img/robot-task.webp', s)}" width="720" height="720" alt="" loading="lazy"><img src="{asset('img/robot-worker.webp', s)}" width="720" height="720" alt="" loading="lazy"></div></div>
<div class="prose" style="margin-top:48px"><h2>Pre preuzimanja</h2><ul><li>Android telefon. iOS verzija za sada nije dostupna.</li><li>Punoletstvo (18+).</li><li>Početno područje: Srbija.</li></ul>
<p>Pročitaj <a href="{url('uslovi-koriscenja', s)}">Uslove korišćenja</a>, <a href="{url('pravila-zajednice', s)}">Pravila zajednice</a> i <a href="{url('privatnost', s)}">Politiku privatnosti</a>.</p></div>
</div></section>'''
    return simple(s, 'Preuzimanje aplikacije', 'USKOČI uskoro na Google Play-u za Android. Dugme za preuzimanje biće objavljeno kada aplikacija postane javno dostupna.',
                  'Preuzimanje', 'Android, uskoro.', 'Prvo izdanje je za Android telefone, za ljude u Srbiji.', 'ill-notification-bell', body)


# ---------------------------------------------------------------- pravni dokumenti iz paketa v4.3
MD = mistune.create_markdown(plugins=['table', 'strikethrough'], escape=False)


def fill(text, slug):
    def rep(m):
        key = m.group(1)
        if key == 'deletion_email_action':
            return '\n\n' + mail_form('USKOČI — brisanje naloga', ['brisanje naloga', 'brisanje pojedinih podataka', 'kopija podataka'], 'Molim da obrišete moj USKOČI nalog i povezane podatke za koje ne postoji preostali zakonit razlog čuvanja. Molim potvrdu prijema i obaveštenje kada postupak bude završen, uz objašnjenje eventualno zadržanih podataka.', slug).replace('\n', '') + '\n\n'
        val = (FACTS.get(key) or '').strip()
        if val:
            return val
        return f'<mark class="missing" title="Podatak čeka potvrdu vlasnika">nedostaje: {E(LABELS.get(key, key))}</mark>'
    return re.sub(r'\{\{([a-z_]+)\}\}', rep, text)


def legal_body(slug):
    d = next(x for x in DOCS if x['slug'] == slug)
    src = open(os.path.join(PKG, d['source']), encoding='utf-8').read()
    src = fill(src, slug)
    # doc:slug#anchor -> prava veza
    src = re.sub(r'\(doc:([a-z-]+)(#[a-z0-9-]+)?\)', lambda m: '(' + url(m.group(1), slug) + (m.group(2) or '') + ')', src)
    out = MD(src)
    out = re.sub(r'<h([23])>(.*?)\s*\{#([a-z0-9-]+)\}</h\1>', r'<h\1 id="\3">\2</h\1>', out)
    out = re.sub(r'<table>', '<div class="tbl"><table>', out).replace('</table>', '</table></div>')

    def add_id(m):
        tr = str.maketrans('čćžšđČĆŽŠĐ', 'cczsdCCZSD')
        sid = re.sub(r'[^a-z0-9]+', '-', re.sub('<.*?>', '', m.group(2)).translate(tr).lower()).strip('-')[:48]
        return f'<h{m.group(1)} id="{sid}">{m.group(2)}</h{m.group(1)}>'
    out = re.sub(r'<h([23])>(.*?)</h\1>', add_id, out)
    return out


def legal_page(d):
    slug = d['slug']
    body_html = legal_body(slug)
    heads = re.findall(r'<h2 id="([a-z0-9-]+)">(.*?)</h2>', body_html)
    toc = ''.join(f'<a href="#{i}">{re.sub("<.*?>", "", t)}</a>' for i, t in heads)
    missing = len(re.findall(r'class="missing"', body_html))
    eff = FACTS.get('effective_date') or ''
    eff_html = E(eff) if eff else '<mark class="missing">nedostaje: datum primene</mark>'
    draft = f'''<div class="draft" role="note"><b>Nacrt — još nije na snazi.</b><span>Ovaj tekst je verzija {DOC_VERSION} pripremljena za objavu. Čeka potvrđene podatke ({missing} označenih mesta) i odobrenje pre nego što stupi na snagu.</span></div>'''
    body = f'''<section class="page-hero"><div class="wrap"><div><p class="eyebrow">Pravni centar</p><h1>{E(d['title'])}</h1><p class="lead">{E(d['subtitle'])}</p>
<div class="docmeta"><span>Verzija {DOC_VERSION}</span><span>Datum primene: {eff_html}</span><span>Dostupno bez naloga</span></div></div></div></section>
<section class="sec tight"><div class="wrap legal-grid"><nav class="toc" aria-label="Sadržaj dokumenta"><b>Sadržaj</b>{toc}<a href="{url('pravno', slug)}">← Svi dokumenti</a></nav>
<article class="prose">{draft}{body_html}</article></div></section>'''
    return layout(slug, d['title'], d['subtitle'], body), missing


def pravno(counts):
    s = 'pravno'
    order = ['privatnost', 'uslovi-koriscenja', 'pravila-zajednice', 'brisanje-naloga', 'podrska-i-reklamacije', 'operater-i-kontakt', 'kako-radi']
    rows = ''
    for slug in order:
        d = next(x for x in DOCS if x['slug'] == slug)
        n = counts.get(slug, 0)
        pill = f'<span class="pill warn">Nacrt · {n} podataka čeka</span>' if n else '<span class="pill warn">Nacrt</span>'
        rows += f'<a href="{url(slug, s)}"><div><b>{E(d["title"])}</b><span>{E(d["subtitle"])}</span></div>{pill}</a>'
    body = page_hero('Pravni centar', 'Pravila, jasno i na jednom mestu.', 'Svi dokumenti su dostupni bez naloga. Dok vlasnik ne potvrdi preostale podatke, označeni su kao nacrt i nisu na snazi.', 'ill-document', s)
    body += f'<section class="sec tight"><div class="wrap"><div class="doc-list">{rows}</div><p class="small muted" style="margin-top:20px">Verzija dokumentacije {DOC_VERSION}. Pitanja o pravilima: <a href="mailto:{E(FACTS["public_email"])}">{E(FACTS["public_email"])}</a>.</p></div></section>'
    return layout(s, 'Pravni centar', 'Pravni centar USKOČI-ja: politika privatnosti, uslovi korišćenja, pravila zajednice, brisanje naloga, podrška i operater.', body)


# ---------------------------------------------------------------- sklapanje
def write(slug, text):
    d = os.path.join(OUT, slug) if slug else OUT
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def main():
    pub = os.path.join(ROOT, 'public')
    if PREVIEW:
        if os.path.exists(OUT):
            shutil.rmtree(OUT)
        shutil.copytree(pub, OUT, ignore=shutil.ignore_patterns('*.html', 'sitemap.xml', 'robots.txt', 'vercel.json'))
    os.makedirs(os.path.join(OUT, 'assets'), exist_ok=True)
    shutil.copy(os.path.join(ROOT, 'src', 'site.css'), os.path.join(OUT, 'assets', 'site.css'))
    shutil.copy(os.path.join(ROOT, 'src', 'site.js'), os.path.join(OUT, 'assets', 'site.js'))
    pages = {'': home(), 'meni-treba': meni_treba(), 'ja-mogu': ja_mogu(), 'aplikacija': aplikacija(), 'kako-radi': kako_radi(),
             'bezbednost': bezbednost(), 'pitanja': pitanja(), 'dostupnost': dostupnost(), 'o-proizvodu': o_proizvodu(),
             'podrska': podrska(), 'preuzmi': preuzmi()}
    counts = {}
    for d in DOCS:
        if d['slug'] == 'kako-radi':
            counts['kako-radi'] = len(re.findall(r'class="missing"', legal_body('kako-radi')))
            continue
        html_, n = legal_page(d)
        pages[d['slug']] = html_
        counts[d['slug']] = n
    pages['pravno'] = pravno(counts)
    for slug, text in pages.items():
        write(slug, text)
    if not PREVIEW:
        sm = ''.join(f'<url><loc>{BASE}/{s + "/" if s else ""}</loc></url>' for s in pages)
        open(os.path.join(OUT, 'sitemap.xml'), 'w', encoding='utf-8').write(
            f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n')
        robots = 'User-agent: *\nAllow: /\n' if INDEXABLE else 'User-agent: *\nDisallow: /\n'
        open(os.path.join(OUT, 'robots.txt'), 'w', encoding='utf-8').write(robots + f'Sitemap: {BASE}/sitemap.xml\n')
    print('stranica:', len(pages), 'izlaz:', OUT)
    print('nedostaje po dokumentu:', counts)


if __name__ == '__main__':
    main()
