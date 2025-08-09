export function extractVideoId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v') as string;
    // Support /shorts/{id}
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts.pop();
    if (last && /^[A-Za-z0-9_-]{6,15}$/.test(last)) return last;
    return url.replace(/[^\w]/g, '').slice(0, 40);
  } catch {
    return url.replace(/[^\w]/g, '').slice(0, 40);
  }
}
