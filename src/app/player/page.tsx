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
import type { YouTubePlayer, YouTubeProps } from "react-youtube";

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
  const [videoUrl, setVideoUrl] = useState<string>("https://www.youtube.com/watch?v=vvHuHgfxc7o");
  const [autoFetch, setAutoFetch] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(1);

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

  const playVideo = () => {
    playerRef.current?.playVideo();
  };

  const pauseVideo = () => {
    playerRef.current?.pauseVideo();
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
    try {
      const concurrency = 2;
      const indices = [...Array(totalChunks).keys()];
      let active = 0; let ptr = 0;
      const acc: SubtitleItem[] = [];
      const seen = new Set<string>();
      await new Promise<void>((resolve) => {
        const launch = () => {
          if (ptr >= indices.length && active === 0) return resolve();
            while (active < concurrency && ptr < indices.length) {
              const idx = indices[ptr++];
              const startSec = idx * chunkSeconds;
              const endSec = Math.min(startSec + chunkSeconds, duration);
              active++;
              fetch('/api/pat/precise-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl, startSec, endSec, fps, force: false }),
              })
                .then(r => r.json().then(j => ({ ok: r.ok, j })))
                .then(({ ok, j }) => {
                  if (!ok || j.error) throw new Error(j.error || 'Chunk failed');
                  const lines = (j.lines || []) as { start: string; end: string; transcription?: string; pinyin?: string; meaning?: string; }[];
                  lines.forEach(line => {
                    const start = parseFloat(line.start); // already absolute seconds (no trailing s)
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
                })
                .catch(e => {
                  console.error('precise-chunk error', e);
                  setError(e.message);
                })
                .finally(() => { active--; launch(); });
            }
        };
        launch();
      });
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    if (autoFetch && duration) {
      fetchAllChunks();
    }
  }, [autoFetch, duration, videoUrl, fps]);

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
                  <button
                    type="button"
                    onClick={() => fetchAllChunks()}
                    disabled={loadingSubs}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50"
                  >{loadingSubs ? 'Transcribing…' : 'Transcribe'}</button>
                  <button
                    type="button"
                    onClick={() => setAutoFetch(a=>!a)}
                    className={`px-3 py-1 rounded text-xs ${autoFetch ? 'bg-green-600 text-white' : 'bg-slate-400 text-white'}`}
                  >Auto {autoFetch ? 'On':'Off'}</button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Video Container */}
                <PlayerVideo
                  videoId="vvHuHgfxc7o"
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
                {loadingSubs && <p className="text-xs text-slate-500">Fetching chunked subtitles… ({totalChunks} chunks)</p>}
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
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <SubtitleList
                  subtitles={subtitles}
                  currentTime={currentTime}
                  onSeek={seekTo}
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
