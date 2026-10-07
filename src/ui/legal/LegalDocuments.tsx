import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { LegalBundleStatus, LegalDocument, LegalDocumentKind } from '../../contracts/legal';
import type { ProcessorLegalRole, ProcessorMapProvider } from '../../contracts/processorMap';
import { legalClientService } from '../../data/legalClientService';
import { sesijaSada } from '../../store/sesija';
import { InlineNote } from '../privacy/InlineNote';
import { ProductSheet } from '../product/ProductSheet';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { FactArt } from '../system/FactArt';
import { SkeletonList } from '../system/Skeleton';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { boundedLegalRead, legalHttpsUrl, reviewedDocuments, type LegalReviewState } from './legalReview';

const legalTitle = (kind: LegalDocumentKind) => kind === 'TERMS' ? 'Uslovi korišćenja' : 'Politika privatnosti';
export const processorRoles: Record<ProcessorLegalRole, string> = { PROCESSOR: 'Obrađivač', SUBPROCESSOR: 'Podobrađivač', INDEPENDENT_CONTROLLER: 'Samostalni rukovalac' };
/** The one honest sentence when the documents are not published (and nothing is offered in their place). */
export const LEGAL_NOT_PUBLISHED = 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.';
const LEGAL_UNAVAILABLE = 'Dokumenti trenutno nisu dostupni.';

export function LegalDocumentRows({ bundle, onOpen, disabled = false }: {
  bundle: LegalBundleStatus | null; onOpen: (document: LegalDocument) => void; disabled?: boolean;
}) {
  const documents = reviewedDocuments(bundle);
  return documents ? <SettingsGroup title="Objavljeni dokumenti">{documents.map((document, index) =>
    <SettingsRow key={document.kind} label={legalTitle(document.kind)} detail="Otvara se u pregledaču"
      icon={<FactArt kind={document.kind === 'TERMS' ? 'document' : 'shield'} size={32} muted={disabled} />}
      onPress={() => onOpen(document)} disabled={disabled} last={index === 1} />)}</SettingsGroup>
    // Not green: "not published" and "not available" are not good news, so they sit on the quiet wash.
    : <InlineNote tone="neutral" art={null}>
      <View style={s.status}><FactArt kind="document" size={32} muted />
        <T style={s.grow}>{bundle ? LEGAL_NOT_PUBLISHED : LEGAL_UNAVAILABLE}</T></View>
    </InlineNote>;
}

/** An error line where the thing that failed is: under the documents for a link, above the button for a command. */
function ErrorLine({ children }: { children: string }) {
  return <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{children}</T>;
}

/** One published fact of a provider: the name above, the published text under it, in reading size. */
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.fact}><T variant="note" tone="muted">{label}</T><T selectable>{value}</T></View>;
}

function ProviderDisclosure({ provider, onOpenUrl, divider = true }: { provider: ProcessorMapProvider; onOpenUrl: (url: string) => void; divider?: boolean }) {
  const facts = ([
    ['Svrha obrade', provider.purpose], ['Podaci koji se obrađuju', provider.dataCategories.join(', ')],
    ['Regioni obrade', provider.processingRegions], ['Prenos podataka', provider.crossBorderTransfer ? provider.transferMechanism : 'Bez međunarodnog prenosa prema objavljenoj mapi.'],
    ['Čuvanje i brisanje', provider.retentionDeletionTerms], ['Podobrađivači', provider.subprocessorTerms],
    ['Osnov obrade', provider.legalBasisReference], ['Ugovor o obradi', provider.dpaReference],
  ] as const).filter(([, value]) => !!value);
  return <Disclosure divider={divider} label={provider.providerDisplayName} hint={`${provider.legalEntityName} · ${processorRoles[provider.legalRole]}`}>
    {facts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
    <SettingsAction label={`Obaveštenje o privatnosti · ${provider.providerDisplayName}`} kind="quiet" onPress={() => onOpenUrl(provider.privacyNoticeUrl)} />
  </Disclosure>;
}

/**
 * Pravila i saglasnosti (round 5, owner step 11b): whether the current documents are accepted, the two documents, and
 * who processes the data, each provider folded to its name until opened. The one command (the explicit acceptance) is
 * the footer's, with its error right above it. Presentation only: the route owns the controller, the fences and the
 * link opening; every legal word is the owner's, verbatim.
 */
export function LegalReviewView({ state, onBack, action, linkError, onOpen, onOpenUrl, onRefresh }: {
  state: LegalReviewState; onBack: () => void;
  /** The footer command for this state, or null (documents not published, or already accepted). */ action: ReactNode;
  linkError: string | null; onOpen: (document: LegalDocument) => void; onOpenUrl: (url: string) => void; onRefresh: () => void;
}) {
  const documents = reviewedDocuments(state.bundle);
  const receiptCurrent = state.receipt && documents && documents[0].sha256 === state.receipt.termsSha256 && documents[1].sha256 === state.receipt.privacySha256;
  const confirmed = state.bundle?.acceptedCurrentBundle || !!receiptCurrent;
  const processors = state.processors?.ready ? state.processors : null;
  // The first read has nothing to show yet; a re-read keeps what was read on screen, with the refresh at the end at work.
  const firstRead = state.loading && !state.bundle && !state.processors;
  const processorGroup = processors ? <SettingsGroup title="Obrađivači podataka">
    {processors.providers.map((provider, index) => <ProviderDisclosure key={provider.providerCode} provider={provider} onOpenUrl={onOpenUrl} divider={index > 0} />)}
  </SettingsGroup> : null;
  return <SettingsScreen title="Pravila i saglasnosti" onBack={onBack} footer={action ? <>{state.error ? <ErrorLine>{state.error}</ErrorLine> : null}{action}</> : null}>
    {firstRead ? <View accessible accessibilityLabel="Učitavanje pravnih dokumenata"><SkeletonList count={2} rows={2} /></View> : <>
      {!action && state.error && documents ? <InlineNote tone="danger">{state.error}</InlineNote> : null}
      {/* A record, not a celebration: the state of the acceptance stands above what it is about. */}
      {confirmed ? <View style={s.status}><FactArt kind="check" size={22} />
        <T style={s.grow} accessibilityLiveRegion="polite">Prihvaćene su aktuelne verzije dokumenata.</T></View>
        : state.receipt ? <View style={s.status}><FactArt kind="info" size={22} />
          <T style={s.grow}>Prethodno prihvatanje je potvrđeno. Učitaj aktuelne dokumente ponovo.</T></View> : null}
      {documents ? <>
        <View style={s.documents}>
          <LegalDocumentRows bundle={state.bundle} disabled={state.busy} onOpen={onOpen} />
          {linkError ? <ErrorLine>{linkError}</ErrorLine> : null}
        </View>
        {processorGroup ?? <InlineNote tone="quiet" art={null}>{state.processorError ?? 'Podaci o obrađivačima još nisu objavljeni.'}</InlineNote>}
        <SettingsAction label="Osveži stanje" kind="quiet" disabled={state.busy} loading={state.loading} onPress={onRefresh} />
      </> : <>
        {/* Nothing to read: ONE honest sentence and the one way to look again. No row for a document that does not exist, no empty
            group for who processes the data, and no accept action (the route draws none without documents). */}
        {state.bundle
          ? <StateView kind="empty" art="document" title={LEGAL_NOT_PUBLISHED} quiet={{ label: 'Proveri ponovo', onPress: onRefresh, disabled: state.busy || state.loading }} />
          : <StateView kind="error" art="document" title="Dokumenti nisu dostupni" body={state.error ?? LEGAL_UNAVAILABLE}
            primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: state.busy || state.loading }} />}
        {processorGroup}
      </>}
    </>}
  </SettingsScreen>;
}

