import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {backendHarness,users} from './backend-harness.mjs';

test('exact security proposal freezes legacy writes, cuts over, and safely pauses without data loss',async t=>{
  const h=await backendHarness({observed:true,contract:false});t.after(()=>h.close());
  const partyId='legacy-security-synthetic',ice=randomUUID(),rsvp=randomUUID();
  await h.db.query(`insert into public.parties(id,title,host_id,datetime,location_name,address) values($1,'Legacy','old-device','2027-01-01','Hall','Preserve address')`,[partyId]);
  await h.db.query(`insert into public.party_items(id,party_id,name,claimed_by) values($1,$2,'Ice','Old guest')`,[ice,partyId]);
  await h.db.query(`insert into public.party_rsvps(id,party_id,guest_name,status) values($1,$2,'Old guest','yes')`,[rsvp,partyId]);
  const apply=async(name,approval)=>h.db.exec(`select set_config('partyplus.security_approval','${approval}',false),set_config('partyplus.target_project','synthetic',false);\n`+await fs.readFile('supabase/production-proposal/'+name,'utf8'));
  await t.test('unapproved execution fails before changing any policies',async()=>{
    await assert.rejects(apply('01-freeze-legacy-writes.sql','not-approved'),/Separate reviewed security approval/);
    await h.db.exec('rollback');
    assert.equal((await h.db.query("select count(*)::int n from pg_policies where schemaname='public'")).rows[0].n,11);
  });
  await apply('01-freeze-legacy-writes.sql','freeze-v1');
  await t.test('unchanged legacy reads work; host, guest and stranger direct mutations all fail',async()=>{
    for(const [uid,role] of [[null,'anon'],[users.host,'authenticated'],[users.guestA,'authenticated'],[users.otherHost,'authenticated']]) {
      const row=await h.transaction(uid,role,tx=>tx.query('select * from public.parties where id=$1',[partyId]));assert.equal(row.rows[0].host_id,'old-device');
      for(const sql of ["update public.parties set title='Attack'","delete from public.party_rsvps","delete from public.party_items","delete from public.parties","truncate public.party_rsvps","insert into public.parties(id) values('attack')"]) {
        await assert.rejects(h.transaction(uid,role,tx=>tx.query(sql)),{code:'42501'});
      }
    }
    assert.equal((await h.db.query('select * from public.party_rsvps')).rows.length,1);
    await h.db.exec('grant update on public.parties to anon');
    assert.equal((await h.transaction(null,'anon',tx=>tx.query("update public.parties set title='Accidental regrant' returning id"))).rows.length,0);
    await h.db.exec('revoke update on public.parties from anon');
  });
  await apply('02-install-verified-contract.sql','cutover-v2');
  const read=()=>h.rpc(null,'partyplus_v2_read_party',[partyId],'anon');
  const response={name:'New guest',status:'yes',attendeeCount:2},op=randomUUID();
  await t.test('installed contract starts paused, preserves IDs and aliases; party/device IDs cannot recover ownership',async()=>{
    const p=await read();assert.equal(p.hostId,'old-device');assert.equal(p.items[0].id,ice);assert.equal(p.rsvps[0].id,rsvp);assert.equal(p.location,'Hall');
    assert.equal((await h.db.query('select address from public.parties')).rows[0].address,'Preserve address');
    await assert.rejects(h.rpc(users.guestA,'partyplus_v2_rsvp',[partyId,op,response]),/writes_paused/);
    await assert.rejects(h.transaction(users.host,'authenticated',tx=>tx.query('select * from public.parties')),{code:'42501'});
    assert.equal((await h.db.query('select count(*)::int n from partyplus_private.operations')).rows[0].n,0);
  });
  await apply('03-enable-verified-writes.sql','enable-v2');
  let receipt;
  await t.test('only reviewed host evidence grants edits; guest cannot steal a legacy claim or another host party',async()=>{
    await assert.rejects(h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),1,{id:partyId,title:'Claim ownership',hostId:'old-device',items:[]}]),/host_access_required/);
    await h.db.query("insert into partyplus_private.host_access(party_id,principal_id,evidence_reference) values($1,$2,'synthetic-independent-proof')",[partyId,users.host]);
    receipt=await h.rpc(users.guestA,'partyplus_v2_rsvp',[partyId,op,response]);
    await assert.rejects(h.rpc(users.guestB,'partyplus_v2_claim_item',[partyId,ice,true,randomUUID()]),/yes_rsvp_required/);
    await assert.rejects(h.rpc(users.guestA,'partyplus_v2_claim_item',[partyId,ice,true,randomUUID()]),/claim_conflict/);
    const p=await read();
    await assert.rejects(h.rpc(users.otherHost,'partyplus_v2_commit_party',[randomUUID(),p.revision,{id:partyId,title:'Stranger',items:p.items}]),/host_access_required/);
    const edit=await h.rpc(users.host,'partyplus_v2_commit_party',[randomUUID(),p.revision,{id:partyId,title:'Reviewed host edit',date:p.date,location:p.location,items:p.items}]);
    assert.deepEqual(edit.party.rsvps,p.rsvps);assert.equal(edit.party.items[0].claimedBy,'Old guest');
    await assert.rejects(h.rpc(users.otherHost,'partyplus_v2_delete_party',[partyId,randomUUID()]),/host_access_required/);
    await assert.rejects(h.rpc(users.guestA,'partyplus_v2_delete_party',[partyId,randomUUID()]),/verified_host_required/);
    assert.deepEqual(await h.rpc(users.otherHost,'partyplus_v2_list_host_parties',[]),[]);
  });
  await t.test('PostgreSQL pause waits for an in-flight mutation transaction to finish',{skip:!h.concurrentSessions},async()=>{
    let release,entered;
    const hold=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
    const active=h.transaction(users.guestA,'authenticated',async tx=>{
      await tx.query('select public.partyplus_v2_rsvp($1,$2,$3)',[partyId,randomUUID(),response]);
      entered();await hold;
    });
    await started;
    let paused=false;
    const pause=h.db.query('update partyplus_private.release_control set writes_enabled=false where singleton').then(()=>{paused=true;});
    try {
      let locked=false;
      for(let attempt=0;attempt<40&&!locked;attempt++) {
        const r=await h.db.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like 'update partyplus_private.release_control%' and pid<>pg_backend_pid()");
        locked=r.rows[0].n>0;
        if(!locked)await new Promise(resolve=>setTimeout(resolve,25));
      }
      assert.equal(locked,true,'Gate pause must wait on the active transaction');assert.equal(paused,false);
    } finally {release();await active;await pause;}
    await assert.rejects(h.rpc(users.guestB,'partyplus_v2_rsvp',[partyId,randomUUID(),response]),/writes_paused/);
    await h.db.exec('update partyplus_private.release_control set writes_enabled=true where singleton');
  });
  await apply('04-safe-rollback-pause.sql','pause-v2');
  await t.test('rollback pauses new work; old receipts replay, guests remain intact, reads and host recovery work',async()=>{
    const before=await read();
    assert.deepEqual(await h.rpc(users.guestA,'partyplus_v2_rsvp',[partyId,op,response]),receipt);
    await assert.rejects(h.rpc(users.guestA,'partyplus_v2_rsvp',[partyId,randomUUID(),response]),/writes_paused/);
    await assert.rejects(h.rpc(users.host,'partyplus_v2_delete_party',[partyId,randomUUID()]),/writes_paused/);
    assert.deepEqual(await read(),before);
    assert.ok((await h.rpc(users.host,'partyplus_v2_list_host_parties',[])).some(p=>p.id===partyId));
    assert.equal((await h.db.query("select count(*)::int n from pg_policies where schemaname='public'")).rows[0].n,0);
    await assert.rejects(h.transaction(null,'anon',tx=>tx.query('delete from public.party_rsvps')),{code:'42501'});
    await assert.rejects(h.transaction(users.host,'authenticated',tx=>tx.query('update partyplus_private.release_control set writes_enabled=true')),{code:'42501'});
  });
});
