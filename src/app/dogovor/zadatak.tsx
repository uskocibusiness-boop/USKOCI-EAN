import { useLocalSearchParams } from 'expo-router';
import { AgreementTaskHub } from '../../ui/agreements/AgreementTaskHub';
import { useSesija } from '../../store/sesija';

/** The Dogovor of one task (owner's design, 22.11.2026): `needId` and my `role` on it; `title` narrows the list read. */
export default function AgreementTaskRoute() {
  const params = useLocalSearchParams<{ needId?: string | string[]; role?: string | string[]; title?: string | string[]; id?: string | string[]; pane?: string | string[] }>();
  const session = useSesija();
  const one = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';
  const needId = one(params.needId), role = one(params.role) === 'uskocer' ? 'uskocer' : 'narucilac';
  return <AgreementTaskHub key={`${session.user?.id ?? ''}:${session.accountRevision}:${needId}:${role}`} needId={needId} role={role}
    title={one(params.title)} fallbackAgreementId={one(params.id) || undefined}
    initialPane={(['agreed', 'applications', 'messages'] as const).find(pane => pane === one(params.pane))} />;
}
