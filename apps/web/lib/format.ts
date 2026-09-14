export function formatDate(value?: string | number | Date | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function formatMoney(value?: number | string | null): string {
  const num = Number(value ?? 0);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const CURRENCY_SYMBOL = "₹";

export function parseFloatSafe(value?: number | string | null): number {
  const num = Number(value ?? 0);
  return isNaN(num) ? 0 : num;
}