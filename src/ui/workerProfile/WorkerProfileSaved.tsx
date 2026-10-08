import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { tidyPlaceLabel } from '../location/placeText';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { brandAction, sys } from '../system/tokens';
import { SettingsGroup, SettingsRow } from '../settings/SettingsPresentation';
import { V2Action } from '../v2/V2Action';
import type { WorkerDraft } from './workerProfileDraft';
import { availabilityRowDetail, profileEffects, toolsAndVehiclesNote, toolsAndVehiclesTag } from './workerProfileFacts';

/** The places the saved profile opens: the area, the week and the notification settings of a worker. */
export type SavedProfilePath = '/profil/lokacija' | '/profil/dostupnost' | '/profil/obavestenja';

/**
 * The saved work profile, read (M3): the same data as the editor, without a pencil on every line, then what the data
 * really does ("Na šta utiče") and the two ways to change it, by conversation and by hand. It draws no state of its own:
 * the route decides when a profile is read and when it is edited, and what the status line says.
 *
 * One green primary on the screen: "Izmeni razgovorom" is it, unless the route already shows a footer with its own
 * (`primaryTaken`), when both ways to change are white.
 */
export function WorkerProfileSaved({ draft, status, disabled, navigate, openConversation, onManual, primaryTaken = false }: {
  draft: WorkerDraft; status: ReactNode; disabled: boolean; navigate: (path: SavedProfilePath) => void;
  openConversation?: () => void; onManual: () => void; primaryTaken?: boolean;
}) {
  const grad = draft.grad.trim() ? tidyPlaceLabel(draft.grad.trim()) : '';
  const area = grad ? (draft.radius ? `${grad} · ${draft.radius} km` : grad) : 'Izaberi gde želiš da radiš';
  const tag = toolsAndVehiclesTag();
  const hasKit = draft.alati.length > 0 || draft.vozila.length > 0;
  return <View testID="worker-profile-saved" style={s.saved}>
    {status}
    {draft.ime || draft.biografija ? <View testID="worker-profile-identity" style={s.identity}>
      {draft.ime ? <T variant="title" accessibilityRole="header" style={s.ink}>{draft.ime}</T> : null}
      {draft.biografija ? <Bio text={draft.biografija} /> : null}
    </View> : null}
    {draft.vestine.length
      ? <View testID="worker-profile-skills" style={s.chips}>{draft.vestine.map((skill, index) => <View key={`${index}:${skill}`} style={s.chip}>
        <T selectable variant="note" style={s.chipText}>{skill}</T></View>)}</View>
      : <T variant="body" tone="muted">Koje zadatke možeš da preuzmeš?</T>}
    {/* The two ways onward are rows of a group, not a card with a border around a list of rows. */}
    <SettingsGroup>
      <SettingsRow label="Područje rada" detail={area} icon={<FactArt kind="pin" size={32} />} disabled={disabled}
        onPress={() => navigate('/profil/lokacija')} />
      <SettingsRow label="Dostupnost" icon={<ClockArt size={32} quiet={disabled} />} disabled={disabled} last onPress={() => navigate('/profil/dostupnost')}
        detail={availabilityRowDetail(draft.dostupanOdmah)} />
    </SettingsGroup>
    <View testID="worker-profile-kit" style={s.kit}>
      {tag ? <View style={s.tag}><T variant="meta" tone="muted">{tag}</T></View> : null}
      {draft.alati.length ? <Fact art="tool">{draft.alati.join(' · ')}</Fact> : null}
      {draft.vozila.length ? <Fact art="vehicle">{draft.vozila.join(' · ')}</Fact> : null}
      {hasKit ? null : <T variant="body" tone="muted">Alat i vozilo nisu navedeni.</T>}
      <T testID="worker-profile-kit-note" variant="note" tone="muted">{toolsAndVehiclesNote()}</T>
    </View>
    <View testID="worker-profile-effects"><SettingsGroup title="Na šta utiče">
      {profileEffects().map(effect => {
        const copy = <View style={s.effectCopy}>
          <T variant="bodyStrong" style={s.ink}>{effect.title}</T>
          <T variant="note" tone="muted">{effect.detail}</T>
        </View>;
        return effect.opens === 'notifications'
          ? <Press key={effect.key} testID={`worker-effect-${effect.key}`} accessibilityRole="button" accessibilityLabel={effect.title}
            accessibilityHint={`${effect.detail}. Otvara podešavanja obaveštenja o zadacima.`} accessibilityState={{ disabled }} disabled={disabled}
            haptic={disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.row} onPress={() => navigate('/profil/obavestenja')} style={s.effect}>
            <FactArt kind={effect.art} size={32} cut="art" />{copy}<Glyph name="caret-right" tone="muted" />
          </Press>
          : <View key={effect.key} testID={`worker-effect-${effect.key}`} accessible accessibilityLabel={`${effect.title}. ${effect.detail}`} style={s.effect}>
            <FactArt kind={effect.art} size={32} cut="art" />{copy}
          </View>;
      })}
    </SettingsGroup></View>
    <View testID="worker-profile-actions" style={s.actions}>
      {openConversation ? <V2Action label="Izmeni razgovorom" disabled={disabled} onPress={openConversation}
        tone={primaryTaken ? 'neutral' : 'brand'} style={primaryTaken ? undefined : brandAction} /> : null}
      <V2Action label="Izmeni ručno" tone="neutral" disabled={disabled} onPress={onManual} />
    </View>
  </View>;
}

function Fact({ art, children }: { art: FactArtKind; children: string }) {
  return <View style={s.fact}><FactArt kind={art} size={24} cut="art" /><T selectable variant="body" style={s.factText}>{children}</T></View>;
}

/** A long "O meni" stays readable without pushing the rest of the profile off the screen. */
function Bio({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 140;
  return <View style={s.bio}>
    <T selectable variant="body" tone="muted" numberOfLines={long && !expanded ? 3 : undefined}>{text}</T>
    {long ? <Press accessibilityRole="button" accessibilityLabel={`${expanded ? 'Sažmi' : 'Prikaži sve'}: O meni`}
      accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} haptic="select" style={s.showMore}>
      <T variant="note" style={s.showMoreText}>{expanded ? 'Sažmi' : 'Prikaži sve'}</T>
    </Press> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  saved: { gap: sys.space.xl },
  identity: { gap: sys.space.sm },
  bio: { gap: sys.space.xs },
  showMore: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  showMoreText: { color: sys.color.ink, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  chip: { minHeight: 36, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: sys.space.md, paddingVertical: sys.space.xs,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  chipText: { color: sys.color.ink, flexShrink: 1 },
  kit: { gap: sys.space.md },
  tag: { alignSelf: 'flex-start', minHeight: 24, justifyContent: 'center', paddingHorizontal: sys.space.sm,
    borderRadius: sys.radius.badge, backgroundColor: sys.color.wash },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  factText: { flex: 1, minWidth: 0, color: sys.color.ink },
  effect: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.sm },
  effectCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  actions: { gap: sys.space.sm },
});
