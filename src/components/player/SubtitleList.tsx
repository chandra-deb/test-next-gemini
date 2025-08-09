"use client";
import React, { useRef, useEffect, useMemo } from "react";
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
  showToneColors?: boolean;
  lockedSubtitle?: SubtitleItem | null;
  onToggleLock?: (subtitle: SubtitleItem) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({ subtitles, currentTime, onSeek, onReplayLine, showPinyin = true, showMeaning = true, showToneColors = true, lockedSubtitle, onToggleLock }) => {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTime]);

  const isActive = (s: SubtitleItem) => currentTime >= s.startTime && currentTime <= s.endTime;

  // Map accented vowels to tone numbers for detection when tone numbers are not present.
  const toneMarkMap: Record<string, number> = useMemo(() => ({
    ā:1, á:2, ǎ:3, à:4,
    ē:1, é:2, ě:3, è:4,
    ī:1, í:2, ǐ:3, ì:4,
    ō:1, ó:2, ǒ:3, ò:4,
    ū:1, ú:2, ǔ:3, ù:4,
    ǖ:1, ǘ:2, ǚ:3, ǜ:4,
    Ā:1, Á:2, Ǎ:3, À:4,
    Ē:1, É:2, Ě:3, È:4,
    Ī:1, Í:2, Ǐ:3, Ì:4,
    Ō:1, Ó:2, Ǒ:3, Ò:4,
    Ū:1, Ú:2, Ǔ:3, Ù:4,
    Ǖ:1, Ǘ:2, Ǚ:3, Ǜ:4,
  }), []);

  const toneForSyllable = (syllable: string): number => {
    // Strip punctuation commonly appearing in pinyin strings
    const clean = syllable.replace(/[.,!?;:()\[\]{}“”"'’`]/g, "");
    // If ends with a digit 1-5 treat that as tone (5 or 0 = neutral)
    const m = clean.match(/([a-zA-ZüÜvV]+)([1-5])$/);
    if (m) {
      const n = parseInt(m[2], 10);
      return n === 5 ? 0 : n; // treat 5 as neutral
    }
    // Otherwise inspect characters for tone marks
    for (const ch of clean) {
      if (toneMarkMap[ch] != null) return toneMarkMap[ch];
    }
    return 0; // neutral
  };

  const toneColorClass = (tone: number): string => {
    switch (tone) {
      case 1: return "text-blue-600"; // tone 1
      case 2: return "text-green-600"; // tone 2
      case 3: return "text-orange-500"; // tone 3
      case 4: return "text-red-600"; // tone 4
      default: return "text-slate-400"; // neutral
    }
  };

  const renderColoredPinyin = (pinyin: string) => {
    // Split by whitespace, keep original spacing minimal by joining with single space.
    const parts = pinyin.trim().split(/\s+/);
    return parts.map((syll, i) => {
      if (showToneColors) {
        const tone = toneForSyllable(syll);
        return (
          <span key={i} className={toneColorClass(tone)}>
            {syll}{i < parts.length - 1 && ' '}
          </span>
        );
      }
      return <span key={i}>{syll}{i < parts.length - 1 && ' '}</span>;
    });
  };

  return (
    <ScrollArea className="h-[600px] px-4">
      <div className="space-y-2 pb-4">
        {subtitles.map((subtitle, index) => {
          const active = isActive(subtitle);
          const locked = lockedSubtitle && lockedSubtitle.startTime === subtitle.startTime && lockedSubtitle.endTime === subtitle.endTime;
          return (
            <div
              key={index}
              ref={active ? activeRef : null}
              className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer ${
                locked ? "bg-purple-50 border-purple-300 shadow-md" : active ? "bg-blue-50 border-blue-200 shadow-md scale-105" : "bg-white border-slate-200 hover:bg-slate-50"
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
                    <p className="text-[11px] mt-1 flex flex-wrap items-baseline gap-1">
                      {showPinyin && subtitle.pinyin && (
                        <span className="font-semibold leading-snug">
                          {renderColoredPinyin(subtitle.pinyin)}
                        </span>
                      )}
                      {showMeaning && subtitle.meaning && (
                        <span className="text-slate-500">{subtitle.meaning}</span>
                      )}
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
                    <Button
                      variant={locked ? "default" : "outline"}
                      size="sm"
                      className={`h-5 px-2 text-[10px] leading-none ${locked ? 'bg-purple-600 hover:bg-purple-600 text-white' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleLock && onToggleLock(subtitle); }}
                      aria-pressed={locked ? true : false}
                      aria-label={locked ? 'Unlock looping for this line' : 'Lock this line to loop'}
                    >{locked ? 'Looping' : 'Loop'}</Button>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-between items-center text-xs text-slate-400">
                <span>
                  Duration: {(subtitle.endTime - subtitle.startTime).toFixed(1)}s
                </span>
                <span>{locked ? '🔁' : `#${index + 1}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
