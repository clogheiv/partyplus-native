import assert from "node:assert/strict";
import test from "node:test";
import { loadTs, memoryStorage } from "./load-ts.mjs";
const { createLocalRepository, PARTY_CACHE_KEY, DRAFTS_KEY } = loadTs("src/lib/localRepository.ts");
const { createDeviceIdentity } = loadTs("src/lib/identity.ts");
const { createDraft, updateDraftFields, commitDraft } = loadTs("src/lib/partyDraft.ts");
const { createPartyOutbox } = loadTs("src/lib/partyOutbox.ts");
const { createLatestPartyLoader, requireShareableParty } = loadTs("src/lib/loadParty.ts");
const { validateBackendBoundary } = loadTs("src/lib/backendBoundary.ts");
const { reconcilePartyState } = loadTs("src/lib/partyLogic.ts");
const party = (id = "legacy-party-7") => ({ id, title: "Synthetic party", items: [], createdAt: "2020-01-01", updatedAt: "2020-01-01" });
const receipt = (p, op) => ({ committed: true, operationId: op, party: { ...p, revision: 1 } });

test("simultaneous first-use identity calls allocate once, preserving legacy identity exactly", async () => {
  const storage = memoryStorage(); let allocations = 0;
  const identity = createDeviceIdentity(storage, () => "device-" + ++allocations);
  assert.deepEqual(await Promise.all(Array.from({ length: 40 }, identity)), Array(40).fill("device-1"));
  assert.equal(allocations, 1);
  const legacy = createDeviceIdentity(memoryStorage({ userId: "old-device-not-uuid" }), () => assert.fail("Must not reassign"));
  assert.equal(await legacy(), "old-device-not-uuid");
});

test("identity persistence failure permits retry rather than returning a nondurable identity", async () => {
  const storage = memoryStorage(); const set = storage.setItem; let fail = true;
  storage.setItem = async (...args) => { if (fail) throw Error("storage full"); return set(...args); };
  const identify = createDeviceIdentity(storage, () => "device");
  await assert.rejects(identify()); fail = false;
  assert.equal(await identify(), "device");
});

test("parallel cache and draft mutations preserve every unrelated record", async () => {
  const store = createLocalRepository(memoryStorage());
  await Promise.all(Array.from({ length: 30 }, (_, i) => store.upsertParty(party("legacy-" + i))));
  await Promise.all(Array.from({ length: 30 }, (_, i) => store.setDraft("draft-" + i, { id: i })));
  assert.equal((await store.getParties()).length, 30);
  await Promise.all(Array.from({ length: 30 }, async (_, i) => assert.equal((await store.getDraft("draft-" + i)).id, i)));
  await Promise.all([store.deletePartyById("legacy-1"), store.upsertParty(party("new"))]);
  assert.equal((await store.getParties()).length, 30);
  assert.equal(await store.getPartyById("legacy-1"), null);
});

for (const raw of ["{broken", '{"wrong":"shape"}', '[{"id":"legacy","title":"Party","items":[null]}]']) {
  test("corrupt cache is backed up byte-for-byte and never overwritten: " + raw, async () => {
    const storage = memoryStorage({ [PARTY_CACHE_KEY]: raw }); const store = createLocalRepository(storage);
    await assert.rejects(store.getParties(), { code: "local_corrupt" });
    await assert.rejects(store.upsertParty(party()), { code: "local_corrupt" });
    assert.equal(storage.values.get(PARTY_CACHE_KEY), raw);
    const backups = [...storage.values].filter(([key]) => key.includes(".recovery."));
    assert.equal(backups.length, 1); assert.equal(JSON.parse(backups[0][1]).raw, raw);
  });
}

test("corrupt drafts survive attempted autosave", async () => {
  const storage = memoryStorage({ [DRAFTS_KEY]: "[]" }); const store = createLocalRepository(storage);
  await assert.rejects(store.setDraft("new", createDraft("new", "id")), { code: "local_corrupt" });
  assert.equal(storage.values.get(DRAFTS_KEY), "[]");
});

test("discarding a pending draft archives its operation atomically and preserves it when storage fails", async () => {
  const storage = memoryStorage(); const store = createLocalRepository(storage);
  const pending = { ...createDraft("edit:legacy", "legacy"), status: "pending", operationId: "uncertain-operation" };
  await store.setDraft(pending.key, pending);
  const set = storage.setItem;
  storage.setItem = async () => { throw Error("disk full"); };
  await assert.rejects(store.archiveDraft(pending.key, "recovery:legacy"), { code: "local_unavailable" });
  assert.deepEqual(await store.getDraft(pending.key), pending);
  assert.equal(await store.getDraft("recovery:legacy"), undefined);
  storage.setItem = set;
  await store.archiveDraft(pending.key, "recovery:legacy");
  assert.equal(await store.getDraft(pending.key), undefined);
  assert.deepEqual(await store.getDraft("recovery:legacy"), pending);
});

