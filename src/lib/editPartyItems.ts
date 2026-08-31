import type { PartyItem } from "./partyTypes";

type ItemIdFactory = () => string;
type ExistingItemIdNormalizer = (id: string) => string;

export function buildEditedPartyItems(
  existingItems: PartyItem[],
  editedNames: string[],
  createItemId: ItemIdFactory,
  normalizeExistingItemId: ExistingItemIdNormalizer
): PartyItem[] {
  const unmatchedExistingItems = [...existingItems];

  return editedNames.map((name) => {
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

    return {
      id: createItemId(),
      name,
      qty: "",
      claimedBy: undefined,
      claimedByUserId: undefined,
      createdBy: undefined,
    };
  });
}
