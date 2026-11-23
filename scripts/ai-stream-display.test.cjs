'use strict';
// Real React shell + stream/arrival hooks. Native hosts and the frame clock are
// bounded substitutes; this proves renderer behavior, not a device screenshot.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ROOT = path.resolve(__dirname, '..');
const PREIMAGE = process.env.USKOCI_STREAM_PREIMAGE;
const SHELL = 'src/ui/aiFirst/AiConversationShell.tsx';
const HELPER = 'src/ui/aiFirst/useStreamDisplay.ts';

function harness({ withoutSegmenter = false, reduced = false, strict = false } = {}) {
  let tree, props, sequence = 0;
  const frames = new Map(), announcements = [], subscriptions = new Set();
  const request = fn => { const id = ++sequence; frames.set(id, fn); return id; };
  const cancel = id => frames.delete(id);
  const addListener = (_event, fn) => { subscriptions.add(fn); return { remove: () => subscriptions.delete(fn) }; };
  const nativeAnimation = () => ({ start() {}, stop() {} });
  const enter = { duration() { return this; }, easing() { return this; }, withInitialValues() { return this; } };
  const overrides = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': {
      View: 'View', ScrollView: 'ScrollView', TextInput: 'TextInput', KeyboardAvoidingView: 'KeyboardAvoidingView',
      Platform: { OS: 'android' }, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 800, width: 360 }),
      Keyboard: { addListener, dismiss() {} }, AppState: { currentState: 'active', addEventListener: addListener },
      AccessibilityInfo: { announceForAccessibility: text => announcements.push(text) },
      Easing: { inOut: value => value, quad: value => value },
      Animated: { View: 'AnimatedView', timing: nativeAnimation, sequence: nativeAnimation, delay: nativeAnimation, loop: nativeAnimation,
        Value: class { setValue() {} stopAnimation() {} interpolate() { return 0; } } },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeIn: enter, FadeInDown: enter, Easing: { bezier: () => ({}) } },
    'src/ui/interFont.ts': { withInter: value => value },
    'src/ui/system/ConfirmSheet.tsx': { useConfirmSheet: () => ({ ask() {}, sheet: null }) },
    'src/ui/system/motion.ts': { useReducedMotion: () => reduced },
    'src/ui/system/textScale.ts': { useLayoutClass: () => ({ stacked: false }), useTextScale: () => 1.3 },
    'src/ui/system/layout.ts': { layout: {} },
    'src/ui/system/tokens.ts': { sys: { color: { artRole: { ai: {} } }, space: {}, radius: {}, conversation: {},
      type: { body: { lineHeight: 24 } }, touch: { min: 48 }, elevation: {},
      motion: { enter: 150, easeOut: [0, 0, 1, 1], loop: { typing: 400 }, categories: { content: { reveal: { translateY: 4 } } } } } },
    'src/features/voice/useHoldToTalk.ts': { VOICE_PROCESSING_NOTICE: 'Privatnost govora' },
    'src/ui/aiFirst/VoiceComposer.tsx': { HOLD_HINT: '', useVoiceScreenReader: () => false, VoiceComposer: 'VoiceComposer', VoiceNotice: 'VoiceNotice' },
  };
  const widgets = {
    'src/ui/Text.tsx': ['T'], 'src/ui/Press.tsx': ['Press'],
    'src/ui/system/ScreenChrome.tsx': ['ChromeIconButton', 'ScreenChrome'],
    'src/ui/system/FactArt.tsx': ['FactArt'], 'src/ui/system/Glyph.tsx': ['Glyph'],
    'src/ui/system/ListRow.tsx': ['ListRow'], 'src/ui/system/Section.tsx': ['Section'], 'src/ui/system/Surface.tsx': ['Surface'],
    'src/ui/aiFirst/AiAssistantArt.tsx': ['AiAssistantArt', 'AiAssistantWelcome'],
  };
  for (const [name, names] of Object.entries(widgets)) overrides[name] = Object.fromEntries(names.map(key => [key, key]));
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    const file = ['', '.ts', '.tsx'].map(ext => path.resolve(ROOT, name + ext)).find(full => fs.existsSync(full) && fs.statSync(full).isFile());
    if (!file) throw Error('UNEXPECTED_IMPORT: ' + name);
    name = path.relative(ROOT, file).replace(/\\/g, '/');
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const source = PREIMAGE && name === SHELL ? execFileSync('git', ['show', `${PREIMAGE}:${name}`], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(file, 'utf8');
    const js = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const mod = { exports: {} }; cache.set(name, mod);
    new Function('module', 'exports', 'require', 'Intl', 'requestAnimationFrame', 'cancelAnimationFrame', js)(mod, mod.exports,
      id => load(id.startsWith('.') ? path.relative(ROOT, path.resolve(path.dirname(file), id)).replace(/\\/g, '/') : id),
      withoutSegmenter ? {} : Intl, request, cancel);
    return mod.exports;
  }
  const Shell = load(SHELL).AiConversationShell;
  const element = () => strict ? React.createElement(React.StrictMode, null, React.createElement(Shell, props)) : React.createElement(Shell, props);
  return {
    frames, announcements, load,
    get tree() { return tree; },
    async mount(initial = {}) {
      props = { conversationKey: 'account:a:conversation:1', title: 'Razgovor', card: () => null, messages: [], welcome: 'Dobar dan', welcomeDetail: '',
        value: '', canEdit: true, canSend: false, pending: false, busy: false, onChange() {}, onSend() {}, onBack() {}, ...initial };
      await act(async () => { tree = create(element()); });
    },
    async update(change) { props = { ...props, ...change }; await act(async () => tree.update(element())); },
    async motion(value) { reduced = value; await this.update({}); },
    async frame() { const batch = [...frames.values()]; frames.clear(); await act(async () => batch.forEach(fn => fn(16))); },
    /** Runs paced-reveal frames until the reveal has caught up and stopped asking for frames. */
    async settle() { for (let i = 0; i < 400 && frames.size; i++) await this.frame(); assert.equal(frames.size, 0, 'the reveal loop stops once caught up'); },
    preview() {
      const node = tree.root.findAll(node => node.type === 'View' && node.props.testID === 'ai-stream-preview')[0];
      return node ? node.findAll(node => node.type === 'T' && node.props.selectable)[0].props.children : '';
    },
    async close() { if (tree) await act(async () => tree.unmount()); assert.equal(frames.size, 0, 'no retained animation frame');
      assert.equal(subscriptions.size, 0, 'no retained native listener'); },
  };
}

