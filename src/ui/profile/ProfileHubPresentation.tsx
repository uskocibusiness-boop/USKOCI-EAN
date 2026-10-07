import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SignOut, Camera } from 'phosphor-react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { CalendarArt } from '../system/CalendarArt';
import { ClockArt } from '../system/ClockArt';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsAction, settingsStyles as styles } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { floating, sys } from '../system/tokens';
import { useLayoutClass } from '../system/textScale';
import { BuildIdentity } from '../BuildIdentity';
import { Avatar } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { WorkProfileArt } from './WorkProfileArt';
import { ChromeIconButton } from '../system/ScreenChrome';

const NOTIFICATION_ART = require('../../../assets/illustrations/uskoci-notification-bell-v1.png');

/** The identity passport reserves the same size for a real photo, initials and unavailable identity. */
export const PROFILE_AVATAR = 96;
/** The camera mark sits on the photo's edge at a size that leaves the face visible. */
const BADGE = { width: 24, height: 24, right: -2, bottom: -2 } as const;

/** Every place the hub opens. The route turns a choice into navigation behind its own single-flight guard. */
export type ProfileHubPath = '/profil/radnik' | '/profil/lokacija' | '/profil/dostupnost' | '/raspored' | '/profil/podaci'
  | '/profil/obavestenja' | '/profil/privatnost' | '/profil/blokirani' | '/profil/izvoz' | '/profil/pravna' | '/podrska' | '/profil/o-aplikaciji';

/** Who the person is, as the route read it: still reading, not readable, or read. */
export type ProfileHubIdentity =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; place: string | null;
      /** The photo or what stands in for it, using PROFILE_AVATAR. */ photo: ReactNode;
      /** The photo screen can be opened (a profile exists and the read settled). */ photoReady: boolean; openPhoto: () => void;
      /** The rating line under the name, or nothing. */ reputation: ReactNode };

/**
 * Identity leads in one compact raised passport; editing is a separate command at the top right. Reputation keeps full width because it can
 * include actual review comments, loading and recovery. Independent work facts follow before setup and utilities.
 * The route still owns reads, navigation admission and logout. This view never substitutes unavailable facts.
 */
export function ProfileHub({ identity, capabilityDetail, workArea, workSummary, busy, open, onBack, onLogout, logoutError, stacked: forced }: {
  identity: ProfileHubIdentity; capabilityDetail?: string; workArea?: string; workSummary?: ReactNode; busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void; logoutError: boolean;
  /** Stacked identity for the design gallery or narrow/large-text layouts. */ stacked?: boolean;
}) {
  const { stacked } = useLayoutClass();
  const compact = forced ?? stacked;
  const row = s.identity;
  const copy = s.copy;
  // The pencil opens the whole of "Izmeni profil" (photo, name, "O meni", city and what is public), not only the name (T4a, 2026-10-07).
  const editProfile = <ChromeIconButton label="Izmeni profil" hint="Otvara izmenu fotografije, imena i opisa." glyph="edit" raised disabled={busy}
    onPress={() => open('/profil/podaci')} />;
  return <SettingsScreen title="Profil" disabled={busy} onBack={onBack} right={editProfile}>
    <View style={[s.identitySection, compact && s.identityCompact]}>
      {/* Separate hosts keep loading semantics out of the ready/error identity after a native transition. */}
      {identity.state === 'loading' ? <View key="loading" testID="profile-identity" accessible
        accessibilityRole="progressbar" accessibilityLabel="Učitavamo profil" accessibilityState={{ busy: true }} style={row}>
        {/* The shape of what is coming, standing still: the photo's disc, and one quiet line where the name will be. */}
        <View style={s.skeletonDisc} />
        <T tone="muted">Učitavamo profil…</T>
      </View> : identity.state === 'error' ? <View key="error" testID="profile-identity" accessible={false}
        accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={row}>
        <Avatar initials={null} size={PROFILE_AVATAR} />
        <View style={copy}>
          <T variant="bodyStrong">Profil trenutno nije dostupan.</T>
          <T variant="note" tone="muted">Proveri vezu pa pokušaj ponovo.</T>
          <View style={s.retry}><SettingsAction label="Pokušaj ponovo" kind="secondary" onPress={identity.retry} /></View>
        </View>
      </View> : <View key="ready" testID="profile-identity" accessible={false}
        accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={row}>
        <View style={[s.readyIdentity, compact && s.readyIdentityStacked]}>
        {/* The photo itself opens the photo screen; the small camera badge says so without a second control. */}
        <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
          disabled={!identity.photoReady || busy} accessibilityState={{ disabled: !identity.photoReady || busy }} onPress={identity.openPhoto}
          haptic="select" scaleTo={0.97}>
          {identity.photo}
          {identity.photoReady ? <View style={[styles.avatarBadge, BADGE]}><Camera size={14} color={sys.color.ink} /></View> : null}
        </Press>
        <View style={[copy, s.readyCopy, compact && s.readyCopyStacked]}>
          {identity.name ? <T variant="title" accessibilityRole="header" style={[s.name, compact && s.nameStacked]}>{identity.name}</T>
            : <T variant="title" tone="muted" accessibilityRole="header" style={[s.name, compact && s.nameStacked]}>Ime još nije uneto</T>}
          {identity.place ? <View style={[styles.identityCity, s.city, compact && s.cityStacked]}><FactArt kind="pin" size={18} cut="art" />
            <T variant="note" tone="muted" style={s.shrink}>{identity.place}</T></View> : null}
        </View>
        </View>
        {identity.reputation ? <View style={s.reputation}>{identity.reputation}</View> : null}
      </View>}
    </View>

    {workSummary}

    <SettingsGroup title="Kako mogu da uskočim">
      {/* The one fact that decides whether a task is ever offered to you is whether this part is set up and active. */}
      <ProfileUtilityRow label="Radni profil" detail={capabilityDetail} art="users" featured disabled={busy}
        onPress={() => open('/profil/radnik')} />
      <ProfileUtilityRow label="Područje rada" detail={workArea} art="pin" disabled={busy}
        onPress={() => open('/profil/lokacija')} />
      <ProfileUtilityRow label="Dostupnost" detail="Kada mogu da radim" art="clock" disabled={busy}
        onPress={() => open('/profil/dostupnost')} />
      <ProfileUtilityRow label="Raspored" detail="Dogovoreni termini" art="calendar" disabled={busy} last
        onPress={() => open('/raspored')} />
    </SettingsGroup>
    <SettingsGroup title="Nalog i pomoć">
      <ProfileUtilityRow label="Podešavanja obaveštenja" art="bell" disabled={busy}
        onPress={() => open('/profil/obavestenja')} />
      {/* The detail names the right to a new review, not just a generic contact link. */}
      <ProfileUtilityRow label="Podrška" detail="Privatni zahtevi, odgovori i ponovni pregled." art="support"
        disabled={busy} onPress={() => open('/podrska')} />
      <ProfileUtilityRow label="O aplikaciji" art="info" disabled={busy} last onPress={() => open('/profil/o-aplikaciji')} />
    </SettingsGroup>
    {/* Needed once in a long while, so these rows sit lower and without the icon disc. Their words are privacy wording and
        stay as they are; "Privatnost i podaci" is the one visible way to closing the account. */}
    <SettingsGroup title="Privatnost">
      <ProfileUtilityRow label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga."
        disabled={busy} onPress={() => open('/profil/privatnost')} />
      <ProfileUtilityRow label="Blokirane osobe" detail="Tvoja blokiranja i privatne prijave."
        disabled={busy} onPress={() => open('/profil/blokirani')} />
      <ProfileUtilityRow label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije."
        disabled={busy} onPress={() => open('/profil/izvoz')} />
      <ProfileUtilityRow label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka."
        disabled={busy} last onPress={() => open('/profil/pravna')} />
    </SettingsGroup>
    <View style={styles.logout}>
      {logoutError ? <T tone="danger" accessibilityRole="alert">Odjava nije potvrđena. Pokušaj ponovo.</T> : null}
      <SettingsAction label={busy ? 'Sačekaj…' : 'Odjavi se'} kind="quiet" disabled={busy}
        icon={<SignOut size={20} color={sys.color.muted} />} onPress={onLogout} />
    </View>
    <BuildIdentity />
  </SettingsScreen>;
}

