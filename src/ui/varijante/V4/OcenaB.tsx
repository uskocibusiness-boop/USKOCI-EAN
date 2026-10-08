import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewTag } from '../../../data/reviewsClientService';
import type { ReviewPerson } from '../../reviews/AgreementReviewPresentation';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt } from '../../system/FactArt';
import { sys } from '../../system/tokens';
import { MY_FIRST_NAME, SAVED_TAGS } from './fixtures';
import { BackFooter, OcenaScreen, Oznake, SACUVANO_NOTE, STARS, SaveFooter, ZvezdaDodir, os, ratingLabels, tagsText, useSuccessTick } from './ocenaShared';
import { ZvezdaRavna } from './parts';

/**
 * VARIANT B, "Broj i reč" (from the word; pravac B5 "glas slova" + the personal detail).
 *
 * The question leads (21); the person is one small row; the stars are flat at 40 and, once one is pressed, the WORD of the rating stands
 * under them at 32/700 ("Vrlo dobro"), the one display line of the screen. SAVED: "Hvala, Ana." at 32/700, my own first name from my
 * profile (plain "Hvala." when there is none), a small row of stars at 24 with who was rated, the tags, the one sentence.
 */
const STAR = 40;
/** The chosen word at 32/700: `display` is 600; here the word is the figure of the screen and is 700 like one. The only place a rating screen carries it. */
const DISPLAY_WORD = { ...sys.type.display, fontWeight: '700' as const, color: sys.color.ink };

function Osoba({ person }: { person: ReviewPerson }) {
  return <View accessible accessibilityLabel={[person.name, person.role, person.task].filter(Boolean).join(', ')} style={os.personRow}>
    <Avatar initials={person.initials} size={40} />
    <View style={os.personCopy}>
      <T variant="bodyStrong" style={os.ink}>{person.name}</T>
      <T variant="note" tone="muted" numberOfLines={2}>{[person.role, person.task].filter(Boolean).join(' · ')}</T>
    </View>
  </View>;
}

export function OcenaB({ person, initial = 4 }: { person: ReviewPerson; initial?: number }) {
  const [rating, setRating] = useState(initial);
  const [tags, setTags] = useState<ReviewTag[]>(initial ? ['ON_TIME'] : []);
  return <OcenaScreen footer={<SaveFooter rating={rating} />}>
    <T accessibilityRole="header" variant="title" style={os.ink}>Kako je prošla saradnja?</T>
    <Osoba person={person} />
    <View style={os.rating}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={[os.stars, os.starsLeft]}>
        {STARS.map(value => <ZvezdaDodir key={value} value={value} rating={rating} onRate={setRating}>
          <ZvezdaRavna size={STAR} full={value <= rating} />
        </ZvezdaDodir>)}
      </View>
      <T accessibilityLiveRegion="polite" style={DISPLAY_WORD}>{rating ? ratingLabels[rating] : ' '}</T>
    </View>
    <Oznake tags={tags} onToggle={tag => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])} />
  </OcenaScreen>;
}

export function SacuvanoB({ person, rating = 4, tags = SAVED_TAGS, myName = MY_FIRST_NAME }: { person: ReviewPerson; rating?: number; tags?: readonly ReviewTag[]; myName?: string | null }) {
  useSuccessTick(0);
  return <OcenaScreen footer={<BackFooter />}>
    <T accessibilityRole="alert" style={DISPLAY_WORD}>{myName ? `Hvala, ${myName}.` : 'Hvala.'}</T>
    <View accessible accessibilityRole="text" accessibilityLabel={`Tvoja ocena: ${rating} od 5, ${person.name}`} style={s.small}>
      <View style={s.smallStars}>
        {STARS.map(value => <FactArt key={value} kind="star" size={24} cut="mark" tone={value <= rating ? 'accent' : 'quiet'} />)}
      </View>
      <T variant="note" tone="muted" style={s.shrink}>{`${rating} od 5 · ${person.name}`}</T>
    </View>
    {tags.length ? <T variant="note" tone="muted">{tagsText(tags)}</T> : null}
    <T variant="note" tone="muted">{SACUVANO_NOTE}</T>
  </OcenaScreen>;
}

const s = StyleSheet.create({
  small: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, rowGap: sys.space.xs },
  smallStars: { flexDirection: 'row', gap: sys.space.xs },
  shrink: { flexShrink: 1 },
});
