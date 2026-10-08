import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Arrive } from './Arrive';
import { BALANCED_LINES, balancedStyle } from './balanced';
import { ConversationArt } from './ConversationArt';
import { FactArt, type FactArtKind } from './FactArt';
import { SkeletonList, type SkeletonVariant } from './Skeleton';
import { brandAction, sys } from './tokens';

export type StateKind = 'empty' | 'loading' | 'error' | 'offline' | 'uncertain';
export type StateAction = {
  label: string; onPress: () => void; accessibilityLabel?: string;
  /** The action cannot be used now: it greys out. */
  disabled?: boolean;
  /** The screen is already at work on it (a read in flight): the action keeps its colour and shows its spinner, and cannot be pressed twice. */
  busy?: boolean;
};

/** The picture each kind uses when the screen does not name one: its own subject for an empty list, a quiet sign otherwise. */
const DEFAULT_ART: Record<Exclude<StateKind, 'loading'>, FactArtKind> = { empty: 'tasks', error: 'info', offline: 'info', uncertain: 'info' };

/**
 * The pictures that say "confirmed" (a tick): `FACT_TICK_KINDS` in `FactArt`, spelled out here and not imported, because twenty suites stand in for
 * `FactArt` with a bare component and a state must still draw under them (`state-view.test.tsx` holds that the two lists are the same).
 */
const SAYS_CONFIRMED: readonly FactArtKind[] = ['check', 'agreements', 'shield'];

/** The picture of a state at the size of a screen (composition spec, rule C: "art 96 prazno stanje"), and in a section of one. */
const ART = 96;
const ART_COMPACT = 48;
/** The measure of the words: the sentence is never wider than this, whatever the screen (T7: "copy ≤ 280 širine"); the actions stand in the same column. */
const MEASURE = 280;

/**
 * Empty, loading, error, offline and unknown outcome in one look (master design plan 2026-09-24; composition spec T7, 2026-10-07; F8b,
 * 2026-10-08): a list that has nothing to show, is still reading, could not read, has no connection or does not know whether a send
 * arrived says so the same way on every screen.
 *
 * THE LOOK. A centred column: the FactArt picture at 96, the title in the `title` type (21), one sentence in `copy` (15, grey, at most 280
 * wide), then at most one green action and one quiet one, stacked. No well and no card around the picture: white, as every reading
 * surface is. The block lies about a third of the way down, not glued to the top: where the screen gives it room (a `flex: 1` parent)
 * a fifth of the free space is above it and four fifths below, which puts the middle of the block at about 38 % of the height of the screen
 * (the golden section from the top, a third and a little more), where the eye rests; where the screen gives none (a list's empty
 * component, a scroll) it stands 48 below what is above it. Error, offline
 * and unknown outcome draw the picture grey and are announced as alerts; an empty list's title is a heading. A failure never wears a
 * picture with a tick (`agreements`, `check`, `shield` say "confirmed"): it falls back to the quiet sign. Everything is centred, so
 * nothing aligns to a left edge, and the block never reaches the screen's gutter (the host pads it).
 *   - loading: the placeholders of what is coming (`Skeleton`, in the shape of a row, a record or a fact) and one quiet sentence a screen
 *     reader hears ("Učitavamo Dogovore…"). No action: nothing can be done while it reads, and nothing spins over the screen.
 *   - `compact`: the same, for a state that stands INSIDE a screen (a section, a sheet, a list under a heading): the picture at 48, the
 *     title in `heading`, no lift, 16 over and under. A state that is the whole screen is not compact.
 *
 * THE RULES. Every state follows them, and `stateProblems` (`stateRules.ts`) holds them as checks a screen's suite can ask.
 *   1. A sentence and one way forward. The title says what is the matter, the copy says why or what will be here, and one action (green)
 *      gets out of it. A second, quiet action is another road (back, edit), never a second green one. Only an empty list that is "done"
 *      may have no action. Error, offline and unknown outcome always have the one button.
 *   2. The copy never repeats the verb of the button. "Proveri vezu i pokušaj ponovo." over a button "Pokušaj ponovo" says it twice: the
 *      sentence describes, the button commands (`outcomeCopy.ts` is the table of lines that already follow this).
 *   3. EMPTY STATES, by why the list is empty (`cause` in the checks):
 *      - `first`, the person has never had one: speaks to a person who has none, never apologises, and says what will be here and how it
 *        starts. Title "Još nemaš zadatak", copy "Reci šta ti treba. Nacrt pregledaš pre objave.", green action "Objavi prvi zadatak" (the
 *        thing that makes the first one, or the road to find one). Never wording about a view ("u ovom prikazu").
 *      - `filtered`, the person has some and what they chose to look at (a filter, a search, a tab, the map's area) leaves none: speaks
 *        about the VIEW, not the person. Title "Nema zadataka u ovom prikazu", copy "Promeni pretragu ili filtere.", green action "Poništi
 *        filtere", which takes the narrowing away. Never "Još nemaš ...": they have things, they are not in this view.
 *      - `done`, everything is dealt with ("Ništa ne čeka tvoju odluku"): a calm statement; it needs no action, and a quiet one may lead
 *        to what comes next.
 *   4. An empty list never looks like a failure, and a failure never looks empty: empty keeps its picture's colours and a heading role;
 *      error, offline and unknown outcome are grey and an alert. "Nepoznato" is never "0" and never an empty list: when the app does not
 *      know whether a send arrived, the state is `uncertain` (`OutcomeUncertain`), with its one button that finds out.
 *   5. Words: "ti", no "ovde" that says where you are, no "Nema podataka", no category shown to people, no "server", no "ishod".
 *
 * Presentation only; every action is the screen's own command.
 */
