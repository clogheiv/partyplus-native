import assert from "node:assert/strict";
import test from "node:test";

import { focusInputIfNeeded } from "../src/lib/inputFocus.ts";

test("does not send another focus command to an already-focused input", () => {
  let focusCalls = 0;
  const input = {
    isFocused: () => true,
    focus: () => {
      focusCalls += 1;
    },
  };

  assert.equal(focusInputIfNeeded(input), false);
  assert.equal(focusCalls, 0);
});

test("restores focus when the input is not focused", () => {
  let focusCalls = 0;
  const input = {
    isFocused: () => false,
    focus: () => {
      focusCalls += 1;
    },
  };

  assert.equal(focusInputIfNeeded(input), true);
  assert.equal(focusCalls, 1);
});
