export type PartyFailure = "configuration" | "offline" | "authorization" | "conflict" | "upgrade-required" | "server" | "local_corrupt" | "local_storage" | "missing";

export class PartyOperationError extends Error {
  constructor(readonly kind: PartyFailure, message: string, readonly serverRejected = false) { super(message); }
}

export function classifyPartyError(error: unknown): PartyOperationError {
  if (error instanceof PartyOperationError) return error;
  const value = error as { code?: string; message?: string; status?: number };
  if (value?.code === "local_unavailable") return new PartyOperationError("local_storage", "This device could not store or read saved data. Keep this screen open and retry before closing it.");
  if (value?.code === "local_corrupt") return new PartyOperationError("local_corrupt", "Saved data needs recovery. Its original contents are preserved.");
  if (value?.code === "42501" || value?.status === 401 || value?.status === 403) {
    return new PartyOperationError("authorization", "This action requires verified access. Your existing party has been preserved.", value?.code === "42501");
  }
  if (value?.code === "PGRST202" || value?.code === "42883") {
    return new PartyOperationError("upgrade-required", "This backend needs the new safe data contract before changes can be saved.", true);
  }
  if (/revision_conflict|operation_conflict|claim_conflict/.test(value?.message ?? "")) {
    return new PartyOperationError("conflict", "The party changed. Reload it before trying this change again.", value?.code === "P0001" && !/operation_conflict/.test(value.message ?? ""));
  }
  if (/fetch|network|offline|timeout|abort/i.test(value?.message ?? "")) {
    return new PartyOperationError("offline", "Could not confirm the change. Check your connection and retry the same operation.");
  }
  return new PartyOperationError("server", "Could not confirm the change. Your draft is preserved; please try again.");
}
