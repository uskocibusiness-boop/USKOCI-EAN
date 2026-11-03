import { createFocusedResource } from '../focusedResource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('focused account reads', () => {
  it('aborts a superseded request without letting its late settlement abort or replace the fresh read', async () => {
    const first = deferred<string[]>(), second = deferred<string[]>();
    const load = jest.fn<Promise<string[]>, [AbortSignal]>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const model = createFocusedResource(load, () => true);
    model.start(); const retry = model.refresh();
    const [oldSignal, currentSignal] = load.mock.calls.map(([signal]) => signal);
    expect(oldSignal.aborted).toBe(true); expect(currentSignal.aborted).toBe(false);
    first.resolve(['retired']); await flush();
    expect(currentSignal.aborted).toBe(false); expect(model.snapshot().data).toBeNull();
    second.resolve(['fresh']); await retry;
    expect(model.snapshot().data).toEqual(['fresh']); expect(currentSignal.aborted).toBe(true);
  });

  it.each(['stop', 'forget'] as const)('aborts active transport on %s and gives the next focus a fresh signal', async boundary => {
    const first = deferred<string[]>(), second = deferred<string[]>();
    const load = jest.fn<Promise<string[]>, [AbortSignal]>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const model = createFocusedResource(load, () => true, { coalesce: true });
    model.start(); const old = model.refresh();
    const oldSignal = load.mock.calls[0][0];
    expect(oldSignal.aborted).toBe(false);
    model[boundary](); expect(oldSignal.aborted).toBe(true);
    model.start(); const freshSignal = load.mock.calls[1][0];
    first.reject(new Error('transport ignored cancellation')); await old;
    expect(load).toHaveBeenCalledTimes(2); expect(freshSignal.aborted).toBe(false);
    second.resolve(['fresh']); await flush();
    expect(model.snapshot().data).toEqual(['fresh']); expect(model.snapshot().error).toBe(false);
  });

  it('does not abort a coalesced read early and gives its single trailing read a new signal', async () => {
    const first = deferred<string[]>(), second = deferred<string[]>();
    const load = jest.fn<Promise<string[]>, [AbortSignal]>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const model = createFocusedResource(load, () => true, { coalesce: true });
    model.start(); const joined = model.refresh();
    expect(model.refresh()).toBe(joined); expect(load).toHaveBeenCalledTimes(1);
    const firstSignal = load.mock.calls[0][0]; expect(firstSignal.aborted).toBe(false);
    first.resolve(['first']); await flush();
    expect(firstSignal.aborted).toBe(true); expect(load).toHaveBeenCalledTimes(2);
    const secondSignal = load.mock.calls[1][0];
    expect(secondSignal).not.toBe(firstSignal); expect(secondSignal.aborted).toBe(false);
    second.resolve(['second']); await joined;
    expect(model.snapshot().data).toEqual(['second']); expect(load).toHaveBeenCalledTimes(2);
  });

  it('distinguishes an empty result from a failed read and recovers with retry', async () => {
    const load = jest.fn<Promise<string[]>, []>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    const model = createFocusedResource(load, () => true);
    model.start(); await flush();
    expect(model.snapshot()).toEqual({ data: null, loading: false, error: true, refreshing: false, errorReason: 'UNAVAILABLE' });
    await model.refresh();
    expect(model.snapshot()).toEqual({ data: [], loading: false, error: false , refreshing: false });
  });
  it('latest retry wins even when the older request finishes last', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const model = createFocusedResource<string[]>(load, () => true);
    model.start(); const retry = model.refresh();
    second.resolve(['new']); await retry;
    first.resolve(['old']); await flush();
    expect(model.snapshot().data).toEqual(['new']);
  });
  it('does not publish a response or start a retry after account/intent changes', async () => {
    const request = deferred<string[]>();
    let current = true;
    const load = jest.fn(() => request.promise);
    const model = createFocusedResource(load, () => current);
    const listener = jest.fn(); model.subscribe(listener);
    model.start(); current = false; listener.mockClear();
    request.resolve(['private old account']); await flush(); await model.refresh();
    expect(listener).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledTimes(1);
    expect(model.snapshot().data).toBeNull();
  });
  it('invalidates both success and rejection after blur, then rereads on focus', async () => {
    const first = deferred<string[]>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(['current']);
    const model = createFocusedResource<string[]>(load, () => true);
    model.start(); model.stop(); first.reject(new Error('late')); await flush();
    expect(model.snapshot().error).toBe(false);
    model.start(); await flush(); expect(model.snapshot().data).toEqual(['current']);
  });
});