/** Quieter account utilities preserve the same labels, hints, disabled treatment and completion-time handlers. */
function ProfileUtilityRow({ label, detail, art, disabled, last = false, featured = false, onPress }: {
  label: string; detail?: string; art?: FactArtKind; disabled: boolean; last?: boolean; featured?: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    style={[s.utility, featured && s.workEntry, last && s.utilityLast]}>
    {featured ? <WorkProfileArt /> : art ? <View style={s.utilityArt} accessible={false}
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {art === 'bell' ? <Image source={NOTIFICATION_ART} style={s.notificationArt} contentFit="contain"
        cachePolicy="memory" transition={0} allowDownscaling accessible={false} tintColor={disabled ? sys.color.muted : undefined} />
        : art === 'calendar' ? <CalendarArt size={28} quiet={disabled} />
        : art === 'clock' ? <ClockArt size={28} quiet={disabled} /> : <FactArt kind={art} size={28} cut="art" muted={disabled} />}
    </View> : null}
    <View style={s.utilityCopy}>
      <T variant={featured ? "bodyStrong" : "body"} tone={disabled ? 'muted' : 'ink'}>{label}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    <Glyph name="caret-right" size={20} tone="muted" />
  </Press>;
}

const s = StyleSheet.create({
  identitySection: { ...floating, backgroundColor: sys.color.surface, borderRadius: sys.radius.card,
    paddingHorizontal: sys.space.lg, paddingTop: sys.space.lg, paddingBottom: sys.space.base, gap: sys.space.md },
  identityCompact: { paddingHorizontal: sys.space.base },
  identity: { flexDirection: 'column', alignItems: 'center', gap: sys.space.md },
  readyIdentity: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  readyIdentityStacked: { flexDirection: 'column' },
  readyCopy: { flex: 1, alignItems: 'flex-start', alignSelf: 'auto' },
  readyCopyStacked: { flex: 0, alignItems: 'center', alignSelf: 'stretch' },
  copy: { alignSelf: 'stretch', minWidth: 0, alignItems: 'center', gap: sys.space.xs },
  city: { justifyContent: 'flex-start', maxWidth: '100%' },
  cityStacked: { justifyContent: 'center' },
  // Do not center or constrain the supplied node's children: it can contain full review comments and retry actions.
  reputation: { alignSelf: 'stretch', minWidth: 0 },
  shrink: { flexShrink: 1 },
  retry: { alignSelf: 'center', marginTop: sys.space.xs },
  name: { ...sys.type.cardTitle, textAlign: 'left', alignSelf: 'stretch' },
  nameStacked: { textAlign: 'center' },
  skeletonDisc: { width: PROFILE_AVATAR, height: PROFILE_AVATAR, borderRadius: sys.radius.pill, backgroundColor: sys.color.skeleton },
  utility: { minHeight: 56, paddingVertical: sys.space.md, flexDirection: 'row', gap: sys.space.md,
    alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  utilityLast: { borderBottomWidth: 0 },
  utilityArt: { width: 36, alignItems: 'center' },
  notificationArt: { width: 32, height: 32 },
  workEntry: { paddingVertical: sys.space.base },
  utilityCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});