async function scenario(options, run) { const h = harness(options); try { await h.mount(); await run(h); } finally { await h.close(); } }

test('first live chunk stays monotone through frames and snapshots; the paced reveal stops when caught up', () => scenario({}, async h => {
  await h.update({ pending: true, busy: true, sentMessage: 'Treba mi pomoć', streamingText: 'Važi' });
  const first = h.preview(); assert.ok(first.length >= 2, 'the first word replaces the dots at once');
  await h.frame(); assert.ok(h.preview().startsWith(first), 'a later frame cannot retract visible text');
  assert.equal(h.frames.size, 0, 'no animation frame is requested once everything received is shown');
  const long = 'Važi, pitam samo neophodno. Gde je zadatak?';
  await h.update({ streamingText: long });
  assert.ok(h.preview().startsWith(first));
  let previous = h.preview();
  while (h.frames.size) {
    await h.frame(); const shown = h.preview();
    assert.ok(shown.startsWith(previous) && long.startsWith(shown), 'append only, never beyond what was received');
    previous = shown;
  }
  const extended = h.preview(); assert.equal(extended, 'Važi, pitam samo neophodno. Gde je zadatak');
  for (const streamingText of ['Va', 'Drugi odgovor koji zamenjuje prethodni.']) {
    await h.update({ streamingText }); await h.settle(); assert.equal(h.preview(), extended, 'same attempt cannot overwrite its preview');
  }
  assert.deepEqual(h.announcements, [], 'provider fragments are never final accessibility announcements');
}));

