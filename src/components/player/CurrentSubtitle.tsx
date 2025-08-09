"use client";
import React from "react";
import { SubtitleItem } from "./types";

interface CurrentSubtitleProps {
  current: SubtitleItem | undefined;
}

export const CurrentSubtitle: React.FC<CurrentSubtitleProps> = ({ current }) => {
  return (
    <div className="bg-slate-50 rounded-lg p-4 min-h-[60px] flex items-center">
      <div className="text-center w-full">
        {current ? (
          <div className="space-y-1">
            <p className="text-lg text-slate-800 font-medium">{current.text}</p>
            {(current.pinyin || current.meaning) && (
              <p className="text-sm text-slate-600">{current.pinyin && <span className="mr-2 font-semibold">{current.pinyin}</span>}{current.meaning}</p>
            )}
          </div>
        ) : (
          <p className="text-slate-500 italic">No subtitle at current time</p>
        )}
      </div>
    </div>
  );
};
