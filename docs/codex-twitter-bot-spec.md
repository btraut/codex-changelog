# Codex Changelog Twitter Bot

## Overview

A Twitter/X bot that automatically posts whenever a new stable version of OpenAI Codex is released, extracting and sharing the "New Features" section from the release notes.

**Target Twitter account:** TBD (you'll create this)
**Source:** GitHub releases at `openai/codex`
**Reference:** Similar to [@ClaudeCodeLog](https://twitter.com/ClaudeCodeLog) from [marckrenn/claude-code-changelog](https://github.com/marckrenn/claude-code-changelog)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions (Free)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Trigger    │───▶│   Extract    │───▶│    Post      │       │
│  │  (Schedule   │    │   Release    │    │   Tweet      │       │
│  │   or Webhook)│    │   Notes      │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Check last   │    │ Parse "New   │    │ Twitter API  │       │
│  │ posted ver   │    │ Features"    │    │ v2 (OAuth)   │       │
│  │ from repo    │    │ section      │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why GitHub Actions?

1. **Free tier** — 2,000 minutes/month for public repos (more than enough for hourly checks)
2. **No server to maintain** — Runs on GitHub's infrastructure
3. **Built-in secrets management** — Secure storage for Twitter API keys
4. **Native GitHub integration** — Easy access to release data
5. **Simple deployment** — Just push code; no Docker/hosting needed

---

## Components

### 1. Release Detection

**Option A: Scheduled polling (Recommended for simplicity)**
- GitHub Action runs on a cron schedule (e.g., every hour)
- Fetches latest release from `openai/codex` via GitHub API
- Compares against last-posted version stored in repo

**Option B: Webhook-triggered**
- Configure GitHub webhook on `openai/codex` (requires repo access)
- Not feasible since you don't control the Codex repo

**Decision:** Use Option A (scheduled polling)

### 2. Version State Tracking

Store the last-posted version in a simple file in this repo:
```
data/last-posted-version.txt
```

The GitHub Action will:
1. Read this file to get the last version
2. Compare against latest release
3. If new, post tweet and update the file
4. Commit the change back to the repo

### 3. Release Notes Parsing

Codex releases have structured markdown. Example:
```markdown
## New Features
- Feature 1 description (#1234)
- Feature 2 description (#5678)

## Bug Fixes
...
```

We'll extract just the "New Features" section using simple regex/string parsing.

### 4. Tweet Formatting

**Constraints:**
- Twitter character limit: 280 characters
- Need to fit: version number, features, link

**Format for single tweet (if features fit):**
```
🚀 Codex v0.92.0 released!

New Features:
• Dynamic tools injection
• Thread list filtering
• Multi-agent collaboration improvements

Release notes: https://github.com/openai/codex/releases/tag/rust-v0.92.0
```

**Format for thread (if features don't fit):**
- Tweet 1: Version announcement + first features
- Tweet 2+: Additional features
- Final tweet: Link to full release notes

### 5. Twitter API Setup

**Requirements:**
1. Twitter Developer Account (free tier available)
2. Create a Twitter App with OAuth 1.0a
3. Generate Access Token + Secret (for posting)
4. Store credentials as GitHub Secrets

---

## Implementation Plan

### Task 1: Set Up Project Structure

**Files to create:**
```
codex-changelog/
├── .github/
│   └── workflows/
│       └── check-release.yml    # GitHub Action workflow
├── src/
│   ├── index.ts                 # Main entry point
│   ├── github.ts                # GitHub API client
│   ├── twitter.ts               # Twitter API client
│   ├── parser.ts                # Release notes parser
│   └── formatter.ts             # Tweet formatter
├── data/
│   └── last-posted-version.txt  # State file
├── package.json
├── tsconfig.json
└── README.md
```

**Commands:**
```bash
cd /Users/btraut/Development/codex-changelog
npm init -y
npm install typescript @types/node tsx --save-dev
npm install twitter-api-v2 @octokit/rest
npx tsc --init
```

**Verification:** `npm run build` succeeds

---

### Task 2: Implement GitHub Release Fetcher

**File:** `src/github.ts`

**Code changes:**
```typescript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit();

export interface Release {
  version: string;
  tagName: string;
  body: string;
  url: string;
  publishedAt: string;
}

export async function getLatestStableRelease(): Promise<Release | null> {
  const { data: releases } = await octokit.repos.listReleases({
    owner: "openai",
    repo: "codex",
    per_page: 10,
  });

  // Filter for stable releases (exclude alpha/beta/rc)
  const stable = releases.find(
    (r) => !r.tag_name.includes("alpha") &&
           !r.tag_name.includes("beta") &&
           !r.tag_name.includes("rc")
  );

  if (!stable) return null;

  // Extract version from tag (e.g., "rust-v0.92.0" -> "0.92.0")
  const version = stable.tag_name.replace("rust-v", "");

  return {
    version,
    tagName: stable.tag_name,
    body: stable.body || "",
    url: stable.html_url,
    publishedAt: stable.published_at || "",
  };
}
```

**Tests to write:** `src/github.test.ts`
- Test that alpha/beta releases are filtered out
- Test version extraction from tag name
- Mock API response for deterministic testing

**Verification:**
```bash
npx tsx src/github.ts  # Add a simple test call at bottom
```

---

### Task 3: Implement Release Notes Parser

**File:** `src/parser.ts`

**Code changes:**
```typescript
export interface ParsedFeatures {
  features: string[];
  raw: string;
}

export function parseNewFeatures(releaseBody: string): ParsedFeatures {
  // Find the "New Features" section
  const newFeaturesMatch = releaseBody.match(
    /## New Features\s*\n([\s\S]*?)(?=\n## |$)/
  );

  if (!newFeaturesMatch) {
    return { features: [], raw: "" };
  }

  const raw = newFeaturesMatch[1].trim();

  // Parse individual features (lines starting with -)
  const features = raw
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .map((line) => {
      // Clean up: remove leading "- ", PR references like (#1234)
      return line
        .replace(/^-\s*/, "")
        .replace(/\s*\(#\d+(?:,\s*#\d+)*\)\s*$/, "")
        .trim();
    })
    .filter((line) => line.length > 0);

  return { features, raw };
}
```

**Tests to write:** `src/parser.test.ts`
- Test extraction of New Features section
- Test handling of missing section
- Test PR reference removal
- Test multi-PR references like (#9817, #9818, #9918, #9899)

**Verification:** Parse the actual 0.92.0 release body (shown above)

---

### Task 4: Implement Tweet Formatter

**File:** `src/formatter.ts`

**Code changes:**
```typescript
const MAX_TWEET_LENGTH = 280;
const ELLIPSIS = "...";

export interface TweetThread {
  tweets: string[];
}

export function formatTweets(
  version: string,
  features: string[],
  releaseUrl: string
): TweetThread {
  if (features.length === 0) {
    return {
      tweets: [
        `🚀 Codex v${version} released!\n\nNo new features in this release.\n\n${releaseUrl}`,
      ],
    };
  }

  const header = `🚀 Codex v${version} released!\n\nNew Features:`;
  const footer = `\n\nFull release notes: ${releaseUrl}`;

  // Try to fit everything in one tweet
  const bulletPoints = features.map((f) => `• ${truncateFeature(f, 60)}`);
  const singleTweet = `${header}\n${bulletPoints.join("\n")}${footer}`;

  if (singleTweet.length <= MAX_TWEET_LENGTH) {
    return { tweets: [singleTweet] };
  }

  // Need a thread - first tweet gets header + as many features as fit
  const tweets: string[] = [];
  let currentTweet = header;
  let featureIndex = 0;

  for (const feature of features) {
    const bullet = `\n• ${truncateFeature(feature, 50)}`;

    // Check if adding this feature exceeds limit (leave room for "..." or footer)
    if (currentTweet.length + bullet.length > MAX_TWEET_LENGTH - 20) {
      tweets.push(currentTweet + "\n\n(cont...)");
      currentTweet = `Codex v${version} features (cont):`;
    }

    currentTweet += bullet;
    featureIndex++;
  }

  // Add final tweet with link
  if (currentTweet.length + footer.length <= MAX_TWEET_LENGTH) {
    tweets.push(currentTweet + footer);
  } else {
    tweets.push(currentTweet);
    tweets.push(`Full Codex v${version} release notes: ${releaseUrl}`);
  }

  return { tweets };
}

function truncateFeature(feature: string, maxLength: number): string {
  if (feature.length <= maxLength) return feature;
  return feature.slice(0, maxLength - 3) + "...";
}
```

**Tests to write:** `src/formatter.test.ts`
- Test single-tweet formatting
- Test thread creation for many features
- Test character limit compliance
- Test feature truncation

**Verification:** Format the 0.92.0 features and verify output

---

### Task 5: Implement Twitter Client

**File:** `src/twitter.ts`

**Code changes:**
```typescript
import { TwitterApi } from "twitter-api-v2";

export function createTwitterClient(): TwitterApi {
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });
}

export async function postThread(
  client: TwitterApi,
  tweets: string[]
): Promise<string[]> {
  const postedIds: string[] = [];
  let lastTweetId: string | undefined;

  for (const text of tweets) {
    const response = await client.v2.tweet({
      text,
      ...(lastTweetId && { reply: { in_reply_to_tweet_id: lastTweetId } }),
    });

    postedIds.push(response.data.id);
    lastTweetId = response.data.id;
  }

  return postedIds;
}
```

**Tests to write:** `src/twitter.test.ts`
- Mock Twitter API for testing
- Test thread posting with reply chaining
- Test error handling

**Verification:** Manual test with real credentials (after Task 7)

---

### Task 6: Implement Main Entry Point

**File:** `src/index.ts`

**Code changes:**
```typescript
import * as fs from "fs";
import * as path from "path";
import { getLatestStableRelease } from "./github";
import { parseNewFeatures } from "./parser";
import { formatTweets } from "./formatter";
import { createTwitterClient, postThread } from "./twitter";

const STATE_FILE = path.join(__dirname, "../data/last-posted-version.txt");

async function main() {
  console.log("Checking for new Codex releases...");

  // Get latest release
  const release = await getLatestStableRelease();
  if (!release) {
    console.log("No stable release found");
    return;
  }

  console.log(`Latest stable release: v${release.version}`);

  // Check if we've already posted this version
  const lastPosted = getLastPostedVersion();
  if (lastPosted === release.version) {
    console.log("Already posted this version, skipping");
    return;
  }

  // Parse features
  const { features } = parseNewFeatures(release.body);
  console.log(`Found ${features.length} new features`);

  // Format tweets
  const { tweets } = formatTweets(release.version, features, release.url);
  console.log(`Formatted into ${tweets.length} tweet(s)`);

  // Post to Twitter (only if not dry-run)
  if (process.env.DRY_RUN === "true") {
    console.log("DRY RUN - would post:");
    tweets.forEach((t, i) => console.log(`Tweet ${i + 1}:\n${t}\n`));
  } else {
    const client = createTwitterClient();
    const ids = await postThread(client, tweets);
    console.log(`Posted ${ids.length} tweet(s)`);
  }

  // Update state file
  saveLastPostedVersion(release.version);
  console.log(`Updated last-posted version to ${release.version}`);
}

function getLastPostedVersion(): string | null {
  try {
    return fs.readFileSync(STATE_FILE, "utf-8").trim();
  } catch {
    return null;
  }
}

function saveLastPostedVersion(version: string) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, version);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
```

**Verification:**
```bash
DRY_RUN=true npx tsx src/index.ts
```

---

### Task 7: Set Up Twitter Developer Account & App

**This is a manual task you'll need to do:**

1. Go to https://developer.twitter.com/
2. Sign up for a developer account (free tier is fine)
3. Create a new App in the Developer Portal
4. Set up OAuth 1.0a with Read and Write permissions
5. Generate Access Token and Access Token Secret
6. Save these 4 values:
   - API Key (Consumer Key)
   - API Secret (Consumer Secret)
   - Access Token
   - Access Token Secret

**Documentation:** https://developer.twitter.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api

**Verification:** You have all 4 credentials saved securely

---

### Task 8: Create GitHub Actions Workflow

**File:** `.github/workflows/check-release.yml`

**Code changes:**
```yaml
name: Check Codex Release

on:
  schedule:
    # Run every 15 minutes
    - cron: "*/15 * * * *"
  workflow_dispatch: # Allow manual trigger

jobs:
  check-and-post:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Check for new release and post
        env:
          TWITTER_API_KEY: ${{ secrets.TWITTER_API_KEY }}
          TWITTER_API_SECRET: ${{ secrets.TWITTER_API_SECRET }}
          TWITTER_ACCESS_TOKEN: ${{ secrets.TWITTER_ACCESS_TOKEN }}
          TWITTER_ACCESS_SECRET: ${{ secrets.TWITTER_ACCESS_SECRET }}
        run: npx tsx src/index.ts

      - name: Commit updated state
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/last-posted-version.txt
          git diff --staged --quiet || git commit -m "Update last-posted version"
          git push
```

**Verification:** Push to GitHub, trigger workflow manually via Actions tab

---

### Task 9: Configure GitHub Secrets

**Manual steps:**

1. Go to your repo on GitHub → Settings → Secrets and variables → Actions
2. Add these repository secrets:
   - `TWITTER_API_KEY`
   - `TWITTER_API_SECRET`
   - `TWITTER_ACCESS_TOKEN`
   - `TWITTER_ACCESS_SECRET`

**Verification:** Secrets show as configured in GitHub Settings

---

### Task 10: Initialize State & First Run

**Commands:**
```bash
# Get current latest version (so we don't tweet about old releases)
gh api repos/openai/codex/releases --jq '.[0].tag_name' | sed 's/rust-v//'

# Initialize the state file with current version
echo "0.92.0" > data/last-posted-version.txt

# Commit and push
git add -A
git commit -m "Initial bot setup"
git push
```

**Verification:**
- Workflow runs successfully (check Actions tab)
- No tweet posted (version already in state file)

---

## Testing Strategy

### Unit Tests
- `npm test` runs all tests via Jest or Vitest
- Mock external APIs (GitHub, Twitter)
- Test each module in isolation

### Integration Test
```bash
# Dry-run against real GitHub API
DRY_RUN=true npx tsx src/index.ts
```

### End-to-End Test
1. Temporarily set state file to an old version
2. Run workflow manually
3. Verify tweet posted correctly
4. Restore state file

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Twitter API rate limits | Hourly checks are well under limits (300 tweets/3hr) |
| Twitter API changes | Pin `twitter-api-v2` version; monitor for deprecations |
| GitHub API rate limits | Unauthenticated: 60/hr, but we only need 1 call/hr |
| Codex release format changes | Parser handles missing sections gracefully |
| Bot account suspension | Keep tweets informational, not spammy |

---

## Future Enhancements (Out of Scope)

- Post bug fixes summary too
- Include PR links in tweets
- Track release history in repo (like claude-code-changelog)
- Discord/Slack integration
- AI-generated summaries of features

---

## Appendix: Key Commands

```bash
# Development
npm install              # Install deps
npm run build           # Compile TypeScript
npm test                # Run tests
DRY_RUN=true npx tsx src/index.ts  # Test without posting

# Deployment
git push                # Deploys automatically via GitHub Actions

# Debugging
gh run list             # List recent workflow runs
gh run view <id>        # View specific run details
gh run view <id> --log  # View run logs
```

---

## Appendix: Twitter API v2 Free Tier Limits

- **Tweets:** 50 tweets per 24 hours (at app level)
- **Media uploads:** Available on free tier
- **Read access:** 10,000 tweets read per month

For hourly checks posting 1-2 tweets per release, free tier is sufficient.
