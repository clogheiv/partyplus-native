-- REVIEW ONLY. Separate Michael production approval is required. No deployment automation.
-- Baseline metadata SHA256 9830e20e7708dcf596d6c4a2f435ae31da2ae42c64f1fe7fa5854d5fc2639d88
-- Before execution, operator must set SESSION partyplus.security_approval='enable-v2'
-- and partyplus.target_project='typbofemqhjoiwbkdvuc' on the confirmed live connection.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if current_setting('partyplus.security_approval',true) is distinct from 'enable-v2'
     or coalesce(current_setting('partyplus.target_project',true),'') not in ('typbofemqhjoiwbkdvuc','qmbwrbxbbshbavfhkujx','synthetic') then
    raise exception 'Separate reviewed security approval and confirmed target required';
  end if;
  if current_setting('partyplus.target_project',true)='typbofemqhjoiwbkdvuc' and current_user <> 'postgres' then
    raise exception 'Reviewed production owner connection required';
  end if;
end $$;
update partyplus_private.release_control set writes_enabled=true,updated_at=now() where singleton;
do $$ begin if not exists(select 1 from partyplus_private.release_control where singleton and writes_enabled=true) then raise exception 'Release control missing'; end if; end $$;
commit;
