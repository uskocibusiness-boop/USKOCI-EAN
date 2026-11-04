const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\9910a7c2-afe2-47a8-869e-6bf36b85f57c';

function toBase64Uri(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  const ext = path.extname(full).toLowerCase().replace('.', '');
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const data = fs.readFileSync(full).toString('base64');
  return `data:${mime};base64,${data}`;
}

const ITEMS_BRAND = [
  {
    name: 'USKOČI App Ikona (icon.png)',
    file: 'assets/brand/app-icon/icon.png',
    role: 'Google Play Store i ikona na početnom ekranu telefona (512x512)',
    desc: 'Smaragdno-zeleni squircle sa belim reljefnim skakačkim U simbolom i diskretnom senkom.',
    prompt: 'Mobile app icon, squircle shape with deep rich emerald green matte clay background (#006B4F). In the center, an embossed clean white tactile minimalist symbol: an energetic jumping U curve representing local work and helping hands. Subtle soft 3D depth, clean edges, premium App Store / Google Play icon design, 4k.'
  },
  {
    name: 'USKOČI AI Asistent (uskoci-assistant.png)',
    file: 'assets/ai/uskoci-assistant.png',
    role: 'Avatar AI pomoćnika u razgovoru i sastavljanju zadatka',
    desc: 'Prijateljski 3D robot/asistent od gline u belim i smaragdnim tonovima sa toplim izrazom.',
    prompt: 'Friendly 3D matte clay AI assistant robot character mascot, cute minimalist rounded proportions, smooth white and soft emerald green clay body, expressive friendly glowing dot eyes, warm helpful posture, isolated on transparent pure white background.'
  },
  {
    name: 'USKOČI Splash Mark (entry-splash-mark.png)',
    file: 'assets/entry-splash-mark.png',
    role: 'Splash ekran pri pokretanju aplikacije',
    desc: 'Veliki reljefni brend amblem koji se pojavljuje pre učitavanja početnog ekrana.',
    prompt: 'Embossed 3D tactile brand emblem for USKOČI app, geometric jumping arc in emerald green and crisp white matte clay, elegant drop shadow, isolated on pure white background.'
  }
];

