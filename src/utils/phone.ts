export function normalizePhone(input: string, defaultCountry = "US"): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const withoutExt = raw.replace(/\b(ext|x)\.?\s*\d+\s*$/i, "").trim();

  if (/^\+/.test(withoutExt)) {
    const digits = withoutExt.replace(/[^\d+]/g, "");
    const cleaned = `+${digits.replace(/[^\d]/g, "")}`;
    return cleaned.length >= 9 ? cleaned : null;
  }

  if (/^00/.test(withoutExt)) {
    const digits = withoutExt.replace(/[^\d]/g, "");
    const cleaned = `+${digits.slice(2)}`;
    return cleaned.length >= 9 ? cleaned : null;
  }

  const digits = withoutExt.replace(/[^\d]/g, "");

  // Best-effort normalization. For v1 we default to US when no country is provided.
  if (defaultCountry === "US") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  }

  return null;
}

