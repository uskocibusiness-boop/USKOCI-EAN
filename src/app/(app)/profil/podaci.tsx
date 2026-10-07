import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { requesterProfileClientService } from '../../../data/requesterProfileClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useUnsavedProfileBack } from '../../../hooks/useUnsavedProfileBack';
import { inicijali } from '../../../lib/inicijali';
import { useSesija } from '../../../store/sesija';
import { useIzvor } from '../../../store/uloga';
import { ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';
import { Avatar } from '../../../ui/system/Avatar';
import { StateView } from '../../../ui/system/StateView';
import { DisplayNameForm } from '../../../ui/profile/DisplayNameForm';
import { EDIT_PHOTO, ProfileFactRows, ProfilePhotoBlock, VisibilityNote, type AboutView, type CityView } from '../../../ui/profile/ProfileEditPresentation';

/**
 * Izmeni profil (T4a, 2026-10-07). The pencil on the profile opens this, and it is more than the name: the photo (the screen that
 * already exists), the name (the one form with the one green action), "O meni" and the city (the work profile's, shown as written
 * and opened where they are changed) and what other people can see. The name is the only thing saved HERE, by the same
 * revision-bound save as before; nothing else is written from this screen, and no text is made up for a part that is empty.
 */
export default function PersonalProfile() {
  const { user, accountRevision } = useSesija();
  return <OwnedPersonalProfile key={`${user?.id}:${accountRevision}`} />;
}
function OwnedPersonalProfile() {
  const read = useCallback(() => requesterProfileClientService.read(), []);
  const editor = useOwnedEditor(read);
  const [dirty, setDirty] = useState(false);
  const leave = useUnsavedProfileBack({ dirty: !!editor.data && dirty, busy: editor.busy, uncertain: editor.uncertain,
    revision: editor.data?.revision ?? null, onBack: () => router.canGoBack() ? router.back() : router.replace('/profil') });
  const check = () => { void editor.refresh(); };
  // "O meni" and the work area's city belong to the work profile, so they are read the way the work profile screen reads it.
  const izvor = useIzvor();
  const work = useFocusedResource(useCallback(() => izvor.mojRadnikProfil(), [izvor]));
  const about: AboutView = work.loading ? { kind: 'loading' } : work.error ? { kind: 'error' } : !work.data ? { kind: 'none' }
    : work.data.biografija.trim() ? { kind: 'text', text: work.data.biografija } : { kind: 'empty' };
  const city: CityView = work.loading ? { kind: 'loading' } : work.error ? { kind: 'error' }
    : work.data?.grad.trim() ? { kind: 'city', city: work.data.grad.trim() } : { kind: 'none' };
  // One way onward at a time, and a fresh one on every visit.
  const going = useRef(false);
  useFocusEffect(useCallback(() => { going.current = false; }, []));
  const go = (action: () => void) => { if (going.current) return; going.current = true; action(); };
  const profile = editor.data;
  return <SettingsScreen title="Izmeni profil" onBack={leave.back}>
    {profile ? <>
      <ProfilePhotoBlock ready={!editor.busy}
        photo={<ProfilePhoto profileId={profile.profileId} size={EDIT_PHOTO} fallback={<Avatar initials={inicijali(profile.displayName)} size={EDIT_PHOTO} />} />}
        onOpen={() => go(() => router.push({ pathname: '/profil/fotografija', params: { profileId: profile.profileId } }))} />
      <DisplayNameForm key={profile.revision} savedName={profile.displayName} busy={editor.busy} uncertain={editor.uncertain}
        onDirtyChange={setDirty} saved={editor.saved} error={editor.error} checking={editor.busy || editor.loading} check={check}
        save={(name, requestId) => editor.save(async () => {
          const result = await requesterProfileClientService.save({ displayName: name, clientRequestId: requestId, expectedRevision: profile.revision });
          return result.ok ? { ok: true, podatak: result.podatak.identity } : result;
        })} />
      <ProfileFactRows about={about} city={city} onAbout={() => go(() => router.navigate('/profil/radnik'))}
        onCity={() => go(() => router.navigate('/profil/lokacija'))} />
      <VisibilityNote onMore={() => go(() => router.navigate('/profil/privatnost'))} />
    </>
      : editor.error && !editor.loading ? <StateView kind="error" title="Profil nije učitan" body={editor.error}
        primary={{ label: 'Proveri sačuvane podatke', onPress: check, disabled: editor.busy || editor.loading }} />
        : <StateView kind="loading" title="Učitavamo podatke…" skeleton={{ count: 1, rows: 1 }} />}
    {leave.sheet}
  </SettingsScreen>;
}
