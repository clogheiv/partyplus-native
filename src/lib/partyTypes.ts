export type PartyItem = {
  id: string;
  name: string;
  qty?: string;
  claimedBy?: string;
  createdBy?: string;
};

export type Party = {
  id: string;
  title: string;
  date?: string;
  location?: string;
  notes?: string;
  theme?: string;
  items: PartyItem[];
  createdAt: string;
  updatedAt: string;
};
