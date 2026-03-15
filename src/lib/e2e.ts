/**
 * End-to-end encryption for DMs using Web Crypto API:
 * - ECDH P-256 for key agreement
 * - AES-GCM for encryption
 * - Private key stored in localStorage (per user); public key on server
 */

const ECDH_CURVE = 'P-256';
const E2E_STORAGE_PREFIX = 'e2e_private_';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

export function e2eStorageKey(userId: string): string {
    return `${E2E_STORAGE_PREFIX}${userId}`;
}

/** Generate ECDH key pair for the current user */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
    const pair = await crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: ECDH_CURVE,
        },
        true,
        ['deriveKey']
    );
    return pair as CryptoKeyPair;
}

/** Export public key to a string we can store in the DB */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey('raw', publicKey);
    return b64Encode(new Uint8Array(raw));
}

/** Import public key from stored string */
export async function importPublicKey(b64: string): Promise<CryptoKey> {
    const raw = b64Decode(b64);
    return crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        []
    );
}

/** Export private key to store in localStorage (unencrypted – device trust) */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
    return b64Encode(new Uint8Array(pkcs8));
}

/** Import private key from localStorage */
export async function importPrivateKey(b64: string): Promise<CryptoKey> {
    const pkcs8 = b64Decode(b64);
    return crypto.subtle.importKey(
        'pkcs8',
        pkcs8,
        { name: 'ECDH', namedCurve: ECDH_CURVE },
        true,
        ['deriveKey']
    );
}

/** Derive a shared AES-GCM key for this conversation (my private + their public) */
export async function deriveSharedKey(
    myPrivateKey: CryptoKey,
    theirPublicKey: CryptoKey
): Promise<CryptoKey> {
    return crypto.subtle.deriveKey(
        {
            name: 'ECDH',
            public: theirPublicKey,
        },
        myPrivateKey,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );
}

/** Encrypt plaintext; returns { ciphertext, nonce } as base64 */
export async function encrypt(
    sharedKey: CryptoKey,
    plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
            tagLength: TAG_LENGTH,
        },
        sharedKey,
        encoded
    );
    return {
        ciphertext: b64Encode(new Uint8Array(ciphertext)),
        nonce: b64Encode(iv),
    };
}

/** Decrypt ciphertext (base64) with nonce (base64) */
export async function decrypt(
    sharedKey: CryptoKey,
    ciphertextB64: string,
    nonceB64: string
): Promise<string> {
    const iv = b64Decode(nonceB64);
    const ciphertext = b64Decode(ciphertextB64);
    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv,
            tagLength: TAG_LENGTH,
        },
        sharedKey,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

function b64Encode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

function b64Decode(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Ensure current user has a key pair: generate if missing, save to localStorage, return public key for server */
export async function ensureMyKeyPair(userId: string): Promise<{ publicKey: string }> {
    const storageKey = e2eStorageKey(userId);
    let stored: string | null = null;
    if (typeof localStorage !== 'undefined') stored = localStorage.getItem(storageKey);

    if (stored) {
        try {
            const data = JSON.parse(stored) as { publicKey: string; privateKey: string };
            if (data.publicKey) return { publicKey: data.publicKey };
        } catch { /* old format or corrupt */ }
    }

    const pair = await generateKeyPair();
    const publicKeyB64 = await exportPublicKey(pair.publicKey);
    const privateKeyB64 = await exportPrivateKey(pair.privateKey);
    const toStore = JSON.stringify({ publicKey: publicKeyB64, privateKey: privateKeyB64 });
    if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, toStore);
    return { publicKey: publicKeyB64 };
}

/** Derive shared key for a conversation (my private + their public). Cache by cacheKey to avoid re-deriving. */
const sharedKeyCache = new Map<string, CryptoKey>();

export async function getSharedKey(
    myUserId: string,
    theirPublicKeyB64: string,
    cacheKey?: string
): Promise<CryptoKey | null> {
    if (cacheKey && sharedKeyCache.has(cacheKey)) return sharedKeyCache.get(cacheKey)!;
    const myPrivate = await getMyPrivateKey(myUserId);
    if (!myPrivate) return null;
    try {
        const theirPublic = await importPublicKey(theirPublicKeyB64);
        const key = await deriveSharedKey(myPrivate, theirPublic);
        if (cacheKey) sharedKeyCache.set(cacheKey, key);
        return key;
    } catch {
        return null;
    }
}

/** Get my private key from localStorage (null if not set) */
export async function getMyPrivateKey(userId: string): Promise<CryptoKey | null> {
    const storageKey = e2eStorageKey(userId);
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored) as { privateKey?: string };
        const b64 = parsed.privateKey ?? stored;
        return await importPrivateKey(b64);
    } catch {
        return null;
    }
}
