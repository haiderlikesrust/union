import type { Metadata } from 'next';

const PB_URL =
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'https://pb.narf.gay';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://union.narf.gay';

type PostRecord = {
    id: string;
    title?: string;
    body?: string;
    image?: string;
    type?: string;
};

async function getPost(id: string): Promise<PostRecord | null> {
    try {
        const res = await fetch(`${PB_URL}/api/collections/posts/records/${id}`, {
            next: { revalidate: 60 },
        });
        if (!res.ok) return null;
        return (await res.json()) as PostRecord;
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) {
        return { title: 'Post | The Union' };
    }
    const title = post.title || 'Post';
    const description =
        typeof post.body === 'string' && post.body.trim()
            ? post.body.replace(/[#*_`\[\]]/g, '').slice(0, 160).trim() + (post.body.length > 160 ? '…' : '')
            : `A post on The Union`;
    const url = `${SITE_URL}/post/${id}`;
    const image =
        post.image && typeof post.image === 'string'
            ? `${PB_URL}/api/files/posts/${id}/${post.image}`
            : undefined;

    return {
        title: `${title} | The Union`,
        description,
        openGraph: {
            title,
            description,
            url,
            siteName: 'The Union',
            type: 'article',
            ...(image && { images: [{ url: image, width: 1200, height: 630, alt: title }] }),
        },
        twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title,
            description,
            ...(image && { images: [image] }),
        },
    };
}

export default function PostLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