const ITEMS_NATURAL = [
  {
    name: 'money.webp (Novac)',
    file: 'assets/illustrations/natural-v1/money.webp',
    role: 'Vrata „Uskočite i zaradite“ (Home & Welcome), Budžet, Ponude',
    desc: 'Snop smaragdnih novčanica sa dva reljefna zlatno-mesingana novčića u prvom planu.',
    prompt: 'A tactile 2.5D clay illustration of a neat stack of crisp paper banknotes in soft emerald green tones, accompanied by two thick minted metallic golden coins resting in front. Smooth matte clay texture, rounded edges, warm studio lighting, cast shadow below, isolated on pure white background.'
  },
  {
    name: 'publish.webp (Objava zadatka)',
    file: 'assets/illustrations/natural-v1/publish.webp',
    role: 'Vrata „Objavite zadatak“ (Home & Welcome), Nova objava',
    desc: 'Beli list sa zaobljenim uglovima, linijama i zelenim krugom sa belim plusom (+).',
    prompt: 'A 2.5D matte clay illustration of a clean white sheet of paper or task card with soft rounded corners and subtle grey placeholder lines, featuring a vibrant emerald green circular badge with a bold white plus sign (+) on the bottom right corner. Minimalist, tactile, isolated on white background.'
  },
  {
    name: 'workbag.webp (Zanati & Majstori)',
    file: 'assets/illustrations/natural-v1/workbag.webp',
    role: 'Radnički profil, zanatski alati i oprema',
    desc: 'Meka kožna zanatska torba sa ručkom, kaišem i mesinganom kopčom u toplim tonovima gline.',
    prompt: 'A minimalist 2.5D tactile clay craftsman workbag or leather tool satchel, warm earthy clay brown with smooth rounded straps and a tiny brass buckle. Friendly, handmade artisan feel, soft shadows, isolated on pure white background.'
  },
  {
    name: 'agreements.webp (Dogovori)',
    file: 'assets/illustrations/natural-v1/agreements.webp',
    role: 'Tab „Dogovori“, potvrđene saradnje i rukovanje',
    desc: 'Dve stilizovane apstraktne glinene ruke u čvrstom i prijateljskom stisku ruke.',
    prompt: 'A 2.5D clay illustration of two friendly abstract hands shaking in agreement (handshake). One hand in warm soft cream clay, the other in muted terracotta clay. Smooth organic forms, rounded wrists, studio lighting, isolated on pure white background.'
  },
  {
    name: 'applications.webp (Moje prijave)',
    file: 'assets/illustrations/natural-v1/applications.webp',
    role: 'Tab „Prijave“, slanje ponude na zadatak',
    desc: 'Geometrijski papirni aviončić od zelene i bele gline u poletu pod uglom od 45°.',
    prompt: 'A 2.5D tactile clay paper airplane soaring upwards towards the right at a 45-degree angle. Clean geometric facets in emerald green and crisp white matte clay, smooth lighting, soft ground shadow, isolated on pure white background.'
  },
  {
    name: 'tasks.webp (Moji zadaci)',
    file: 'assets/illustrations/natural-v1/tasks.webp',
    role: 'Pregled objavljenih zadataka korisnika',
    desc: 'Glineni clipboard sa štipaljkom i listom sa urednim kvačicama.',
    prompt: 'A 2.5D matte clay clipboard with a silver metal clip holding a clean white checklist with three neat rounded task lines and soft green checkmarks. Tactile, friendly, rounded bevels, isolated on pure white background.'
  },
  {
    name: 'calendar.webp (Datum & Rokovi)',
    file: 'assets/illustrations/natural-v1/calendar.webp',
    role: 'Izbor datuma, fleksibilni rokovi, vreme izvršenja',
    desc: 'Stoni blok-kalendar od bele gline sa narandžastim zaglavljem i spiralama.',
    prompt: 'A 2.5D tactile clay desk calendar with soft rounded corners, orange-accent top binding with white spiral rings, showing a clear numeric page. Smooth matte finish, clean drop shadow, isolated on pure white background.'
  },
  {
    name: 'clock.webp (Sat & Vreme)',
    file: 'assets/illustrations/natural-v1/clock.webp',
    role: 'Satnica zadatka, vreme početka i trajanje',
    desc: 'Okrugli analogni sat sa zelenim prstenom, belim brojčanikom i crnim kazaljkama.',
    prompt: 'A 2.5D clay alarm clock or wall clock with a soft emerald green bezel, clean white dial face, and simple rounded hands pointing at 10:10. Tactile claymorphism, friendly round proportions, isolated on pure white background.'
  },
  {
    name: 'users.webp (Kandidati & Tim)',
    file: 'assets/illustrations/natural-v1/users.webp',
    role: 'Prijavljeni kandidati, izbor radnika, broj ljudi',
    desc: 'Dve minimalističke apstraktne biste ljudi mekih kontura.',
    prompt: 'A 2.5D matte clay illustration of two abstract minimalist people busts side by side. Smooth organic geometric heads and shoulders in complementary tones of sage green and warm cream. Soft studio lighting, isolated on pure white background.'
  },
  {
    name: 'pin.webp (Lokacija)',
    file: 'assets/illustrations/natural-v1/pin.webp',
    role: 'Tačna lokacija zadatka na mapi',
    desc: 'Kapljičasti 3D pin u smaragdnoj boji sa belom tačkom.',
    prompt: 'A 2.5D tactile clay map location pin in bold emerald green, standing upright with a soft cast shadow below and an indented white circular center. Plump, smooth rounded bevels, isolated on pure white background.'
  },
  {
    name: 'map.webp (Pretraga & Mapa)',
    file: 'assets/illustrations/natural-v1/map.webp',
    role: 'Radijus pretrage i kretanje po celoj Srbiji',
    desc: 'Presavijena topografska mapa sa zelenom linijom putanje.',
    prompt: 'A 2.5D matte clay folded map unfolding gracefully, featuring subtle pastel contour lines and an emerald green route line with a tiny flag marker. Clean paper-like clay folds, isolated on pure white background.'
  },
  {
    name: 'home.webp (Početna & Kućni poslovi)',
    file: 'assets/illustrations/natural-v1/home.webp',
    role: 'Tab „Početna“, kućni poslovi i radovi na objektu',
    desc: 'Simpatična glinena kućica sa zelenim krovom, belim zidovima i vratima.',
    prompt: 'A charming 2.5D clay house with an emerald green gable roof, clean white clay walls, a small door, and a tiny square window. Friendly geometric architectural toy style, isolated on pure white background.'
  },
  {
    name: 'chat.webp (Poruke & Razgovor)',
    file: 'assets/illustrations/natural-v1/chat.webp',
    role: 'Direktan čet u Dogovoru i AI intervju',
    desc: 'Dva preklopljena govorna oblačića — smaragdni i beli sa tri tačkice.',
    prompt: 'A 2.5D tactile clay illustration of two overlapping chat speech bubbles: a prominent emerald green message bubble in front with rounded corners, and a smaller soft white bubble behind with three debossed dots. Isolated on pure white background.'
  },
  {
    name: 'bell.webp (Obaveštenja)',
    file: 'assets/illustrations/natural-v1/bell.webp',
    role: 'Push obaveštenja, zvonce za nove ponude',
    desc: 'Zlatno-narandžasto glineno zvonce sa klatnom i obručem.',
    prompt: 'A 2.5D matte clay notification bell in warm amber orange (#FF7A1A) with a rounded clapper and smooth circular top ring. Friendly, tactile, soft cast shadow, isolated on pure white background.'
  },
  {
    name: 'tool.webp (Alat & Popravke)',
    file: 'assets/illustrations/natural-v1/tool.webp',
    role: 'Veštine majstora, popravke, zanatske usluge',
    desc: 'Kutija za alat od terakota-crvene gline sa drškom i metalnom bravicom.',
    prompt: 'A 2.5D tactile clay toolbox with a sturdy top handle, clean horizontal seam, and a tiny chrome latch in the center. Minimalist workman craft aesthetic, smooth clay bevels, isolated on pure white background.'
  },
  {
    name: 'vehicle.webp (Vozilo & Prevoz)',
    file: 'assets/illustrations/natural-v1/vehicle.webp',
    role: 'Prevoz robe, selidbe, kombi i auto usluge',
    desc: 'Kompaktni glineni kombi u profilu sa belim prozorima i tamnim točkovima.',
    prompt: 'A 2.5D clay utility van or delivery truck seen from side profile, with rounded emerald green body, white pill-shaped windows, and thick dark charcoal clay wheels. Cute, sturdy, isolated on pure white background.'
  },
  {
    name: 'remote.webp (Rad na daljinu)',
    file: 'assets/illustrations/natural-v1/remote.webp',
    role: 'Online poslovi, programiranje, instrukcije, dizajn',
    desc: 'Monitor na postolju sa apstraktnim video-poziv avatarom.',
    prompt: 'A 2.5D matte clay desktop computer monitor resting on a small stand, displaying an abstract friendly video call avatar on its screen. Smooth rounded bezel, clean minimalist workspace feel, isolated on pure white background.'
  },
  {
    name: 'support.webp (Korisnička podrška)',
    file: 'assets/illustrations/natural-v1/support.webp',
    role: 'Pomoć, prijava problema, podrška korisnicima',
    desc: 'Pojas za spasavanje od bele gline sa četiri smaragdne trake.',
    prompt: 'A 2.5D tactile clay rescue lifebuoy ring in clean white with four emerald green wrap bands. Plump, smooth toroidal shape, soft lighting, isolated on pure white background.'
  },
  {
    name: 'document.webp (Dokument & Pravila)',
    file: 'assets/illustrations/natural-v1/document.webp',
    role: 'Pravila privatnosti, uslovi korišćenja, ugovor',
    desc: 'Pravni list sa presavijenim uglom, linijama i glinenim pečatom.',
    prompt: 'A 2.5D matte clay formal document sheet with a crisply dog-eared top-right corner, embossed text lines, and a small round official clay stamp seal at the bottom. Isolated on pure white background.'
  }
];

