export function getSuggestedChildNameFromPersonName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/([A-Za-z][A-Za-z-]*)'s\s+(Mom|Dad)\b/i);
  if (!match) return null;

  return match[1] ?? null;
}
