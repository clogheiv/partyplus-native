export function formatPartyDateTime(iso?: string | null) {
  if (!iso) return "No date set";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Invalid date";

  // Example: "Sat, Jan 18 • 7:30 PM"
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
