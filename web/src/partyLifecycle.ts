// Classification changes only the view. It never mutates or expires party data.
export function isPartyPast(date: string | undefined, now: number = Date.now()): boolean {
 const timestamp=date ? Date.parse(date) : NaN;
 return Number.isFinite(timestamp) && Number.isFinite(now) && timestamp < now;
}
