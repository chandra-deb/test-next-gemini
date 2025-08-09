import z from 'zod';

export const RequestSchema = z.object({
  videoUrl: z.string().url(),
  startSec: z.number().nonnegative().default(0),
  endSec: z.number().positive(),
  fps: z.number().positive().max(10).default(1),
  force: z.boolean().optional().default(false),
});

export const StrictLineSchema = z.object({
  start: z.string(),
  end: z.string(),
  transcription: z.string(),
  pinyin: z.string(),
  meaning: z.string(),
});

export const LooseLineSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  transcription: z.string().optional(),
  pinyin: z.string().optional(),
  meaning: z.string().optional(),
}).passthrough();

export const LooseLinesArray = z.array(LooseLineSchema);

export type StrictLine = z.infer<typeof StrictLineSchema>;
