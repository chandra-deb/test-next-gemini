'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ChunkResponse {
  cached: boolean;
  videoId: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  lines: TranscriptLine[];
  error?: string;
}
interface TranscriptLine {
  start: string; // e.g. "12.34s"
  end: string;
  pinyin: string;
  meaning: string;
}

interface ChunkStateEntry {
  index: number;
  status: 'idle' | 'pending' | 'done' | 'error';
  cached?: boolean;
  error?: string;
  startSec: number;
  endSec: number;
  lineCount?: number;
  durationSec?: number;
}

export default function ChunkTranscriptionPage() {
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=kE3335DxlEw');
  const [durationSec, setDurationSec] = useState<number>(180); // initial fallback
  const [autoDetected, setAutoDetected] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [fps, setFps] = useState(1);
  const [concurrency, setConcurrency] = useState(2);
  const [force, setForce] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [running, setRunning] = useState(false);
  const [aborted, setAborted] = useState(false);
  const abortRef = useRef<boolean>(false);

  const totalChunks = useMemo(() => Math.ceil(durationSec / 60), [durationSec]);
  const [chunkStates, setChunkStates] = useState<ChunkStateEntry[]>(() => Array.from({ length: totalChunks }, (_, i) => ({
    index: i,
    status: 'idle',
    startSec: i * 60,
    endSec: Math.min(i * 60 + 60, durationSec),
  })));

  // Reinitialize chunk states if duration changes
  useEffect(() => {
    setChunkStates(Array.from({ length: totalChunks }, (_, i) => ({
      index: i,
      status: 'idle',
      startSec: i * 60,
      endSec: Math.min(i * 60 + 60, durationSec),
    })));
    setAutoDetected(false); // user changed duration manually or state updated
  }, [totalChunks, durationSec]);

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => parseFloat(a.start) - parseFloat(b.start));
  }, [lines]);

  const overallProgress = useMemo(() => {
    const done = chunkStates.filter(c => c.status === 'done').length;
    return (done / totalChunks) * 100;
  }, [chunkStates, totalChunks]);

  const updateChunkState = useCallback((index: number, patch: Partial<ChunkStateEntry>) => {
    setChunkStates(prev => prev.map(cs => cs.index === index ? { ...cs, ...patch } : cs));
  }, []);

  async function fetchChunk(index: number) {
    const c = chunkStates.find(x => x.index === index);
    if (!c || c.status === 'pending') return;
    updateChunkState(index, { status: 'pending', error: undefined });
    try {
      const res = await fetch('/api/pat/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, durationSec, chunkIndex: index, fps, force }),
      });
      const json: ChunkResponse | { error: string } = await res.json();
      if (!res.ok || 'error' in json) {
        updateChunkState(index, { status: 'error', error: (json as any).error || `HTTP ${res.status}` });
        return;
      }
      const { lines: newLines, cached } = json as ChunkResponse;
      setLines(prev => {
        // Avoid duplicating same start times if re-fetching
        const existingKeys = new Set(prev.map(l => `${l.start}|${l.end}|${l.pinyin}`));
        const filtered = newLines.filter(l => !existingKeys.has(`${l.start}|${l.end}|${l.pinyin}`));
        return [...prev, ...filtered];
      });
      updateChunkState(index, { status: 'done', cached, lineCount: (json as ChunkResponse).lines.length, durationSec: c.endSec - c.startSec });
    } catch (e: any) {
      updateChunkState(index, { status: 'error', error: e.message });
    }
  }

  const runAll = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setAborted(false);
    abortRef.current = false;
    setLines([]);
    setChunkStates(prev => prev.map(c => ({ ...c, status: 'idle', error: undefined, lineCount: undefined })));

    const queue = [...Array(totalChunks).keys()];
    let active = 0;
    let ptr = 0;

    return new Promise<void>((resolve) => {
      const launch = () => {
        if (abortRef.current) {
          setRunning(false);
          setAborted(true);
          resolve();
          return;
        }
        if (ptr >= queue.length && active === 0) {
          setRunning(false);
          resolve();
          return;
        }
        while (active < concurrency && ptr < queue.length) {
          const idx = queue[ptr++];
          active++;
          fetchChunk(idx).finally(() => {
            active--;
            launch();
          });
        }
      };
      launch();
    });
  }, [running, totalChunks, concurrency, videoUrl, durationSec, fps, force]);

  const abortAll = () => {
    abortRef.current = true;
  };

  // Optional auto-run when toggled
  useEffect(() => {
    if (autoRun) {
      runAll();
    }
  }, [autoRun, runAll]);

  function reset() {
    setLines([]);
    setChunkStates(Array.from({ length: totalChunks }, (_, i) => ({
      index: i,
      status: 'idle',
      startSec: i * 60,
      endSec: Math.min(i * 60 + 60, durationSec),
    })));
  }

  // ---------------- Duration Auto-Detect -----------------
  const youtubeId = useMemo(() => {
    try {
      const u = new URL(videoUrl);
      if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') || undefined;
      return undefined;
    } catch {
      return undefined;
    }
  }, [videoUrl]);

  // Lazy load YT iframe API if needed
  useEffect(() => {
    if (!youtubeId) return;
    if (typeof window === 'undefined') return;
    if ((window as any).YT?.Player) return;
    if (document.getElementById('yt-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, [youtubeId]);

  const detectDuration = useCallback(async () => {
    setDetecting(true);
    setAutoDetected(false);
    try {
      if (youtubeId) {
        // Wait for API
        await new Promise<void>((resolve, reject) => {
          let tries = 0;
          const maxTries = 60;
          const tick = () => {
            tries++;
            if ((window as any).YT?.Player) return resolve();
            if (tries > maxTries) return reject(new Error('YT API timeout'));
            setTimeout(tick, 100);
          };
          tick();
        });
        const containerId = 'yt-hidden-player';
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div');
          container.id = containerId;
          container.style.display = 'none';
          document.body.appendChild(container);
        }
        await new Promise<void>((resolve, reject) => {
          const player = new (window as any).YT.Player(containerId, {
            height: '0', width: '0', videoId: youtubeId,
            events: {
              onReady: () => {
                try {
                  const d = player.getDuration();
                  if (d && Number.isFinite(d)) {
                    setDurationSec(Math.ceil(d));
                    setAutoDetected(true);
                  }
                  resolve();
                } catch (e) { reject(e); }
              },
              onError: () => reject(new Error('YouTube error')),
            }
          });
        });
        return;
      }
      // Fallback for direct media: hidden video element
      await new Promise<void>((resolve, reject) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.src = videoUrl;
        v.style.display = 'none';
        const cleanup = () => v.remove();
        v.onloadedmetadata = () => {
          if (v.duration && Number.isFinite(v.duration)) {
            setDurationSec(Math.ceil(v.duration));
            setAutoDetected(true);
          }
          cleanup();
          resolve();
        };
        v.onerror = () => { cleanup(); reject(new Error('Metadata load failed')); };
        document.body.appendChild(v);
      });
    } catch (e) {
      console.warn('Duration detection failed', e);
    } finally {
      setDetecting(false);
    }
  }, [videoUrl, youtubeId]);

  // Auto-detect when switching to a YouTube URL
  useEffect(() => {
    if (youtubeId) detectDuration();
  }, [youtubeId, detectDuration]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Chunked Transcription Tester</h1>
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAll();
          }}
          className="space-y-4 bg-zinc-100 dark:bg-zinc-900 p-4 rounded"
        >
          <div className="grid gap-1">
            <label className="text-sm font-medium">Video URL</label>
            <input
              className="p-2 rounded border bg-white dark:bg-zinc-800 text-sm"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Duration (s)</label>
            <input
              type="number"
              min={1}
              className="p-2 rounded border bg-white dark:bg-zinc-800 text-sm"
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
            />
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => detectDuration()}
                disabled={detecting}
                className="px-2 py-1 rounded bg-purple-600 text-white text-xs disabled:opacity-50"
              >{detecting ? 'Detecting…' : 'Detect Duration'}</button>
              {youtubeId && (<span className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white">YouTube</span>)}
              {autoDetected && !detecting && (<span className="text-[10px] text-green-600">auto-detected</span>)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <label className="text-sm font-medium">FPS</label>
              <input
                type="number"
                min={1}
                max={10}
                className="p-2 rounded border bg-white dark:bg-zinc-800 text-sm"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Concurrency</label>
              <input
                type="number"
                min={1}
                max={8}
                className="p-2 rounded border bg-white dark:bg-zinc-800 text-sm"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                id="force"
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              <label htmlFor="force" className="text-sm">Force</label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={running}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              {running ? 'Running…' : 'Run All'}
            </button>
            <button
              type="button"
              onClick={abortAll}
              disabled={!running}
              className="px-3 py-2 rounded bg-orange-600 text-white text-sm disabled:opacity-50"
            >
              Abort
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={running}
              className="px-3 py-2 rounded bg-zinc-700 text-white text-sm disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setAutoRun(a => !a)}
              className={`px-3 py-2 rounded text-sm ${autoRun ? 'bg-green-600 text-white' : 'bg-zinc-500 text-white'}`}
            >
              Auto {autoRun ? 'On' : 'Off'}
            </button>
          </div>
          <div className="w-full h-2 rounded bg-zinc-300 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${overallProgress.toFixed(1)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">Progress: {overallProgress.toFixed(1)}%</p>
        </form>

        <div className="md:col-span-2 space-y-6">
          <div>
            <h2 className="font-medium mb-2">Chunks ({totalChunks})</h2>
            <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
              {chunkStates.map(c => (
                <div key={c.index} className={`border rounded p-2 space-y-1 ${c.status === 'error' ? 'border-red-500' : c.status === 'done' ? 'border-green-600' : 'border-zinc-400'}`}>
                  <div className="flex justify-between">
                    <span className="font-semibold">#{c.index}</span>
                    <span className="uppercase tracking-wide text-[10px]">{c.status}</span>
                  </div>
                  <div>{c.startSec}s–{c.endSec}s</div>
                  {c.cached && <div className="text-green-500">cached</div>}
                  {c.lineCount != null && <div>{c.lineCount} lines</div>}
                  {c.error && <div className="text-red-500 truncate" title={c.error}>{c.error}</div>}
                  <div className="flex gap-1 flex-wrap pt-1">
                    <button
                      type="button"
                      disabled={c.status === 'pending' || running}
                      onClick={() => fetchChunk(c.index)}
                      className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-40"
                    >Go</button>
                    <button
                      type="button"
                      disabled={c.status === 'pending' || running}
                      onClick={() => { setForce(true); fetchChunk(c.index); }}
                      className="px-2 py-1 bg-zinc-700 text-white rounded disabled:opacity-40"
                    >Force</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-medium mb-2">Merged Transcript ({sortedLines.length} lines)</h2>
            <div className="border rounded max-h-[420px] overflow-auto text-xs leading-relaxed bg-white dark:bg-zinc-800">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-zinc-200 dark:bg-zinc-700">
                  <tr>
                    <th className="px-2 py-1">Start</th>
                    <th className="px-2 py-1">End</th>
                    <th className="px-2 py-1">Pinyin</th>
                    <th className="px-2 py-1">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map((l, i) => (
                    <tr key={i} className="odd:bg-zinc-50 dark:odd:bg-zinc-900">
                      <td className="px-2 py-1 whitespace-nowrap font-mono">{l.start}</td>
                      <td className="px-2 py-1 whitespace-nowrap font-mono">{l.end}</td>
                      <td className="px-2 py-1">{l.pinyin}</td>
                      <td className="px-2 py-1">{l.meaning}</td>
                    </tr>
                  ))}
                  {sortedLines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-zinc-500">No lines yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sortedLines.length > 0 && (
              <div className="pt-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(sortedLines, null, 2))}
                  className="px-3 py-1 rounded bg-green-600 text-white text-xs"
                >Copy JSON</button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(sortedLines.map(l => `${l.start} ${l.pinyin} — ${l.meaning}`).join('\n'))}
                  className="px-3 py-1 rounded bg-blue-700 text-white text-xs"
                >Copy Text</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {aborted && <p className="text-sm text-orange-600">Aborted by user.</p>}
    </div>
  );
}
