import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewTag } from '../../../data/reviewsClientService';
import { Press } from '../../Press';
import { SAVE_WARNING, tagLabels } from '../../reviews/AgreementReviewPresentation';
import { T } from '../../Text';
import { DetailTopBar } from '../../system/DetailTopBar';
import { FlowFooter } from '../../system/FlowFooter';
import { Glyph } from '../../system/Glyph';
import { tick } from '../../system/haptics';
import { layout } from '../../system/layout';
import { useReducedMotion } from '../../system/motion';
import { Screen } from '../../system/Screen';
import { Section } from '../../system/Section';
import { brandAction, sys } from '../../system/tokens';
import { V2Action } from '../../v2/V2Action';
import { REVIEW_CATALOG } from './fixtures';
import { noop, useLabClock } from './lab';

/**
 * What the three rating variants share and do not argue about: the screen (production's frame and bar), the one green foot with
 * its reason, the words of the five ratings (production's), the tags (production's chips and words), the touch of a star (48 dp,
 * a radio), and the success tick of the saved rating. The variants differ in what leads: the sticker stars, the word, or the fill.
 */
export const ratingLabels = ['Izaberi ocenu', 'Loše', 'Ispod očekivanja', 'Dobro', 'Vrlo dobro', 'Odlično'];
export const STARS = [1, 2, 3, 4, 5] as const;
/** What the saved screen says once (pravac C.5, R4 G6). */
export const SACUVANO_NOTE = 'Ocena pomaže drugima da biraju i ne može da se menja.';
export const tagsText = (tags: readonly ReviewTag[]) => tags.map(tag => tagLabels[tag]).join(' · ');
/** A star's touch is 48 (`layout.touch`); five of them and four gaps are the row every variant draws the stars in: 272 dp, which fits 321. */
export const STAR_SLOT = layout.touch;
export const STARS_WIDTH = STARS.length * STAR_SLOT + (STARS.length - 1) * sys.space.sm;

export function OcenaScreen({ footer, children }: { footer: ReactNode; children: ReactNode }) {
  return <Screen kind="flow" keyboardAvoiding={false} header={<DetailTopBar title="Ocena saradnje" backLabel="Nazad na Dogovor" onBack={noop} />} footer={footer}>{children}</Screen>;
}

/** The foot before saving: the warning once a rating is chosen; while the button is grey, the line above it says why instead (production's rule). */
export function SaveFooter({ rating }: { rating: number }) {
  return <FlowFooter reason={rating === 0 ? 'Izaberi ocenu.' : undefined}>
    {rating ? <T variant="note" tone="muted">{SAVE_WARNING}</T> : null}
    <V2Action label="Sačuvaj ocenu" disabled={rating === 0} onPress={noop} style={brandAction} />
  </FlowFooter>;
}
export function BackFooter() {
  return <FlowFooter><V2Action label="Nazad na Dogovor" onPress={noop} style={brandAction} /></FlowFooter>;
}

/** One star as a radio of 48 dp: the picture inside takes its colour on the press, with no scale or bounce of the control itself (the rating is a fact). */
export function ZvezdaDodir({ value, rating, onRate, children }: { value: number; rating: number; onRate: (value: number) => void; children: ReactNode }) {
  return <Press accessibilityRole="radio" accessibilityLabel={`Ocena ${value} od 5`} accessibilityHint={ratingLabels[value]}
    accessibilityState={{ checked: rating === value }} haptic="select" scaleTo={1} hitSlop={0} onPress={() => onRate(value)} style={s.star}>
    {children}
  </Press>;
}

/** The tags, as production draws them: at most three, a check on a chosen one, the rest grey once three are chosen. */
export function Oznake({ tags, onToggle }: { tags: readonly ReviewTag[]; onToggle: (tag: ReviewTag) => void }) {
  const full = tags.length >= REVIEW_CATALOG.maxTags;
  return <Section title="Šta je obeležilo saradnju?">
    <T variant="note" tone="muted">{`Nije obavezno · najviše ${REVIEW_CATALOG.maxTags}`}</T>
    <View style={s.tags}>
      {REVIEW_CATALOG.tags.map(tag => {
        const selected = tags.includes(tag), capped = !selected && full;
        return <Press key={tag} accessibilityRole="checkbox" accessibilityLabel={tagLabels[tag]} accessibilityState={{ checked: selected, disabled: capped }}
          disabled={capped} haptic="select" hitSlop={0} onPress={() => onToggle(tag)} style={[s.tag, selected && s.tagSelected]}>
          {selected ? <Glyph name="check" size={16} tone="green" /> : null}
          <T variant="note" style={selected ? s.tagTextSelected : capped ? s.tagTextCapped : s.ink}>{tagLabels[tag]}</T>
        </Press>;
      })}
    </View>
  </Section>;
}

/** The tick of an outcome the server confirmed, once, `delay` ms after the screen opened (when the picture first shows it); at once under reduced motion; never in a frozen lab frame. */
export function useSuccessTick(delay: number) {
  const frozen = useLabClock(), reduced = useReducedMotion();
  useEffect(() => {
    if (frozen !== null) return;
    const id = setTimeout(() => tick('success'), reduced ? 0 : delay);
    return () => clearTimeout(id);
  }, [frozen, reduced, delay]);
}

export const os = StyleSheet.create({
  ink: { color: sys.color.ink },
  center: { textAlign: 'center' },
  /** The row of five stars, 272 wide, centred. */
  stars: { flexDirection: 'row', gap: sys.space.sm, width: STARS_WIDTH, alignSelf: 'center' },
  starsLeft: { alignSelf: 'flex-start' },
  starBox: { width: STAR_SLOT, height: STAR_SLOT, alignItems: 'center', justifyContent: 'center' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  personCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  rating: { gap: sys.space.md },
});

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  star: { width: STAR_SLOT, height: STAR_SLOT, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingTop: sys.space.xs },
  tag: { minHeight: layout.touch, paddingHorizontal: sys.space.base, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  tagSelected: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  tagTextSelected: { color: sys.color.green, fontWeight: '700' },
  tagTextCapped: { color: sys.color.muted },
});
