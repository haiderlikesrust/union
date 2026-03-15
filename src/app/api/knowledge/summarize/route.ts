import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.ZAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: 'https://api.z.ai/api/paas/v4/',
    })
  : null;

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { title = '', body: postBody = '', commentsText = '' } = payload;

    const textToSummarize = [
      title && `Title: ${title}`,
      postBody && `Post: ${postBody}`,
      commentsText && `Comments:\n${commentsText}`,
    ].filter(Boolean).join('\n\n');

    if (!textToSummarize.trim()) {
      return NextResponse.json({ error: 'No content to summarize' }, { status: 400 });
    }

    if (!openai) {
      return NextResponse.json({ error: 'ZAI_API_KEY not configured' }, { status: 503 });
    }

    const completion = await openai.chat.completions.create({
      model: 'glm-5',
      messages: [
        {
          role: 'system',
          content: 'You are summarizing a discussion thread for a community wiki. Write a short, neutral summary (2–4 sentences) that captures the main topic and key points or answers. Use clear, concise language. Output only the summary, no preamble.',
        },
        {
          role: 'user',
          content: `Summarize this thread:\n\n${textToSummarize.slice(0, 12000)}`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim() || '';
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Summarize API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
