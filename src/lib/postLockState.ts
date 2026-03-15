/**
 * Persist post lock state in sessionStorage so it stays correct when navigating
 * (feed -> post page -> feed) even if the API omits or returns stale isLocked.
 */
const KEY_PREFIX = 'tu_post_lock_';

export function getPostLockState(postId: string, serverValue: boolean | undefined): boolean {
    if (serverValue !== undefined && serverValue !== null) return !!serverValue;
    if (typeof window === 'undefined') return false;
    try {
        return window.sessionStorage.getItem(KEY_PREFIX + postId) === 'true';
    } catch {
        return false;
    }
}

export function setPostLockState(postId: string, isLocked: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(KEY_PREFIX + postId, isLocked ? 'true' : 'false');
    } catch {}
}
