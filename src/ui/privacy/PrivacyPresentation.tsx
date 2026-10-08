import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RetentionExecutionStatus, RetentionPolicyStatus, RetentionRule } from '../../contracts/retentionPolicy';
import { SettingsGroup, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { ListRow } from '../system/ListRow';
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
 * Privatnost i podaci, drawn from what the two readers hold (round 5, owner step 11b; UI/UX pass 2026-10-08, F6, composition spec
 * 4.15). Calm and in the order a person asks: who sees what, the two account-data actions, how long each kind is kept and whether
 * abandoned AI conversations are removed on their own. It has no primary action: nothing here is done every day.
 *
 * ONE EDGE for the words of the whole screen (the picture-less edge): what only TELLS is a line of text with no picture and no arrow
 * ("Ko šta vidi" are two such lines), what LEADS somewhere is a row with its arrow (the two data rows), and what opens in place is a row
 * with its caret (the retention rules). Nothing that only tells looks like a link any more.
 *
 * The two actions sit right under the visibility (round 5 review): support's "Izvoz i zatvaranje naloga" leads here, and
 * under up to fourteen retention rows they were below the fold. The refresh is one word at the end of the title of the section it
 * renews ("Rokovi čuvanja"). A failed read has its note under its own title. A re-read the person asks for leaves the rules on screen
 * and shows the refresh at work; a re-read that failed says so above the rules it could not renew.
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
  const refreshing = !!policy.refreshing || !!execution.refreshing;
  const reading = policy.loading || execution.loading || refreshing;
  // A re-read that failed leaves the last answer in `data`, but the claim it makes is no longer confirmed: it is said as not confirmed.
  const executionFailed = execution.error || !!execution.refreshError;
  // One word at the end of the title of what it renews. Not while the first read runs (nothing to renew); a re-read at work says so.
  const refresh = policy.loading || execution.loading ? undefined
    : { label: refreshing ? 'Osvežavamo…' : 'Osveži', accessibilityLabel: 'Osveži rokove čuvanja', onPress: () => { if (!reading) onRefresh(); } };
  return <>
    <SettingsGroup title="Ko šta vidi">
      <ListRow title="Javni podaci zadatka" subtitle="Opis objavljenog zadatka i njegovo približno mesto vide druge osobe." />
      <ListRow last title="Lokacija i kontakt"
        subtitle="Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup. Zadaci na daljinu nemaju adresu ni oznaku na mapi." />
    </SettingsGroup>

    <SettingsGroup title="Tvoji podaci">{dataRows}</SettingsGroup>

    {policy.loading ? <PlainSection title="Rokovi čuvanja">
      <StateView kind="loading" title="Učitavamo rokove čuvanja…" skeleton={{ count: 1, rows: 3 }} />
    </PlainSection> : policy.error ? <PlainSection title="Rokovi čuvanja" action={refresh}>
      <InlineNote tone="danger">Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.</InlineNote>
    </PlainSection> : published ? <>
      {/* The last answer stays on screen; this says it could not be renewed, and the word at the end of the title is the retry. */}
      <SettingsGroup title="Rokovi čuvanja" action={refresh}>
        {policy.refreshError ? <View style={s.above}><InlineNote tone="danger">Rokovi čuvanja nisu osveženi. Prikazano je ono što je poslednji put učitano.</InlineNote></View> : null}
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
    </> : <PlainSection title="Rokovi čuvanja" action={refresh}>
      <InlineNote tone="quiet" art={null}>Potpun raspored rokova čuvanja još nije dostupan.</InlineNote>
    </PlainSection>}

    {/* Not green: the line under it may say the feature is off or not confirmed, and green would read "all good". A read
        that failed takes the one look for "failed", the danger note (round 5 review); every other state is plain words. */}
    <SettingsGroup title="Automatsko brisanje napuštenih razgovora">
      {execution.loading ? <T variant="copy" tone="muted">Proveravamo dostupnost…</T>
        : executionFailed || (execution.data?.executionAdmitted && !admitted)
          ? <InlineNote tone={executionFailed ? 'danger' : 'neutral'} art={null} alert>Dostupnost automatskog brisanja nije potvrđena.</InlineNote>
          : admitted ? <T variant="copy" tone="muted">Automatsko brisanje je omogućeno samo za napuštene AI razgovore bez zadatka i sačuvanih podataka. Primenjuju se objavljena pravila i izuzeci. Ovo nije potvrda da je određeni razgovor obrisan.</T>
            : <T variant="copy" tone="muted">Automatsko brisanje napuštenih AI razgovora trenutno nije dostupno.</T>}
    </SettingsGroup>
  </>;
}

/** One published fact of a rule: the name above, the owner's text under it, in reading size (it was 13 px meta). */
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.fact}>
    <T variant="note" tone="muted">{label}</T>
    <T selectable>{value}</T>
  </View>;
}

const s = StyleSheet.create({
  fact: { gap: sys.space.xs },
  above: { marginBottom: sys.space.sm },
});
