-- Preserve the separately stored street address on legacy invitation reads.
-- No data/grant/auth changes; new browser parties use the single location field.
begin;
create or replace function public.partyplus_v2_read_party(p_party_id text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select partyplus_private.web_projection(jsonb_build_object(
    'id',p.id,'title',p.title,'date',p.date,'location',p.location,
    'address',to_jsonb(p)->>'address','notes',p.notes,
    'theme',p.theme,'createdAt',p.created_at,'updatedAt',p.updated_at,'revision',p.revision,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'qty',i.qty,
      'claimedBy',i.claimed_by,'claimedByUserId',i.claimed_by_user_id) order by i.sort_order,i.id)
      from public.party_items i where i.party_id=p.id),'[]'::jsonb),
    'rsvps',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,
      'name',coalesce(r.name,to_jsonb(r)->>'guest_name','Guest'),'status',r.status,
      'attendeeCount',greatest(coalesce(r.attendee_count,1),1),
      'updatedAt',coalesce(r.updated_at::text,to_jsonb(r)->>'created_at','')) order by r.id)
      from public.party_rsvps r where r.party_id=p.id),'[]'::jsonb)))
  from public.parties p where p.id=p_party_id and p.deleted_at is null
$$;
notify pgrst,'reload schema';
commit;
