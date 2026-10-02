import { createClient } from "@supabase/supabase-js";
import { createLocalRepository } from "../../src/lib/localRepository";
import { createPartyOutbox } from "../../src/lib/partyOutbox";
import { requireParty, newerParty, requireCommitReceipt } from "../../src/lib/partyValidation";
import { classifyPartyError, PartyOperationError } from "../../src/lib/partyErrors";
import { describePartyReadError } from "../../src/lib/loadParty";
import type { Party } from "../../src/lib/partyTypes";

declare const __PARTYPLUS_CONFIG__: { environment: string; url: string; key: string; nativeScheme: string };
const parts = location.pathname.split("/").filter(Boolean);
const id = ["i","party"].includes(parts[0]) ? decodeURIComponent(parts[1] ?? "")
  : ["share","_share","__share"].includes(parts[0]) ? new URL(location.href).searchParams.get("id") ?? "" : "";
if (id) void start(id).catch(error => {
  const status = document.getElementById("liveStatus");
  if (status) status.textContent = classifyPartyError(error).message;
});

async function start(partyId: string) {
  const config = __PARTYPLUS_CONFIG__;
  const appLink=document.getElementById("openApp") as HTMLAnchorElement | null;
  const payload=new URL(location.href).searchParams;
  const d=payload.get("d") ?? payload.get("data") ?? payload.get("payload");
  if (appLink) appLink.href=config.nativeScheme + "://party/" + encodeURIComponent(partyId) + (d ? "?d=" + encodeURIComponent(d) : "");
  const client = createClient(config.url,config.key,{auth:{detectSessionInUrl:false}});
  const store = createLocalRepository({
    async getItem(key) { return localStorage.getItem(key); },
    async setItem(key,value) { localStorage.setItem(key,value); },
    async removeItem(key) { localStorage.removeItem(key); },
    async runExclusive(operation) {
      return navigator.locks ? navigator.locks.request("partyplus-storage",operation) : operation();
    },
  });
  const root = document.getElementById("guestControls")!;
  root.hidden = false;
  const status = document.getElementById("liveStatus")!;
  const changeStatus = document.getElementById("changeStatus")!;
  const retryButton = document.getElementById("retryChange") as HTMLButtonElement;
  retryButton.hidden = true;
  const form = document.getElementById("rsvpForm") as HTMLFormElement;
  const name = document.getElementById("guestName") as HTMLInputElement;
  const count = document.getElementById("guestCount") as HTMLInputElement;
  const response = document.getElementById("guestResponse") as HTMLSelectElement;
  const suggestion = document.getElementById("guestSuggestion") as HTMLInputElement;
  const list = document.getElementById("liveItems")!;
  let party: Party | null = null;
  let principal = "";
  let busy = false;
  let generation = 0;
  let readFailed = false;
  let formDirty = false;
  let rejected = false;
  const setStatus = (message:string) => { status.textContent = message; };
  async function rpc(name:string,parameters:Record<string,unknown>) {
    const result = await client.rpc(name,parameters);
    if (result.error) throw result.error;
    return result.data;
  }
  const outbox = createPartyOutbox(store,() => crypto.randomUUID(),async () => {
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    if (session.data.session) return session.data.session.user.id;
    const signed = await client.auth.signInAnonymously();
    if (signed.error) throw signed.error;
    if (!signed.data.user) throw Error("Guest session could not be established.");
    return signed.data.user.id;
  },async operation => {
    const {intent,operationId} = operation;
    principal = operation.principalId;
    let result;
    if (intent.kind === "rsvp") result = await rpc("partyplus_v2_rsvp",{p_party_id:partyId,p_operation_id:operationId,p_response:intent.response});
    else if (intent.kind === "claim") result = await rpc("partyplus_v2_claim_item",{p_party_id:partyId,p_operation_id:operationId,p_item_id:intent.itemId,p_claim:intent.claim});
    else if (intent.kind === "suggest") result = await rpc("partyplus_v2_suggest_item",{p_party_id:partyId,p_operation_id:operationId,p_item_id:intent.itemId,p_name:intent.name});
    else throw Error("Unsupported guest action.");
    const confirmed = requireCommitReceipt(result,partyId,operationId).party;
    await store.upsertParty({...confirmed,cloudStatus:"committed"});
    return confirmed;
  },async (id,operation) => {
    if (!navigator.locks) throw new PartyOperationError("upgrade-required","Update this browser before saving changes. Live invitation viewing remains available.");
    return navigator.locks.request("partyplus-outbox:" + id,operation);
  });
  function render(next: Party) {
    party = newerParty(party,next)!;
    document.getElementById("subtitle")!.textContent = party.title;
    const details = document.getElementById("details")!;
    details.replaceChildren();
    for (const [label,value] of [["When",party.date],["Where",party.location],["Notes",party.notes]]) {
      if (value) { const row = document.createElement("p"); row.textContent = label + ": " + value; details.append(row); }
    }
    list.replaceChildren();
    const me = party.rsvps?.find(rsvp => rsvp.id === principal);
    if (me && !formDirty) { name.value=me.name; count.value=String(me.attendeeCount); response.value=me.status; }
    for (const item of party.items) {
      const row = document.createElement("li");
      const label = document.createElement("span"); label.textContent = item.name + (item.claimedBy ? " — " + item.claimedBy : ""); row.append(label);
      const button = document.createElement("button");
      const owned = item.claimedByUserId === principal && Boolean(principal);
      button.textContent = owned ? "Unclaim" : "Claim";
      button.disabled = busy || readFailed || me?.status !== "yes" || Boolean(item.claimedBy && !owned);
      button.addEventListener("click",() => { void mutate({kind:"claim",itemId:item.id,claim:!owned}); }); row.append(button); list.append(row);
    }
    document.getElementById("liveRsvps")!.textContent = party.rsvps?.length
      ? party.rsvps.map(rsvp => rsvp.name + ": " + rsvp.status + " (" + rsvp.attendeeCount + ")").join("; ") : "No responses yet.";
  }
  async function refresh() {
    const request = ++generation;
    try {
      const next = await rpc("partyplus_v2_read_party",{p_party_id:partyId});
      if (request !== generation) return;
      readFailed = !next;
      if (!next) { party=null; list.replaceChildren(); document.getElementById("details")!.replaceChildren(); setStatus("Party not found. Check the invite or retry."); return; }
      const session = await client.auth.getSession();
      principal = session.data.session?.user.id ?? "";
      render(requireParty(next,partyId)); setStatus("Live party information. You can RSVP here without installing the app.");
    } catch (error) {
      if (request !== generation) return;
      readFailed = true;
      if (party) render(party);
      setStatus((party ? "Showing the last loaded copy. " : "") + describePartyReadError(error));
    }
    finally { root.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach(button => {button.disabled = busy || readFailed || !party;}); }
  }
  async function mutate(intent?: Parameters<typeof outbox.run>[1]) {
    if (busy) return;
    busy=true; rejected=false; generation++; changeStatus.textContent="Change pending. Waiting for confirmation…";
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input,select,button").forEach(control => {control.disabled=true;});
    if (party) render(party);
    try {
      const next = await outbox.run(partyId,intent);
      if (next) {
        readFailed=false;
        if (intent?.kind === "rsvp") formDirty=false;
        if (intent?.kind === "suggest" && suggestion.value.trim()===intent.name) suggestion.value="";
        render(next); changeStatus.textContent="Saved online.";
      }
    } catch (error) {
      const failure=classifyPartyError(error); rejected=failure.serverRejected;
      const pending=await store.getDraft("outbox:" + partyId).catch(() => undefined);
      changeStatus.textContent=failure.message + (pending ? " Your pending change is preserved. Use Retry pending change." : rejected ? " Refresh and try your change again." : " Keep this invitation open and try saving your change again.");
    }
    finally {
      busy=false;
      root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input,select,button").forEach(control => {control.disabled=false;});
      if (party) render(party);
      root.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach(button => {button.disabled=readFailed || !party;});
      retryButton.textContent=rejected ? "Refresh after rejected change" : "Retry pending change";
      retryButton.hidden=!rejected && !await store.getDraft("outbox:" + partyId).catch(() => true);
    }
  }
  form.addEventListener("input",() => { formDirty=true; });
  form.addEventListener("submit",event => {
    event.preventDefault();
    const number = Number(count.value);
    if (!name.value.trim() || !Number.isInteger(number) || number < 1 || number > 100) { changeStatus.textContent="Enter your name and choose 1–100 guests."; return; }
    void mutate({kind:"rsvp",response:{name:name.value.trim(),status:response.value as "yes"|"maybe"|"no",attendeeCount:number}});
  });
  document.getElementById("suggestForm")!.addEventListener("submit",event => {
    event.preventDefault(); if (!suggestion.value.trim()) return;
    void mutate({kind:"suggest",name:suggestion.value.trim()});
  });
  retryButton.addEventListener("click",() => { if (rejected) void refresh(); else void mutate(); });
  document.getElementById("refreshParty")!.addEventListener("click",() => { void refresh(); });
  document.addEventListener("visibilitychange",() => { if (!document.hidden && !busy) void refresh(); });
  // Polling is explicit because direct table grants remain denied; configure approved
  // realtime delivery separately after the authoritative publication is known.
  const timer = setInterval(() => { if (!document.hidden && !busy) void refresh(); },20000);
  window.addEventListener("pagehide",() => clearInterval(timer),{once:true});
  const pending = await store.getDraft("outbox:" + partyId).catch(() => undefined);
  retryButton.hidden=!pending;
  if (pending) changeStatus.textContent="A previous change is pending. Retry it to recover the result.";
  await refresh();
}
