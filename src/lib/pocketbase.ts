import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Singleton browser client (only created in the browser)
let browserClient: PocketBase | null = null;

/** Stub used during SSR/static generation so PocketBase (which uses `location`) is never instantiated in Node. */
function createServerStub(): PocketBase {
    const noop = () => {};
    const authStore = {
        get token() { return ''; },
        get record() { return null; },
        get isValid() { return false; },
        clear: noop,
        save: (_t: string, _m: unknown) => {},
        onChange: (_cb: () => void) => noop,
    };
    const throwOnUse = () => { throw new Error('PocketBase is only available in the browser'); };
    const collectionStub = () => ({
        getList: throwOnUse,
        getFirstListItem: throwOnUse,
        getFullList: throwOnUse,
        getOne: throwOnUse,
        create: throwOnUse,
        update: throwOnUse,
        delete: throwOnUse,
        authWithPassword: throwOnUse,
        authWithOAuth2: throwOnUse,
        authRefresh: throwOnUse,
        confirmPasswordReset: throwOnUse,
        requestPasswordReset: throwOnUse,
        listAuthMethods: throwOnUse,
    });
    return {
        authStore,
        collection: collectionStub,
        autoCancellation: () => ({ authStore, collection: collectionStub, autoCancellation: noop }),
    } as unknown as PocketBase;
}

let serverStub: PocketBase | null = null;

/**
 * Returns a PocketBase client for use in browser/client components.
 * Uses a singleton pattern to reuse the same client across the app.
 * On the server (SSR/static), returns a stub so `location` is never accessed.
 */
export function createBrowserClient(): PocketBase {
    if (typeof window !== 'undefined') {
        if (browserClient) return browserClient;
        browserClient = new PocketBase(POCKETBASE_URL);
        browserClient.autoCancellation(false);
        return browserClient;
    }
    if (!serverStub) serverStub = createServerStub();
    return serverStub;
}

/**
 * Returns the PocketBase URL for constructing file URLs
 */
export function getFileUrl(collectionId: string, recordId: string, filename: string): string {
    return `${POCKETBASE_URL}/api/files/${collectionId}/${recordId}/${filename}`;
}

/**
 * Returns a properly formatted file URL from a record
 */
export function getRecordFileUrl(record: { id: string; collectionId: string; collectionName: string }, filename: string): string {
    if (!filename) return '';
    return `${POCKETBASE_URL}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

export { POCKETBASE_URL };
export default PocketBase;
