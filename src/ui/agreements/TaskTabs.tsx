import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import type { ReactNode } from 'react';
import { sys } from '../system/tokens';

export type TaskTab = 'overview' | 'agreed' | 'applications' | 'messages';

/**
 * The four parts of one task (owner's sketch, 21.11.2026; approved canvas, 25.11.2026), the same row on the owner's task page and on the
 * task screen of its Dogovor, so the two read as one screen: Pregled, Dogovoreni, Prijave and Poruke, each a 3D picture with its word and
 * how many, the open one underlined. A worker sees Pregled and Poruke; Dogovoreni and Prijave belong to the owner.
 */
export function TaskTabs({ owner, selected, agreed, applications, messages, onSelect }: {
  owner: boolean; selected: TaskTab | null; agreed: number; applications: number;
  /** Poruke is offered once somebody is agreed: before that there is nobody to write to. */ messages: boolean;
  onSelect: (tab: TaskTab) => void;
}) {
  return <View style={s.row} accessibilityRole="tablist">
    <Tab label="Pregled zadatka" short="Pregled" art="tasks" selected={selected === 'overview'} onPress={() => onSelect('overview')} />
    {/* A worker's Dogovor has one other person, the task owner, who stands on Pregled (owner, 25.11.2026): no part of its own. */}
    {owner ? <Tab label="Dogovoreni" short={`Dogovoreni${agreed ? ` ${agreed}` : ''}`} art="agreements"
      selected={selected === 'agreed'} onPress={() => onSelect('agreed')} /> : null}
    {owner ? <Tab label="Prijave" short={`Prijave${applications ? ` ${applications}` : ''}`} art="applications" dot={applications > 0}
      selected={selected === 'applications'} onPress={() => onSelect('applications')} /> : null}
    {messages ? <Tab label="Poruke" short="Poruke" art="chat" selected={selected === 'messages'} onPress={() => onSelect('messages')} /> : null}
  </View>;
}

/**
 * The task's navigation (owner, 25.11.2026): a quiet back arrow without a ring, the parts of the task, and "···" on the right. The task's
 * title is not up here: it is the page's own heading, large and whole, under this bar.
 */
export function TaskTopBar({ onBack, backLabel = 'Nazad', right, ...tabs }: Parameters<typeof TaskTabs>[0] & {
  onBack: () => void; backLabel?: string; right?: ReactNode;
}) {
  return <View style={s.bar}>
    <Press accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} haptic="select" style={s.back}>
      <Glyph name="back" size={24} tone="ink" />
    </Press>
    <View style={s.tabs}><TaskTabs {...tabs} /></View>
    <View style={s.right}>{right}</View>
  </View>;
}

function Tab({ label, short, art, selected, dot, onPress }: {
  label: string; short: string; art: FactArtKind; selected: boolean; dot?: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="tab" accessibilityLabel={short !== label ? `${label}, ${short}` : label} accessibilityState={{ selected }}
    onPress={onPress} haptic="select" style={[s.tab, selected && s.tabOn]}>
    <View style={s.art}><FactArt kind={art} size={26} /></View>
    <T variant="meta" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[s.label, selected && s.labelOn]}>{short}</T>
    {dot ? <View style={s.dot} /> : null}
  </Press>;
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: sys.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  back: { width: 44, height: 58, alignItems: 'center', justifyContent: 'center' },
  tabs: { flex: 1, minWidth: 0 },
  right: { width: 44, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2, paddingBottom: sys.space.xs,
    borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: sys.color.ink },
  art: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  label: { color: sys.color.muted, fontSize: 12, lineHeight: 15 },
  labelOn: { color: sys.color.ink, fontWeight: '700' },
  dot: { position: 'absolute', top: 6, right: 14, width: 9, height: 9, borderRadius: 5, backgroundColor: sys.color.warn },
});
