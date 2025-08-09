import { NextResponse } from "next/server";
import { GoogleGenAI, MediaResolution } from "@google/genai";
import z from "zod";

// New precise transcription route with refined prompt, schema, and ms precision

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Request schema
const RequestSchema = z.object({
  videoUrl: z.string().url(),
  startSec: z.number().nonnegative().default(0),
  endSec: z.number().positive(),
  fps: z.number().positive().max(10).default(1),
  force: z.boolean().optional().default(false),
});

// Strict expected line schema (absolute seconds as string, no trailing 's')
const StrictLineSchema = z.object({
  start: z.string(),          // e.g. "0.126"
  end: z.string(),            // e.g. "2.046"
  transcription: z.string(),  // original text
  pinyin: z.string(),
  meaning: z.string(),
});

// Lenient schema to accept partial / slightly off outputs
const LooseLineSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  transcription: z.string().optional(),
  pinyin: z.string().optional(),
  meaning: z.string().optional(),
}).passthrough();
const LooseLinesArray = z.array(LooseLineSchema);

function extractVideoId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v") as string;
    return url.replace(/[^\w]/g, "").slice(0, 40);
  } catch {
    return url.replace(/[^\w]/g, "").slice(0, 40);
  }
}

function toOffsetString(v: number) { return `${v}s`; }

