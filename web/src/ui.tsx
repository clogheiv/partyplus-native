import type {ReactNode} from 'react';
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />, arrow: <path d="m9 5 7 7-7 7M4 12h12" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></>,
    pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    check: <path d="m5 12 4 4L19 6" />, share: <><path d="M12 16V3m-5 5 5-5 5 5M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /></>,
    back: <path d="m12 5-7 7 7 7M5 12h15" />, sparkle: <><path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.sparkle}</svg>;
}
export function Notice({ children, kind = 'info' }: { children: ReactNode; kind?: string }) { return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>; }

