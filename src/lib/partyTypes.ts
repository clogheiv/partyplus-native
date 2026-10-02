export type PartyItem = {
  id: string;
  name: string;
  qty?: string;
  claimedBy?: string;
  claimedByUserId?: string;
  createdBy?: string;
};

export type PartyRsvpStatus = "yes" | "no" | "maybe";

export type PartyRsvp = {
  id: string;
  name: string;
  status: PartyRsvpStatus;
  attendeeCount: number;
  updatedAt: string;
};

export type Party = {
  id: string;
  title: string;
  date?: string;
  location?: string;
  notes?: string;
  theme?: string;
  items: PartyItem[];
  rsvps?: PartyRsvp[];
  createdAt: string;
  updatedAt: string;
  hostId?: string;
  t?: string;
  revision?: number;
  canEdit?: boolean; // Server-supplied capability; UI hint only. RPCs enforce authorization.
  cloudStatus?: "local-only" | "pending" | "failed" | "committed" | "conflict";
  cloudOperationId?: string;
  removedItemIds?: string[];
};
