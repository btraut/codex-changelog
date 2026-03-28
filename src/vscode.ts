import type { FetchFn } from './fetch.js';

export interface VscodeRelease {
  version: string;
  publishedAt: string;
  url: string;
}

const EXTENSION_QUERY_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
const VSCODE_MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=openai.chatgpt';

interface ExtensionQueryResponse {
  results?: Array<{
    extensions?: Array<{
      versions?: Array<{
        version?: string;
        lastUpdated?: string;
      }>;
    }>;
  }>;
}

async function fetchExtensionQuery(fetchFn: FetchFn): Promise<ExtensionQueryResponse> {
  const response = await fetchFn(EXTENSION_QUERY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json;api-version=7.2-preview.1',
      'X-Market-Client-Id': 'codex-changelog',
    },
    body: JSON.stringify({
      filters: [
        {
          criteria: [
            { filterType: 7, value: 'openai.chatgpt' },
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: 950,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch VS Code extension metadata (${response.status} ${response.statusText})`);
  }

  return response.json() as Promise<ExtensionQueryResponse>;
}

export function parseExtensionQueryResponse(payload: ExtensionQueryResponse): VscodeRelease | null {
  const versions = payload.results?.[0]?.extensions?.[0]?.versions;
  const latestVersion = versions?.find((version) => version.version && version.lastUpdated);

  if (!latestVersion?.version || !latestVersion.lastUpdated) {
    return null;
  }

  return {
    version: latestVersion.version,
    publishedAt: new Date(latestVersion.lastUpdated).toISOString(),
    url: VSCODE_MARKETPLACE_URL,
  };
}

export async function getLatestVscodeRelease(fetchFn: FetchFn = fetch): Promise<VscodeRelease | null> {
  const payload = await fetchExtensionQuery(fetchFn);
  return parseExtensionQueryResponse(payload);
}

export { EXTENSION_QUERY_URL, VSCODE_MARKETPLACE_URL };
