import { decodeHtmlEntities } from './html.js';
import type { FetchFn } from './fetch.js';

export interface Release {
  version: string;      // e.g., '0.92.0'
  title: string;        // e.g., 'Codex CLI Release: 0.92.0'
  body: string;         // Full release notes HTML
  url: string;          // Changelog URL
  publishedAt: string;  // ISO date string
}

const RSS_URL = 'https://developers.openai.com/codex/changelog/rss.xml';

async function fetchRssXml(fetchFn: FetchFn): Promise<string> {
  const response = await fetchFn(RSS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Codex RSS feed (${response.status} ${response.statusText})`);
  }

  return response.text();
}

function extractVersion(title: string): string | null {
  if (!/Codex CLI Release/i.test(title)) {
    return null;
  }

  const match = title.match(/(\d+\.\d+\.\d+)/);
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

export async function getLatestRelease(fetchFn: FetchFn = fetch): Promise<Release | null> {
  const xml = await fetchRssXml(fetchFn);
  const releases = parseRssItems(xml);

  return releases[0] ?? null;
}

export async function getAllReleases(fetchFn: FetchFn = fetch): Promise<Release[]> {
  const xml = await fetchRssXml(fetchFn);
  return parseRssItems(xml);
}

/**
 * Compare semantic versions. Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

/**
 * Get releases newer than a given version, sorted oldest to newest.
 */
export async function getReleasesNewerThan(
  version: string,
  fetchFn: FetchFn = fetch
): Promise<Release[]> {
  const allReleases = await getAllReleases(fetchFn);

  return allReleases
    .filter(r => compareVersions(r.version, version) > 0)
    .sort((a, b) => compareVersions(a.version, b.version));
}

// Export for testing
export { parseRssItems, extractVersion };
