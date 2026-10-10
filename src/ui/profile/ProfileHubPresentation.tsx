import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsScreen } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { ruleWidth } from '../system/layout';
import { KeyValueRow } from '../system/KeyValueRow';
import { sys } from '../system/tokens';
import { Avatar, FaceEdge } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { ChromeIconButton } from '../system/ScreenChrome';
import { V2Action } from '../v2/V2Action';
import { FigureRow } from './ProfileFigures';
import type { HubWords } from './hubStates';

/**
 * The face of the profile: 96, centred over the name, with the sticker edge of `FaceEdge` round it (owner's pick of 8 Oct 2026, "Lice i
 * tri broja"). The route draws the photo and its initials stand-in at this size, so a photo and its initials always take the same one.
 */
export const PROFILE_AVATAR = 96;
/** The camera mark sits on the photo's edge: a 24 dp disc with a 16 dp glyph leaves the face visible. */
const BADGE = 24;

/** Every place the hub opens. The route turns a choice into navigation behind its own single-flight guard. */
export type ProfileHubPath = '/profil/radnik' | '/profil/podaci' | '/profil/obavestenja' | '/profil/privatnost' | '/profil/blokirani'
  | '/profil/izvoz' | '/profil/pravna' | '/podrska' | '/profil/o-aplikaciji' | '/profil/lozinka' | '/profil/prijava-greske';

/** Who the person is, as the route read it: still reading, not readable, or read. */
export type ProfileHubIdentity =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; place: string | null;
      /** The photo or what stands in for it, using PROFILE_AVATAR. */ photo: ReactNode;
      /** The photo screen can be opened (a profile exists and the read settled). */ photoReady: boolean; openPhoto: () => void;
      /** The rating, the first of the figures under the name (a cell of their row), or nothing. */ reputation: ReactNode };

/**
 * The profile (owner's pick of 8 Oct 2026, "Lice i tri broja"; his phone the same day: "natrpano", "nema lakoće"; arranged as the product draft the owner
 * approved the same day, P1). Identity is NOT a card: the face at 96, centred, with its sticker edge and the camera mark, the name (28/33) under it and
 * the city (`note`); then the figures in one row with no line and no box: the rating, "završenih" and, only when the server has a percentage, "dolazi
 * kako je dogovoreno" (a figure that does not exist is not drawn, and the other two stand together in the middle). The pencil in the bar is "Lični podaci".
 *
 * Under the figures "Kako te drugi vide ›" (the public profile as others read it), then FOUR short sections, each a `Section` of rows that all start their
 * words at one place (a picture of 32 in a slot of 40, the text 52 from the edge, a divider of 1 dp inset): "Uskakanje" holds the work profile, and its one
 * line says what it is (state, skills, area: "Aktivan · Moleraj · Novi Sad, 100 km"); the area and the week are in the work profile and the plan is in
 * Dogovori, so none of the three is repeated here (one thing, one place). "Nalog" is the sign-in (the e-mail, said once as a quiet row), the notifications and
 * the password. "Pomoć" is support (with how many requests are open) and the bug report. "Privatnost" is what is public and kept, who is blocked, the export and
 * the rules, each with its state when the app knows it. Then "O aplikaciji" with the version it says. A row says a second thing only when that thing is a fact
 * (J4), and a state that could not be read is not said (`HubWords`); no row explains itself. The last thing is the red "Odjavi se" as a full-width command
 * (no arrow: it opens nothing). Eleven rows, eleven different pictures: the lock is the password's and nothing else's.
 *
 * The figures are the nodes the route hands in, each a cell of the row that reads its own figure and takes its own share of it:
 * `identity.reputation` (opens "Ocene"), `workSummary` (opens the finished Dogovori) and `stats` (the reliability, only for an
 * account with a work profile and a percentage).
 *
 * The route still owns reads, navigation admission and logout. This view never substitutes unavailable facts.
 */
