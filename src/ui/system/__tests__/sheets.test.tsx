import React, { useState } from 'react';
import { BackHandler, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { ConfirmSheet, SLOW_COMMAND_MS, useConfirmSheet, type ConfirmRequest } from '../ConfirmSheet';
import { ActionSheet, orderActions, type SheetAction } from '../ActionSheet';
import { PeekSheet } from '../PeekSheet';
import { Glyph } from '../Glyph';
import { ProductSheet, SHEET_BACKDROP_HINT } from '../../product/ProductSheet';
import { brandAction, pictureWell, sys } from '../tokens';
import { Press } from '../../Press';

let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), mockReact = require('react');
  // The native Modal owns Back; the double keeps its one callback reachable. It is one function: a new one on every read
  // would be a new component type on every render, and React would mount the whole sheet again each time.
  const Modal = ({ visible, children, ...props }: any) => visible ? mockReact.createElement('Modal', props, children) : null;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
// One store answers both names (ui/system/motion, 2026-09-24): mocking it covers useSystemReducedMotion and every
// component that reads useReducedMotion directly, so the whole tree sees the value this suite chose.
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));

/**
 * The one sheet engine and the three sheets built on it. Confirmations used to be system alerts: they could not show
 * that a command was running, could not stop a second tap, and looked like another app. These tests pin what replaced
 * them — one confirm that runs once, a busy state that holds the sheet while its command runs (and lets Back through
 * again once it runs long, without cancelling it), every other ending routed to the cancel path — and the engine rules
 * every sheet shares: pinned actions that are updated in place, a guard for unsaved input, Back, and no motion when the
 * phone asks for none.
 */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const byTestId = (testID: string, root: ReactTestInstance = tree.root) => root.findByProps({ testID });
const texts = (root: ReactTestInstance = tree.root) => root.findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const sheet = () => tree.root.findByType(BottomSheet);
const modal = () => tree.root.findByType('Modal' as unknown as React.ElementType);
const press = async (instance: ReactTestInstance) => { await act(async () => { instance.props.onPress(); }); };
const deferred = () => { let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
const backdropOf = () => byTestId('product-sheet-backdrop');
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.useRealTimers(); });

