import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

/**
 * Symmetric encryption for secrets at rest (mailbox passwords) plus small
 * helpers for signing session cookies. AES-256-GCM gives us confidentiality
 * and integrity in one primitive.
 */

const KEY = scryptSync(env.secret, 'selfarchiver.aes', 32);
const IV_LENGTH = 12;

export function encryptSecret(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(payload: string): string {
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = raw.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Sign a value for use in a tamper-evident session cookie. */
export function sign(value: string): string {
    const mac = createHmac('sha256', env.secret).update(value).digest('base64url');
    return `${value}.${mac}`;
}

/** Verify a signed cookie value; returns the payload or null when invalid. */
export function unsign(signed: string): string | null {
    const dot = signed.lastIndexOf('.');
    if (dot < 0) return null;
    const value = signed.slice(0, dot);
    const mac = signed.slice(dot + 1);
    const expected = createHmac('sha256', env.secret).update(value).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return value;
}
