"use client";
import React, { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlayerVideo } from "@/components/player/PlayerVideo";
import { PlayerControls } from "@/components/player/PlayerControls";
import { SubtitleList } from "@/components/player/SubtitleList";
import { CurrentSubtitle } from "@/components/player/CurrentSubtitle";
import { sampleSubtitles } from "@/components/player/sampleSubtitles";
import { SubtitleItem } from "@/components/player/types";
import { formatTime } from "@/app/utils/formatTime";
import { getCachedSubtitles, putCachedSubtitles, parseYouTubeId } from "@/app/utils/subtitleCache";
import { CacheDebug, CacheStatus } from "@/components/player/CacheDebug";
import type { YouTubePlayer, YouTubeProps } from "react-youtube";
import { REPLAY_PREROLL_SECONDS, REPLAY_RESET_BUFFER_SECONDS } from "@/config/replayConfig";

const opts: YouTubeProps["opts"] = {
  height: "480",
  width: "854",
  playerVars: {
    autoplay: 1,
    rel: 0,
    start: 10,
    loop: 1,
  },
};

const Player = () => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>(sampleSubtitles);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("https://www.youtube.com/watch?v=TAb2-hUsb7Q");
  const [fps, setFps] = useState<number>(1);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>("idle");
  const showCacheDebug = process.env.NEXT_PUBLIC_SHOW_CACHE_DEBUG === '1';
  const [videoId, setVideoId] = useState<string>(() => parseYouTubeId(videoUrl) || "TAb2-hUsb7Q");
  const [urlInput, setUrlInput] = useState<string>(videoUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [firstChunkPending, setFirstChunkPending] = useState(false);
  const [firstChunkStart, setFirstChunkStart] = useState<number | null>(null);
  const [showFirstChunkPrompt, setShowFirstChunkPrompt] = useState(false);
  const [chunksReceived, setChunksReceived] = useState(0);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showMeaning, setShowMeaning] = useState(true);
  const [showToneColors, setShowToneColors] = useState(true);
  const [lockedSubtitle, setLockedSubtitle] = useState<SubtitleItem | null>(null);
  // Loop control: prevents immediate re-seek on initial lock
  const loopArmedRef = useRef<boolean>(false);
  const prevTimeRef = useRef<number>(0); // track previous time to detect forward crossing
  const firstLoopRef = useRef<boolean>(true); // first iteration uses preroll, later ones not
  const startedRef = useRef<boolean>(false);
  // Replay management refs
  const replayResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replaySessionRef = useRef<number>(0);

  // Update derived videoId when urlInput changes (debounced via useEffect timing minimal)
  useEffect(() => {
    const id = parseYouTubeId(urlInput.trim());
    if (id) {
      setVideoId(id);
      setVideoUrl(urlInput.trim());
      setUrlError(null);
  // Mark transcription not started for new video id
  startedRef.current = false;
    } else {
      setUrlError(urlInput ? 'Invalid YouTube URL or ID' : null);
    }
  }, [urlInput]);

  async function handleDuration(dur: Promise<number>) {
    const duration = await dur;
    setDuration(duration);
  }

  const onPlayerReady = (player: YouTubePlayer) => {
    playerRef.current = player;
    handleDuration(player.getDuration());
  };

  const seekTo = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
    }
  };

  const replayLine = (subtitle: SubtitleItem, rate: number = 1) => {
    if (!playerRef.current) return;
    // If user replays another line manually while one is locked, unlock existing
    if (lockedSubtitle && (lockedSubtitle.startTime !== subtitle.startTime || lockedSubtitle.endTime !== subtitle.endTime)) {
      setLockedSubtitle(null);
    }
    // Increment session so prior scheduled resets won't apply
    replaySessionRef.current += 1;
    const sessionId = replaySessionRef.current;
    // Clear any previous pending reset
    if (replayResetTimerRef.current) {
      clearTimeout(replayResetTimerRef.current);
      replayResetTimerRef.current = null;
    }
    try {
      playerRef.current.setPlaybackRate(rate);
    } catch {}
    // Seek slightly before start for context
  const preroll = REPLAY_PREROLL_SECONDS;
    seekTo(Math.max(0, subtitle.startTime - preroll));
    playerRef.current.playVideo();
    if (rate !== 1) {
  // Compute how long real time playback will take at the slower rate.
  // The video clock advances 'rate' seconds of media per 1 real second.
  // So to cover (preroll + lineDuration) seconds of media at speed 'rate'
  // we need (preroll + lineDuration)/rate real seconds.
  // Then add a small buffer to avoid premature reset.
  const lineDuration = subtitle.endTime - subtitle.startTime;
  const buffer = REPLAY_RESET_BUFFER_SECONDS; // extra safety
  const realPlaybackSeconds = (preroll + lineDuration) / rate + buffer;
  const resetDelay = realPlaybackSeconds * 1000;
      replayResetTimerRef.current = setTimeout(() => {
        if (!playerRef.current) return;
        // Guard: only act if session still current
        if (replaySessionRef.current !== sessionId) return;
        try {
          const currentRate: any = (playerRef.current as any).getPlaybackRate();
            if (Number(currentRate) === rate) {
              playerRef.current.setPlaybackRate(1);
            }
        } catch {}
      }, resetDelay);
    }
  };

  const playVideo = () => {
    playerRef.current?.playVideo();
  };

  const pauseVideo = () => {
    playerRef.current?.pauseVideo();
  };

  const toggleLockSubtitle = (subtitle: SubtitleItem) => {
    if (lockedSubtitle && lockedSubtitle.startTime === subtitle.startTime && lockedSubtitle.endTime === subtitle.endTime) {
      setLockedSubtitle(null);
      loopArmedRef.current = false;
      firstLoopRef.current = true;
      return;
    }
    setLockedSubtitle(subtitle);
    loopArmedRef.current = false; // disarm until playback crosses start
    firstLoopRef.current = true;
    // Seek to start with small preroll and ensure normal speed
    try { playerRef.current?.setPlaybackRate(1); } catch {}
    const smallPreroll = Math.min(0.3, REPLAY_PREROLL_SECONDS);
    seekTo(Math.max(0, subtitle.startTime - smallPreroll));
    playVideo();
  };

  // Effect to continuously update the current time when video is playing
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying && playerRef.current) {
      interval = setInterval(async () => {
        const time = await playerRef.current?.getCurrentTime();
        if (time !== undefined) {
          setCurrentTime(time);
        }
      }, 50); // Update every 50ms for higher precision tracking
    }

    // Need to learn why return here?
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying]);

  // Loop the locked subtitle segment
  useEffect(() => {
    if (!lockedSubtitle || !playerRef.current) return;
    const start = lockedSubtitle.startTime;
    const end = lockedSubtitle.endTime;
    const LOOP_THRESHOLD = 0.015; // 15ms tolerance

    // If time jumped backwards (e.g., manual seek) reset arming logic
    if (currentTime < prevTimeRef.current - 0.05) {
      loopArmedRef.current = false;
      firstLoopRef.current = false; // treat as subsequent
    }

    // Arm after we've genuinely entered the line (past its exact start)
    if (!loopArmedRef.current && currentTime >= start + 0.005) {
      loopArmedRef.current = true;
    }

    // Detect forward crossing of end boundary (prev below threshold, current above)
    const prev = prevTimeRef.current;
    const crossedEnd = loopArmedRef.current && prev < end - LOOP_THRESHOLD && currentTime >= end - LOOP_THRESHOLD;
    if (crossedEnd) {
      loopArmedRef.current = false; // will re-arm after re-entering
      // For first loop AFTER the initial playback we remove preroll to avoid double-hearing opening fragment
      const usePreroll = firstLoopRef.current ? false : false; // we already applied preroll only on initial lock seek
      firstLoopRef.current = false;
      const seekTarget = usePreroll ? Math.max(0, start - Math.min(0.3, REPLAY_PREROLL_SECONDS)) : start;
      playerRef.current.seekTo(seekTarget, true);
      playerRef.current.playVideo();
    }
    prevTimeRef.current = currentTime;
  }, [currentTime, lockedSubtitle]);

  const getCurrentSubtitle = (): SubtitleItem | undefined =>
    subtitles.find(
      (subtitle) =>
        currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
    );

  // Derive total chunks for precise-chunk route (we still segment client-side)
  const chunkSeconds = 60; // could expose UI control later
  const totalChunks = duration ? Math.ceil(duration / chunkSeconds) : 0;

  // Fetch using new /api/pat/precise-chunk route
  const fetchAllChunks = async () => {
    if (!videoUrl || !duration) return;
    setLoadingSubs(true);
    setError(null);
    setSubtitles([]);
  setFirstChunkPending(true);
  setFirstChunkStart(null);
  setShowFirstChunkPrompt(false);
  setChunksReceived(0);
    try {
      // Attempt cache first
      const videoId = parseYouTubeId(videoUrl) || videoUrl;
      setCacheStatus("idle");
      const cached = await getCachedSubtitles({ videoId, fps, chunkSeconds });
      if (cached && cached.length) {
        setSubtitles(cached);
        setCacheStatus("hit");
    setFirstChunkPending(false);
        setLoadingSubs(false);
        return; // Serve from cache; skip network
      }
      setCacheStatus("miss");
      const concurrency = 2;
      const indices = [...Array(totalChunks).keys()];
      let active = 0; let ptr = 0;
      const acc: SubtitleItem[] = [];
      const seen = new Set<string>();
      const failed: number[] = [];
      const CHUNK_MAX_ATTEMPTS = 3;

      const fetchChunkWithRetry = async (idx: number) => {
        const startSec = idx * chunkSeconds;
        const endSec = Math.min(startSec + chunkSeconds, duration);
        for (let attempt = 1; attempt <= CHUNK_MAX_ATTEMPTS; attempt++) {
          try {
            const r = await fetch('/api/pat/precise-chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl, startSec, endSec, fps, force: false }),
            });
            const j = await r.json();
            if (!r.ok || j.error) throw new Error(j.error || 'Chunk failed');
            const lines = (j.lines || []) as { start: string; end: string; transcription?: string; pinyin?: string; meaning?: string; }[];
            lines.forEach(line => {
              const start = parseFloat(line.start);
              const end = parseFloat(line.end);
              if (Number.isFinite(start) && Number.isFinite(end)) {
                const key = `${start}-${end}-${line.pinyin || ''}-${line.meaning || ''}`;
                if (seen.has(key)) return;
                seen.add(key);
                acc.push({
                  startTime: start,
                  endTime: end,
                  text: line.transcription || line.meaning || line.pinyin || '',
                  pinyin: line.pinyin,
                  meaning: line.meaning,
                });
              }
            });
            acc.sort((a,b)=>a.startTime-b.startTime);
            setSubtitles([...acc]);
            // First chunk arrival detection
            if (firstChunkPending) {
              setFirstChunkPending(false);
              setFirstChunkStart(startSec);
              setShowFirstChunkPrompt(true);
            }
            setChunksReceived(c => c + 1);
            return; // success
          } catch (err:any) {
            if (attempt === CHUNK_MAX_ATTEMPTS) {
              failed.push(idx);
              setError(`Chunk ${idx+1} failed after ${CHUNK_MAX_ATTEMPTS} attempts: ${err.message}`);
            }
            // brief backoff
            await new Promise(res=>setTimeout(res, 300 * attempt));
          }
        }
      };
      await new Promise<void>((resolve) => {
        const launch = () => {
          if (ptr >= indices.length && active === 0) return resolve();
            while (active < concurrency && ptr < indices.length) {
              const idx = indices[ptr++];
            active++;
            fetchChunkWithRetry(idx).finally(()=>{ active--; launch(); });
            }
        };
        launch();
      });
      // After all chunks collected, persist to cache
      if (acc.length) {
        setCacheStatus("saving");
        putCachedSubtitles({ videoId, fps, chunkSeconds }, acc).then(()=>setCacheStatus("saved"));
      }
      if (failed.length) {
        console.warn('Failed chunk indices (0-based):', failed);
      }
    } catch (e:any) {
      setError(e.message);
      setCacheStatus("error");
    } finally {
      setLoadingSubs(false);
    }
  };

  // Removed manual/auto fetch toggle: transcription now auto-starts once duration is known.

  // Auto-start transcription immediately once duration is known (first time per video)
  useEffect(() => {
    if (duration > 0 && !loadingSubs && !startedRef.current) {
      startedRef.current = true;
      fetchAllChunks();
    }
  }, [duration, videoId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Video Player
          </h1>
          <p className="text-slate-600">
            Watch and follow along with synchronized subtitles
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Video Player */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <CardTitle className="text-xl font-semibold text-slate-700">
                    Video Content
                  </CardTitle>
                  <Badge variant="secondary" className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {/* URL Input */}
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e)=>setUrlInput(e.target.value)}
                      placeholder="Paste YouTube URL or ID"
                      className="text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 w-60"
                    />
                    {urlError && <span className="text-[10px] text-red-600 font-medium">{urlError}</span>}
                    {showCacheDebug && <CacheDebug status={cacheStatus} message={error} />}
                  {/* Transcription auto-starts; manual Transcribe & Auto toggle removed */}
                  {loadingSubs && (
                    <span className="text-[10px] text-slate-500">Transcribing…</span>
                  )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Video Container */}
                <PlayerVideo
                  videoId={videoId}
                  opts={opts}
                  onReady={onPlayerReady}
                  onPlayState={setIsPlaying}
                />
                <CurrentSubtitle current={getCurrentSubtitle()} />
                <PlayerControls
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  onPlay={playVideo}
                  onPause={pauseVideo}
                  onSeek={seekTo}
                />
                <Separator className="my-4" />
                {error && <p className="text-xs text-red-600">{error}</p>}
                {loadingSubs && firstChunkPending && (
                  <p className="text-xs text-slate-500">Starting transcription… first chunk coming soon. You can already play the video while we process.</p>
                )}
                {loadingSubs && !firstChunkPending && chunksReceived > 0 && chunksReceived < totalChunks && (
                  <p className="text-xs text-slate-500">Received {chunksReceived}/{totalChunks} chunks…</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Timestamped Subtitles */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm h-fit">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-700 flex items-center gap-2">
                  📝 Subtitles
                  <Badge variant="outline" className="ml-auto">
                    {subtitles.length} items
                  </Badge>
                  <button
                    onClick={() => setShowPinyin(p => !p)}
                    className="ml-2 px-2 py-1 text-[10px] rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600"
                    aria-pressed={showPinyin}
                    aria-label="Toggle Pinyin"
                  >{showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}</button>
                  <button
                    onClick={() => setShowMeaning(m => !m)}
                    className="px-2 py-1 text-[10px] rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600"
                    aria-pressed={showMeaning}
                    aria-label="Toggle Meaning"
                  >{showMeaning ? 'Hide Meaning' : 'Show Meaning'}</button>
                  <button
                    onClick={() => setShowToneColors(c => !c)}
                    className="px-2 py-1 text-[10px] rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600"
                    aria-pressed={showToneColors}
                    aria-label="Toggle Tone Colors"
                    disabled={!showPinyin}
                  >{showToneColors ? 'Plain Pinyin' : 'Color Pinyin'}</button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingSubs && firstChunkPending && (
                  <div className="p-4 text-xs text-slate-500 animate-pulse">
                    Transcribing… Please wait for the first chunk. (Video is playable meanwhile.)
                  </div>
                )}
                {showFirstChunkPrompt && firstChunkStart != null && (
                  <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-xs text-slate-700">
                    <span>First subtitle chunk ready.</span>
                    <button
                      className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]"
                      onClick={() => { seekTo(Math.max(0, firstChunkStart - 0.5)); setShowFirstChunkPrompt(false); }}
                    >Jump to {formatTime(firstChunkStart)}</button>
                    <button
                      className="px-2 py-1 bg-slate-300 text-slate-800 rounded text-[10px]"
                      onClick={() => setShowFirstChunkPrompt(false)}
                    >Dismiss</button>
                  </div>
                )}
                <SubtitleList
                  subtitles={subtitles}
                  currentTime={currentTime}
                  onSeek={seekTo}
                  onReplayLine={replayLine}
                  showPinyin={showPinyin}
                  showMeaning={showMeaning}
                  showToneColors={showToneColors}
                  lockedSubtitle={lockedSubtitle}
                  onToggleLock={toggleLockSubtitle}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
