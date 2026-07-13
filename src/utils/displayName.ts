const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

function normalizeNameSegment(segment: string) {
  let shouldCapitalize = true;
  let result = "";

  for (const char of segment.toLowerCase()) {
    if (/[a-z]/i.test(char)) {
      result += shouldCapitalize ? char.toUpperCase() : char;
      shouldCapitalize = false;
      continue;
    }

    result += char;
    shouldCapitalize = char === "'" || char === "-" || char === " ";
  }

  return result;
}

export function stripEmojiFromDisplayName(value: string) {
  return value
    .replace(EMOJI_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalizeDisplayName(value: string) {
  const stripped = stripEmojiFromDisplayName(value);
  if (!stripped) return "";

  return stripped
    .split(/\s*&\s*/)
    .map((part) =>
      part
        .split(/\s+/)
        .map((segment) => normalizeNameSegment(segment))
        .join(" ")
    )
    .join(" & ");
}

export function compareDisplayNamesByFirstName(a: string, b: string) {
  const normalizedA = normalizeDisplayName(a);
  const normalizedB = normalizeDisplayName(b);
  const firstA = normalizedA.split(/\s+/)[0] ?? normalizedA;
  const firstB = normalizedB.split(/\s+/)[0] ?? normalizedB;
  const firstCompare = firstA.localeCompare(firstB, undefined, { sensitivity: "base" });
  if (firstCompare !== 0) return firstCompare;
  return normalizedA.localeCompare(normalizedB, undefined, { sensitivity: "base" });
}

export function displayNameOrFallback(value: string, fallback = "them") {
  const normalized = normalizeDisplayName(value);
  return normalized || fallback;
}
