import assert from "node:assert/strict";
import test from "node:test";

import {
  focusInputIfNeeded,
  getSafeFocusedInputScrollOffset,
} from "../src/lib/inputFocus.ts";

test("positions focused inputs below the measured safe area and margin", () => {
  assert.equal(getSafeFocusedInputScrollOffset(320, 59), 249);
  assert.equal(getSafeFocusedInputScrollOffset(320, 24), 284);
});

test("does not scroll past the beginning when safe-area clearance is larger", () => {
  assert.equal(getSafeFocusedInputScrollOffset(50, 47), 0);
});

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
