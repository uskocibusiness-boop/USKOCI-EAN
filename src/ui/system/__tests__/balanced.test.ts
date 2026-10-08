import { BALANCED_LINES, balancedStyle } from '../balanced';

/**
 * Balanced lines (UI/UX pass 2026-10-08, F8b): a centred title of two lines is two lines of about one length, not a long one and a lonely word.
 * Android is asked through the text's own break strategy, the web design lab through the CSS property that does the same, and no other
 * platform is asked for anything.
 */
describe('balanced lines', () => {
  it('asks Android for the balanced break strategy, which is a prop of the text', () => {
    expect(BALANCED_LINES).toEqual({ textBreakStrategy: 'balanced' });
  });

  it('gives a phone no style of its own for it: under Jest the platform is not the web', () => {
    expect(balancedStyle).toBeUndefined();
  });

  it('gives the web design lab the CSS one, so a screenshot taken there says what the phone is asked for', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const onTheWeb = require('../balanced') as typeof import('../balanced');
      expect(onTheWeb.balancedStyle).toEqual({ textWrap: 'balance' });
      expect(onTheWeb.BALANCED_LINES).toEqual({ textBreakStrategy: 'balanced' });
    });
    jest.dontMock('react-native');
  });
});
