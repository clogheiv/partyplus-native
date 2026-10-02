// Assessment-only reproductions of current defects, not release acceptance tests.
// Uses the current TypeScript modules with in-memory adapters. No network,
// credentials, native storage, or production database is accessed.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadModule(relativePath, adapters) {
  const file = path.join(root, relativePath);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports,
    module,
    require(name) {
      if (Object.hasOwn(adapters, name)) return adapters[name];
      throw new Error(`Unmocked import prohibited: ${name}`);
    },
    __DEV__: false,
    console,
  }, { filename: file });
  return module.exports;
}

function storageFixture(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

function remoteFixture(configured = true) {
  const tables = { parties: [], party_items: [], party_rsvps: [] };
  let failInsertTable;
  const supabase = {
    from(table) {
      const query = {
        operation: 'select', filter: null, rows: [], single: false,
        select() { this.operation = 'select'; return this; },
        delete() { this.operation = 'delete'; return this; },
        insert(rows) { this.operation = 'insert'; this.rows = rows; return this; },
        upsert(row) { this.operation = 'upsert'; this.rows = [row]; return this; },
        update(row) { this.operation = 'update'; this.rows = [row]; return this; },
        eq(key, value) { this.filter = [key, value]; return this; },
        order() { return this; },
        maybeSingle() { this.single = true; return this; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            const matches = (row) => !this.filter || row[this.filter[0]] === this.filter[1];
            if (this.operation === 'insert' && failInsertTable === table) {
              return { data: null, error: { message: 'Injected insert failure' } };
            }
            if (this.operation === 'delete') tables[table] = tables[table].filter((row) => !matches(row));
            if (this.operation === 'insert') tables[table].push(...this.rows);
            if (this.operation === 'upsert') {
              for (const row of this.rows) {
                const index = tables[table].findIndex((entry) => entry.id === row.id);
                if (index < 0) tables[table].push(row);
                else tables[table][index] = row;
              }
            }
            if (this.operation === 'update') {
              tables[table] = tables[table].map((row) => matches(row) ? { ...row, ...this.rows[0] } : row);
            }
            const rows = tables[table].filter(matches);
            return { data: this.single ? rows[0] ?? null : rows, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const adapters = {
    '../lib/supabase': { supabase, isSupabaseConfigured: configured },
    '../lib/supabaseErrorLogging': { logSupabaseError() {} },
  };
  const rsvps = loadModule('src/data/partyRsvps.ts', adapters);
  const parties = loadModule('src/data/parties.ts', { ...adapters, './partyRsvps': rsvps });
  return { tables, parties, rsvps, failInsert(table) { failInsertTable = table; } };
}

const timestamp = '2026-10-02T12:00:00.000Z';
const rsvp = (id) => ({ id, name: id, status: 'yes', attendeeCount: 1, updatedAt: timestamp });
const party = (id = 'fixture-party') => ({
  id, title: 'Fixture only', items: [{ id: 'fixture-item', name: 'Ice' }],
  rsvps: [], hostId: 'fixture-host', createdAt: timestamp, updatedAt: timestamp,
});

async function run() {
  let count = 0;
  async function reproduce(label, fn) {
    await fn();
    count += 1;
    console.log(`REPRODUCED: ${label}`);
  }

  await reproduce('A stale guest RSVP snapshot erases a previously saved guest', async () => {
    const fixture = remoteFixture();
    await fixture.rsvps.replaceRemotePartyRsvps('fixture-party', [rsvp('guest-A')]);
    await fixture.rsvps.replaceRemotePartyRsvps('fixture-party', [rsvp('guest-B')]);
    assert.deepEqual(fixture.tables.party_rsvps.map((row) => row.id), ['guest-B']);
  });

  await reproduce('An item insert failure leaves the collection deleted', async () => {
    const fixture = remoteFixture();
    fixture.tables.party_items.push({ id: 'existing', party_id: 'fixture-party', name: 'Cake' });
    fixture.failInsert('party_items');
    await assert.rejects(fixture.parties.replaceRemotePartyItems('fixture-party', party().items));
    assert.equal(fixture.tables.party_items.length, 0);
  });

  await reproduce('Aggregate create can fail after the party row is already saved', async () => {
    const fixture = remoteFixture();
    fixture.failInsert('party_items');
    await assert.rejects(fixture.parties.createRemoteParty(party()));
    assert.equal(fixture.tables.parties.length, 1);
    assert.equal(fixture.tables.party_items.length, 0);
  });

  await reproduce('Host save from a stale local snapshot erases a newer cloud RSVP', async () => {
    const fixture = remoteFixture();
    await fixture.parties.createRemoteParty(party());
    await fixture.rsvps.replaceRemotePartyRsvps('fixture-party', [rsvp('guest-A')]);
    await fixture.parties.createRemoteParty({ ...party(), title: 'Host edited title' });
    assert.equal(fixture.tables.party_rsvps.length, 0);
  });

  await reproduce('A missing backend configuration returns null without rejecting a save', async () => {
    const fixture = remoteFixture(false);
    assert.equal(await fixture.parties.createRemoteParty(party()), null);
    assert.equal(fixture.tables.parties.length, 0);
  });

  await reproduce('Concurrent local party writes lose one party', async () => {
    const storage = storageFixture();
    const store = loadModule('src/lib/partyStore.ts', {
      '@react-native-async-storage/async-storage': storage,
    });
    await Promise.all([store.upsertParty(party('A')), store.upsertParty(party('B'))]);
    assert.equal((await store.getParties()).length, 1);
  });

  await reproduce('A corrupt local store reads as empty and is replaced on the next save', async () => {
    const storage = storageFixture({ 'partyplus.parties.v1': '{corrupt' });
    const store = loadModule('src/lib/partyStore.ts', {
      '@react-native-async-storage/async-storage': storage,
    });
    assert.equal((await store.getParties()).length, 0);
    await store.upsertParty(party());
    assert.equal(JSON.parse(storage.values.get('partyplus.parties.v1')).length, 1);
  });

  await reproduce('Concurrent first-use identity calls return different user IDs', async () => {
    const storage = storageFixture();
    const ids = loadModule('src/lib/ids.ts', {
      '@react-native-async-storage/async-storage': storage,
    });
    const [first, second] = await Promise.all([ids.ensureUserId(), ids.ensureUserId()]);
    assert.notEqual(first, second);
    assert.equal(storage.values.get('userId'), second);
  });

  await reproduce('An empty RSVP refresh clears an otherwise owned item claim in reconciliation', async () => {
    const logic = loadModule('src/lib/partyLogic.ts', {});
    const result = logic.reconcilePartyState({
      ...party(), rsvps: [],
      items: [{ id: 'fixture-item', name: 'Ice', claimedBy: 'guest-A', claimedByUserId: 'guest-A' }],
    });
    assert.equal(result.items[0].claimedByUserId, undefined);
  });

  console.log(`${count} current defects reproduced with in-memory adapters; no live integration verified.`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
