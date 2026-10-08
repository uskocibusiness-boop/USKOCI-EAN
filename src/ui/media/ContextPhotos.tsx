import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Glyph } from '../system/Glyph';
import { mediaClientService, type MediaPreview } from '../../data/mediaClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useSesija } from '../../store/sesija';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { FactArt } from '../system/FactArt';
import { inicijali } from '../../lib/inicijali';
import { PhotoPages, PhotoViewer } from './PhotoViewer';

/** The viewer is shared (both chats' photo tiles open it); it lives in its own file and is re-exported here. */
export { PhotoViewer, type PhotoReadContext } from './PhotoViewer';

/** Only actual photos lead the detail. An authoritative empty list stays absent for either side;
 * a failed read remains distinct and retryable. `owned` is retained for caller compatibility. */
export function NeedPhotos({ needId }: { needId: string; owned?: boolean }) {
  const { user, accountRevision } = useSesija();
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  const photos = editor.data?.photos ?? [];
  if (editor.loading && !editor.data) return null;
  if (!photos.length && !editor.error) return null;
  return <View style={galleryStyles.section}>
    {photos.length ? <NeedPhotoGallery key={`${user?.id}:${accountRevision}:${needId}:${photos.map(photo => photo.assetId).join(':')}`}
      needId={needId} photos={photos} /> : null}
    {editor.error ? <><T variant="note" tone="muted">Fotografije trenutno nisu učitane.</T>
      <V2Action label="Učitaj fotografije" kind="quiet" disabled={editor.loading} onPress={() => { void editor.refresh(); }} /></> : null}
  </View>;
}

function NeedPhotoGallery({ needId, photos }: { needId: string; photos: readonly MediaPreview[] }) {
  const [index, setIndex] = useState(0), [open, setOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  const close = () => setOpen(false);
  const counter = `${index + 1} / ${photos.length}`;
  const context = { needId };
  return <>
    <View style={galleryStyles.inline} accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
      <PhotoPages context={context} photos={photos} index={index} onIndex={setIndex} onOpen={page => { setIndex(page); setOpen(true); }} />
      <View pointerEvents="none" style={galleryStyles.overlay}>
        <View style={galleryStyles.counter}><Glyph name="expand" size={16} />
          <T variant="meta" accessibilityLabel={`Fotografija ${index + 1} od ${photos.length}`}>{counter}</T></View>
      </View>
    </View>
    {open ? <PhotoViewer context={context} photos={photos} index={index} onIndex={setIndex} onClose={close} /> : null}
  </>;
}

const galleryStyles = StyleSheet.create({
  section: { gap: sys.space.sm },
  inline: { borderRadius: sys.radius.cardCompact, overflow: 'hidden' },
  overlay: { position: 'absolute', bottom: 12, right: 12 },
  counter: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.surface },
});

/**
 * A person's face, or something standing in for it.
 *
 * Two call sites passed `fallback={null}` and the sheet above them tried to catch that with `??`,
 * which never fired because this component always returned an element. Anyone without a photo got
 * an empty green disc, and a photo that failed to load looked exactly like a person who had none.
 * The decision belongs here: a caller may pass its own fallback, but it cannot ask for nothing.
 */
export function ProfilePhoto({ profileId, fallback, size, initial }: { profileId: string; fallback?: ReactNode; size?: number; initial?: string | null }) {
  const read = useCallback(() => mediaClientService.readProfilePhoto(profileId), [profileId]);
  const editor = useOwnedEditor(read), photo = editor.data?.photo;
  const box = size ? { width: size, height: size, borderRadius: size / 2, aspectRatio: 1 }
    : { width: 112, height: 132, borderRadius: sys.radius.card, aspectRatio: 112 / 132 };
  // The one way to take letters from a name (lib/inicijali, critique A4): no name, no letters, and the person is drawn.
  const letter = inicijali(initial);
  // What stands for the person when there is no photograph, or when it cannot be read right now.
  const standIn = fallback ? <>{fallback}</> : <View accessibilityLabel={letter ? `Bez fotografije: ${letter}` : 'Bez fotografije'}
    style={[box, { backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' }]}>
    {letter ? <T accessible={false} variant="title" style={{ color: sys.color.green }}>{letter}</T>
      : <FactArt kind="person" size={size ? Math.round(size / 2.2) : 40} />}
  </View>;
  if (photo) return <AuthorizedPhoto assetId={photo.assetId} profileId={profileId} label="Profilna fotografija"
    contentFit={size ? 'cover' : 'contain'} style={box} pending={standIn} unavailable={size ? standIn : undefined} />;
  if (editor.loading) return <View accessible accessibilityLabel="Učitavanje fotografije" accessibilityState={{ busy: true }}
    style={[box, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{standIn}</View>
  </View>;
  return standIn;
}
