import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsText as T, SettingsScreen, SettingsAction } from '../settings/SettingsPresentation';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import { FactArt } from '../system/FactArt';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { sys } from '../system/tokens';

/** Which command runs, only so its own button shows that it runs. */
export type ProfilePhotoRunning = 'LIBRARY' | 'CAMERA' | 'APPLY' | 'DISCARD' | 'CLEAR' | 'RETRY' | null;
/** What the circle shows. */
export type ProfilePhotoStage = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'none' }
  | { kind: 'photo'; assetId: string; staged: boolean };
/**
 * One set of actions at a time, the ones that can work now: `pick` (gallery, camera, remove; a refusal on the phone, such
 * as a denied camera, stays here with its message above the choices), `staged` (keep or let go of a chosen picture),
 * `unresolved` (a change whose outcome is unknown: read it, then retry), `reconcile` (after a refusal of a command the
 * saved state is read before a new choice; the editor requires that read, so the pickers would only be grey), or none.
 */
export type ProfilePhotoMode = 'pick' | 'staged' | 'unresolved' | 'reconcile' | 'none';

const PREVIEW = 160;

/**
 * The photo of one profile (2026-09-24): shown the way others see it, a round crop, 160 px; under it what the circle
 * holds and the last notice; then only the actions that can work now; the privacy note last, word for word. Removing the
 * public photo asks first (the route renders the sheet). Presentation only: every command and guard is the route's.
 */
