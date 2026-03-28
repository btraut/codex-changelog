import { describe, expect, it } from 'vitest';
import { getLatestVscodeRelease, parseExtensionQueryResponse } from './vscode.js';

const sampleResponse = {
  results: [
    {
      extensions: [
        {
          versions: [
            {
              version: '26.5325.31654',
              lastUpdated: '2026-03-28T02:04:21.46Z',
            },
            {
              version: '26.5325.31654',
              lastUpdated: '2026-03-28T01:51:56.8Z',
            },
            {
              version: '26.5325.21211',
              lastUpdated: '2026-03-26T22:08:24.000Z',
            },
          ],
        },
      ],
    },
  ],
};

describe('parseExtensionQueryResponse', () => {
  it('returns the newest VS Code version from marketplace metadata', () => {
    const release = parseExtensionQueryResponse(sampleResponse);

    expect(release?.version).toBe('26.5325.31654');
    expect(release?.publishedAt).toBe('2026-03-28T02:04:21.460Z');
    expect(release?.url).toBe('https://marketplace.visualstudio.com/items?itemName=openai.chatgpt');
  });

  it('returns null when response has no versions', () => {
    expect(parseExtensionQueryResponse({ results: [] })).toBeNull();
  });
});

describe('getLatestVscodeRelease', () => {
  it('fetches and parses the latest VS Code release', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => sampleResponse,
    }) as Response;

    const release = await getLatestVscodeRelease(mockFetch);
    expect(release?.version).toBe('26.5325.31654');
  });
});
