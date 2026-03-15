import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Singleton browser client
let browserClient: PocketBase | null = null;

/**
 * Returns a PocketBase client for use in browser/client components.
 * Uses a singleton pattern to reuse the same client across the app.
 */
export function createBrowserClient(): PocketBase {
    if (browserClient) return browserClient;

    browserClient = new PocketBase(POCKETBASE_URL);
    browserClient.autoCancellation(false);

    return browserClient;
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
