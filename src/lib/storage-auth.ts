import { NextRequest } from 'next/server';
import PocketBase from 'pocketbase';

// Server-side: use POCKETBASE_URL if set (e.g. for production where server needs a reachable URL)
const PB_URL =
    (typeof process !== 'undefined' && process.env.POCKETBASE_URL) ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    'http://127.0.0.1:8090';

export interface PbUser { id: string; username: string; email: string; [key: string]: unknown }

/**
 * Gets the PocketBase auth token from the request.
 * Checks: Authorization header (Bearer or raw), then body/FormData authToken (for upload).
 */
export function getAuthToken(request: NextRequest): string | null {
    const auth = request.headers.get('Authorization');
    if (auth) {
        if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
        return auth.trim();
    }
    return null;
}

/**
 * Gets auth token from a FormData instance (e.g. upload body). Use when token might not be in headers.
 */
export function getAuthTokenFromFormData(formData: FormData): string | null {
    const t = formData.get('authToken');
    if (typeof t === 'string' && t.trim()) return t.trim();
    return null;
}

/**
 * Fetches the current user from PocketBase using the auth token.
 * Uses the PocketBase SDK and authRefresh() so the request format matches the client exactly.
 */
export async function getCurrentUser(token: string | null): Promise<PbUser | null> {
    if (!token || !token.length) return null;
    try {
        const pb = new PocketBase(PB_URL);
        // Minimal record so authStore.isValid is true; authRefresh will replace with real user
        const placeholder = { id: '_', collectionId: '_', collectionName: 'users' } as unknown as PbUser;
        pb.authStore.save(token, placeholder);
        if (!pb.authStore.isValid) return null;
        const authResponse = await pb.collection('users').authRefresh();
        const record = authResponse?.record;
        if (record && record.id && record.id !== '_') return record as PbUser;
        return null;
    } catch (e) {
        if (process.env.NODE_ENV === 'development') {
            console.error('[storage-auth] getCurrentUser failed:', e instanceof Error ? e.message : e);
        }
        return null;
    }
}
