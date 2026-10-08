import { View } from 'react-native';
import { router } from 'expo-router';
import { inicijali } from '../../lib/inicijali';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Avatar } from '../system/Avatar';
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
  if (!context || !group) return model.error ? <V2Action label="Ponovo učitaj učesnike" kind="quiet" onPress={model.refresh} />
    : context?.available === false ? <T variant="meta" tone="muted">Grupni razgovor se otvara kad su za ovaj zadatak izabrane najmanje dve osobe.</T> : null;
  const choices = privateConversationChoices(context);
  const openPrivate = (id: string) => {
    if (!model.current() || !choices.some(choice => choice.id === id)) return;
    if (onPrivate) onPrivate(id); else router.push({ pathname: '/dogovor/[id]', params: { id, tab: 'poruke' } });
  };
  return <Section title="Učesnici zadatka">
    <View>{group.members.map((member, index) => <ListRow key={member.accountId} title={member.displayName}
      subtitle={`${member.accountId === context.accountId ? 'Ti · ' : ''}${member.role === 'REQUESTER' ? 'Traži pomoć' : 'Uskače'}`}
      leading={<ProfilePhoto profileId={member.profileId} size={40} fallback={<Avatar initials={inicijali(member.displayName)} size={40} />} />}
      faceSlot last={index === group.members.length - 1} />)}</View>
    {!group.members.length ? <T variant="meta" tone="muted">Prikazana je ranije dostupna istorija razgovora.</T> : null}
    <View style={{ gap: sys.space.sm }}>
      <V2Action label={`Grupni razgovor${group.unreadCount > 0 ? ` · ${neprocitanih(group.unreadCount)}` : ''}`} onPress={() => {
        if (model.current()) router.push({ pathname: '/dogovor/[id]/grupa', params: { id: agreementId } });
      }} />
      <T variant="meta" tone="muted">Zajedničke poruke vide svi učesnici. Privatne vidi samo osoba kojoj pišeš.</T>
      {choices.map(choice => <V2Action key={choice.id} label={`Privatno: ${choice.name}`} kind="quiet" compact onPress={() => openPrivate(choice.id)} />)}
      {group.managementNextId ? <V2Action label={model.loadingMore ? 'Učitavamo razgovore…' : 'Još privatnih razgovora'} kind="quiet"
        disabled={model.loadingMore} onPress={() => void model.more()} /> : null}
      {model.error ? <T variant="meta" tone="muted">Nisu učitani svi privatni razgovori. Pokušaj ponovo.</T> : null}
    </View>
  </Section>;
}
