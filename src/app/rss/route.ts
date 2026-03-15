import { NextResponse } from 'next/server';
import { POCKETBASE_URL } from '@/lib/pocketbase';

type RssPost = {
    id: string;
    title: string;
    body?: string;
    url?: string;
    created: string;
    expand?: { author?: { username?: string } };
};

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export async function GET() {
    try {
        const res = await fetch(
            `${POCKETBASE_URL}/api/collections/posts/records?page=1&perPage=30&sort=-created&expand=author`,
            { cache: 'no-store' }
        );
        if (!res.ok) {
            return new NextResponse('Failed to load posts', { status: 500 });
        }
        const data = await res.json() as { items?: RssPost[] };
        const items = data.items ?? [];
        const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const feedItems = items.map((post) => {
            const link = `${siteUrl}/post/${post.id}`;
            const description = escapeXml((post.body || post.url || '').slice(0, 800));
            const title = escapeXml(post.title || 'Untitled');
            const author = escapeXml(post.expand?.author?.username || 'unknown');
            const pubDate = new Date(post.created).toUTCString();
            return `
      <item>
        <title>${title}</title>
        <link>${link}</link>
        <guid>${link}</guid>
        <description>${description}</description>
        <author>${author}</author>
        <pubDate>${pubDate}</pubDate>
      </item>`;
        }).join('');

        const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>The Union - Latest Posts</title>
    <link>${siteUrl}</link>
    <description>Latest posts from The Union</description>
    <language>en-us</language>
    ${feedItems}
  </channel>
</rss>`;

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
            },
        });
    } catch {
        return new NextResponse('Failed to generate RSS', { status: 500 });
    }
}
