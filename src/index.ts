import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLatestStableRelease } from './github.js';
import { parseNewFeatures } from './parser.js';
import { formatTweets } from './formatter.js';
import { createTwitterClient, postThread } from './twitter.js';

const STATE_FILE = path.join(process.cwd(), 'data', 'last-posted-version.txt');
const DRY_RUN = process.env.DRY_RUN === 'true';

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

async function main(): Promise<void> {
  console.log('Checking for new Codex releases...');

  // Fetch latest stable release
  const release = await getLatestStableRelease();
  if (!release) {
    console.log('No stable release found');
    return;
  }

  console.log(`Latest stable release: v${release.version}`);

  // Check if we've already posted this version
  const lastPosted = readLastPostedVersion();
  if (lastPosted === release.version) {
    console.log(`Already posted v${release.version}, skipping`);
    return;
  }

  console.log(`New release detected: v${release.version} (last posted: ${lastPosted ?? 'none'})`);

  // Parse new features
  const { features } = parseNewFeatures(release.body);
  console.log(`Found ${features.length} new features`);

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
    const client = createTwitterClient();
    const tweetIds = await postThread(client, tweets);
    console.log(`Posted ${tweetIds.length} tweet(s): ${tweetIds.join(', ')}`);
  }

  // Update state file
  writeLastPostedVersion(release.version);
  console.log(`Updated state file to v${release.version}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
