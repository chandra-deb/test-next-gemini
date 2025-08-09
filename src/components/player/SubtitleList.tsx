"use client";
import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { SubtitleItem } from "./types";
import { formatTime } from "@/app/utils/formatTime";

export interface SubtitleListProps {
  subtitles: SubtitleItem[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({ subtitles, currentTime, onSeek }) => {
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
              onClick={() => onSeek(subtitle.startTime)}
            >
              <div className="flex items-start gap-3">
                <Badge variant={active ? "default" : "secondary"} className="text-xs font-mono min-w-fit">
                  {formatTime(subtitle.startTime)}
                </Badge>
                <p className={`text-sm leading-relaxed flex-1 ${active ? "text-slate-800 font-medium" : "text-slate-600"}`}>
                  {subtitle.text}
                </p>
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