const ITEMS_DISCOVERY = [
  {
    name: 'p6-pin-task.png (Zadatak Pin)',
    file: 'assets/discovery/p6-pin-task.png',
    role: 'Oznaka pojedinačnog zadatka na mapi',
    desc: 'Smaragdni pin sa reljefnim simbolom čekića i posla.'
  },
  {
    name: 'p6-pin-count-1.png (Kandidat Pin 1)',
    file: 'assets/discovery/p6-pin-count-1.png',
    role: 'Pin na mapi sa 1 dostupnim kandidatom',
    desc: 'Smaragdni pin sa kružnom oznakom broja 1.'
  },
  {
    name: 'p6-pin-count-2.png (Kandidat Pin 2)',
    file: 'assets/discovery/p6-pin-count-2.png',
    role: 'Pin na mapi sa 2 kandidata',
    desc: 'Smaragdni pin sa kružnom oznakom broja 2.'
  },
  {
    name: 'p6-pin-count-3.png (Kandidat Pin 3)',
    file: 'assets/discovery/p6-pin-count-3.png',
    role: 'Pin na mapi sa 3 kandidata',
    desc: 'Smaragdni pin sa kružnom oznakom broja 3.'
  },
  {
    name: 'p6-pin-count-4.png (Kandidat Pin 4+)',
    file: 'assets/discovery/p6-pin-count-4.png',
    role: 'Pin na mapi sa 4 ili više kandidata',
    desc: 'Smaragdni pin sa oznakom 4+ za grupe radnika.'
  },
  {
    name: 'uskoci-cluster-material.png (Klaster poslova)',
    file: 'assets/discovery/uskoci-cluster-material.png',
    role: 'Kada se mapa odzumira, grupiše više zadataka u jedan krug',
    desc: 'Taktilni reljefni smaragdni krug sa belim prstenom.'
  }
];

