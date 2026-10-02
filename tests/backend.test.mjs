import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { backendHarness, users } from "./backend-harness.mjs";

test("isolated PostgreSQL contract", async t => {
  const h = await backendHarness();
  t.after(() => h.close());
  const rpc = (user,name,args,role) => h.rpc(user,name,args,role);
  const read = id => rpc(null,"partyplus_v2_read_party",[id],"anon");
  const commit = (user,p,revision=0,op=randomUUID()) => rpc(user,"partyplus_v2_commit_party",[op,revision,p]);
  const rsvp = (user,id,name,status="yes",op=randomUUID()) => rpc(user,"partyplus_v2_rsvp",[id,op,{name,status,attendeeCount:1}]);
  const claim = (user,id,item,want=true,op=randomUUID()) => rpc(user,"partyplus_v2_claim_item",[id,item,want,op]);
  const fixture = id => ({ id,title:"Synthetic",items:[{id:"legacy-item-A",name:"Ice"},{id:"legacy-item-B",name:"Cups"}],rsvps:[] });
  const id = "legacy-party-human-readable";

  await t.test("signed guests and unconfirmed accounts cannot create hosts; anonymous roles cannot mutate", async () => {
    for (const uid of [users.guestA,users.unverified,null]) await assert.rejects(commit(uid,fixture("bad")), {code:"42501"});
    await assert.rejects(rpc(null,"partyplus_v2_commit_party",[randomUUID(),0,fixture("bad")],"anon"),{code:"42501"});
    assert.equal(await read("bad"),null);
  });
  await t.test("create/retry returns one explicit commit receipt with stable legacy IDs", async () => {
    const op = randomUUID();
    const [first,retry] = await Promise.all([commit(users.host,fixture(id),0,op),commit(users.host,fixture(id),0,op)]);
    assert.deepEqual(retry,first); assert.equal(first.committed,true); assert.equal(first.party.revision,1);
    assert.equal(first.party.id,id); assert.equal(first.party.items[0].id,"legacy-item-A");
    await assert.rejects(commit(users.host,{...fixture(id),title:"different payload"},0,op),/operation_conflict/);
    assert.equal((await read(id)).revision,1);
  });
  await t.test("RLS, direct grants and private helpers deny legacy destructive writes and enumeration", async () => {
    for (const role of ["anon","authenticated"]) {
      for (const sql of ["select * from public.parties","delete from public.party_items","delete from public.party_rsvps",
        "update public.parties set title='oops'","select * from partyplus_private.host_access",
        "select partyplus_private.require_principal(false)"]) {
        await assert.rejects(h.transaction(users.guestA,role,tx => tx.query(sql)),{code:"42501"});
      }
    }
    const flags = await h.db.query("select relrowsecurity from pg_class where oid in ('public.parties'::regclass,'public.party_items'::regclass,'public.party_rsvps'::regclass)");
    assert.equal(flags.rows.length,3); assert.ok(flags.rows.every(row => row.relrowsecurity));
    assert.equal((await read(id)).title,"Synthetic");
  });
  await t.test("two independent guests retain their RSVPs and suggestions", async () => {
    await Promise.all([rsvp(users.guestA,id,"Sam"),rsvp(users.guestB,id,"Taylor")]);
    await Promise.all([
      rpc(users.guestA,"partyplus_v2_suggest_item",[id,"suggestion-A","Pizza",randomUUID()]),
      rpc(users.guestB,"partyplus_v2_suggest_item",[id,"suggestion-B","Juice",randomUUID()]),
    ]);
    const current = await read(id);
    assert.equal(current.rsvps.length,2); assert.equal(current.items.length,4);
    assert.deepEqual(current.rsvps.map(r => r.name).sort(),["Sam","Taylor"]);
  });
  await t.test("host title edit cannot replace guest RSVP snapshots or new suggestions", async () => {
    const current = await read(id);
    const edited = await commit(users.host,{...fixture(id),title:"Renamed",rsvps:[]},current.revision);
    assert.equal(edited.party.rsvps.length,2); assert.equal(edited.party.items.length,4);
    assert.equal(edited.party.title,"Renamed");
  });
  await t.test("competing clients leave exactly one claim winner", async () => {
    const outcomes = await Promise.allSettled([claim(users.guestA,id,"legacy-item-A"),claim(users.guestB,id,"legacy-item-A")]);
    assert.equal(outcomes.filter(r => r.status === "fulfilled").length,1);
    assert.match(outcomes.find(r => r.status === "rejected").reason.message,/claim_conflict/);
    const owner = (await read(id)).items.find(i => i.id === "legacy-item-A").claimedByUserId;
    assert.ok([users.guestA,users.guestB].includes(owner));
    t.diagnostic(h.concurrentSessions ? "Real PostgreSQL: independent concurrent sessions exercised" : "PGlite serializes connections; competing operations exercised, parallel-session proof deferred to CI/PostgreSQL");
  });
  await t.test("a stale host edit conflicts and never overwrites a guest claim", async () => {
    const current = await read(id);
    await assert.rejects(commit(users.host,{...fixture(id),title:"stale"},1),/revision_conflict/);
    const edited = await commit(users.host,{...fixture(id),title:"Fresh",items:current.items.map(i => ({...i,claimedByUserId:users.host,claimedBy:"forged"}))},current.revision);
    const before = current.items.find(i => i.id === "legacy-item-A");
    const after = edited.party.items.find(i => i.id === "legacy-item-A");
    assert.equal(after.claimedByUserId,before.claimedByUserId); assert.equal(after.claimedBy,before.claimedBy);
  });
  await t.test("claim retry cannot toggle ownership, and another guest cannot unclaim it", async () => {
    const op = randomUUID(); const first = await claim(users.guestA,id,"legacy-item-B",true,op);
    assert.deepEqual(await claim(users.guestA,id,"legacy-item-B",true,op),first);
    await assert.rejects(claim(users.guestB,id,"legacy-item-B",false),{code:"42501"});
    await rsvp(users.guestA,id,"Renamed guest");
    assert.equal((await read(id)).items.find(i => i.id === "legacy-item-B").claimedBy,"Renamed guest");
    await rsvp(users.guestA,id,"Renamed guest","no");
    assert.equal((await read(id)).items.find(i => i.id === "legacy-item-B").claimedByUserId,null);
  });
  await t.test("transaction failure rolls back metadata, revision, items and operation receipt", async () => {
    const before = await read(id);
    const op = randomUUID();
    await assert.rejects(commit(users.host,{...fixture(id),title:"Should rollback",items:[{id:"bad",name:""}]},before.revision,op),/invalid_item/);
    assert.deepEqual(await read(id),before);
    assert.equal((await h.db.query("select operation_id from partyplus_private.operations where operation_id=$1",[op])).rows.length,0);
  });
  await t.test("knowing party ID or legacy host UUID never grants host access; explicit bridge fixture does", async () => {
    await h.db.query("insert into public.parties(id,title,host_id) values('legacy-bridge','Preserved','legacy-device-uuid')");
    await assert.rejects(commit(users.otherHost,{id:"legacy-bridge",title:"takeover",hostId:"legacy-device-uuid",items:[]},1),{code:"42501"});
    await h.db.query("insert into partyplus_private.host_access(party_id,principal_id,evidence_reference) values('legacy-bridge',$1,'synthetic-assisted-proof-001')",[users.host]);
    const bridged = await commit(users.host,{id:"legacy-bridge",title:"Recovered",items:[]},1);
    assert.equal(bridged.party.hostId,"legacy-device-uuid"); assert.equal(bridged.party.canEdit,true);
    assert.equal((await read("legacy-bridge")).canEdit,false);
  });
  await t.test("only an authorized verified host can tombstone; retry is idempotent and data remains recoverable", async () => {
    await assert.rejects(rpc(users.guestB,"partyplus_v2_delete_party",[id,randomUUID()]),{code:"42501"});
    const op = randomUUID(); const first = await rpc(users.host,"partyplus_v2_delete_party",[id,op]);
    assert.deepEqual(await rpc(users.host,"partyplus_v2_delete_party",[id,op]),first);
    assert.equal(await read(id),null);
    assert.equal(Number((await h.db.query("select count(*) as n from public.party_rsvps where party_id=$1",[id])).rows[0].n),2);
  });
  await t.test("host recovery lists only verified account grants and excludes tombstones",async()=>{
    await assert.rejects(rpc(users.guestA,"partyplus_v2_list_host_parties",[]),{code:"42501"});
    assert.deepEqual(await rpc(users.otherHost,"partyplus_v2_list_host_parties",[]),[]);
    const parties=await rpc(users.host,"partyplus_v2_list_host_parties",[]);
    assert.deepEqual(parties.map(p=>p.id),["legacy-bridge"]);
  });
  await t.test("synthetic backup restores schema, grants, legacy IDs, bridge and operation receipts", {skip:h.concurrentSessions}, async () => {
    const dump = await h.db.dumpDataDir("none");
    const restored = new PGlite({ loadDataDir: dump });
    try {
      assert.equal((await restored.query("select title from public.parties where id='legacy-bridge'")).rows[0].title,"Recovered");
      const count = await restored.query("select count(*) as n from partyplus_private.operations");
      assert.ok(Number(count.rows[0].n)>5);
      const bridge = await restored.query("select principal_id,evidence_reference from partyplus_private.host_access where party_id='legacy-bridge'");
      assert.deepEqual(bridge.rows,[{principal_id:users.host,evidence_reference:"synthetic-assisted-proof-001"}]);
      const hosted = await restored.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.host]);
        await tx.query("set local role authenticated");
        return (await tx.query("select public.partyplus_v2_list_host_parties() as result")).rows[0].result;
      });
      assert.deepEqual(hosted.map(p => p.id),["legacy-bridge"]);
      assert.equal(hosted[0].hostId,"legacy-device-uuid");
      const deletion = (await restored.query("select principal_id,operation_id,request,receipt from partyplus_private.operations where request->>'kind'='delete' limit 1")).rows[0];
      const replayed = await restored.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[deletion.principal_id]);
        await tx.query("set local role authenticated");
        return (await tx.query("select public.partyplus_v2_delete_party($1,$2) as result",[deletion.request.party,deletion.operation_id])).rows[0].result;
      });
      assert.deepEqual(replayed,deletion.receipt);
      const retained = await restored.query("select id from public.party_rsvps where party_id=$1",[id]);
      assert.deepEqual(retained.rows.map(r => r.id).sort(),[users.guestA,users.guestB]);
      await assert.rejects(restored.transaction(async tx => { await tx.query("set local role anon"); await tx.query("delete from public.parties"); }),{code:"42501"});
    } finally { await restored.close(); }
  });
});
