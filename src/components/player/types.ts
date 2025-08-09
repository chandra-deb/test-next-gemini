export interface SubtitleItem {
  startTime: number; // seconds (can be fractional)
  endTime: number;   // seconds (can be fractional)
  text: string;      // Combined display text
  // Optional richer fields when sourced from Gemini transcription
  pinyin?: string;
  meaning?: string;
}
