import React from 'react';
import { StyleSheet } from 'react-native';
import { Path } from 'react-native-svg';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { OutboxEntry, OutboxSnapshot } from '../agreementOutbox';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer', AgreementPhotoSheet: 'AgreementPhotoSheet' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { AgreementChat, CLOSED_SENTENCE } from '../../ui/AgreementChat';
import { shiftDate } from '../../ui/calendar/calendarPresentation';
import { serbianDayRange, serbianToday } from '../../ui/calendar/serbianDays';
import { sys } from '../../ui/system/tokens';
import { forgetAutoResendForTests, takeAutoResend } from '../../ui/messages/threadModel';

/**
 * The conversation of a Dogovor as proposal R draws it (team T3c): grouped bubbles, Serbian date lines, ONE small mark by each of
 * my messages (the two-check "seen" is built and dormant), the unconfirmed and refused states under their bubble, the closed
 * Dogovor's one grey sentence. The days are built from the real Serbian "today" so no clock has to be faked.
 */
const account = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const agreement = '20000000-0000-4000-8000-000000000001';
const outbox = { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), retry: jest.fn().mockResolvedValue(undefined),
  start: jest.fn().mockResolvedValue(undefined) } as any;
let tree: ReactTestRenderer;
let props: React.ComponentProps<typeof AgreementChat>;
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const texts = (node: ReactTestInstance = tree.root) => node.findAll(child => String(child.type) === 'T').flatMap(child => child.children.filter(c => typeof c === 'string')).join(' ');
const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
const stops = (who: string) => tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith(`${who}: `));
const marks = (word?: string) => tree.root.findAll(node => String(node.type) === 'View' && node.props.accessibilityRole === 'image' && (!word || node.props.accessibilityLabel === word));
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const corners = (node: ReactTestInstance) => { const s = flat(node.props.style); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]; };
const BIG = sys.radius.card, JOINT = sys.space.sm;

/** An instant on the day `back` days ago in SERBIAN time, at hh:mm there. */
const at = (back: number, hours: number, minutes = 0) =>
  new Date(Date.parse(serbianDayRange(shiftDate(serbianToday(), -back)).from) + (hours * 60 + minutes) * 60_000).toISOString();
