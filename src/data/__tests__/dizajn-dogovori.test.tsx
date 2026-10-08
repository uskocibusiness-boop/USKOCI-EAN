import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The Dogovori gallery (`app/dizajn-dogovori`): every scene it draws comes from fixtures, reads nothing and sends nothing. The Pregled is
 * the real `AgreementOverview` (the component the route draws), so these scenes are what the screen composes in its main states; the
 * conversation and the list have their own suites. Here: every scene opens, and the scenes of the ideas of the UI pass (R01a, R02, R03,
 * R04, R29, CANCEL-INFO) show what they promise.
 */
let mockScene: string | undefined;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ...props }: any) => require('react').createElement('List', props,
      data.length ? data.map((item: any, index: number) => require('react').createElement(require('react').Fragment, { key: item.id ?? index }, renderItem({ item, index }))) : ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'RefreshControl', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ scene: mockScene }) }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/system/haptics', () => ({ tick: jest.fn(), forgetTicks: jest.fn() }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto', NeedPhotos: 'NeedPhotos' }));
jest.mock('../../ui/support/SupportContextEntry', () => ({ SupportContextEntry: 'SupportContextEntry' }));
jest.mock('../../ui/media/AgreementPhotoComposer', () => ({ AgreementPhotoComposer: 'AgreementPhotoComposer', AgreementPhotoSheet: 'AgreementPhotoSheet' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
// Importing the conversation reaches the client module; the gallery itself never calls it (every command is a no-op).
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));

import DizajnDogovori from '../../app/dizajn-dogovori';
import { SAVE_WARNING } from '../../ui/reviews/AgreementReviewPresentation';

let tree: ReactTestRenderer;
const open = async (scene: string) => { mockScene = scene; await act(async () => { tree = create(<DizajnDogovori />); }); };
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const labels = () => tree.root.findAll(node => String(node.type) === 'Press').map(node => String(node.props.accessibilityLabel));
const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
afterEach(async () => { if (tree) await act(async () => tree.unmount()); mockScene = undefined; });

const DETAILS = ['one', 'worker', 'group', 'waiting', 'recovery', 'done', 'no-term', 'problem', 'form', 'shared', 'no-number', 'cancelled', 'cancelled-me', 'long-detail'];
const STATES = ['status-loading', 'status-error', 'status-unavailable', 'review', 'review-grey', 'review-saved', 'review-loading', 'review-error'];
const CHATS = ['chat', 'chat-waiting', 'chat-empty', 'chat-loading', 'chat-error', 'chat-closed', 'chat-media', 'chat-unknown'];

it.each([...DETAILS, ...STATES, ...CHATS, 'list', 'history', 'empty', 'loading', 'error', 'long'])('opens the scene "%s" without reading or writing anything', async scene => {
  await open(scene);
  expect(text().length).toBeGreaterThan(0);
});

describe('the ideas of the UI pass, as the gallery draws them', () => {
  it('R01a: an account without a number is told where contact happens, and is offered no command that cannot succeed', async () => {
    await open('no-number');
    expect(labels()).toContain('Kontakt kroz Poruke'); expect(labels()).not.toContain('Podeli svoj broj');
    await act(async () => { tree.unmount(); });
    await open('one');
    expect(labels()).toContain('Podeli svoj broj'); expect(labels()).not.toContain('Kontakt kroz Poruke');
  });

  it('a shared number is called, and withdrawn', async () => {
    await open('shared');
    expect(labels()).toContain('Pozovi, 064 123 4567'); expect(labels()).toContain('Opozovi deljenje broja');
  });

  it('R02: a Dogovor with no term says so where the person reads what comes next, with the way to propose one', async () => {
    await open('no-term');
    expect(headers()).toContain('Termin još nije dogovoren'); expect(labels()).toContain('Predloži termin');
    expect(text()).toContain('Nije dogovoren');
  });

  it('R03: the worker is told the address is not shared and can ask for it; the requester is told to share it when ready', async () => {
    await open('worker');
    expect(labels()).toContain('Zatraži adresu'); expect(text()).toContain('Adresa još nije podeljena.');
    await act(async () => { tree.unmount(); });
    await open('one');
    expect(text()).toContain('Podeli adresu kad budete spremni.'); expect(labels()).not.toContain('Zatraži adresu');
  });

  it('R04: after a reported problem there are three ways on, and the form that reported it is gone', async () => {
    await open('problem');
    expect(headers()).toContain('Šta dalje');
    expect(labels()).toEqual(expect.arrayContaining(['Dogovorite se u Porukama', 'Otkaži Dogovor', 'Prijavi nedolazak']));
    expect(labels()).not.toContain('Prijavi problem');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
  });

  it('the form that reports a problem takes the place of its row, at the end of the page', async () => {
    await open('form');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' }).length).toBeGreaterThan(0);
    expect(labels()).not.toContain('Prijavi problem'); expect(headers()).toContain('Problem u Dogovoru');
  });

  it('CANCEL-INFO: a cancelled Dogovor says when, by whom and why - and a reason that was never kept, in words', async () => {
    await open('cancelled');
    expect(text()).toContain('Otkazano 28. sep · 19:20 · Jelena Nikolić · Živicu je u međuvremenu orezao komšija.');
    await act(async () => { tree.unmount(); });
    await open('cancelled-me');
    expect(text()).toContain('Otkazano 28. sep · 10:05 · Ti · Razlog nije sačuvan');
  });

  it('R29: before "Sačuvaj" the person is told that a saved rating cannot be changed; grey, the foot says why instead', async () => {
    await open('review');
    expect(text()).toContain(SAVE_WARNING);
    await act(async () => { tree.unmount(); });
    await open('review-grey');
    expect(text()).not.toContain(SAVE_WARNING); expect(text()).toContain('Izaberi ocenu.');
  });

  it('a send whose outcome is not known says so under its bubble with the one "Proveri"; a refused one keeps "Nije poslato" and "Pošalji ponovo"', async () => {
    await open('chat-unknown');
    expect(text()).toContain('Ne znamo da li je stigla'); expect(text()).not.toContain('Nije poslato');
    expect(labels()).toContain('Proveri da li je stigla: Parking je iza zgrade.'); expect(labels()).not.toContain('Ponovi slanje poruke Parking je iza zgrade.');
    expect(text()).not.toContain('Pošalji ponovo');
    await act(async () => { tree.unmount(); });
    await open('chat');
    expect(text()).toContain('Nije poslato'); expect(text()).toContain('Poruka nije sačuvana na telefonu. Tekst nije odbačen; pokušaj ponovo.');
    expect(text()).toContain('Pošalji ponovo'); expect(text()).not.toContain('Proveri');
  });

  it('the group conversation says what the screen of the group says when fewer than two people are chosen', async () => {
    await open('group');
    expect(text()).toContain('Grupni razgovor se otvara kad su za ovaj zadatak izabrane najmanje dve osobe.');
  });

  it('the states of the Dogovor while it is read: loading, a failed read with one way forward, and a Dogovor that cannot be opened', async () => {
    await open('status-loading'); expect(text()).toContain('Učitavamo Dogovor…');
    await act(async () => { tree.unmount(); });
    await open('status-error'); expect(text()).toContain('Dogovor nije učitan'); expect(labels()).toContain('Ponovo učitaj Dogovor');
    await act(async () => { tree.unmount(); });
    await open('status-unavailable'); expect(text()).toContain('Dogovor nije dostupan'); expect(labels()).toContain('Nazad na Dogovore');
  });
});
