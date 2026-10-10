#!/usr/bin/env node
// USKOČI control table: node scripts/control/osvezi.mjs
// Reads docs/control/redovi.json (curated rows) and docs/control/dev_snapshot.json (read-only DEV catalog),
// scans the app source, and writes docs/control/stanje.json plus docs/control/out/tabla.html (the page to publish).
// No network except an optional `gh run list`; no secrets; nothing is written outside docs/control.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import rpcSuccessorEvidence from './rpc-successor-evidence.cjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTROL = join(ROOT, 'docs', 'control');
const rel = p => relative(ROOT, p).split(sep).join('/');
const read = p => readFileSync(p, 'utf8');

const rows = JSON.parse(read(join(CONTROL, 'redovi.json')));
// Current, manually evidenced corrections belong beside the living rows, never in the frozen R4 package.
const dopune = rows.aktuelne_dopune ?? {};
const snap = JSON.parse(read(join(CONTROL, 'dev_snapshot.json')));
const rpcAll = new Set(snap.rpc_all), rpcAuth = new Set(snap.rpc_authenticated);
const edges = new Set(snap.edge.map(e => e.slug));
// Edge functions that only the server's own tick calls; the app is not supposed to call them.
const SERVER_WORKERS = new Set(['uskoci-push-transport', 'uskoci-data-export-worker', 'uskoci-account-closure-worker']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const appFiles = {}, testFiles = {}, edgeFiles = {};
for (const p of walk(join(ROOT, 'src'))) {
  const r = rel(p);
  if (r.includes('dizajn-pregled')) continue;
  ((r.includes('__tests__') || /\.test\.tsx?$/.test(r)) ? testFiles : appFiles)[r] = read(p);
}
for (const p of walk(join(ROOT, '__tests__'))) testFiles[rel(p)] = read(p);
for (const p of walk(join(ROOT, 'supabase', 'functions'))) edgeFiles[rel(p)] = read(p);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refs = (token, pool) => {
  const re = new RegExp(`['"\`/]${esc(token)}['"\`?/]`);
  return Object.keys(pool).filter(k => re.test(pool[k]));
};
function routeFile(route) {
  const parts = route === '/' ? [] : route.replace(/^\//, '').split('/');
  for (const prefix of ['src/app/(app)/', 'src/app/']) {
    const cands = parts.length ? [`${prefix}${parts.join('/')}.tsx`, `${prefix}${parts.join('/')}/index.tsx`] : [`${prefix}index.tsx`];
    for (const c of cands) if (existsSync(join(ROOT, c))) return c;
  }
  return null;
}
const serviceFile = name => Object.keys(appFiles).find(k => k.split('/').pop().replace(/\.tsx?$/, '') === name) ?? null;
// Which modules a screen can actually reach: follow relative imports from every route file under src/app.
function resolveImport(from, spec) {
  const base = join(ROOT, dirname(from), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const r = rel(cand);
    if (appFiles[r] !== undefined) return r;
  }
  return null;
}
const reachable = new Set();
const queue = Object.keys(appFiles).filter(k => k.startsWith('src/app/'));
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  for (const m of appFiles[file].matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = resolveImport(file, m[1]);
    if (target && !reachable.has(target)) queue.push(target);
  }
}

const G = 'zeleno', Y = 'zuto', R = 'crveno', N = 'nema', S = 'sivo';
const computed = rows.redovi.map(row => {
  const note = {};
  const deps = row.server.filter(d => !d.startsWith('NOVO:'));
  const novo = row.server.filter(d => d.startsWith('NOVO:')).map(d => d.slice(5).trim());
  // Ekran
  let ekran = N;
  if (row.ekrani.length) {
    const missing = row.ekrani.filter(r => !routeFile(r));
    ekran = missing.length ? R : G;
    if (missing.length) note.ekran = `Nema fajla za: ${missing.join(', ')}`;
  }
  // Server
  let server = N;
  // Every rpc the row's own service files call must exist too, not only the ones listed in the row.
  const svcCalls = [...new Set(row.servisi.map(serviceFile).filter(Boolean)
    .flatMap(f => [...appFiles[f].matchAll(/['"`](rpc_[a-z0-9_]+)['"`]/g)].map(m => m[1])))];
  const brokenCalls = svcCalls.filter(r => !rpcAll.has(r));
  if (deps.length || novo.length || brokenCalls.length) {
    const missing = deps.filter(d => d.startsWith('rpc_') ? !rpcAll.has(d) : d.startsWith('uskoci-') ? !edges.has(d) : false);
    server = missing.length || novo.length || brokenCalls.length ? R : G;
    const parts = [];
    if (missing.length) parts.push(`Na serveru ne postoji: ${missing.join(', ')}`);
    if (brokenCalls.length) parts.push(`Aplikacija poziva, a na serveru nema: ${brokenCalls.join(', ')}`);
    if (novo.length) parts.push(`Treba nova serverska funkcija: ${novo.join('; ')}`);
    if (parts.length) note.server = parts.join(' · ');
  }
  // Kod
  let kod = N;
  const callable = deps.filter(d => (d.startsWith('rpc_') && rpcAuth.has(d)) || (d.startsWith('uskoci-') && !SERVER_WORKERS.has(d)));
  const svcMissing = row.servisi.filter(s => !serviceFile(s));
  const unreachable = row.servisi.filter(s => serviceFile(s) && !reachable.has(serviceFile(s)));
  if (callable.length || row.servisi.length) {
    const notCalled = callable.filter(d => !refs(d, appFiles).length);
    const calledOnlyUnreachable = callable.filter(d => { const f = refs(d, appFiles); return f.length && !f.some(x => reachable.has(x)); });
    if (callable.length && notCalled.length === callable.length) kod = R;
    else if (notCalled.length || svcMissing.length || unreachable.length || calledOnlyUnreachable.length) kod = Y;
    else kod = G;
    const parts = [];
    if (notCalled.length) parts.push(`Aplikacija ne poziva: ${notCalled.join(', ')}`);
    if (calledOnlyUnreachable.length) parts.push(`Poziva se samo iz koda do kog nijedan ekran ne stiže: ${calledOnlyUnreachable.join(', ')}`);
    if (svcMissing.length) parts.push(`Nema servisa: ${svcMissing.join(', ')}`);
    if (unreachable.length) parts.push(`Nijedan ekran ne stiže do: ${unreachable.join(', ')}`);
    if (parts.length) note.kod = parts.join(' · ');
    else note.kod = `Ekran stiže do koda; poziva ${callable.length} serverskih funkcija`;
  }
  if (row.override?.kod) { kod = row.override.kod; note.kod = row.override.razlog ?? note.kod; }
  // Test
  let test = N;
  const tokens = [...callable, ...row.servisi];
  if (tokens.length) {
    const files = [...new Set(tokens.flatMap(t => refs(t, testFiles).concat(Object.keys(testFiles).filter(k => new RegExp(`/${esc(t)}['"]`).test(testFiles[k])))))];
    test = files.length ? G : Y;
    note.test = files.length ? `${files.length} test fajl(ova)` : 'Nijedan test ne dodiruje ovaj deo';
  }
  // Telefon i nacrt
  const telefon = row.telefon?.stanje === 'DOKAZANO' ? G : row.telefon?.stanje === 'DELIMIČNO' ? Y : S;
  const nacrt = row.nacrt ? G : S;
  const lights = { nacrt, ekran, kod, server, test, telefon };
  const auto = [ekran, kod, server, test].filter(v => v !== N);
  const ukupno = row.problem || auto.includes(R) || auto.includes(Y) ? 'PROBLEM'
    : telefon === G ? 'GOTOVO' : 'NA TELEFONU NIJE PROVERENO';
  return { id: row.id, grupa: row.grupa, naslov: row.naslov, nacrt_ref: row.nacrt, stari: row.stari, ekrani: row.ekrani,
    servisi: row.servisi, server_deps: row.server, lights, note, telefon_dokaz: row.telefon?.dokaz ?? '', problem: row.problem, sledece: row.sledece,
    funkcionalni_audit: row.funkcionalni_audit ?? null, finalization: row.finalization ?? null, ukupno };
});

// Server functions a signed-in user may call that the app never calls (directly or through an Edge function).
const serverOnly = [...rpcAuth].filter(r => !refs(r, appFiles).length).map(r => ({
  rpc: r,
  preko_edge: refs(r, edgeFiles).length > 0,
  // A suggested successor is only source evidence, NOT proof of equivalent server semantics.
  ...rpcSuccessorEvidence(r, appFiles, reachable),
}));
// Keep every source reference, but distinguish a screen-reachable call from a
// prepared/unwired module. Neither a filename nor a test import activates an RPC.
// This is the same static relative-import graph used by each row's Code light,
// not proof that a reachable command is executed at runtime.
const called = new Set(), reachableCalls = new Set();
for (const [file, text] of Object.entries(appFiles)) for (const m of text.matchAll(/['"`](rpc_[a-z0-9_]+)['"`]/g)) {
  called.add(m[1]); if (reachable.has(file)) reachableCalls.add(m[1]);
}
const sourceCallsMissing = [...called].filter(r => !rpcAll.has(r)).sort();
const appCallsMissing = sourceCallsMissing.filter(r => reachableCalls.has(r));
const unwiredCallsMissing = sourceCallsMissing.filter(r => !reachableCalls.has(r))
  .map(rpc => ({ rpc, files: refs(rpc, appFiles) }));

// ---------------------------------------------------------------------------
// R4 forensic overlay: the owner's read-only snapshot of 2026-09-22, frozen at 9286fdeb.
// Every file under docs/control/izvori/r4-20260922 was verified against the package's own
// MANIFEST_SHA256.json before it was copied in. The snapshot carries the analysis (intended
// notification targets, projection gaps, information architecture, per-screen call map); the
// lights above stay computed from live source and dev_snapshot.json. Where the two disagree,
// `provera_snimka` says so instead of quietly trusting either.
// ---------------------------------------------------------------------------
const R4DIR = join(CONTROL, 'izvori', 'r4-20260922');
const rowById = Object.fromEntries(rows.redovi.map(r => [r.id, r]));
// The first control row that owns a route is the row a landing on that route belongs to.
const routeRow = {};
for (const r of rows.redovi) for (const e of r.ekrani) if (!routeRow[e]) routeRow[e] = r.id;
// What the notification screen really opens per resolved kind (src/app/obavestenja.tsx).
// Authored here, checked against the file below: if a path disappears, the check says so.
const INBOX_ROUTES = { AGREEMENT: '/dogovor/[id]', APPLICATIONS: '/moje-prijave', CANDIDATES: '/potrebe/[id]/kandidati',
  OWN_NEED: '/potrebe/[id]/pregled', OPPORTUNITY: '/prilike/[id]', PITANJA: '/pitanja-zadatka' };
const inboxSrc = appFiles['src/app/obavestenja.tsx'] ?? '';
const inboxRoutesMissing = Object.values(INBOX_ROUTES).filter(p => !inboxSrc.includes("'" + p + "'"));

let r4 = null, tokovi = null, praznine = null, nivoi = null, rute = null;
if (existsSync(join(R4DIR, 'MANIFEST.json'))) {
  const rj = f => JSON.parse(read(join(R4DIR, f)).replace(/^﻿/, ''));
  const manifest = rj('MANIFEST.json'), master = rj('MASTER_SCREEN_ACTION_RPC_62.json');
  // The snapshot is English; the table is the owner's, so its prose is shown in Serbian from prevod.json.
  const prevod = existsSync(join(R4DIR, 'prevod.json')) ? rj('prevod.json') : { povrsine: {}, praznine: {} };
  const masterById = Object.fromEntries(master.map(r => [r.id, r]));

  // 1. Per row: surface, depth, what its own code really calls, which events it makes, what is missing.
  for (const c of computed) {
    const m = masterById[c.id];
    if (!m) continue;
    c.veza = { povrsina: m.surface, nivo: m.level, rute: m.routes, fajlovi: m.service_paths,
      cita: m.direct_read_rpcs, upisuje: m.direct_write_rpcs, edge: m.direct_edges, tabele: m.direct_tables,
      dogadjaji: m.events, nedostaje: m.missing_live_dependencies.filter(d => !rpcAll.has(d)),
      predlog: m.proposed_contracts, celine: m.analytical_sections };
  }

  // 2. Every notification: who makes it, where the draft wants it, where the app really lands.
  const KIND = { AGREEMENT_IF_EXISTS: 'AGREEMENT' };
  const emits = {};
  for (const m of master) for (const e of m.events) (emits[e] ??= []).push(m.id);
  const OCENA = { SUPPORTED_COARSE: 'tacno', SUPPORTED_CONDITIONAL: 'tacno' };
  const stavke = rj('NOTIFICATION_TARGETS_24.json').map(t => {
    const kind = KIND[t.resolver_kind] ?? t.resolver_kind;
    const qa = t.event.startsWith('CLARIFICATION_');
    const ruta = qa ? INBOX_ROUTES.PITANJA : INBOX_ROUTES[kind] ?? null;
    const ocena = OCENA[t.status] ?? (t.status === 'TARGET_MISMATCH_WITH_UX' ? 'pogresno'
      : t.status.startsWith('COARSE_') ? 'priblizno' : 'nepoznato');
    const napomena = t.status === 'TARGET_MISMATCH_WITH_UX' ? 'Vodi na drugi ekran nego što nacrt traži.'
      : qa ? 'Server vrati samo zadatak; aplikacija sama otvara Pitanja, ali ne označi konkretno pitanje.'
      : t.status.startsWith('COARSE_') ? 'Otvori pravi ekran, ali ne i tačno mesto na njemu.'
      : ocena === 'nepoznato' ? 'Nijedan pregledani put ne dokazuje gde ovo sleti.' : '';
    return { dogadjaj: t.event, kome: t.recipient, zeljeno: t.ux_target, vrsta: kind,
      nastaje: emits[t.event] ?? [], otvara: ruta, red: ruta ? routeRow[ruta] ?? null : null, ocena, napomena,
      ...(dopune.tokovi?.[t.event] ?? {}) };
  });
  const sazetak = stavke.reduce((a, s) => (a[s.ocena] = (a[s.ocena] ?? 0) + 1, a), {});
  tokovi = { stavke, sazetak, vrste: INBOX_ROUTES, provereno_u: 'src/app/obavestenja.tsx',
    putevi_nadjeni: inboxRoutesMissing.length === 0, putevi_koji_fale: inboxRoutesMissing };

  // 3. Read-model gaps: what a screen would need before its next step can be built.
  praznine = rj('PROJECTION_GAPS.json').map(g => ({ id: g.id, ...{ oblast: g.area, sada: g.current, nedostaje: g.missing }, ...(prevod.praznine[g.id] ?? {}),
    redovi: String(g.affected).split(/[;,]/).map(s => s.trim()).filter(s => rowById[s]), stanje: g.status,
    ...(dopune.praznine?.[g.id] ?? {}) }));

  // 4. The screen map: the draft's navigation, with every row placed on the surface a person reaches it from.
  // The route → surface table is authored here (the draft names surfaces, the rows name routes); a row whose
  // route matches nothing lands in "ostalo" instead of disappearing.
  const RUTA_POVRSINA = [
    [/^\/$/, 'Početna'],
    [/^\/(zadaci|mapa|prilike)$/, 'Mapa / Lista'],
    [/^\/prilike\//, 'Detalj prilike / Ponuda'],
    [/^\/dogovori$/, 'Dogovori'],
    [/^\/(dogovor\/|oceni-dogovor)/, 'Dogovor · Pregled / Poruke'],
    [/^\/obavestenja$/, 'Obaveštenja'],
    [/^\/(nova|potrebe|pregled-zadatka|mesto-zadatka|fotografije-zadatka|pitanja-zadatka)/, 'Moj zadatak'],
    [/^\/(moje-prijave|raspored)/, 'Moje prijave i raspored'],
    [/^\/profil\/(radnik|lokacija|dostupnost|razgovor)$/, 'Profil'],
    [/^\/(auth|oporavak)$/, 'Ulaz u aplikaciju'],
    [/^\/(profil|bezbednost|podrska)/, 'Podešavanja'],
  ];
  const povrsinaZaRed = r => {
    for (const e of r.ekrani) for (const [re, ime] of RUTA_POVRSINA) if (re.test(e)) return ime;
    return r.ekrani.length ? 'ostalo' : 'bez svog ekrana';
  };
  const poPovrsini = {};
  for (const r of rows.redovi) (poPovrsini[povrsinaZaRed(r)] ??= []).push(r.id);
  const iaBy = Object.fromEntries(rj('INFORMATION_ARCHITECTURE.json').map(s => [s.surface, s]));
  const REDOSLED = ['Početna', 'Mapa / Lista', 'Detalj prilike / Ponuda', 'Dogovori', 'Dogovor · Pregled / Poruke',
    'Obaveštenja', 'Poruke', 'Moj zadatak', 'Moje prijave i raspored', 'Profil', 'Podešavanja', 'Ulaz u aplikaciju',
    'ostalo', 'bez svog ekrana'];
  const NIVO = { 'Moje prijave i raspored': 2, 'Ulaz u aplikaciju': 2, ostalo: 2, 'bez svog ekrana': 3 };
  nivoi = REDOSLED.filter(p => iaBy[p] || poPovrsini[p]).map(p => ({ povrsina: p,
    nivo: iaBy[p]?.level ?? NIVO[p] ?? 2, stanje: iaBy[p]?.status ?? 'CURRENT',
    ...{ ulaz: iaBy[p]?.entry ?? '', sadrzi: iaBy[p]?.contains ?? '', napomena: iaBy[p]?.note ?? 'Grupisano po ekranu iz kog se otvara.' }, ...(prevod.povrsine[p] ?? {}),
    redovi: poPovrsini[p] ?? [], ...(dopune.nivoi?.[p] ?? {}) }));

  // 5. Physical screens: 48 route files, and which of them no control row owns.
  const ra = rj('ROUTE_AUDIT_48.json');
  rute = { ukupno: ra.length, u_redovima: ra.filter(r => r.control_step_ids.length).length,
    bez_reda: ra.filter(r => !r.control_step_ids.length).map(r => ({ ruta: r.route_key, vrsta: r.class, razlog: r.note.split('.')[0] })) };

  // 6. Does the snapshot still hold? Checked against live source and the DEV catalog, never assumed.
  const r4Missing = [...new Set(master.flatMap(m => m.missing_live_dependencies))];
  r4 = { paket: manifest.paket, zamrznuti_head: manifest.zamrznuti_head, dev_posmatran: manifest.dev_posmatran,
    fajlova: manifest.fajlovi.length, hes_proveren: true,
    isti_redovi: master.length === rows.redovi.length && master.every(m => rowById[m.id]),
    r4_tvrdi_da_fali: r4Missing, i_dalje_fali: r4Missing.filter(d => !rpcAll.has(d)),
    vise_ne_fali: r4Missing.filter(d => rpcAll.has(d)),
    novo_slomljeno: appCallsMissing.filter(d => !r4Missing.includes(d)),
    putevi_obavestenja: inboxRoutesMissing.length === 0 ? 'svi nađeni u kodu' : 'FALE: ' + inboxRoutesMissing.join(', ') };
}

const sh = (file, args) => { try { return execFileSync(file, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
let ci = null;
const ciRaw = sh('gh', ['run', 'list', '--limit', '12', '--json', 'databaseId,workflowName,headSha,status,conclusion,createdAt']);
if (ciRaw) try { ci = JSON.parse(ciRaw).map(r => ({ id: r.databaseId, ime: r.workflowName, sha: r.headSha.slice(0, 8), stanje: r.status, ishod: r.conclusion, vreme: r.createdAt })); } catch { ci = null; }

const meta = {
  osvezeno: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  grana: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']), head: sh('git', ['rev-parse', '--short=8', 'HEAD']), head_poruka: sh('git', ['log', '-1', '--format=%s']),
  server: { snimljeno: snap.generated_at, migracije: snap.ledger_total, dev_alpha: snap.ledger_dev_alpha, poslednja: snap.ledger_last,
    sertifikat_ok: snap.private_current_status && snap.private_current_status !== 'FRESH' ? null : snap.certificate_live === snap.certificate_certified && snap.retention_ai_ready === true,
    privatni_status: snap.private_current_status ?? 'LEGACY_SNAPSHOT', privatni_istorijski: snap.private_historical_observed_at ?? null,
    cron: snap.cron, cron_24h: snap.cron_runs_24h, cron_greske_24h: snap.cron_failures_24h, edge: snap.edge },
  pravilo_gotovo: rows.pravilo_gotovo,
};
const counts = computed.reduce((a, r) => (a[r.ukupno] = (a[r.ukupno] ?? 0) + 1, a), {});
const stanje = { meta, counts, finalization: rows.finalization ?? null, redovi: computed, server_ume_aplikacija_ne_koristi: serverOnly, aplikacija_zove_a_server_nema: appCallsMissing,
  nepovezani_pozivi_a_server_nema: unwiredCallsMissing,
  tokovi, praznine, nivoi, rute, snimak: r4,
  blokade: rows.blokade, prodavnice: rows.prodavnice, test_dva_telefona: rows.test_dva_telefona, test_dva_telefona_izvrseno: rows.test_dva_telefona_izvrseno, ci };

// The published table compares this timestamp when receiving an uploaded/shared snapshot.
writeFileSync(join(CONTROL, 'stanje.json'), JSON.stringify(stanje, null, 1) + '\n');
mkdirSync(join(CONTROL, 'out'), { recursive: true });
const tpl = read(join(CONTROL, 'tabla.template.html'));
writeFileSync(join(CONTROL, 'out', 'tabla.html'), tpl.replace('__STANJE__', JSON.stringify(stanje).replace(/</g, '\\u003c')));
console.log(`Redova: ${computed.length}`, counts);
console.log(`Server ume, aplikacija ne koristi: ${serverOnly.filter(x => !x.preko_edge).length} (+${serverOnly.filter(x => x.preko_edge).length} preko Edge)`);
console.log(`Aplikacija zove, server nema: ${appCallsMissing.length}${appCallsMissing.length ? ' → ' + appCallsMissing.join(', ') : ''}`);
console.log(`Nepovezani moduli referišu na neprimenjene RPC-je: ${unwiredCallsMissing.length}`);
console.log(`Strana: ${rel(join(CONTROL, 'out', 'tabla.html'))}`);

// Owner finalization matrix: a generated view of the same living rows, not a second status register.
// Test and device cells are manual evidence labels; file existence does not promote them to accepted.
const matrixCell = value => String(value ?? 'NOT_ASSESSED').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const matrixColumns = ['FLOW', 'PRIORITY', 'UX', 'UI', 'BACKEND', 'STATE SYNC', 'PERFORMANCE', 'TEST', 'DEVICE PROOF', 'STATUS'];
const matrix = [
  '# USKOČI finalization matrix', '',
  'Generated from `redovi.json` by `node scripts/control/osvezi.mjs`. Do not edit this file by hand.',
  'Source/DEV/device are separate. Unknown or historical evidence never means READY. Current scope: ' + (rows.finalization?.implementation ?? 'See living rows.'), '',
  '| ' + matrixColumns.join(' | ') + ' |',
  '| ' + matrixColumns.map(() => '---').join(' | ') + ' |',
  ...computed.map(row => {
    const f = row.finalization ?? {};
    return '| ' + [row.id + ' · ' + row.naslov, (f.priorities ?? []).join(', '), f.ux, f.ui, f.backend,
      f.state_sync, f.performance, f.test, f.device_proof, f.status].map(matrixCell).join(' | ') + ' |';
  }), '',
  'Exact historical device evidence remains in each control row (`telefon_dokaz`). See ROUND_01 for source findings and the bounded live DEV read.', ''
];
writeFileSync(join(CONTROL, 'FINALIZATION_MATRIX.md'), matrix.join('\n'));
