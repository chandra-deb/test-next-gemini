import { google } from '@ai-sdk/google';
import { streamText, UIMessage, convertToModelMessages, generateText, generateObject, zodSchema } from 'ai';
import { time } from 'console';
import { link } from 'fs';
import z from 'zod';
import { string } from 'zod/v4';

// make a function to convert youtube shorts link into video link
function convertShortsToVideoLink(shortsUrl: string): string {
  return shortsUrl.replace('/shorts/', '/watch?v=');
}



// now make a function to check if the video link is short or general video if short link then user the created function to convert to general video link else return the link
function getVideoLink(videoUrl: string): string {
  if (videoUrl.includes('/shorts/')) {
    return convertShortsToVideoLink(videoUrl);
  }
  return videoUrl;
}




// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const videoLink = getVideoLink("https://www.youtube.com/shorts/Tkl5F_xf-1g");

  const result = await generateObject({
    model: google('gemini-2.5-flash'),
    schema: z.array(z.object({
      start: z.string(),
      end: z.string(),
      pinyin: z.string(),
      meaning: z.string(),
    })),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Provide subtitle with pinyin and contextual meaning with timestamp(seconds.milliseconds) in json format',
          },
          {
            type: 'file',

            data: videoLink,
            mediaType: 'video/mp4',
           
          },
        ],
      },
    ],
  });

  for (const item of result.object) {
    console.log(`Start: ${item.start} | End: ${item.end} | Meaning: ${item.meaning}`);
  }

  return new Response(JSON.stringify({ text: "Hello" }), {
    headers: { 'Content-Type': 'application/json' },
  });
}