import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { randomToken } from "@smm/utils";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  sub: string;
  role: string;
  type: "access" | "refresh";
  [key: string]: unknown;
}

export interface JwtOptions {
  secret: string;
  expiresIn: string | number;
}

export async function signJwt(payload: Record<string, unknown>, options: JwtOptions): Promise<string> {
  const signOptions: SignOptions = { expiresIn: options.expiresIn as never, issuer: "smm-panel" };
  return new Promise((resolve, reject) => {
    jwt.sign(payload, options.secret as Secret, signOptions, (err, token) => {
      if (err || !token) return reject(err ?? new Error("JWT sign failed"));
      resolve(token);
    });
  });
}

export async function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret as Secret, (err, decoded) => {
      if (err || !decoded) return reject(err ?? new Error("JWT verify failed"));
      resolve(decoded as T);
    });
  });
}

/**
 * HMAC-based signed payload. Used for license authorization responses and
 * installation-bound tokens so the customer installation can verify a
 * response originated from the authoritative license server.
 */
export function hmacSign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function hmacVerify(payload: string, expectedSig: string, secret: string): boolean {
  const expected = Buffer.from(expectedSig);
  const actual = Buffer.from(hmacSign(payload, secret));
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function apiSign(secret: string, body: string, timestamp: number): string {
  return hmacSign(`${timestamp}.${body}`, secret);
}

/**
 * Symmetric encryption for storing third-party credentials (provider API
 * keys, payment secrets) at rest. Keys must be 32 bytes.
 */
export function encryptSecret(plaintext: string, keyHex: string): string {
  const iv = randomBytes(16);
  const key = normalizeKey(keyHex);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string, keyHex: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted payload");
  const key = normalizeKey(keyHex);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

function normalizeKey(keyHex: string): Buffer {
  let key = Buffer.from(keyHex.replace(/^0x/, ""), "hex");
  if (key.length < 32) {
    key = Buffer.concat([key, Buffer.alloc(32 - key.length, 0)]);
  }
  return key.subarray(0, 32);
}

export function hashKey(secret: string): string {
  // Salt-less indexed hash is fine because keys already have high entropy.
  return createHmac("sha256", "smm-key-hash").update(secret).digest("hex");
}

export function generateApiKey(): { keyId: string; secret: string; keyHash: string } {
  const keyId = `smm_${randomToken(12)}`;
  const secret = `sk_${randomToken(40)}`;
  return { keyId, secret, keyHash: hashKey(secret) };
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}