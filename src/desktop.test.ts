import { describe, expect, it } from 'vitest';
import { getLatestDesktopRelease, parseAppcastItems } from './desktop.js';

const sampleAppcast = `<?xml version="1.0" standalone="yes"?>
<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
  <channel>
    <title>Codex</title>
    <item>
      <title>26.325.31654</title>
      <pubDate>Sat, 28 Mar 2026 01:39:42 +0000</pubDate>
      <sparkle:version>1272</sparkle:version>
      <sparkle:shortVersionString>26.325.31654</sparkle:shortVersionString>
      <enclosure url="https://persistent.oaistatic.com/codex-app-prod/Codex-darwin-arm64-26.325.31654.zip" length="187655220" type="application/octet-stream" />
    </item>
    <item>
      <title>26.325.21211</title>
      <pubDate>Thu, 26 Mar 2026 21:54:52 +0000</pubDate>
      <sparkle:version>1255</sparkle:version>
      <sparkle:shortVersionString>26.325.21211</sparkle:shortVersionString>
      <enclosure url="https://persistent.oaistatic.com/codex-app-prod/Codex-darwin-arm64-26.325.21211.zip" length="187625247" type="application/octet-stream" />
    </item>
  </channel>
</rss>`;

describe('parseAppcastItems', () => {
  it('parses desktop appcast items', () => {
    const releases = parseAppcastItems(sampleAppcast);

    expect(releases).toHaveLength(2);
    expect(releases[0]?.version).toBe('26.325.31654');
    expect(releases[0]?.buildNumber).toBe('1272');
    expect(releases[0]?.downloadUrl).toContain('Codex-darwin-arm64-26.325.31654.zip');
    expect(releases[0]?.publishedAt).toBe('2026-03-28T01:39:42.000Z');
  });
});

describe('getLatestDesktopRelease', () => {
  it('returns the latest appcast item', async () => {
    const mockFetch = async () => ({
      ok: true,
      text: async () => sampleAppcast,
    }) as Response;

    const release = await getLatestDesktopRelease(mockFetch);

    expect(release?.version).toBe('26.325.31654');
    expect(release?.buildNumber).toBe('1272');
  });
});
