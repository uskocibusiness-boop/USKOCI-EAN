import { View } from 'react-native';
import { router } from 'expo-router';
import { inicijali } from '../../lib/inicijali';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { sys } from '../system/tokens';
import { neprocitanih } from '../system/plural';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { privateConversationChoices } from './ConversationChannels';
import { useGroupContext, type GroupContextModel } from './useGroupContext';

type Props = { agreementId: string; model?: GroupContextModel; onPrivate?: (id: string) => void };
/** Overview and private conversation share the route's single authorized roster read. */
export function GroupConversationEntry(props: Props) {
  return props.model ? <GroupEntry {...props} model={props.model} /> : <StandaloneEntry {...props} />;
}
function StandaloneEntry(props: Props) {
  const model = useGroupContext(props.agreementId);
  return <GroupEntry {...props} model={model} />;
}
function GroupEntry({ agreementId, model, onPrivate }: Props & { model: GroupContextModel }) {
  const context = model.context, group = context?.group;
  if (!context || !group) return model.error ? <Section title="Članovi Dogovora">
    <T variant="note" tone="muted" accessibilityLiveRegion="polite">Članovi trenutno nisu učitani.</T>
    <V2Action label="Ponovo učitajte članove" kind="quiet" onPress={model.refresh} />
  </Section> : context?.available === false
    ? null
    : <Section title="Članovi Dogovora">
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: sys.space.sm }}>
        <FactArt kind="users" size={32} />
        <T variant="note" tone="muted">Učitavamo članove Dogovora…</T>
      </View>
    </Section>;
  const choices = privateConversationChoices(context);
  const members = new Map(group.members.map(member => [member.accountId, member]));
  const targets = new Map((group.management ?? []).map(item => [item.agreementId, item.accountId]));
  const memberFor = (id: string) => group.role === 'PARTICIPANT'
    ? group.members.find(member => member.role === 'REQUESTER')
    : members.get(targets.get(id) ?? '');
  const byMember = new Map<string, typeof choices>();
  for (const choice of choices) {
    const member = memberFor(choice.id);
    if (member) byMember.set(member.accountId, [...(byMember.get(member.accountId) ?? []), choice]);
  }
  const openPrivate = (id: string) => {
    if (!model.current() || !choices.some(choice => choice.id === id)) return;
    if (onPrivate) onPrivate(id); else router.push({ pathname: '/dogovor/[id]', params: { id, tab: 'poruke' } });
  };
  const openMemberAgreement = (id: string) => {
    if (!model.current() || !choices.some(choice => choice.id === id)) return;
    router.push({ pathname: '/dogovor/[id]', params: { id } });
  };
  return <Section title="Članovi Dogovora">
    <View>{group.members.map((member, index) => <ListRow key={member.accountId} title={member.displayName}
      subtitle={`${member.accountId === context.accountId ? 'Vi · ' : ''}${member.role === 'REQUESTER' ? 'Vlasnik zadatka' : 'Uskače na zadatak'}`}
      leading={<ProfilePhoto profileId={member.profileId} size={40} fallback={<Avatar initials={inicijali(member.displayName)} size={40} />} />}
      trailing={byMember.has(member.accountId) ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: sys.space.xs }}>
        {byMember.get(member.accountId)!.map(choice => <View key={choice.id} style={{ flexDirection: 'row', alignItems: 'center', gap: sys.space.xs }}>
          {group.role === 'REQUESTER' && choice.id.toLowerCase() !== agreementId.toLowerCase() ? (
            <V2Action label="Dogovor" accessibilityLabel={`Otvori Dogovor: ${choice.name}`} kind="secondary" compact onPress={() => openMemberAgreement(choice.id)} />
          ) : null}
          <V2Action label={byMember.get(member.accountId)!.length > 1 ? `Poruka · ${choices.indexOf(choice) + 1}` : 'Poruka'}
            accessibilityLabel={`Privatna poruka: ${choice.name}`} kind="quiet" compact onPress={() => openPrivate(choice.id)} />
        </View>)}
      </View> : undefined}
      faceSlot last={index === group.members.length - 1} />)}</View>
    {!group.members.length ? <T variant="meta" tone="muted">Prikazana je ranije dostupna istorija razgovora.</T> : null}
    <View style={{ gap: sys.space.sm, paddingTop: sys.space.sm }}>
      <V2Action label={`Kolektivni razgovor svih članova${group.unreadCount > 0 ? ` · ${neprocitanih(group.unreadCount)}` : ''}`} onPress={() => {
        if (model.current()) router.push({ pathname: '/dogovor/[id]/grupa', params: { id: agreementId } });
      }} />
      <T variant="meta" tone="muted">Poruke u kolektivnom razgovoru vide svi članovi zadatka, dok privatnu poruku vidi samo osoba kojoj pišete.</T>
      {choices.filter(choice => !memberFor(choice.id)).map(choice => <V2Action key={choice.id} label={`Privatno: ${choice.name}`} kind="quiet" compact onPress={() => openPrivate(choice.id)} />)}
      {group.managementNextId ? <V2Action label={model.loadingMore ? 'Učitavamo razgovore…' : 'Još privatnih razgovora'} kind="quiet"
        disabled={model.loadingMore} onPress={() => void model.more()} /> : null}
      {model.error ? <T variant="meta" tone="muted">Nisu učitani svi privatni razgovori. Pokušajte ponovo.</T> : null}
    </View>
  </Section>;
}
