export type FocusableInput = {
  focus: () => void;
  isFocused: () => boolean;
};

const focusedInputSafeAreaMargin = 12;

export function getSafeFocusedInputScrollOffset(
  inputY: number,
  topSafeAreaInset: number
): number {
  const topClearance = Math.max(topSafeAreaInset, 0) + focusedInputSafeAreaMargin;
  return Math.max(inputY - topClearance, 0);
}

export function focusInputIfNeeded(
  input: FocusableInput | null | undefined
): boolean {
  if (!input || input.isFocused()) return false;

  input.focus();
  return true;
}