test("uncertain commit survives restart and replays identical party, item IDs, operation and receipt", async () => {
  const store = createLocalRepository(memoryStorage()); let ids = 0; const requests = [];
  const draft = updateDraftFields(createDraft("new", "fixed-party"), { title: "Birthday", location: "", notes: "", date: "", items: ["Ice"], pendingItem: "", manualItemPrefixLength: 0 });
  const build = () => ({ ...party(draft.id), items: [{ id: "fixed-item", name: "Ice" }] });
  const persist = value => store.setDraft("new", value);
  const server = async (p, op) => { requests.push({ p, op }); if (requests.length === 1) throw Error("network lost after commit"); return receipt(p, op); };
  const failed = await commitDraft(draft, build, () => "op-" + ++ids, persist, server);
  assert.equal(failed.status, "failed");
  const restored = await store.getDraft("new");
  const success = await commitDraft(restored, () => assert.fail("Retry must not rebuild"), () => assert.fail("No new ID"), persist, server);
  assert.equal(success.status, "committed"); assert.equal(ids, 1);
  assert.deepEqual(requests[0], requests[1]);
});

test("draft is durable before send, and a storage failure prevents the request", async () => {
  let sent = false;
  await assert.rejects(commitDraft(createDraft("new", "id"), () => party("id"), () => "op", async () => { throw Error("disk full"); }, async () => { sent = true; }));
  assert.equal(sent, false);
});

for (const answer of [null, { committed: true, operationId: "wrong", party: party() }, { committed: true, operationId: "op", party: party() }]) {
  test("incomplete acknowledgement cannot report committed: " + JSON.stringify(answer), async () => {
    let saved;
    const result = await commitDraft(createDraft("new", "legacy-party-7"), party, () => "op", async value => { saved = value; }, async () => answer);
    assert.equal(result.status, "failed"); assert.equal(saved.operationId, "op");
  });
}

test("edits made after an uncertain save preserve both the old operation and newer draft", async () => {
  let saved;
  const first = await commitDraft(createDraft("new", "id"), () => party("id"), () => "op", async value => { saved = value; }, async () => { throw Error("network"); });
  const edited = updateDraftFields(first, { ...first.fields, title: "Newer title" });
  assert.equal(edited.operationId, "op");
  const result = await commitDraft(edited, () => assert.fail("Resolve original operation first"), () => assert.fail("No new op"), async value => { saved = value; }, async (p, op) => receipt(p,op));
  assert.equal(result.status, "local-only"); assert.equal(result.fields.title, "Newer title");
  assert.equal(result.confirmedParty.revision, 1); assert.equal(saved.operationId, undefined);
});

test("local failure after server acknowledgement retains durable operation for replay", async () => {
  let durable; let committed = 0;
  await assert.rejects(commitDraft(createDraft("new", "id"), () => party("id"), () => "op",
    async value => { if (value.status === "committed") throw Error("storage full"); durable = value; },
    async (p,op) => { committed++; return receipt(p,op); }));
  assert.equal(durable.status, "pending");
  await commitDraft(durable, () => assert.fail(), () => assert.fail(), async () => {}, async (p,op) => receipt(p,op));
  assert.equal(committed, 1);
});

test("guest outbox replays explicit claim direction and stable suggestion ID after restart", async () => {
  for (const intent of [{ kind: "claim", itemId: "ice", claim: true }, { kind: "suggest", name: "Ice" }]) {
    const store = createLocalRepository(memoryStorage()); let ids = 0; const requests = [];
    const send = async operation => { requests.push(operation); if (requests.length === 1) throw Error("network"); return { ...party(), revision: 2 }; };
    const create = () => createPartyOutbox(store, () => "id-" + ++ids, async () => "guest", send);
    await assert.rejects(create().run(party().id, intent));
    await create().run(party().id);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(await store.getDraft("outbox:" + party().id), undefined);
  }
});

test("outbox rejects a different action or different signed account while an outcome is uncertain", async () => {
  const store = createLocalRepository(memoryStorage()); let principal = "guest-a";
  const outbox = createPartyOutbox(store, () => "op", async () => principal, async () => { throw Error("network"); });
  await assert.rejects(outbox.run("party", { kind: "claim", itemId: "ice", claim: true }));
  await assert.rejects(outbox.run("party", { kind: "claim", itemId: "ice", claim: false }), { kind: "conflict" });
  principal = "guest-b";
  await assert.rejects(outbox.run("party"), { kind: "authorization" });
});

test("late response from old route cannot replace current route or publish after cancellation", async () => {
  const loader = createLatestPartyLoader(); let finish; const published = [];
  const old = loader.load("old", () => new Promise(resolve => { finish = resolve; }), async () => null, p => published.push(p));
  await loader.load("new", async () => party("new"), async () => null, p => published.push(p));
  finish(party("old")); await old;
  assert.deepEqual(published.map(p => p.id), ["new"]);
  let finishCanceled;
  const canceled = loader.load("gone", () => new Promise(resolve => { finishCanceled = resolve; }), async () => null, p => published.push(p));
  loader.cancel(); finishCanceled(party("gone")); await canceled;
  assert.equal(published.length, 1);
});

