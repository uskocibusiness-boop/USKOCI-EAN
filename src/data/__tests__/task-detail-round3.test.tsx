import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction, sys } from '../../ui/system/tokens';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import type { SheetAction } from '../../ui/system/ActionSheet';

let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { applyClosedReason, PublicNeedPresentation } from '../../ui/v2/PublicNeedPresentation';
import { NeedPresentation } from '../../ui/v2/NeedPresentation';

/**
 * Task detail, pass 3 (owner step 5b, 2026-09-24): the task's name comes into the bar when its large title has scrolled
 * away, a stranger's task reads its facts and its poster together, says why applying is not possible, and keeps its
 * rare action behind "···"; my own task keeps every change behind "···" and the lifecycle's outcome under its title.
 */
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); mockReduced = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string'));
const joined = () => texts().join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label);
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const menuItems = () => presses().filter(node => node.props.accessibilityRole === 'menuitem');
const openMenu = async () => { await act(async () => byLabel('Više radnji')!.props.onPress()); };
const noop = () => {};

// The scrolled title: the large title reports where it ends, the scroll crosses that line, the bar shows the name.
const heroTitle = () => tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.accessibilityRole === 'header'
  && typeof node.props.onLayout === 'function')[0];
const heroBlock = () => tree.root.findAll(node => node.type === ('View' as React.ElementType) && typeof node.props.onLayout === 'function')
  .find(block => block.findAll(node => node === heroTitle()).length > 0)!;
const barTitle = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'chrome-title')[0];
const scroller = () => tree.root.findByType('ScrollView' as React.ElementType);
const layout = async (node: ReactTestInstance, y: number, height: number) => {
  await act(async () => node.props.onLayout({ nativeEvent: { layout: { x: 0, y, width: 360, height } } }));
};
const scrollTo = async (y: number) => { await act(async () => scroller().props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } })); };
const shown = () => barTitle().props.accessibilityElementsHidden === false;

const task: PrilikaProjekcija = { id: 'need', naslov: 'Selidba stana', statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null,
  podrucjeTekst: 'Beograd, Vračar', vremeTekst: 'Sutra ujutru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: ['Kombi'],
  narucilacProfilId: 'profile-1', narucilacIme: 'Ana Anić', narucilacOcena: '4,8', priblizno: { lat: 44.8, lng: 20.47 }, rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 9000, valuta: 'RSD', prikaz: '9.000 RSD' }, opis: 'Dva sprata bez lifta.' };
function Stranger(props: Partial<React.ComponentProps<typeof PublicNeedPresentation>>) {
  return <PublicNeedPresentation need={task} loading={false} error={false} missing={false} stale={false} busy={false} canApply canRetry
    relation={{ kind: 'NONE' }} onOwnTask={noop} onOwnApplication={noop} back={noop} retry={noop} apply={noop} {...props} />;
}

