#!/usr/bin/env node
/**
 * Refreshes the LIVE layer of the operational master plan HTML from the one status registry.
 *
 *   node scripts/control/osvezi-master-plan.mjs \
 *     --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html \
 *     --redovi docs/control/redovi.json \
 *     --state docs/control/master-plan-live-state.json
 *   node scripts/control/osvezi-master-plan.mjs --check --html <html> [--redovi <json>]
 *
 * Authority: docs/control/redovi.json stays the ONLY status registry of the 62 flows. This script only rewrites the
 * `<script id="live-state">` JSON block of the HTML (which the page renders as its dashboard). It never touches the
 * static chapters, never uses the network, never calls Supabase, never deploys and never commits.
 *
 * Optional: --head <sha> --branch <name> --now <iso> override what git and the clock would say (used by the tests).
 * The classifier below is the same conservative rule set the page itself uses in the browser, so a file loaded in the
 * browser and a regenerated file agree. "Done" is reserved for an explicitly closed status without an open qualifier.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LIVE_BLOCK = /(<script id="live-state" type="application\/json">)([\s\S]*?)(<\/script>)/;
const FLOW_ID = /data-flow="([A-Z]\d{2})"/g;
const REQUIRED_ELEMENTS = ['live-head-short', 'live-branch', 'live-flow-total', 'live-flow-breakdown', 'live-p6-status',
  'live-p6-note', 'live-release-status', 'live-release-note', 'live-next-title', 'live-next-note', 'live-generated',
  'live-source-note', 'live-snapshot-tag', 'live-priority-grid'];

export const norm = (s) => String(s ?? '').toLocaleLowerCase('sr-Latn').replace(/đ/g, 'dj')
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Same rules as the page's own classify(): conservative, never invents "done". */
export function classify(status) {
  const n = norm(status);
  if (!n) return 'open';
  const neg = /open|otvoren|ceka|čeka|predstoji|pending|nije prover|not implemented|blocked|blok|required|p6 open|off|gated/;
  if (/zavrsen|završen|\bdone\b/.test(n) && !neg.test(n)) return 'done';
  if (/not implemented|blocked|blok|server\/event package required|required \/ not/.test(n)) return 'blocked';
  if (/native|telefon|uredjaj|uređaj|emulator|device|pending|ceka|čeka|predstoji|nije prover/.test(n)) return 'native';
  return 'open';
}

export function rowsFromRedovi(data) {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.redovi) ? data.redovi : Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((r) => {
    const fin = r.finalization || {};
    return {
      id: String(r.id || ''),
      title: r.naslov || r.title || '',
      status: fin.status || r.status || '',
      priorities: Array.isArray(fin.priorities) ? fin.priorities : Array.isArray(r.priorities) ? r.priorities : [],
    };
  }).filter((r) => r.id);
}

export function summarize(rows) {
  const counts = { done: 0, native: 0, blocked: 0, open: 0 };
  const flows = {};
  for (const r of rows) {
    const state = classify(r.status);
    counts[state] += 1;
    flows[r.id] = { title: r.title, status: r.status, priorities: r.priorities, state };
  }
  const priorities = {};
  for (let i = 0; i <= 7; i += 1) {
    const key = `P${i}`;
    const part = rows.filter((r) => r.priorities.includes(key));
    const q = { total: part.length, done: 0, native: 0, blocked: 0, open: 0 };
    for (const r of part) q[classify(r.status)] += 1;
    priorities[key] = q;
  }
  return { counts, flows, priorities, flowTotal: rows.length };
}

function git(args, fallback = null) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return fallback; }
}

function dirtyState(ignorePaths) {
  const out = git(['status', '--porcelain', '--untracked-files=no']);
  if (out === null) return null;
  const changed = out.split('\n').filter(Boolean).map((l) => l.slice(3).replace(/\\/g, '/'));
  return changed.some((p) => !ignorePaths.some((i) => p === i || p.endsWith('/' + i))) ;
}

export function readLiveBlock(html) {
  const m = html.match(LIVE_BLOCK);
  if (!m) throw new Error('live-state block not found');
  return { state: JSON.parse(m[2]), match: m };
}

/** JSON is placed inside a <script>; "<" is escaped so the text can never close the tag. */
export const embed = (value) => JSON.stringify(value, null, 1).replace(/</g, '\\u003c');