test('a canonical user/history refresh with the same assistant ID does not reset the current preview', () => scenario({}, async h => {
  const assistant = { id: 'a0', fromAi: true, body: 'Kada Vam odgovara?' };
  await h.update({ messages: [assistant] });
  await h.update({ pending: true, sentMessage: 'Sutra', streamingText: 'Sutra je izabrani termin.' }); const visible = h.preview();
  await h.update({ messages: [{ ...assistant }, { id: 'u1', fromAi: false, body: 'Sutra' }], sentMessage: null });
  assert.equal(h.preview(), visible);
  await h.update({ streamingText: 'Sutra je izabrani termin. Gde je zadatak?' }); assert.ok(h.preview().startsWith(visible));
  assert.deepEqual(h.announcements, []);
}));

test('an initial split surrogate, combining mark and emoji sequence never appear half drawn', () => scenario({}, async h => {
  await h.update({ pending: true, sentMessage: 'Ćao', streamingText: '\ud83d' }); assert.equal(h.preview(), '');
  const reply = '🧑🏽‍🚀 c\u030c 👨‍👩‍👧‍👦 🇷🇸 1️⃣ Дoбар дан.';
  const boundaries = new Set([...new Intl.Segmenter('sr', { granularity: 'grapheme' }).segment(reply)].map(part => part.index));
  let previous = '';
  for (let end = 1; end <= reply.length; end++) {
    await h.update({ streamingText: reply.slice(0, end) });
    const shown = h.preview();
    assert.ok(shown.startsWith(previous), 'append only throughout UTF-16 splits');
    assert.ok(boundaries.has(shown.length), 'display ends at a complete grapheme in the eventual text');
    previous = shown;
  }
}));

test('conversation replacement clears preview ownership in its first committed render', () => scenario({}, async h => {
  await h.update({ pending: true, sentMessage: 'Ista poruka', streamingText: 'Stari odgovor korisniku.' });
  const old = h.preview(); assert.ok(old);
  await h.update({ conversationKey: 'account:b:conversation:2', streamingText: 'Novi odgovor.' });
  assert.ok('Novi odgovor'.startsWith(h.preview()) && h.preview(), 'the new reveal starts in the first render');
  assert.ok(!h.preview().includes(old)); await h.settle(); assert.equal(h.preview(), 'Novi odgovor');
}));

test('explicit clear and back-to-back new drafts each reset a stream without remounting', () => scenario({}, async h => {
  await h.update({ pending: true, sentMessage: 'Prva poruka', streamingText: 'Prvi odgovor.' });
  await h.update({ streamingText: '' }); assert.equal(h.preview(), '');
  await h.update({ streamingText: 'Ponovo isti zahtev.' }); assert.equal(h.preview(), 'Ponovo ', 'a cleared stream starts a fresh reveal');
  await h.settle(); assert.equal(h.preview(), 'Ponovo isti zahtev');
  await h.update({ sentMessage: 'Druga poruka', streamingText: 'Drugi odgovor.' }); assert.equal(h.preview(), 'Drugi ');
  await h.settle(); assert.equal(h.preview(), 'Drugi odgovor');
}));

test('a new pending turn with the same user text is distinct from its completed predecessor', () => scenario({}, async h => {
  await h.update({ pending: true, sentMessage: 'Da', streamingText: 'Prvi odgovor.' });
  const messages = [{ id: 'u1', fromAi: false, body: 'Da' }, { id: 'a1', fromAi: true, body: 'Potvrđen prvi odgovor.' }];
  await h.update({ messages, pending: false, sentMessage: null }); assert.equal(h.preview(), '');
  await h.update({ pending: true, sentMessage: 'Da', streamingText: 'Drugi odgovor.' }); assert.equal(h.preview(), 'Drugi ');
  await h.settle(); assert.equal(h.preview(), 'Drugi odgovor');
}));