describe('a stranger\'s task', () => {
  it('brings the task\'s name into the bar only once the large title has scrolled past its own measured end', async () => {
    await render(<Stranger />);
    expect(scroller().props.scrollEventThrottle).toBe(16);
    // The bar holds the name from the start, hidden from the eye and from a screen reader.
    expect(barTitle().findByType('T' as React.ElementType).props.children).toBe('Selidba stana');
    expect(shown()).toBe(false);
    // Three lines of title at a large font end at 4 + 40 + 96 = 140, far below a fixed guess.
    await layout(heroBlock(), 4, 136); await layout(heroTitle(), 40, 96);
    await scrollTo(100); expect(shown()).toBe(false);
    await scrollTo(141); expect(shown()).toBe(true);
    await scrollTo(0); expect(shown()).toBe(false);
  });

  it('fades the name in with the chrome\'s one short fade, and simply shows it under reduced motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<Stranger />);
    await layout(heroBlock(), 4, 40); await layout(heroTitle(), 0, 40);
    await scrollTo(60);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: sys.motion.toggle }));
    await act(async () => tree.unmount());
    timing.mockClear(); mockReduced = true;
    await render(<Stranger />);
    await layout(heroBlock(), 4, 40); await layout(heroTitle(), 0, 40);
    await scrollTo(60);
    expect(timing).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(barTitle().props.style).opacity).toBe(1); expect(shown()).toBe(true);
  });

  it('reads genuine photos, compact terms, then who posted it, then the work and the questions about it, and the place', async () => {
    await render(<Stranger photos={<T>FOTOGRAFIJE</T>} map={<T>MAPA</T>} qa={<T>PITANJA</T>}
      publicPhoto={(_id, size) => <T>{`FOTO ${size}`}</T>} />);
    const all = texts();
    const at = (value: string) => all.findIndex(text => text.includes(value));
    // Owner, 2026-10-07: what was asked about the work, and what its owner answered, is read right after the work.
    // Owner, 8 Oct 2026 (the pick "Objavio kao kartica poverenja"): who posted it stands right under what, where and when.
    // The page reads: name, the one amount, where, when, how many, who posted it, what the work is, what it asks, the questions, where it is.
    const order = ['Selidba stana', 'FOTOGRAFIJE', '9.000 RSD', 'Beograd, Vračar', 'Sutra ujutru', '0/2',
      'Ana Anić', 'Dva sprata bez lifta.', 'Kombi', 'PITANJA', 'Mesto', 'MAPA'].map(at);
    // The bar's hidden copy of the name comes first in the tree; the order is read from the large title on.
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // R13 gives the real publisher a readable portrait without changing the role or rating facts.
    expect(all).toContain('FOTO 56'); expect(all).toContain('4,8');
    // No rating is invented when the server has none.
    await act(async () => tree.update(<Stranger need={{ ...task, narucilacOcena: null }} />));
    expect(texts()).toContain('Ocena nije dostupna');
    // R27: the rating says how many reviews it stands on, "Još nema ocena" when there are none, and never a count that was not read.
    await act(async () => tree.update(<Stranger need={{ ...task, narucilacOcena: '4,7', narucilacBrojOcena: 3 }} />));
    expect(texts()).toContain('4,7 · 3 ocene');
    await act(async () => tree.update(<Stranger need={{ ...task, narucilacOcena: null, narucilacBrojOcena: 0 }} />));
    expect(texts()).toContain('Još nema ocena');
  });

  it.each<{ name: string; patch: Partial<PrilikaProjekcija>; value: string; note: string | null; amount: boolean }>([
    { name: 'whole-task price', patch: { osnovaCene: 'TOTAL' }, value: '9.000 RSD', note: 'Ukupno za ceo zadatak', amount: true },
    { name: 'per-person price', patch: { osnovaCene: 'PER_PERSON' }, value: '9.000 RSD', note: 'Po osobi · ukupno 18.000 RSD', amount: true },
    { name: 'offers', patch: { rezimCene: 'OFFERS', osnovaCene: 'PER_PERSON', ponudjenaCena: undefined },
      value: 'Tražim ponude', note: 'Ukupan iznos predlažeš u prijavi.', amount: false },
    { name: 'missing price', patch: { osnovaCene: 'TOTAL', ponudjenaCena: undefined }, value: 'Cena nije navedena', note: null, amount: false },
  ])('keeps $name truthful and complete in the promoted terms', async ({ patch, value, note, amount }) => {
    await render(<Stranger need={{ ...task, ...patch }} />);
    const copy = texts();
    expect(copy.filter(text => text === value)).toHaveLength(1);
    // The one amount comes right after the name, before where, when and how many.
    expect(copy.indexOf(value)).toBeGreaterThan(copy.indexOf('Selidba stana'));
    expect(copy.indexOf(value)).toBeLessThan(copy.indexOf('Beograd, Vračar'));
    expect(copy.indexOf(value)).toBeLessThan(copy.indexOf('Ana Anić'));
    const label = `Cena: ${value}${note ? `, ${note}` : ''}`;
    expect(tree.root.findAll(node => node.type === ('View' as React.ElementType) && node.props.accessibilityLabel === label)).toHaveLength(1);
    if (note) expect(copy).toContain(note);
    else expect(copy).not.toContain('Ukupno za ceo zadatak');
    const terms = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === value)[0];
    expect(StyleSheet.flatten(terms.props.style).color).toBe(amount ? sys.color.money : sys.color.ink);
  });

  it('puts the poster in one record with a face of 56, and keeps the record one touch target', async () => {
    const open = jest.fn();
    await render(<Stranger onRequesterProfile={open} />);
    const row = byLabel('Ana Anić, Ocena 4,8')!;
    // The person is the page's main person (the owner's pick of 8 Oct 2026): the one record of the page, a thing that is touched, with a face of 56 as a sticker.
    expect(row.props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ borderRadius: sys.radius.card });
    expect(row.props.accessibilityHint).toBe('Otvara javni profil');
    const faces = row.findAll(node => node.type === ('View' as React.ElementType) && StyleSheet.flatten(node.props.style)?.width === 56 && StyleSheet.flatten(node.props.style)?.height === 56);
    // The sticker's own circle (the Avatar draws one of the same size inside it).
    expect(faces.length).toBeGreaterThanOrEqual(1);
    expect(StyleSheet.flatten(faces[0].props.style)).toMatchObject({ overflow: 'hidden', borderRadius: sys.radius.pill });
    await act(async () => row.props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  });

  // "Dolazi kako je dogovoreno" is the server's own percentage, drawn under the rating only when the route hands it in; nothing is drawn, and nothing said, without it.
  it('says how reliably the poster comes as agreed only when the server gives the percentage', async () => {
    await render(<Stranger />);
    expect(joined()).not.toContain('Dolazi kako je dogovoreno');
    await act(async () => tree.update(<Stranger reliabilityPercent={90} onRequesterProfile={noop} />));
    expect(texts()).toContain('Dolazi kako je dogovoreno · 90%');
    expect(byLabel('Ana Anić, Ocena 4,8, Dolazi kako je dogovoreno · 90%')).toBeDefined();
    await act(async () => tree.update(<Stranger reliabilityPercent={null} />));
    expect(joined()).not.toContain('Dolazi kako je dogovoreno');
  });

  it('says why applying is not possible in one muted line beside a quiet way on, never with the brand action', async () => {
    const other = jest.fn();
    await render(<Stranger canApply={false} need={{ ...task, pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }} onOtherTasks={other} />);
    expect(texts()).toContain('Sva mesta su popunjena');
    expect(brand()).toEqual([]); expect(byLabel('Pošalji prijavu')).toBeUndefined(); expect(byLabel('Pošalji ponudu')).toBeUndefined();
    const way = byLabel('Drugi zadaci')!;
    expect(surfaceOf(way.props.style)).toBe('transparent');
    expect(StyleSheet.flatten(way.props.style).minHeight).toBeGreaterThanOrEqual(48);
    await act(async () => way.props.onPress()); expect(other).toHaveBeenCalledTimes(1);
    // A deadline the route says has passed is named with its day.
    await act(async () => tree.update(<Stranger canApply={false} deadlinePassed need={{ ...task, rokZaPrijaveIso: '2026-09-24T10:00:00Z' }} onOtherTasks={other} />));
    expect(joined()).toMatch(/Rok za prijave je prošao 24\. sep( 2026)?(?! ·)/);
    // Otherwise the task's own gate: it may open again, so the line says no more than that.
    await act(async () => tree.update(<Stranger canApply={false} need={{ ...task, rokZaPrijaveIso: '2026-09-24T10:00:00Z' }} onOtherTasks={other} />));
    expect(texts()).toContain('Nove prijave trenutno nisu dostupne'); expect(joined()).not.toContain('Rok za prijave');
  });

  // The owner, 8 Oct 2026: only the green button at the foot (no amount and no time beside it), and its words say what is being sent: a task with a fixed price
  // is applied to ("Pošalji prijavu"), a task with none is answered with an offer ("Pošalji ponudu"). Either opens the form; it sends nothing.
  it('keeps the footer chosen by what I am to the task, and "Pošalji prijavu" or "Pošalji ponudu" as the one action when I can apply', async () => {
    await render(<Stranger canApply={false} relation={{ kind: 'APPLIED', applicationId: 'a1', agreementId: null }} onOtherTasks={noop} />);
    expect(byLabel('Pogledaj svoju prijavu')).toBeDefined(); expect(byLabel('Drugi zadaci')).toBeUndefined();
    expect(joined()).not.toMatch(/Nove prijave|Sva mesta|Rok za prijave/);
    const apply = jest.fn();
    await act(async () => tree.update(<Stranger apply={apply} />));
    expect(brand()).toEqual(['Pošalji prijavu']); expect(byLabel('Drugi zadaci')).toBeUndefined();
    await act(async () => byLabel('Pošalji prijavu')!.props.onPress()); expect(apply).toHaveBeenCalledTimes(1);
    // The foot holds the button alone: the amount and the time are said once, in the page, and not again beside the button.
    expect(texts().filter(text => text === '9.000 RSD')).toHaveLength(1); expect(texts().filter(text => text === 'Sutra ujutru')).toHaveLength(1);
    for (const patch of [{ rezimCene: 'OFFERS', ponudjenaCena: undefined }, { rezimCene: 'MY_PRICE', ponudjenaCena: undefined }, { rezimCene: 'OFFERS' }] as Partial<PrilikaProjekcija>[]) {
      await act(async () => tree.update(<Stranger need={{ ...task, ...patch }} />));
      expect(brand()).toEqual(['Pošalji ponudu']);
    }
    await act(async () => tree.update(<Stranger need={{ ...task, rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON' }} />));
    expect(brand()).toEqual(['Pošalji prijavu']);
  });

  it('offers reporting the person who posted it behind "···", runs it once the menu has gone, and says when it fails', async () => {
    const report = jest.fn();
    await render(<Stranger safety={{ onPress: report, busy: false, error: null }} />);
    await openMenu();
    const rows = menuItems();
    // Updated in the review of step 5b: the row names the person, because beside "Pošalji prijavu" a bare "Prijavi"
    // reads as "apply". It was "Prijavi ili blokiraj".
    expect(rows.map(row => row.props.accessibilityLabel)).toEqual(['Prijavi ili blokiraj osobu']);
    expect(StyleSheet.flatten(rows[0].findByType('T' as React.ElementType).props.style).color).toBe(sys.color.danger);
    await act(async () => rows[0].props.onPress());
    expect(report).toHaveBeenCalledTimes(1); expect(menuItems()).toHaveLength(0);
    await act(async () => tree.update(<Stranger safety={{ onPress: report, busy: false, error: 'Korisnik trenutno nije dostupan.' }} />));
    expect(texts()).toContain('Korisnik trenutno nije dostupan.');
    // With the person's profile open, its sheet says the failure itself; the line under the poster would repeat it and
    // announce from behind the sheet.
    await act(async () => tree.update(<Stranger safety={{ onPress: report, busy: false, error: 'Korisnik trenutno nije dostupan.' }}
      requesterProfile={{ loading: true, data: null }} onCloseRequesterProfile={noop} />));
    expect(tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.tone === 'danger'
      && node.props.children === 'Korisnik trenutno nije dostupan.')).toHaveLength(0);
    // My own task has nobody to report, and without a safety entry there is nothing rare: no "···" is drawn.
    await act(async () => tree.update(<Stranger relation={{ kind: 'OWNER' }} safety={{ onPress: report, busy: false, error: null }} />));
    expect(byLabel('Više radnji')).toBeUndefined();
    await act(async () => tree.update(<Stranger />));
    expect(byLabel('Više radnji')).toBeUndefined();
  });
});

describe('why applying is not possible', () => {
  it('names full places first, then a passed deadline, then the task\'s own gate; a deadline is never guessed', () => {
    const base = { pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, rokZaPrijaveIso: '2026-09-24T10:00:00Z' };
    expect(applyClosedReason({ ...base, pokrivenost: { ...base.pokrivenost, preostalo: 0 } }, true)).toBe('Sva mesta su popunjena');
    expect(applyClosedReason(base, true)).toMatch(/^Rok za prijave je prošao 24\. sep( 2026)?$/);
    expect(applyClosedReason(base, false)).toBe('Nove prijave trenutno nisu dostupne');
    expect(applyClosedReason({ ...base, rokZaPrijaveIso: 'invalid' }, true)).toBe('Nove prijave trenutno nisu dostupne');
    expect(applyClosedReason({ ...base, rokZaPrijaveIso: null }, true)).toBe('Nove prijave trenutno nisu dostupne');
  });
});

const mine = (patch: Partial<PotrebaProjekcija> = {}): PotrebaProjekcija => ({ id: 'need', revizija: 3, naslov: 'Prenos ormara', opis: 'Ormar sa trećeg sprata.',
  stanje: 'OBJAVLJENA', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra', podrucjeTekst: 'Novi Sad, Liman', uslovi: [],
  brojPrijava: 0, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' }, ...patch });
function Own({ value, busy = false, remainingClosed = false, lifecycleMenu, lifecycleActions, onEdit = noop, onCloseRemaining = noop }: {
  value: PotrebaProjekcija; busy?: boolean; remainingClosed?: boolean; lifecycleMenu?: SheetAction[]; lifecycleActions?: React.ReactNode;
  onEdit?: () => void; onCloseRemaining?: () => void;
}) {
  return <NeedPresentation need={value} loading={false} error={null} busy={busy} remainingClosed={remainingClosed} lifecycleMenu={lifecycleMenu}
    lifecycleActions={lifecycleActions} onBack={noop} onRefresh={noop} onReview={noop} onEdit={onEdit} onCloseRemaining={onCloseRemaining} onCandidates={noop} />;
}
const cancelRow = (onPress: () => void): SheetAction => ({ key: 'cancel', label: 'Otkaži zadatak', icon: 'tasks', destructive: true, onPress });

describe('my own task', () => {
  it('brings its name into the bar on scroll, as a stranger\'s task does', async () => {
    await render(<Own value={mine()} />);
    await layout(heroBlock(), 4, 100); await layout(heroTitle(), 0, 60);
    await scrollTo(50); expect(shown()).toBe(false);
    await scrollTo(70); expect(shown()).toBe(true);
  });

  it('keeps every change of the task behind "···": no "Upravljanje zadatkom" section, and each row reaches its own callback', async () => {
    const edit = jest.fn(), cancel = jest.fn();
    await render(<Own value={mine()} onEdit={edit} lifecycleMenu={[cancelRow(cancel)]} />);
    expect(joined()).not.toContain('Upravljanje zadatkom');
    expect(byLabel('Izmeni zadatak')).toBeUndefined(); expect(byLabel('Otkazivanje zadatka')).toBeUndefined();
    await openMenu();
    expect(menuItems().map(row => row.props.accessibilityLabel)).toEqual(['Izmeni zadatak', 'Otkaži zadatak']);
    await act(async () => menuItems()[0].props.onPress()); expect(edit).toHaveBeenCalledTimes(1); expect(cancel).not.toHaveBeenCalled();
    await openMenu();
    const destructive = menuItems()[1];
    expect(StyleSheet.flatten(destructive.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.danger);
    await act(async () => destructive.props.onPress()); expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('puts closing the remaining search last, in the danger colour, and states a closed search in the state line', async () => {
    const close = jest.fn(), agreements = jest.fn();
    const partly = mine({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(<Own value={partly} onCloseRemaining={close}
      lifecycleMenu={[{ key: 'agreements', label: 'Otvori moje Dogovore', icon: 'agreements', onPress: agreements }]} />);
    await openMenu();
    expect(menuItems().map(row => row.props.accessibilityLabel)).toEqual(['Otvori moje Dogovore', 'Ne traži više nikoga']);
    expect(menuItems()[1].props.accessibilityHint).toBe('Dogovoreno je 1 od 2. Zatvara potragu za preostala mesta.');
    await act(async () => menuItems()[1].props.onPress()); expect(close).toHaveBeenCalledTimes(1);
    // Closed early, a task is never "Sva mesta su dogovorena", whatever state the server maps it to.
    await act(async () => tree.update(<Own value={{ ...partly, stanje: 'POPUNJENA' }} remainingClosed />));
    expect(joined()).toContain('1 od 2 dogovoreno · preostala potraga je zatvorena'); expect(joined()).not.toContain('Sva mesta su dogovorena');
  });

  it('says a closed search in every state that has one, also when a cancelled Dogovor brought the agreed count back to 0', async () => {
    // Review of step 5b: the task then read "Objavljen" or "Čeka prijave" and nothing said that nobody can apply.
    for (const stanje of ['OBJAVLJENA', 'CEKA_PRIJAVE'] as const) {
      await render(<Own value={mine({ stanje })} remainingClosed />);
      expect(joined()).toContain('0 od 2 dogovoreno · preostala potraga je zatvorena');
      await act(async () => tree.unmount());
    }
    // An open search says nothing more than the state; a draft and a closed task have no search to speak of.
    await render(<Own value={mine()} />);
    expect(joined()).not.toContain('preostala potraga');
    for (const stanje of ['NACRT', 'ZATVORENA'] as const) {
      await act(async () => tree.update(<Own value={mine({ stanje })} remainingClosed />));
      expect(joined()).not.toContain('preostala potraga');
    }
  });

  it('draws no "···" when nothing can be changed, and a disabled one while an action runs', async () => {
    await render(<Own value={mine({ stanje: 'ZATVORENA' })} />);
    expect(byLabel('Više radnji')).toBeUndefined();
    await act(async () => tree.update(<Own value={mine()} busy />));
    expect(byLabel('Više radnji')!.props.disabled).toBe(true);
  });

  it('shows what happened to a sent command under the title, before the facts, never inside the menu', async () => {
    await render(<Own value={mine()} lifecycleActions={<T>ISHOD KOMANDE</T>} />);
    const all = texts(), at = (value: string) => all.lastIndexOf(value);
    expect(at('Prenos ormara')).toBeLessThan(at('ISHOD KOMANDE'));
    expect(at('ISHOD KOMANDE')).toBeLessThan(all.indexOf('4.000 RSD'));
  });

  it('reads the questions people asked right after the work, where a stranger finds them, and before the place', async () => {
    // Owner, 2026-10-07: the questions were a link at the very end; the section now sits with the work.
    await render(<NeedPresentation need={mine()} loading={false} error={null} busy={false} remainingClosed={false} onBack={noop} onRefresh={noop}
      onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} map={<T>MAPA</T>} qaAction={<T>PITANJA</T>} />);
    const all = texts(), at = (value: string) => all.findIndex(text => text.includes(value));
    const order = ['Prenos ormara', 'Ormar sa trećeg sprata.', 'PITANJA', 'Mesto zadatka', 'MAPA'].map(at);
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Without a section handed in, the slot draws nothing at all.
    await act(async () => tree.update(<NeedPresentation need={mine()} loading={false} error={null} busy={false} remainingClosed={false} onBack={noop}
      onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} map={<T>MAPA</T>} />));
    expect(joined()).not.toContain('PITANJA');
  });
});

// A plain host element for content handed in by a caller.
function T({ children }: { children: React.ReactNode }) { return React.createElement('T', null, children); }
