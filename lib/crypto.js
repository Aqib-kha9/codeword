"use client";

// ---------------------------------------------------------------------------
// Secure client-side text encryption utilities.
//
// Everything runs locally in the browser using the native Web Crypto API:
//   * Key derivation : PBKDF2 (SHA-256, 250,000 iterations, random 16-byte salt)
//   * Encryption     : AES-256-GCM (authenticated encryption, random 12-byte IV)
//   * Compression    : GZIP (via CompressionStream API) applied BEFORE encryption
//                      to significantly reduce ciphertext size (30-70% for typical
//                      text). Compression removes redundancy before encryption, so
//                      security is identical or better.
//
// No plaintext, password or key ever leaves the device. There is no server.
//
// Output payload layout (base64):
//   ENC2: salt(16) | iv(12) | compressed+ciphertext+tag   <- new compressed format
//   ENC1: salt(16) | iv(12) | ciphertext+tag              <- legacy format (decrypt only)
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PBKDF2_ITERATIONS = 250000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const PREFIX_V2 = "ENC2:"; // compressed + encrypted (new default)
const PREFIX_V1 = "ENC1:"; // legacy — uncompressed (decrypt only)

// ── Encoding helpers ────────────────────────────────────────────────────────

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

// ── Compression helpers (GZIP via CompressionStream) ────────────────────────

/**
 * Compress a Uint8Array using GZIP.
 * Falls back to the raw bytes if the browser does not support CompressionStream.
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function compress(bytes) {
  if (typeof CompressionStream === "undefined") {
    return bytes; // Fallback: no compression, still encrypted
  }
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Decompress a GZIP-compressed Uint8Array.
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
async function decompress(bytes) {
  if (typeof DecompressionStream === "undefined") {
    return bytes; // Fallback: assume uncompressed
  }
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks = [];
  const reader = ds.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ── Key derivation ───────────────────────────────────────────────────────────

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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt plain text with a password.
 * The plaintext is GZIP-compressed before encryption to minimise output size.
 * @param {string} plainText
 * @param {string} password
 * @returns {Promise<string>} "ENC2:" + base64(salt|iv|compressed_ciphertext)
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

  // Compress BEFORE encrypting — reduces output size significantly
  const rawBytes = encoder.encode(plainText);
  const compressedBytes = await compress(rawBytes);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressedBytes
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(
    salt.length + iv.length + cipherBytes.length
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);

  return PREFIX_V2 + bytesToBase64(combined);
}

/**
 * Decrypt a payload produced by encryptText.
 * Handles both the new compressed format (ENC2:) and the legacy format (ENC1:).
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

  // Detect format version
  let isCompressed = false;
  if (body.startsWith(PREFIX_V2)) {
    isCompressed = true;
    body = body.slice(PREFIX_V2.length);
  } else if (body.startsWith(PREFIX_V1)) {
    isCompressed = false;
    body = body.slice(PREFIX_V1.length);
  }
  // Strip any whitespace (e.g. line-breaks introduced by copy-paste)
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

  let plainBuffer;
  try {
    plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );
  } catch {
    throw new Error("Decryption failed. Wrong password or corrupted text.");
  }

  const decryptedBytes = new Uint8Array(plainBuffer);

  // Decompress only for the new ENC2: format
  if (isCompressed) {
    const decompressedBytes = await decompress(decryptedBytes);
    return decoder.decode(decompressedBytes);
  }

  return decoder.decode(decryptedBytes);
}
