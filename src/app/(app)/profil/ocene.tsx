import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ownProfileClientService } from '../../../data/ownProfileClientService';
import { reviewCommentBuilt } from '../../../data/reviewCommentGate';
import { accountReputationLabel, reviewsClientService, type AccountReputation } from '../../../data/reviewsClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { useSesija } from '../../../store/sesija';
import { ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { GivenRatings, ReceivedRatings, RatingsScreen, type GivenView, type RatingsTab, type ReceivedView } from '../../../ui/reviews/RatingsPresentation';
import { ReviewCommentsSection, type ReviewCommentPhoto } from '../../../ui/reviews/ReviewCommentsSection';
import { useGivenRatings } from '../../../ui/reviews/useGivenRatings';

/** A reviewer's photo under "Komentari" (D12, only in a build with the flag): the same profile photo as everywhere, at the size asked for. */
const commentPhoto: ReviewCommentPhoto = (profileId, size, fallback) => <ProfilePhoto profileId={profileId} size={size} fallback={fallback} />;

/**
 * Ocene (T4a, 2026-10-07): where the rating line of the profile leads. "Primljene" is what the account's own reputation read and, in
 * a build with the written comments, the comments about the person; "Date" is the ratings the person left, read from their finished
 * Dogovori only when the tab is opened. `?tab=date` opens it on "Date". The screen reads and navigates; what is drawn is
 * `RatingsPresentation`.
 */
export default function Ocene() {
  const { user, accountRevision } = useSesija();
  return <OwnedRatings key={`${user?.id ?? ''}:${accountRevision}`} accountId={user?.id ?? null} />;
}

const receivedView = (state: { loading: boolean; error: boolean; data: AccountReputation | null }, onRetry: () => void): ReceivedView =>
  state.loading ? { kind: 'loading' } : state.error || !state.data ? { kind: 'error', onRetry }
    : state.data.reviewCount === 0 ? { kind: 'none' } : { kind: 'rated', label: accountReputationLabel(state.data) };

function OwnedRatings({ accountId }: { accountId: string | null }) {
  const { tab: asked } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<RatingsTab>(asked === 'date' ? 'given' : 'received');
  const [givenOpened, setGivenOpened] = useState(asked === 'date');
  const focus = useRef<object | null>(null), navigating = useRef(false);
  // This screen stays mounted between visits, so a tab named by the link is taken on every focus.
  useFocusEffect(useCallback(() => {
    const visit = {}; focus.current = visit; navigating.current = false;
    if (asked === 'date') { setTab('given'); setGivenOpened(true); } else if (asked === 'primljene') setTab('received');
    return () => { if (focus.current === visit) focus.current = null; };
  }, [asked]));
  const go = (action: () => void) => { if (focus.current === null || navigating.current) return; navigating.current = true; action(); };

  const reputation = useFocusedResource(useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId ?? '');
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]));
  // The comments are listed under a profile of the account (the list is account-level); only a build with them reads it.
  const commentsBuilt = reviewCommentBuilt();
  const profile = useFocusedResource(useCallback(async () => {
    if (!commentsBuilt || !accountId) return null;
    const [identity, capability] = await Promise.all([ownProfileClientService.read(accountId, 'narucilac'), ownProfileClientService.read(accountId, 'uskocer')]);
    return (identity ?? capability)?.profileId ?? null;
  }, [accountId, commentsBuilt]));
  const profileId = profile.data ?? null;

  const choose = (next: RatingsTab) => { setTab(next); if (next === 'given') setGivenOpened(true); };
  return <RatingsScreen tab={tab} onTab={choose} givenOpened={givenOpened}
    onBack={() => go(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
    received={<ReceivedRatings view={receivedView(reputation, () => { void reputation.refresh(); })}
      comments={commentsBuilt && profileId ? <ReviewCommentsSection profileId={profileId} photo={commentPhoto} /> : null} />}
    given={<GivenTab open={agreementId => go(() => router.navigate({ pathname: '/dogovor/[id]', params: { id: agreementId } }))} />} />;
}

/** The body of "Date". It is mounted only after the tab was opened, because mounting it is what reads the Dogovori. */
function GivenTab({ open }: { open: (agreementId: string) => void }) {
  const given = useGivenRatings();
  const view: GivenView = given.phase === 'loading' ? { kind: 'loading' } : given.phase === 'error' ? { kind: 'error', onRetry: given.refresh }
    : { kind: 'ready', rows: given.rows.map(row => ({ ...row, onOpen: () => open(row.agreementId) })), failed: given.failedCount,
      onRetryFailed: given.retryFailed, older: given.older, onMore: given.more, working: given.working };
  return <GivenRatings view={view} />;
}
