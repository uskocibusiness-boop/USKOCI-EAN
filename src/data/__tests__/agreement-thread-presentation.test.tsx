import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DogovorProjekcija } from '../../contracts/projections';

let mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto', NeedPhotos: 'NeedPhotos' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer', AgreementPhotoSheet: 'AgreementPhotoSheet' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
import { CLOSED_SENTENCE } from '../../ui/AgreementChat';
import { AgreementThreadPresentation } from '../../ui/v2/AgreementThreadPresentation';

const agreement = {
  id: 'dogovor', naslov: 'Prenos troseda i dve fotelje sa trećeg sprata', verzija: 2, stanje: 'CONFIRMED',
  cena: { prikaz: '5.500 RSD' }, vremeTekst: '26. sep · 17:00–19:00 (po vremenu u Srbiji)', putanjaTekst: 'Liman, Novi Sad',
  pokrivenost: { ukupno: 2, popunjeno: 2 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'druga', ime: 'Aleksandra Konstantinović-Radovanović', inicijali: 'AK', uloga: 'uskocer', profilId: null }],
} as DogovorProjekcija;
const command = { accountId: 'ja', agreementId: agreement.id, clientMessageId: 'poruka_retry_123', body: 'Stižem uskoro.' };
type Props = React.ComponentProps<typeof AgreementThreadPresentation>;
let tree: ReactTestRenderer;
let props: Props;
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const flat = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style ?? {};
const text = (node = tree.root) => node.findAll(child => String(child.type) === 'T').flatMap(child => child.children.filter(value => typeof value === 'string')).join(' ');
const history = () => tree.root.findByProps({ testID: 'agreement-chat-history' });
const measure = async (height: number) => act(async () => tree.root.findByProps({ testID: 'agreement-thread-frame' })
  .props.onLayout({ nativeEvent: { layout: { height } } }));
async function render() { await act(async () => { tree = create(<AgreementThreadPresentation {...props} />); }); }

