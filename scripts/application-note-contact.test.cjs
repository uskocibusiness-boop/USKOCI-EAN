const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = () => import(require('node:url').pathToFileURL(path.join(__dirname, '..', 'src', 'contracts', 'contactDetails.ts')).href);
const root = path.join(__dirname, '..');

test('an application note with a phone, e-mail, link or handle is recognized; dates and prices are not', async () => {
  const { textHasContact } = await load();
  for (const t of ['Zovite me na 064 123 4567', '+381641234567', '064/123-45-67', 'pera.peric@gmail.com', 'vidi www.majstor.rs', 'https://x.rs', 'instagram @pera_majstor'])
    assert.equal(textHasContact(t), true, t);
  for (const t of ['Mogu 28.11.2026. od 08:00, cena 120.000 dinara, imam 15 godina iskustva', 'Dolazim 1.12. u 9h, 4.500 dinara', '', null])
    assert.equal(textHasContact(t), false, String(t));
});

test('the same rule guards the app form, the client service and the database', () => {
  const form = fs.readFileSync(path.join(root, 'src/app/(app)/prilike/[id]/prijava.tsx'), 'utf8');
  assert.match(form, /if \(textHasContact\(draft\.note\)\) \{ setValidation\(APPLICATION_NOTE_CONTACT_MESSAGE\); return; \}/);
  const service = fs.readFileSync(path.join(root, 'src/data/applicationSelectionClientService.ts'), 'utf8');
  assert.match(service, /APPLICATION_NOTE_CONTACT: '22023'/);
  assert.match(service, /if \(textHasContact\(k\.napomena\)\) return/);
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261122105256_application_note_without_contacts.sql'), 'utf8');
  assert.match(sql, /message=''APPLICATION_NOTE_CONTACT''/);
  assert.match(sql, /\[0-9\]\(\[\[:space:\]\.\/-\]\?\[0-9\]\)\{7,\}/);
});
