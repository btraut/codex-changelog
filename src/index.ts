import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLatestRelease, getReleasesNewerThan, type Release } from './rss.js';
import { parseNewFeatures } from './parser.js';
import { formatTweets } from './formatter.js';
import { createTwitterClient, postThread } from './twitter.js';

const STATE_FILE = path.join(process.cwd(), 'data', 'last-posted-version.txt');
const DRY_RUN = process.env.DRY_RUN === 'true';
const BACKFILL = process.env.BACKFILL === 'true';

function readLastPostedVersion(): string | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return fs.readFileSync(STATE_FILE, 'utf-8').trim();
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return null;
}

function writeLastPostedVersion(version: string): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, version + '\n');
}

async function postRelease(release: Release, client?: ReturnType<typeof createTwitterClient>): Promise<void> {
  console.log(`\n--- Processing v${release.version} ---`);

  // Parse release notes
  const { features } = parseNewFeatures(release.body);
  console.log(`Found ${features.length} features`);

  // Format tweets
  const { tweets } = formatTweets(release.version, features, release.url);
  console.log(`Formatted into ${tweets.length} tweet(s)`);

  if (DRY_RUN) {
    console.log('\n=== DRY RUN MODE ===');
    console.log('Would post the following tweets:\n');
    tweets.forEach((tweet, i) => {
      console.log(`--- Tweet ${i + 1} (${tweet.length} chars) ---`);
      console.log(tweet);
      console.log('');
    });
    console.log('=== END DRY RUN ===\n');
  } else {
    // Post to Twitter
    console.log('Posting to Twitter...');
    const twitterClient = client ?? createTwitterClient();
    const tweetIds = await postThread(twitterClient, tweets);
    console.log(`Posted ${tweetIds.length} tweet(s): ${tweetIds.join(', ')}`);
  }

  // Update state file
  writeLastPostedVersion(release.version);
  console.log(`Updated state file to v${release.version}`);
}

async function main(): Promise<void> {
  console.log('Checking for new Codex releases...');

  const lastPosted = readLastPostedVersion();
  console.log(`Last posted version: ${lastPosted ?? 'none'}`);

  if (BACKFILL && lastPosted) {
    // Backfill mode: post all releases newer than state file
    console.log('\n=== BACKFILL MODE ===');
    const releases = await getReleasesNewerThan(lastPosted);

    if (releases.length === 0) {
      console.log('No new releases to backfill');
      return;
    }

    console.log(`Found ${releases.length} release(s) to backfill: ${releases.map(r => r.version).join(', ')}`);

    const client = DRY_RUN ? undefined : createTwitterClient();

    for (const release of releases) {
      await postRelease(release, client);

      // Small delay between posts to avoid rate limiting
      if (!DRY_RUN && releases.indexOf(release) < releases.length - 1) {
        console.log('Waiting 5 seconds before next post...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('\n=== BACKFILL COMPLETE ===');
  } else {
    // Normal mode: only post latest release
    const release = await getLatestRelease();
    if (!release) {
      console.log('No release found in RSS feed');
      return;
    }

    console.log(`Latest stable release: v${release.version}`);

    if (lastPosted === release.version) {
      console.log(`Already posted v${release.version}, skipping`);
      return;
    }

    console.log(`New release detected: v${release.version}`);
    await postRelease(release);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
