export type FocusableInput = {
  focus: () => void;
  isFocused: () => boolean;
};

const focusedInputTopMargin = 12;

export function getFocusedInputScrollOffset(inputY: number): number {
  return Math.max(inputY - focusedInputTopMargin, 0);
}

export function focusInputIfNeeded(
  input: FocusableInput | null | undefined
): boolean {
  if (!input || input.isFocused()) return false;

  input.focus();
  return true;
}
