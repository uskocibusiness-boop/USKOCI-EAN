import { useEffect, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { useSesija } from '../../store/sesija';
import { T } from '../Text';
import { AgreementPrivateLocation, clearCachedAgreementLocation } from '../AgreementPrivateLocation';
import { Section } from '../system/Section';

/**
 * "Komunikacija i mesto" (Usklađeno sa nalogom vlasnika o privatnosti):
 * Sva komunikacija (poruke, glasovne poruke i fotografije) vodi se isključivo
 * unutar USKOČI aplikacije. Nema deljenja privatnih telefonskih brojeva.
 * Privatna lokacija se prikazuje kroz autorizovani grant kada je to potrebno.
 */
export function AgreementContactPlace({
  agreement,
  enabled,
  concealed = false,
  onOpenMessages,
  onRequestAddress,
  onLayout,
  locationSlot,
}: {
  agreement: DogovorProjekcija;
  enabled: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  concealed?: boolean;
  onOpenMessages?: () => void;
  onRequestAddress?: () => void;
  locationSlot?: ReactNode;
}) {
  const session = useSesija();
  const active = agreement.stanje === 'CONFIRMED' || agreement.stanje === 'AWAITING_REQUESTER';
  const physical = agreement.rezim !== 'DALJINSKI' && agreement.kontakt.lokacijaPostoji;
  useEffect(() => {
    if (!active && session.user?.id) {
      void clearCachedAgreementLocation(session.user.id, agreement.id);
    }
  }, [active, session.user?.id, agreement.id]);

  if (!physical) return null;

  const tail = active ? (
    locationSlot ?? (
      <AgreementPrivateLocation
        agreement={agreement}
        enabled={enabled && !concealed}
        onRequestAddress={onRequestAddress}
      />
    )
  ) : (
    <T variant="note" tone="muted">
      Pristup tačnoj lokaciji je zatvoren kada se Dogovor završi ili otkaže.
    </T>
  );

  return (
    <View testID="agreement-contact-place" onLayout={onLayout}>
      <Section title="Tačna adresa i lokacija">
        {tail}
      </Section>
    </View>
  );
}
