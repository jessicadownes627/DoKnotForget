const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

export function stripEmojiFromDisplayName(value: string) {
  return value
    .replace(EMOJI_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function displayNameOrFallback(value: string, fallback = "them") {
  const stripped = stripEmojiFromDisplayName(value);
  return stripped || fallback;
}
