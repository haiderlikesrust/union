import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, getAuthTokenFromFormData, getCurrentUser } from '@/lib/storage-auth';
import { encryptFile } from '@/lib/storage-crypto';
import { USER_STORAGE_QUOTA_BYTES } from '@/lib/types';

const PB_URL =
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'http://127.0.0.1:8090';

/** POST /api/storage/upload — upload a file (encrypted), enforce 5GB quota */
export async function POST(request: NextRequest) {
    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const token = getAuthToken(request) || getAuthTokenFromFormData(formData);
    const user = await getCurrentUser(token);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const file = formData.get('file') as File | null;
    if (!file || typeof file.arrayBuffer !== 'function') {
        return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const size = file.size;
    if (size <= 0) {
        return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const secret = process.env.STORAGE_ENCRYPTION_KEY || process.env.APP_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: 'Server misconfiguration: STORAGE_ENCRYPTION_KEY or APP_SECRET must be set for encrypted storage. Add one to .env.local.' },
            { status: 503 }
        );
    }

    try {
        const authHeader = token!;
        const listRes = await fetch(
            `${PB_URL}/api/collections/user_storage/records?filter=user="${user.id}"&perPage=1&fields=size`,
            { cache: 'no-store', headers: { Authorization: authHeader } }
        );
        if (!listRes.ok) {
            return NextResponse.json({ error: 'Failed to check quota' }, { status: 502 });
        }
        const fullListRes = await fetch(
            `${PB_URL}/api/collections/user_storage/records?filter=user="${user.id}"&perPage=500&fields=size`,
            { cache: 'no-store', headers: { Authorization: authHeader } }
        );
        const fullData = (await fullListRes.json()) as { items?: { size: number }[] };
        const usedBytes = (fullData.items || []).reduce((s, i) => s + (i.size || 0), 0);
        if (usedBytes + size > USER_STORAGE_QUOTA_BYTES) {
            return NextResponse.json(
                { error: 'Storage quota exceeded (5GB per user). Delete some files to free space.' },
                { status: 413 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const { encrypted, nonce } = encryptFile(buffer, user.id);

        const name = (file.name || 'file').replace(/\0/g, '');
        const mimeType = file.type || 'application/octet-stream';

        const pbForm = new FormData();
        pbForm.append('user', user.id);
        pbForm.append('name', name);
        pbForm.append('size', String(size));
        pbForm.append('mimeType', mimeType);
        pbForm.append('nonce', nonce);
        pbForm.append('file', new Blob([new Uint8Array(encrypted)]), 'encrypted.bin');

        const createRes = await fetch(`${PB_URL}/api/collections/user_storage/records`, {
            method: 'POST',
            headers: { Authorization: authHeader },
            body: pbForm,
        });

        if (!createRes.ok) {
            const err = (await createRes.json().catch(() => ({}))) as { message?: string };
            return NextResponse.json(
                { error: err.message || 'Upload failed' },
                { status: createRes.status }
            );
        }

        const record = (await createRes.json()) as { id: string; name: string; size: number; mimeType: string; created: string };
        return NextResponse.json({
            id: record.id,
            name: record.name,
            size: record.size,
            mimeType: record.mimeType,
            created: record.created,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Upload failed';
        console.error('Storage upload error:', e);
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'development' ? message : 'Upload failed' },
            { status: 500 }
        );
    }
}
