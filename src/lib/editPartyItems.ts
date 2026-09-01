import type { PartyItem } from "./partyTypes";

type ItemIdFactory = () => string;
type ExistingItemIdNormalizer = (id: string) => string;

export function prependManualPartyItem(
  items: string[],
  item: string
): string[] {
  return [item, ...items];
}

export function buildEditedPartyItems(
  existingItems: PartyItem[],
  editedNames: string[],
  createItemId: ItemIdFactory,
  normalizeExistingItemId: ExistingItemIdNormalizer,
  newManualItemPrefixLength = 0
): PartyItem[] {
  const prefixLength = Math.min(
    Math.max(newManualItemPrefixLength, 0),
    editedNames.length
  );
  const unmatchedExistingItems = [...existingItems];

  const createNewItem = (name: string): PartyItem => ({
    id: createItemId(),
    name,
    qty: "",
    claimedBy: undefined,
    claimedByUserId: undefined,
    createdBy: undefined,
  });

  const manualItems = editedNames.slice(0, prefixLength).map(createNewItem);
  const retainedItems = editedNames.slice(prefixLength).map((name) => {
    const normalizedName = name.trim().toLowerCase();
    const existingIndex = unmatchedExistingItems.findIndex(
      (item) => item.name.trim().toLowerCase() === normalizedName
    );

    if (existingIndex >= 0) {
      const [existingItem] = unmatchedExistingItems.splice(existingIndex, 1);
      return {
        ...existingItem,
        id: normalizeExistingItemId(existingItem.id),
        name,
      };
    }

    return createNewItem(name);
  });

  return [...manualItems, ...retainedItems];
}
