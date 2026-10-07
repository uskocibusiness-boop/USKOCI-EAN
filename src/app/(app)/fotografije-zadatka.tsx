import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSesija } from '../../store/sesija';
import { uuid } from '../../data/serverReceipt';
import { PermissionRecovery } from '../../ui/system/PermissionRecovery';
import { StateView } from '../../ui/system/StateView';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';
import { useReducedMotion } from '../../ui/system/motion';
import { SettingsText as T, SettingsScreen, SettingsAction } from '../../ui/settings/SettingsPresentation';
import { PhotoGrid, PhotoStatus, PhotosLoading, PhotosPrivacyNote } from '../../ui/objava/TaskPhotosPresentation';
import { PhotoAttachTile, usePhotoViewer } from '../../ui/media/PhotoAttachTiles';
import { PhotoAttachSheet } from '../../ui/media/PhotoAttachSheet';
import { TaskPhotoRecovery, taskPhotoTiles } from '../../ui/media/TaskPhotoLine';
import { useTaskPhotoUploads } from '../../ui/media/useTaskPhotoUploads';
import { PHOTO_LIMIT, PHOTO_SOURCE_WORDS, PHOTO_WORDS, TASK_PHOTO_NOTICE, photoCount, photoLimits } from '../../ui/media/photoWords';

/**
 * The task draft's photos, all of them in one place: the screen the review links to ("manage photos"). Since 2026-10-07 it
 * draws the same tiles and says the same words as the conversation's "+" (Galerija, Kamera, the corner X, the full-screen
 * viewer), from the same controller (`useTaskPhotoUploads`), so a photo added in one is the same photo in the other.
 */
export default function TaskPhotosRoute() {
  const params = useLocalSearchParams<{ conversationId?: string }>(), { user, accountRevision } = useSesija();
  const id = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  return <TaskPhotosEditor key={`${user?.id}:${accountRevision}:${id}`} conversationId={id} />;
}
function TaskPhotosEditor({ conversationId }: { conversationId: string | null }) {
  const photos = useTaskPhotoUploads(conversationId);
  const reduced = useReducedMotion();
  const confirm = useConfirmSheet({ reduced });
  const [choosing, setChoosing] = useState(false);
  // With no screen behind it (a cold start from a link), the arrow returns to the conversation these
  // photos belong to, not to a blank new one.
  const back = () => { if (!photos.leave()) return;
    if (router.canGoBack()) router.back();
    else router.replace(conversationId ? { pathname: '/nova', params: { conversationId } } : '/nova'); };
  const tiles = taskPhotoTiles(photos, photos.items, confirm.ask);
  const { openFor, viewer } = usePhotoViewer(tiles, {}, 'Fotografije zadatka');
  const addDisabled = !conversationId || !photos.canAdd;
  // The add action needs its reason when it is grey and nothing on it spins (owner rule).
  const addReason = !conversationId ? null : photos.addReason;
  return <SettingsScreen title="Fotografije zadatka" onBack={back} footer={
    <SettingsAction label={PHOTO_WORDS.add} loading={photos.working === 'PICK'} disabled={addDisabled} reason={addReason}
      onPress={() => { if (!addDisabled) setChoosing(true); }} />}>
    {!conversationId ? <StateView kind="error" art="photo" title="Fotografije nisu dostupne" body="Otvori fotografije iz razgovora o zadatku." />
      : photos.readError ? <StateView kind="error" art="photo" title="Fotografije nisu učitane" body={photos.message ?? undefined}
        primary={{ label: PHOTO_WORDS.check, onPress: () => { void photos.refresh(); } }} />
      : <>
        {photos.message && photos.permissionDenied ? <PermissionRecovery message={photos.message} alternative={PHOTO_SOURCE_WORDS.LIBRARY}
          onAlternative={() => { void photos.pick('LIBRARY'); }} />
          : photos.message ? <PhotoStatus text={photos.message} tone={photos.tone} /> : null}
        {photos.count ? <T variant="meta" tone="muted">{`${photoCount(photos.count)} od ${PHOTO_LIMIT}`}</T> : null}
        {tiles.length ? <PhotoGrid>{size => tiles.map((tile, index) => <PhotoAttachTile key={tile.key} tile={tile} index={index} size={size}
          onOpen={openFor(tile)} />)}</PhotoGrid> : null}
        {/* The ways out of an unconfirmed send, and the check of a photo still processing after its own checks: each once. */}
        <TaskPhotoRecovery photos={photos} />
        {photos.loaded && !tiles.length ? <StateView kind="empty" art="photo" title="Još nema fotografija" /> : null}
        {photos.busy && !photos.loaded && !photos.message ? <PhotosLoading /> : null}
      </>}
    <PhotosPrivacyNote limits={photoLimits('TASK')} />
    {choosing ? <PhotoAttachSheet remaining={photos.remaining} disabledReason={photos.addReason} limits={photoLimits('TASK')}
      notice={TASK_PHOTO_NOTICE} reduced={reduced} onPick={source => { void photos.pick(source); }} onClose={() => setChoosing(false)} /> : null}
    {viewer}
    {confirm.sheet}
  </SettingsScreen>;
}
