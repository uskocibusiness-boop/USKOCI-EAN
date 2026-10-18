import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { CatalogArt, type CatalogArtKind } from '../ui/system/CatalogArt';
import { CatalogMoment } from '../ui/system/CatalogMoment';
import { SettingsAction, SettingsScreen, SettingsText as T } from '../ui/settings/SettingsPresentation';

/** Inert source trial, reached only by its address in the existing .dev package. */
export default function DizajnKatalog27() {
  if (Constants.expoConfig?.android?.package !== 'rs.uskoci.dev') return <T>Nije dostupno.</T>;
  return <CatalogTrial />;
}

function CatalogTrial() {
  const [focused, setFocused] = useState(false);
  const [event, setEvent] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const back = () => { setFocused(false); router.canGoBack() ? router.back() : router.replace('/'); };
  return <SettingsScreen title="Catalog27 · probni prikaz" onBack={back}>
    <T>Izvorne ilustracije · 32 dp</T>
    {(['support', 'lock', 'document', 'shield'] as const).map((kind: CatalogArtKind) =>
      <View key={kind} style={s.row}><CatalogArt kind={kind} /><CatalogArt kind={kind} muted /><T>{kind}</T></View>)}
    <View style={s.row}><CatalogMoment focused={focused} event={event} /><T>Podrška · jedan pokret</T></View>
    <SettingsAction label="Prikaži pokret jednom" kind="quiet" onPress={() => setEvent(value => (value ?? 0) + 1)} />
    <T variant="note" tone="muted">Smanjeno kretanje, povratak iz pozadine i završetak prikazuju izvornu sliku. Ovaj prikaz ne šalje zahtev podršci.</T>
  </SettingsScreen>;
}

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 16 } });
