import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Owner rules, 2026-10-07: no bounce, no overshoot, reduced motion respected. The conversation of a Dogovor and the Poruke list move
 * nothing themselves: a bubble, a mark, a progress line and a separator appear in their final form, the one place something gives
 * (a press) is the system's `Press`, which reads the reduced-motion store, and every programmatic scroll jumps. This reads the SOURCE
 * of the files this unit owns, so a spring, a timing or a gliding scroll cannot be added without this suite being looked at.
 */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');
const OWNED = [
  'src/ui/AgreementChat.tsx', 'src/ui/messages/MessageBubbles.tsx', 'src/ui/messages/MessageMark.tsx', 'src/ui/messages/bubbleShape.ts',
  'src/ui/messages/threadModel.ts', 'src/ui/messages/useAutoResend.ts', 'src/ui/messages/ConversationInboxPresentation.tsx',
  'src/ui/v2/AgreementThreadPresentation.tsx', 'src/ui/groups/GroupConversationPresentation.tsx',
];
const MOTION = /react-native-reanimated|\bAnimated\b|LayoutAnimation|withSpring|withTiming|withDelay|useNativeDriver|\bduration\s*:|\bEasing\b|\b(?:bounce|overshoot|elastic)\b/;

describe('the conversation draws nothing that moves', () => {
  it.each(OWNED)('%s has no animation, spring, timing or easing of its own', path => {
    // The group's arrival of a NEW message is the system `Appear`, which reads the reduced-motion store; it is the one allowed exception.
    const source = read(path).replace(/useAppear|Appear\b/g, '');
    expect(source.match(MOTION) ?? []).toEqual([]);
  });

  it('every scroll the thread makes on its own jumps: animated is false, never true or a variable', () => {
    const source = read('src/ui/AgreementChat.tsx');
    const flags = [...source.matchAll(/animated\s*:\s*(\w+)/g)].map(match => match[1]);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every(flag => flag === 'false')).toBe(true);
  });

  it('the progress of a voice message is the player\'s position as a width, not an animated value', () => {
    const source = read('src/ui/messages/MessageBubbles.tsx');
    expect(source).toMatch(/width: `\$\{Math\.round\(share \* 100\)\}%`/);
  });

  it('the mark does not animate its change: pending to sent to seen is a state, said in its final form', () => {
    const source = read('src/ui/messages/MessageMark.tsx');
    expect(source).not.toMatch(MOTION);
    expect(source).toMatch(/accessibilityLiveRegion=\{live \? 'polite' : 'none'\}/);
  });
});
