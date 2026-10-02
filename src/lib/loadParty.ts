import type { Party } from "./partyTypes";
import { classifyPartyError, PartyOperationError } from "./partyErrors";

export function describePartyReadError(error: unknown) {
  const failure = classifyPartyError(error);
  if (failure.kind === "offline") return "Could not load live party information. Check your connection and retry.";
  if (failure.kind === "authorization") return "Access to this invitation was denied. Check your account or ask the host for help.";
  if (failure.kind === "server") return "The party service could not load this invitation. Retry is available.";
  return failure.message;
}

export function createLatestPartyLoader() {
  let generation = 0;
  return {
    cancel() { generation += 1; },
    async load(id: string, remote: (id: string) => Promise<Party | null>,
      cached: (id: string) => Promise<Party | null>, publish: (party: Party | null, error: string | null) => void) {
      const request = ++generation;
      try {
        const party = await remote(id);
        if (request !== generation) return;
        publish(party, party ? null : "Party not found. Check the invite link or retry.");
      } catch (error) {
        let fallback: Party | null = null;
        let message = describePartyReadError(error);
        try { fallback = await cached(id); }
        catch (localError) { message += " " + classifyPartyError(localError).message; }
        if (request !== generation) return;
        publish(fallback, (fallback ? "Showing a saved copy. " : "") + message);
      }
    },
  };
}

export function requireShareableParty(party: Party | null, id: string): Party {
  if (!party || party.id !== id || party.cloudStatus !== "committed" || !Number.isInteger(party.revision) || party.revision! < 1) {
    throw new PartyOperationError("upgrade-required", "Save this party with the current service before sharing. Its draft and existing invite are preserved.");
  }
  return party;
}
