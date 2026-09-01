import assert from "node:assert/strict";
import test from "node:test";

import {
  focusInputIfNeeded,
  getFocusedInputScrollOffset,
} from "../src/lib/inputFocus.ts";

test("leaves a consistent margin inside the safe scroll viewport", () => {
  assert.equal(getFocusedInputScrollOffset(320), 308);
});

test("does not scroll past the beginning of the safe viewport", () => {
  assert.equal(getFocusedInputScrollOffset(8), 0);
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
