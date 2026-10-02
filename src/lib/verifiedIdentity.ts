import { backendBoundary, isSupabaseConfigured, supabase } from "./supabase";
import { classifyPartyError, PartyOperationError } from "./partyErrors";
import { ensureUserId } from "./ids";

let initializing: Promise<string> | undefined;
export async function ensureSignedIdentity(): Promise<string> {
  if (!isSupabaseConfigured) throw new PartyOperationError("configuration", backendBoundary.reason ?? "Backend is not configured.");
  if (!initializing) {
    initializing = (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw classifyPartyError(error);
      if (data.session) return data.session.user.id;
      const response = await supabase.auth.signInAnonymously();
      if (response.error) throw classifyPartyError(response.error);
      if (!response.data.user) throw new PartyOperationError("authorization", "A verified session could not be established.");
      return response.data.user.id;
    })();
  }
  try { return await initializing; } finally { initializing = undefined; }
}

export async function ensureRecoverableHostIdentity(): Promise<string> {
  if (!isSupabaseConfigured) throw new PartyOperationError("configuration", backendBoundary.reason ?? "Backend is not configured.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw classifyPartyError(error);
  const user = data.session?.user;
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    throw new PartyOperationError("authorization", "Sign in to a verified host account before saving. Your draft is preserved.");
  }
  return user.id;
}

export async function guestIdentityForView() {
  // Viewing must not create a server-side account or mutate anything remotely.
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.user.id;
  }
  return ensureUserId();
}
