import { Octokit } from "@octokit/rest";

export interface Release {
  version: string; // e.g., '0.92.0'
  tagName: string; // e.g., 'rust-v0.92.0'
  body: string; // Full release notes markdown
  url: string; // GitHub release URL
  publishedAt: string; // ISO date string
}

const OWNER = "openai";
const REPO = "codex";

// Tags containing these strings are considered pre-release
const PRE_RELEASE_PATTERNS = ["alpha", "beta", "rc"];

function isPreRelease(tagName: string): boolean {
  const lowerTag = tagName.toLowerCase();
  return PRE_RELEASE_PATTERNS.some((pattern) => lowerTag.includes(pattern));
}

function extractVersion(tagName: string): string {
  return tagName.replace("rust-v", "");
}

export async function getLatestStableRelease(
  octokit: Octokit = new Octokit()
): Promise<Release | null> {
  try {
    const { data: releases } = await octokit.repos.listReleases({
      owner: OWNER,
      repo: REPO,
      per_page: 10,
    });

    for (const release of releases) {
      if (!release.tag_name || isPreRelease(release.tag_name)) {
        continue;
      }

      return {
        version: extractVersion(release.tag_name),
        tagName: release.tag_name,
        body: release.body ?? "",
        url: release.html_url,
        publishedAt: release.published_at ?? release.created_at,
      };
    }

    return null;
  } catch {
    return null;
  }
}
