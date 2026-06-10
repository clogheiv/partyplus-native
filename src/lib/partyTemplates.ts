export type PartyTemplate = {
  id: string;
  name: string;
  items: string[];
};

export const PARTY_TEMPLATES: PartyTemplate[] = [
  {
    id: "cookout",
    name: "Cookout",
    items: ["Burgers", "buns", "hot dogs", "chips", "drinks", "ice", "dessert", "paper plates", "napkins"],
  },
  {
    id: "birthday-party",
    name: "Birthday Party",
    items: ["Cake", "candles", "drinks", "snacks", "ice cream", "plates", "napkins", "decorations"],
  },
  {
    id: "game-night",
    name: "Game Night",
    items: ["Snacks", "drinks", "dessert", "board games", "cups", "napkins"],
  },
  {
    id: "holiday-party",
    name: "Holiday Party",
    items: ["Main dish", "side dish", "dessert", "drinks", "utensils", "plates", "napkins"],
  },
  {
    id: "potluck",
    name: "Potluck",
    items: ["Main dish", "side dish", "salad", "dessert", "drinks", "plates", "napkins", "serving utensils"],
  },
];

function normalizeItemName(name: string) {
  return name.trim().toLowerCase();
}

export function mergeTemplateItems(existingItems: string[], templateItems: string[]) {
  const seen = new Set(existingItems.map(normalizeItemName).filter(Boolean));
  const addedItems: string[] = [];

  for (const item of templateItems) {
    const clean = item.trim();
    const key = normalizeItemName(clean);
    if (!clean || seen.has(key)) continue;

    seen.add(key);
    addedItems.push(clean);
  }

  return {
    items: [...existingItems, ...addedItems],
    addedItems,
  };
}