function generateCard(item) {
  const b64 = toBase64Uri(item.file);
  const promptHtml = item.prompt ? `
    <div class="mt-3 bg-neutral-900 text-neutral-100 p-3 rounded-lg text-xs font-mono select-all relative group">
      <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-sans font-bold mb-1">ChatGPT / Midjourney Prompt:</div>
      ${item.prompt}
    </div>
  ` : '';

  return `
    <div class="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between break-inside-avoid">
      <div>
        <div class="w-full h-44 rounded-xl bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-neutral-50 flex items-center justify-center p-3 border border-neutral-100 mb-3 relative overflow-hidden">
          <img src="${b64}" alt="${item.name}" class="max-h-36 max-w-full object-contain filter drop-shadow-md hover:scale-105 transition-transform" />
          <span class="absolute top-2 right-2 bg-neutral-900/80 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">${item.file.split('.').pop().toUpperCase()}</span>
        </div>
        <h3 class="font-bold text-neutral-900 text-base mb-1">${item.name}</h3>
        <div class="text-xs font-semibold text-emerald-700 mb-2">${item.role}</div>
        <p class="text-xs text-neutral-600 leading-relaxed">${item.desc}</p>
      </div>
      ${promptHtml}
    </div>
  `;
}

const html = `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <title>USKOČI — Kompletan vizuelni katalog svih ikona i brend elemenata</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { background: white !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body class="bg-neutral-100 text-neutral-800 antialiased p-6 md:p-12 font-sans">
  <div class="max-w-6xl mx-auto space-y-10">

    <!-- Header -->
    <header class="bg-white border border-neutral-200 rounded-3xl p-8 shadow-sm">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-100">
        <div>
          <div class="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            Zvanični vizuelni katalog
          </div>
          <h1 class="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">USKOČI — Katalog Svih Ikona i 2.5D Slika</h1>
          <p class="text-neutral-500 text-sm mt-1">Kompletan pregled svih postojećih sličica, ikona, logotipa i promptova za generisanje na ChatGPT-ju.</p>
        </div>
        <div class="flex items-center gap-3 no-print">
          <button onclick="window.print()" class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-sm transition-all flex items-center gap-2">
            <span>🖨️ Sačuvaj kao PDF</span>
          </button>
        </div>
      </div>

      <!-- Color Palette -->
      <div class="pt-6">
        <h4 class="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Zvanična Brend Paleta Boja</h4>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div class="flex items-center gap-3 p-2 rounded-xl border border-neutral-100 bg-neutral-50">
            <div class="w-8 h-8 rounded-lg bg-[#006B4F] shadow-sm"></div>
            <div><div class="text-xs font-bold text-neutral-800">Smaragd</div><div class="text-[11px] font-mono text-neutral-500">#006B4F</div></div>
          </div>
          <div class="flex items-center gap-3 p-2 rounded-xl border border-neutral-100 bg-neutral-50">
            <div class="w-8 h-8 rounded-lg bg-[#FF7A1A] shadow-sm"></div>
            <div><div class="text-xs font-bold text-neutral-800">Akcent Narandžasta</div><div class="text-[11px] font-mono text-neutral-500">#FF7A1A</div></div>
          </div>
          <div class="flex items-center gap-3 p-2 rounded-xl border border-neutral-100 bg-neutral-50">
            <div class="w-8 h-8 rounded-lg bg-[#102A1E] shadow-sm"></div>
            <div><div class="text-xs font-bold text-neutral-800">Ugljen Grafit</div><div class="text-[11px] font-mono text-neutral-500">#102A1E</div></div>
          </div>
          <div class="flex items-center gap-3 p-2 rounded-xl border border-neutral-100 bg-neutral-50">
            <div class="w-8 h-8 rounded-lg bg-[#163D2B] shadow-sm"></div>
            <div><div class="text-xs font-bold text-neutral-800">Glinena Zelena</div><div class="text-[11px] font-mono text-neutral-500">#163D2B</div></div>
          </div>
          <div class="flex items-center gap-3 p-2 rounded-xl border border-neutral-100 bg-neutral-50">
            <div class="w-8 h-8 rounded-lg bg-white border border-neutral-200 shadow-sm"></div>
            <div><div class="text-xs font-bold text-neutral-800">Čista Bela</div><div class="text-[11px] font-mono text-neutral-500">#FFFFFF</div></div>
          </div>
        </div>
      </div>
    </header>

    <!-- Master Prompt Block -->
    <div class="bg-gradient-to-r from-emerald-900 to-neutral-900 text-white rounded-3xl p-8 shadow-sm">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-2xl">✨</span>
        <h2 class="text-xl font-bold">Master Instrukcija za ChatGPT (DALL-E 3 / Midjourney)</h2>
      </div>
      <p class="text-neutral-300 text-sm mb-4 leading-relaxed">
        Ako želite da ChatGPT izgeneriše novu sliku koja se 100% uklapa u postojeće, prekopirajte mu ovu bazičnu stilsku instrukciju, a zatim dodajte opis predmeta iz kartica ispod:
      </p>
      <div class="bg-black/50 p-4 rounded-xl font-mono text-xs text-emerald-300 select-all border border-emerald-500/30">
        3D tactile matte clay illustration, soft ambient occlusion, minimalist modern product design, studio lighting, smooth natural clay texture, isolated on pure white background (transparent PNG style), cohesive mobile app asset, no text, no words, ultra high resolution.
      </div>
    </div>

    <!-- Section 1: Glavni Brend & Logo -->
    <section class="space-y-4">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-emerald-600"></div>
        <h2 class="text-xl font-bold text-neutral-900">1. Glavni Brend, Logo i AI Karakter</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        ${ITEMS_BRAND.map(generateCard).join('')}
      </div>
    </section>

    <!-- Section 2: 19 Glavnih 2.5D Ilustracija -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-emerald-600"></div>
          <h2 class="text-xl font-bold text-neutral-900">2. Glavne 2.5D Ilustracije (natural-v1 set)</h2>
        </div>
        <span class="text-xs font-bold text-neutral-400">19 stavki</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        ${ITEMS_NATURAL.map(generateCard).join('')}
      </div>
    </section>

    <!-- Section 3: Mape i Pinovi -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-emerald-600"></div>
          <h2 class="text-xl font-bold text-neutral-900">3. Elementi Mape, Pinovi i Klasteri (discovery)</h2>
        </div>
        <span class="text-xs font-bold text-neutral-400">6 stavki</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        ${ITEMS_DISCOVERY.map(generateCard).join('')}
      </div>
    </section>

    <!-- Footer -->
    <footer class="text-center text-xs text-neutral-400 py-6 border-t border-neutral-200">
      USKOČI Mobile App &bull; Svi grafički elementi su optimizovani za Retina/XXHDPI ekrane i WebP format (384x384px).
    </footer>

  </div>
</body>
</html>`;

