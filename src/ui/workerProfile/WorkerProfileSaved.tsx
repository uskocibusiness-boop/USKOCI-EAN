import { useState, type ReactNode } from 'react';
import { workerAreasLabel } from '../../contracts/workerAreas';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { cityLabel } from '../profile/cityLabel';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { layout, ruleWidth } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { brandAction, profileLift, sys } from '../system/tokens';
import { SettingsGroup, SettingsRow } from '../settings/SettingsPresentation';
import { V2Action } from '../v2/V2Action';
import { NameDifference, namesDiffer } from './NameDifference';
import type { WorkerDraft } from './workerProfileDraft';
import { SavedAvailability } from './SavedAvailability';
import type { WorkerAvailabilityView } from '../../hooks/useWorkerAvailability';
import type { WorkerExecutionModeView } from '../../hooks/useWorkerExecutionModes';
import type { WorkerAiPart } from './workerProfileFacts';
import { serviceHandoffText } from '../../contracts/serviceHandoff';
import type { WorkerSavedService, WorkerSavedServiceStatus } from '../../contracts/workerSavedServices';

/** The places the saved profile opens: the area and the week of a worker. */
export type SavedProfilePath = '/profil/lokacija' | '/profil/dostupnost';
/** Profile sections accepted by contextual AI edits. */
export type SavedProfilePart = 'skills' | 'tools' | 'vehicles';

/** Number of services shown before the disclosure. */
export const SKILL_CHIPS_MAX = 8;

/** Legacy availability datum retained for caller/older-client compatibility, not an ordinary profile UI control. */

/**
 * The saved card reads the MVP facts. Optional legacy equipment remains in data,
 * but does not add a separate section to the ordinary profile reading. Disclosures reveal long lists without
 * entering an editor or sending a command. Editing is an explicit conversation action.
 * The route owns status, the AI entry and restrictions on a suspended profile.
 */