test('canonical readback replaces even a longer contradictory preview and announces exactly once', () => scenario({ strict: true }, async h => {
  const initial = [{ id: 'a0', fromAi: true, body: 'Ranija poruka.' }];
  await h.update({ messages: initial }); assert.deepEqual(h.announcements, [], 'loaded history is silent');
  await h.update({ pending: true, busy: true, sentMessage: 'To je to', streamingText: 'Sačuvano je sve i zadatak je objavljen.' });
  assert.ok(h.preview());
  const [previewNode] = h.tree.root.findAll(node => node.type === 'View' && node.props.testID === 'ai-stream-preview');
  assert.equal(previewNode.props.accessibilityLiveRegion, 'none');
  assert.match(previewNode.props.accessibilityLabel, /^USKOČI:/);
  assert.equal(previewNode.findAll(node => node.type === 'T' && node.props.children === 'Odgovor u pripremi').length, 0);
  const final = 'Pregled još nije spreman.';
  const messages = [...initial, { id: 'u1', fromAi: false, body: 'To je to' }, { id: 'a1', fromAi: true, body: final }];
  // The read can land before the route has cleared its stream; canonical rows win immediately.
  await h.update({ messages, pending: false, busy: false, sentMessage: null });
  assert.equal(h.preview(), '');
  assert.equal(h.tree.root.findAll(node => node.type === 'T' && node.props.selectable && node.props.children === final).length, 1);
  assert.deepEqual(h.announcements, [`USKOČI: ${final}`]);
  await h.update({ streamingText: 'Sačuvano je sve i zadatak je objavljen. Naknadni delta.' });
  await h.frame(); assert.equal(h.preview(), '');
  await h.update({ streamingText: '', value: 'Nova nacrt poruka' }); assert.deepEqual(h.announcements, [`USKOČI: ${final}`]);
}));

test('loss/abort clears preview without inventing a completed message or announcement', () => scenario({}, async h => {
  await h.update({ pending: true, busy: true, sentMessage: 'Sutra', streamingText: 'Razumem Vaš termin.' }); assert.ok(h.preview());
  await h.update({ busy: false, streamingText: '' }); await h.frame(); assert.equal(h.preview(), '');
  assert.deepEqual(h.announcements, []);
  assert.equal(h.tree.root.findAll(node => node.type === 'T' && node.props.selectable && node.props.children === 'Razumem Vaš termin.').length, 0);
}));

test('live reduced-motion changes keep Unicode-safe text immediate without replay or truncation', () => scenario({}, async h => {
  await h.update({ pending: true, sentMessage: 'Sutra', streamingText: 'Važi 🧑🏽‍🚀, sutra.' });
  await h.settle(); const first = h.preview(); assert.equal(first, 'Važi 🧑🏽‍🚀, sutra'); await h.frame(); assert.equal(h.preview(), first);
  await h.motion(true); assert.equal(h.preview(), first); assert.equal(h.frames.size, 0);
  await h.update({ streamingText: 'Važi 🧑🏽‍🚀, sutra. Posle četiri?' }); const next = h.preview(); assert.ok(next.startsWith(first));
  await h.motion(false); assert.equal(h.preview(), next); assert.equal(h.frames.size, 0);
}));

