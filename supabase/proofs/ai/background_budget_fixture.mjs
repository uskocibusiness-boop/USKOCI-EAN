// Explicit synthetic admission for catalog/semantic-only builder tests.
// Real reserve/usage behavior is exercised in background_provider_budget.test.mjs.
export const syntheticBackgroundBudget = Object.freeze({
  beforeAttempt: async () => ({ reservationId: 'SYNTHETIC_BACKGROUND_RESERVATION' }),
  onAttempt: async () => undefined,
});
