"use client";
import React from "react";
import YouTube, { YouTubePlayer, YouTubeProps } from "react-youtube";

export interface PlayerVideoProps {
  videoId: string;
  opts: YouTubeProps["opts"];
  onReady: (player: YouTubePlayer) => void;
  onPlayState: (isPlaying: boolean) => void;
}

export const PlayerVideo: React.FC<PlayerVideoProps> = ({ videoId, opts, onReady, onPlayState }) => {
  return (
    <div className="relative rounded-lg overflow-hidden bg-black mb-4">
      <YouTube
        videoId={videoId}
        loading="eager"
        opts={opts}
        onReady={(e) => onReady(e.target)}
        onStateChange={(event) => onPlayState(event.data === 1)}
        className="w-full"
      />
    </div>
  );
};