export function WorkerProfileSaved({ draft, status, disabled, navigate, openConversation, accountName = null, onUseAccountName, nameWorking = false,
  face, rating, readOnly = false, executionModes, refreshModes, showConversationAction = true, confirmMap, availability, refreshAvailability }: {
  draft: WorkerDraft; status: ReactNode; disabled: boolean; navigate: (path: SavedProfilePath) => void;
  /** A part opens as local context in the same owned AI conversation. */ openConversation?: (part?: WorkerAiPart) => void;
  /** Hide the generic entry when the route already supplies its main conversation action. */ showConversationAction?: boolean;
  /** A suspended profile remains readable; its area and week cannot be edited. */ readOnly?: boolean;
  /** The name of the account, when it could be read. */ accountName?: string | null;
  /** Writes the account's name into the work profile; without it the difference is only said. */ onUseAccountName?: () => void;
  /** That write is in flight. */ nameWorking?: boolean;
  /** The face in the card: the photo, or what stands in for it. */ face?: ReactNode;
  /** The rating in the card (a line, or nothing). */ rating?: ReactNode;
  executionModes?: WorkerExecutionModeView; refreshModes?: () => void;
  availability?: WorkerAvailabilityView; refreshAvailability?: () => void;
  /** A separate, explicit confirmation of the saved area's approximate point. */ confirmMap?: () => void;
}) {
  const grad = draft.grad.trim() ? cityLabel(draft.grad) : '';
  const area = draft.workAreas?.length ? workerAreasLabel(draft.workAreas) : grad ? (draft.radius ? `${grad} · do ${draft.radius} km` : grad) : '';
  const name = accountName?.trim() || draft.ime.trim();
  const confirmed = executionModes?.kind === 'confirmed' ? executionModes.modes : [];
  const onSite = confirmed.includes('ON_SITE'), remote = confirmed.includes('REMOTE');
  const services = executionModes?.kind === 'confirmed' || executionModes?.kind === 'unconfirmed' ? executionModes.services : undefined;
  const modeLabel = onSite && remote ? 'Na lokaciji i na daljinu' : onSite ? 'Na lokaciji' : remote ? 'Na daljinu'
    : executionModes?.kind === 'loading' ? 'Učitavamo način rada…'
      : executionModes?.kind === 'unconfirmed' ? 'Još nije potvrđen' : 'Trenutno nije dostupan';
  return <View testID="worker-profile-saved" style={s.saved}>
    <View style={s.identity}>
      {name || draft.biografija.trim() ? <View testID="worker-profile-card" style={s.card}>
        <View style={s.cardRow}>
          <View style={s.face}>{face}</View>
          <View style={s.cardCopy}>
            {name ? <T variant="title" accessibilityRole="header" style={s.ink}>{name}</T> : null}
            {status}
          </View>
          {/* Owner, 26.11.2026: editing is the pencil of the card, not a green button in the middle of the page. */}
          {openConversation && showConversationAction && !readOnly ? <Press accessibilityRole="button" accessibilityLabel="Uredite radni profil"
            accessibilityHint="Otvara razgovor za izmenu profila." disabled={disabled} onPress={() => { if (!disabled) openConversation(); }}
            haptic="select" style={s.edit}><Glyph name="edit" size={22} tone="ink" /></Press> : null}
        </View>
        {draft.biografija.trim() ? <Biography text={draft.biografija} /> : null}
        {rating ? <View style={s.rating}><View pointerEvents="none" style={s.identityRule} />{rating}</View> : null}
      </View> : null}
      {name || draft.biografija.trim() ? null : status}
    </View>
    {onUseAccountName && namesDiffer(draft.ime, accountName)
      ? <NameDifference workName={draft.ime} accountName={accountName!} disabled={disabled || nameWorking || readOnly} working={nameWorking} onUse={onUseAccountName} /> : null}
    {/* What the worker does and where: two rows of ONE group, every picture in the same slot, every title at the same edge. */}
    <View testID="worker-profile-work-card" style={s.sectionCard}>
      <T variant="heading" accessibilityRole="header">Šta i gde radite</T>
      <SettingsGroup>
        <SkillsRow skills={draft.vestine} services={services} loading={executionModes?.kind === 'loading'} />
        <ListRow title="Način rada" subtitle={modeLabel} leading={<FactArt kind={remote && !onSite ? 'remote' : 'tasks'} size={32} />}
          last={!onSite && !grad} />
        {executionModes?.kind === 'unavailable' && refreshModes ? <V2Action label="Proverite način rada" tone="neutral" kind="quiet" compact onPress={refreshModes} /> : null}
        {/* An old saved area does not turn a confirmed REMOTE-only service into a visit. */}
        {onSite ? readOnly ? <ListRow title="Područje dolaska" value={area || 'Nije navedeno'} leading={<FactArt kind="pin" size={32} />} />
          : <SettingsRow label="Područje dolaska" value={area || undefined} detail={area ? undefined : 'Recite gde dolazite na zadatak'} icon={<FactArt kind="pin" size={32} />}
            disabled={disabled} onPress={() => openConversation ? openConversation('area') : navigate('/profil/lokacija')} last />
          : grad ? <ListRow title="Grad profila" value={grad} leading={<FactArt kind="pin" size={32} />} last /> : null}
      </SettingsGroup>
    </View>
    {/* Signed work areas already own their territory and center; this separate editor only changes the legacy city point. */}
    {onSite && !draft.workAreas?.length && !readOnly && confirmMap ? <V2Action label="Potvrdite tačku na mapi" tone="neutral" kind="quiet" compact disabled={disabled}
      onPress={() => { if (!disabled) confirmMap(); }} /> : null}
    <View testID="worker-profile-time-card" style={s.sectionCard}><SettingsGroup title="Kada">
        <SavedAvailability view={availability} retry={refreshAvailability} disabled={disabled} />
        {readOnly ? null : <SettingsRow label="Izmenite raspored" icon={<FactArt kind="calendar" size={32} />} disabled={disabled}
            onPress={() => openConversation ? openConversation('time') : navigate('/profil/dostupnost')} last />}
      </SettingsGroup></View>
  </View>;
}

/** All skills are readable; the disclosure changes only presentation. */
const savedStatus: Record<WorkerSavedServiceStatus, string> = {
  CONFIRMED: 'Potvrđeno', PENDING: 'Čeka potvrdu', UNCONFIRMED: 'Nije potvrđeno',
};

