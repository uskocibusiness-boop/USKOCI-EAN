import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
export { mediaAssetId } from '../../data/mediaAssetId';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
// Bounded in-memory representation; no signed URL or persistent image cache.
import { jpegDataUri } from './jpegDataUri';

type PhotoAttempt = { visit: object; binding: string; abort: AbortController; phase: 'loading' | 'image' | 'failed' };
type PhotoState = { attempt: PhotoAttempt; uri: string | null } | null;

export function AuthorizedPhoto(p: { assetId: string; needId?: string; profileId?: string; caseId?: string; agreementId?: string; messageId?: string; label: string; style?: StyleProp<ViewStyle>; contentFit?: 'contain' | 'cover';
  /** Only a loaded image can open its viewer; failure recovery stays a separate target. */
  open?: { label: string; hint?: string; onPress: () => void };
  /** Optional decorative identity while authorization/image data is pending; never a retained photo. */ pending?: ReactNode;
  /** Drawn instead of the failure sentence when the photo cannot be read, e.g. initials in a small avatar. */ unavailable?: ReactNode }) {
  const { user, accountRevision } = useSesija();
  const binding = `${user?.id}:${accountRevision}:${p.assetId}:${p.needId ?? ''}:${p.profileId ?? ''}:${p.caseId ?? ''}:${p.agreementId ?? ''}:${p.messageId ?? ''}`;
  const renderedBinding = useRef(binding); renderedBinding.current = binding;
  const opening = useRef(p.open); opening.current = p.open;
  const [state, setState] = useState<PhotoState>(null);
  const active = useRef<object | null>(null);
  const request = useRef<PhotoAttempt | null>(null);
  const ownsVisit = useCallback((visit: object) => active.current === visit && renderedBinding.current === binding
    && !!user?.id && sesijaSada().user?.id === user.id && sesijaSada().accountRevision === accountRevision,
  [binding, user?.id, accountRevision]);
  const current = useCallback((attempt: PhotoAttempt) => request.current === attempt && !attempt.abort.signal.aborted
    && attempt.binding === binding && ownsVisit(attempt.visit), [binding, ownsVisit]);
  const fail = useCallback((attempt: PhotoAttempt) => {
    if (!current(attempt) || attempt.phase === 'failed') return;
    attempt.phase = 'failed'; setState({ attempt, uri: null });
  }, [current]);
  const read = useCallback((visit: object, retry?: PhotoAttempt) => {
    if (!ownsVisit(visit)) return;
    // Retained presses belong to one failed attempt. The synchronous reservation
    // blocks a second press before React has replaced the failure with its spinner.
    if (retry ? request.current !== retry || retry.phase !== 'failed' : request.current !== null) return;
    request.current?.abort.abort();
    const attempt: PhotoAttempt = { visit, binding, abort: new AbortController(), phase: 'loading' };
    request.current = attempt; setState({ attempt, uri: null });
    void (async () => {
      try {
        const result = await mediaClientService.readMedia(p.assetId, { ...(p.needId ? { needId: p.needId } : {}),
          ...(p.profileId ? { profileId: p.profileId } : {}), ...(p.caseId ? { caseId: p.caseId } : {}),
          ...(p.agreementId ? { agreementId: p.agreementId } : {}), ...(p.messageId ? { messageId: p.messageId } : {}) }, { signal: attempt.abort.signal });
        if (!current(attempt)) return;
        if (!result.ok) { fail(attempt); return; }
        const uri = jpegDataUri(result.podatak.bytes);
        attempt.phase = 'image'; setState({ attempt, uri });
      } catch { fail(attempt); }
    })();
  }, [binding, current, fail, ownsVisit, p.assetId, p.needId, p.profileId, p.caseId, p.agreementId, p.messageId]);
  useFocusEffect(useCallback(() => {
    const visit = {}; active.current = visit; setState(null); read(visit);
    return () => {
      if (active.current !== visit) return;
      active.current = null; request.current?.abort.abort(); request.current = null; setState(null);
    };
  }, [read]));
  const shown = state && current(state.attempt) ? state : null;
  const image = shown?.attempt.phase === 'image' && shown.uri ? <Image source={{ uri: shown.uri }} accessibilityLabel={p.label}
    accessible={!p.open} contentFit={p.contentFit ?? 'contain'} cachePolicy="none" recyclingKey={binding}
    onError={() => fail(shown.attempt)} transition={0} style={{ width: '100%', height: '100%' }} /> : null;
  return <View style={[{ aspectRatio: 4 / 3, backgroundColor: sys.color.wash, borderRadius: sys.radius.control, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center' }, p.style]}>
    {image ? p.open ? <Press accessibilityRole="button" accessibilityLabel={p.open.label} accessibilityHint={p.open.hint}
      onPress={() => { if (shown && current(shown.attempt) && shown.attempt.phase === 'image' && opening.current === p.open) p.open?.onPress(); }}
      scaleTo={1} style={{ width: '100%', height: '100%' }}>{image}</Press> : image
      // The entire failure frame is the target: a separate button below the old
      // multi-line notice would be clipped in the 96px prepared-photo thumbnail.
      : shown?.attempt.phase === 'failed' ? p.unavailable ?? <Press accessibilityRole="button"
        accessibilityLabel={`Pokušaj ponovo · ${p.label}`} accessibilityHint="Fotografija trenutno nije dostupna. Ponovo učitaj fotografiju."
        onPress={() => read(shown.attempt.visit, shown.attempt)}
        style={{ width: '100%', height: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, padding: sys.space.xs }}>
        <FactArt kind="photo" size={24} muted />
        <T variant="note" style={{ color: sys.color.green, textAlign: 'center' }}>Pokušaj ponovo</T>
      </Press>
        : p.pending ? <View accessible accessibilityLabel="Učitavanje fotografije" accessibilityState={{ busy: true }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{p.pending}</View>
        </View> : <ActivityIndicator size="small" accessibilityLabel="Učitavanje fotografije" color={sys.color.green} />}
  </View>;
}
