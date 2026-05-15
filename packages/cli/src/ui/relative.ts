// Returns a short human-friendly relative time string (e.g. "2 hours ago").
// Tier 1 Provisional output format.
export function relativeTime(isoTimestamp: string, now: Date = new Date()): string {
  const ts = new Date(isoTimestamp);
  if (Number.isNaN(ts.getTime())) return "?";
  const diffMs = now.getTime() - ts.getTime();
  if (diffMs < 0) return "in the future";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function truncate(s: string | null, n: number): string {
  if (s === null) return "";
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
