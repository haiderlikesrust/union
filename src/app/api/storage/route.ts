import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, getCurrentUser } from '@/lib/storage-auth';
import { USER_STORAGE_QUOTA_BYTES } from '@/lib/types';

const PB_URL =
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'http://127.0.0.1:8090';

/** GET /api/storage — list current user's files and used quota */
export async function GET(request: NextRequest) {
    const token = getAuthToken(request);
    const user = await getCurrentUser(token);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const res = await fetch(
            `${PB_URL}/api/collections/user_storage/records?filter=user="${user.id}"&perPage=500&sort=-created`,
            { headers: { Authorization: token! } }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: (err as { message?: string }).message || 'Failed to list storage' },
                { status: res.status }
            );
        }
        const data = (await res.json()) as { items: { id: string; name: string; size: number; mimeType: string; created: string; file: string }[] };
        const items = data.items || [];
        const usedBytes = items.reduce((sum, i) => sum + (i.size || 0), 0);

        return NextResponse.json({
            items: items.map((i) => ({
                id: i.id,
                name: i.name,
                size: i.size,
                mimeType: i.mimeType,
                created: i.created,
                file: i.file,
            })),
            usedBytes,
            quotaBytes: USER_STORAGE_QUOTA_BYTES,
        });
    } catch (e) {
        console.error('Storage list error:', e);
        return NextResponse.json({ error: 'Failed to list storage' }, { status: 500 });
    }
}
