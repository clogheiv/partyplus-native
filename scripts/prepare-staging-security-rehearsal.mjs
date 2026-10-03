// Exact proposal statements executed on transient public clones in ONE transaction,
// followed by ROLLBACK. Existing staging data/functions/ACLs are restored atomically.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=p=>fs.readFile(p,'utf8');
const body=s=>s.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
const phases=[['01-freeze-legacy-writes.sql','freeze-v1'],['02-install-verified-contract.sql','cutover-v2'],['03-enable-verified-writes.sql','enable-v2'],['04-safe-rollback-pause.sql','pause-v2']];
const fixtures=JSON.parse(await read('.test-cache/staging-security-principals.json'));
for(const uid of Object.values(fixtures))if(!/^[0-9a-f-]{36}$/.test(uid))throw Error('Expected synthetic UUID principals');
const {host,guestA,guestB}=fixtures;
let sql=`-- ONLY ISOLATED STAGING qmbwrbxbbshbavfhkujx. Production is NEVER a test target.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select set_config('partyplus.environment','staging',true),set_config('partyplus.target_project','qmbwrbxbbshbavfhkujx',true);
create schema partyplus_rehearsal_saved;
revoke all on schema partyplus_rehearsal_saved from public,anon,authenticated;
alter table public.parties set schema partyplus_rehearsal_saved;
alter table public.party_items set schema partyplus_rehearsal_saved;
alter table public.party_rsvps set schema partyplus_rehearsal_saved;
alter schema partyplus_private rename to partyplus_rehearsal_private;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'partyplus_v2_%' loop
    execute format('alter function %s rename to %I',f.signature,f.proname||'_saved');
  end loop;
end $$;
`;
sql+=await read('supabase/nonproduction/observed-legacy-schema.sql');
sql+=`insert into public.parties(id,title,host_id,datetime,location_name,address) values('synthetic-security-rehearsal','Synthetic legacy','old-device','2027-01-01','Hall','Preserved address');
insert into public.party_items(id,party_id,name,claimed_by) values('40000000-0000-4000-8000-000000000001','synthetic-security-rehearsal','Ice','Old guest');
insert into public.party_rsvps(id,party_id,guest_name,status) values('40000000-0000-4000-8000-000000000002','synthetic-security-rehearsal','Old guest','yes');
`;
for(const [file,phase] of phases){
  sql+=`select set_config('partyplus.security_approval','${phase}',true);\n`+body(await read('supabase/production-proposal/'+file));
  if(phase==='freeze-v1')sql+=`do $$ declare v_role text; q text; begin
    foreach v_role in array array['anon','authenticated'] loop
      execute format('set local role %I',v_role);
      if (select count(*) from public.parties where id='synthetic-security-rehearsal')<>1 then raise exception 'Legacy read lost'; end if;
      foreach q in array array['update public.parties set title=''Attack''','delete from public.party_rsvps','delete from public.party_items','delete from public.parties','truncate public.party_rsvps','insert into public.parties(id) values(''attack'')'] loop
        begin execute q; raise exception 'Unsafe legacy mutation succeeded: %',q; exception when insufficient_privilege then null; end;
      end loop;
      execute 'reset role';
    end loop;
    if (select count(*) from public.party_rsvps)<>1 or (select count(*) from public.party_items)<>1 then raise exception 'Partial deletion'; end if;
  end $$;\n`;
  if(phase==='cutover-v2')sql+=`do $$ begin
    perform set_config('request.jwt.claim.sub','${guestA}',true);
    execute 'set local role authenticated';
    begin perform public.partyplus_v2_rsvp('synthetic-security-rehearsal','50000000-0000-4000-8000-000000000001','{"name":"New guest","status":"yes","attendeeCount":2}'); raise exception 'Pause failed'; exception when object_not_in_prerequisite_state then null; end;
    begin perform 1 from public.parties; raise exception 'Raw read allowed'; exception when insufficient_privilege then null; end;
    execute 'reset role';
  end $$;\n`;
  if(phase==='enable-v2')sql+=`do $$ declare p jsonb; changed jsonb; begin
    perform set_config('request.jwt.claim.sub','${host}',true);
    execute 'set local role authenticated';
    begin perform public.partyplus_v2_commit_party('50000000-0000-4000-8000-000000000004',1,'{"id":"synthetic-security-rehearsal","title":"Steal host","items":[]}'); raise exception 'Unsafe bridge'; exception when insufficient_privilege then null; end;
    execute 'reset role';
    insert into partyplus_private.host_access(party_id,principal_id,evidence_reference) values('synthetic-security-rehearsal','${host}','synthetic-reviewed-evidence');
    perform set_config('request.jwt.claim.sub','${guestA}',true); execute 'set local role authenticated';
    perform public.partyplus_v2_rsvp('synthetic-security-rehearsal','50000000-0000-4000-8000-000000000001','{"name":"New guest","status":"yes","attendeeCount":2}');
    begin perform public.partyplus_v2_delete_party('synthetic-security-rehearsal','50000000-0000-4000-8000-000000000002'); raise exception 'Guest deleted'; exception when insufficient_privilege then null; end;
    begin perform public.partyplus_v2_claim_item('synthetic-security-rehearsal','40000000-0000-4000-8000-000000000001',true,'50000000-0000-4000-8000-000000000003'); raise exception 'Legacy claim stolen'; exception when raise_exception then if sqlerrm<>'claim_conflict' then raise; end if; end;
    perform set_config('request.jwt.claim.sub','${guestB}',true);
    perform public.partyplus_v2_rsvp('synthetic-security-rehearsal','50000000-0000-4000-8000-000000000001','{"name":"New guest","status":"yes","attendeeCount":1}');
    perform set_config('request.jwt.claim.sub','${host}',true);
    p:=public.partyplus_v2_read_party('synthetic-security-rehearsal');
    begin perform public.partyplus_v2_commit_party('50000000-0000-4000-8000-000000000005',null,jsonb_build_object('id',p->>'id','title','Null bypass','items',p->'items')); raise exception 'Null revision accepted'; exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
    changed:=public.partyplus_v2_commit_party('50000000-0000-4000-8000-000000000006',(p->>'revision')::bigint,jsonb_build_object('id',p->>'id','title','Reviewed edit','date',p->>'date','location',p->>'location','items',p->'items'));
    if changed->'party'->'rsvps' is distinct from p->'rsvps' then raise exception 'Host edit lost guests'; end if;
    execute 'reset role';
    if (select address from public.parties where id='synthetic-security-rehearsal')<>'Preserved address' then raise exception 'Legacy address lost'; end if;
  end $$;\n`;
  if(phase==='pause-v2')sql+=`do $$ declare receipt jsonb; replay jsonb; p jsonb; begin
    select o.receipt into receipt from partyplus_private.operations o where principal_id='${guestA}' and operation_id='50000000-0000-4000-8000-000000000001';
    perform set_config('request.jwt.claim.sub','${guestA}',true); execute 'set local role authenticated';
    replay:=public.partyplus_v2_rsvp('synthetic-security-rehearsal','50000000-0000-4000-8000-000000000001','{"name":"New guest","status":"yes","attendeeCount":2}');
    if replay is distinct from receipt then raise exception 'Paused replay lost'; end if;
    begin perform public.partyplus_v2_rsvp('synthetic-security-rehearsal','50000000-0000-4000-8000-000000000008','{"name":"New guest","status":"yes","attendeeCount":2}'); raise exception 'New work allowed'; exception when object_not_in_prerequisite_state then null; end;
    perform set_config('request.jwt.claim.sub','${host}',true);
    if jsonb_array_length(public.partyplus_v2_list_host_parties())<>1 then raise exception 'Host recovery lost'; end if;
    execute 'reset role';
    if (select count(*) from public.party_rsvps)<>3 then raise exception 'Guest rows lost'; end if;
  end $$;\n`;
}
sql+=`select jsonb_build_object('status','passed','projectRef','qmbwrbxbbshbavfhkujx','scope','Exact proposal statements on transient metadata-matched public clone; entire transaction rolled back','checks',jsonb_build_array('Legacy reads retained; unsigned and signed raw insert/update/delete/truncate denied','No partial child deletion','Verified contract initially paused and raw reads denied','Independent-evidence host bridge; guest host-delete denied; legacy claim preserved','Same-name real Auth principals retain distinct RSVPs; host edit preserves guests','Null revision rejected','Safe rollback pauses new writes; exact old receipts replay; host listing works')) as security_rehearsal;
rollback;
`;
await fs.writeFile('.test-cache/staging-security-rehearsal.sql',sql);
const candidate=(await read('supabase/nonproduction/10-v2-contract.sql')).replaceAll('\r\n','\n');
const drain=candidate.match(/create function partyplus_private\.require_writes[\s\S]*?end \$\$;/)?.[0];
if(!drain)throw Error('Release drain function missing');
await fs.writeFile('.test-cache/staging-security-final.sql',sql+`\nbegin;\n${drain.replace('create function','create or replace function')}\nrevoke all on function partyplus_private.require_writes() from public,anon,authenticated;\ncommit;\n`+await read('supabase/nonproduction/verify-staging-release-gate.sql'));
await fs.writeFile('docs/staging-evidence-2026-10-02/security-rehearsal-source.json',JSON.stringify({projectRef:'qmbwrbxbbshbavfhkujx',rehearsalSha256:createHash('sha256').update(sql).digest('hex'),proposalManifest:JSON.parse(await read('supabase/production-proposal/manifest.json')),scope:'Only outer BEGIN/COMMIT removed when composing the rollback-only rehearsal; all proposal SQL statements unchanged.'},null,2)+'\n');
console.log('Prepared rollback-only staging rehearsal; original staging application state will be restored.');
