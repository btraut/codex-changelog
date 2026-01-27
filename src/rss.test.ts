import { describe, it, expect, vi } from 'vitest';
import { getLatestRelease, parseRssItems, extractVersion } from './rss.js';

const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>OpenAI Changelog</title>
    <item>
      <title><![CDATA[Codex CLI Release: 0.92.0]]></title>
      <link>https://developers.openai.com/changelog/codex-cli-release-0-92-0</link>
      <guid>codex-cli-release-0-92-0</guid>
      <description>0.92.0</description>
      <pubDate>Mon, 27 Jan 2026 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<h2>New Features</h2>
<ul>
<li>API v2 threads can now inject dynamic tools at startup. (#9539)</li>
<li>Multi-agent collaboration is more capable. (#9817, #9818)</li>
</ul>]]></content:encoded>
    </item>
    <item>
      <title><![CDATA[Codex CLI Release: 0.91.0]]></title>
      <link>https://developers.openai.com/changelog/codex-cli-release-0-91-0</link>
      <guid>codex-cli-release-0-91-0</guid>
      <description>0.91.0</description>
      <pubDate>Sat, 25 Jan 2026 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<h2>Changes</h2>
<ul>
<li>Reduced max sub-agents to 6.</li>
</ul>]]></content:encoded>
    </item>
  </channel>
</rss>`;

describe('extractVersion', () => {
  it('extracts version from standard title', () => {
    expect(extractVersion('Codex CLI Release: 0.92.0')).toBe('0.92.0');
  });

  it('extracts version with different formats', () => {
    expect(extractVersion('Codex Release 1.0.0')).toBe('1.0.0');
    expect(extractVersion('Codex v2.1.3')).toBe('2.1.3');
  });

  it('returns null for non-Codex titles', () => {
    expect(extractVersion('GPT-4 Update')).toBe(null);
    expect(extractVersion('API Changes')).toBe(null);
  });

  it('returns null for titles without version', () => {
    expect(extractVersion('Codex CLI Update')).toBe(null);
  });
});

describe('parseRssItems', () => {
  it('parses multiple items from RSS', () => {
    const releases = parseRssItems(sampleRss);
    expect(releases).toHaveLength(2);
  });

  it('extracts version correctly', () => {
    const releases = parseRssItems(sampleRss);
    expect(releases[0]?.version).toBe('0.92.0');
    expect(releases[1]?.version).toBe('0.91.0');
  });

  it('extracts title correctly', () => {
    const releases = parseRssItems(sampleRss);
    expect(releases[0]?.title).toBe('Codex CLI Release: 0.92.0');
  });

  it('extracts URL correctly', () => {
    const releases = parseRssItems(sampleRss);
    expect(releases[0]?.url).toBe('https://developers.openai.com/changelog/codex-cli-release-0-92-0');
  });

  it('extracts body with HTML content', () => {
    const releases = parseRssItems(sampleRss);
    expect(releases[0]?.body).toContain('<h2>New Features</h2>');
    expect(releases[0]?.body).toContain('API v2 threads');
  });

  it('parses pubDate to ISO string', () => {
    const releases = parseRssItems(sampleRss);
    expect(releases[0]?.publishedAt).toBe('2026-01-27T10:00:00.000Z');
  });

  it('returns empty array for empty RSS', () => {
    const releases = parseRssItems('<rss><channel></channel></rss>');
    expect(releases).toHaveLength(0);
  });

  it('skips items without valid Codex version', () => {
    const rssWithMixed = `<rss><channel>
      <item>
        <title>GPT-4 Update</title>
        <link>https://example.com</link>
        <pubDate>Mon, 27 Jan 2026 10:00:00 GMT</pubDate>
        <content:encoded><![CDATA[Some content]]></content:encoded>
      </item>
      <item>
        <title>Codex CLI Release: 0.92.0</title>
        <link>https://example.com/codex</link>
        <pubDate>Mon, 27 Jan 2026 10:00:00 GMT</pubDate>
        <content:encoded><![CDATA[Codex content]]></content:encoded>
      </item>
    </channel></rss>`;

    const releases = parseRssItems(rssWithMixed);
    expect(releases).toHaveLength(1);
    expect(releases[0]?.version).toBe('0.92.0');
  });

  it('decodes HTML entities when not using CDATA', () => {
    const htmlEncodedRss = `<rss><channel>
      <item>
        <title>Codex CLI Release: 0.93.0</title>
        <link>https://example.com</link>
        <pubDate>Mon, 27 Jan 2026 10:00:00 GMT</pubDate>
        <content:encoded>&lt;h2&gt;New Features&lt;/h2&gt;
&lt;ul&gt;
&lt;li&gt;Feature one&lt;/li&gt;
&lt;li&gt;Feature two&lt;/li&gt;
&lt;/ul&gt;</content:encoded>
      </item>
    </channel></rss>`;

    const releases = parseRssItems(htmlEncodedRss);
    expect(releases).toHaveLength(1);
    expect(releases[0]?.body).toContain('<h2>New Features</h2>');
    expect(releases[0]?.body).toContain('<li>Feature one</li>');
  });
});

describe('getLatestRelease', () => {
  it('returns latest release on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleRss),
    });

    const release = await getLatestRelease(mockFetch);

    expect(release).not.toBeNull();
    expect(release?.version).toBe('0.92.0');
    expect(release?.title).toBe('Codex CLI Release: 0.92.0');
  });

  it('returns null on fetch error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const release = await getLatestRelease(mockFetch);
    expect(release).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const release = await getLatestRelease(mockFetch);
    expect(release).toBeNull();
  });

  it('returns null when no Codex releases in feed', async () => {
    const emptyRss = '<rss><channel><item><title>Other Product</title></item></channel></rss>';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(emptyRss),
    });

    const release = await getLatestRelease(mockFetch);
    expect(release).toBeNull();
  });
});
