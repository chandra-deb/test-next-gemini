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

async function generatePrecise(params: { videoUrl: string; startSec: number; endSec: number; fps: number; }): Promise<any[]> {
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
  let json: unknown;
  try {
    json = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error('Model returned non-JSON content');
  }

  let loose: any[] = [];
  try {
    loose = LooseLinesArray.parse(json);
  } catch (e) {
    if (Array.isArray(json)) loose = json as any[]; else throw new Error('Response not an array');
  }

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
  return z.array(StrictLineSchema).parse(normalized);
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
