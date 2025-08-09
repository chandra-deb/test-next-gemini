"use client";
import React from "react";

export type CacheStatus = "idle" | "hit" | "miss" | "saving" | "saved" | "error";

interface CacheDebugProps {
  status: CacheStatus;
  message?: string | null;
}

// Lightweight debug indicator. Shown only when parent decides (feature flag).
export const CacheDebug: React.FC<CacheDebugProps> = ({ status, message }) => {
  const color = {
    idle: "bg-slate-400",
    hit: "bg-green-600",
    miss: "bg-amber-600",
    saving: "bg-blue-600",
    saved: "bg-emerald-700",
    error: "bg-red-600",
  }[status];
  return (
    <div className={`text-[10px] uppercase tracking-wide font-semibold text-white px-2 py-1 rounded ${color}`}
      title={message || undefined}
    >
      Cache: {status}
    </div>
  );
};
