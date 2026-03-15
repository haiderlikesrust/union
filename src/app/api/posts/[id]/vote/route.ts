import { NextRequest, NextResponse } from 'next/server';
import PocketBase from 'pocketbase';
import { getAuthToken, getCurrentUser } from '@/lib/storage-auth';
import { recalcPostScore } from '@/lib/pocketbase-admin';

const PB_URL =
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'http://127.0.0.1:8090';

/**
 * POST /api/posts/[id]/vote
 * Body: { value: 1 | -1 }
 * Applies the vote as the current user, then recalculates and persists post.score.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: postId } = await params;
    const token = getAuthToken(request);
    const user = await getCurrentUser(token);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let value: number;
    try {
        const body = await request.json();
        value = body?.value === 1 || body?.value === -1 ? body.value : 0;
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    if (value === 0) {
        return NextResponse.json({ error: 'value must be 1 or -1' }, { status: 400 });
    }

    const pb = new PocketBase(PB_URL);
    const placeholder = { id: '_', collectionId: '_', collectionName: 'users' };
    pb.authStore.save(token!, placeholder as PocketBase['authStore'] extends { save(_: string, m: infer M): void } ? M : never);
    if (!pb.authStore.isValid) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    try {
        const existing = await pb.collection('post_votes').getList(1, 1, {
            filter: `post = "${postId}" && user = "${user.id}"`,
        });

        const existingVote = existing.items[0] as { id: string; value: number } | undefined;

        if (existingVote) {
            if (existingVote.value === value) {
                await pb.collection('post_votes').delete(existingVote.id);
            } else {
                await pb.collection('post_votes').update(existingVote.id, { value });
            }
        } else {
            await pb.collection('post_votes').create({
                post: postId,
                user: user.id,
                value,
            });
        }

        await recalcPostScore(postId);
        return NextResponse.json({ ok: true });
    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.error('[api/posts/vote]', e instanceof Error ? e.message : e);
        }
        return NextResponse.json({ error: 'Vote failed' }, { status: 500 });
    }
}
