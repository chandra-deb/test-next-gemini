"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipForward, SkipBack } from "lucide-react";

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ isPlaying, currentTime, onPlay, onPause, onSeek }) => {
  return (
    <div>
      <div className="flex justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSeek(Math.max(0, currentTime - 10))}
          className="flex items-center gap-2"
        >
          <SkipBack className="w-4 h-4" />
          -10s
        </Button>
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="sm"
          onClick={isPlaying ? onPause : onPlay}
          className="flex items-center gap-2"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Play
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSeek(currentTime + 10)}
          className="flex items-center gap-2"
        >
          <SkipForward className="w-4 h-4" />
          +10s
        </Button>
      </div>

      <div className="flex justify-center gap-2 flex-wrap mt-4">
        <Button variant="ghost" size="sm" onClick={() => onSeek(10)}>
          Go to 10s
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onSeek(30)}>
          Go to 30s
        </Button>
      </div>
    </div>
  );
};
