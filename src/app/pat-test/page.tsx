'use client';

import React, { useState } from 'react';

interface PatResponseSuccess {
  data?: any;
  raw?: string;
  result?: string; // in case original version
  error?: undefined;
}
interface PatResponseError {
  error: string;
  issues?: any;
  raw?: string;
}

type PatResponse = PatResponseSuccess | PatResponseError;

export default function PatTestPage() {
  const [videoUrl, setVideoUrl] = useState('https://storage.googleapis.com/generativeai-downloads/data/SampleVideo_1280x720_1mb.mp4');
  const [prompt, setPrompt] = useState('Identify objects and actions.');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState<number | ''>(8);
  const [fps, setFps] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<PatResponse | null>(null);
  const [mode, setMode] = useState<'json' | 'pretty'>('pretty');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResp(null);
    try {
      const body: Record<string, any> = { videoUrl, prompt, startSec, fps };
      if (endSec !== '') body.endSec = endSec;
      const r = await fetch('/api/pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      setResp(json);
    } catch (err: any) {
      setResp({ error: err.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">/api/pat Test</h1>
      <form onSubmit={submit} className="space-y-4 bg-zinc-100 dark:bg-zinc-900 p-4 rounded">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Video URL</label>
          <input
            className="p-2 rounded border bg-white dark:bg-zinc-800"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">Prompt</label>
          <textarea
            className="p-2 rounded border bg-white dark:bg-zinc-800"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Start (s)</label>
            <input
              type="number"
              min={0}
              className="p-2 rounded border bg-white dark:bg-zinc-800"
              value={startSec}
              onChange={(e) => setStartSec(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">End (s, blank = none)</label>
            <input
              type="number"
              min={0}
              className="p-2 rounded border bg-white dark:bg-zinc-800"
              value={endSec}
              onChange={(e) => {
                const v = e.target.value;
                setEndSec(v === '' ? '' : Number(v));
              }}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">FPS</label>
            <input
              type="number"
              min={1}
              max={120}
              className="p-2 rounded border bg-white dark:bg-zinc-800"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : 'Send'}
          </button>
          {resp && (
            <button
              type="button"
              onClick={() => setMode(mode === 'pretty' ? 'json' : 'pretty')}
              className="text-sm underline"
            >
              View: {mode === 'pretty' ? 'Raw JSON' : 'Pretty'}
            </button>
          )}
        </div>
      </form>

      {resp && (
        <div className="space-y-2">
          {'error' in resp ? (
            <div className="p-4 border border-red-400 text-red-600 rounded bg-red-50 dark:bg-red-950">
              <strong>Error:</strong> {resp.error}
            </div>
          ) : mode === 'json' ? (
            <pre className="p-4 bg-black text-green-300 overflow-auto text-sm rounded max-h-96">
{JSON.stringify(resp, null, 2)}
            </pre>
          ) : (
            <div className="p-4 border rounded bg-white dark:bg-zinc-800 space-y-4">
              {resp.data && (
                <div>
                  <h2 className="font-medium mb-1">Summary</h2>
                  <p className="text-sm leading-relaxed">{resp.data.summary || '(no summary)'}</p>
                </div>
              )}
              {resp.data?.objects && Array.isArray(resp.data.objects) && resp.data.objects.length > 0 && (
                <div>
                  <h2 className="font-medium mb-1">Objects</h2>
                  <ul className="list-disc ml-5 text-sm space-y-0.5">
                    {resp.data.objects.map((o: string, i: number) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {resp.data?.events && Array.isArray(resp.data.events) && resp.data.events.length > 0 && (
                <div>
                  <h2 className="font-medium mb-1">Events</h2>
                  <ul className="list-disc ml-5 text-sm space-y-1">
                    {resp.data.events.map((ev: any, i: number) => (
                      <li key={i}>
                        <span className="font-medium">{ev.label}</span>{' '}
                        {typeof ev.startSec === 'number' && (
                          <span className="text-xs text-zinc-500">[{ev.startSec}s–{ev.endSec ?? ev.startSec}s]</span>
                        )}
                        {typeof ev.confidence === 'number' && (
                          <span className="ml-2 text-xs text-zinc-400">conf: {(ev.confidence * 100).toFixed(1)}%</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!resp.data && resp.result && (
                <div>
                  <h2 className="font-medium mb-1">Result Text</h2>
                  <p className="text-sm whitespace-pre-wrap">{resp.result}</p>
                </div>
              )}
              {resp.raw && (
                <details className="text-xs">
                  <summary className="cursor-pointer select-none">Raw</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">{resp.raw}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
