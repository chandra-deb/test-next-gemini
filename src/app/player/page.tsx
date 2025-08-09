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
    sampleSubtitles.find(
      (subtitle) =>
        currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
    );

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
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-semibold text-slate-700">
                    Video Content
                  </CardTitle>
                  <Badge variant="secondary" className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Badge>
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
                    {sampleSubtitles.length} items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <SubtitleList
                  subtitles={sampleSubtitles}
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
