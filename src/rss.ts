export interface Release {
  version: string;      // e.g., '0.92.0'
  title: string;        // e.g., 'Codex CLI Release: 0.92.0'
  body: string;         // Full release notes HTML
  url: string;          // Changelog URL
  publishedAt: string;  // ISO date string
}

const RSS_URL = 'https://developers.openai.com/changelog/rss.xml';

/**
 * Decodes HTML entities in a string.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractVersion(title: string): string | null {
  // Match "Codex CLI Release: X.Y.Z" or similar patterns
  const match = title.match(/Codex.*?(\d+\.\d+\.\d+)/i);
  return match ? match[1] : null;
}

function parseRssItems(xml: string): Release[] {
  const releases: Release[] = [];

  // Match all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemContent = itemMatch[1];

    // Extract fields
    const title = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? itemContent.match(/<title>(.*?)<\/title>/)?.[1]
      ?? '';

    const link = itemContent.match(/<link>(.*?)<\/link>/)?.[1] ?? '';

    const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';

    // content:encoded may have CDATA or HTML-encoded content
    let body = itemContent.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1]
      ?? itemContent.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1]
      ?? '';

    // Decode HTML entities if not using CDATA
    if (body && !itemContent.includes('<content:encoded><![CDATA[')) {
      body = decodeHtmlEntities(body);
    }

    const version = extractVersion(title);

    if (version) {
      releases.push({
        version,
        title,
        body,
        url: link,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      });
    }
  }

  return releases;
}

export async function getLatestRelease(fetchFn: typeof fetch = fetch): Promise<Release | null> {
  try {
    const response = await fetchFn(RSS_URL);
    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const releases = parseRssItems(xml);

    return releases[0] ?? null;
  } catch {
    return null;
  }
}

// Export for testing
export { parseRssItems, extractVersion };
