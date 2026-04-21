import type { Party, PartyItem, PartyRsvp, PartyRsvpStatus } from "./partyTypes";

function normalizeName(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeUserId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeAttendeeCount(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function normalizeRsvpStatus(value?: string | null): PartyRsvpStatus {
  return value === "yes" || value === "no" || value === "maybe" ? value : "maybe";
}

function rsvpUpdatedAtValue(rsvp: PartyRsvp) {
  const timestamp = Date.parse(rsvp.updatedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function clearItemClaim(item: PartyItem): PartyItem {
  if (!item.claimedBy && !item.claimedByUserId) return item;

  return {
    ...item,
    claimedBy: undefined,
    claimedByUserId: undefined,
  };
}

export function dedupePartyRsvps(rsvps?: PartyRsvp[]): PartyRsvp[] {
  const byId = new Map<string, PartyRsvp>();

  for (const rsvp of rsvps ?? []) {
    const id = normalizeUserId(rsvp?.id);
    if (!id) continue;

    const normalized: PartyRsvp = {
      id,
      name: normalizeName(rsvp?.name) || "Guest",
      status: normalizeRsvpStatus(rsvp?.status),
      attendeeCount: normalizeAttendeeCount(rsvp?.attendeeCount),
      updatedAt: rsvp?.updatedAt ?? new Date().toISOString(),
    };

    const existing = byId.get(id);
    if (!existing || rsvpUpdatedAtValue(normalized) >= rsvpUpdatedAtValue(existing)) {
      byId.set(id, normalized);
    }
  }

  return Array.from(byId.values());
}

export function itemClaimMatchesUser(
  item: PartyItem,
  userId: string,
  fallbackName?: string | null
) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return false;

  if (normalizeUserId(item.claimedByUserId) === normalizedUserId) {
    return true;
  }

  const legacyName = normalizeName(fallbackName);
  return !item.claimedByUserId && !!legacyName && normalizeName(item.claimedBy) === legacyName;
}

export function reconcilePartyState(party: Party): Party {
  const rsvps = dedupePartyRsvps(party.rsvps);
  const yesRsvpById = new Map<string, PartyRsvp>();
  const yesRsvpsByName = new Map<string, PartyRsvp[]>();

  for (const rsvp of rsvps) {
    if (rsvp.status !== "yes") continue;

    yesRsvpById.set(rsvp.id, rsvp);

    const nameKey = normalizeName(rsvp.name);
    if (!nameKey) continue;

    const matches = yesRsvpsByName.get(nameKey) ?? [];
    matches.push(rsvp);
    yesRsvpsByName.set(nameKey, matches);
  }

  const items = (party.items ?? []).map((item) => {
    const claimedByUserId = normalizeUserId(item.claimedByUserId);
    const claimedBy = normalizeName(item.claimedBy);

    if (claimedByUserId) {
      const claimantRsvp = yesRsvpById.get(claimedByUserId);
      if (!claimantRsvp) {
        return clearItemClaim(item);
      }

      const nextName = normalizeName(claimantRsvp.name);
      if (claimedBy !== nextName || item.claimedByUserId !== claimedByUserId) {
        return {
          ...item,
          claimedBy: nextName,
          claimedByUserId,
        };
      }

      return item;
    }

    if (!claimedBy) {
      return clearItemClaim(item);
    }

    const matchingRsvps = yesRsvpsByName.get(claimedBy) ?? [];
    if (matchingRsvps.length === 0) {
      return clearItemClaim(item);
    }

    if (matchingRsvps.length === 1) {
      return {
        ...item,
        claimedBy: normalizeName(matchingRsvps[0].name),
        claimedByUserId: matchingRsvps[0].id,
      };
    }

    return {
      ...item,
      claimedBy,
      claimedByUserId: undefined,
    };
  });

  return {
    ...party,
    items,
    rsvps: rsvps.length ? rsvps : undefined,
  };
}

export function applyRsvpForUser(
  party: Party,
  userId: string,
  nextRsvp: PartyRsvp
): Party {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return reconcilePartyState(party);
  }

  const previousRsvps = dedupePartyRsvps(party.rsvps);
  const previousRsvp = previousRsvps.find((rsvp) => rsvp.id === normalizedUserId);
  const previousName = normalizeName(previousRsvp?.name);
  const nextName = normalizeName(nextRsvp.name) || "Guest";
  const nextStatus = normalizeRsvpStatus(nextRsvp.status);

  const rsvps = [
    ...previousRsvps.filter((rsvp) => rsvp.id !== normalizedUserId),
    {
      ...nextRsvp,
      id: normalizedUserId,
      name: nextName,
      status: nextStatus,
      attendeeCount: normalizeAttendeeCount(nextRsvp.attendeeCount),
      updatedAt: nextRsvp.updatedAt ?? new Date().toISOString(),
    },
  ];

  const items = (party.items ?? []).map((item) => {
    if (!itemClaimMatchesUser(item, normalizedUserId, previousName)) {
      return item;
    }

    if (nextStatus !== "yes") {
      return clearItemClaim(item);
    }

    return {
      ...item,
      claimedBy: nextName,
      claimedByUserId: normalizedUserId,
    };
  });

  return reconcilePartyState({
    ...party,
    items,
    rsvps,
  });
}

export function toggleItemClaimForUser(
  party: Party,
  itemId: string,
  userId: string,
  displayName: string
): Party {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedName = normalizeName(displayName);

  if (!normalizedUserId || !normalizedName) {
    return reconcilePartyState(party);
  }

  const items = (party.items ?? []).map((item) => {
    if (item.id !== itemId) return item;

    if (itemClaimMatchesUser(item, normalizedUserId, normalizedName)) {
      return clearItemClaim(item);
    }

    if (normalizeName(item.claimedBy) || normalizeUserId(item.claimedByUserId)) {
      return item;
    }

    return {
      ...item,
      claimedBy: normalizedName,
      claimedByUserId: normalizedUserId,
    };
  });

  return reconcilePartyState({
    ...party,
    items,
  });
}
