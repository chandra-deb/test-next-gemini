export function toOffsetString(v: number) { return `${v}s`; }

export function parseTimeString(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/s$/, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatTime(n: number): string {
  return n.toFixed(3);
}
