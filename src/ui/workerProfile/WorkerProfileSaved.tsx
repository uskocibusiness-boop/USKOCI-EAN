import type { ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { cityLabel } from '../profile/cityLabel';
import { FactArt } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { layout, ruleWidth } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { InfoTitle } from '../settings/InfoTitle';
import { SettingsGroup, SettingsRow } from '../settings/SettingsPresentation';
import { V2Action } from '../v2/V2Action';
import { NameDifference, namesDiffer } from './NameDifference';
import type { WorkerDraft } from './workerProfileDraft';
import { skillsLine, toolsAndVehiclesNote } from './workerProfileFacts';

/** The places the saved profile opens: the area and the week of a worker. */
export type SavedProfilePath = '/profil/lokacija' | '/profil/dostupnost';
/** The parts of the profile a row opens the editor of. */
export type SavedProfilePart = 'skills' | 'tools' | 'vehicles';

/** A list this short is said in the row itself; a longer one is a count (12 vehicles were five lines of words, owner's phone, 8 Oct 2026). */
export const KIT_INLINE_MAX = 3;
/** How many kinds of work the row "Šta radiš" draws as chips before it says how many more. */
export const SKILL_CHIPS_MAX = 8;

/** The switch "Mogu odmah": its state, what it does when it is touched, and whether it is saving or the last save failed. The route owns the save. */
export type AvailableNowControl = { value: boolean; onChange: (value: boolean) => void; busy?: boolean; failed?: boolean };

/**
 * The saved work profile, read (M3; arranged as the product draft the owner approved on 8 Oct 2026, P3). It draws no state of its own: the route decides when a
 * profile is read and when it is edited, and what the status line says. What the data is used for ("Na šta utiče") is behind the "ⓘ" in the bar (the route's
 * `HeaderInfo`), the equipment's note behind the "ⓘ" at "Oprema".
 *
 * From the top: the status line; the card "Kako te vide kad uskačeš" (the face, the ACCOUNT's name, the kinds of work, the rating when there is one: what another
 * person sees of the worker, with no grammatical gender); the difference of names when the work profile still carries another one (owner, 8 Oct 2026: one name for
 * everything, `NameDifference`); one group of two rows, "Šta radiš" (the kinds of work as chips) and "Gde" (the area), each leading to where it is changed;
 * "Kada": "Mogu odmah" as a switch of its own and "Nedeljni raspored", which opens the week; "Oprema": "Alat" and "Vozila", a short list said in the row and a
 * longer one as its count, both opening the lists; and last, as a white button, "Popuni uz asistenta". There is no green primary: nothing here is saved.
 *
 * Every row that changes something is a row that leads to the editor of THAT part (`onEditPart`); none of them writes by itself. The one exception is the
 * switch, which is the person's own act and is saved by the route exactly as Početna saves it (`availableNow`); without it (a suspended profile) the row only tells.
 * A list with nothing in it is "Dodaj", never a zero; nothing is made up.
 */
export function WorkerProfileSaved({ draft, status, disabled, navigate, openConversation, onEditPart, accountName = null, onUseAccountName, nameWorking = false,
  face, rating, availableNow }: {
  draft: WorkerDraft; status: ReactNode; disabled: boolean; navigate: (path: SavedProfilePath) => void;
  /** The assistant fills the profile in with the person: the white button at the end. Without it the button is not drawn. */ openConversation?: () => void;
  /** Opens the editor of one part of the profile. */ onEditPart: (part: SavedProfilePart) => void;
  /** The name of the account, when it could be read. */ accountName?: string | null;
  /** Writes the account's name into the work profile; without it the difference is only said. */ onUseAccountName?: () => void;
  /** That write is in flight. */ nameWorking?: boolean;
  /** The face in the card: the photo, or what stands in for it. */ face?: ReactNode;
  /** The rating in the card (a line, or nothing). */ rating?: ReactNode;
  /** The switch "Mogu odmah"; without it the row says its state and cannot be touched. */ availableNow?: AvailableNowControl;
}) {
  const grad = draft.grad.trim() ? cityLabel(draft.grad) : '';
  const area = grad ? (draft.radius ? `${grad} · ${draft.radius} km` : grad) : '';
  const name = accountName?.trim() || draft.ime.trim();
  const kinds = skillsLine(draft.vestine);
  return <View testID="worker-profile-saved" style={s.saved}>
    {status}
    {name || kinds ? <Surface kind="panel" testID="worker-profile-card" style={s.card}>
      <T variant="meta" tone="muted">Kako te vide kad uskačeš</T>
      <View style={s.cardRow}>
        <View style={s.face}>{face}</View>
        <View style={s.cardCopy}>
          {name ? <T variant="bodyStrong" accessibilityRole="header" style={s.ink}>{name}</T> : null}
          {kinds ? <T variant="note" tone="muted">{kinds}</T> : null}
          {rating}
        </View>
      </View>
    </Surface> : null}
    {onUseAccountName && namesDiffer(draft.ime, accountName)
      ? <NameDifference workName={draft.ime} accountName={accountName!} disabled={disabled || nameWorking} working={nameWorking} onUse={onUseAccountName} /> : null}
    {/* What the worker does and where: two rows of ONE group, every picture in the same slot, every title at the same edge. */}
    <SettingsGroup>
      <SkillsRow skills={draft.vestine} disabled={disabled} onPress={() => onEditPart('skills')} />
      <SettingsRow label="Gde" value={area || undefined} detail={area ? undefined : 'Izaberi gde želiš da radiš'} icon={<FactArt kind="pin" size={32} />}
        disabled={disabled} onPress={() => navigate('/profil/lokacija')} last />
    </SettingsGroup>
    <SettingsGroup title="Kada">
      {availableNow
        ? <ListRow leading={<ClockArt size={32} quiet={disabled} />} title="Mogu odmah"
          subtitle={availableNow.failed ? 'Nije sačuvano. Pokušaj ponovo.' : availableNow.busy ? 'Čuvamo…' : undefined}
          trailing={<Switch testID="worker-available-now" value={availableNow.value} disabled={disabled || !!availableNow.busy} onValueChange={availableNow.onChange}
            accessibilityLabel="Mogu odmah" trackColor={{ true: sys.color.green, false: sys.color.control }} thumbColor={sys.color.surface} />} />
        : <ListRow leading={<ClockArt size={32} quiet />} title="Mogu odmah" value={draft.dostupanOdmah ? 'Uključeno' : 'Isključeno'} />}
      <SettingsRow label="Nedeljni raspored" icon={<FactArt kind="calendar" size={32} />} disabled={disabled} onPress={() => navigate('/profil/dostupnost')} last />
    </SettingsGroup>
    {/* The tools and the vehicles are information only; that is the sentence behind the "ⓘ" at the title, not a chip or a line on the screen. */}
    <View testID="worker-profile-kit" style={s.group}>
      <InfoTitle title="Oprema" testID="worker-kit-info" info={[toolsAndVehiclesNote()]} />
      <SettingsGroup>
        <KitRow label="Alat" art="tool" items={draft.alati} disabled={disabled} onPress={() => onEditPart('tools')} />
        <KitRow label="Vozila" art="vehicle" items={draft.vozila} disabled={disabled} onPress={() => onEditPart('vehicles')} last />
      </SettingsGroup>
    </View>
    {openConversation ? <V2Action label="Popuni uz asistenta" tone="neutral" disabled={disabled} onPress={openConversation} /> : null}
  </View>;
}

/**
 * "Šta radiš": the row of the kinds of work, which are its chips (up to `SKILL_CHIPS_MAX`, then "+N"); a profile with none says what to do about it. The whole
 * row, chips included, is the one touch that opens the editor of the skills. It is a `ListRow` by measure: the picture's slot, the words 52 from the edge, the
 * divider inset and 12 above and below, so it stands in a group with the rows beside it as one of them.
 */
function SkillsRow({ skills, disabled, onPress }: { skills: readonly string[]; disabled: boolean; onPress: () => void }) {
  const shown = skills.slice(0, SKILL_CHIPS_MAX), more = skills.length - shown.length;
  return <Press testID="worker-skills-row" accessibilityRole="button" accessibilityLabel="Šta radiš" accessibilityHint={skills.length ? skills.join(', ') : undefined}
    accessibilityState={{ disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.row} onPress={onPress} style={s.skillsRow}>
    <View style={s.slot}><FactArt kind="tasks" size={32} muted={disabled} /></View>
    <View style={s.skillsCopy}>
      <T variant="bodyStrong" tone={disabled ? 'muted' : 'ink'}>Šta radiš</T>
      {skills.length
        ? <View testID="worker-profile-skills" style={s.chips}>
          {shown.map((skill, index) => <View key={`${index}:${skill}`} style={s.chip}><T selectable variant="note" style={s.chipText}>{skill}</T></View>)}
          {more > 0 ? <View style={s.chip}><T variant="note" style={s.chipText}>{`+${more}`}</T></View> : null}
        </View>
        : <T variant="note" tone="muted">Koje zadatke možeš da preuzmeš?</T>}
    </View>
    <Glyph name="caret-right" size={20} tone="muted" />
    <View pointerEvents="none" style={s.rule} />
  </Press>;
}

/**
 * "Alat" and "Vozila": a short list (up to `KIT_INLINE_MAX`) is said under the title in words; a longer one is its count at the end of the row, never a wall of
 * words; a list with nothing in it is "Dodaj". Either way the row opens the editor of that list.
 */
function KitRow({ label, art, items, disabled, onPress, last = false }: { label: string; art: 'tool' | 'vehicle'; items: readonly string[]; disabled: boolean; onPress: () => void; last?: boolean }) {
  const inline = items.length > 0 && items.length <= KIT_INLINE_MAX;
  return <SettingsRow label={label} icon={<FactArt kind={art} size={32} />} disabled={disabled} onPress={onPress} last={last}
    detail={inline ? items.join(', ') : undefined} value={items.length > KIT_INLINE_MAX ? String(items.length) : items.length === 0 ? 'Dodaj' : undefined} />;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  saved: { gap: sys.space.xl },
  card: { gap: sys.space.md, padding: sys.space.base },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  face: { alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  slot: { width: layout.slot, alignItems: 'center', justifyContent: 'center' },
  skillsRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md, minHeight: layout.rowMin },
  skillsCopy: { flex: 1, minWidth: 0, gap: sys.space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  chip: { minHeight: 32, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: sys.space.md, paddingVertical: sys.space.xs,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  chipText: { color: sys.color.ink, flexShrink: 1 },
  // The title of the equipment and its rows stand 12 apart, as every `Section` does.
  group: { gap: layout.group },
  // The divider is not a border: it begins where the words begin, like the one of a `ListRow`.
  rule: { position: 'absolute', left: layout.slot + sys.space.md, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