/**
 * Public read-only sheet (the sign-up screen, once the documents are published). Closing it leaves every Auth field and
 * checkbox in place. It reads anonymously and never records consent: there is no accept action in it.
 */
export function PublicLegalModal({ kind, onClose }: { kind: LegalDocumentKind | null; onClose: () => void }) {
  return kind ? <ProductSheet title={legalTitle(kind)} closeLabel="Zatvori" onClose={onClose}>
    {() => <PublicLegalContents />}
  </ProductSheet> : null;
}
export const PublicLegalSheet = PublicLegalModal;

function PublicLegalContents() {
  const [bundle, setBundle] = useState<LegalBundleStatus | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const scope = useRef<object | null>(null);
  const owner = useRef(sesijaSada()); const opening = useRef(false);
  const current = (token: object | null) => !!token && scope.current === token &&
    sesijaSada().user?.id === owner.current.user?.id && sesijaSada().accountRevision === owner.current.accountRevision;
  const read = useCallback(async () => {
    const token = {}; scope.current = token; setLoading(true); setError(null); setBundle(null);
    try { const result = await boundedLegalRead(() => legalClientService.readBundle());
      if (!current(token)) return;
      if (result.ok) setBundle(result.podatak); else setError(result.poruka);
    } catch { if (current(token)) setError('Dokumenti trenutno nisu dostupni. Pokušaj ponovo.'); }
    finally { if (current(token)) setLoading(false); }
  }, []);
  useEffect(() => { void read(); return () => { scope.current = null; }; }, [read]);
  const open = async (document: LegalDocument) => {
    const token = scope.current, url = legalHttpsUrl(document.url);
    if (!current(token) || !url || opening.current) return;
    opening.current = true; setError(null);
    try { await Linking.openURL(url); }
    catch { if (current(token)) setError('Dokument nije otvoren. Pokušaj ponovo.'); }
    finally { opening.current = false; }
  };
  return <PublicLegalBody loading={loading} bundle={bundle} error={error} onOpen={doc => { void open(doc); }} onRefresh={() => { void read(); }} />;
}

/** The sheet's content, drawn from what it has read (the gallery draws it from fixtures). */
export function PublicLegalBody({ loading, bundle, error, onOpen, onRefresh }: {
  loading: boolean; bundle: LegalBundleStatus | null; error: string | null; onOpen: (document: LegalDocument) => void; onRefresh: () => void;
}) {
  return <View style={s.sheet}>
    {/* The invitation to read is only said when there is something to read. */}
    {!loading && reviewedDocuments(bundle) ? <T variant="copy" tone="muted">Otvori objavljene dokumente. Posle čitanja možeš nastaviti svoj formular.</T> : null}
    {loading ? <View accessible accessibilityLabel="Učitavanje pravnih dokumenata"><SkeletonList count={2} rows={1} /></View>
      : <LegalDocumentRows bundle={bundle} onOpen={onOpen} />}
    {error ? <ErrorLine>{error}</ErrorLine> : null}
    {!loading ? <SettingsAction label="Osveži dokumente" kind="quiet" onPress={onRefresh} /> : null}
  </View>;
}

const s = StyleSheet.create({
  fact: { gap: 2 },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  grow: { flex: 1, minWidth: 0 },
  documents: { gap: sys.space.sm },
  sheet: { gap: sys.space.base },
});
