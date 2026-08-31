import assert from "node:assert/strict";
import test from "node:test";

import { buildEditedPartyItems } from "../src/lib/editPartyItems.ts";

function build(existingItems, editedNames) {
  let nextId = 0;
  return buildEditedPartyItems(
    existingItems,
    editedNames,
    () => `new-${++nextId}`,
    (id) => id
  );
}

test("keeps a claim with its item after an earlier item is removed", () => {
  const result = build(
    [
      { id: "a", name: "Ice" },
      { id: "b", name: "Chips", claimedBy: "Sam", claimedByUserId: "sam-id" },
    ],
    ["Chips"]
  );

  assert.deepEqual(result, [
    { id: "b", name: "Chips", claimedBy: "Sam", claimedByUserId: "sam-id" },
  ]);
});

test("keeps existing item identity when a new item is inserted first", () => {
  const result = build([{ id: "ice-id", name: "Ice", claimedBy: "Ari" }], ["Cups", "Ice"]);

  assert.equal(result[0].id, "new-1");
  assert.equal(result[0].claimedBy, undefined);
  assert.equal(result[1].id, "ice-id");
  assert.equal(result[1].claimedBy, "Ari");
});

test("matches duplicate names to distinct existing items in order", () => {
  const result = build(
    [
      { id: "first", name: "Drinks", claimedBy: "Lee" },
      { id: "second", name: "drinks", claimedBy: "Jo" },
    ],
    ["DRINKS", "Drinks"]
  );

  assert.deepEqual(result.map((item) => item.id), ["first", "second"]);
  assert.deepEqual(result.map((item) => item.claimedBy), ["Lee", "Jo"]);
});

test("treats a renamed item as new instead of transferring a claim", () => {
  const result = build(
    [{ id: "old", name: "Cake", claimedBy: "Morgan", claimedByUserId: "morgan-id" }],
    ["Cupcakes"]
  );

  assert.equal(result[0].id, "new-1");
  assert.equal(result[0].claimedBy, undefined);
  assert.equal(result[0].claimedByUserId, undefined);
});
