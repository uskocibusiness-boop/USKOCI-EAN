import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RetentionExecutionStatus, RetentionPolicyStatus, RetentionRule } from '../../contracts/retentionPolicy';
import { SettingsAction, SettingsGroup, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { FactArt } from '../system/FactArt';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { InlineNote, PlainSection } from './InlineNote';

/** The person's names for the published data classes (owner's wording, kept verbatim). */
export const retentionLabels: Readonly<Record<string, string>> = {
  ACCOUNT_IDENTITY: 'Nalog i identitet', PROFILE_DATA: 'Podaci profila', NEED_PUBLIC: 'Javni podaci zadatka',
  NEED_SENSITIVE: 'Privatni podaci zadatka', RESPONSES_SELECTION: 'Prijave i izbor', PRESELECTION_QA: 'Pitanja pre Dogovora',
  AGREEMENT_CORE: 'Dogovori', AGREEMENT_MESSAGES: 'Poruke u Dogovoru', LEGAL_CONSENT: 'Prihvatanje uslova',
  NOTIFICATION_DELIVERY: 'Obaveštenja', AI_VOLATILE: 'AI razgovori i izdvojeni podaci', MEDIA_OBJECTS: 'Fotografije i datoteke',
  COMMAND_LEDGERS: 'Potvrde radnji', AUDIT_SECURITY_LOGS: 'Evidencija aktivnosti i bezbednosti',
};

/** The key a rule opens under: its policy version with it, so an opened rule never carries over to a new version. */
export const ruleKey = (policyVersion: string, rule: RetentionRule) => `${policyVersion}:${rule.dataClass}`;

/**
 * What a reader holds. `refreshing` is a re-read the person asked for while the last answer stays on screen (the retained
 * refresh of `useFocusedResource`); `refreshError` is such a re-read that failed, with the last answer still in `data`.
 */
export type PrivacyRead<T> = { loading: boolean; error: boolean; data: T | null; refreshing?: boolean; refreshError?: boolean };

/**
 * Privatnost i podaci, drawn from what the two readers hold (round 5, owner step 11b). Calm and in the order a person
 * asks: who sees what, the two account-data actions, how long each kind is kept and whether abandoned AI conversations
 * are removed on their own. It has no primary action: nothing here is done every day.
 *
 * The two actions sit right under the visibility (round 5 review): support's "Izvoz i zatvaranje naloga" leads here, and
 * under up to fourteen retention rows they were below the fold. A failed read has its retry right under its own note.
 * A re-read the person asks for leaves the rules on screen and shows the refresh at work; a re-read that failed says so
 * above the rules it could not renew.
 *
 * Presentation only. The route owns the reads, the focus fence and every navigation; `dataRows` are its two rows.
 */
export function PrivacyBody({ policy, execution, admitted, expandedRule, onToggle, onRefresh, dataRows }: {
  policy: PrivacyRead<RetentionPolicyStatus>; execution: PrivacyRead<RetentionExecutionStatus>;
  /** Automatic deletion is admitted for the one published version both readers name. */ admitted: boolean;
  expandedRule: string | null; onToggle: (key: string, next: boolean) => void;
  onRefresh: () => void; dataRows: ReactNode;
}) {
  const published = policy.data?.ready ? policy.data : null;
  const reading = policy.loading || execution.loading || !!policy.refreshing || !!execution.refreshing;
  const refresh = <SettingsAction label="Osveži stanje" kind="quiet" disabled={reading} loading={!!policy.refreshing || !!execution.refreshing} onPress={onRefresh} />;
  return <>
    <SettingsGroup title="Ko šta vidi">
      <VisibilityFact title="Javni podaci zadatka" icon={<FactArt kind="eye" size={26} />}>
        Opis objavljenog zadatka i njegova približna lokacija dostupni su drugim korisnicima.
      </VisibilityFact>
      <VisibilityFact title="Lokacija i kontakt" last icon={<FactArt kind="lock" size={26} />}>
        Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup. Zadaci na daljinu nemaju adresu ni pin.
      </VisibilityFact>
    </SettingsGroup>

    <SettingsGroup title="Tvoji podaci">{dataRows}</SettingsGroup>

    {policy.loading ? <PlainSection title="Rokovi čuvanja">
      <StateView kind="loading" title="Učitavamo rokove čuvanja…" skeleton={{ count: 1, rows: 3 }} />
    </PlainSection> : policy.error ? <PlainSection title="Rokovi čuvanja">
      <InlineNote tone="danger">Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.</InlineNote>
      {refresh}
    </PlainSection> : published ? <>
      {/* The last answer stays on screen; this says it could not be renewed, and the refresh below is the retry. */}
      {policy.refreshError ? <InlineNote tone="danger">Rokovi čuvanja nisu osveženi. Prikazano je ono što je poslednji put učitano.</InlineNote> : null}
      <SettingsGroup title="Rokovi čuvanja">
        {published.rules.map((rule, index) => {
          const key = ruleKey(published.policyVersion, rule);
          return <Disclosure key={key} label={retentionLabels[rule.dataClass] ?? rule.purpose} divider={index > 0}
            expanded={expandedRule === key} onToggle={next => onToggle(key, next)}>
            <Fact label="Svrha" value={rule.purpose} />
            <Fact label="Rok" value={rule.retentionPeriod} />
            <Fact label="Kada se briše" value={rule.deletionTrigger} />
            <Fact label="Izuzeci" value={rule.exceptionRule} />
            <Fact label="Pravni osnov" value={rule.legalBasis} />
          </Disclosure>;
        })}
      </SettingsGroup>
    </> : <PlainSection title="Rokovi čuvanja">
      <InlineNote tone="quiet">Potpun raspored rokova čuvanja još nije dostupan.</InlineNote>
    </PlainSection>}

    {/* Not green: the line under it may say the feature is off or not confirmed, and green would read "all good". A read
        that failed takes the one look for "failed", the danger note (round 5 review); every other state is the wash. */}
    <InlineNote tone={execution.error ? 'danger' : 'neutral'} art={null}>
      <View style={s.executionHead}>
        <View style={s.executionIcon}><FactArt kind="clock" size={22} muted={execution.error} /></View>
        <T variant="bodyStrong" style={s.visibilityTitle}>Automatsko brisanje napuštenih razgovora</T>
      </View>
      {execution.loading ? <T variant="note" tone="muted">Proveravamo dostupnost…</T>
        : execution.error || (execution.data?.executionAdmitted && !admitted)
          ? <T variant="note" tone={execution.error ? 'danger' : 'ink'} accessibilityRole="alert">Dostupnost automatskog brisanja nije potvrđena.</T>
          : admitted ? <T variant="note" tone="muted">Automatsko brisanje je omogućeno samo za napuštene AI razgovore bez zadatka i sačuvanih podataka. Primenjuju se objavljena pravila i izuzeci. Ovo nije potvrda da je određeni razgovor obrisan.</T>
            : <T variant="note" tone="muted">Automatsko brisanje napuštenih AI razgovora trenutno nije dostupno.</T>}
    </InlineNote>
    {/* The retry of a failed retention read stands under its note above; one refresh on the screen at a time. */}
    {policy.error && !policy.loading ? null : refresh}
  </>;
}

/** Keep the illustration with its heading; privacy paragraphs use the full reading width. */
function VisibilityFact({ title, icon, children, last = false }: { title: string; icon: ReactNode; children: ReactNode; last?: boolean }) {
  return <View style={[s.visibility, last && s.visibilityLast]}>
    <View style={s.visibilityHead}>
      <View style={s.visibilityIcon}>{icon}</View>
      <T variant="bodyStrong" style={s.visibilityTitle}>{title}</T>
    </View>
    <T variant="note" tone="muted">{children}</T>
  </View>;
}

/** One published fact of a rule: the name above, the owner's text under it, in reading size (it was 13 px meta). */
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.fact}>
    <T variant="note" tone="muted">{label}</T>
    <T selectable>{value}</T>
  </View>;
}

const s = StyleSheet.create({
  visibility: { minHeight: 56, paddingVertical: sys.space.md, gap: sys.space.sm, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  visibilityLast: { borderBottomWidth: 0 },
  visibilityHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  visibilityIcon: { width: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  visibilityTitle: { flex: 1, minWidth: 0 },
  executionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  executionIcon: { paddingTop: 1 },
  fact: { gap: 2 },
});
