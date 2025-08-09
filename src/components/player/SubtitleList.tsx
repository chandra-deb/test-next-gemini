"use client";
import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { SubtitleItem } from "./types";
import { formatTime } from "@/app/utils/formatTime";
import { Button } from "@/components/ui/button";

export interface SubtitleListProps {
  subtitles: SubtitleItem[];
  currentTime: number;
  onSeek: (time: number) => void;
  onReplayLine: (subtitle: SubtitleItem, rate?: number) => void;
  showPinyin?: boolean;
  showMeaning?: boolean;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({ subtitles, currentTime, onSeek, onReplayLine, showPinyin = true, showMeaning = true }) => {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTime]);

  const isActive = (s: SubtitleItem) => currentTime >= s.startTime && currentTime <= s.endTime;

  return (
    <ScrollArea className="h-[600px] px-4">
      <div className="space-y-2 pb-4">
        {subtitles.map((subtitle, index) => {
          const active = isActive(subtitle);
          return (
            <div
              key={index}
              ref={active ? activeRef : null}
              className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer ${
                active ? "bg-blue-50 border-blue-200 shadow-md scale-105" : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
              // Apply a 0.5s preroll so playback starts slightly before the subtitle
              onClick={() => onSeek(Math.max(0, subtitle.startTime - 0.5))}
            >
              <div className="flex items-start gap-3">
                <Badge variant={active ? "default" : "secondary"} className="text-xs font-mono min-w-fit">
                  {formatTime(subtitle.startTime)}
                </Badge>
                <div className={`text-sm leading-relaxed flex-1 ${active ? "text-slate-800 font-medium" : "text-slate-600"}`}>
                  <p className="whitespace-pre-wrap break-words">{subtitle.text}</p>
          {(showPinyin && subtitle.pinyin) || (showMeaning && subtitle.meaning) ? (
                    <p className="text-[11px] mt-1 text-slate-500">
            {showPinyin && subtitle.pinyin && <span className="mr-2 font-semibold">{subtitle.pinyin}</span>}
            {showMeaning && subtitle.meaning}
                    </p>
          ) : null}
                  <div className="mt-2 flex gap-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 px-2 text-[10px] leading-none"
                      onClick={(e) => { e.stopPropagation(); onReplayLine(subtitle, 1); }}
                      aria-label="Replay line"
                    >↺</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 px-2 text-[10px] leading-none"
                      onClick={(e) => { e.stopPropagation(); onReplayLine(subtitle, 0.75); }}
                      aria-label="Replay at 0.75x"
                    >0.75x</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 px-2 text-[10px] leading-none"
                      onClick={(e) => { e.stopPropagation(); onReplayLine(subtitle, 0.5); }}
                      aria-label="Replay at 0.5x"
                    >0.5x</Button>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-between items-center text-xs text-slate-400">
                <span>
                  Duration: {(subtitle.endTime - subtitle.startTime).toFixed(1)}s
                </span>
                <span>#{index + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
