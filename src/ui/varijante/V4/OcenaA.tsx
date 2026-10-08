import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewTag } from '../../../data/reviewsClientService';
import type { ReviewPerson } from '../../reviews/AgreementReviewPresentation';
import { T } from '../../Text';
import { sys } from '../../system/tokens';
import { SAVED_TAGS } from './fixtures';
import { BackFooter, OcenaScreen, Oznake, SACUVANO_NOTE, STARS, STARS_WIDTH, STAR_SLOT, SaveFooter, ZvezdaDodir, os, ratingLabels, tagsText, useSuccessTick } from './ocenaShared';
import { Lice, PECAT_MS, Pecat, PilulaOcenjeno, Sjaj, ZvezdaNalepnica } from './parts';

/**
 * VARIANT A, "Zvezde 2.5D" (from the object; pravac P8 + B3 + the one glow).
 *
 * The person's face (72, the sticker edge) stands above, centred; the five stars are 2.5D stickers at 48 (full in the orange enamel,
 * empty in cream; vector until the owner's drawing G2), the word of the rating under them; the tags follow. SAVED: the same column, the
 * title "Ocena je sačuvana.", the pill "Ocenjeno" falls onto the top right corner of the stars (B3, 140 ms) and the white glow crosses the
 * full stars once (420 ms), the only glow in the app; the success tick lands with the pill.
 */
const STAR = STAR_SLOT;

export function OcenaA({ person, initial = 4 }: { person: ReviewPerson; initial?: number }) {
  const [rating, setRating] = useState(initial);
  const [tags, setTags] = useState<ReviewTag[]>(initial ? ['ON_TIME'] : []);
  return <OcenaScreen footer={<SaveFooter rating={rating} />}>
    <View accessible accessibilityLabel={[person.name, person.role, person.task].filter(Boolean).join(', ')} style={s.person}>
      <Lice initials={person.initials} size={72} edge />
      <T accessible={false} accessibilityRole="header" variant="title" style={[os.ink, os.center]}>{person.name}</T>
      {person.role ? <T variant="note" tone="muted" style={os.center}>{person.role}</T> : null}
      {person.task ? <T variant="note" tone="muted" style={os.center} numberOfLines={2}>{person.task}</T> : null}
    </View>
    <View style={os.rating}>
      <T accessibilityRole="header" variant="heading" style={[os.ink, os.center]}>Kako je prošla saradnja?</T>
      <View accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={os.stars}>
        {STARS.map(value => <ZvezdaDodir key={value} value={value} rating={rating} onRate={setRating}>
          <ZvezdaNalepnica size={STAR} full={value <= rating} />
        </ZvezdaDodir>)}
      </View>
      <T accessibilityLiveRegion="polite" variant="bodyStrong" style={[os.ink, os.center]}>{rating ? ratingLabels[rating] : ' '}</T>
    </View>
    <Oznake tags={tags} onToggle={tag => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])} />
  </OcenaScreen>;
}

export function SacuvanoA({ person, rating = 4, tags = SAVED_TAGS }: { person: ReviewPerson; rating?: number; tags?: readonly ReviewTag[] }) {
  useSuccessTick(PECAT_MS);
  return <OcenaScreen footer={<BackFooter />}>
    <View style={s.person}>
      <Lice initials={person.initials} size={72} edge />
      <T variant="bodyStrong" style={[os.ink, os.center]}>{person.name}</T>
    </View>
    <View style={s.saved}>
      <T accessibilityRole="alert" variant="title" style={[os.ink, os.center]}>Ocena je sačuvana.</T>
      <View style={s.starsBox}>
        <Sjaj width={STARS_WIDTH} delay={PECAT_MS}>
          <View style={os.stars} accessible accessibilityRole="text" accessibilityLabel={`Tvoja ocena: ${rating} od 5`}>
            {STARS.map(value => <View key={value} style={os.starBox}><ZvezdaNalepnica size={STAR} full={value <= rating} /></View>)}
          </View>
        </Sjaj>
        <Pecat style={s.pecat}><PilulaOcenjeno /></Pecat>
      </View>
      <T variant="body" style={[os.ink, os.center]}>{`Tvoja ocena: ${rating} od 5`}</T>
      {tags.length ? <T variant="note" tone="muted" style={os.center}>{tagsText(tags)}</T> : null}
      <T variant="note" tone="muted" style={[os.center, s.note]}>{SACUVANO_NOTE}</T>
    </View>
  </OcenaScreen>;
}

const s = StyleSheet.create({
  person: { alignItems: 'center', gap: sys.space.sm, paddingTop: sys.space.sm },
  saved: { alignItems: 'center', gap: sys.space.md },
  starsBox: { width: STARS_WIDTH, alignSelf: 'center', paddingTop: sys.space.sm },
  // The pill lands on the top right corner of the stars, half over their edge.
  pecat: { position: 'absolute', top: -sys.space.xs, right: -sys.space.sm },
  note: { paddingTop: sys.space.sm },
});
