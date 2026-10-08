import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ConversationMessage } from '../../aiFirst/AiConversationShell';
import { AiAssistantArt } from '../../aiFirst/AiAssistantArt';
import { Press } from '../../Press';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { PillComposer } from '../../system/PillComposer';
import { sys } from '../../system/tokens';
import { T } from '../../Text';

/**
 * Delovi AI razgovora koje tri varijante dele u laboratoriji: nit poruka (isti glas kao `AiConversationShell`: asistent na beloj sa
 * znakom 24, tvoje reči u tamnom balonu desno), pilula za pisanje sa mikrofonom, asistent 128 (lokalna kopija `AiAssistantArt`
 * koja prima 128; sistemska prima 24 i 88 — predlog izmene u izveštaju) i mala mapa u vektoru za trenutak „Pin sleće“.
 */

/** Asistent 128 (pravac AIRBNB P7 / C.24): ista slika, samo veći; statična, bez poza dok ne stignu vlasnikovi Lottie fajlovi. */
const ASISTENT = require('../../../../assets/ai/uskoci-assistant.png');
export const AiAssistantArtVarA = memo(function AiAssistantArtVarA({ size = 128 }: { size?: 88 | 128 }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: size, height: size }}>
    <Image source={ASISTENT} contentFit="contain" transition={0} cachePolicy="memory" allowDownscaling accessible={false} style={{ width: size, height: size }} />
  </View>;
});

/** Znak govornika uz odgovor: asistent 24, nikad ceo logotip kroz nit. */
export function Znak() {
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.znak}><AiAssistantArt size={24} /></View>;
}

/** Nit razgovora: tvoje reči desno u tamnom balonu, asistent na beloj površini sa znakom pred prvim odgovorom u nizu. Ništa se ne pomera. */
export function Nit({ messages, after }: { messages: readonly ConversationMessage[]; after?: ReactNode }) {
  return <View style={s.nit}>
    {messages.map((message, index) => message.fromAi
      ? <View key={message.id} accessibilityLabel={`USKOČI: ${message.body}`} style={s.asistent}>
        {index === 0 || !messages[index - 1].fromAi ? <Znak /> : null}
        <T selectable variant="speech" style={s.odgovor}>{message.body}</T>
      </View>
      : <View key={message.id} accessibilityLabel={`Ti: ${message.body}`} style={s.osoba}><T selectable variant="body" style={s.osobaTekst}>{message.body}</T></View>)}
    {after}
  </View>;
}

/** Pilula za pisanje: sistemski `PillComposer` sa mikrofonom kao prvim alatom (hold-to-talk ostaje u aplikaciji; ovde je slika). */
export function Pilula({ placeholder = 'Opiši šta ti treba', above }: { placeholder?: string; above?: ReactNode }) {
  const [value, setValue] = useState('');
  return <PillComposer value={value} onChange={setValue} label="Poruka za asistenta" placeholder={placeholder} sendLabel="Pošalji poruku"
    canSend={value.trim().length > 0} onSend={() => setValue('')} above={above} maxLength={4000}
    lead={<Press accessibilityRole="button" accessibilityLabel="Drži da govoriš" accessibilityHint="Drži tokom govora. Kad pustiš, poruka ide u razgovor." haptic="none" scaleTo={1} hitSlop={0} style={s.mikrofon}>
      <Glyph name="mic" size={24} tone="ink" />
    </Press>} />;
}

/**
 * Mala mapa u vektoru za „Pin sleće“: krem papir, dve ulice, reka i park u bojama mape (`sys.map`), bez pina, da pravi marker
 * aplikacije (`assets/discovery/p6-pin-task.png`) može da sleti na nju. Crtež je laboratorijski stand-in: `discover-v3` PNG nosi
 * svoj pin pa ne može da primi drugi (vidi izveštaj). Statičan SVG: ništa mu se ne animira (R1).
 */
export function MapaTile({ size }: { size: number }) {
  return <View aria-hidden accessible={false} style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 144 144">
      <Rect x={4} y={10} width={136} height={124} rx={20} fill={sys.map.ground} stroke={sys.map.buildingEdge} strokeWidth={1.5} />
      <Path d="M4 96 C 36 84, 52 118, 84 104 S 128 92, 140 100" fill="none" stroke={sys.map.water} strokeWidth={10} strokeLinecap="round" />
      <Path d="M4 96 C 36 84, 52 118, 84 104 S 128 92, 140 100" fill="none" stroke={sys.map.waterLine} strokeWidth={1} opacity={0.6} />
      <Path d="M22 24 h44 a14 14 0 0 1 14 14 v12 h-58 Z" fill={sys.map.park} />
      <Path d="M30 10 L30 134" stroke={sys.map.road} strokeWidth={9} /><Path d="M30 10 L30 134" stroke={sys.map.roadEdge} strokeWidth={1} opacity={0.7} />
      <Path d="M4 60 L140 54" stroke={sys.map.roadMajor} strokeWidth={10} /><Path d="M4 60 L140 54" stroke={sys.map.roadMajorEdge} strokeWidth={1} opacity={0.8} />
      <Path d="M96 10 L112 134" stroke={sys.map.road} strokeWidth={7} />
      <Rect x={42} y={70} width={18} height={14} rx={3} fill={sys.map.building} stroke={sys.map.buildingEdge} strokeWidth={1} />
      <Rect x={66} y={66} width={14} height={20} rx={3} fill={sys.map.building} stroke={sys.map.buildingEdge} strokeWidth={1} />
      <Rect x={116} y={70} width={16} height={12} rx={3} fill={sys.map.building} stroke={sys.map.buildingEdge} strokeWidth={1} />
      <Circle cx={72} cy={94} r={3} fill={sys.map.transit} opacity={0.5} />
    </Svg>
  </View>;
}

/** Marker mape aplikacije (P6 pin): kapsula sa znakom, 224 × 216 u izvoru. */
export const MARKER = require('../../../../assets/discovery/p6-pin-task.png');
export const MARKER_SIRINA = 56, MARKER_VISINA = 54;
export function Marker() {
  return <Image source={MARKER} contentFit="contain" transition={0} cachePolicy="memory" allowDownscaling accessible={false} style={s.marker} />;
}

const s = StyleSheet.create({
  znak: { flexDirection: 'row', alignItems: 'center' },
  nit: { gap: sys.space.xl, paddingHorizontal: layout.chatList, paddingTop: sys.space.md, paddingBottom: sys.space.md },
  asistent: { gap: sys.space.sm, alignSelf: 'stretch', paddingVertical: sys.space.xs },
  odgovor: { color: sys.color.ink },
  osoba: { alignSelf: 'flex-end', maxWidth: '90%', marginLeft: sys.space.xl, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base,
    borderRadius: sys.radius.card, borderBottomRightRadius: sys.space.sm, backgroundColor: sys.color.ink },
  osobaTekst: { color: sys.conversation.onUser },
  mikrofon: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  marker: { width: MARKER_SIRINA, height: MARKER_VISINA },
});
