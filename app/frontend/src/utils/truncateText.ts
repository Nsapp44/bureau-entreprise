/** Truncate `text` to at most `maxChars` characters, ending with "…" if cut. */
export function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  if (maxChars === 1) return "…";
  return text.slice(0, maxChars - 1).trimEnd() + "…";
}