it('keeps what is on screen during a refresh the person asked for, and still retires it on blur', async () => {
  // Pulling a list down used to delete every card, the count and the create button and replace them
  // with skeletons. The authority rule is unchanged: only `stop()` clears, because only a change of
  // account or intent means the previous read is no longer this person's truth.
  let resolve!: (value: string) => void;
  const load = jest.fn()
    .mockResolvedValueOnce('first')
    .mockImplementationOnce(() => new Promise<string>(keep => { resolve = keep; }));
  const resource = createFocusedResource(load, () => true);
  resource.start();
  await flush();
  expect(resource.snapshot()).toEqual({ data: 'first', loading: false, error: false, refreshing: false });

  void resource.refresh(true);
  expect(resource.snapshot()).toEqual({ data: 'first', loading: false, error: false, refreshing: true });

  resolve('second');
  await flush();
  expect(resource.snapshot()).toEqual({ data: 'second', loading: false, error: false, refreshing: false });

  // Leaving the screen retires the read and stops the spinner, and leaves the answer on screen.
  resource.stop();
  expect(resource.snapshot()).toEqual({ data: 'second', loading: false, error: false, refreshing: false });
});

it('clears a successful snapshot when the app leaves the foreground and refuses hidden refreshes', async () => {
  // Android photographs the screen for the recents switcher; that photograph must not be private
  // data. Leaving the app forgets, and the next focus reads it again.
  const load = jest.fn().mockResolvedValue(['private data']);
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush(); expect(model.snapshot().data).toEqual(['private data']);
  model.forget(); expect(model.snapshot()).toEqual({ data: null, loading: true, error: false , refreshing: false });
  await model.refresh(); expect(load).toHaveBeenCalledTimes(1);
  model.start(); await flush(); expect(load).toHaveBeenCalledTimes(2);
});

it('shows what a screen had when you come back to it, with nothing flashing in between', async () => {
  // Zadaci → Dogovori → Zadaci used to cost two round trips and two screens of skeletons, for data
  // that was seconds old.
  const load = jest.fn().mockResolvedValueOnce(['prvi']).mockResolvedValueOnce(['prvi', 'drugi']);
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush();
  model.stop();
  model.start();
  expect(model.snapshot()).toEqual({ data: ['prvi'], loading: false, error: false, refreshing: false });
  await flush();
  expect(model.snapshot().data).toEqual(['prvi', 'drugi']);
  expect(load).toHaveBeenCalledTimes(2);
});

it('keeps the screen when a re-read nobody asked for fails, instead of turning it into an error', async () => {
  const load = jest.fn().mockResolvedValueOnce(['prvi']).mockRejectedValueOnce(new Error('offline'));
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush();
  model.stop(); model.start(); await flush();
  expect(model.snapshot()).toEqual({ data: ['prvi'], loading: false, error: false, refreshing: false });
});

it('loads as if for the first time when the screen has been away long enough', async () => {
  const now = jest.spyOn(Date, 'now');
  const load = jest.fn().mockResolvedValue(['prvi']);
  const model = createFocusedResource<string[]>(load, () => true);
  now.mockReturnValue(1_000_000);
  model.start(); await flush();
  model.stop();
  now.mockReturnValue(1_000_000 + 5 * 60_000 + 1);
  model.start();
  expect(model.snapshot()).toEqual({ data: null, loading: true, error: false, refreshing: false });
  now.mockRestore();
});

it('never shows one account the screen that belonged to another', async () => {
  let current = true;
  const load = jest.fn().mockResolvedValue(['private data']);
  const model = createFocusedResource<string[]>(load, () => current);
  model.start(); await flush(); expect(model.snapshot().data).toEqual(['private data']);
  model.stop();
  current = false;
  model.start();
  expect(model.snapshot()).toEqual({ data: null, loading: true, error: false, refreshing: false });
  expect(load).toHaveBeenCalledTimes(1);
});

