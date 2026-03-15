import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, getCurrentUser } from '@/lib/storage-auth';
import { decryptFile } from '@/lib/storage-crypto';

const PB_URL =
    process.env.POCKETBASE_URL ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'http://127.0.0.1:8090';

/** GET /api/storage/[id] — download file (decrypt and stream) */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const token = getAuthToken(request);
    const user = await getCurrentUser(token);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
        return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    try {
        const recordRes = await fetch(
            `${PB_URL}/api/collections/user_storage/records/${id}`,
            { headers: { Authorization: token! } }
        );
        if (!recordRes.ok) {
            if (recordRes.status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json({ error: 'Failed to get file' }, { status: recordRes.status });
        }
        const record = (await recordRes.json()) as {
            user: string;
            name: string;
            size: number;
            mimeType: string;
            file: string;
            nonce: string;
        };
        if (record.user !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const fileUrl = `${PB_URL}/api/files/user_storage/${id}/${record.file}`;
        const fileRes = await fetch(fileUrl, { headers: { Authorization: token! } });
        if (!fileRes.ok) {
            return NextResponse.json({ error: 'Failed to download file' }, { status: 502 });
        }
        const encrypted = Buffer.from(await fileRes.arrayBuffer());
        const decrypted = decryptFile(encrypted, user.id, record.nonce);

        return new NextResponse(new Uint8Array(decrypted), {
            headers: {
                'Content-Type': record.mimeType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(record.name)}"`,
                'Content-Length': String(decrypted.length),
            },
        });
    } catch (e) {
        console.error('Storage download error:', e);
        return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
}

/** PATCH /api/storage/[id] — rename file */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const token = getAuthToken(request);
    const user = await getCurrentUser(token);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
        return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    let body: { name?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 512) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    try {
        const recordRes = await fetch(
            `${PB_URL}/api/collections/user_storage/records/${id}`,
            { headers: { Authorization: token! } }
        );
        if (!recordRes.ok) {
            if (recordRes.status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json({ error: 'Failed to get file' }, { status: recordRes.status });
        }
        const record = (await recordRes.json()) as { user: string };
        if (record.user !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updateRes = await fetch(
            `${PB_URL}/api/collections/user_storage/records/${id}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: token! },
                body: JSON.stringify({ name }),
            }
        );
        if (!updateRes.ok) {
            const err = (await updateRes.json().catch(() => ({}))) as { message?: string };
            return NextResponse.json({ error: err.message || 'Rename failed' }, { status: updateRes.status });
        }
        const updated = (await updateRes.json()) as { name: string };
        return NextResponse.json({ name: updated.name });
    } catch (e) {
        console.error('Storage rename error:', e);
        return NextResponse.json({ error: 'Rename failed' }, { status: 500 });
    }
}

/** DELETE /api/storage/[id] — delete file */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const token = getAuthToken(request);
    const user = await getCurrentUser(token);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
        return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    try {
        const deleteRes = await fetch(
            `${PB_URL}/api/collections/user_storage/records/${id}`,
            { method: 'DELETE', headers: { Authorization: token! } }
        );
        if (!deleteRes.ok) {
            if (deleteRes.status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            return NextResponse.json({ error: 'Failed to delete' }, { status: deleteRes.status });
        }
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('Storage delete error:', e);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
