// Staging-only, known synthetic party. Never reads or records the test email/code.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const stage = JSON.parse(await fs.readFile('.test-cache/staging-credentials.json', 'utf8'));
assert.equal(stage.url, 'https://qmbwrbxbbshbavfhkujx.supabase.co');
const partyId = 'synthetic-android-8e0acf50-d0b5-4ad2-9c10-5d14a5b577ad';
const mode = process.argv[2];
assert.ok(['baseline', 'verified'].includes(mode));
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = createClient(stage.url, stage.publishableKey, options);
const { data: party, error } = await client.rpc('partyplus_v2_read_party', { p_party_id: partyId });
if (error) throw Error(error.code + ': ' + error.message);
assert.equal(party.id, partyId);
const response = party.rsvps.find(r => r.name === 'Android Guest');
assert.ok(response);
assert.equal(response.attendeeCount, 2);
const ice = party.items.find(i => i.name === 'Ice');
assert.ok(ice);
assert.equal(ice.claimedByUserId, response.id);
assert.equal(party.items.filter(i => i.name === 'Android Cups').length, 1);
const result = {
  projectRef: 'qmbwrbxbbshbavfhkujx', partyId, mode,
  guestPrincipal: response.id, guestResponse: response,
  claimItemId: ice.id, claimPrincipal: ice.claimedByUserId,
  observedAt: new Date().toISOString(),
  scope: 'Independent known-ID read of synthetic phone guest state; no email/code captured',
};
if (mode === 'verified') {
  assert.ok(stage.secretKey, 'Existing staging admin key required for independent Auth metadata verification');
  const baseline = JSON.parse(await fs.readFile('docs/cutover-evidence-2026-10-03/phone-linking-baseline.json', 'utf8'));
  assert.equal(response.id, baseline.guestPrincipal);
  assert.deepEqual(response, baseline.guestResponse);
  assert.equal(ice.id, baseline.claimItemId);
  assert.equal(ice.claimedByUserId, baseline.claimPrincipal);
  const admin = createClient(stage.url, stage.secretKey, options);
  const identity = await admin.auth.admin.getUserById(response.id);
  if (identity.error) throw Error('Staging Auth metadata lookup failed');
  assert.equal(identity.data.user.id, baseline.guestPrincipal);
  assert.equal(identity.data.user.is_anonymous, false);
  assert.ok(identity.data.user.email_confirmed_at);
  result.auth = { samePrincipal: true, anonymous: false, emailConfirmed: true };
  result.scope = 'Independent Auth and known-ID guest-state preservation after human delivered-code verification; no email/code captured';
}
result.status = 'passed';
await fs.writeFile(`docs/cutover-evidence-2026-10-03/phone-linking-${mode}.json`, JSON.stringify(result, null, 2) + '\n');
console.log('PASS staging phone guest ownership ' + mode + (mode === 'verified' ? ' and verified Auth identity' : ''));