// The BOTTOM-SHEET FORM of the question: what a request that carries extra content, or whose caller says `form: 'sheet'`, is
// drawn as (plan 2.20: "potvrda sa razlogom ili poljem"). A short question is a centred dialog now (owner 2026-10-07); its cases
// are in confirm-dialog.test.tsx, case for case, so the one contract is held twice, once per form.
describe('ConfirmSheet with extra content in a centred modal', () => {
  const request = (patch: Partial<ConfirmRequest> = {}): ConfirmRequest => ({ title: 'Povući prijavu?',
    message: 'Prijava više neće biti aktivna.', confirmLabel: 'Povuci', form: 'sheet', ...patch });

  it('asks with a title, one sentence, one confirm and one quiet cancel', async () => {
    await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(texts()).toContain('Povući prijavu?'); expect(texts()).toContain('Prijava više neće biti aktivna.');
    expect(byTestId('confirm-sheet-confirm').props.accessibilityLabel).toBe('Povuci');
    expect(byTestId('confirm-sheet-cancel').props.accessibilityLabel).toBe('Odustani');
    // The only buttons are those two: the title row has no × of its own.
    expect(tree.root.findAllByType(Press).map(node => node.props.accessibilityLabel)).toEqual(['Povuci', 'Odustani']);
    expect(flat(byTestId('confirm-sheet-confirm').props.style).backgroundColor).toBe(sys.color.green);
    expect(flat(byTestId('confirm-sheet-cancel').props.style).backgroundColor).toBeUndefined();
    expect(flat(byTestId('confirm-sheet-cancel').props.style).minHeight).toBeGreaterThanOrEqual(48);
    // The confirm is the one primary action: brandAction's measure and corner, and the label in onGreen.
    expect(flat(byTestId('confirm-sheet-confirm').props.style)).toMatchObject({ minHeight: brandAction.minHeight, borderRadius: sys.radius.primary });
    expect(flat(byTestId('confirm-sheet-confirm').findByType('T' as unknown as React.ElementType).props.style).color).toBe(sys.color.onGreen);
  });

  it('draws a destructive confirm in the danger colour, at the primary\'s measure', async () => {
    await render(<ConfirmSheet {...request({ tone: 'danger' })} onClosed={jest.fn()} />);
    expect(flat(byTestId('confirm-sheet-confirm').props.style)).toMatchObject({ backgroundColor: sys.color.danger, minHeight: brandAction.minHeight });
  });

  // Round 2c (verifier vs, must 1): Gorhom speaks its own English hint ("Tap to close the bottom sheet") for a missing or
  // empty one, so "says nothing" was said in English. The backdrop now always carries a Serbian sentence, and while a tap
  // on it does nothing it is taken out of what a screen reader visits (`accessible` false).
  it('says what a tap outside does to the question, and is not visited while the command it started runs', async () => {
    const command = deferred();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={jest.fn()} />);
    expect(backdropOf().props).toMatchObject({ accessible: true, accessibilityHint: 'Zatvara pitanje bez potvrde.' });
    await press(byTestId('confirm-sheet-confirm'));
    expect(backdropOf().props.accessible).toBe(false);
    // Never empty, so Gorhom has no reason to put its English default in its place.
    expect(backdropOf().props.accessibilityHint).toBe('Zatvori');
    await act(async () => { command.resolve(); await command.promise; });
  });

  it('keeps one footer component, so the pressed confirm turns busy in place instead of being mounted again', async () => {
    const command = deferred();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={jest.fn()} />);
    const footer = byTestId('product-sheet-footer'), confirm = byTestId('confirm-sheet-confirm');
    await press(confirm);
    expect(byTestId('confirm-sheet-confirm').props.accessibilityState).toEqual({ disabled: true, busy: true });
    // The same component and the same rendered nodes: a screen reader keeps its place on the button just pressed.
    expect(byTestId('product-sheet-footer')).toBe(footer); expect(byTestId('confirm-sheet-confirm')).toBe(confirm);
    await act(async () => { tree.update(<ConfirmSheet {...request({ message: 'Druga rečenica.', onConfirm: () => command.promise })} onClosed={jest.fn()} />); });
    expect(byTestId('product-sheet-footer')).toBe(footer);
    await act(async () => { command.resolve(); await command.promise; });
  });

  it('runs a confirm once, however often it is pressed, then closes without cancelling', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    const confirm = byTestId('confirm-sheet-confirm').props.onPress, cancel = byTestId('confirm-sheet-cancel').props.onPress;
    await act(async () => { confirm(); confirm(); cancel(); });
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('stays busy and cannot be left while the command it started runs, and reports nothing itself', async () => {
    const command = deferred(), onCancel = jest.fn(), onClosed = jest.fn();
    const onConfirm = jest.fn(() => command.promise);
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    const confirm = byTestId('confirm-sheet-confirm');
    expect(confirm.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, busy: true } });
    expect(confirm.findAllByType('ActivityIndicator' as unknown as React.ElementType)).toHaveLength(1);
    expect(byTestId('confirm-sheet-cancel').props.disabled).toBe(true);
    // No way out while it runs: not the confirm again, not cancel, not Back, not a tap outside, not a drag.
    await press(confirm); await press(byTestId('confirm-sheet-cancel')); await act(async () => { modal().props.onRequestClose(); });
    const backdrop = backdropOf();
    expect(backdrop.props.disabled).toBe(true); await press(backdrop);
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(onClosed).not.toHaveBeenCalled();
    const before = texts();
    await act(async () => { command.resolve(); await command.promise; });
    expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(texts()).toBe(before);
  });

  it('lets Back and a tap outside close the window once the command runs long, without cancelling or repeating it', async () => {
    jest.useFakeTimers();
    const command = deferred(), onCancel = jest.fn(), onClosed = jest.fn();
    const onConfirm = jest.fn(() => command.promise);
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    await act(async () => { jest.advanceTimersByTime(SLOW_COMMAND_MS - 1); });
    await act(async () => { modal().props.onRequestClose(); });
    expect(onClosed).not.toHaveBeenCalled(); expect(backdropOf().props.disabled).toBe(true);
    await act(async () => { jest.advanceTimersByTime(1); });
    // Still the same busy confirm, and still no cancel: the command runs on and the screen that owns it says so.
    expect(byTestId('confirm-sheet-confirm').props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(byTestId('confirm-sheet-cancel').props.disabled).toBe(true);
    expect(backdropOf().props.disabled).toBe(false);
    // A tap outside now only closes the window; it no longer answers the question, and it says so in Serbian.
    expect(backdropOf().props).toMatchObject({ accessible: true, accessibilityHint: 'Zatvara prozor; radnja se nastavlja.' });
    await act(async () => { modal().props.onRequestClose(); });
    expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled();
    await act(async () => { command.resolve(); await command.promise; });
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes after a command that fails, leaving the failure to the screen that owns it', async () => {
    const command = deferred(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    await act(async () => { command.reject(new Error('server')); await command.promise.catch(() => undefined); });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('cancel runs the cancel path once, and a confirm pressed after it does nothing', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    const confirm = byTestId('confirm-sheet-confirm').props.onPress;
    await press(byTestId('confirm-sheet-cancel')); await act(async () => { confirm(); });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it.each(['Back', 'a tap outside'])('%s is a cancel', async route => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await act(async () => { if (route === 'Back') modal().props.onRequestClose(); else backdropOf().props.onPress(); });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('a notice has one button and nothing to cancel', async () => {
    const onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ title: 'Govorni unos i privatnost', confirmLabel: 'U redu', cancelLabel: null })} onClosed={onClosed} />);
    expect(tree.root.findAllByProps({ testID: 'confirm-sheet-cancel' })).toHaveLength(0);
    // It asks nothing, so a tap outside closes a notice, not a question.
    expect(backdropOf().props.accessibilityHint).toBe('Zatvara obaveštenje.');
    await press(byTestId('confirm-sheet-confirm')); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('never moves when the phone asks for less motion', async () => {
    mockReduced = true; await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(modal().props.animationType).toBe('none');
  });
});

describe('useConfirmSheet', () => {
  let api: ReturnType<typeof useConfirmSheet>;
  function Screen() { api = useConfirmSheet(); return <>{api.sheet}</>; }

  it('shows what was asked, retires it silently through the cancel path, and asks again', async () => {
    await render(<Screen />);
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    const first = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Prvo?', message: 'Jedna rečenica.', confirmLabel: 'Da', ...first }); });
    expect(tree.root.findByType(ConfirmSheet).props.title).toBe('Prvo?'); expect(api.open).toBe(true);
    await act(async () => { api.close(); });
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(first.onCancel).toHaveBeenCalledTimes(1);
    expect(first.onConfirm).not.toHaveBeenCalled();
    const second = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Drugo?', message: 'Jedna rečenica.', confirmLabel: 'Da', ...second }); });
    await press(byTestId('confirm-sheet-confirm'));
    expect(second.onConfirm).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('a new question replaces an open one, and the old one ends as a cancel', async () => {
    await render(<Screen />);
    const old = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Staro?', message: 'x', confirmLabel: 'Da', ...old }); });
    await act(async () => { api.ask({ title: 'Novo?', message: 'y', confirmLabel: 'Da' }); });
    expect(tree.root.findAllByType(ConfirmSheet).map(node => node.props.title)).toEqual(['Novo?']);
    expect(old.onCancel).toHaveBeenCalledTimes(1); expect(old.onConfirm).not.toHaveBeenCalled();
  });

  it('a slow command\'s window closed by Back is gone, and the command settles on its own afterwards', async () => {
    jest.useFakeTimers();
    await render(<Screen />);
    const command = deferred(), asked = { onConfirm: jest.fn(() => command.promise), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Zatvori?', message: 'x', confirmLabel: 'Da', ...asked }); });
    await press(byTestId('confirm-sheet-confirm'));
    await act(async () => { jest.advanceTimersByTime(SLOW_COMMAND_MS); });
    await act(async () => { modal().props.onRequestClose(); });
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(api.open).toBe(false);
    await act(async () => { command.resolve(); await command.promise; });
    expect(asked.onConfirm).toHaveBeenCalledTimes(1); expect(asked.onCancel).not.toHaveBeenCalled();
  });
});

describe('ProductSheet centred application modal', () => {
  const element = (props: Partial<React.ComponentProps<typeof ProductSheet>> = {}) => <ProductSheet title="Pregled" onClose={jest.fn()}
    footer={() => <Text testID="apply">Nastavi</Text>} {...props}>{() => <Text testID="body">Sadržaj</Text>}</ProductSheet>;

  it('centres a bounded surface; heading and actions stay outside the body scroll', async () => {
    await render(element());
    expect(tree.root.findAllByType(BottomSheet)).toHaveLength(0);
    expect(flat(byTestId('product-modal-viewport').props.style).justifyContent).toBe('center');
    expect(flat(byTestId('product-modal-card').props.style).maxHeight).toBe('100%');
    expect(byTestId('product-sheet-content').findAllByProps({ testID: 'apply' })).toHaveLength(0);
    expect(byTestId('product-sheet-content').findAllByProps({ testID: 'product-sheet-heading' })).toHaveLength(0);
    expect(byTestId('product-sheet-content').props.keyboardShouldPersistTaps).toBe('handled');
    expect(byTestId('product-modal-card').props.accessibilityViewIsModal).toBe(true);
  });

  it('updates actions without remounting the footer or losing the body', async () => {
    await render(element());
    const footer = byTestId('product-sheet-footer'), body = byTestId('body');
    await act(async () => tree.update(element({ footer: () => <Text testID="apply">Sačekaj…</Text> })));
    expect(byTestId('product-sheet-footer')).toBe(footer);
    expect(byTestId('body')).toBe(body);
    expect(byTestId('apply').props.children).toBe('Sačekaj…');
  });

  it.each(['Back', 'close', 'outside'])('closes once through %s', async way => {
    const onClose = jest.fn(); await render(element({ onClose }));
    const close = way === 'Back' ? modal().props.onRequestClose : byTestId(way === 'close' ? 'product-sheet-close' : 'product-sheet-backdrop').props.onPress;
    await act(async () => { close(); close(); }); expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding input; Back in the question keeps the draft mounted', async () => {
    const onClose = jest.fn(); await render(element({ onClose, dirty: true }));
    const body = byTestId('body');
    await press(byTestId('product-sheet-close'));
    expect(onClose).not.toHaveBeenCalled(); expect(texts()).toContain('Odbaciti izmene?');
    expect(backdropOf().props.accessibilityHint).toBe('Nastavlja uređivanje.');
    await act(async () => modal().props.onRequestClose());
    expect(byTestId('body')).toBe(body); expect(texts()).not.toContain('Odbaciti izmene?');
    await press(backdropOf()); await press(byTestId('product-sheet-keep'));
    expect(onClose).not.toHaveBeenCalled();
    await press(backdropOf()); await press(byTestId('product-sheet-discard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the latest dirty/busy state and blocks every user exit while pending', async () => {
    const onClose = jest.fn(); await render(element({ onClose }));
    const oldBack = modal().props.onRequestClose;
    await act(async () => tree.update(element({ onClose, dirty: true, dismissible: false })));
    await act(async () => oldBack()); await press(backdropOf()); await press(byTestId('product-sheet-close'));
    expect(onClose).not.toHaveBeenCalled(); expect(backdropOf().props.accessible).toBe(false);
    expect(byTestId('product-sheet-close').props.disabled).toBe(true);
    await act(async () => tree.update(element({ onClose, dirty: true })));
    await act(async () => oldBack()); expect(texts()).toContain('Odbaciti izmene?');
  });

  it('allows an explicit commit to close without throwing up a discard question', async () => {
    const onClose = jest.fn(); await render(element({ onClose, dirty: true,
      footer: dismiss => <Text testID="commit" onPress={dismiss}>Sačuvaj</Text> }));
    await press(byTestId('commit'));
    expect(onClose).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Odbaciti izmene?');
  });

  it('respects reduced motion and keeps a labelled untitled menu accessible', async () => {
    mockReduced = true;
    const onClose = jest.fn();
    await render(element({ title: undefined, label: 'Radnje', onClose }));
    expect(modal().props.animationType).toBe('none');
    expect(byTestId('product-modal-card').props.accessibilityLabel).toBe('Radnje');
    expect(backdropOf().props.accessibilityHint).toBe(SHEET_BACKDROP_HINT);
    await press(byTestId('product-sheet-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ActionSheet', () => {
  const actions = (log: string[]): SheetAction[] => [
    { key: 'report', label: 'Prijavi ili blokiraj', icon: 'shield', destructive: true, onPress: () => log.push('report') },
    { key: 'profile', label: 'Otvori profil', icon: 'person', onPress: () => log.push('profile') },
    { key: 'photos', label: 'Fotografije', icon: 'photo', disabled: true, onPress: () => log.push('photos') },
  ];

  it('puts a destructive action last and draws it in the danger colour', async () => {
    expect(orderActions(actions([])).map(action => action.key)).toEqual(['profile', 'photos', 'report']);
    await render(<ActionSheet actions={actions([])} onClose={jest.fn()} />);
    const rows = tree.root.findAllByType(Press).filter(row => row.props.accessibilityRole === 'menuitem');
    expect(rows.map(row => row.props.accessibilityLabel)).toEqual(['Otvori profil', 'Fotografije', 'Prijavi ili blokiraj']);
    const label = rows[2].findByType('T' as unknown as React.ElementType);
    expect(flat(label.props.style).color).toBe(sys.color.danger);
    expect(flat(rows[0].props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(byTestId('product-modal-card').props.accessibilityLabel).toBe('Radnje');
  });

  it('names the menu where a screen reader reads it, and says what a tap outside does', async () => {
    await render(<ActionSheet actions={actions([])} onClose={jest.fn()} />);
    // The sheet's own label sits on a container that is not read; the menu carries the name.
    expect(tree.root.findByProps({ accessibilityRole: 'menu' }).props.accessibilityLabel).toBe('Radnje');
    expect(backdropOf().props.accessibilityHint).toBe('Zatvara meni bez izbora.');
    await act(async () => tree.unmount());
    // Round 2c (verifier vs, nit): a titled menu used to carry its title as its label too, so TalkBack read the visible
    // heading and then the same words again on the menu. The heading is read; the menu adds nothing to it.
    await render(<ActionSheet title="Dogovor" actions={actions([])} onClose={jest.fn()} />);
    expect(tree.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Dogovor');
    expect(tree.root.findByProps({ accessibilityRole: 'menu' }).props.accessibilityLabel).toBeUndefined();
  });

  it('draws each picture in its own well token, not in the icon button\'s', async () => {
    await render(<ActionSheet actions={actions([])} onClose={jest.fn()} />);
    // FactArt is memo'd: the renderer holds it under its inner function, so it is found by its props.
    const art = tree.root.findAll(node => typeof node.type !== 'string' && node.props.kind === 'person')[0];
    expect(flat(art.parent!.props.style)).toMatchObject(pictureWell);
  });

  it('runs the chosen action once, after the sheet has gone', async () => {
    const log: string[] = [], onClose = jest.fn(() => log.push('closed'));
    await render(<ActionSheet actions={actions(log)} onClose={onClose} />);
    const profile = tree.root.findByProps({ accessibilityLabel: 'Otvori profil' }).props.onPress;
    await act(async () => { profile(); profile(); });
    expect(log).toEqual(['closed', 'profile']);
  });

  // Review of step 5b (2026-09-24): "Postojeći Dogovori se otkazuju zasebno." had become a hint only a screen reader heard,
  // and a sighted owner of a partly agreed task saw no "Otkaži zadatak" and no reason why.
  it('draws a subtitle as one quiet line under the label, and a screen reader hears it, before the row\'s own hint', async () => {
    const rows: SheetAction[] = [
      { key: 'agreements', label: 'Otvori moje Dogovore', icon: 'agreements', subtitle: 'Postojeći Dogovori se otkazuju zasebno.', onPress: jest.fn() },
      { key: 'both', label: 'Ne traži više nikoga', icon: 'users', destructive: true, subtitle: 'Zatvara preostala mesta.', hint: 'Dogovoreno je 1 od 2.', onPress: jest.fn() },
      { key: 'plain', label: 'Izmeni Zadatak', icon: 'document', onPress: jest.fn() },
    ];
    await render(<ActionSheet actions={rows} onClose={jest.fn()} />);
    const row = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
    const lines = (label: string) => row(label).findAll(node => node.type === ('T' as unknown as React.ElementType));
    expect(lines('Otvori moje Dogovore').map(line => line.props.children)).toEqual(['Otvori moje Dogovore', 'Postojeći Dogovori se otkazuju zasebno.']);
    expect(lines('Otvori moje Dogovore')[1].props).toMatchObject({ variant: 'note', tone: 'muted' });
    expect(row('Otvori moje Dogovore').props.accessibilityHint).toBe('Postojeći Dogovori se otkazuju zasebno.');
    // Review r3b (vd, should fix 6): this pinned the row's own hint alone, so the visible subtitle was never spoken. A row
    // with both says the subtitle and then its hint. The label of a destructive row keeps the danger colour above its
    // quiet line.
    expect(row('Ne traži više nikoga').props.accessibilityHint).toBe('Zatvara preostala mesta. Dogovoreno je 1 od 2.');
    expect(flat(lines('Ne traži više nikoga')[0].props.style).color).toBe(sys.color.danger);
    // A row without one is drawn exactly as before: one label, nothing under it.
    expect(lines('Izmeni Zadatak').map(line => line.props.children)).toEqual(['Izmeni Zadatak']);
    expect(row('Izmeni Zadatak').props.accessibilityHint).toBeUndefined();
  });

  it('does nothing for an action that is not available', async () => {
    const log: string[] = [], onClose = jest.fn();
    await render(<ActionSheet actions={actions(log)} onClose={onClose} />);
    await press(tree.root.findByProps({ accessibilityLabel: 'Fotografije' }));
    expect(log).toEqual([]); expect(onClose).not.toHaveBeenCalled();
  });

  // Plan 2.18: unavailable is a GREY surface with a reason, never a faded ghost of the live row (it was opacity 0.45, so a
  // disabled destructive row was a pale red and a disabled row said nothing).
  it('draws a row that cannot be used on the grey wash in muted ink, never faded, and says why in the line a subtitle would take', async () => {
    const rows: SheetAction[] = [
      { key: 'live', label: 'Otvori profil', icon: 'person', subtitle: 'Javni profil.', onPress: jest.fn() },
      { key: 'why', label: 'Fotografije', icon: 'photo', disabled: true, reason: 'Nacrt još nema naslov.', subtitle: 'Dodaj slike u nacrt.', hint: 'Otvara fotografije.', onPress: jest.fn() },
      { key: 'sub', label: 'Izvezi', icon: 'document', disabled: true, subtitle: 'Dostupno uskoro.', onPress: jest.fn() },
      { key: 'bare', label: 'Podeli', icon: 'users', disabled: true, onPress: jest.fn() },
      { key: 'end', label: 'Obriši nacrt', icon: 'shield', destructive: true, disabled: true, reason: 'Prvo ukloni fotografije.', onPress: jest.fn() },
    ];
    await render(<ActionSheet actions={rows} onClose={jest.fn()} />);
    const row = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
    const lines = (label: string) => row(label).findAll(node => node.type === ('T' as unknown as React.ElementType));
    const well = (label: string) => row(label).findAll(node => typeof node.type === 'string' && flat(node.props.style).width === pictureWell.width)[0];
    // A live row is as it was: no wash, its own ink, its subtitle.
    expect(flat(row('Otvori profil').props.style).backgroundColor).toBeUndefined();
    expect(flat(lines('Otvori profil')[0].props.style).color).toBe(sys.color.ink);
    expect(lines('Otvori profil')[1].props.children).toBe('Javni profil.');
    for (const label of ['Fotografije', 'Izvezi', 'Podeli', 'Obriši nacrt']) {
      const style = flat(row(label).props.style);
      expect([label, style.backgroundColor, style.opacity]).toEqual([label, sys.color.wash, undefined]);
      expect([label, flat(lines(label)[0].props.style).color]).toEqual([label, sys.color.muted]);
      expect([label, flat(well(label).props.style).backgroundColor]).toEqual([label, sys.color.surface]);
      expect([label, row(label).props.accessibilityState]).toEqual([label, { disabled: true }]);
    }
    // The reason takes the subtitle's place and is what is spoken, before the row's own hint.
    expect(lines('Fotografije').map(line => line.props.children)).toEqual(['Fotografije', 'Nacrt još nema naslov.']);
    expect(row('Fotografije').props.accessibilityHint).toBe('Nacrt još nema naslov. Otvara fotografije.');
    // A disabled row with only a subtitle keeps saying it; one with neither is grey and bare (the next wave gives it a reason).
    expect(lines('Izvezi').map(line => line.props.children)).toEqual(['Izvezi', 'Dostupno uskoro.']);
    expect(lines('Podeli').map(line => line.props.children)).toEqual(['Podeli']);
    // Disabled wins over destructive: grey, not a pale red.
    expect(lines('Obriši nacrt').map(line => line.props.children)).toEqual(['Obriši nacrt', 'Prvo ukloni fotografije.']);
    expect(flat(well('Obriši nacrt').props.style).backgroundColor).not.toBe(sys.color.dangerSoft);
    // And a reason on a live row is not drawn: it is for a row that cannot be used.
    await act(async () => tree.unmount());
    await render(<ActionSheet actions={[{ key: 'a', label: 'Otvori', icon: 'person', reason: 'Ne treba.', onPress: jest.fn() }]} onClose={jest.fn()} />);
    expect(lines('Otvori').map(line => line.props.children)).toEqual(['Otvori']);
  });
});

describe('PeekSheet', () => {
  it('peeks over the screen without a backdrop, a modal or a focus trap, detached above the tab bar', async () => {
    const onClose = jest.fn();
    await render(<PeekSheet label="Zadatak na mapi" active onClose={onClose}>{dismiss => <Text testID="card" onPress={dismiss}>Kartica</Text>}</PeekSheet>);
    expect(tree.root.findAllByType('Modal' as unknown as React.ElementType)).toHaveLength(0);
    expect(sheet().props).toMatchObject({ detached: true, bottomInset: sys.space.md, enablePanDownToClose: true, accessibilityLabel: 'Zadatak na mapi' });
    expect(sheet().props.backdropComponent).toBeUndefined();
    await press(byTestId('card')); expect(onClose).toHaveBeenCalledTimes(1);
  });

  const listenBack = () => {
    const listeners: (() => boolean)[] = [], remove = jest.fn();
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean); return { remove };
    });
    return { listeners, remove, spy };
  };

  it('closes on Android Back before the screen under it does, and lets Back go once it is on its way out', async () => {
    const { listeners, remove, spy } = listenBack();
    try {
      const onClose = jest.fn();
      await render(<PeekSheet label="Zadatak na mapi" active onClose={onClose}>{() => <Text>Kartica</Text>}</PeekSheet>);
      let consumed = false;
      await act(async () => { consumed = listeners[0](); });
      expect(consumed).toBe(true); expect(onClose).toHaveBeenCalledTimes(1);
      // The card is closing (still mounted until its screen drops it): the next Back belongs to the screen.
      await act(async () => { consumed = listeners[0](); });
      expect(consumed).toBe(false); expect(onClose).toHaveBeenCalledTimes(1);
      await act(async () => tree.unmount()); expect(remove).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('takes Back only while its own screen is in front', async () => {
    const { listeners, remove, spy } = listenBack();
    try {
      const card = (active: boolean) => <PeekSheet label="Zadatak na mapi" active={active} onClose={jest.fn()}>{() => <Text>Kartica</Text>}</PeekSheet>;
      // A task detail pushed over the map: the hidden card registers nothing, so Back goes to the detail.
      await render(card(false));
      expect(listeners).toHaveLength(0);
      await act(async () => { tree.update(card(true)); });
      expect(listeners).toHaveLength(1);
      await act(async () => { tree.update(card(false)); });
      expect(remove).toHaveBeenCalledTimes(1); expect(listeners).toHaveLength(1);
    } finally { spy.mockRestore(); }
  });

  it('appears without motion under reduced motion', async () => {
    mockReduced = true;
    await render(<PeekSheet label="Zadatak na mapi" active onClose={jest.fn()}>{() => <Text>Kartica</Text>}</PeekSheet>);
    expect(sheet().props).toMatchObject({ animateOnMount: false, animationConfigs: { duration: 0 } });
  });

  // Plan 2.20: the card leaves like every sheet when a command closes it: 170 ms on the decelerating curve, or at once.
  it('closes on the sheets\' own short timing when a command closes it, and at once under reduced motion', async () => {
    const close = jest.spyOn((BottomSheet as unknown as { prototype: { close: (config?: unknown) => void } }).prototype, 'close');
    try {
      const card = () => <PeekSheet label="Zadatak na mapi" active onClose={jest.fn()}>{dismiss => <Text testID="card" onPress={dismiss}>Kartica</Text>}</PeekSheet>;
      await render(card());
      expect(sheet().props.animationConfigs).toBe(sys.motion.sheetSpring);
      await press(byTestId('card'));
      expect(close).toHaveBeenLastCalledWith({ duration: sys.motion.sheetClose, easing: expect.anything() });
      await act(async () => tree.unmount());
      mockReduced = true; close.mockClear();
      await render(card());
      await press(byTestId('card'));
      expect(close).toHaveBeenLastCalledWith({ duration: 0 });
    } finally { close.mockRestore(); }
  });

  // Discovery V47: the pin card is one floating card with its own ×, 16 dp in from both edges.
  it('floats 16 dp in from both edges, and a card with its own × can leave the grab bar out and keep its top padding', async () => {
    await render(<PeekSheet label="Zadatak na mapi" active onClose={jest.fn()}>{() => <Text>Kartica</Text>}</PeekSheet>);
    expect(flat(sheet().props.style)).toMatchObject({ marginHorizontal: sys.space.base });
    expect(sheet().props.handleComponent).toEqual(expect.any(Function));
    await act(async () => tree.unmount());
    await render(<PeekSheet label="Zadatak na mapi" active handle={false} onClose={jest.fn()}>{() => <Text>Kartica</Text>}</PeekSheet>);
    expect(sheet().props.handleComponent).toBeNull();
    expect(sheet().props.enablePanDownToClose).toBe(true);
    // Without the handle's 20 px above it, the content keeps the card's own padding at the top.
    expect(flat(tree.root.findByType(BottomSheetView).props.style)).toMatchObject({ paddingTop: sys.space.base, paddingBottom: sys.space.base });
  });
});
