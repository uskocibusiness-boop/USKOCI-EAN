import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsScreen } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { ruleWidth } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { sys } from '../system/tokens';
import { BuildIdentity } from '../BuildIdentity';
import { Avatar, FaceEdge } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { ChromeIconButton } from '../system/ScreenChrome';
import { FigureRow } from './ProfileFigures';

/**
 * The face of the profile: 96, centred over the name, with the sticker edge of `FaceEdge` round it (owner's pick of 8 Oct 2026, "Lice i
 * tri broja"). The route draws the photo and its initials stand-in at this size, so a photo and its initials always take the same one.
 */
export const PROFILE_AVATAR = 96;
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
      /** The rating, the first of the three figures under the name (a cell of their row), or nothing. */ reputation: ReactNode };

/**
 * The profile (owner's pick of 8 Oct 2026, "Lice i tri broja"; UI/UX pass 2026-10-08, F6). Identity is NOT a card: the face at 96,
 * centred, with its sticker edge and the camera mark, the name (28/33) under it and the city (`note`); then the three figures in
 * one row with no line and no box: the rating, "završenih" and "dolazi kako je dogovoreno". Under them everything is a `Section` of
 * rows that all start their words at one place: a picture of 32 in a slot of 40 and the text 52 from the edge, a divider of 1 dp
 * inset; the last thing is the red "Odjavi se" row and the small version line. No row draws a hairline of its own.
 *
 * The three figures are the three nodes the route hands in, each a cell of the row that reads its own figure and takes its own share
 * of it: `identity.reputation` (opens "Ocene"), `workSummary` (opens the finished Dogovori) and `stats` (the reliability, only for an
 * account with a work profile). A figure the server does not return is not drawn and leaves its share to the others. The sections
 * "Završeni Dogovori" and "Moja statistika" that these replace are gone.
 *
 * The route still owns reads, navigation admission and logout. This view never substitutes unavailable facts.
 */
export function ProfileHub({ identity, capabilityDetail, capabilityNeedsAttention = false, workArea, workSummary, stats, email, busy, open, onBack, onLogout, logoutError }: {
  identity: ProfileHubIdentity; capabilityDetail?: string;
  /** The work profile is not set up or is still a draft: an orange dot on its row says that something waits for the person. */
  capabilityNeedsAttention?: boolean;
  workArea?: string;
  /** The second figure: how many Dogovori were finished (it opens them). */ workSummary?: ReactNode;
  /** The third figure: how reliably the person comes as agreed. */ stats?: ReactNode;
  /** The email the account signs in with, said under "Promeni lozinku". Left out: the row says nothing under its name. */
  email?: string | null; busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void; logoutError: boolean;
}) {
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
      accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" accessibilityState={{ busy: true }} style={s.identity}>
      {/* The shape of what is coming, standing still: the photo's disc, and one quiet line where the name will be. */}
      <View style={s.skeletonDisc} />
      <T tone="muted">Učitavamo profil…</T>
    </View> : identity.state === 'error' ? <View key="error" testID="profile-identity" accessible={false}
      accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={s.identity}>
      <Avatar initials={null} size={PROFILE_AVATAR} />
      <T variant="bodyStrong" style={s.center}>Profil trenutno nije dostupan.</T>
      <T variant="note" tone="muted" style={s.center}>Proveri vezu pa pokušaj ponovo.</T>
      <View style={s.retry}><SettingsAction label="Pokušaj ponovo" kind="secondary" onPress={identity.retry} /></View>
    </View> : <View key="ready" testID="profile-identity" accessible={false}
      accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={s.identity}>
      {/* The photo itself opens the photo screen; the small camera badge says so without a second control. */}
      <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
        disabled={!identity.photoReady || busy} accessibilityState={{ disabled: !identity.photoReady || busy }} onPress={identity.openPhoto}
        haptic="select" scaleTo={sys.motion.scale.row} style={s.face}>
        <FaceEdge>{identity.photo}</FaceEdge>
        {identity.photoReady ? <View style={s.badge}><Glyph name="camera" size={16} /></View> : null}
      </Press>
      {identity.name ? <T variant="pageTitle" accessibilityRole="header" style={s.center}>{identity.name}</T>
        // A name that is not there is a plain line, not a second 28 px title: it must not read as the thing the screen is about.
        : <T variant="title" tone="muted" accessibilityRole="header" style={s.center}>Ime još nije uneto</T>}
      {identity.place ? <View style={s.city}><FactArt kind="pin" size={16} />
        <T variant="note" tone="muted" style={s.shrink}>{identity.place}</T></View> : null}
    </View>}

    {/* The three figures: rating, finished, reliability. Each node is a cell that reads its own figure (see the doc above). */}
    {identity.state === 'ready' ? <FigureRow testID="profile-figures">{identity.reputation}{workSummary}{stats}</FigureRow> : null}

    <SettingsGroup title="Kako mogu da uskočim">
      {/* The one fact that decides whether a task is ever offered to you is whether this part is set up and active. */}
      {hubRow('Radni profil', 'tool', '/profil/radnik', { detail: capabilityDetail, attention: capabilityNeedsAttention })}
      {hubRow('Područje rada', 'pin', '/profil/lokacija', { detail: workArea })}
      {hubRow('Dostupnost', 'clock', '/profil/dostupnost', { detail: 'Kada mogu da radim' })}
      {hubRow('Raspored', 'calendar', '/raspored', { detail: 'Dogovoreni termini', last: true })}
    </SettingsGroup>

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
  // The face, the name and the city stand in one centred column at every text size; a long name wraps and stays centred.
  identity: { alignItems: 'center', gap: sys.space.sm },
  // The photo's own size and its edge (2 dp each side): the camera mark sits on the corner of this box.
  face: { alignSelf: 'center', borderRadius: sys.radius.pill },
  badge: { position: 'absolute', right: -sys.space.xs, bottom: -sys.space.xs, width: BADGE, height: BADGE, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  city: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  retry: { alignSelf: 'center', marginTop: sys.space.xs },
  skeletonDisc: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton },
  exit: { gap: sys.space.sm },
});
