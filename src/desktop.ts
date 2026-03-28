import type { FetchFn } from './fetch.js';

export interface DesktopRelease {
  version: string;
  buildNumber: string;
  publishedAt: string;
  downloadUrl: string;
  url: string;
}

const APPCAST_URL = 'https://persistent.oaistatic.com/codex-app-prod/appcast.xml';
const DESKTOP_CANONICAL_URL = 'https://developers.openai.com/codex/changelog/';

async function fetchAppcastXml(fetchFn: FetchFn): Promise<string> {
  const response = await fetchFn(APPCAST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Codex desktop appcast (${response.status} ${response.statusText})`);
  }

  return response.text();
}

export function parseAppcastItems(xml: string): DesktopRelease[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  return items.map(([, itemContent]) => {
    const version = itemContent.match(/<sparkle:shortVersionString>(.*?)<\/sparkle:shortVersionString>/)?.[1]
      ?? itemContent.match(/<title>(.*?)<\/title>/)?.[1]
      ?? '';
    const buildNumber = itemContent.match(/<sparkle:version>(.*?)<\/sparkle:version>/)?.[1] ?? '';
    const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
    const downloadUrl = itemContent.match(/<enclosure[^>]*url="([^"]+)"/)?.[1] ?? '';

    return {
      version,
      buildNumber,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      downloadUrl,
      url: DESKTOP_CANONICAL_URL,
    };
  }).filter((item) => item.version.length > 0);
}

export async function getLatestDesktopRelease(fetchFn: FetchFn = fetch): Promise<DesktopRelease | null> {
  const xml = await fetchAppcastXml(fetchFn);
  const releases = parseAppcastItems(xml);
  return releases[0] ?? null;
}

export { APPCAST_URL, DESKTOP_CANONICAL_URL };
