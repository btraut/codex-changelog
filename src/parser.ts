export interface ParsedRelease {
  features: string[];  // Clean feature descriptions
  bugFixes: string[];  // Bug fix descriptions
  docs: string[];      // Documentation change descriptions
  chores: string[];    // Chore descriptions
  raw: string;         // Original section content
}

/**
 * Cleans a feature string by removing HTML tags, PR references, and trimming.
 */
function cleanFeature(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags first
    .replace(/\s*\(#\d+(?:,\s*#\d+)*\)\s*/g, '') // Then remove PR refs like (#1234) or (#1234, #5678)
    .replace(/\s*\(#\d+\)\s*/g, '') // Catch any remaining single PR refs
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extracts list items from an HTML section.
 */
function extractHtmlSectionItems(body: string, sectionName: string): string[] {
  const regex = new RegExp(`<h2[^>]*>${sectionName}<\\/h2>([\\s\\S]*?)(?=<h2|$)`, 'i');
  const match = body.match(regex);
  if (!match) return [];

  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(match[1])) !== null) {
    const item = cleanFeature(liMatch[1]);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

/**
 * Extracts list items from a markdown section.
 */
function extractMarkdownSectionItems(body: string, sectionName: string): string[] {
  const regex = new RegExp(`## ${sectionName}[^\\S\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = body.match(regex);
  if (!match) return [];

  const items: string[] = [];
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const item = cleanFeature(trimmed.slice(2));
      if (item) {
        items.push(item);
      }
    }
  }
  return items;
}

/**
 * Parses release notes from markdown format.
 */
function parseMarkdown(body: string): ParsedRelease | null {
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

  return {
    features,
    bugFixes: extractMarkdownSectionItems(body, 'Bug Fixes'),
    docs: extractMarkdownSectionItems(body, 'Documentation'),
    chores: extractMarkdownSectionItems(body, 'Chores'),
    raw,
  };
}

/**
 * Parses release notes from HTML format (RSS feed).
 */
function parseHtml(body: string): ParsedRelease | null {
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

  return {
    features,
    bugFixes: extractHtmlSectionItems(body, 'Bug Fixes'),
    docs: extractHtmlSectionItems(body, 'Documentation'),
    chores: extractHtmlSectionItems(body, 'Chores'),
    raw,
  };
}

/**
 * Parses release notes to extract features and count other sections.
 * Supports both markdown (GitHub releases) and HTML (RSS feed) formats.
 */
export function parseNewFeatures(releaseBody: string): ParsedRelease {
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

  return { features: [], bugFixes: [], docs: [], chores: [], raw: '' };
}