let counter = 0;
const row = (moja: boolean, telo: string, createdAt: string, over: Record<string, unknown> = {}) => ({ id: `30000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  dogovorVerzija: 1, clientMessageId: null, posiljalacAccountId: moja ? account : other, posiljalacIme: moja ? 'Ja' : 'Marko', moja, telo,
  // The phone-zone words of the old read: ignored whenever the instant is there.
  vremeTekst: 'sutra · 03:33', procitano: null, createdAt, ...over });
const entry = (id: string, state: OutboxEntry['state'], over: Partial<OutboxEntry> = {}): OutboxEntry =>
  ({ command: { accountId: account, agreementId: agreement, clientMessageId: id, body: `Tekst ${id}` }, state, persisted: true, attempt: 1, ...over });
async function render(over: Partial<typeof props> = {}) {
  await act(async () => { tree = create(<AgreementChat {...props} {...over} />, { createNodeMock: element => element.type === ('ScrollView' as never) ? { scrollToEnd: jest.fn(), scrollTo: jest.fn() } : null }); });
}
beforeEach(() => {
  jest.clearAllMocks(); counter = 0; forgetAutoResendForTests();
  // Every unknown outcome in this suite is the fixture of a look; the automatic retry has its own suite.
  takeAutoResend(['unknown_00000001', 'unknown_00000002'].map(id => entry(id, 'unknown')));
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => undefined);
  const state: OutboxSnapshot = { phase: 'ready', draft: '', capturing: false, entries: [], error: null };
  props = { messages: [], loading: false, error: false, writable: true, terminal: false, refresh: jest.fn().mockResolvedValue(undefined),
    refreshWorkspace: jest.fn().mockResolvedValue(undefined), outbox, state };
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

describe('grouped bubbles and Serbian date lines', () => {
  it('names the day in Serbian time, once, and today with the clock of its first message; the clock is Serbian whatever the phone says', async () => {
    await render({ messages: [row(false, 'Dobar dan!', at(1, 9, 0)), row(false, 'Sastavljam ormar.', at(1, 9, 2)), row(true, 'Da, dva krila.', at(0, 1, 0))] });
    expect(headers()).toEqual(['Juče', 'Danas · 01:00']);
    expect(stops('Marko')[0].props.accessibilityLabel).toBe('Marko: Dobar dan!, Juče, 09:00');
    expect(stops('Ti')[0].props.accessibilityLabel).toBe('Ti: Da, dva krila., Danas, 01:00, poslato');
    // The words of the old read ("sutra · 03:33") are never used when the instant is there.
    expect(texts()).not.toContain('sutra');
  });

  it('draws no clock inside any bubble: a line above says when', async () => {
    await render({ messages: [row(false, 'Dobar dan!', at(1, 9, 0)), row(true, 'Da.', at(1, 9, 1))] });
    expect(texts()).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it('opens a line with the clock after a pause of an hour, and none for a shorter pause', async () => {
    await render({ messages: [row(false, 'a', at(1, 9, 0)), row(false, 'b', at(1, 9, 40)), row(false, 'c', at(1, 11, 0)), row(true, 'd', at(1, 11, 3))] });
    expect(headers()).toEqual(['Juče', 'Juče · 11:00']);
  });

  it('shares one tail between messages of one person within five minutes, and gives each later run its own', async () => {
    await render({ messages: [
      row(false, 'Dobar dan!', at(1, 9, 0)), row(false, 'Sastavljam ormar.', at(1, 9, 2)), row(false, 'Dolazim.', at(1, 9, 4)),
      row(true, 'Da.', at(1, 9, 5)),
      row(true, 'Odlično.', at(1, 9, 20)),
    ] });
    const theirs = stops('Marko'), mine = stops('Ti');
    // top-left, top-right, bottom-right, bottom-left
    expect(corners(theirs[0])).toEqual([BIG, BIG, BIG, BIG]);           // first of the run
    expect(corners(theirs[1])).toEqual([JOINT, BIG, BIG, BIG]);         // middle
    expect(corners(theirs[2])).toEqual([JOINT, BIG, BIG, JOINT]);       // last: joint above, tail below
    expect(corners(mine[0])).toEqual([BIG, BIG, JOINT, BIG]);           // a lone bubble: the tail only
    expect(corners(mine[1])).toEqual([BIG, BIG, JOINT, BIG]);           // 15 minutes later is a run of its own
    // Close inside a run, air between runs.
    expect(flat(theirs[1].props.style).marginTop).toBe(3);
    expect(flat(mine[0].props.style).marginTop).toBe(sys.space.md);
  });

  it('keeps the words of an older read without an instant (a day named once) and invents no pause', async () => {
    await render({ messages: [
      { id: 'a', telo: 'Stižem u 10.', moja: false, posiljalacIme: 'Marko', vremeTekst: '23. sep · 09:40', procitano: null },
      { id: 'b', telo: 'Važi.', moja: true, posiljalacIme: 'Ja', vremeTekst: '23. sep · 17:41', procitano: null }] });
    expect(headers()).toEqual(['23. sep']);
  });
});

describe('the small mark by my message', () => {
  it('is one check for a message the read holds, and the other person\'s message has none', async () => {
    await render({ messages: [row(false, 'Zdravo', at(1, 9, 0)), row(true, 'Zdravo i tebi', at(1, 9, 1))] });
    expect(marks().map(mark => mark.props.accessibilityLabel)).toEqual(['Poslato']);
    const mark = marks('Poslato')[0];
    expect(mark.findAllByType(Path)).toHaveLength(1);
    expect(stops('Marko')[0].findAll(node => node.props.accessibilityRole === 'image')).toHaveLength(0);
    // It is inside my bubble, and the bubble speaks it.
    expect(stops('Ti')[0].findAll(node => node.props.accessibilityRole === 'image')).not.toHaveLength(0);
  });

  it('is two checks ONLY when the read says procitano === true; null and false are never "seen"', async () => {
    await render({ messages: [row(true, 'jedan', at(1, 9, 0), { procitano: null }), row(true, 'dva', at(1, 9, 20), { procitano: false }),
      row(true, 'tri', at(1, 9, 40), { procitano: true })] });
    expect(marks().map(mark => mark.props.accessibilityLabel)).toEqual(['Poslato', 'Poslato', 'Viđeno']);
    expect(marks('Viđeno')[0].findAllByType(Path)).toHaveLength(2);
    expect(stops('Ti').map(node => node.props.accessibilityLabel.split(', ').pop())).toEqual(['poslato', 'poslato', 'viđeno']);
  });

  it('is never "seen" because of anything but the field: a reply, a later message of the other person or a real instant change nothing', async () => {
    await render({ messages: [row(true, 'pitanje', at(1, 9, 0)), row(false, 'odgovor', at(1, 9, 1)), row(true, 'još jedno', at(1, 9, 2))] });
    expect(marks('Viđeno')).toHaveLength(0);
  });

  it('a pending send is a quiet dot; a confirmed one not yet returned by the read is one check; nothing is written', async () => {
    const sending = entry('local_00000001', 'sending'), confirmed = entry('local_00000002', 'confirmed', { messageId: '30000000-0000-4000-8000-0000000000aa' });
    await render({ state: { ...props.state, entries: [sending] } });
    // A receipt already confirmed when the thread opens belongs to the read; one confirmed while it is open stands until the read returns it.
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...props.state, entries: [sending, confirmed] }} />));
    expect(marks().map(mark => mark.props.accessibilityLabel)).toEqual(['Šalje se', 'Poslato']);
    expect(marks('Šalje se')[0].findAllByType(Path)).toHaveLength(0);
    expect(texts()).not.toContain('Šalje se'); expect(texts()).not.toContain('Poslato');
    // No retry for either: nothing is wrong.
    expect(tree.root.findAllByProps({ accessibilityLabel: `Ponovi slanje poruke ${sending.command.body}` })).toHaveLength(0);
  });

  it('an unconfirmed send keeps a quiet dot, says so under its bubble and offers "Pošalji ponovo" for that exact message', async () => {
    const unknown = entry('unknown_00000001', 'unknown', { error: 'UNAVAILABLE' });
    await render({ state: { ...props.state, entries: [unknown] } });
    expect(marks().map(mark => mark.props.accessibilityLabel)).toEqual(['Slanje nije potvrđeno']);
    expect(texts()).toContain('Slanje nije potvrđeno'); expect(texts()).toContain('Pošalji ponovo');
    await act(async () => button(`Ponovi slanje poruke ${unknown.command.body}`).props.onPress());
    expect(outbox.retry).toHaveBeenCalledWith('unknown_00000001');
  });

  it('a refused send goes red, draws no mark, says why, and keeps "Pošalji ponovo"', async () => {
    const failed = entry('failed_00000001', 'failed', { error: 'UNAVAILABLE' });
    await render({ state: { ...props.state, entries: [failed] } });
    expect(marks()).toHaveLength(0);
    const bubble = stops('Ti')[0];
    expect(flat(bubble.props.style).backgroundColor).toBe(sys.color.dangerSoft);
    expect(texts()).toContain('Nije poslato'); expect(texts()).toContain('Veza je prekinuta. Slanje još nije potvrđeno.'); expect(texts()).toContain('Pošalji ponovo');
    // The action keeps the long name a screen reader hears, with the visible words "Pošalji ponovo".
    expect(button(`Ponovi slanje poruke ${failed.command.body}`)).toBeTruthy();
  });
});

describe('photos stay in the bubble shape', () => {
  const photo = { assetId: '40000000-0000-4000-8000-000000000001', width: 1600, height: 900, byteSize: 50, contentType: 'image/jpeg' as const };
  const photos = { loaded: true, busy: false, ready: false, hasSelection: false, agreementId: agreement, items: [], saved: [], message: null,
    versionConflict: false, canSubmit: () => false, capture: () => null, refresh: jest.fn() } as any;

  it('draws a photo with a caption as one bubble: the caption is the stop, the mark closes its line, the photo is its own control', async () => {
    await render({ photos, messages: [row(true, 'Evo kako izgleda', at(1, 9, 0), { fotografije: [photo], dogovorVerzija: 3 })] });
    const stop = stops('Ti')[0];
    expect(stop.props.accessibilityLabel).toBe('Ti: Evo kako izgleda, 1 fotografija, Juče, 09:00, poslato');
    expect(stop.findAllByType('AuthorizedPhoto' as never)).toHaveLength(0);
    expect(tree.root.findAllByType('AuthorizedPhoto' as never)).toHaveLength(1);
    expect(stop.findAll(node => node.props.accessibilityRole === 'image')).not.toHaveLength(0);
  });

  it('keeps a photo readable in a closed Dogovor, with the one grey sentence under the thread and no field', async () => {
    await render({ photos, terminal: true, writable: false, messages: [row(false, '', at(1, 9, 0), { fotografije: [photo], dogovorVerzija: 3 })] });
    expect(tree.root.findAllByType('AuthorizedPhoto' as never)).toHaveLength(1);
    expect(texts()).toContain(CLOSED_SENTENCE);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj fotografije' })).toHaveLength(0);
  });
});

describe('a closed Dogovor', () => {
  it('draws no field, no send and no "+", only one grey sentence with a lock, after the thread', async () => {
    await render({ terminal: true, writable: false, messages: [row(false, 'Zdravo', at(1, 9, 0))] });
    expect(tree.root.findAllByProps({ testID: 'agreement-chat-composer' })).toHaveLength(0);
    const closed = tree.root.findByProps({ testID: 'agreement-chat-closed' });
    expect(closed.props.accessibilityLabel).toBe('Dogovor je zatvoren. Poruke možeš samo da čitaš.');
    expect(CLOSED_SENTENCE).toBe('Dogovor je zatvoren. Poruke možeš samo da čitaš.');
    const sentence = closed.findAll(node => String(node.type) === 'T')[0];
    expect(texts(closed)).toBe(CLOSED_SENTENCE);
    expect(sentence.props.tone).toBe('muted');
    // Under the thread, not inside it.
    expect(tree.root.findByProps({ testID: 'agreement-chat-history' }).findAllByProps({ testID: 'agreement-chat-closed' })).toHaveLength(0);
    // Reading is untouched.
    expect(stops('Marko')).toHaveLength(1);
  });

  it('says nothing about the closing that the projection does not carry (no date, no side, no reason)', async () => {
    await render({ terminal: true, writable: false });
    expect(texts()).not.toMatch(/otkaz|razlog|naručilac|\d{1,2}\. (okt|sep)/i);
  });

  it('an open Dogovor has the composer and no closed sentence', async () => {
    await render();
    expect(tree.root.findAllByProps({ testID: 'agreement-chat-closed' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'agreement-chat-composer' })).toHaveLength(1);
  });
});

describe('the pill: plus, text, microphone (or send)', () => {
  it('writes in one rounded, softly lifted capsule whose field says only "Poruka" and is still named for a screen reader', async () => {
    await render();
    const input = button('Napiši poruku');
    expect(input.props.placeholder).toBe('Poruka');
    const pill = input.parent!.parent!;
    expect(flat(pill.props.style)).toMatchObject({ borderRadius: sys.radius.sheet, backgroundColor: sys.conversation.surface });
    expect(flat(pill.props.style).boxShadow ?? flat(pill.props.style).elevation).toBeDefined();
  });

  it('draws a green send that can go when there is text, and a grey one when there is none', async () => {
    await render({ state: { ...props.state, draft: 'Nešto' } });
    const circle = (node: ReactTestInstance) => flat(node.findAll(child => String(child.type) === 'View')[0].props.style);
    expect(circle(button('Pošalji poruku')).backgroundColor).toBe(sys.color.green);
    await act(async () => tree.update(<AgreementChat {...props} state={{ ...props.state, draft: '' }} />));
    expect(circle(button('Pošalji poruku')).backgroundColor).toBe(sys.color.control);
    expect(button('Pošalji poruku').props.disabled).toBe(true);
  });

  it('still counts code points against the 2.000-character limit and keeps the guard', async () => {
    await render({ state: { ...props.state, draft: '😀'.repeat(2001) } });
    expect(button('Pošalji poruku').props.disabled).toBe(true);
    expect(texts()).toContain('skrati poruku');
  });
});