export function ProfilePhotoEditor({ onBack, stage, notice, error, permissionDenied, mode, retryable, running, sending = false, canAct, waiting,
  hasPhoto, onLibrary, onCamera, onRemove, onApply, onDiscard, onRetry, onCheck, photo, sheet }: {
  onBack: () => void; stage: ProfilePhotoStage | null; notice: string | null; error: string | null;
  /** The error is the camera permission refusal: the phone settings are offered. */ permissionDenied: boolean;
  mode: ProfilePhotoMode; retryable: boolean; running: ProfilePhotoRunning;
  /** A chosen picture is on its way (journaled, the upload runs). */ sending?: boolean;
  /** A new command can start now. */ canAct: boolean; /** A read or a command is in flight. */ waiting: boolean;
  /** The profile has a saved photo that can be removed. */ hasPhoto: boolean;
  onLibrary: () => void; onCamera: () => void; onRemove: () => void; onApply: () => void; onDiscard: () => void;
  onRetry: () => void; onCheck: () => void;
  /** How a stored picture is drawn; the authorized reader by default. */
  photo?: (assetId: string, label: string, unavailable: ReactNode) => ReactNode;
  sheet?: ReactNode;
}) {
  // Its own element for a screen reader: iOS focuses a view only when it is `accessible`.
  const unavailable = <View accessible accessibilityRole="image" accessibilityLabel="Fotografija trenutno nije dostupna." style={[s.circle, s.wash]}>
    <FactArt kind="photo" size={48} muted /></View>;
  const draw = photo ?? ((assetId: string, label: string, fallback: ReactNode) =>
    <AuthorizedPhoto assetId={assetId} label={label} contentFit="cover" style={s.photo} unavailable={fallback} />);
  const preview = !stage ? null : stage.kind === 'loading' ? <View style={[s.circle, s.skeleton]} />
    : stage.kind === 'unavailable' ? unavailable
      : stage.kind === 'none' ? <View style={[s.circle, s.soft]}><FactArt kind="person" size={72} /></View>
        : draw(stage.assetId, stage.staged ? 'Izabrana fotografija profila' : 'Sadašnja fotografija profila', unavailable);
  // While a chosen picture travels the circle still shows what is saved; the caption says the new one is on its way.
  const caption = !stage ? null : sending ? 'Šaljemo fotografiju…' : stage.kind === 'loading' ? 'Učitavamo fotografiju…'
    : stage.kind === 'none' ? 'Profil još nema fotografiju.' : stage.kind === 'photo' && stage.staged ? 'Još nije sačuvana' : null;
  return <SettingsScreen title="Fotografija profila" onBack={onBack}>
    {stage ? <View style={s.stage}>
      {preview}
      {caption ? <T variant="note" tone="muted" style={s.centered}>{caption}</T> : null}
      {notice ? <T accessibilityLiveRegion="polite" style={s.centered}>{notice}</T> : null}
    </View> : null}
    {error && permissionDenied ? <PermissionRecovery message={error} />
      : error ? <T accessibilityRole="alert" tone="danger">{error}</T> : null}
    {mode === 'unresolved' ? <View style={s.actions}>
      {/* After the read a retry is offered, so the line no longer asks for a check first; before it, the check is the one action. */}
      {retryable ? <>
        <T>Ne znamo da li je promena sačuvana.</T>
        <SettingsAction label="Pošalji promenu ponovo" loading={running === 'RETRY'} disabled={waiting} onPress={onRetry} />
        <SettingsAction label="Proveri sačuvanu fotografiju" kind="quiet" disabled={waiting} onPress={onCheck} />
      </> : <>
        <T>Ne znamo da li je fotografija poslata. Proveri to pre novog izbora.</T>
        <SettingsAction label="Proveri sačuvanu fotografiju" disabled={waiting} onPress={onCheck} />
      </>}
    </View> : mode === 'reconcile' ? <View style={s.actions}>
      {/* Every refusal on the phone stays in `pick`, so this is reached only when a read really is needed (a write that
          was not confirmed, a failed read, a conflict): the button says the check its error asks for (review 5b). */}
      <SettingsAction label="Proveri sačuvanu fotografiju" disabled={waiting} onPress={onCheck} />
    </View> : mode === 'staged' ? <View style={s.actions}>
      <SettingsAction label="Sačuvaj fotografiju" loading={running === 'APPLY'} disabled={!canAct} onPress={onApply} />
      <SettingsAction label="Odustani od izabrane fotografije" kind="quiet" loading={running === 'DISCARD'} disabled={!canAct} onPress={onDiscard} />
    </View> : mode === 'pick' ? <View style={s.actions}>
      <SettingsAction label="Izaberi iz galerije" loading={running === 'LIBRARY'} disabled={!canAct} onPress={onLibrary} />
      <SettingsAction label="Fotografiši" kind="secondary" loading={running === 'CAMERA'} disabled={!canAct} onPress={onCamera} />
      {hasPhoto ? <View style={s.start}><SettingsAction label="Ukloni fotografiju profila" kind="destructive" loading={running === 'CLEAR'}
        disabled={!canAct} onPress={onRemove} /></View> : null}
    </View> : null}
    {/* Privacy wording, word for word; it is the owner's. */}
    <View style={s.note}><FactArt kind="lock" size={20} />
      <T variant="note" tone="muted" style={s.grow}>Jedna fotografija ovog profila, do 10 MB. Uklanjamo metapodatke i smanjujemo sliku. Nova fotografija se prikazuje drugima tek kada izabereš „Sačuvaj fotografiju“.</T>
    </View>
    {sheet}
  </SettingsScreen>;
}

const s = StyleSheet.create({
  stage: { alignItems: 'center', gap: sys.space.md, marginTop: sys.space.sm },
  photo: { width: PREVIEW, height: PREVIEW, borderRadius: sys.radius.pill },
  circle: { width: PREVIEW, height: PREVIEW, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  skeleton: { backgroundColor: sys.color.skeleton },
  soft: { backgroundColor: sys.color.greenSoft },
  wash: { backgroundColor: sys.color.wash },
  centered: { textAlign: 'center' },
  actions: { gap: sys.space.sm },
  start: { alignSelf: 'flex-start' },
  note: { flexDirection: 'row', gap: sys.space.sm, alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
});
