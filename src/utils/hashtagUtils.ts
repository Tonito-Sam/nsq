export function extractHashtagsFromText(text: string): string[] {
  if (!text) return [];
  // match sequences starting with # followed by letters/numbers/underscore/hyphen (unicode aware)
  const raw = text.match(/#([\p{L}0-9_\-]+)/giu) || [];
  const unique = Array.from(new Set(raw.map(m => (m.startsWith('#') ? m : `#${m}`))));
  return unique;
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { extractHashtagsFromText, escapeRegExp };
