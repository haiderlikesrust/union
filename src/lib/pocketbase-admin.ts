/**
 * Server-only PocketBase admin client for updating records the current user cannot
 * (e.g. post.score when a vote is cast). Optional: if env vars are not set,
 * score sync will be skipped and votes will still be stored but post.score won't update.
 */
import PocketBase from 'pocketbase';

const PB_URL =
    (typeof process !== 'undefined' && process.env.POCKETBASE_URL) ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'http://127.0.0.1:8090';

let adminPb: PocketBase | null = null;

export async function getAdminClient(): Promise<PocketBase | null> {
    const email = process.env.POCKETBASE_ADMIN_EMAIL;
    const password = process.env.POCKETBASE_ADMIN_PASSWORD;
    if (!email || !password) return null;
    if (adminPb?.authStore.isValid) return adminPb;
    try {
        adminPb = new PocketBase(PB_URL);
        await adminPb.admins.authWithPassword(email, password);
        return adminPb;
    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[pocketbase-admin] Admin login failed:', e instanceof Error ? e.message : e);
        }
        return null;
    }
}

/**
 * Recalculate post score from post_votes and update the post record.
 * Call this after any vote create/update/delete for the post.
 */
export async function recalcPostScore(postId: string): Promise<void> {
    const pb = await getAdminClient();
    if (!pb) return;
    try {
        const votes = await pb.collection('post_votes').getFullList({
            filter: `post = "${postId}"`,
            fields: 'value',
        });
        const score = (votes as unknown as { value: number }[]).reduce((sum, v) => sum + (v.value || 0), 0);
        await pb.collection('posts').update(postId, { score });
    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.error('[pocketbase-admin] recalcPostScore failed:', e instanceof Error ? e.message : e);
        }
    }
}
