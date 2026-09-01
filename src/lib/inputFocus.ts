export type FocusableInput = {
  focus: () => void;
  isFocused: () => boolean;
};

export function focusInputIfNeeded(
  input: FocusableInput | null | undefined
): boolean {
  if (!input || input.isFocused()) return false;

  input.focus();
  return true;
}
