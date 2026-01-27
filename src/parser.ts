export interface ParsedFeatures {
  features: string[]; // Clean feature descriptions
  raw: string; // Original section content
}

/**
 * Cleans a feature string by removing PR references and trimming.
 */
function cleanFeature(text: string): string {
  return text
    .replace(/\s*\(#\d+(?:,\s*#\d+)*\)\s*/g, '') // Remove PR refs
    .replace(/<[^>]+>/g, '') // Remove any HTML tags
    .trim();
}

/**
 * Parses "New Features" section from markdown format.
 */
function parseMarkdown(body: string): ParsedFeatures | null {
  const sectionMatch = body.match(
    /## New Features[^\S\n]*\n([\s\S]*?)(?=\n## |$)/
  );

  if (!sectionMatch) {
    return null;
  }

  const raw = sectionMatch[0];
  const sectionContent = sectionMatch[1];
  const features: string[] = [];

  for (const line of sectionContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const feature = cleanFeature(trimmed.slice(2));
      if (feature) {
        features.push(feature);
      }
    }
  }

  return { features, raw };
}

/**
 * Parses "New Features" section from HTML format (RSS feed).
 */
function parseHtml(body: string): ParsedFeatures | null {
  // Find <h2>New Features</h2> followed by content until next <h2> or end
  const sectionMatch = body.match(
    /<h2[^>]*>New Features<\/h2>([\s\S]*?)(?=<h2|$)/i
  );

  if (!sectionMatch) {
    return null;
  }

  const raw = sectionMatch[0];
  const sectionContent = sectionMatch[1];
  const features: string[] = [];

  // Extract <li> items
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(sectionContent)) !== null) {
    const feature = cleanFeature(match[1]);
    if (feature) {
      features.push(feature);
    }
  }

  return { features, raw };
}

/**
 * Parses the "New Features" section from release notes.
 * Supports both markdown (GitHub releases) and HTML (RSS feed) formats.
 */
export function parseNewFeatures(releaseBody: string): ParsedFeatures {
  // Try HTML format first (RSS feed)
  const htmlResult = parseHtml(releaseBody);
  if (htmlResult && htmlResult.features.length > 0) {
    return htmlResult;
  }

  // Fall back to markdown format (GitHub releases)
  const mdResult = parseMarkdown(releaseBody);
  if (mdResult) {
    return mdResult;
  }

  return { features: [], raw: '' };
}
