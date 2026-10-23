import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWN3Z3p2anN4dWdmZ3pkbXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTQ1MzUsImV4cCI6MjEwMzIzMDUzNX0.xXDf315iaIwtNwK2u2ZB8m3Dw5amx3eFsA4_adw6hMk';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const testEmail = process.env.USKOCI_TEST_EMAIL || 'test_ai_agent_sim_1792703736740@uskoci.rs';
const testPassword = process.env.USKOCI_TEST_PASSWORD || '';

if (!testPassword) {
  console.error('USKOCI_TEST_PASSWORD environment variable must be set to run this benchmark.');
  process.exit(1);
}

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: testEmail,
  password: testPassword,
});

if (authErr) {
  console.error('Auth error:', authErr);
  process.exit(1);
}

const token = auth.session.access_token;

// 1. Open new conversation
const openRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_ai_open_need_conversation_owned_v2`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ p_client_request_id: crypto.randomUUID() }),
});
const { conversationId: convId } = await openRes.json();
console.log('=== BENCHMARK RAZGOVORA: NOVI ZADATAK (POLIRANJE DRAGOG KAMENJA) ===');
console.log('ID Razgovora:', convId);

async function sendTurn(turnNum, text) {
  console.log(`\n--- Turn ${turnNum} ---`);
  console.log(`Korisnik: "${text}"`);
  const t0 = performance.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/uskoci-ai-interview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationId: convId,
      clientRequestId: crypto.randomUUID(),
      text,
    }),
  });
  const dur = ((performance.now() - t0) / 1000).toFixed(2);
  const data = await res.json();
  console.log(`Status: HTTP ${res.status} za ${dur}s`);
  return { status: res.status, dur, data };
}

await sendTurn(1, 'Ćao! Treba mi pregled i poliranje dragog kamenja u Novom Sadu');
await sendTurn(2, 'Radi se o tri komada rubina, u centru kod Spensa.');
await sendTurn(3, 'Sutra od 14h, a budžet je 4000 dinara.');

// Read back conversation
const { data: messages } = await supabase
  .from('ai_messages')
  .select('role, body')
  .eq('conversation_id', convId)
  .order('sequence_no', { ascending: true });

console.log('\n=== ZAVRŠNI RAZGOVOR U BAZI ===');
for (const m of messages ?? []) {
  console.log(`[${m.role}]: ${m.body}`);
}
