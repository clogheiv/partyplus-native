-- Catalog/aggregate verification only on isolated staging. No production execution.
begin transaction read only;
select jsonb_build_object(
  'projectRef','qmbwrbxbbshbavfhkujx','writesEnabled',(select writes_enabled from partyplus_private.release_control where singleton),
  'gateRls',(select relrowsecurity from pg_class where oid='partyplus_private.release_control'::regclass),
  'anonGateSelect',has_table_privilege('anon','partyplus_private.release_control','SELECT'),
  'authenticatedGateUpdate',has_table_privilege('authenticated','partyplus_private.release_control','UPDATE'),
  'drainsInFlight',(select pg_get_functiondef(p.oid) like '%for share%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='partyplus_private' and p.proname='require_writes'),
  'gatedMutations',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('partyplus_v2_commit_party','partyplus_v2_rsvp','partyplus_v2_claim_item','partyplus_v2_suggest_item','partyplus_v2_delete_party')
    and pg_get_functiondef(p.oid) like '%perform partyplus_private.require_writes();%' and p.prosecdef and p.proconfig=array['search_path=pg_catalog']),
  'legacyPolicies',(select count(*) from pg_policies where schemaname='public' and tablename in ('parties','party_items','party_rsvps')),
  'rehearsalSchemasAbsent',to_regnamespace('partyplus_rehearsal_saved') is null and to_regnamespace('partyplus_rehearsal_private') is null,
  'retainedSyntheticParties',(select count(*) from public.parties),
  'retainedSyntheticReceipts',(select count(*) from partyplus_private.operations)
) as release_gate;
commit;
