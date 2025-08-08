import { NextResponse } from "next/server";
import { GoogleGenAI, MediaResolution, createPartFromUri } from "@google/genai";
import z from "zod";
function toSecString(v: number | null | undefined) {
  if (v == null) return undefined;
  return `${Number(v)}s`; // or toFixed(3) if you want milliseconds precision
}
// Initialize the Gemini client (using API key from env vars)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log(body)
        const { videoUrl, prompt, startSec = 0, endSec = null, fps = 1 } = body;

console.log("Received data:", { videoUrl,  startSec, endSec, fps });

    const contents = [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: "video/mp4",
              fileUri: videoUrl,
            },
        videoMetadata: {
          startOffset: toSecString(startSec),
          endOffset: toSecString(endSec),
          fps: fps,
        },
      },
      { text: "provide transcription with pinyin and english" },
    ]},]

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.array(z.object({
              start: z.string(),
              end: z.string(),
              pinyin: z.string(),
              meaning: z.string(),
            })),
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      },
    });

    return NextResponse.json({ result: response.text });
  } catch (error: any) {
    console.error("Video analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
