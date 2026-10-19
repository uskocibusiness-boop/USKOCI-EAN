// One validator is shared with the Edge transport. This client wrapper adds only
// display words, never inferred shipping options, addresses or matching authority.
export { decodeServiceHandoff, formatServiceHandoff as serviceHandoffText } from '../../supabase/functions/_shared/serviceHandoff.mjs';
export type { ServiceHandoff } from '../../supabase/functions/_shared/serviceHandoff.mjs';
