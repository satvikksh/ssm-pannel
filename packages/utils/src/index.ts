import { Decimal } from "decimal.js";
import { customAlphabet } from "nanoid";

/**
 * Factory for decimal-safe money math. All authoritative financial
 * calculations MUST go through these helpers. Never use raw JS floats for
 * money arithmetic.
 */

export const MONEY_DECIMALS = 4;

export type SafeAmount = Decimal;

export function amount(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

export function add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return new Decimal(a).plus(b);
}

export function sub(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return new Decimal(a).minus(b);
}

export function mul(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return new Decimal(a).times(b);
}

export function div(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return new Decimal(a).div(b);
}

export function toFixed(value: Decimal, decimals = MONEY_DECIMALS): string {
  return value.toFixed(decimals);
}

export function roundMoney(value: Decimal, decimals = 2): Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/** Safe comparison for balance checks: a >= b */
export function gte(a: number | string | Decimal, b: number | string | Decimal): boolean {
  return new Decimal(a).gte(b);
}

/** Safe comparison for zero balance */
export function isPositive(value: number | string | Decimal): boolean {
  return new Decimal(value).gt(0);
}

export function toNumber(value: Decimal): number {
  return value.toNumber();
}

/**
 * Format a number as a localised money string. Defaults to INR (₹) with
 * en-IN grouping. Never used for arithmetic — only for display.
 */
export function formatMoney(value: number | string | Decimal, currency = "INR"): string {
  const n = new Decimal(value).toNumber();
  const abs = Math.abs(n);
  const rounded = Math.round(abs * 100) / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  if (currency === "INR") return `₹${formatted}`;
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${formatted}`;
}

/** Round to the given number of decimals (default 2) — safe money rounding. */
export function round2(value: number | string | Decimal): number {
  return roundMoney(new Decimal(value)).toNumber();
}

/**
 * Deterministic, collision-resistant public-facing IDs.
 * Prefixes keep collection-specific IDs self-describing (e.g. ORD-xxxx).
 */
const nano = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 16);

export function publicId(prefix: string): string {
  return `${prefix}-${nano()}`;
}

export function randomToken(length = 32): string {
  return customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", length)();
}

export function randomCode(length = 8): string {
  return customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", length)();
}

export function shortId(): string {
  return customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12)();
}

/**
 * Normalize a domain for license domain binding. Strips protocol, trailing
 * slashes, www, ports and lowercases. Returns null for invalid input.
 */
export function normalizeDomain(raw: string): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//i, "");
  d = d.replace(/^www\./i, "");
  d = d.replace(/\/.*$/, "");
  // strip ports
  d = d.replace(/:\d+$/, "");
  const re = /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;
  if (!re.test(d)) return null;
  return d;
}

export function isValidDomain(domain: string): boolean {
  return normalizeDomain(domain) !== null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidLink(link: string): boolean {
  return /^https?:\/\//i.test(link) && link.length >= 8 && link.length <= 2048;
}

export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 2)}****${secret.slice(-2)}`;
}

export function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export function sanitizeText(input: string): string {
  return input.replace(/[<>]/g, "").trim();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}