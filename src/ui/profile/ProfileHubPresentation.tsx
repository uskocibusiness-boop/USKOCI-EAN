import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsScreen } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { ruleWidth } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { sys } from '../system/tokens';
import { useLayoutClass } from '../system/textScale';
import { BuildIdentity } from '../BuildIdentity';
import { Avatar } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { ChromeIconButton } from '../system/ScreenChrome';

/**
 * The face of the profile. The spec asked for 80; the one stand-in for a person (`Avatar`) has no 80, and its profile portrait
 * below 96 is this one. The name beside it (28/33) then has the room, and a photo and its initials always take the same size.
 */
export const PROFILE_AVATAR = 72;
/** The camera mark sits on the photo's edge: a 24 dp disc with a 16 dp glyph leaves the face visible. */
const BADGE = 24;

/** Every place the hub opens. The route turns a choice into navigation behind its own single-flight guard. */
export type ProfileHubPath = '/profil/radnik' | '/profil/lokacija' | '/profil/dostupnost' | '/raspored' | '/profil/podaci'
  | '/profil/obavestenja' | '/profil/privatnost' | '/profil/blokirani' | '/profil/izvoz' | '/profil/pravna' | '/podrska' | '/profil/o-aplikaciji'
  | '/profil/lozinka' | '/profil/prijava-greske';

/** Who the person is, as the route read it: still reading, not readable, or read. */
export type ProfileHubIdentity =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; place: string | null;
      /** The photo or what stands in for it, using PROFILE_AVATAR. */ photo: ReactNode;
      /** The photo screen can be opened (a profile exists and the read settled). */ photoReady: boolean; openPhoto: () => void;
      /** The rating line under the name, or nothing. */ reputation: ReactNode };

/**
 * The profile (UI/UX pass 2026-10-08, F6; composition spec 4.14). Identity is NOT a card: the face on the left, and the name
 * (28/33), the city (`note`) and the rating beside it, in one block on the screen's own edge (the face above the name at a large
 * text size). Under it everything is a `Section` of rows that all start their words at one place: a picture of 32 in a slot of 40
 * and the text 52 from the edge, a divider of 1 dp inset. "Završeni Dogovori" and "Moja statistika" are sections of facts
 * (`KeyValueRow`) that the route hands in; the last thing is the red "Odjavi se" row and the small version line. No row draws a
 * hairline of its own.
 *
 * The route still owns reads, navigation admission and logout. This view never substitutes unavailable facts.
 */
