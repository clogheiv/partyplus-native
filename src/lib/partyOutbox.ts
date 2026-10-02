import type { Party } from "./partyTypes";
import { PartyOperationError, classifyPartyError } from "./partyErrors";

export type GuestIntent =
  | { kind: "rsvp"; response: { name: string; status: "yes" | "maybe" | "no"; attendeeCount: number } }
  | { kind: "claim"; itemId: string; claim: boolean }
  | { kind: "suggest"; name: string; itemId?: string }
  | { kind: "delete" };
export type OutboxOperation = {
  partyId: string; operationId: string; principalId: string; intent: GuestIntent;
  attempted?: boolean;
};
type OutboxStore = {
  getDraft<T>(key: string): Promise<T | undefined>;
  setDraft<T>(key: string, value: T): Promise<void>;
  removeDraft(key: string): Promise<void>;
};

export function createPartyOutbox(store: OutboxStore, allocate: () => string,
  identify: () => Promise<string>, send: (operation: OutboxOperation) => Promise<Party | null>,
  exclusive?: <T>(partyId: string, operation: () => Promise<T>) => Promise<T>) {
  let running = false;
    async function run(partyId: string, intent?: GuestIntent) {
      if (running) throw new PartyOperationError("conflict", "Another change is pending. Wait for it to finish.");
      running = true;
      try {
        const key = `outbox:${partyId}`;
        const saved = await store.getDraft<OutboxOperation>(key);
        if (saved && (saved.partyId !== partyId || !saved.operationId || typeof saved.principalId !== "string" || !saved.intent?.kind)) {
          throw new PartyOperationError("local_corrupt", "Pending data needs recovery. Its original data is preserved.");
        }
        if (saved && intent && JSON.stringify(saved.intent) !== JSON.stringify(intent)) {
          // A suggestion's allocated ID belongs to its saved operation, not the input form.
          const savedIntent = { ...saved.intent };
          if (savedIntent.kind === "suggest") delete savedIntent.itemId;
          if (JSON.stringify(savedIntent) !== JSON.stringify(intent)) {
            throw new PartyOperationError("conflict", "Retry the pending change before sending a different one.");
          }
        }
        if (!saved && !intent) throw new PartyOperationError("missing", "There is no pending change to retry.");
        const operation: OutboxOperation = saved ?? {
          partyId, principalId: "", operationId: allocate(),
          intent: intent!.kind === "suggest" ? { ...intent!, itemId: allocate() } : intent!,
        };
        await store.setDraft(key, operation);
        const principalId = await identify();
        if (operation.principalId && operation.principalId !== principalId) {
          throw new PartyOperationError("authorization", "Sign in with the account that started this pending change.");
        }
        operation.principalId = principalId;
        await store.setDraft(key, operation);
        const earlierOutcomeUnknown = operation.attempted === true;
        operation.attempted = true;
        await store.setDraft(key,operation);
        let result: Party | null;
        try { result = await send(operation); }
        catch (error) {
          const failure = classifyPartyError(error);
          if (failure.serverRejected && !earlierOutcomeUnknown) {
            // A definite transaction rejection is different from an unknown network outcome.
            // Retain its contents for recovery, but allow unrelated future operations.
            await store.setDraft(`rejected:${partyId}:${operation.operationId}`,operation);
            await store.removeDraft(key);
          }
          if (failure.serverRejected && earlierOutcomeUnknown) {
            throw new PartyOperationError(failure.kind, failure.message + " An earlier outcome is still unknown; the original operation remains pending.");
          }
          throw failure;
        }
        if (operation.intent.kind !== "delete" && (!result || result.id !== partyId || !Number.isInteger(result.revision))) {
          throw new PartyOperationError("server", "The server did not confirm this change. Retry is available.");
        }
        await store.removeDraft(key);
        return result;
      } finally { running = false; }
    }
  return { run: (partyId: string, intent?: GuestIntent) => exclusive
    ? exclusive(partyId, () => run(partyId,intent)) : run(partyId,intent) };
}