function parseTimeString(raw: string | undefined): number | null {
  if (!raw) return null;
  // Remove trailing 's', spaces, etc.
  const cleaned = raw.trim().replace(/s$/, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatTime(n: number): string {
  return n.toFixed(3); // second.millisecond precision
}

// Simple in-memory cache for this precise route
const preciseCache = new Map<string, any>();
const inflight = new Map<string, Promise<any[]>>();

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function generatePreciseOnce(params: { videoUrl: string; startSec: number; endSec: number; fps: number; }): Promise<any[]> {
  const { videoUrl, startSec, endSec, fps } = params;

  const prompt = `please provide transcription with pinyin and meaning with second.millisecond precise timestamp. Return ONLY a JSON array where each item has exactly these keys (all strings): start, end, transcription, pinyin, meaning. Example format:\n[\n  {\n    \"start\": \"0.126\",\n    \"end\": \"2.046\",\n    \"transcription\": \"小米首款AI眼鏡。\",\n    \"pinyin\": \"Xiǎomǐ shǒukuǎn AI yǎnjìng.\",\n    \"meaning\": \"Xiaomi's first AI glasses.\"\n  }\n]\nRules:\n- start and end are RELATIVE to this segment (segment start = ${startSec}s)\n- Use seconds with exactly 3 decimal places (e.g. 0.126)\n- JSON only. No commentary, markdown, code fences, or explanations.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: { mimeType: "video/mp4", fileUri: videoUrl },
            videoMetadata: {
              startOffset: toOffsetString(startSec),
              endOffset: toOffsetString(endSec),
              fps,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.array(StrictLineSchema),
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
    },
  });

  const raw = (response as any).text; // SDK convenience

  // --- Robust JSON extraction -------------------------------------------------
  function stripCodeFences(s: string) {
    return s
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/,'')
      .trim();
  }

  function safeParse(input: any): unknown {
    if (Array.isArray(input) || (input && typeof input === 'object')) return input;
    if (typeof input !== 'string') return input;
    let txt = input.trim();
    txt = stripCodeFences(txt);
    // If the whole string isn't valid JSON, try to extract the first top-level array substring
    try { return JSON.parse(txt); } catch {}
    const firstBracket = txt.indexOf('[');
    const lastBracket = txt.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const sub = txt.slice(firstBracket, lastBracket + 1);
      try { return JSON.parse(sub); } catch {}
    }
    // Try to fix common trailing commas
    try { return JSON.parse(txt.replace(/,\s*([}\]])/g,'$1')); } catch {}
    return input; // give up, caller will handle
  }

  function coerceToArray(val: unknown): any[] {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') {
      const obj = val as Record<string, any>;
      const candidateKeys = ['lines','result','results','data','items'];
      for (const k of candidateKeys) {
        if (Array.isArray(obj[k])) return obj[k];
      }
      // Fallback: take first array value
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) return v;
      }
    }
    if (typeof val === 'string') {
      const parsed = safeParse(val);
      return coerceToArray(parsed);
    }
    return [];
  }

  const json = safeParse(raw);
  let loose: any[] = coerceToArray(json);

  // As a last resort, if empty, attempt regex to capture objects with start/end
  if (!loose.length && typeof raw === 'string') {
    const objMatches = raw.match(/\{[^}]*start[^}]*end[^}]*}/g);
    if (objMatches) {
      loose = objMatches.map(m => {
        try { return JSON.parse(m); } catch { return {}; }
      });
    }
  }

  if (!Array.isArray(loose)) loose = [];
  // Validate each item against loose schema individually (skip invalid instead of throwing)
  loose = loose
    .map(item => {
      try { return LooseLineSchema.parse(item); } catch { return null; }
    })
    .filter(Boolean) as any[];
  // ---------------------------------------------------------------------------

  // Normalize & sanitize; convert relative -> absolute seconds
  const normalized = loose
    .filter(item => item && (item.start != null || item.end != null))
    .map(item => {
      const relStart = parseTimeString(String(item.start ?? '0')) ?? 0;
      const relEnd = parseTimeString(String(item.end ?? item.start ?? '0')) ?? relStart;
      const absStart = startSec + relStart;
      const absEnd = startSec + relEnd;
      const transcription = String(item.transcription ?? '').trim();
      const pinyin = String(item.pinyin ?? '').trim();
      const meaning = String(item.meaning ?? '').trim();
      return {
        start: formatTime(absStart),
        end: formatTime(absEnd),
        transcription,
        pinyin,
        meaning,
      };
    })
    .sort((a, b) => parseFloat(a.start) - parseFloat(b.start));

  // Validate against strict final schema
  // If model produced nothing usable, return empty array instead of throwing so client can continue combining chunks.
  try {
    return z.array(StrictLineSchema).parse(normalized);
  } catch (e) {
    console.warn('[precise-chunk] strict validation failed, returning best-effort array', e);
    return [];
  }
}

async function generatePrecise(params: { videoUrl: string; startSec: number; endSec: number; fps: number; }): Promise<any[]> {
  const { startSec, endSec } = params;
  const errors: any[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now();
    try {
      const lines = await generatePreciseOnce(params);
      if (lines.length > 0) {
        if (attempt > 1) console.info(`[precise-chunk] success after retry attempt ${attempt} for segment ${startSec}-${endSec}`);
        return lines;
      }
      // No lines, treat as transient failure and retry unless last attempt
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[precise-chunk] empty result attempt ${attempt}/${MAX_ATTEMPTS} for segment ${startSec}-${endSec}; retrying`);
        await sleep(BASE_BACKOFF_MS * attempt);
        continue;
      }
      return lines; // final empty
    } catch (e:any) {
      errors.push(e);
      const dur = Date.now() - t0;
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_BACKOFF_MS * attempt;
        console.warn(`[precise-chunk] attempt ${attempt}/${MAX_ATTEMPTS} failed (${dur}ms) for segment ${startSec}-${endSec}: ${e?.message || e}. Retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      console.error(`[precise-chunk] all ${MAX_ATTEMPTS} attempts failed for segment ${startSec}-${endSec}`, errors.map(er => er?.message || String(er)));
      throw e;
    }
  }
  return []; // unreachable
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { videoUrl, startSec, endSec, fps, force } = RequestSchema.parse(body);
    if (endSec <= startSec) {
      return NextResponse.json({ error: 'endSec must be greater than startSec' }, { status: 400 });
    }
    const videoId = extractVideoId(videoUrl);
    const cacheKey = `${videoId}:${startSec.toFixed(3)}-${endSec.toFixed(3)}:fps${fps}`;

    if (!force && preciseCache.has(cacheKey)) {
      return NextResponse.json({
        cached: true,
        videoId,
        startSec,
        endSec,
        lines: preciseCache.get(cacheKey),
      });
    }

    if (inflight.has(cacheKey)) {
      const lines = await inflight.get(cacheKey)!;
      return NextResponse.json({
        cached: !force,
        videoId,
        startSec,
        endSec,
        lines,
      });
    }

    const promise = generatePrecise({ videoUrl, startSec, endSec, fps });
    inflight.set(cacheKey, promise);
    let lines: any[];
    try {
      lines = await promise;
    } finally {
      inflight.delete(cacheKey);
    }
    preciseCache.set(cacheKey, lines);
    return NextResponse.json({
      cached: false,
      videoId,
      startSec,
      endSec,
      lines,
    });
  } catch (err: any) {
    console.error('[precise-chunk] error', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

// Optional lightweight GET to inspect cache
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('videoUrl');
  const startStr = searchParams.get('startSec');
  const endStr = searchParams.get('endSec');
  const fpsStr = searchParams.get('fps') || '1';
  if (!videoUrl || !startStr || !endStr) {
    return NextResponse.json({ error: 'videoUrl, startSec, endSec required' }, { status: 400 });
  }
  const startSec = Number(startStr);
  const endSec = Number(endStr);
  const fps = Number(fpsStr);
  const videoId = extractVideoId(videoUrl);
  const cacheKey = `${videoId}:${startSec.toFixed(3)}-${endSec.toFixed(3)}:fps${fps}`;
  if (preciseCache.has(cacheKey)) {
    return NextResponse.json({ cached: true, videoId, startSec, endSec, lines: preciseCache.get(cacheKey) });
  }
  return NextResponse.json({ cached: false, videoId, startSec, endSec });
}