test("offline copy is labeled and missing authoritative party never revives a deleted cache", async () => {
  const loader = createLatestPartyLoader(); let result;
  await loader.load("id", async () => { throw Error("network offline"); }, async () => party("id"), (p,error) => { result = { p,error }; });
  assert.match(result.error, /saved copy/); assert.equal(result.p.id, "id");
  await loader.load("id", async () => null, async () => assert.fail("Missing server record must not use cache"), (p,error) => { result = { p,error }; });
  assert.equal(result.p, null); assert.match(result.error, /not found/);
});

test("read normalization preserves claims when RSVP snapshot is absent or partial", () => {
  const original = { ...party(), items: [{ id: "ice", name: "Ice", claimedBy: "Sam", claimedByUserId: "guest" }] };
  assert.deepEqual(reconcilePartyState(original).items, original.items);
});

test("sharing requires authoritative party identity, committed status and positive revision", () => {
  for (const p of [null, party(), { ...party(), cloudStatus: "failed", revision: 1 }, { ...party(), cloudStatus: "committed", revision: 0 }]) {
    assert.throws(() => requireShareableParty(p, party().id));
  }
  assert.equal(requireShareableParty({ ...party(), cloudStatus: "committed", revision: 1 }, party().id).id, party().id);
});

test("nonproduction clients refuse production project regardless of environment label", () => {
  const production = "https://typbofemqhjoiwbkdvuc.supabase.co";
  for (const env of [undefined,"local","staging"]) assert.equal(validateBackendBoundary(env, production, "key", true).configured, false);
  assert.equal(validateBackendBoundary("production", production, "key", true).configured, false);
  assert.equal(validateBackendBoundary("local", "http://127.0.0.1:54321", "key", true).configured, true);
  assert.equal(validateBackendBoundary("staging", "https://separate-project.supabase.co", "key", true).configured, true);
});

test("guest intent is durable even when session creation fails before the first send",async()=>{
  const store=createLocalRepository(memoryStorage());
  const outbox=createPartyOutbox(store,()=>"stable-op",async()=>{throw Error("auth offline");},async()=>assert.fail("No send"));
  await assert.rejects(outbox.run("party",{kind:"rsvp",response:{name:"Sam",status:"yes",attendeeCount:1}}));
  const pending=await store.getDraft("outbox:party");
  assert.equal(pending.operationId,"stable-op");assert.equal(pending.intent.response.name,"Sam");
});

test("an old receipt or unverified payload cannot downgrade a newer cache snapshot",async()=>{
  const store=createLocalRepository(memoryStorage());
  await store.upsertParty({...party(),revision:8,title:"Current"});
  await store.upsertParty({...party(),revision:3,title:"Old receipt"});
  await store.upsertParty({...party(),title:"Unverified payload"});
  assert.equal((await store.getPartyById(party().id)).title,"Current");
});

test("a definite backend rejection is archived and cannot block unrelated future guest actions",async()=>{
  const store=createLocalRepository(memoryStorage());let attempts=0;
  const outbox=createPartyOutbox(store,()=>"op-"+ ++attempts,async()=>"guest",async operation=>{
    if(operation.intent.kind==="claim") throw {code:"P0001",message:"claim_conflict"};
    return {...party("party"),revision:2};
  });
  await assert.rejects(outbox.run("party",{kind:"claim",itemId:"ice",claim:true}),{kind:"conflict",serverRejected:true});
  assert.equal(await store.getDraft("outbox:party"),undefined);
  assert.equal((await store.getDraft("rejected:party:op-1")).intent.itemId,"ice");
  assert.equal((await outbox.run("party",{kind:"rsvp",response:{name:"Sam",status:"no",attendeeCount:1}})).revision,2);
});

test("guest acknowledgement requires matching operation, party and a valid authoritative snapshot",()=>{
  const {requireCommitReceipt}=loadTs("src/lib/partyValidation.ts");
  const p={...party(),revision:1,rsvps:[]};
  for(const value of [p,{committed:true,operationId:"other",party:p},{committed:false,operationId:"op",party:p}]) assert.throws(()=>requireCommitReceipt(value,p.id,"op"));
  assert.equal(requireCommitReceipt({committed:true,operationId:"op",party:p},p.id,"op").party.revision,1);
});

test("a later authorization denial cannot discard an earlier uncertain suggestion",async()=>{
  const store=createLocalRepository(memoryStorage());let calls=0;
  const outbox=createPartyOutbox(store,()=>"id-"+calls,async()=>"guest",async()=>{
    calls++;
    if(calls===1)throw Error("network timeout after commit");
    throw {code:"42501",message:"access revoked"};
  });
  await assert.rejects(outbox.run("party",{kind:"suggest",name:"Ice"}));
  const original=await store.getDraft("outbox:party");
  await assert.rejects(outbox.run("party"),{serverRejected:false});
  assert.equal((await store.getDraft("outbox:party")).operationId,original.operationId);
  assert.equal((await store.getDraft("outbox:party")).intent.itemId,original.intent.itemId);
});
