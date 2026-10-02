type SupabaseErrorLogContext = {
  partyId?: string;
  itemCount?: number;
  rsvpCount?: number;
  redactValues?: readonly (string | null | undefined)[];
};

function redactUserText(value: unknown, redactValues: SupabaseErrorLogContext["redactValues"]) {
  if (value === null || value === undefined) return null;

  let redacted = String(value);
  const sensitiveValues = Array.from(
    new Set(
      (redactValues ?? [])
        .map((entry) => entry?.trim())
        .filter((entry): entry is string => Boolean(entry))
    )
  ).sort((left, right) => right.length - left.length);

  for (const sensitiveValue of sensitiveValues) {
    redacted = redacted.split(sensitiveValue).join("[REDACTED]");
  }

  return redacted;
}

export function logSupabaseError(
  operation: string,
  error: unknown,
  context: SupabaseErrorLogContext = {}
) {
  if (!__DEV__) return;

  const errorRecord =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};

  console.error(
    "[supabase] request failed",
    JSON.stringify(
      {
        operation,
        partyId: context.partyId ?? null,
        itemCount: context.itemCount ?? null,
        rsvpCount: context.rsvpCount ?? null,
        code: errorRecord.code ?? null,
        message: redactUserText(
          errorRecord.message ?? (error instanceof Error ? error.message : error),
          context.redactValues
        ),
        details: redactUserText(errorRecord.details, context.redactValues),
        hint: redactUserText(errorRecord.hint, context.redactValues),
        status: errorRecord.status ?? null,
      },
      null,
      2
    )
  );
}