export function ProfileHub({ identity, capabilityDetail, capabilityNeedsAttention = false, workArea, workSummary, stats, email, busy, open, onBack, onLogout, logoutError }: {
  identity: ProfileHubIdentity; capabilityDetail?: string;
  /** The work profile is not set up or is still a draft: an orange dot on its row says that something waits for the person. */
  capabilityNeedsAttention?: boolean;
  workArea?: string; workSummary?: ReactNode; stats?: ReactNode;
  /** The email the account signs in with, said under "Promeni lozinku". Left out: the row says nothing under its name. */
  email?: string | null; busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void; logoutError: boolean;
}) {
  const { stacked } = useLayoutClass();
  // The pencil opens the whole of "Izmeni profil" (photo, name, "O meni", city and what is public), not only the name (T4a, 2026-10-07).
  const editProfile = <ChromeIconButton label="Izmeni profil" hint="Otvara izmenu fotografije, imena i opisa." glyph="edit" raised disabled={busy}
    onPress={() => open('/profil/podaci')} />;
  const go = (path: ProfileHubPath) => () => open(path);
  // A row is drawn by a function, not a component: the screen's tests (and a screen reader) find one row by its words, once.
  const hubRow = (label: string, art: FactArtKind, path: ProfileHubPath, extra: { detail?: string; last?: boolean; quiet?: boolean; attention?: boolean } = {}) =>
    <SettingsRow label={label} detail={extra.detail} last={extra.last} disabled={busy} onPress={go(path)} attention={extra.attention}
      tone={extra.quiet ? 'quiet' : 'default'} icon={<FactArt kind={art} size={32} />} />;
  return <SettingsScreen title="Profil" disabled={busy} onBack={onBack} right={editProfile}>
    {/* Separate hosts keep loading semantics out of the ready/error identity after a native transition. */}
    {identity.state === 'loading' ? <View key="loading" testID="profile-identity" accessible
      accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" accessibilityState={{ busy: true }} style={[s.identity, s.identityLoading]}>
      {/* The shape of what is coming, standing still: the photo's disc, and one quiet line where the name will be. */}
      <View style={s.skeletonDisc} />
      <T tone="muted">Učitavamo profil…</T>
    </View> : identity.state === 'error' ? <View key="error" testID="profile-identity" accessible={false}
      accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={[s.identity, stacked && s.identityStacked]}>
      <Avatar initials={null} size={PROFILE_AVATAR} />
      <View style={s.copy}>
        <T variant="bodyStrong">Profil trenutno nije dostupan.</T>
        <T variant="note" tone="muted">Proveri vezu pa pokušaj ponovo.</T>
        <View style={s.retry}><SettingsAction label="Pokušaj ponovo" kind="secondary" onPress={identity.retry} /></View>
      </View>
    </View> : <View key="ready" testID="profile-identity" accessible={false}
      accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={[s.identity, stacked && s.identityStacked]}>
      {/* The photo itself opens the photo screen; the small camera badge says so without a second control. */}
      <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
        disabled={!identity.photoReady || busy} accessibilityState={{ disabled: !identity.photoReady || busy }} onPress={identity.openPhoto}
        haptic="select" scaleTo={sys.motion.scale.row} style={s.face}>
        {identity.photo}
        {identity.photoReady ? <View style={s.badge}><Glyph name="camera" size={16} /></View> : null}
      </Press>
      <View style={s.copy}>
        {identity.name ? <T variant="pageTitle" accessibilityRole="header">{identity.name}</T>
          // A name that is not there is a plain line, not a second 28 px title: it must not read as the thing the screen is about.
          : <T variant="title" tone="muted" accessibilityRole="header">Ime još nije uneto</T>}
        {identity.place ? <View style={s.city}><FactArt kind="pin" size={16} />
          <T variant="note" tone="muted" style={s.shrink}>{identity.place}</T></View> : null}
        {identity.reputation ? <View style={s.reputation}>{identity.reputation}</View> : null}
      </View>
    </View>}

    {workSummary}

    <SettingsGroup title="Kako mogu da uskočim">
      {/* The one fact that decides whether a task is ever offered to you is whether this part is set up and active. */}
      {hubRow('Radni profil', 'tool', '/profil/radnik', { detail: capabilityDetail, attention: capabilityNeedsAttention })}
      {hubRow('Područje rada', 'pin', '/profil/lokacija', { detail: workArea })}
      {hubRow('Dostupnost', 'clock', '/profil/dostupnost', { detail: 'Kada mogu da radim' })}
      {hubRow('Raspored', 'calendar', '/raspored', { detail: 'Dogovoreni termini', last: true })}
    </SettingsGroup>

    {stats}

    <SettingsGroup title="Nalog i pomoć">
      {hubRow('Podešavanja obaveštenja', 'bell', '/profil/obavestenja')}
      {/* The email is said where it is used: under the one thing that is done with the sign-in. It is not edited here. */}
      {hubRow('Promeni lozinku', 'lock', '/profil/lozinka', { detail: email ?? undefined })}
      {/* The detail names the right to a new review, not just a generic contact link. */}
      {hubRow('Podrška', 'support', '/podrska', { detail: 'Privatni zahtevi, odgovori i ponovni pregled.' })}
      {hubRow('Prijavi grešku u aplikaciji', 'chat', '/profil/prijava-greske', { detail: 'Verzija aplikacije se upisuje sama.' })}
      {hubRow('O aplikaciji', 'info', '/profil/o-aplikaciji', { last: true })}
    </SettingsGroup>

    {/* Needed once in a long while, so the pictures are the quiet set. The words are privacy wording and stay as they are;
        "Privatnost i podaci" is the one visible way to closing the account. */}
    <SettingsGroup title="Privatnost">
      {hubRow('Privatnost i podaci', 'lock', '/profil/privatnost', { detail: 'Šta je javno, rokovi čuvanja, zatvaranje naloga.', quiet: true })}
      {hubRow('Blokirane osobe', 'shield', '/profil/blokirani', { detail: 'Pregled i odblokiranje.', quiet: true })}
      {hubRow('Izvoz podataka', 'download', '/profil/izvoz', { detail: 'Zahtev i preuzimanje svoje kopije.', quiet: true })}
      {hubRow('Pravila i saglasnosti', 'document', '/profil/pravna', { detail: 'Pravni dokumenti i obrada podataka.', quiet: true, last: true })}
    </SettingsGroup>

    <View style={s.exit}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije uspela. Pokušaj ponovo.</T> : null}
      {/* A command, not a way onward: red words and no arrow (the row opens nothing). */}
      <ListRow title={busy ? 'Sačekaj…' : 'Odjavi se'} tone="danger" disabled={busy} last onPress={onLogout} testID="profile-logout" />
    </View>
    <BuildIdentity />
  </SettingsScreen>;
}

const s = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.base },
  identityLoading: { alignItems: 'center' },
  // At a large text size or on a narrow window the face stands over the name, at the same edge, so the name has the whole width.
  identityStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  face: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill },
  badge: { position: 'absolute', right: -sys.space.xs, bottom: -sys.space.xs, width: BADGE, height: BADGE, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, alignSelf: 'stretch', gap: sys.space.xs },
  city: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, maxWidth: '100%' },
  // Do not centre or constrain the supplied node's children: it can contain a retry action.
  reputation: { alignSelf: 'stretch', minWidth: 0 },
  shrink: { flexShrink: 1 },
  retry: { alignSelf: 'flex-start', marginTop: sys.space.xs },
  skeletonDisc: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton },
  exit: { gap: sys.space.sm },
});
