import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { backendHarness,users } from './backend-harness.mjs';

test('metadata-matched legacy schema transitions without rewriting identities or losing fields',async t=>{
  const h=await backendHarness({observed:true,contract:false});
  t.after(()=>h.close());
  const id='legacy-observed-party'; const ice=randomUUID(); const cups=randomUUID(); const legacyGuest=randomUUID();
  await h.db.query(`insert into public.parties(id,title,datetime,location_name,address,lat,lng,host_id)
    values($1,'Legacy Synthetic','2026-12-01T18:00:00Z','Synthetic Hall','Synthetic address',40,-90,'old-device-id')`,[id]);
  await h.db.query(`insert into public.party_items(id,party_id,name,claimed_by) values($1,$2,'Ice','Preserved legacy guest'),($3,$2,'Cups',null)`,[ice,id,cups]);
  await h.db.query(`insert into public.party_rsvps(id,party_id,guest_name,status) values($1,$2,'Preserved legacy guest','yes')`,[legacyGuest,id]);

  await t.test('observed permissive anonymous policies reproduce unauthorized editing on synthetic rows only',async()=>{
    await h.transaction(null,'anon',tx=>tx.query(`update public.parties set notes='synthetic unauthorized edit' where id=$1`,[id]));
    assert.equal((await h.db.query('select notes from public.parties where id=$1',[id])).rows[0].notes,'synthetic unauthorized edit');
    const deleted=await h.transaction(null,'anon',tx=>tx.query('delete from public.party_rsvps where party_id=$1 returning id',[id]));
    assert.deepEqual(deleted.rows.map(row=>row.id),[legacyGuest]);
    const parent=await h.transaction(null,'anon',tx=>tx.query('delete from public.parties where id=$1 returning id',[id]));
    assert.equal(parent.rows.length,0); // No parent DELETE policy: legacy aggregate deletion can clear children yet retain the party.
    await h.db.query(`insert into public.party_rsvps(id,party_id,guest_name,status) values($1,$2,'Preserved legacy guest','yes')`,[legacyGuest,id]);
  });

  for(const name of ['05-reconcile-observed-schema.sql','10-v2-contract.sql']) await h.db.exec(
    "select set_config('partyplus.environment','synthetic',false);\n"+await fs.readFile('supabase/nonproduction/'+name,'utf8'));
  const read=()=>h.rpc(null,'partyplus_v2_read_party',[id],'anon');
  const rsvp=(user,name,op=randomUUID())=>h.rpc(user,'partyplus_v2_rsvp',[id,op,{name,status:'yes',attendeeCount:2}]);
  const claim=(user,item,op=randomUUID())=>h.rpc(user,'partyplus_v2_claim_item',[id,item,true,op]);

  await t.test('retirement denies direct writes, removes permissive policies and preserves legacy read payloads',async()=>{
    await assert.rejects(h.transaction(null,'anon',tx=>tx.query('update public.parties set title=title')),{code:'42501'});
    assert.equal((await h.db.query("select policyname from pg_policies where schemaname='public'")).rows.length,0);
    const party=await read();
    assert.equal(party.id,id); assert.equal(party.hostId,'old-device-id');
    assert.equal(party.location,'Synthetic Hall'); assert.ok(party.date.startsWith('2026-12-01'));
    assert.equal(party.items.find(i=>i.id===ice).claimedBy,'Preserved legacy guest');
    assert.equal(party.rsvps[0].id,legacyGuest); assert.equal(party.rsvps[0].name,'Preserved legacy guest');
    assert.equal(party.rsvps[0].attendeeCount,1);
    const raw=(await h.db.query('select address,lat,lng from public.parties where id=$1',[id])).rows[0];
    assert.deepEqual(raw,{address:'Synthetic address',lat:40,lng:-90});
  });

  await t.test('UUID storage accepts individual operations; matching names do not merge guests',async()=>{
    const op=randomUUID(); const [first,retry]=await Promise.all([rsvp(users.guestA,'Same name',op),rsvp(users.guestA,'Same name',op)]);
    assert.deepEqual(first,retry);
    await rsvp(users.guestB,'Same name');
    const suggestions=[randomUUID(),randomUUID()];
    await Promise.all(suggestions.map((item,index)=>h.rpc(index?users.guestB:users.guestA,'partyplus_v2_suggest_item',[id,item,'Synthetic suggestion',randomUUID()])));
    const outcomes=await Promise.allSettled([claim(users.guestA,cups),claim(users.guestB,cups)]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal((await read()).rsvps.length,3);
    assert.equal((await read()).items.length,4);
    await assert.rejects(claim(users.guestA,ice),/claim_conflict/);
    t.diagnostic(h.concurrentSessions?'Real PostgreSQL: UUID schema concurrent sessions exercised':'PGlite: observed UUID schema exercised; independent-session proof requires PostgreSQL');
  });

  await t.test('assisted host bridge preserves UUID items, responses and old reader date/location aliases',async()=>{
    await assert.rejects(h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),(await read()).revision,{id,title:'No grant',items:[]}]),{code:'42501'});
    await h.db.query(`insert into partyplus_private.host_access values($1,$2,'synthetic-reviewed-proof',now())`,[id,users.host]);
    const before=await read();
    await assert.rejects(h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),null,{id,title:'Null bypass',items:before.items}]),/revision_conflict/);
    assert.deepEqual(await read(),before);
    const result=await h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),before.revision,{id,title:'Reconciled',date:'2027-01-01T18:00:00Z',location:'New synthetic hall',items:before.items}]);
    assert.equal(result.party.items.length,4); assert.equal(result.party.rsvps.length,3);
    assert.equal(result.party.hostId,'old-device-id'); assert.equal(result.party.items.find(i=>i.id===ice).claimedBy,'Preserved legacy guest');
    const raw=(await h.db.query('select datetime,location_name,address from public.parties where id=$1',[id])).rows[0];
    assert.ok(String(raw.datetime).includes('2027')); assert.equal(raw.location_name,'New synthetic hall'); assert.equal(raw.address,'Synthetic address');
    const columns=(await h.db.query("select column_name,udt_name from information_schema.columns where table_schema='public' and column_name='id' and table_name in ('party_items','party_rsvps')")).rows;
    assert.ok(columns.every(c=>c.udt_name==='uuid'));
  });
});
