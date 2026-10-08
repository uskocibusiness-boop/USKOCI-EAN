import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { ReviewTag } from '../../../data/reviewsClientService';
import type { ReviewPerson } from '../../reviews/AgreementReviewPresentation';
import { T } from '../../Text';
import { sys } from '../../system/tokens';
import { SAVED_TAGS } from './fixtures';
import { useProgress } from './lab';
import { BackFooter, OcenaScreen, Oznake, SACUVANO_NOTE, STARS, STARS_WIDTH, SaveFooter, ZvezdaDodir, os, ratingLabels, tagsText, useSuccessTick } from './ocenaShared';
import { Lice, Sjaj, ZvezdaRavna } from './parts';

/**
 * VARIANT C, "Punjenje" (from the movement; pravac B1 rhythm + R4 M4).
 *
 * The person is a row with the face at 56; the question is the heading; the stars are flat at 40 and FILL IN ORDER when one is pressed:
 * star 1, then 2, then N, each 40 ms after the one before (the family stagger), each settling from 0,8 to 1 over `toggle`; one select
 * tick. SAVED: the same layout stays; the heading changes in place over 180 ms (opacity only, the words themselves do not move) to
 * "Ocena je sačuvana.", the glow crosses the stars once, the success tick lands as the glow starts. Reduced motion: no order, no glow,
 * the tick stays.
 */
const STAR = 40;
/** The scale a star fills from (pravac #23 "doterane kontrole"): no token names a start scale; 0,8 is small enough to be seen and large enough not to pop. */
const FILL_FROM = 0.8;

/** One star: the empty one always, and over it the full one settling in, in its turn. */
function ZvezdaPuni({ index, full }: { index: number; full: boolean }) {
  const progress = useProgress(sys.motion.toggle, index * sys.motion.stagger);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [FILL_FROM, 1] });
  return <View style={os.starBox}>
    <ZvezdaRavna size={STAR} full={false} />
    {full ? <Animated.View style={[StyleSheet.absoluteFill, s.center, { opacity: progress, transform: [{ scale }] }]}><ZvezdaRavna size={STAR} full /></Animated.View> : null}
  </View>;
}

function Osoba({ person }: { person: ReviewPerson }) {
  return <View accessible accessibilityLabel={[person.name, person.role, person.task].filter(Boolean).join(', ')} style={os.personRow}>
    <Lice initials={person.initials} size={56} />
    <View style={os.personCopy}>
      <T accessible={false} accessibilityRole="header" variant="title" style={os.ink} numberOfLines={2}>{person.name}</T>
      {person.role ? <T variant="note" tone="muted">{person.role}</T> : null}
      {person.task ? <T variant="note" tone="muted" numberOfLines={2}>{person.task}</T> : null}
    </View>
  </View>;
}

export function OcenaC({ person, initial = 4 }: { person: ReviewPerson; initial?: number }) {
  const [rating, setRating] = useState(initial);
  const [tags, setTags] = useState<ReviewTag[]>(initial ? ['ON_TIME'] : []);
  return <OcenaScreen footer={<SaveFooter rating={rating} />}>
    <Osoba person={person} />
    <View style={os.rating}>
      <T accessibilityRole="header" variant="heading" style={os.ink}>Kako je prošla saradnja?</T>
      {/* The row is mounted anew for every rating, so the fill runs from the first star each time. */}
      <View key={rating} accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={[os.stars, os.starsLeft]}>
        {STARS.map(value => <ZvezdaDodir key={value} value={value} rating={rating} onRate={setRating}>
          <ZvezdaPuni index={value - 1} full={value <= rating} />
        </ZvezdaDodir>)}
      </View>
      <T accessibilityLiveRegion="polite" variant="bodyStrong" style={os.ink}>{rating ? ratingLabels[rating] : ' '}</T>
    </View>
    <Oznake tags={tags} onToggle={tag => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])} />
  </OcenaScreen>;
}

export function SacuvanoC({ person, rating = 4, tags = SAVED_TAGS }: { person: ReviewPerson; rating?: number; tags?: readonly ReviewTag[] }) {
  const swap = useProgress(sys.motion.toggle);
  const before = swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  useSuccessTick(sys.motion.toggle);
  return <OcenaScreen footer={<BackFooter />}>
    <Osoba person={person} />
    <View style={os.rating}>
      <View style={s.swap}>
        <Animated.View style={{ opacity: before }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <T variant="heading" style={os.ink}>Kako je prošla saradnja?</T>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: swap }]}>
          <T accessibilityRole="alert" variant="heading" style={os.ink}>Ocena je sačuvana.</T>
        </Animated.View>
      </View>
      <View style={s.starsLeft}>
        <Sjaj width={STARS_WIDTH} delay={sys.motion.toggle}>
          <View style={os.stars} accessible accessibilityRole="text" accessibilityLabel={`Tvoja ocena: ${rating} od 5`}>
            {STARS.map(value => <View key={value} style={os.starBox}><ZvezdaRavna size={STAR} full={value <= rating} /></View>)}
          </View>
        </Sjaj>
      </View>
      <T variant="bodyStrong" style={os.ink}>{ratingLabels[rating]}</T>
      {tags.length ? <T variant="note" tone="muted">{tagsText(tags)}</T> : null}
      <T variant="note" tone="muted">{SACUVANO_NOTE}</T>
    </View>
  </OcenaScreen>;
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  swap: { minHeight: sys.type.heading.lineHeight },
  starsLeft: { alignSelf: 'flex-start' },
});