export function ProfileHub({ identity, capabilityDetail, capabilityNeedsAttention = false, workSummary, stats, email, busy, open, onBack, onLogout, logoutError,
  onViewPublic, sheet, words = {}, version }: {
  identity: ProfileHubIdentity;
  /** What the work profile says about itself in one line (state, skills, area); left out while it reads, and when its state is not known. */
  capabilityDetail?: string;
  /** The work profile is not set up or is still a draft: an orange dot on its row says that something waits for the person. */
  capabilityNeedsAttention?: boolean;
  /** The second figure: how many Dogovori were finished (it opens them). */ workSummary?: ReactNode;
  /** The third figure: how reliably the person comes as agreed. */ stats?: ReactNode;
  /** The e-mail the account signs in with, said once as a quiet row. Left out: the row is not drawn. */
  email?: string | null; busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void; logoutError: boolean;
  /** Opens the public profile as other people read it. Left out (no profile to open yet): the row is not drawn. */ onViewPublic?: () => void;
  /** What stands over the screen once it is open (the public profile sheet). */ sheet?: ReactNode;
  /** The state of the rows that have one (open requests, blocked people, the export, the legal documents); a part left out has no word. */ words?: HubWords;
  /** "Verzija 1.0.0": what "O aplikaciji" says at its end; left out, it says nothing. */ version?: string;
}) {
  // The pencil opens the whole of "Lični podaci" (photo, name, "O meni", city), not only the name (T4a, 2026-10-07).
  const editProfile = <ChromeIconButton label="Lični podaci" hint="Otvara izmenu fotografije, imena i opisa." glyph="edit" raised disabled={busy}
    onPress={() => open('/profil/podaci')} />;
  const go = (path: ProfileHubPath) => () => open(path);
  // A row is drawn by a function, not a component: the screen's tests (and a screen reader) find one row by its words, once.
  const hubRow = (label: string, art: FactArtKind, path: ProfileHubPath, extra: { detail?: string; value?: string; last?: boolean; attention?: boolean } = {}) =>
    <SettingsRow label={label} detail={extra.detail} value={extra.value} valuePlacement="below" last={extra.last} disabled={busy} onPress={go(path)} attention={extra.attention}
      icon={<FactArt kind={art} size={32} />} />;
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

    {/* The figures: rating, finished, and reliability when there is a percentage. Each node is a cell that reads its own figure (see the doc above). */}
    {identity.state === 'ready' ? <FigureRow testID="profile-figures">{identity.reputation}{workSummary}{stats}</FigureRow> : null}

    {/* The public profile as others read it: one row of its own under the figures, in no section (it is about the person, not about an account setting). */}
    {onViewPublic ? <SettingsGroup>
      <SettingsRow label="Kako te drugi vide" disabled={busy} onPress={onViewPublic} icon={<FactArt kind="person" size={32} />} last />
    </SettingsGroup> : null}

    <SettingsGroup title="Uskakanje">
      {/* The one fact that decides whether a task is ever offered to you is whether this part is set up and active. */}
      {hubRow('Radni profil', 'tool', '/profil/radnik', { detail: capabilityDetail, attention: capabilityNeedsAttention, last: true })}
    </SettingsGroup>

    <SettingsGroup title="Nalog">
      {/* The sign-in is said once, as a quiet row: it is a fact about the account, not a way onward. */}
      {email ? <KeyValueRow label="E-pošta" value={email} /> : null}
      <SettingsRow label="Obaveštenja" disabled={busy} onPress={go('/profil/obavestenja')}
        icon={<Glyph name="notifications" size={24} />} />
      {hubRow('Promeni lozinku', 'lock', '/profil/lozinka', { last: true })}
    </SettingsGroup>

    <SettingsGroup title="Pomoć">
      {hubRow('Podrška', 'support', '/podrska', { value: words.support })}
      {hubRow('Prijavi grešku', 'chat', '/profil/prijava-greske', { last: true })}
    </SettingsGroup>

    {/* The words are privacy wording and stay as they are; "Privatnost i podaci" is the one visible way to closing the account. */}
    <SettingsGroup title="Privatnost">
      {hubRow('Privatnost i podaci', 'eye', '/profil/privatnost')}
      {hubRow('Blokirane osobe', 'shield', '/profil/blokirani', { value: words.blocked })}
      {hubRow('Izvoz podataka', 'download', '/profil/izvoz', { value: words.export })}
      {hubRow('Pravila i saglasnosti', 'document', '/profil/pravna', { value: words.legal, last: true })}
    </SettingsGroup>

    <SettingsGroup>
      {hubRow('O aplikaciji', 'info', '/profil/o-aplikaciji', { value: version, last: true })}
    </SettingsGroup>

    <View style={s.exit}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije uspela. Pokušaj ponovo.</T> : null}
      {/* A command, not a way onward: red words, centred across the whole width, and no arrow (it opens nothing). */}
      <V2Action label={busy ? 'Sačekaj…' : 'Odjavi se'} kind="destructive" disabled={busy} onPress={onLogout} style={s.logout} />
    </View>
    {sheet}
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
  logout: { alignSelf: 'stretch' },
});
