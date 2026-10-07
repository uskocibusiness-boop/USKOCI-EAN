import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { pinLabel, type MarketplaceItem } from '../../../data/marketplaceView';
import { needScheduleText, readableTitle } from '../../../data/needDetailPresentation';
import { displaysUrgent } from '../../../lib/needUrgency';
import { Press } from '../../Press';
import { T } from '../../Text';
import { PEEK_MAX_SHARE, PeekSheet } from '../../system/PeekSheet';
import { ChromeIconButton, chrome } from '../../system/ScreenChrome';
import { FactArt } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { CalendarArt } from '../../system/CalendarArt';
import { zadataka } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { sys } from '../../system/tokens';
import { useUrgencyClock } from '../NeedUrgencyBadge';
import { CardBriefFoot, CardDecision, CardTitle, CardFact, CardPerson, CardPlaces, CardStatus, personSpoken, placesText, taskPlace, taskSpoken,
  taskStatus, taskValue, type TaskCardRelation } from '../TaskFace';
import { TaskPublisherPortrait } from '../TaskPublisherPortrait';
import { V2Action } from '../V2Action';

/** Rows a place shows in its card; a place with more offers the whole set in the list. Large text may scroll within the card. */
export const PLACE_ROWS = 3;
/** What the PeekSheet draws around a place's rows: its `base` padding above and under them (the card has no handle). */
const PEEK_FRAME = 2 * sys.space.base;
/** The × sits this far in from the card's top-right corner, clear of its rounded edge. */
const CLOSE_INSET = sys.space.sm;
/**
 * How much of the window the pin card may take once the words are large (text size 1.3 and up): its title, place and
 * time, price and poster then need more than the half every other card gets, and a card that is cut off hides the very
 * facts it is for. At the usual text size it keeps the half.
 */
export const PIN_CARD_LARGE_SHARE = 0.75;

/** A task's price as words beside its name in a place's rows: money in the money colour, anything else never so. */
function PriceWords({ item }: { item: MarketplaceItem }) {
  const label = pinLabel(item);
  return label.tone === 'money' ? <T variant="priceRow" style={s.money}>{label.spoken}</T>
    : <T variant="note" tone="muted" style={s.word}>{label.tone === 'offer' ? 'Tražim ponude' : 'Cena nije navedena'}</T>;
}

/**
 * One chosen task on the map (Discovery V47, the Airbnb pattern in USKOČI's look). The whole card is one press that opens
 * the task ("Otvori zadatak: …"), and its round × top right closes it. It says, bare (it is the card, never a card inside
 * one): HITNO or "Prijava poslata" when they apply, a full title with its shared value/capacity group, illustrated
 * place/time rows, and who posted it with the honest rating when the read has them. The title clears the close control and the
 * body follows the list card's reading order. No photo:
 * a task's photos are shown only inside the task (owner, 2026-09-24), and nothing is invented.
 */
