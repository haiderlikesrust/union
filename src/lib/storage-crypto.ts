import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const NONCE_LEN = 12;
const SALT = 'the-union-storage-v1';

function getEncryptionKey(): Buffer {
    const secret = process.env.STORAGE_ENCRYPTION_KEY || process.env.APP_SECRET;
    if (!secret || typeof secret !== 'string') {
        throw new Error('STORAGE_ENCRYPTION_KEY or APP_SECRET must be set for encrypted storage');
    }
    return scryptSync(secret, SALT, KEY_LEN);
}

function deriveUserKey(userId: string): Buffer {
    const baseKey = getEncryptionKey();
    return scryptSync(Buffer.concat([baseKey, Buffer.from(userId, 'utf8')]), SALT, KEY_LEN);
}

/**
 * Encrypts buffer with AES-256-GCM. Returns { encrypted, nonce } (nonce is base64).
 */
export function encryptFile(content: Buffer, userId: string): { encrypted: Buffer; nonce: string } {
    const key = deriveUserKey(userId);
    const nonce = randomBytes(NONCE_LEN);
    const cipher = createCipheriv(ALGO, key, nonce);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final(), cipher.getAuthTag()]);
    return { encrypted, nonce: nonce.toString('base64') };
}

/**
 * Decrypts buffer. nonce is base64. Content is encrypted buffer (ciphertext + auth tag).
 */
export function decryptFile(encrypted: Buffer, userId: string, nonceBase64: string): Buffer {
    const key = deriveUserKey(userId);
    const nonce = Buffer.from(nonceBase64, 'base64');
    if (nonce.length !== NONCE_LEN) throw new Error('Invalid nonce');
    const authTag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(0, encrypted.length - 16);
    const decipher = createDecipheriv(ALGO, key, nonce);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
