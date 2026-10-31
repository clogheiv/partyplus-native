// Reproducibly prepares a reviewable single-transaction paused installation.
// This script writes local SQL only. It never connects to a database.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const folder='supabase/web-rebuild/';
const lf=s=>s.replace(/\r\n/g,'\n');
const hash=s=>crypto.createHash('sha256').update(lf(s)).digest('hex');
const base=lf(await fs.readFile('supabase/production-proposal/02-install-verified-contract.sql','utf8'));
assert.equal(hash(base),'43d36d9a8c4524c15c7258836eeb62777fc2f420e97455e71e1d78d1d46476bb');
const browser=lf(await fs.readFile(folder+'01-browser-contract.sql','utf8'));
const address=lf(await fs.readFile(folder+'02-invitation-address.sql','utf8'));
const strip=s=>s.replace(/^begin;\n/m,'').replace(/^commit;\s*$/m,'');
const parts=[['parties',['revision','deleted_at','date','location','theme']],['party_items',['claimed_by_user_id','created_by']],['party_rsvps',[]]];
const snapshot=after=>'jsonb_build_object('+parts.map(([table,added])=>{
  const value='to_jsonb(t)'+(after&&added.length?' - array['+added.map(x=>"'"+x+"'").join(',')+']':'');
  return `'${table}',(select jsonb_build_object('count',count(*),'fingerprint',md5(coalesce(string_agg(value,E'\\n' order by value),''))) from (select (${value})::text value from public.${table} t) s)`;
}).join(',')+')';
let core=strip(base);
const aliasBackfill='update public.parties set date=datetime,location=location_name;';
assert.ok(core.includes(aliasBackfill));
core=core.replace(aliasBackfill,
  '-- Preserve historical customer updated_at while adding read aliases.\n'+
  'alter table public.parties disable trigger trg_parties_updated_at;\n'+
  'update public.parties set date=datetime,location=location_name\n'+
  '  where date is distinct from datetime or location is distinct from location_name;\n'+
  'alter table public.parties enable trigger trg_parties_updated_at;');
const sql=`-- Prepared PartyPlus website installation. Execute only after exact production approval.\n-- Source v2, browser, and address inputs recorded in production-manifest.json.\n-- Existing legacy writes stay denied; this transaction ends with v2 writes PAUSED.\n-- Caller confirms the target and sets partyplus.security_approval=cutover-v2.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nlock table public.parties,public.party_items,public.party_rsvps in access exclusive mode;\ncreate temporary table partyplus_web_preservation on commit drop as select ${snapshot(false)} as snapshot;\nalter table partyplus_web_preservation enable row level security;\nrevoke all on table partyplus_web_preservation from public,anon,authenticated;\n${core}\n${strip(browser)}\n${strip(address)}\ndo $$ begin\n  if (select snapshot from pg_temp.partyplus_web_preservation) is distinct from ${snapshot(true)} then\n    raise exception 'Customer original-column preservation check failed';\n  end if;\n  if not (select relrowsecurity from pg_class where oid='pg_temp.partyplus_web_preservation'::regclass)\n    or has_table_privilege('anon','pg_temp.partyplus_web_preservation','SELECT,INSERT,UPDATE,DELETE')\n    or has_table_privilege('authenticated','pg_temp.partyplus_web_preservation','SELECT,INSERT,UPDATE,DELETE') then\n    raise exception 'Preservation temporary table must remain client-inaccessible with RLS';\n  end if;\n  if (select writes_enabled from partyplus_private.release_control where singleton) is distinct from false then\n    raise exception 'Installation must keep verified writes paused';\n  end if;\n  if exists(select 1 from (values('anon'),('authenticated')) roles(r)\n    cross join (values('public.parties'),('public.party_items'),('public.party_rsvps')) tables(t)\n    where has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) then\n    raise exception 'Unexpected raw client grants';\n  end if;\n  if not exists(select 1 from pg_trigger where tgrelid='public.parties'::regclass\n    and tgname='trg_parties_updated_at' and tgenabled='O') then\n    raise exception 'Original updated_at trigger must remain enabled';\n  end if;\nend $$;\nnotify pgrst,'reload schema';\ncommit;\n`;
await fs.writeFile(folder+'03-production-install-paused.sql',sql);
const manifest={preparedAt:new Date().toISOString(),status:'prepared-not-executed-production',
  inputs:{'production-proposal/02-install-verified-contract.sql':hash(base),'web-rebuild/01-browser-contract.sql':hash(browser),'web-rebuild/02-invitation-address.sql':hash(address)},
  output:{'03-production-install-paused.sql':hash(sql)},
  verifiedWritesInitiallyEnabled:false,customerRowsDeleted:false,legacyWritesReopened:false,
  timestampPreservation:'Disable and re-enable only original updated_at trigger around alias backfill; assert original-column full-table fingerprints before commit.'};
await fs.writeFile(folder+'production-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
