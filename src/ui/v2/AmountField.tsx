import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AMOUNT_MAX_DIGITS, amountDigits } from '../../data/aiNeedV2Ui';
import { iznos } from '../../lib/novac';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { field, inset, sys } from '../system/tokens';
import { V2Action } from './V2Action';

const NO_COMMA = 'Iznos je ceo broj dinara, bez zareza.';
const TOO_LONG = `Najveći iznos ima ${AMOUNT_MAX_DIGITS} cifara (do 100.000.000 RSD).`;

/**
 * An amount in dinars: the app's one text field (`field`), digits only, shown grouped as Serbian writes them (1.500) with
 * the currency beside it. What it reports upward is the digits alone; the parser of the review reads them, so the saved
 * value and its display text are what a typed "1500" always gave. Empty is empty: the placeholder is words, never a 0 that
 * would read as an amount. A comma or a tenth digit is not guessed at: the field keeps what it had and says why.
 */
export function AmountField({ label, digits, disabled, onChange }: {
  label: string; digits: string; disabled: boolean; onChange: (digits: string) => void;
}) {
  const [refused, setRefused] = useState<string | null>(null);
  const shown = digits ? iznos(Number(digits)) : '';
  return <View style={s.stack}>
    <View style={s.row}>
      <TextInput accessibilityLabel={`${label} u dinarima`} value={shown} editable={!disabled}
        keyboardType="number-pad" inputMode="numeric" returnKeyType="done" placeholder="Upiši iznos" placeholderTextColor={sys.color.muted}
        onChangeText={text => {
          const next = amountDigits(text);
          if (next === null) { setRefused(text.includes(',') ? NO_COMMA : TOO_LONG); return; }
          setRefused(null); onChange(next);
        }} style={[s.input, disabled && s.inputResting]} />
      <T variant="bodyStrong" tone="muted">RSD</T>
    </View>
    {refused ? <T accessibilityLiveRegion="polite" variant="meta" tone="muted">{refused}</T> : null}
  </View>;
}

/**
 * The amount under "Ponude": there is no amount to correct, so no field and no number stands here, only what the price is
 * and the one way to change it.
 */
export function AmountWithOffers({ disabled, onChooseMode }: { disabled: boolean;
  /** Opens the price mode's own choice; absent when that fact cannot be corrected here. */ onChooseMode?: () => void }) {
  return <View style={s.stack}>
    <View style={s.offers}>
      <FactArt kind="info" size={20} />
      <T variant="note" style={s.grow}>Tražiš ponude, pa zadatak nema iznos: cena stiže uz svaku prijavu. Da upišeš svoj iznos, prvo izaberi „Moja cena“.</T>
    </View>
    {/* It stands where the save would: the one thing this editor can do. */}
    {onChooseMode ? <V2Action label="Izaberi način cene" disabled={disabled} onPress={onChooseMode} /> : null}
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  input: { ...field, flex: 1, minWidth: 0, fontVariant: ['tabular-nums'] },
  inputResting: { backgroundColor: sys.color.wash, color: sys.color.muted },
  offers: { ...inset, backgroundColor: sys.color.wash, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  grow: { flex: 1, minWidth: 0, color: sys.color.ink },
});
