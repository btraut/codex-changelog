export interface ParsedRelease {
  features: string[]; // Clean feature descriptions
  bugFixes: number;   // Count of bug fixes
  docs: number;       // Count of documentation changes
  chores: number;     // Count of chores
  raw: string;        // Original section content
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
 * Counts list items in an HTML section.
 */
function countHtmlSectionItems(body: string, sectionName: string): number {
  const regex = new RegExp(`<h2[^>]*>${sectionName}<\\/h2>([\\s\\S]*?)(?=<h2|$)`, 'i');
  const match = body.match(regex);
  if (!match) return 0;

  const items = match[1].match(/<li[^>]*>/gi);
  return items?.length ?? 0;
}

/**
 * Counts list items in a markdown section.
 */
function countMarkdownSectionItems(body: string, sectionName: string): number {
  const regex = new RegExp(`## ${sectionName}[^\\S\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = body.match(regex);
  if (!match) return 0;

  const lines = match[1].split('\n');
  return lines.filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* ')).length;
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
    bugFixes: countMarkdownSectionItems(body, 'Bug Fixes'),
    docs: countMarkdownSectionItems(body, 'Documentation'),
    chores: countMarkdownSectionItems(body, 'Chores'),
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
    bugFixes: countHtmlSectionItems(body, 'Bug Fixes'),
    docs: countHtmlSectionItems(body, 'Documentation'),
    chores: countHtmlSectionItems(body, 'Chores'),
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

  return { features: [], bugFixes: 0, docs: 0, chores: 0, raw: '' };
}
