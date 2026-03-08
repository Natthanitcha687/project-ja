// Utility helpers for text input sanitization

// Strip emoji and most pictographic symbols from user input while
// keeping normal text (Thai, Latin, numbers, common punctuation).
// This is best-effort and safe to call on every keystroke.
export function stripEmojis(value) {
  if (!value) return "";
  const s = String(value);
  // Remove surrogate-pair emojis and common symbol ranges
  return s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\uFE0F]/g, "");
}
