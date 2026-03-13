import { createHash } from 'crypto';

/**
 * Browser fingerprint utilities.
 *
 * These are used for identifying voters/uploaders without requiring accounts.
 * The hashes are generated client-side from browser characteristics and sent
 * to the server. This module provides server-side utilities for working with them.
 */

/**
 * Validates that a fingerprint hash looks correct.
 * Expected format: 64-character hex string (SHA-256).
 */
export function isValidFingerprint(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Generate a server-side hash from an IP address.
 * Used as a fallback voter/session identifier when no browser fingerprint is provided.
 *
 * @param ip - The client IP address
 * @param salt - Optional salt for additional entropy
 * @returns SHA-256 hex hash
 */
export function hashIp(ip: string, salt: string = 'thevia-server'): string {
  return createHash('sha256')
    .update(`${salt}:${ip}`)
    .digest('hex');
}

/**
 * Generate a hash from the uploaded JSON content.
 * Used to detect duplicate uploads.
 *
 * @param content - The JSON file content as a string or Buffer
 * @returns SHA-256 hex hash
 */
export function hashJsonContent(content: string | Buffer): string {
  const normalized = typeof content === 'string'
    ? content
    : content.toString('utf-8');

  // Normalize: parse and re-stringify to remove formatting differences
  try {
    const parsed = JSON.parse(normalized);
    const canonical = JSON.stringify(parsed, Object.keys(parsed).sort());
    return createHash('sha256').update(canonical).digest('hex');
  } catch {
    // If it's not valid JSON, hash it as-is
    return createHash('sha256').update(normalized).digest('hex');
  }
}

/**
 * Combine a browser fingerprint with an IP for stronger identification.
 *
 * @param fingerprint - Browser-generated fingerprint hash
 * @param ip - Client IP address
 * @returns Combined SHA-256 hex hash
 */
export function combineFingerprint(fingerprint: string, ip: string): string {
  return createHash('sha256')
    .update(`${fingerprint}:${ip}`)
    .digest('hex');
}