describe('opt-in conversation refresh continuity', () => {
  const policy = { retainOnRefresh: true, coalesce: true };
  it('retains the transcript through a failed refresh and exposes its own retry status', async () => {
    const update = deferred<string[]>();
    const load = jest.fn().mockResolvedValueOnce(['read message']).mockReturnValueOnce(update.promise)
      .mockResolvedValueOnce(['read message', 'new message']);
    const model = createFocusedResource<string[]>(load, () => true, policy);
    model.start(); await flush();
    const refresh = model.refresh();
    expect(model.snapshot()).toMatchObject({ data: ['read message'], loading: false, error: false, refreshing: true, refreshError: false });
    update.reject(new Error('offline')); await refresh;
    expect(model.snapshot()).toMatchObject({ data: ['read message'], loading: false, error: false, refreshing: false, refreshError: true });
    await model.refresh();
    expect(model.snapshot()).toMatchObject({ data: ['read message', 'new message'], loading: false, error: false, refreshing: false });
    expect(model.snapshot().refreshError).toBeFalsy();
  });

  it('keeps a first failure distinct from a loaded empty conversation', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    const model = createFocusedResource<string[]>(load, () => true, policy);
    model.start(); await flush();
    expect(model.snapshot()).toEqual({ data: null, loading: false, error: true, refreshing: false, errorReason: 'UNAVAILABLE' });
    await model.refresh(); await model.refresh();
    expect(model.snapshot()).toMatchObject({ data: [], loading: false, error: false, refreshing: false, refreshError: true });
  });

  it('serializes a manual read and a completed-send refresh into one trailing read', async () => {
    const first = deferred<string[]>(), trailing = deferred<string[]>();
    const load = jest.fn().mockResolvedValueOnce(['history']).mockReturnValueOnce(first.promise).mockReturnValueOnce(trailing.promise);
    const model = createFocusedResource<string[]>(load, () => true, policy);
    model.start(); await flush();
    const manual = model.refresh(), send = model.refresh(), retry = model.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(send).toBe(manual); expect(retry).toBe(manual);
    let finished = false; void send.then(() => { finished = true; });
    first.resolve(['history']); await flush();
    expect(load).toHaveBeenCalledTimes(3); expect(finished).toBe(false);
    expect(model.snapshot()).toMatchObject({ data: ['history'], refreshing: true });
    trailing.resolve(['history', 'just accepted send']); await send;
    expect(model.snapshot().data).toEqual(['history', 'just accepted send']);
    expect(finished).toBe(true); expect(load).toHaveBeenCalledTimes(3);
  });

  it.each(['stop', 'forget'] as const)('retires the active and queued reads on %s before a new focus', async boundary => {
    const stale = deferred<string[]>(), fresh = deferred<string[]>();
    const load = jest.fn().mockResolvedValueOnce(['history']).mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);
    const model = createFocusedResource<string[]>(load, () => true, policy);
    model.start(); await flush();
    const old = model.refresh(); void model.refresh();
    model[boundary](); model.start();
    expect(load).toHaveBeenCalledTimes(3);
    fresh.resolve(['current']); await flush();
    stale.resolve(['retired']); await old;
    expect(model.snapshot().data).toEqual(['current']); expect(load).toHaveBeenCalledTimes(3);
  });

  it('never starts a queued refresh or publishes a late result after ownership changes', async () => {
    let current = true;
    const pending = deferred<string[]>();
    const load = jest.fn().mockResolvedValueOnce(['history']).mockReturnValueOnce(pending.promise);
    const model = createFocusedResource<string[]>(load, () => current, policy);
    model.start(); await flush();
    const waiting = model.refresh(); void model.refresh(); current = false;
    const listener = jest.fn(); model.subscribe(listener);
    pending.resolve(['another account result']); await waiting; await model.refresh();
    expect(listener).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledTimes(2);
    expect(model.snapshot().data).toEqual(['history']);
  });
});

describe('safe read failure lifetime', () => {
  it('retains a successful snapshot and a safe reason on refresh failure, then clears the reason on retry', async () => {
    const retry = deferred<string[]>();
    const load = jest.fn().mockResolvedValueOnce(['last confirmed snapshot'])
      .mockRejectedValueOnce({ code: '42501', message: 'private SQL payload', details: 'private details' })
      .mockReturnValueOnce(retry.promise);
    const model = createFocusedResource<string[]>(load, () => true, { retainOnRefresh: true });
    model.start(); await flush(); await model.refresh();
    expect(model.snapshot()).toEqual({ data: ['last confirmed snapshot'], loading: false, error: false,
      refreshing: false, refreshError: true, errorReason: 'FORBIDDEN' });
    expect(JSON.stringify(model.snapshot())).not.toContain('private');
    const pending = model.refresh();
    expect(model.snapshot()).toMatchObject({ data: ['last confirmed snapshot'], refreshing: true, refreshError: false });
    expect(model.snapshot().errorReason).toBeUndefined();
    retry.resolve(['fresh snapshot']); await pending;
    expect(model.snapshot()).toEqual({ data: ['fresh snapshot'], loading: false, error: false, refreshing: false });
  });

  it('does not publish an old failure over a newer failed read, and forget clears the diagnostic', async () => {
    const old = deferred<string[]>(), fresh = deferred<string[]>();
    const load = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const model = createFocusedResource<string[]>(load, () => true);
    model.start(); const retry = model.refresh();
    fresh.reject(new Error('OPPORTUNITIES_RESPONSE_INVALID')); await retry;
    expect(model.snapshot().errorReason).toBe('CONTRACT');
    old.reject(new Error('AUTH_REQUIRED')); await flush();
    expect(model.snapshot().errorReason).toBe('CONTRACT');
    model.forget();
    expect(model.snapshot()).toEqual({ data: null, loading: true, error: false, refreshing: false });
  });
});