export function buildLiveState({ previous, manual, rows, head, branch, dirty, now, redoviPath }) {
  const sum = summarize(rows);
  return {
    schemaVersion: 1,
    generatedAt: now,
    source: { repo: manual?.source?.repo ?? previous?.source?.repo ?? null, branch, head, dirty, redoviPath },
    p6: manual?.p6 ?? previous?.p6 ?? { status: 'OPEN', note: '' },
    release: manual?.release ?? previous?.release ?? { status: 'NOT READY', note: '' },
    next: manual?.next ?? previous?.next ?? { title: '', note: '' },
    evidence: manual?.evidence ?? previous?.evidence ?? [],
    flowTotal: sum.flowTotal,
    counts: sum.counts,
    flows: sum.flows,
    priorities: sum.priorities,
  };
}

export function check(html, rows) {
  const problems = [];
  let live;
  try { live = readLiveBlock(html).state; } catch (e) { return [`live-state: ${e.message}`]; }
  if (live.schemaVersion !== 1) problems.push('live-state.schemaVersion must be 1');
  if (live.source?.head && !/^[0-9a-f]{40}$/.test(live.source.head)) problems.push('live-state.source.head is not a 40-hex sha');
  const cardIds = new Set([...html.matchAll(FLOW_ID)].map((m) => m[1]));
  if (cardIds.size === 0) problems.push('no flow cards found in the HTML');
  const flowIds = new Set(Object.keys(live.flows || {}));
  if (flowIds.size) {
    for (const id of cardIds) if (!flowIds.has(id)) problems.push(`flow card ${id} has no live status`);
    for (const id of flowIds) if (!cardIds.has(id)) problems.push(`live status ${id} has no flow card`);
    if (live.flowTotal !== flowIds.size) problems.push(`flowTotal ${live.flowTotal} != ${flowIds.size} flows`);
    const c = live.counts || {};
    const sum = (c.done || 0) + (c.native || 0) + (c.blocked || 0) + (c.open || 0);
    if (sum !== flowIds.size) problems.push(`counts add up to ${sum}, not ${flowIds.size}`);
  }
  if (rows) {
    const registry = new Set(rows.map((r) => r.id));
    for (const id of cardIds) if (!registry.has(id)) problems.push(`flow card ${id} is not in the registry`);
    for (const id of registry) if (!cardIds.has(id)) problems.push(`registry flow ${id} has no card`);
    if (flowIds.size) {
      const fresh = summarize(rows).flows;
      for (const id of registry) {
        if (flowIds.has(id) && live.flows[id].status !== fresh[id].status) problems.push(`stale status for ${id}`);
      }
    }
  }
  for (const id of REQUIRED_ELEMENTS) if (!html.includes(`id="${id}"`)) problems.push(`missing element #${id}`);
  return problems;
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') o.check = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  return o;
}

export function main(argv = process.argv.slice(2)) {
  const o = args(argv);
  if (!o.html) { console.error('usage: osvezi-master-plan.mjs --html <file> [--redovi <file>] [--state <file>] [--check]'); return 2; }
  const html = readFileSync(o.html, 'utf8');
  const rows = o.redovi ? rowsFromRedovi(JSON.parse(readFileSync(o.redovi, 'utf8'))) : null;
  if (o.check) {
    const problems = check(html, rows);
    if (problems.length) { console.error('CHECK FAILED\n- ' + problems.join('\n- ')); return 1; }
    console.log(`CHECK OK: live layer consistent${rows ? ` with ${rows.length} registry rows` : ''}`);
    return 0;
  }
  if (!o.redovi) { console.error('--redovi is required to refresh'); return 2; }
  const { state: previous, match } = readLiveBlock(html);
  const manual = o.state ? JSON.parse(readFileSync(o.state, 'utf8')) : null;
  const generated = [o.html, o.state].filter(Boolean).map((p) => p.replace(/\\/g, '/'));
  const head = o.head ?? git(['rev-parse', 'HEAD']) ?? previous?.source?.head ?? null;
  const branchNow = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = o.branch ?? (branchNow && branchNow !== 'HEAD' ? branchNow : previous?.source?.branch ?? 'nepoznata grana');
  const live = buildLiveState({
    previous, manual, rows, head, branch, dirty: o.head ? null : dirtyState(generated),
    now: o.now ?? new Date().toISOString(), redoviPath: o.redovi.replace(/\\/g, '/'),
  });
  const next = html.slice(0, match.index) + match[1] + '\n' + embed(live) + '\n' + match[3] + html.slice(match.index + match[0].length);
  writeFileSync(o.html, next, 'utf8');
  console.log(`refreshed ${o.html}: ${live.flowTotal} flows, ${live.counts.done} done / ${live.counts.native} native-device / ${live.counts.blocked} blocked / ${live.counts.open} open; head ${String(live.source.head).slice(0, 9)}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('osvezi-master-plan.mjs')) {
  process.exitCode = main();
}
