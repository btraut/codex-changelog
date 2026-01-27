import { describe, it, expect, vi, beforeEach } from "vitest";
import { Octokit } from "@octokit/rest";
import { getLatestStableRelease, type Release } from "./github.js";

// Mock release data factory
function createMockRelease(overrides: {
  tag_name: string;
  html_url?: string;
  body?: string | null;
  published_at?: string | null;
  created_at?: string;
}) {
  return {
    tag_name: overrides.tag_name,
    html_url: overrides.html_url ?? `https://github.com/openai/codex/releases/tag/${overrides.tag_name}`,
    body: overrides.body === null ? null : (overrides.body ?? `Release notes for ${overrides.tag_name}`),
    published_at: overrides.published_at === null ? null : (overrides.published_at ?? "2024-01-15T10:00:00Z"),
    created_at: overrides.created_at ?? "2024-01-15T09:00:00Z",
  };
}

// Create a mock Octokit instance
function createMockOctokit(releases: ReturnType<typeof createMockRelease>[]) {
  return {
    repos: {
      listReleases: vi.fn().mockResolvedValue({ data: releases }),
    },
  } as unknown as Octokit;
}

function createErrorOctokit(error: Error) {
  return {
    repos: {
      listReleases: vi.fn().mockRejectedValue(error),
    },
  } as unknown as Octokit;
}

describe("getLatestStableRelease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latest stable when multiple releases exist", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({
        tag_name: "rust-v0.92.0",
        published_at: "2024-01-15T10:00:00Z",
      }),
      createMockRelease({
        tag_name: "rust-v0.91.0",
        published_at: "2024-01-10T10:00:00Z",
      }),
      createMockRelease({
        tag_name: "rust-v0.90.0",
        published_at: "2024-01-05T10:00:00Z",
      }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.version).toBe("0.92.0");
    expect(release?.tagName).toBe("rust-v0.92.0");
  });

  it("skips alpha releases", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({ tag_name: "rust-v0.93.0-alpha" }),
      createMockRelease({ tag_name: "rust-v0.93.0-alpha.1" }),
      createMockRelease({ tag_name: "rust-v0.92.0" }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.version).toBe("0.92.0");
  });

  it("skips beta releases", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({ tag_name: "rust-v0.93.0-beta" }),
      createMockRelease({ tag_name: "rust-v0.93.0-beta.2" }),
      createMockRelease({ tag_name: "rust-v0.92.0" }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.version).toBe("0.92.0");
  });

  it("skips rc releases", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({ tag_name: "rust-v0.93.0-rc1" }),
      createMockRelease({ tag_name: "rust-v0.93.0-rc.2" }),
      createMockRelease({ tag_name: "rust-v0.92.0" }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.version).toBe("0.92.0");
  });

  it("skips all pre-release patterns correctly", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({ tag_name: "rust-v0.95.0-ALPHA" }), // uppercase
      createMockRelease({ tag_name: "rust-v0.94.0-Beta" }), // mixed case
      createMockRelease({ tag_name: "rust-v0.93.0-RC1" }), // uppercase RC
      createMockRelease({ tag_name: "rust-v0.92.0" }), // stable
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.version).toBe("0.92.0");
  });

  it("extracts version from 'rust-v0.92.0' format", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({
        tag_name: "rust-v0.92.0",
        html_url: "https://github.com/openai/codex/releases/tag/rust-v0.92.0",
        body: "## What's Changed\n- Feature A\n- Bug fix B",
        published_at: "2024-01-15T10:00:00Z",
      }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).toEqual<Release>({
      version: "0.92.0",
      tagName: "rust-v0.92.0",
      body: "## What's Changed\n- Feature A\n- Bug fix B",
      url: "https://github.com/openai/codex/releases/tag/rust-v0.92.0",
      publishedAt: "2024-01-15T10:00:00Z",
    });
  });

  it("returns null when no releases exist", async () => {
    const mockOctokit = createMockOctokit([]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).toBeNull();
  });

  it("returns null when only pre-release versions exist", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({ tag_name: "rust-v0.93.0-alpha" }),
      createMockRelease({ tag_name: "rust-v0.92.0-beta" }),
      createMockRelease({ tag_name: "rust-v0.91.0-rc1" }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).toBeNull();
  });

  it("handles API errors gracefully", async () => {
    const mockOctokit = createErrorOctokit(new Error("API rate limit exceeded"));

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).toBeNull();
  });

  it("handles network errors gracefully", async () => {
    const mockOctokit = createErrorOctokit(new Error("Network error"));

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).toBeNull();
  });

  it("uses created_at as fallback when published_at is null", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({
        tag_name: "rust-v0.92.0",
        published_at: null,
        created_at: "2024-01-15T09:00:00Z",
      }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.publishedAt).toBe("2024-01-15T09:00:00Z");
  });

  it("handles empty body gracefully", async () => {
    const mockOctokit = createMockOctokit([
      createMockRelease({
        tag_name: "rust-v0.92.0",
        body: null,
      }),
    ]);

    const release = await getLatestStableRelease(mockOctokit);

    expect(release).not.toBeNull();
    expect(release?.body).toBe("");
  });
});
