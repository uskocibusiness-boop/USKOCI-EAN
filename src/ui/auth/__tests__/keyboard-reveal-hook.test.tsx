import React, { createRef, type RefObject } from 'react';
import { Keyboard } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFocusReveal, REVEAL_MARGIN, type RevealBox, type RevealScroll } from '../keyboardReveal';

let mockReduced = false;
jest.mock('../../system/motion', () => ({ useReducedMotion: () => mockReduced }));

/**
 * The hook that keeps the focused field on the screen, on its own (the sign-in screen's own test goes through the whole screen):
 * what it measures, when it scrolls, the keyboard as the lower limit, a newer request retiring an older one, and no glide when the
 * person asked the phone for no motion.
 */
type Api = ReturnType<typeof useFocusReveal>;
const measure = (top: number, height: number) => (done: (x: number, y: number, width: number, height: number) => void) => done(0, top, 361, height);

function mount(view: RevealScroll) {
  const scroll = { current: view } as RefObject<RevealScroll | null>;
  const out: { api?: Api } = {};
  const Probe = () => { out.api = useFocusReveal(scroll); return null; };
  let tree: ReactTestRenderer;
  act(() => { tree = create(<Probe />); });
  return { out, tree: tree! };
}
const boxAt = (top: number, height = 78): RefObject<RevealBox | null> => ({ current: { measureInWindow: measure(top, height) } });

afterEach(() => { mockReduced = false; jest.restoreAllMocks(); });

describe('useFocusReveal', () => {
  it('scrolls by what hides the focused field, from where the scroll area already is, with the air kept', () => {
    const scrollTo = jest.fn();
    const { out } = mount({ measureInWindow: measure(100, 300), scrollTo });
    act(() => out.api!.onScroll({ nativeEvent: { contentOffset: { y: 40 } } } as never));
    act(() => out.api!.api.focus(boxAt(500)));
    expect(scrollTo).toHaveBeenCalledWith({ y: 40 + 500 + 78 + REVEAL_MARGIN - 400, animated: true });
  });

  it('does not scroll for a field that is already in view, and does nothing without something to measure', () => {
    const scrollTo = jest.fn();
    const { out } = mount({ measureInWindow: measure(100, 300), scrollTo });
    act(() => out.api!.api.focus(boxAt(150)));
    expect(scrollTo).not.toHaveBeenCalled();
    const bare = jest.fn();
    const bareMount = mount({ scrollTo: bare });
    act(() => bareMount.out.api!.api.focus(boxAt(500)));
    expect(bare).not.toHaveBeenCalled();
    const noBox = jest.fn();
    const noBoxMount = mount({ measureInWindow: measure(100, 300), scrollTo: noBox });
    act(() => noBoxMount.out.api!.api.focus(createRef<RevealBox>() as RefObject<RevealBox | null>));
    expect(noBox).not.toHaveBeenCalled();
  });

  it('takes the top of the keyboard as the lower limit when the keyboard lies over the screen instead of shrinking it', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({ screenX: 0, screenY: 300, width: 361, height: 400 });
    const scrollTo = jest.fn();
    // The scroll area reaches down to 700 and the field (350..428) is inside it, but the keyboard starts at 300.
    const { out } = mount({ measureInWindow: measure(100, 600), scrollTo });
    act(() => out.api!.api.focus(boxAt(350)));
    expect(scrollTo).toHaveBeenCalledWith({ y: 428 + REVEAL_MARGIN - 300, animated: true });
  });

  it('glides unless the person asked the phone for no motion', () => {
    mockReduced = true;
    const scrollTo = jest.fn();
    const { out } = mount({ measureInWindow: measure(100, 300), scrollTo });
    act(() => out.api!.api.focus(boxAt(500)));
    expect(scrollTo).toHaveBeenCalledWith({ y: 194, animated: false });
  });

  it('forgets a field that let go of the focus: the scroll area changing size afterwards scrolls nothing', () => {
    const scrollTo = jest.fn();
    const { out } = mount({ measureInWindow: measure(100, 300), scrollTo });
    const box = boxAt(500);
    act(() => out.api!.api.focus(box));
    scrollTo.mockClear();
    act(() => out.api!.onLayout({} as never));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => out.api!.api.blur(box));
    scrollTo.mockClear();
    act(() => out.api!.onLayout({} as never));
    expect(scrollTo).not.toHaveBeenCalled();
    // Letting go of a field that is not the focused one changes nothing.
    act(() => out.api!.api.focus(box));
    act(() => out.api!.api.blur(boxAt(10)));
    scrollTo.mockClear();
    act(() => out.api!.onLayout({} as never));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('looks again when the keyboard has finished opening, and listens for it only while it is mounted', () => {
    let shown: (() => void) | undefined; const remove = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: () => void) => {
      if (event === 'keyboardDidShow') shown = handler;
      return { remove };
    }) as never);
    const scrollTo = jest.fn();
    const { out, tree } = mount({ measureInWindow: measure(100, 300), scrollTo });
    act(() => out.api!.api.focus(boxAt(500)));
    scrollTo.mockClear();
    act(() => shown!());
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(remove).toHaveBeenCalled();
  });
});