export type StateViewProps = {
  kind?: StateKind;
  /** The picture; defaults to the kind's own. Not drawn while loading. */ art?: FactArtKind;
  /** One line. While loading it is the quiet sentence under the placeholders. */ title: string;
  /** One sentence under the title. */ body?: string;
  /** The one way forward, drawn as the screen's green action. */ primary?: StateAction;
  /** A second, quieter way. */ quiet?: StateAction;
  /**
   * While loading: how many placeholders, the lines in each, and which shape is coming (a list of rows says `row`, tasks or Dogovori `record`,
   * the facts of a detail `fact`; the older shapes stay as they were). `face`, `heading`, `switches` and `foot` are what `Skeleton` takes.
   */
  skeleton?: { count?: number; rows?: number; variant?: SkeletonVariant; face?: boolean; heading?: boolean; switches?: boolean; foot?: boolean };
  /** The state is inside a section or a sheet, not the whole screen: a smaller picture and title and no lift. */
  compact?: boolean;
  testID?: string;
};

export function StateView({ kind = 'empty', art, title, body, primary, quiet, skeleton, compact = false, testID }: StateViewProps) {
  if (kind === 'loading') return <View testID={testID} accessibilityLiveRegion="polite" style={s.loading}>
    <SkeletonList count={skeleton?.count ?? 3} rows={skeleton?.rows} variant={skeleton?.variant} face={skeleton?.face} heading={skeleton?.heading}
      switches={skeleton?.switches} foot={skeleton?.foot} />
    <T variant="note" tone="muted" style={s.sentence}>{title}</T>
  </View>;
  const trouble = kind !== 'empty';
  const size = compact ? ART_COMPACT : ART;
  // A failure never wears a picture that says "confirmed"; it falls back to the kind's quiet sign.
  const drawn = art === undefined || (trouble && SAYS_CONFIRMED.includes(art)) ? DEFAULT_ART[kind] : art;
  const picture = kind === 'empty' && art === 'chat' ? <ConversationArt size={size} />
    : <FactArt kind={drawn} size={size} muted={trouble} />;
  return <View testID={testID} accessibilityLiveRegion="polite" style={[s.frame, compact ? s.frameCompact : s.frameScreen]}>
    {compact ? null : <View style={s.above} />}
    <View style={s.column}>
      {/* An empty list's picture settles in once (V41's art arrive); a failure's does not, because it is not a thing to be glad of. */}
      <View style={compact ? s.artCompact : s.art}>{kind === 'empty' ? <Arrive>{picture}</Arrive> : picture}</View>
      <T variant={compact ? 'heading' : 'title'} accessibilityRole={trouble ? 'alert' : 'header'} {...BALANCED_LINES} style={[s.title, balancedStyle]}>{title}</T>
      {body ? <T variant={compact ? 'note' : 'copy'} tone="muted" {...BALANCED_LINES} style={[s.copy, balancedStyle]}>{body}</T> : null}
      {primary || quiet ? <View style={s.actions}>
        {primary ? <V2Action label={primary.label} accessibilityLabel={primary.accessibilityLabel} onPress={primary.onPress}
          disabled={primary.disabled} loading={primary.busy} style={brandAction} /> : null}
        {quiet ? <V2Action label={quiet.label} accessibilityLabel={quiet.accessibilityLabel} onPress={quiet.onPress}
          disabled={quiet.disabled} loading={quiet.busy} kind="quiet" /> : null}
      </View> : null}
    </View>
    {compact ? null : <View style={s.below} />}
  </View>;
}

const s = StyleSheet.create({
  loading: { gap: sys.space.base },
  sentence: { textAlign: 'center' },
  // The frame fills a room it is given (a `flex: 1` parent) and is only as tall as its block where it is not. A fifth of the free room is
  // `above` and four fifths `below`, and the 48 over the block is the least it ever stands from what is above it.
  frame: { flexGrow: 1, alignItems: 'center' },
  frameScreen: { paddingTop: sys.space.huge, paddingBottom: sys.space.xxl },
  frameCompact: { paddingVertical: sys.space.base },
  above: { flex: 1 },
  below: { flex: 4 },
  column: { width: '100%', maxWidth: MEASURE, alignItems: 'center' },
  art: { marginBottom: sys.space.base },
  artCompact: { marginBottom: sys.space.md },
  title: { textAlign: 'center', color: sys.color.ink },
  copy: { textAlign: 'center', marginTop: sys.space.sm },
  // The actions fill the column: the green one is the same shape as the foot's, and the quiet one under it is as wide, so the touch is wide.
  actions: { alignSelf: 'stretch', marginTop: sys.space.xl, gap: sys.space.sm },
});
