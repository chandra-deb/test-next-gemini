import { NextResponse } from "next/server";
import { GoogleGenAI, MediaResolution } from "@google/genai";
import z from "zod";

// In-memory cache (replace with persistent DB in production)
// Key: `${videoId}:${chunkIndex}` -> cached transcript lines
const chunkCache = new Map<string, any>();
// Simple in-flight lock to avoid duplicate concurrent generation
const inflight = new Map<string, Promise<any>>();

const CHUNK_SECONDS = 60; // 1 minute chunks

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Schema for incoming request body
const RequestSchema = z.object({
  videoUrl: z.string().url(),
  durationSec: z.number().positive(),
  chunkIndex: z.number().int().nonnegative(),
  fps: z.number().positive().max(10).optional().default(1),
  force: z.boolean().optional().default(false),
});

// Strict schema we ultimately want to return
const FinalLineSchema = z.object({
  start: z.string(),
  end: z.string(),
  pinyin: z.string(),
  meaning: z.string(),
});

// Lenient schema for whatever the model actually returns (sometimes omits fields)
const LooseLineSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  pinyin: z.string().optional(),
  meaning: z.string().optional(),
}).passthrough();
const LooseLinesArray = z.array(LooseLineSchema);

function extractYoutubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1);
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v") as string;
    // Fallback remove non word chars
    return url.replace(/[^\w]/g, "").slice(0, 32);
  } catch {
    return url.replace(/[^\w]/g, "").slice(0, 32);
  }
}

function toSecString(v: number) { return `${v}s`; }

function parseSecString(s: string): number {
  const n = parseFloat(s.replace(/s$/, ""));
  return Number.isFinite(n) ? n : 0;
}

async function generateChunk(params: { videoUrl: string; startSec: number; endSec: number; fps: number; }): Promise<any[]> {
  const { videoUrl, startSec, endSec, fps } = params;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: { mimeType: "video/mp4", fileUri: videoUrl },
            videoMetadata: {
              startOffset: toSecString(startSec),
              endOffset: toSecString(endSec),
              fps,
            },
          },
          { text: "provide transcription with pinyin and meaning in english" },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      // Keep original intended schema to guide model (strict form)
      responseJsonSchema: z.array(z.object({
                    start: z.string(),
                    end: z.string(),
                    pinyin: z.string(),
                    meaning: z.string(),
                  })),
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
    },
  });

  // SDK .text property (mirroring existing usage in other route)
  const raw = (response as any).text;
  console.log(raw)
  let json: unknown;
  try {
    json = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error("Failed to parse model JSON response");
  }
  // Try strict first, fall back to loose
  let looseParsed: any[] = [];
  try {
    looseParsed = LooseLinesArray.parse(json);
  } catch (e) {
    // If it's not even an array, attempt to coerce from other shapes
    if (Array.isArray(json)) {
      looseParsed = json as any[]; // will fail below if unusable
    } else if (typeof json === 'object' && json) {
      looseParsed = Object.values(json as Record<string, any>);
    } else {
      throw new Error('Model response not an array of lines');
    }
  }

  // Sanitize & normalize
  const cleaned = looseParsed
    .filter(l => l && (l.start != null || l.end != null))
    .map(l => {
      const relStart = parseSecString(String(l.start ?? '0s'));
      const relEnd = parseSecString(String(l.end ?? String(l.start ?? '0s')));
      const pinyin = typeof l.pinyin === 'string' ? l.pinyin : '';
      const meaning = typeof l.meaning === 'string' ? l.meaning : '';
      return {
        start: `${(startSec + relStart).toFixed(2)}s`,
        end: `${(startSec + relEnd).toFixed(2)}s`,
        pinyin,
        meaning,
      };
    })
    // Ensure chronological order within chunk
    .sort((a, b) => parseFloat(a.start) - parseFloat(b.start));

  // Validate final strict shape (will throw if something is still off)
  return z.array(FinalLineSchema).parse(cleaned);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { videoUrl, durationSec, chunkIndex, fps, force } = RequestSchema.parse(body);

    const videoId = extractYoutubeId(videoUrl);
    const startSec = chunkIndex * CHUNK_SECONDS;
    if (startSec >= durationSec) {
      return NextResponse.json({ error: "chunkIndex out of range" }, { status: 400 });
    }
    const endSec = Math.min(startSec + CHUNK_SECONDS, durationSec);

    const cacheKey = `${videoId}:${chunkIndex}`;

    if (!force && chunkCache.has(cacheKey)) {
      return NextResponse.json({
        cached: true,
        videoId,
        chunkIndex,
        startSec,
        endSec,
        lines: chunkCache.get(cacheKey),
      });
    }

    if (inflight.has(cacheKey)) {
      const lines = await inflight.get(cacheKey)!;
      return NextResponse.json({
        cached: !force,
        videoId,
        chunkIndex,
        startSec,
        endSec,
        lines,
      });
    }

    const promise = generateChunk({ videoUrl, startSec, endSec, fps });
    inflight.set(cacheKey, promise);
    let lines: any[];
    try {
      lines = await promise;
    } finally {
      inflight.delete(cacheKey);
    }
    chunkCache.set(cacheKey, lines);

    return NextResponse.json({
      cached: false,
      videoId,
      chunkIndex,
      startSec,
      endSec,
      lines,
    });
  } catch (err: any) {
    console.error("Chunk transcription error", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

// Optional: simple GET to query if a chunk cached without triggering generation
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('videoUrl');
  const chunkIndexStr = searchParams.get('chunkIndex');
  const durationStr = searchParams.get('durationSec');
  if (!videoUrl || !chunkIndexStr || !durationStr) {
    return NextResponse.json({ error: 'videoUrl, chunkIndex, durationSec required' }, { status: 400 });
  }
  const chunkIndex = Number(chunkIndexStr);
  const videoId = extractYoutubeId(videoUrl);
  const cacheKey = `${videoId}:${chunkIndex}`;
  if (chunkCache.has(cacheKey)) {
    return NextResponse.json({
      cached: true,
      videoId,
      chunkIndex,
      lines: chunkCache.get(cacheKey),
    });
  }
  return NextResponse.json({ cached: false, videoId, chunkIndex });
}
