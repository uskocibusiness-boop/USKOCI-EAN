import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PULL_GRACE_MS, usePullRefresh } from '../usePullRefresh';

// The owner's phone showed the Android pull spinner as a white dot over the Poruke switch: the list raised it for every background read.
let latest: ReturnType<typeof usePullRefresh> | undefined;
const seen = () => latest!;
function Probe({ busy, reload }: { busy: boolean; reload?: () => void }) {
  latest = usePullRefresh(reload, busy);
  return null;
}
let tree: ReactTestRenderer | undefined;
const show = (busy: boolean, reload?: () => void) => act(() => {
  if (tree) tree.update(<Probe busy={busy} reload={reload} />); else tree = create(<Probe busy={busy} reload={reload} />);
});

describe('usePullRefresh', () => {
  beforeEach(() => { jest.useFakeTimers(); latest = undefined; });
  afterEach(() => { act(() => tree?.unmount()); tree = undefined; jest.useRealTimers(); });

  it('never shows the spinner for a read nobody pulled', () => {
    const reload = () => {};
    show(false, reload);
    show(true, reload);
    expect(seen().refreshing).toBe(false);
  });

  it('shows it while the pulled read runs and lets go when it ends', () => {
    const reload = jest.fn();
    show(false, reload);
    act(() => seen().onRefresh?.());
    expect(reload).toHaveBeenCalledTimes(1);
    show(true, reload);
    expect(seen().refreshing).toBe(true);
    show(false, reload);
    expect(seen().refreshing).toBe(false);
    // The next background read is not a pull.
    show(true, reload);
    expect(seen().refreshing).toBe(false);
  });

  it('lets go of a pull that started nothing, so a later background read does not borrow it', () => {
    const reload = () => {};
    show(false, reload);
    act(() => seen().onRefresh?.());
    act(() => { jest.advanceTimersByTime(PULL_GRACE_MS + 1); });
    show(true, reload);
    expect(seen().refreshing).toBe(false);
  });

  it('offers no pull when the screen has no refresh', () => {
    show(false);
    expect(seen().onRefresh).toBeUndefined();
  });
});