function SkillsRow({ skills, services, loading }: { skills: readonly string[]; services?: readonly WorkerSavedService[]; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // The owned reader replaces the names as well as the details. A stale local
  // conversation/draft must not add services to a newer authoritative read.
  const names = services ? services.map(service => service.service) : skills;
  const shown = expanded ? names : names.slice(0, SKILL_CHIPS_MAX);
  return <View testID="worker-skills-row" style={s.skillsRow}>
    <View style={s.slot}><FactArt kind="tasks" size={32} /></View>
    <View style={s.skillsCopy}>
      <T variant="bodyStrong">Usluge</T>
      {names.length
        ? <View testID="worker-profile-skills" style={s.pills}>
          {/* Owner, 26.11.2026: each service one compact pill; a remote service carries the globe; only what still waits says so. */}
          {shown.map((skill, index) => {
            const detail = services?.find(service => service.service === skill);
            const modes = detail?.modes ?? [];
            const remoteOnly = modes.length > 0 && modes.every(mode => mode.mode === 'REMOTE');
            const waiting = detail && (!modes.length || modes.some(mode => mode.status !== 'CONFIRMED'));
            return <View key={`${index}:${skill}`} style={[s.pill, waiting && s.pillWaiting]}
              accessible accessibilityLabel={`${skill}${remoteOnly ? ', na daljinu' : ''}${waiting ? `, ${detail?.status === 'PENDING' ? 'čeka potvrdu' : 'nije potvrđeno'}` : ''}`}>
              {remoteOnly ? <FactArt kind="remote" size={18} /> : null}
              <T variant="note" style={s.pillText}>{skill}</T>
              {waiting ? <T testID="worker-saved-service-status" variant="meta" tone="muted">{detail?.status === 'PENDING' ? 'čeka potvrdu' : 'nije potvrđeno'}</T> : null}
              {modes.find(mode => mode.handoff) ? <T testID="worker-saved-service-handoff" variant="meta" tone="muted">
                {serviceHandoffText(modes.find(mode => mode.handoff)!.handoff!)}</T> : null}
            </View>;
          })}
        </View>
        : <T variant="note" tone="muted">Nema sačuvanih veština.</T>}
      {names.length > 0 && !services ? <T variant="note" tone="muted">{loading ? 'Učitavamo detalje usluga…' : 'Detalji po uslugama trenutno nisu dostupni.'}</T> : null}
      {names.length > SKILL_CHIPS_MAX ? <Disclosure label="Veštine" expanded={expanded} onPress={() => setExpanded(value => !value)} /> : null}
    </View>
    <View pointerEvents="none" style={s.rule} />
  </View>;
}

function Disclosure({ label, expanded, onPress }: { label: string; expanded: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={`${expanded ? 'Prikažite manje' : 'Prikažite sve'}: ${label}`}
    accessibilityState={{ expanded }} onPress={onPress} haptic="select" style={s.disclosure}>
    <T variant="note" style={s.ink}>{expanded ? 'Prikažite manje' : 'Prikažite sve'}</T>
  </Press>;
}

function Biography({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = Array.from(text).length > 240;
  return <View style={s.group}>
    <T selectable variant="body" numberOfLines={long && !expanded ? 4 : undefined}>{text}</T>
    {long ? <Disclosure label="O meni" expanded={expanded} onPress={() => setExpanded(value => !value)} /> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  saved: { gap: layout.gutter },
  identity: { gap: sys.space.base },
  card: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 24, padding: layout.gutter, gap: sys.space.base },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  face: { alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  rating: { gap: sys.space.md },
  identityRule: { height: ruleWidth, backgroundColor: sys.color.line },
  sectionCard: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 24, padding: layout.gutter, gap: sys.space.md },
  slot: { width: layout.slot, alignItems: 'center', justifyContent: 'center' },
  skillsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingVertical: sys.space.md, minHeight: layout.rowMin },
  skillsCopy: { flex: 1, minWidth: 0, gap: sys.space.sm },
  services: { gap: sys.space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.wash, maxWidth: '100%', flexShrink: 1 },
  pillWaiting: { borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  pillText: { color: sys.color.ink, fontWeight: '600', flexShrink: 1 },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  serviceDetail: { gap: sys.space.xs },
  group: { gap: layout.group },
  disclosure: { minHeight: layout.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  // The divider is not a border: it begins where the words begin, like the one of a `ListRow`.
  rule: { position: 'absolute', left: layout.slot + sys.space.md, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
