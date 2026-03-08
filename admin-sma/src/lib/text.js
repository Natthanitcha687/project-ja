// Utility helpers for admin text input sanitization

export function stripEmojis(value) {
  if (!value) return "";
  const s = String(value);
  return s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\uFE0F]/g, "");
}
