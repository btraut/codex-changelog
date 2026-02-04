const namedEntities: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

function decodeNumericEntity(entity: string): string | null {
  const isHex = entity.startsWith("#x") || entity.startsWith("#X");
  const numeric = isHex ? entity.slice(2) : entity.slice(1);
  const codePoint = Number.parseInt(numeric, isHex ? 16 : 10);
  if (Number.isNaN(codePoint)) return null;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#")) {
      return decodeNumericEntity(entity) ?? match;
    }
    const decoded = namedEntities[entity.toLowerCase()];
    return decoded ?? match;
  });
}
