import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { cityLabel } from '../profile/cityLabel';
import { FactArt } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
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

/** Short equipment lists fit in their row; longer lists have a disclosure. */
export const KIT_INLINE_MAX = 3;
/** Number of skill chips shown before the disclosure. */
export const SKILL_CHIPS_MAX = 8;

/** The switch "Mogu odmah": its state, what it does when it is touched, and whether it is saving or the last save failed. The route owns the save. */
export type AvailableNowControl = { value: boolean; onChange: (value: boolean) => void; busy?: boolean; failed?: boolean };

/**
 * The saved card reads all canonical facts. Disclosures reveal long lists without
 * entering an editor or sending a command. Editing is an explicit conversation action.
 * The route owns status, available-now writes and restrictions on a suspended profile.
 */
export function WorkerProfileSaved({ draft, status, disabled, navigate, openConversation, accountName = null, onUseAccountName, nameWorking = false,
  face, rating, availableNow, readOnly = false }: {
  draft: WorkerDraft; status: ReactNode; disabled: boolean; navigate: (path: SavedProfilePath) => void;
  /** The assistant fills the profile in with the person: the white button at the end. Without it the button is not drawn. */ openConversation?: () => void;
  /** A suspended profile remains readable; its area and week cannot be edited. */ readOnly?: boolean;
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
    {name || kinds || draft.biografija.trim() ? <Surface kind="panel" testID="worker-profile-card" style={s.card}>
      <T variant="meta" tone="muted">Tvoj radni profil</T>
      <View style={s.cardRow}>
        <View style={s.face}>{face}</View>
        <View style={s.cardCopy}>
          {name ? <T variant="bodyStrong" accessibilityRole="header" style={s.ink}>{name}</T> : null}
          {kinds ? <T variant="note" tone="muted">{kinds}</T> : null}
          {rating}
        </View>
      </View>
      {draft.biografija.trim() ? <Biography text={draft.biografija} /> : null}
    </Surface> : null}
    {onUseAccountName && namesDiffer(draft.ime, accountName)
      ? <NameDifference workName={draft.ime} accountName={accountName!} disabled={disabled || nameWorking || readOnly} working={nameWorking} onUse={onUseAccountName} /> : null}
    {/* What the worker does and where: two rows of ONE group, every picture in the same slot, every title at the same edge. */}
    <SettingsGroup>
      <SkillsRow skills={draft.vestine} />
      {readOnly ? <ListRow title="Gde" value={area || 'Nije navedeno'} leading={<FactArt kind="pin" size={32} />} />
        : <SettingsRow label="Gde" value={area || undefined} detail={area ? undefined : 'Izaberi gde želiš da radiš'} icon={<FactArt kind="pin" size={32} />}
          disabled={disabled} onPress={() => navigate('/profil/lokacija')} last />}
    </SettingsGroup>
    <SettingsGroup title="Kada">
      {availableNow && !readOnly
        ? <ListRow leading={<ClockArt size={32} quiet={disabled} />} title="Mogu odmah"
          subtitle={availableNow.failed ? 'Nije sačuvano. Pokušaj ponovo.' : availableNow.busy ? 'Čuvamo…' : undefined}
          trailing={<Switch testID="worker-available-now" value={availableNow.value} disabled={disabled || !!availableNow.busy} onValueChange={availableNow.onChange}
            accessibilityLabel="Mogu odmah" trackColor={{ true: sys.color.green, false: sys.color.control }} thumbColor={sys.color.surface} />} />
        : <ListRow leading={<ClockArt size={32} quiet />} title="Mogu odmah" value={draft.dostupanOdmah ? 'Uključeno' : 'Isključeno'} />}
      {!readOnly ? <SettingsRow label="Nedeljni raspored" icon={<FactArt kind="calendar" size={32} />} disabled={disabled} onPress={() => navigate('/profil/dostupnost')} last /> : null}
    </SettingsGroup>
    {/* The tools and the vehicles are information only; that is the sentence behind the "ⓘ" at the title, not a chip or a line on the screen. */}
    <View testID="worker-profile-kit" style={s.group}>
      <InfoTitle title="Oprema" testID="worker-kit-info" info={[toolsAndVehiclesNote()]} />
      <SettingsGroup>
        <KitRow label="Alat" art="tool" items={draft.alati} />
        <KitRow label="Vozila" art="vehicle" items={draft.vozila} last />
      </SettingsGroup>
    </View>
    {openConversation && !readOnly ? <V2Action label="Uredi kroz razgovor" tone="neutral" disabled={disabled} onPress={openConversation} /> : null}
  </View>;
}

/** All skills are readable; the disclosure changes only presentation. */
function SkillsRow({ skills }: { skills: readonly string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? skills : skills.slice(0, SKILL_CHIPS_MAX);
  return <View testID="worker-skills-row" style={s.skillsRow}>
    <View style={s.slot}><FactArt kind="tasks" size={32} /></View>
    <View style={s.skillsCopy}>
      <T variant="bodyStrong">Šta radiš</T>
      {skills.length
        ? <View testID="worker-profile-skills" style={s.chips}>
          {shown.map((skill, index) => <View key={`${index}:${skill}`} style={s.chip}><T selectable variant="note" style={s.chipText}>{skill}</T></View>)}
        </View>
        : <T variant="note" tone="muted">Nema sačuvanih veština.</T>}
      {skills.length > SKILL_CHIPS_MAX ? <Disclosure label="Veštine" expanded={expanded} onPress={() => setExpanded(value => !value)} /> : null}
    </View>
    <View pointerEvents="none" style={s.rule} />
  </View>;
}

/** A long equipment list opens in place without entering an editor. */
function KitRow({ label, art, items, last = false }: { label: string; art: 'tool' | 'vehicle'; items: readonly string[]; last?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const inline = items.length > 0 && items.length <= KIT_INLINE_MAX;
  return <View>
    <ListRow title={label} leading={<FactArt kind={art} size={32} />} last={last || items.length > KIT_INLINE_MAX}
      subtitle={inline ? items.join(', ') : items.length === 0 ? 'Nije navedeno' : undefined}
      value={items.length > KIT_INLINE_MAX ? String(items.length) : undefined} />
    {items.length > KIT_INLINE_MAX ? <View style={s.details}>
      {expanded ? items.map((item, index) => <T key={`${index}:${item}`} selectable variant="note">{item}</T>) : null}
      <Disclosure label={label} expanded={expanded} onPress={() => setExpanded(value => !value)} />
    </View> : null}
  </View>;
}

function Disclosure({ label, expanded, onPress }: { label: string; expanded: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={`${expanded ? 'Prikaži manje' : 'Prikaži sve'}: ${label}`}
    accessibilityState={{ expanded }} onPress={onPress} haptic="select" style={s.disclosure}>
    <T variant="note" style={s.ink}>{expanded ? 'Prikaži manje' : 'Prikaži sve'}</T>
  </Press>;
}

function Biography({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = Array.from(text).length > 240;
  return <View style={s.group}>
    <T variant="bodyStrong">O meni</T>
    <T selectable variant="note" numberOfLines={long && !expanded ? 4 : undefined}>{text}</T>
    {long ? <Disclosure label="O meni" expanded={expanded} onPress={() => setExpanded(value => !value)} /> : null}
  </View>;
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
  details: { marginLeft: layout.slot + sys.space.md, gap: sys.space.sm },
  disclosure: { minHeight: layout.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  // The divider is not a border: it begins where the words begin, like the one of a `ListRow`.
  rule: { position: 'absolute', left: layout.slot + sys.space.md, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