function PinTask({ item, relation, onOpen, onLayout }: {
  item: MarketplaceItem; relation?: TaskCardRelation; onOpen: () => void; onLayout: (event: LayoutChangeEvent) => void;
}) {
  const large = useTextScale() >= 1.3;
  const title = readableTitle(item.naslov);
  const status = taskStatus(item, relation);
  const owned = relation === 'OWNED';
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  // The task's own time in the one time format ("24. sep · 12:00–19:00"): a window or a flexible range keeps both ends.
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const publisher = !owned && 'narucilacIme' in item && typeof item.narucilacIme === 'string' ? item.narucilacIme.trim() : '';
  const person = 'narucilacIme' in item && publisher ? <CardPerson name={publisher} rating={item.narucilacOcena}
    count={item.narucilacBrojOcena} size={40} portrait={<TaskPublisherPortrait item={item} size={40} />} /> : null;
  const places = item.pokrivenost ? placesText(item.pokrivenost, owned ? 'owner' : 'worker', 'fraction') : null;
  const spoken = taskSpoken({ status: status?.text, urgent, value, place: place.text, schedule, places: places?.spoken,
    person: 'narucilacIme' in item && publisher ? personSpoken(publisher, item.narucilacOcena, item.narucilacBrojOcena) : null });
  const head = status || urgent;
  return <View style={s.pin} onLayout={onLayout}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}`} accessibilityValue={{ text: spoken }}
      haptic="select" scaleTo={sys.motion.scale.row} onPress={onOpen} style={s.pinBody}>
      {head ? <View style={[s.clearOfClose, s.closeClearance]}><CardStatus status={status} urgency={item.urgency} now={urgencyNow} /></View> : null}
      <View style={s.summary}>
        <View style={!head ? [s.clearOfClose, s.closeClearance] : undefined}><CardTitle title={title} lines={0} /></View>
        <CardDecision value={value} large={large}
          places={item.pokrivenost ? <CardPlaces places={item.pokrivenost} audience={owned ? 'owner' : 'worker'} display="fraction" large={large} /> : null} />
      </View>
      <View style={s.facts}>
        <CardFact art={<FactArt kind={place.remote ? 'remote' : 'pin'} size={28} cut="art" role="location" />}
          text={place.text} lines={2} artSize={28} />
        <CardFact art={<CalendarArt size={28} />} text={schedule} lines={2} artSize={28} />
      </View>
      {person ? <CardBriefFoot person={person} large={large} places={null} /> : null}
    </Press>
  </View>;
}

/**
 * The card of a chosen pin (Zadaci, 2026-09-24; Discovery V47): ONE floating card, 16 dp in from both edges, just above
 * the tab bar, over the list sheet's top line (which steps out of sight behind it while it shows). A single task is
 * `PinTask`; several tasks on one point say how many and list them as rows, each opening its own task ("Pogledaj
 * zadatak"), up to three, with the whole set offered in the list. ×, a swipe down and Android Back close it; under reduced
 * motion it appears without moving. Every opening goes through the screen's own guarded `onOpen`. Its opening is said
 * to a screen reader (the map stays where the focus was, so nothing else would tell it that a card came up). At large
 * text it may take more of the window than other cards rather than be cut off.
 */
export function DiscoveryPeek({ item, place, relation, active, bottomInset, reduced, maxHeight, onOpen, onShowPlace, onClose, onHeight }: {
  /** The chosen task, or null when a place with several tasks is chosen. */ item: MarketplaceItem | null;
  /** The tasks on the chosen place, in the list's order. */ place: readonly MarketplaceItem[];
  relation: (item: MarketplaceItem) => TaskCardRelation | undefined;
  active: boolean; bottomInset: number; reduced: boolean;
  /** Available map space below search and attribution; the existing scroll keeps a taller preview reachable. */
  maxHeight?: number;
  onOpen: (item: MarketplaceItem) => void;
  /** Shows every task of the chosen place in the list. */ onShowPlace: () => void;
  onClose: () => void;
  /** The card's whole height once it is laid out (never more than the PeekSheet allows), so the map's controls clear it. */
  onHeight?: (height: number) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const preferredShare = useTextScale() >= 1.3 ? PIN_CARD_LARGE_SHARE : PEEK_MAX_SHARE;
  const share = maxHeight !== undefined && Number.isFinite(maxHeight) && maxHeight > 0 && windowHeight > 0
    ? Math.min(preferredShare, maxHeight / windowHeight) : preferredShare;
  const cap = Math.round(windowHeight * share);
  const measuredHeight = useRef<number | null>(null);
  useEffect(() => {
    // A resized map can change the viewport without laying out the unchanged content again.
    if (measuredHeight.current !== null) onHeight?.(Math.min(measuredHeight.current, cap));
  }, [cap, onHeight]);
  // One card per choice (the screen keys it by the task or the place), so this runs once for each card that comes up.
  const opened = item ? `Pregled zadatka: ${readableTitle(item.naslov)}` : `${zadataka(place.length)} na ovom mestu`;
  useEffect(() => { AccessibilityInfo.announceForAccessibility?.(opened); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The single card reaches the sheet's edges itself (its whole face is the press); a place's rows sit in its padding.
  const measureCard = (event: LayoutChangeEvent) => {
    const whole = Math.ceil(event.nativeEvent.layout.height);
    if (whole > 0) { measuredHeight.current = whole; onHeight?.(Math.min(whole, cap)); }
  };
  const measureRows = (event: LayoutChangeEvent) => {
    const content = Math.ceil(event.nativeEvent.layout.height);
    if (content > 0) { measuredHeight.current = PEEK_FRAME + content; onHeight?.(Math.min(PEEK_FRAME + content, cap)); }
  };
  return <PeekSheet label={item ? 'Zadatak na mapi' : 'Zadaci na ovom mestu'} active={active} bottomInset={bottomInset} reduced={reduced}
    handle={false} maxShare={share} onClose={onClose} scrollable
    overlay={dismiss => <View style={s.close}><ChromeIconButton label={item ? 'Zatvori pregled zadatka' : 'Zatvori pregled zadataka'}
      glyph="close" onPress={dismiss} /></View>}>
    {() => item ? <PinTask item={item} relation={relation(item)} onOpen={() => onOpen(item)} onLayout={measureCard} />
      : <View style={s.stack} onLayout={measureRows}>
        <View style={[s.head, s.clearOfClose]}>
          <T variant="heading" accessibilityRole="header" style={s.title}>{`${zadataka(place.length)} na ovom mestu`}</T>
        </View>
        {place.slice(0, PLACE_ROWS).map(task => <Press key={task.id} accessibilityRole="button" accessibilityLabel={`Pogledaj zadatak ${readableTitle(task.naslov)}`}
          haptic="select" scaleTo={sys.motion.scale.row} onPress={() => onOpen(task)} style={s.row}>
          <View style={s.grow}>
            <T variant="cardTitleCompact" style={s.rowTitle} numberOfLines={2}>{readableTitle(task.naslov)}</T>
            {taskStatus(task, relation(task)) ? <T variant="note" tone="muted">{taskStatus(task, relation(task))!.text}</T> : null}
            <T variant="note" tone="muted" numberOfLines={1}>{task.schedule ? needScheduleText(task.schedule, task.taskTimezone) : task.vremeTekst}</T>
          </View>
          <PriceWords item={task} />
          <Glyph name="caret-right" size={20} tone="muted" />
        </Press>)}
        {place.length > PLACE_ROWS ? <V2Action label="Prikaži sve u listi" kind="quiet" onPress={onShowPlace} /> : null}
      </View>}
  </PeekSheet>;
}

const s = StyleSheet.create({
  stack: { gap: sys.space.md },
  grow: { flex: 1, minWidth: 0 },
  // The single card's face spans the whole card, its padding included, so every part of it opens the task. Its lines
  // are as far apart as a task card's.
  pin: { margin: -sys.space.base },
  pinBody: { padding: sys.space.base, gap: sys.space.base, borderRadius: sys.radius.card },
  // The first line keeps clear of the × in the corner (one chrome control wide).
  clearOfClose: { marginRight: chrome.control },
  // The first row must clear the whole close target before any following full-width text or value/capacity.
  closeClearance: { minHeight: chrome.control },
  summary: { gap: sys.space.sm },
  facts: { gap: sys.space.sm },
  close: { position: 'absolute', top: CLOSE_INSET, right: CLOSE_INSET },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: chrome.control },
  title: { flex: 1, color: sys.color.ink },
  // A row inside the card is a flat tint at the control corner, never another card.
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 64, paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  rowTitle: { color: sys.color.ink },
  money: { color: sys.color.money },
  word: { maxWidth: 110, textAlign: 'right' },
});