test('send shows the dots at once; the same row reveals words and continues into the completed reply', () => scenario({}, async h => {
  const prior = [{ id: 'a0', fromAi: true, body: 'Šta Vam treba?' }];
  await h.update({ messages: prior });
  await h.update({ pending: true, busy: true, sentMessage: 'Selidba' });
  const typing = h.tree.root.findAll(node => node.type === 'View' && node.props.testID === 'ai-typing');
  assert.equal(typing.length, 1, 'the typing row appears in the same render as the sent message');
  assert.equal(typing[0].props.accessibilityLabel, 'USKOČI piše odgovor');
  const final = 'Razumem, selidba sutra ujutru. Koliko ima stvari i da li zgrada ima lift?';
  await h.update({ streamingText: 'Razumem, selidba sutra ' });
  assert.equal(h.preview(), 'Razumem, ', 'the first word replaces the dots without waiting');
  assert.equal(h.tree.root.findAll(node => node.type === 'View' && node.props.testID === 'ai-typing').length, 0);
  await h.frame(); await h.frame();
  const before = h.preview(); assert.ok(before.length > 'Razumem, '.length && final.startsWith(before));
  const messages = [...prior, { id: 'u1', fromAi: false, body: 'Selidba' }, { id: 'a1', fromAi: true, body: final }];
  await h.update({ messages, pending: false, busy: false, sentMessage: null, streamingText: '' });
  assert.equal(h.preview(), '', 'the preview row became the completed row');
  const row = () => h.tree.root.findAll(node => node.type === 'View' && node.props.accessibilityLabel === `USKOČI: ${final}`)[0];
  const text = () => row().findAll(node => node.type === 'T' && node.props.selectable)[0].props.children;
  assert.equal(text(), before, 'no remount and no snap: the completed reply continues from the words already shown');
  let previous = text();
  while (h.frames.size) { await h.frame(); assert.ok(text().startsWith(previous) && final.startsWith(text())); previous = text(); }
  assert.equal(text(), final, 'the reveal finishes on the completed reply');
  assert.deepEqual(h.announcements, [`USKOČI: ${final}`]);
}));

test('reduced motion shows the completed reply whole in the same row', () => scenario({ reduced: true }, async h => {
  await h.update({ pending: true, busy: true, sentMessage: 'Sutra', streamingText: 'Važi, sutra u deset ' });
  assert.equal(h.preview(), 'Važi, sutra u deset', 'everything received (stable) at once');
  const final = 'Važi, sutra u deset sati. Gde je zadatak?';
  await h.update({ messages: [{ id: 'u1', fromAi: false, body: 'Sutra' }, { id: 'a1', fromAi: true, body: final }], pending: false, busy: false, sentMessage: null });
  assert.equal(h.tree.root.findAll(node => node.type === 'T' && node.props.selectable && node.props.children === final).length, 1);
  assert.equal(h.frames.size, 0);
}));

if (!PREIMAGE) {
  for (const withoutSegmenter of [false, true]) {
    test(`stable Unicode boundary for all code-unit cuts (${withoutSegmenter ? 'Hermes fallback' : 'Intl.Segmenter'})`, () => {
      const { stableStreamPrefix } = harness({ withoutSegmenter }).load(HELPER);
      for (const full of ['Čao c\u030c 🧑🏽‍🚀, порука 🇷🇸 1️⃣ 👨‍👩‍👧‍👦 i kraj.', 'A\r\nB 👩🏾‍❤️‍💋‍👩🏻 end.',
        'Test क्ष क्‍ष 각 👩\u200d🚒 kraj.', 'Negde \u0301tekst i kraj.']) {
        const boundaries = new Set([...new Intl.Segmenter('sr', { granularity: 'grapheme' }).segment(full)].map(part => part.index));
        let previous = '';
        for (let end = 0; end <= full.length; end++) {
          const raw = full.slice(0, end), shown = stableStreamPrefix(raw);
          assert.ok(raw.startsWith(shown)); assert.ok(shown.startsWith(previous)); assert.ok(boundaries.has(shown.length), `${JSON.stringify(shown)} ends inside a grapheme`);
          previous = shown;
        }
        assert.ok(previous.length > 0, 'ordinary Serbian text gets a useful preview');
      }
      assert.ok(!stableStreamPrefix('Pre \ud83d kasnije slovo.').includes('\ud83d'), 'invalid interior surrogate is withheld');
      assert.ok(!stableStreamPrefix('Pre \udc00 kasnije slovo.').includes('\udc00'), 'invalid low surrogate is withheld');
    });
  }
  test('shell on a runtime without Segmenter shows stable words then the complete canonical tail', () => scenario({ withoutSegmenter: true, reduced: true }, async h => {
    await h.update({ pending: true, sentMessage: 'Ćao', streamingText: '👩🏽‍🚀' }); assert.equal(h.preview(), '');
    await h.update({ streamingText: '👩🏽‍🚀 Čujemo' }); assert.equal(h.preview(), '👩🏽‍🚀 ');
    await h.update({ streamingText: '👩🏽‍🚀 Čujemo se.' }); assert.equal(h.preview(), '👩🏽‍🚀 Čujemo ');
    const final = '👩🏽‍🚀 Čujemo se.';
    await h.update({ messages: [{ id: 'a1', fromAi: true, body: final }], pending: false, sentMessage: null });
    assert.equal(h.preview(), ''); assert.deepEqual(h.announcements, [`USKOČI: ${final}`]);
  }));
}


