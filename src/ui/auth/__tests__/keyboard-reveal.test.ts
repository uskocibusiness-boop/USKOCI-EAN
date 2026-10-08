import { revealDelta } from '../keyboardReveal';

/**
 * How far the sheet scrolls to keep the field that is being typed in on the screen (owner, 2026-10-07: with the keyboard up the
 * "Lozinka" field vanished behind the pinned "Prijavi se"). Pure arithmetic: the hook that measures and scrolls is tested through
 * the sign-in screen itself (`auth-entry-surface.test.tsx`, "the field being typed in stays in view").
 */
const view = { viewTop: 100, viewBottom: 400 };
const margin = 16;

describe('revealDelta', () => {
  it('is 0 when the whole field is in view with its air around it', () => {
    expect(revealDelta({ top: 150, bottom: 228, ...view, margin })).toBe(0);
    // Exactly the air above and below: 116 is 16 under the top, 384 is 16 over the bottom.
    expect(revealDelta({ top: 116, bottom: 384, ...view, margin })).toBe(0);
  });

  it('scrolls down by what hides the bottom of the field, and keeps the air', () => {
    expect(revealDelta({ top: 500, bottom: 578, ...view, margin })).toBe(194);
    // One dp too low: one dp of scroll, not a jump.
    expect(revealDelta({ top: 307, bottom: 385, ...view, margin })).toBe(1);
  });

  it('scrolls up by what hides the top of the field, and keeps the air', () => {
    expect(revealDelta({ top: 90, bottom: 168, ...view, margin })).toBe(-26);
    expect(revealDelta({ top: 115, bottom: 193, ...view, margin })).toBe(-1);
  });

  it('shows the TOP of a field that is taller than the room, which is where its label is', () => {
    expect(revealDelta({ top: 300, bottom: 700, ...view, margin })).toBe(300 - margin - 100);
    expect(revealDelta({ top: 20, bottom: 420, ...view, margin })).toBe(20 - margin - 100);
  });

  it('works whatever the margin is, and never asks for a move a field that fits does not need', () => {
    expect(revealDelta({ top: 150, bottom: 228, ...view, margin: 0 })).toBe(0);
    expect(revealDelta({ top: 330, bottom: 400, ...view, margin: 0 })).toBe(0);
    expect(revealDelta({ top: 330, bottom: 401, ...view, margin: 0 })).toBe(1);
  });

  it('the keyboard shrinking the room is the same arithmetic: a field that was in view stands below the new bottom', () => {
    // Before the keyboard the room is 100..800 and the password field (500..578) is in view; after it, the room is 100..400.
    expect(revealDelta({ top: 500, bottom: 578, viewTop: 100, viewBottom: 800, margin })).toBe(0);
    expect(revealDelta({ top: 500, bottom: 578, viewTop: 100, viewBottom: 400, margin })).toBe(194);
  });
});
