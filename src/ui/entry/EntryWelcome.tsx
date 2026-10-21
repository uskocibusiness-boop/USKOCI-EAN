import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { sesijaSada, useSesija } from '../../store/sesija';
import { Press } from '../Press';
import { T } from '../Text';
import { profileLift, sys } from '../system/tokens';

type Intent = 'REQUESTER' | 'WORKER';
export type EntryIntentSelection = { isCurrent: () => boolean };

// Exact original assets from the approved Figma welcome (2:138), kept as
// separate images rather than flattening the screen into a bitmap.
const logo = require('../../../assets/brand/premium-entry/logo.png');
const publish = require('../../../assets/brand/premium-entry/publish.png');
const discover = require('../../../assets/brand/premium-entry/discover.png');

export function EntryWelcome({ onRequester, onWorker, onSignIn, onSignUp, busy = false, error }: {
  onRequester: (selection: EntryIntentSelection) => void | Promise<void>;
  onWorker: (selection: EntryIntentSelection) => void | Promise<void>;
  onSignIn: () => void;
  onSignUp?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useSystemReducedMotion();
  const { onLayout, onSceneReady } = useEntrySplashReady({ waitForScene: true });
  const session = useSesija();
  const account = session.accountRevision;
  const [selected, setSelected] = useState<Intent | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const pending = useRef<{ generation: number } | null>(null);
  const generation = useRef(0);
  const loaded = useRef(new Set<string>());

  const acknowledgeImage = useCallback((name: string) => {
    if (loaded.current.has(name)) return;
    loaded.current.add(name);
    if (loaded.current.size === 3) onSceneReady();
  }, [onSceneReady]);

  // A callback may finish after a different account, a background transition or
  // a replacement choice. Its isCurrent guard must become false immediately.
  useEffect(() => {
    const cancel = () => {
      generation.current += 1;
      pending.current = null;
      setSelected(null);
    };
    cancel();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') cancel();
    });
    return () => {
      generation.current += 1;
      pending.current = null;
      subscription.remove();
    };
  }, [account, reducedMotion, width, height, fontScale]);

  const available = !busy && !selected && !session.user;
  const choose = (intent: Intent) => {
    if (!available || pending.current || sesijaSada().accountRevision !== account || sesijaSada().user) return;
    const id = ++generation.current;
    pending.current = { generation: id };
    setSelected(intent);
    setSelectionError(null);
    const isCurrent = () => generation.current === id && pending.current?.generation === id &&
      sesijaSada().accountRevision === account && !sesijaSada().user;
    const callback = intent === 'REQUESTER' ? onRequester : onWorker;
    const deliver = async () => {
      if (!isCurrent()) return;
      try { await callback({ isCurrent }); }
      catch { if (isCurrent()) setSelectionError('Izbor trenutno nije sačuvan. Pokušaj ponovo.'); }
      finally {
        if (generation.current === id) {
          pending.current = null;
          setSelected(null);
        }
      }
    };
    // Artwork never delays the real intent write. Press supplies the shared
    // tactile response and honors the system's reduced-motion preference.
    void deliver();
  };
  const cancelChoice = () => {
    if (busy) return;
    generation.current += 1;
    pending.current = null;
    setSelected(null);
  };
  const openAuth = (callback?: () => void) => {
    if (!callback || !available || pending.current || sesijaSada().accountRevision !== account || sesijaSada().user) return;
    callback();
  };

  // Artwork tiles remain separate actions and fit narrow Android screens; at
  // large font sizes the ScrollView grows instead of clipping the copy.
  const gutter = width < 350 ? 16 : 20;
  const cardPadding = width < 350 ? 16 : 20;
  const artGap = width < 350 ? 12 : 20;
  const artSize = Math.min(140, Math.max(80, (width - 2 * gutter - 2 * cardPadding - artGap) / 2));
  const logoWidth = Math.min(285, Math.max(0, width - 2 * gutter - 2 * cardPadding));

  return <View testID="entry-welcome" onLayout={onLayout} style={styles.root}>
    <ScrollView testID="entry-scroll" scrollEnabled={!selected} bounces={false}
      accessibilityElementsHidden={!!selected} importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter,
        paddingTop: Math.max(24, insets.top + (height < 700 ? 12 : 36)), paddingBottom: Math.max(24, insets.bottom + 24) }]}>
      <View testID="entry-card" style={[styles.card, { padding: cardPadding }]}>
        <Image testID="entry-logo" source={logo} contentFit="contain" transition={0}
          style={{ width: logoWidth, height: logoWidth / 3, alignSelf: 'center' }}
          accessible accessibilityLabel="USKOČI" onLoad={() => acknowledgeImage('logo')} />
        <T testID="entry-title" style={[styles.title, width < 350 && styles.narrowTitle]}>Za svaki zadatak,{`\n`}prava osoba.</T>
        <T style={styles.description}>Objavi šta ti treba ili uskoči svojim vremenom i znanjem.</T>
        <View style={[styles.choices, { gap: artGap }]}>
          <Press testID="entry-requester" accessibilityRole="button" accessibilityLabel="Objavi zadatak"
            accessibilityHint="Pripremi objavljivanje zadatka. Isti nalog može i da se prijavljuje na zadatke."
            accessibilityState={{ disabled: !available, busy: selected === 'REQUESTER' }}
            disabled={!available} haptic={available ? 'select' : 'none'} scaleTo={sys.motion.scale.button}
            onPress={() => choose('REQUESTER')} style={[styles.choice, { width: artSize }]}>
            <Image testID="entry-art-publish" source={publish} contentFit="contain" transition={0}
              style={{ width: artSize, height: artSize }} accessible={false} onLoad={() => acknowledgeImage('publish')} />
            <T style={styles.choiceLabel}>Objavi zadatak</T>
          </Press>
          <Press testID="entry-worker" accessibilityRole="button" accessibilityLabel="Uskoči i zaradi"
            accessibilityHint="Pronađi zadatke koji ti odgovaraju. Isti nalog može i da objavljuje zadatke."
            accessibilityState={{ disabled: !available, busy: selected === 'WORKER' }}
            disabled={!available} haptic={available ? 'select' : 'none'} scaleTo={sys.motion.scale.button}
            onPress={() => choose('WORKER')} style={[styles.choice, { width: artSize }]}>
            <Image testID="entry-art-discover" source={discover} contentFit="contain" transition={0}
              style={{ width: artSize, height: artSize }} accessible={false} onLoad={() => acknowledgeImage('discover')} />
            <T style={styles.choiceLabel}>Uskoči i zaradi</T>
          </Press>
        </View>
      </View>
      <View testID="entry-auth-footer" style={styles.authFooter}>
        <Press accessibilityRole="button" accessibilityLabel="Prijavi se" disabled={!available}
          accessibilityState={{ disabled: !available }} haptic={available ? 'select' : 'none'}
          scaleTo={sys.motion.scale.button} onPress={() => openAuth(onSignIn)} style={styles.signIn}>
          <T style={styles.signInText}>Prijavi se</T>
        </Press>
        {onSignUp ? <Press accessibilityRole="button" accessibilityLabel="Napravi nalog" disabled={!available}
          accessibilityState={{ disabled: !available }} haptic={available ? 'select' : 'none'}
          scaleTo={sys.motion.scale.button} onPress={() => openAuth(onSignUp)} style={styles.signUp}>
          <T style={styles.signUpText}>Napravi nalog</T>
        </Press> : null}
        {(error || selectionError) ? <T accessibilityRole="alert" style={styles.error}>{error || selectionError}</T> : null}
        <View style={styles.footnote}>
          <T style={styles.footnoteText}>Jedan nalog za obe uloge</T>
        </View>
      </View>
    </ScrollView>
    {selected ? <View testID="entry-preparing" style={styles.preparingCover}
      accessibilityViewIsModal importantForAccessibility="yes">
      <View style={styles.preparingCard}>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Pripremamo izbor"
          accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={styles.preparingStatus}>
          {!reducedMotion ? <ActivityIndicator accessible={false} color={sys.color.green} size="small" /> : null}
          <T style={styles.preparingText}>{selected === 'REQUESTER' ? 'Pripremamo objavu…' : 'Pripremamo zadatke…'}</T>
        </View>
        {!busy ? <Press accessibilityRole="button" accessibilityLabel="Otkaži izbor" scaleTo={1}
          onPress={cancelChoice} style={styles.cancel}>
          <T style={styles.cancelText}>Otkaži</T>
        </Press> : null}
      </View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sys.color.wash },
  content: { flexGrow: 1, alignItems: 'stretch', gap: 20 },
  card: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 24, gap: 16 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.9,
    color: sys.color.ink, includeFontPadding: false },
  narrowTitle: { fontSize: 28, lineHeight: 34 },
  description: { fontSize: 15, lineHeight: 22, color: sys.color.muted, includeFontPadding: false },
  choices: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  choice: { alignItems: 'center', justifyContent: 'flex-start', minHeight: 48, gap: 4 },
  choiceLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center',
    color: sys.color.ink, includeFontPadding: false },
  authFooter: { gap: 12 },
  signIn: { minHeight: 54, borderRadius: 16, backgroundColor: sys.color.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  signInText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: sys.color.onGreen },
  signUp: { ...profileLift, minHeight: 54, borderRadius: 16, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  signUpText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: sys.color.ink },
  footnote: { alignItems: 'center', gap: 2, marginTop: 4 },
  footnoteText: { fontSize: 13, lineHeight: 18, color: sys.color.muted, textAlign: 'center' },
  error: { color: sys.color.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  preparingCover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23, 34, 29, 0.24)',
    alignItems: 'center', justifyContent: 'center', padding: 24 },
  preparingCard: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 320, alignItems: 'center', gap: 20 },
  preparingStatus: { alignItems: 'center', gap: 12 },
  preparingText: { color: sys.color.ink, fontSize: 16, lineHeight: 23, fontWeight: '600', textAlign: 'center' },
  cancel: { minWidth: 96, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: sys.color.green, fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
