import { assertLocalDeviceProofTargets } from './ru5_device_ui_local_guard.mjs';

// Reuse the proven strict loopback contract. This journey creates real Auth
// users and a PUBLISHED fixture; it must never touch cloud DEV or production.
export const RU5_TWO_ACCOUNT_LOCAL_ACK='LOCAL_DISPOSABLE_TWO_AUTH_SEEDED_NEED';
export function assertRu5TwoAccountLocal(env) {
  if (env?.RU5_TWO_ACCOUNT_LOCAL_ACK !== RU5_TWO_ACCOUNT_LOCAL_ACK)
    throw new Error('RU5_TWO_ACCOUNT_LOCAL_ACK_REQUIRED');
  // Shared guard does not expose database credentials in error messages.
  assertLocalDeviceProofTargets(env.SUPABASE_URL,env.DB_URL);
  return true;
}
