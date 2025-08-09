import { NextResponse } from 'next/server';
import { RequestSchema } from './_lib/schemas';
import { extractVideoId } from './_lib/video';
import { generatePrecise } from './_lib/model';
import { getFromCache, hasCache, setCache, getInflight, setInflight, clearInflight } from './_lib/cache';

// Precise chunk route orchestrator (refactored)
// - Validates request
// - Checks in-memory cache & inflight map
// - Delegates generation to _lib/model
// - Returns consistent JSON shape

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { videoUrl, startSec, endSec, fps, force } = RequestSchema.parse(body);
    if (endSec <= startSec) {
      return NextResponse.json({ error: 'endSec must be greater than startSec' }, { status: 400 });
    }
    const videoId = extractVideoId(videoUrl);
    const cacheKey = `${videoId}:${startSec.toFixed(3)}-${endSec.toFixed(3)}:fps${fps}`;

    if (!force && hasCache(cacheKey)) {
      return NextResponse.json({ cached: true, videoId, startSec, endSec, lines: getFromCache(cacheKey) });
    }

    const existing = getInflight(cacheKey);
    if (existing) {
      const lines = await existing;
      return NextResponse.json({ cached: !force, videoId, startSec, endSec, lines });
    }

    const promise = generatePrecise({ videoUrl, startSec, endSec, fps });
    setInflight(cacheKey, promise);
    let lines: any[] = [];
    try {
      lines = await promise;
    } finally {
      clearInflight(cacheKey);
    }
    setCache(cacheKey, lines);
    return NextResponse.json({ cached: false, videoId, startSec, endSec, lines });
  } catch (err: any) {
    console.error('[precise-chunk] error', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

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
  if (hasCache(cacheKey)) {
    return NextResponse.json({ cached: true, videoId, startSec, endSec, lines: getFromCache(cacheKey) });
  }
  return NextResponse.json({ cached: false, videoId, startSec, endSec });
}
