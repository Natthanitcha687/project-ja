// Utility helpers for text input sanitization

// Strip emoji and most pictographic symbols from user input while
// keeping normal text (Thai, Latin, numbers, common punctuation).
// This is best-effort and safe to call on every keystroke.
export function stripEmojis(value) {
  if (!value) return "";
  const s = String(value);
  // Remove surrogate-pair emojis and common symbol ranges
  return s.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\u24C2|\uFE0F|[\u2190-\u21FF])/g, "");
}

// Strip emojis and special characters, keeping only:
// - Thai / English letters
// - digits
// - space
// - dot, dash, slash
// - @ ( ) _ for flexibility in names/text
export function stripEmojisAndSpecials(value) {
  if (!value) return "";
  const noEmoji = stripEmojis(value);
  return noEmoji.replace(/[^a-zA-Z0-9ก-๙\s.@()_\/-]/g, "");
}
