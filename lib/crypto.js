"use client";

// ---------------------------------------------------------------------------
// Secure client-side text encryption utilities.
//
// Everything runs locally in the browser using the native Web Crypto API:
//   * Key derivation : PBKDF2 (SHA-256, 250,000 iterations, random 16-byte salt)
//   * Encryption     : AES-256-GCM (authenticated encryption, random 12-byte IV)
//
// No plaintext, password or key ever leaves the device. There is no server.
//
// Output payload layout (base64):  salt(16) | iv(12) | ciphertext+tag
// The whole string is prefixed with "ENC1:" so it is easy to recognise.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PBKDF2_ITERATIONS = 250000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const PREFIX = "ENC1:";

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plain text with a password.
 * @param {string} plainText
 * @param {string} password
 * @returns {Promise<string>} "ENC1:" + base64(salt|iv|ciphertext)
 */
export async function encryptText(plainText, password) {
  if (!plainText) {
    throw new Error("Please enter the text you want to encrypt.");
  }
  if (!password) {
    throw new Error("Please enter a password.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plainText)
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(
    salt.length + iv.length + cipherBytes.length
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);

  return PREFIX + bytesToBase64(combined);
}

/**
 * Decrypt a payload produced by encryptText.
 * @param {string} payload
 * @param {string} password
 * @returns {Promise<string>} original plain text
 */
export async function decryptText(payload, password) {
  if (!payload) {
    throw new Error("Please enter the text you want to decrypt.");
  }
  if (!password) {
    throw new Error("Please enter the password.");
  }

  let body = payload.trim();
  if (body.startsWith(PREFIX)) {
    body = body.slice(PREFIX.length);
  }
  body = body.replace(/\s+/g, "");

  let raw;
  try {
    raw = base64ToBytes(body);
  } catch {
    throw new Error("Invalid encrypted text format.");
  }

  if (raw.length <= SALT_LENGTH + IV_LENGTH) {
    throw new Error("Encrypted text is too short or corrupted.");
  }

  const salt = raw.slice(0, SALT_LENGTH);
  const iv = raw.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const cipherBytes = raw.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );
    return decoder.decode(plainBuffer);
  } catch {
    throw new Error("Decryption failed. Wrong password or corrupted text.");
  }
}
