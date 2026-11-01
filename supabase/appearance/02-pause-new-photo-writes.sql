-- Safe feature rollback: stop new upload reservations and Storage mutations.
-- Keep appearance data, object bytes, public reads, existing receipts and the
-- compatible frontend. Ordinary party/guest workflows remain enabled.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
revoke all on function public.partyplus_web_prepare_image(text,uuid,integer,text),
  public.partyplus_web_begin_image_removal(uuid),public.partyplus_web_release_image(uuid),
  public.partyplus_web_can_upload_image(text),public.partyplus_web_can_delete_image(text)
  from public,anon,authenticated;
drop policy if exists partyplus_image_insert on storage.objects;
drop policy if exists partyplus_image_delete_lookup on storage.objects;
drop policy if exists partyplus_image_delete on storage.objects;
do $$ begin
  if has_function_privilege('authenticated','public.partyplus_web_prepare_image(text,uuid,integer,text)','EXECUTE')
    or has_function_privilege('authenticated','public.partyplus_web_begin_image_removal(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.partyplus_web_release_image(uuid)','EXECUTE')
    or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname in ('partyplus_image_insert','partyplus_image_delete_lookup','partyplus_image_delete')) then
    raise exception 'Photo write pause was not established';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
