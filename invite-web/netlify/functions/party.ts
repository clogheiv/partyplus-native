import { validateBackendBoundary } from "../../../src/lib/backendBoundary";
import { requireParty } from "../../../src/lib/partyValidation";

// Preserve the endpoint alias as a read-only adapter. No service-role credential.
export async function handler(event: { httpMethod: string; queryStringParameters?: Record<string,string> }) {
  const json = (statusCode:number,value:unknown) => ({statusCode,headers:{"content-type":"application/json","cache-control":"no-store"},body:JSON.stringify(value)});
  if (event.httpMethod !== "GET") return json(405,{error:"This invitation endpoint is read-only."});
  const id=event.queryStringParameters?.id ?? event.queryStringParameters?.partyId;
  if (!id || id.length>200) return json(400,{error:"A valid party ID is required."});
  const environment=process.env.PARTYPLUS_BACKEND_ENV;
  const url=process.env.PARTYPLUS_SUPABASE_URL;
  const key=process.env.PARTYPLUS_SUPABASE_PUBLISHABLE_KEY;
  const boundary=validateBackendBoundary(environment,url ?? null,key ?? null,true);
  if (!boundary.configured) return json(503,{error:"The isolated invitation service is not configured."});
  try {
    const response=await fetch(url + "/rest/v1/rpc/partyplus_v2_read_party",{
      method:"POST",headers:{apikey:key!,"content-type":"application/json"},body:JSON.stringify({p_party_id:id}),
    });
    if (!response.ok) return json(response.status===403?403:503,{error:"Party information could not be loaded. Retry is available."});
    const party=await response.json();
    return party?json(200,{ok:true,id,party:requireParty(party,id)}):json(404,{error:"Party not found."});
  } catch { return json(503,{error:"Party information could not be loaded. Retry is available."}); }
}
