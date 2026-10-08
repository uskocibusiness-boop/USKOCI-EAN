import React, { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LARGE_LAYOUT, LayoutClassOverride, layoutClassFor, useLayoutClass, type LayoutClassResult } from '../textScale';

/** The window the layout-class hook reads; the one place a test stands in for the device. */
let mockWindow = { width: 361, height: 800, scale: 2, fontScale: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    return Reflect.get(target, key);
  } });
});

/**
 * A gallery can draw the large layout at the phone's own text size (UI/UX pass 2026-10-08, F8a). The layout class is the window's
 * (`useLayoutClass`, the one place the width is read), and a screen cannot change the system's font, so the internal galleries wrap a
 * scene in `LayoutClassOverride`. In the app nothing provides one: the window decides, as it always did.
 */
let tree: ReactTestRenderer | undefined;
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; mockWindow = { width: 361, height: 800, scale: 2, fontScale: 1 }; });
const seen: LayoutClassResult[] = [];
const Probe = () => { seen.push(useLayoutClass()); return null; };
const draw = async (element: React.ReactElement) => { seen.length = 0; await act(async () => { tree = create(element); }); return seen[seen.length - 1]; };

describe('LayoutClassOverride', () => {
  it('is large, and stacked, for what it forces, at any window: the answer the phone gives at text scale 1.3', async () => {
    expect(LARGE_LAYOUT).toEqual({ cls: 'large', stacked: true });
    expect(LARGE_LAYOUT).toBe(layoutClassFor(361, 1.3));
    expect(await draw(createElement(LayoutClassOverride.Provider, { value: LARGE_LAYOUT }, createElement(Probe)))).toBe(LARGE_LAYOUT);
  });

  it('is not there in the app: with no provider the window decides, at ordinary text and at large text', async () => {
    expect(await draw(createElement(Probe))).toEqual({ cls: 'compact', stacked: false });
    await act(async () => tree?.unmount());
    mockWindow = { width: 361, height: 800, scale: 2, fontScale: 1.3 };
    expect(await draw(createElement(Probe))).toEqual({ cls: 'large', stacked: true });
  });

  it('wins over the window it forces, and gives the window back when a provider carries nothing', async () => {
    expect(await draw(createElement(LayoutClassOverride.Provider, { value: LARGE_LAYOUT }, createElement(Probe)))).toEqual({ cls: 'large', stacked: true });
    await act(async () => tree?.unmount());
    expect(await draw(createElement(LayoutClassOverride.Provider, { value: null }, createElement(Probe)))).toEqual({ cls: 'compact', stacked: false });
  });

  it('reaches every component under it, however deep, and none outside it', async () => {
    const Nested = () => createElement(LayoutClassOverride.Provider, { value: LARGE_LAYOUT }, createElement(Probe));
    const results: LayoutClassResult[] = [];
    const Outside = () => { results.push(useLayoutClass()); return null; };
    await act(async () => { tree = create(createElement(React.Fragment, null, createElement(Nested), createElement(Outside))); });
    expect(results[results.length - 1]).toEqual({ cls: 'compact', stacked: false });
    expect(seen[seen.length - 1]).toBe(LARGE_LAYOUT);
  });
});
