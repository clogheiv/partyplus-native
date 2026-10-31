import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
const {PGlite}=createRequire(path.resolve(process.env.PARTYPLUS_BACKEND_DEPENDENCIES ?? '.', 'package.json'))('@electric-sql/pglite');
const host='10000000-0000-4000-8000-000000000001';
const guest='20000000-0000-4000-8000-000000000001';
const stranger='20000000-0000-4000-8000-000000000002';

for(const observed of [false,true])test('browser contract '+(observed?'observed UUID schema':'synthetic schema'),async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("select set_config('partyplus.environment','synthetic',false)");
  for(const filename of [...(observed?['00-synthetic-auth.sql','observed-legacy-schema.sql','05-reconcile-observed-schema.sql']:['00-synthetic-baseline.sql']),'10-v2-contract.sql'])
    await db.exec(await readFile('supabase/nonproduction/'+filename,'utf8'));
  for(const id of [host,guest,stranger])await db.query('insert into auth.users(id,is_anonymous,email_confirmed_at) values($1,$2,$3)',[id,id!==host,id===host?'2026-01-01':null]);
  const rpc=(uid,name,args=[],role=uid?'authenticated':'anon')=>db.transaction(async tx=>{
    assert.match(name,/^partyplus_(v2|web)_[a-z_]+$/);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);
    await tx.query('set local role '+role);
    return(await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as value',args)).rows[0].value;
  });
  const items={existing:randomUUID(),new:randomUUID()};
  const commit=(id,title='Dinner')=>rpc(host,'partyplus_v2_commit_party',[randomUUID(),0,{id,title,items:[{id:items[id],name:'Ice'}]}]);
  await commit('existing');
  const historicOp=randomUUID();
  const historic=await rpc(guest,'partyplus_v2_rsvp',['existing',historicOp,{name:'Guest One',status:'yes',attendeeCount:2}]);
  assert.equal(historic.party.hostId,host);
  await db.exec(await readFile('supabase/web-rebuild/01-browser-contract.sql','utf8'));
  await db.exec(await readFile('supabase/web-rebuild/02-invitation-address.sql','utf8'));
  await t.test('legacy street address is readable and preserved on host edits',async()=>{
    if(observed){
      await db.query("update public.parties set address='123 Synthetic Lane' where id='existing'");
      assert.equal((await rpc(null,'partyplus_web_read_party',['existing'])).address,'123 Synthetic Lane');
      const current=await rpc(host,'partyplus_web_read_party',['existing']);
      await rpc(host,'partyplus_v2_commit_party',[randomUUID(),current.revision,{id:'existing',title:'Dinner',items:[]}]);
      assert.equal((await rpc(null,'partyplus_web_read_party',['existing'])).address,'123 Synthetic Lane');
    }else assert.equal((await rpc(null,'partyplus_web_read_party',['existing'])).address,null);
  });
  await t.test('migration backfills only existing signed response identities',async()=>{
    const mine=await rpc(guest,'partyplus_web_list_my_parties');
    assert.deepEqual(mine.joined.map(p=>p.id),['existing']);assert.deepEqual(mine.hosting,[]);
    const owner=await rpc(host,'partyplus_web_list_my_parties');
    assert.deepEqual(owner.hosting.map(p=>p.id),['existing']);assert.deepEqual(owner.joined,[]);
    assert.deepEqual((await rpc(stranger,'partyplus_web_list_my_parties')).joined,[]);
  });
  await t.test('all public reads redact principals and private response names',async()=>{
    for(const name of ['partyplus_v2_read_party','partyplus_web_read_party']){
      const pub=await rpc(null,name,['existing']);
      assert.deepEqual(pub.rsvps,[]);assert.equal(pub.ownRsvp,null);assert.equal(pub.totals.attending,2);
      assert.equal(pub.hostId,undefined);assert.equal(pub.items[0].claimedByUserId,undefined);
      assert.ok(!JSON.stringify(pub).includes(host));assert.ok(!JSON.stringify(pub).includes(guest));
      assert.ok(!JSON.stringify(pub).includes('Guest One'));
      const mine=await rpc(guest,name,['existing']);assert.equal(mine.ownRsvp.id,guest);assert.equal(mine.rsvps.length,1);
      const owner=await rpc(host,name,['existing']);assert.equal(owner.rsvps[0].name,'Guest One');
      assert.notEqual(owner.rsvps[0].id,guest);assert.equal(owner.canEdit,true);
    }
  });
  await t.test('historical receipt replay cannot expose old raw identity snapshots',async()=>{
    const replay=await rpc(guest,'partyplus_v2_rsvp',['existing',historicOp,{name:'Guest One',status:'yes',attendeeCount:2}]);
    assert.equal(replay.party.hostId,undefined);assert.equal(replay.party.ownRsvp.id,guest);
    assert.deepEqual(await rpc(guest,'partyplus_v2_rsvp',['existing',historicOp,{name:'Guest One',status:'yes',attendeeCount:2}]),replay);
  });
  await t.test('host create appears automatically and joins are durable and idempotent',async()=>{
    await commit('new');
    assert.equal((await rpc(host,'partyplus_web_list_my_parties')).hosting.length,2);
    const op=randomUUID();const joined=await rpc(stranger,'partyplus_web_join_party',['new',op]);
    assert.equal(joined.party.isJoined,true);assert.equal(joined.party.canEdit,false);
    assert.deepEqual(await rpc(stranger,'partyplus_web_join_party',['new',op]),joined);
    assert.deepEqual((await rpc(stranger,'partyplus_web_list_my_parties')).joined.map(p=>p.id),['new']);
    await assert.rejects(rpc(stranger,'partyplus_web_join_party',['missing',randomUUID()]),/party_missing/);
    await assert.rejects(rpc(null,'partyplus_web_list_my_parties'),{code:'42501'});
  });
  await t.test('RSVP joins without extra client step and mutation receipts stay private',async()=>{
    const receipt=await rpc(guest,'partyplus_v2_rsvp',['new',randomUUID(),{name:'Guest One',status:'yes',attendeeCount:1}]);
    assert.equal(receipt.party.isJoined,true);assert.equal(receipt.party.hostId,undefined);
    const claimed=await rpc(guest,'partyplus_v2_claim_item',['new',items.new,true,randomUUID()]);
    assert.equal(claimed.party.items[0].isMine,true);assert.equal(claimed.party.items[0].claimedByUserId,undefined);
    assert.equal((await rpc(stranger,'partyplus_web_read_party',['new'])).items[0].isMine,false);
    const owner=await rpc(host,'partyplus_web_read_party',['new']);
    await rpc(host,'partyplus_v2_commit_party',[randomUUID(),owner.revision,{id:'new',title:'Updated',items:[]}]);
    assert.equal((await rpc(guest,'partyplus_web_read_party',['new'])).ownRsvp.name,'Guest One');
  });
  await t.test('telemetry accepts only enum with durable deduplication and no content',async()=>{
    const id=randomUUID();assert.equal(await rpc(guest,'partyplus_web_record_event',[id,'invitation_link_copied']),true);
    assert.equal(await rpc(guest,'partyplus_web_record_event',[id,'invitation_link_copied']),true);
    await assert.rejects(rpc(guest,'partyplus_web_record_event',[id,'party_created']),/event_conflict/);
    await assert.rejects(rpc(guest,'partyplus_web_record_event',[randomUUID(),'private party text']),{code:'23514'});
    assert.equal((await db.query('select count(*)::int as count from partyplus_private.web_events')).rows[0].count,1);
    const open=randomUUID();assert.equal(await rpc(null,'partyplus_web_record_event',[open,'invitation_opened']),true);
    assert.equal(await rpc(null,'partyplus_web_record_event',[open,'invitation_opened']),true);
    await assert.rejects(rpc(null,'partyplus_web_record_event',[randomUUID(),'party_created']),{code:'42501'});
    assert.equal((await db.query('select count(*)::int as count from partyplus_private.web_events')).rows[0].count,2);
    await assert.rejects(db.transaction(async tx=>{await tx.query('set local role authenticated');await tx.query('select * from partyplus_private.web_events')}),{code:'42501'});
  });
  await t.test('suggesting without RSVP also preserves joined return access',async()=>{
    await rpc(host,'partyplus_v2_commit_party',[randomUUID(),0,{id:'suggestion-only',title:'Suggestion party',items:[]}]);
    const suggestion=await rpc(stranger,'partyplus_v2_suggest_item',['suggestion-only',randomUUID(),'Napkins',randomUUID()]);
    assert.equal(suggestion.party.isJoined,true);assert.equal(suggestion.party.ownRsvp,null);
    assert.ok((await rpc(stranger,'partyplus_web_list_my_parties')).joined.some(p=>p.id==='suggestion-only'));
    assert.ok(!(await rpc(host,'partyplus_web_list_my_parties')).joined.some(p=>p.id==='suggestion-only'));
  });
  await t.test('release pause blocks new memberships/events, preserves reads and receipt replay',async()=>{
    const op=randomUUID();const first=await rpc(guest,'partyplus_web_join_party',['new',op]);
    await db.exec('update partyplus_private.release_control set writes_enabled=false');
    assert.deepEqual(await rpc(guest,'partyplus_web_join_party',['new',op]),first);
    await assert.rejects(rpc(guest,'partyplus_web_join_party',['existing',randomUUID()]),{code:'55000'});
    await assert.rejects(rpc(guest,'partyplus_web_record_event',[randomUUID(),'returning_use']),{code:'55000'});
    assert.equal((await rpc(guest,'partyplus_web_read_party',['new'])).id,'new');
  });
});
