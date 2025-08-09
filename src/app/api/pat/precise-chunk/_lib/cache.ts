// Simple in-memory caches (process scoped)
const preciseCache = new Map<string, any>();
const inflight = new Map<string, Promise<any[]>>();

export function getFromCache(key: string) { return preciseCache.get(key); }
export function setCache(key: string, value: any) { preciseCache.set(key, value); }
export function hasCache(key: string) { return preciseCache.has(key); }

export function getInflight(key: string) { return inflight.get(key); }
export function setInflight(key: string, promise: Promise<any[]>) { inflight.set(key, promise); }
export function clearInflight(key: string) { inflight.delete(key); }
