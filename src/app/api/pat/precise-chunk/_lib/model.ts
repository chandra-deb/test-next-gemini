import { GoogleGenAI, MediaResolution } from '@google/genai';
import { StrictLineSchema, LooseLineSchema } from './schemas';
import { toOffsetString, parseTimeString, formatTime } from './time';
import z from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function buildPrompt(startSec: number) {
  return `please provide transcription with pinyin and meaning with second.millisecond precise timestamp. Return ONLY a JSON array where each item has exactly these keys (all strings): start, end, transcription, pinyin, meaning. Example format:\n[\n  {\n    "start": "0.126",\n    "end": "2.046",\n    "transcription": "小米首款AI眼鏡。",\n    "pinyin": "Xiǎomǐ shǒukuǎn AI yǎnjìng.",\n    "meaning": "Xiaomi's first AI glasses."\n  }\n]\nRules:\n- start and end are RELATIVE to this segment (segment start = ${startSec}s)\n- Use seconds with exactly 3 decimal places (e.g. 0.126)\n- JSON only. No commentary, markdown, code fences, or explanations. Important: And Every Transcription must be a full sentence.`;
}

function robustParse(raw: any) {
  function stripCodeFences(s: string) {
    return s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  function safeParse(input: any): unknown {
    if (Array.isArray(input) || (input && typeof input === 'object')) return input;
    if (typeof input !== 'string') return input;
    let txt = stripCodeFences(input.trim());
    try { return JSON.parse(txt); } catch {}
    const firstBracket = txt.indexOf('[');
    const lastBracket = txt.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const sub = txt.slice(firstBracket, lastBracket + 1);
      try { return JSON.parse(sub); } catch {}
    }
    try { return JSON.parse(txt.replace(/,\s*([}\]])/g,'$1')); } catch {}
    return input;
  }
  function coerceToArray(val: unknown): any[] {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') {
      const obj = val as Record<string, any>;
      for (const k of ['lines','result','results','data','items']) {
        if (Array.isArray(obj[k])) return obj[k];
      }
      for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
    }
    if (typeof val === 'string') return coerceToArray(safeParse(val));
    return [];
  }
  const json = safeParse(raw);
  let loose: any[] = coerceToArray(json);
  if (!loose.length && typeof raw === 'string') {
    const objMatches = raw.match(/\{[^}]*start[^}]*end[^}]*}/g);
    if (objMatches) loose = objMatches.map(m => { try { return JSON.parse(m); } catch { return {}; } });
  }
  loose = loose.map(item => { try { return LooseLineSchema.parse(item); } catch { return null; } }).filter(Boolean) as any[];
  return loose;
}

async function generateOnce(params: { videoUrl: string; startSec: number; endSec: number; fps: number; }) {
  const { videoUrl, startSec, endSec, fps } = params;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { mimeType: 'video/mp4', fileUri: videoUrl }, videoMetadata: { startOffset: toOffsetString(startSec), endOffset: toOffsetString(endSec), fps } },
          { text: buildPrompt(startSec) },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: z.array(StrictLineSchema),
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
    },
  });
  const raw = (response as any).text;
  const loose = robustParse(raw);
  const normalized = loose
    .filter(item => item && (item.start != null || item.end != null))
    .map(item => {
      const relStart = parseTimeString(String(item.start ?? '0')) ?? 0;
      const relEnd = parseTimeString(String(item.end ?? item.start ?? '0')) ?? relStart;
      const absStart = startSec + relStart;
      const absEnd = startSec + relEnd;
      return {
        start: formatTime(absStart),
        end: formatTime(absEnd),
        transcription: String(item.transcription ?? '').trim(),
        pinyin: String(item.pinyin ?? '').trim(),
        meaning: String(item.meaning ?? '').trim(),
      };
    })
    .sort((a, b) => parseFloat(a.start) - parseFloat(b.start));
  try { return z.array(StrictLineSchema).parse(normalized); } catch { return []; }
}

export async function generatePrecise(params: { videoUrl: string; startSec: number; endSec: number; fps: number; }) {
  const { startSec, endSec } = params;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const lines = await generateOnce(params);
      if (lines.length > 0) {
        if (attempt > 1) console.info(`[precise-chunk] success after attempt ${attempt} for segment ${startSec}-${endSec}`);
        return lines;
      }
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[precise-chunk] empty result attempt ${attempt} for segment ${startSec}-${endSec}`);
        await sleep(BASE_BACKOFF_MS * attempt);
      } else {
        return lines;
      }
    } catch (e: any) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[precise-chunk] error attempt ${attempt} for segment ${startSec}-${endSec}: ${e?.message}`);
        await sleep(BASE_BACKOFF_MS * attempt);
      } else {
        throw e;
      }
    }
  }
  return [];
}
