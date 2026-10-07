import { permissionAsk, type PermissionAskAnswer, type PermissionKind } from '../permissionAsk';

/**
 * A stand-in for the person, for the suites of the places that ask (voice, media, location): it mounts a host that draws
 * nothing and answers every question the way the test chooses, and records which questions were asked and in what order.
 * Real dialogs are tested where they are drawn (ui/permissions/__tests__).
 */
export function answeringHost(answer: PermissionAskAnswer | ((kind: PermissionKind) => PermissionAskAnswer)) {
  const host = {};
  const asked: PermissionKind[] = [];
  const unmount = permissionAsk.mountHost(host);
  const off = permissionAsk.subscribe(() => {
    const open = permissionAsk.current(host);
    if (!open) return;
    asked.push(open.kind);
    // Answered on the next turn, as a person's tap would be, never inside the notification of the question itself.
    void Promise.resolve().then(() => permissionAsk.answer(open.id, typeof answer === 'function' ? answer(open.kind) : answer));
  });
  return { asked, stop() { off(); unmount(); } };
}

/** A host that holds every question until the test answers it: the person who is still reading. */
export function holdingHost() {
  const host = {};
  const unmount = permissionAsk.mountHost(host);
  return {
    open: () => permissionAsk.current(host),
    answer(value: PermissionAskAnswer) { const open = permissionAsk.current(host); if (open) permissionAsk.answer(open.id, value); },
    stop: unmount,
  };
}