beforeEach(() => {
  mockWindow = { width: 390, height: 844, fontScale: 1, scale: 3 };
  props = { agreement, person: agreement.ucesnici[0], onOverview: jest.fn(), waiting: 'Potvrdi završetak',
    chat: { messages: [], loading: false, error: false, writable: true, terminal: false, refresh: jest.fn().mockResolvedValue(undefined),
      refreshWorkspace: jest.fn().mockResolvedValue(undefined),
      outbox: { setDraft: jest.fn(), sendDraft: jest.fn().mockResolvedValue(undefined), retry: jest.fn().mockResolvedValue(undefined), start: jest.fn() } as any,
      state: { phase: 'ready', draft: 'Moj sačuvani nacrt', capturing: false, entries: [], error: null },
      photos: { agreementId: agreement.id, loaded: true, busy: false, ready: false, hasSelection: false, items: [],
        message: null, versionConflict: false, canSubmit: () => false, capture: () => null, refresh: jest.fn().mockResolvedValue(undefined) } as any } };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each([844, 480])('keeps inbox Back separate from task context at height %s without remounting the draft', async height => {
  mockWindow = { ...mockWindow, height };
  props.onBack = jest.fn();
  await render();
  await act(async () => button('Nazad').props.onPress());
  expect(props.onBack).toHaveBeenCalledTimes(1);
  expect(props.onOverview).not.toHaveBeenCalled();
  const context = height < 560 ? `Uslovi Dogovora: ${agreement.naslov}. Potvrdi završetak`
    : `Dogovor: ${agreement.naslov}. ${agreement.ucesnici[0].ime}`;
  await act(async () => button(context).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  expect(button('Napiši poruku').props.value).toBe('Moj sačuvani nacrt');
});

it('gives 320 dp / font scale 2 history the full identity and accepted terms while keeping overview outside the scroll', async () => {
  mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
  await render();
  expect(tree.root.findAllByProps({ testID: 'agreement-thread-full-bar' })).toHaveLength(0);
  const context = history().findByProps({ testID: 'agreement-thread-context' });
  expect(text(context)).toContain(agreement.ucesnici[0].ime);
  expect(text(context)).toContain('Uskače na tvoj zadatak');
  expect(text(context)).toContain(agreement.naslov);
  expect(text(context)).toContain('5.500 RSD');
  expect(text(context)).toContain('26. sep · 17:00–19:00');
  expect(text(context)).toContain('Po vremenu u Srbiji');
  expect(text(context)).toContain('Potvrdi završetak');
  const name = context.findAll(node => String(node.type) === 'T' && node.children.includes(agreement.ucesnici[0].ime))[0];
  expect(name.props.numberOfLines).toBeUndefined();
  const overview = `Uslovi Dogovora: ${agreement.naslov}. Potvrdi završetak`;
  expect(history().findAllByProps({ accessibilityLabel: overview })).toHaveLength(0);
  await act(async () => button(overview).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  await act(async () => button('Nazad').props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(2);
  const composer = tree.root.findByProps({ testID: 'agreement-chat-composer' });
  expect(history().findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
  expect(flat(composer.props.style).flexShrink).toBe(0);
  expect(button('Napiši poruku').props).toMatchObject({ value: 'Moj sačuvani nacrt', multiline: true, scrollEnabled: true });
  // Two complete large-text lines can be seen instead of clipping a multiline draft to a one-line viewport.
  expect(flat(button('Napiši poruku').props.style).maxHeight).toBeGreaterThanOrEqual(120);
  expect(flat(button('Napiši poruku').props.style).maxHeight).toBeLessThanOrEqual(140);
  expect(flat(button('Pošalji poruku').props.style)).toMatchObject({ width: 48, height: 48 });
});

it('responds to the measured keyboard space without remounting the draft or losing an open photo tray', async () => {
  // A prepared photo holds the tray open (the "+" itself opens the shared photo sheet since 2026-10-07).
  props.chat.photos = { ...props.chat.photos!, hasSelection: true };
  await render();
  expect(tree.root.findAllByProps({ testID: 'agreement-thread-full-bar' })).toHaveLength(1);
  const input = button('Napiši poruku');
  const tray = tree.root.findByType('AgreementPhotoComposer' as any);
  await measure(410);
  expect(tree.root.findAllByProps({ testID: 'agreement-thread-full-bar' })).toHaveLength(0);
  // At ordinary text size the keyboard bar still names whom I am replying to; the full identity remains in history.
  expect(button(`Poruke: ${agreement.ucesnici[0].ime}`).props.children).toBe(agreement.ucesnici[0].ime);
  expect(text(tree.root.findByProps({ testID: 'agreement-thread-compact-bar' }))).toContain(agreement.naslov);
  expect(text(history().findByProps({ testID: 'agreement-thread-context' }))).toContain(agreement.ucesnici[0].ime);
  expect(button('Napiši poruku')).toBe(input);
  expect(tree.root.findByType('AgreementPhotoComposer' as any)).toBe(tray);
  expect(tray.props.photos).toBe(props.chat.photos);
  expect(history().findByType('AgreementPhotoComposer' as any)).toBe(tray);
  await measure(790);
  expect(tree.root.findAllByProps({ testID: 'agreement-thread-full-bar' })).toHaveLength(1);
  expect(button('Napiši poruku')).toBe(input);
  expect(tree.root.findByType('AgreementPhotoComposer' as any)).toBe(tray);
  expect(button('Dodaj fotografije').props.disabled).toBe(false);
  expect(props.chat.outbox.sendDraft).not.toHaveBeenCalled();
  expect(props.chat.refresh).not.toHaveBeenCalled();
});

it('keeps Back on the same Agreement overview before and after the keyboard compresses the chat', async () => {
  await render();
  await act(async () => button('Nazad').props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  await measure(410);
  await act(async () => button('Nazad').props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(2);
  await measure(790);
  await act(async () => button('Nazad').props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(3);
});

it('identifies this job beside the person and opens its accepted overview from that context', async () => {
  props.person = { ...agreement.ucesnici[0], profilId: 'profil' };
  await render();
  const header = tree.root.findByProps({ testID: 'agreement-thread-full-bar' });
  expect(text(header)).toContain(agreement.naslov);
  expect(text(header)).toContain(agreement.ucesnici[0].ime);
  expect(button(`Dogovor: ${agreement.naslov}. ${agreement.ucesnici[0].ime}`).findAllByType('ProfilePhoto' as any)).toHaveLength(0);
  await act(async () => button(`Dogovor: ${agreement.naslov}. ${agreement.ucesnici[0].ime}`).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  // The title is a real projection, not a label derived from the person's name or an old conversation.
  props = { ...props, agreement: { ...agreement, naslov: 'Montaža dve police' } };
  await act(async () => tree.update(<AgreementThreadPresentation {...props} />));
  expect(text(header)).toContain('Montaža dve police');
  expect(text(header)).not.toContain(agreement.naslov);
});

it('lets enlarged text use a full-width draft without recreating it or closing prepared photos', async () => {
  props.chat.photos = { ...props.chat.photos!, hasSelection: true };
  await render();
  const input = button('Napiši poruku');
  expect(flat(input.props.style).flex).toBe(1);
  const tray = tree.root.findByType('AgreementPhotoComposer' as any);
  mockWindow = { ...mockWindow, fontScale: 1.5 };
  await act(async () => tree.update(<AgreementThreadPresentation {...props} />));
  expect(button('Napiši poruku')).toBe(input);
  // The dedicated writing row keeps the input flexible at both scales; identity and draft must survive.
  expect(flat(input.props.style).flex).toBe(1);
  expect(input.props.value).toBe('Moj sačuvani nacrt');
  expect(tree.root.findByType('AgreementPhotoComposer' as any)).toBe(tray);
  expect(tree.root.findAllByType('AgreementPhotoSheet' as any)).toHaveLength(0);
  expect(props.chat.outbox.sendDraft).not.toHaveBeenCalled();
});

it('keeps storage recovery and a forced pending-photo tray in the scroll, with the writing actions outside it', async () => {
  mockWindow = { width: 320, height: 430, fontScale: 2, scale: 3 };
  props.chat.state = { ...props.chat.state, phase: 'error', error: 'STORAGE_UNAVAILABLE' };
  props.chat.photos = { ...props.chat.photos!, hasSelection: true, versionConflict: true };
  await render();
  expect(history().findByType('AgreementPhotoComposer' as any).props.photos).toBe(props.chat.photos);
  // The tray stays in the scroll while photos wait; adding another still opens the shared sheet.
  expect(button('Dodaj fotografije').props).toMatchObject({ disabled: false, accessibilityState: { disabled: false } });
  expect(text(history())).toContain('Poruka nije sačuvana na telefonu.');
  await act(async () => history().findByProps({ accessibilityLabel: 'Ponovo učitaj sačuvane poruke' }).props.onPress());
  expect(props.chat.outbox.start).toHaveBeenCalledTimes(1);
  expect(button('Pošalji poruku').props.disabled).toBe(true);
  expect(button('Napiši poruku').props.value).toBe('Moj sačuvani nacrt');
  expect(history().findAllByProps({ accessibilityLabel: 'Pošalji poruku' })).toHaveLength(0);
});

it('leaves a closed thread read-only while retaining exact unknown-outcome retry and accepted terms access', async () => {
  mockWindow = { width: 320, height: 718, fontScale: 2, scale: 3 };
  props.agreement = { ...agreement, stanje: 'COMPLETED' };
  props.waiting = null;
  props.chat = { ...props.chat, terminal: true, writable: false,
    state: { ...props.chat.state, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] } };
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Napiši poruku' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji poruku' })).toHaveLength(0);
  expect(tree.root.findAllByType('AgreementPhotoComposer' as any)).toHaveLength(0);
  expect(text(history())).toContain('Ne znamo da li je stigla');
  // The closed sentence stands under the thread, where the field was (proposal R2), not inside the scroll.
  expect(text()).toContain(CLOSED_SENTENCE); expect(text(history())).not.toContain(CLOSED_SENTENCE);
  expect(tree.root.findByProps({ testID: 'agreement-chat-closed' })).toBeTruthy();
  await act(async () => button(`Proveri da li je stigla: ${command.body}`).props.onPress());
  expect(props.chat.outbox.retry).toHaveBeenCalledWith(command.clientMessageId);
  expect(props.chat.photos!.refresh).toHaveBeenCalledTimes(1);
  await act(async () => button(`Uslovi Dogovora: ${agreement.naslov}`).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
});

// Proposal R1: the conversation has the same Pregled | Poruke tabs as the overview, and the same "···" menu, so the other half of
// the Dogovor and "Prijavi ili blokiraj osobu" are one tap away while Poruke is shown.
it('draws the Pregled | Poruke tabs under the full bar, with Poruke chosen, and Pregled opens the overview', async () => {
  await render();
  const tabs = tree.root.findByProps({ testID: 'agreement-thread-tabs' });
  expect(tabs.findAllByProps({ accessibilityRole: 'tab' }).filter(node => String(node.type) === 'Press').map(node => [node.props.accessibilityLabel, node.props.accessibilityState.selected]))
    .toEqual([['Pregled', false], ['Poruke', true]]);
  await act(async () => tabs.findByProps({ accessibilityLabel: 'Pregled' }).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  // The chosen tab does nothing.
  await act(async () => tabs.findByProps({ accessibilityLabel: 'Poruke' }).props.onPress());
  expect(props.onOverview).toHaveBeenCalledTimes(1);
  // With the keyboard up the bar keeps Back and "Uslovi" only: no tabs, no menu.
  await measure(410);
  expect(tree.root.findAllByProps({ testID: 'agreement-thread-tabs' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Više radnji' })).toHaveLength(0);
});

it('offers the Dogovor\'s "···" in the conversation bar only when the route has a menu, and it opens that menu', async () => {
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Više radnji' })).toHaveLength(0);
  await act(async () => tree?.unmount());
  props.onMore = jest.fn();
  await render();
  const more = button('Više radnji');
  expect(more.props.accessibilityHint).toContain('blokiranje osobe');
  await act(async () => more.props.onPress());
  expect(props.onMore).toHaveBeenCalledTimes(1);
  expect(props.onOverview).not.toHaveBeenCalled();
});