// 1. Write HTML to workspace
const htmlWorkspacePath = path.join(ROOT, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.html');
fs.writeFileSync(htmlWorkspacePath, html, 'utf8');
console.log('Saved HTML to workspace:', htmlWorkspacePath);

// 2. Write HTML to artifact dir
const htmlArtifactPath = path.join(ARTIFACT_DIR, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.html');
fs.writeFileSync(htmlArtifactPath, html, 'utf8');
console.log('Saved HTML to artifact:', htmlArtifactPath);

// 3. Generate PDF via headless Edge or Chrome
const pdfWorkspacePath = path.join(ROOT, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.pdf');
const pdfArtifactPath = path.join(ARTIFACT_DIR, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.pdf');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserExe = fs.existsSync(edgePath) ? edgePath : fs.existsSync(chromePath) ? chromePath : null;

if (browserExe) {
  try {
    console.log('Generating PDF using:', browserExe);
    execFileSync(browserExe, [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfWorkspacePath}`,
      htmlWorkspacePath
    ]);
    console.log('Generated PDF in workspace:', pdfWorkspacePath);
    if (fs.existsSync(pdfWorkspacePath)) {
      fs.copyFileSync(pdfWorkspacePath, pdfArtifactPath);
      console.log('Copied PDF to artifact:', pdfArtifactPath);
    }
  } catch (err) {
    console.error('PDF generation warning:', err.message);
  }
} else {
  console.log('No headless browser found to print to PDF.');
}