test('provider preview text is opt-in, gated, never persisted and replaced by the completed turn', () => {
  const needEdge = fs.readFileSync(path.join(ROOT, 'supabase/functions/uskoci-ai-interview/index.ts'), 'utf8');
  const workerEdge = fs.readFileSync(path.join(ROOT, 'supabase/functions/uskoci-worker-interview/index.ts'), 'utf8');
  const clientStream = fs.readFileSync(path.join(ROOT, 'src/data/aiNeedTurnStream.ts'), 'utf8');
  assert.ok(needEdge.includes("import { createAiFirstTextRecorder, measureAiPhase, recordGeminiUsage }"));
  assert.ok(needEdge.includes("const recordFirstText = createAiFirstTextRecorder('NEED');"));
  // Older clients (no opt-in header) keep the exact accepted→final event shape.
  assert.ok(needEdge.includes('req.headers.get(AI_PROVISIONAL_STREAM_HEADER) === AI_PROVISIONAL_STREAM_VERSION'));
  assert.ok(needEdge.includes("const provisional = wantsProvisional ? createProvisionalTextGate() : null;"));
  assert.match(needEdge, /emit\(\{ kind: 'text_delta', text, provisional: true \}\)/);
  assert.equal((needEdge.match(/kind: 'text_delta'/g) ?? []).length, 1, 'NEED emits text only through the provisional gate');
  // Persistence uses the guarded assistantMessage, never provisional text.
  assert.ok(needEdge.includes('p_assistant_message: aiTurn.assistantMessage'));
  assert.doesNotMatch(workerEdge, /previewStream/);
  assert.ok(workerEdge.includes('x-uskoci-worker-preview-stream'), 'legacy preflight remains accepted while the old preview flag is ignored');
  assert.ok(workerEdge.includes("const recordFirstText=createAiFirstTextRecorder('WORKER',startedAt);"));
  assert.ok(workerEdge.includes("const provisional=wantsProvisional ? createProvisionalTextGate() : null;"));
  assert.ok(workerEdge.includes("send('text_delta',{text,provisional:true})"));
  const completed = workerEdge.indexOf("const turn=await measureAiPhase('WORKER_COMPLETE'");
  const verifiedText = workerEdge.indexOf("if(!wantsProvisional)send('text_delta',{text:output.assistantMessage})");
  assert.ok(completed >= 0 && verifiedText > completed, 'legacy Worker text must follow the successful completion receipt');
  assert.doesNotMatch(clientStream, /x-uskoci-worker-preview-stream/);
  assert.ok(clientStream.includes('[AI_PROVISIONAL_STREAM_HEADER]: AI_PROVISIONAL_STREAM_VERSION'));
});

if (!PREIMAGE) test('a quiet stream shows its last plain word instead of waiting for the saved reply (owner, 23.11.2026)', () => {
  for (const withoutSegmenter of [false, true]) {
    const { quietStreamText, stableStreamPrefix } = harness({ withoutSegmenter }).load(HELPER);
    assert.equal(quietStreamText('Imate li okvirni budžet?'), 'Imate li okvirni budžet?');
    assert.equal(quietStreamText('Koliko kvadrata ima stan'), 'Koliko kvadrata ima stan');
    assert.equal(quietStreamText('Може ли у суботу'), 'Може ли у суботу');
    for (const growing of ['Hvala 👍', 'Super 👩\u200d', 'Pa \ud83d']) assert.equal(quietStreamText(growing), stableStreamPrefix(growing), growing);
  }
});
