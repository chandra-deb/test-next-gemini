// Simple IndexedDB wrapper for caching subtitles by YouTube videoId + fps + chunkSeconds
// Avoids extra dependency; uses native IndexedDB APIs.
import { SubtitleItem } from "@/components/player/types";

const DB_NAME = "subtitleCacheDB";
const DB_VERSION = 1;
const STORE = "subtitles";

interface CacheKeyParts {
  videoId: string;
  fps: number;
  chunkSeconds: number;
}

export interface CachedSubtitlesRecord extends CacheKeyParts {
  id: string; // compound key string
  subtitles: SubtitleItem[];
  updatedAt: number; // epoch ms
}

function makeId({ videoId, fps, chunkSeconds }: CacheKeyParts) {
  return `${videoId}::fps=${fps}::chunk=${chunkSeconds}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not available in this environment"));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("Failed to open DB"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getCachedSubtitles(parts: CacheKeyParts): Promise<SubtitleItem[] | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(makeId(parts));
      req.onerror = () => reject(req.error || new Error("get error"));
      req.onsuccess = () => {
        const rec = req.result as CachedSubtitlesRecord | undefined;
        resolve(rec ? rec.subtitles : null);
      };
    });
  } catch (e) {
    console.warn("Subtitle cache get failed", e);
    return null;
  }
}

export async function putCachedSubtitles(parts: CacheKeyParts, subtitles: SubtitleItem[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("tx error"));
      const store = tx.objectStore(STORE);
      const rec: CachedSubtitlesRecord = {
        id: makeId(parts),
        subtitles,
        updatedAt: Date.now(),
        ...parts,
      };
      store.put(rec);
    });
  } catch (e) {
    console.warn("Subtitle cache put failed", e);
  }
}

export function parseYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  // If it looks like a plain 11-char YouTube ID, return directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  try {
    const url = new URL(urlOrId);
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      // Short form maybe /embed/<id>
      const parts = url.pathname.split('/');
      const maybe = parts.filter(Boolean).pop();
      if (maybe && /^[a-zA-Z0-9_-]{11}$/.test(maybe)) return maybe;
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace('/', '');
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // not a valid URL: ignore
  }
  return null;
}
