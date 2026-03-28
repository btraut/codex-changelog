import { getLatestRelease, getReleasesNewerThan, type Release } from './rss.js';
import { getLatestDesktopRelease } from './desktop.js';
import { getLatestVscodeRelease } from './vscode.js';
import { parseNewFeatures } from './parser.js';
import { formatDigestTweet, formatTweets, type DigestEntry } from './formatter.js';
import { clearPendingDigest, queueDigestUpdate, readState, writeState, type BotState } from './state.js';
import { createTwitterClient, postThread } from './twitter.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BACKFILL = process.env.BACKFILL === 'true';
const POST_DIGEST = process.env.POST_DIGEST === 'true';
const DIGEST_TIME_ZONE = 'America/Denver';

function getDigestDate(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DIGEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

function buildDigestEntries(state: BotState): DigestEntry[] {
  const entries: DigestEntry[] = [];

  if (state.desktop.pendingDigestVersion && state.desktop.pendingDigestUrl) {
    entries.push({
      label: 'Desktop app',
      version: state.desktop.pendingDigestVersion,
      url: state.desktop.pendingDigestUrl,
    });
  }

  if (state.vscode.pendingDigestVersion && state.vscode.pendingDigestUrl) {
    entries.push({
      label: 'VS Code',
      version: state.vscode.pendingDigestVersion,
      url: state.vscode.pendingDigestUrl,
    });
  }

  return entries;
}

async function postRelease(
  release: Release,
  state: BotState,
  client?: ReturnType<typeof createTwitterClient>
): Promise<void> {
  console.log(`\n--- Processing v${release.version} ---`);

  // Parse release notes
  const { features, bugFixes, docs, chores } = parseNewFeatures(release.body);
  console.log(`Found ${features.length} features, ${bugFixes.length} bug fixes, ${docs.length} docs, ${chores.length} chores`);

  // Format tweets
  const { tweets } = formatTweets(release.version, features, release.url, { bugFixes, docs, chores });
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
  state.cli.lastPostedVersion = release.version;
  writeState(state, { dryRun: DRY_RUN });
  console.log(DRY_RUN ? `Dry run: skipped persisting CLI state for v${release.version}` : `Updated state file to v${release.version}`);
}

async function syncDigestSources(state: BotState, digestDate: string): Promise<void> {
  console.log('Checking desktop and VS Code release sources...');

  const [desktopResult, vscodeResult] = await Promise.allSettled([
    getLatestDesktopRelease(),
    getLatestVscodeRelease(),
  ]);

  if (desktopResult.status === 'fulfilled' && desktopResult.value) {
    const desktopRelease = desktopResult.value;
    if (queueDigestUpdate(state, 'desktop', desktopRelease.version, desktopRelease.url, digestDate)) {
      console.log(`Queued desktop digest update: v${desktopRelease.version}`);
    } else {
      console.log(`Desktop app unchanged at v${desktopRelease.version}`);
    }
  } else if (desktopResult.status === 'rejected') {
    console.warn(`Failed to sync desktop source: ${desktopResult.reason}`);
  }

  if (vscodeResult.status === 'fulfilled' && vscodeResult.value) {
    const vscodeRelease = vscodeResult.value;
    if (queueDigestUpdate(state, 'vscode', vscodeRelease.version, vscodeRelease.url, digestDate)) {
      console.log(`Queued VS Code digest update: v${vscodeRelease.version}`);
    } else {
      console.log(`VS Code unchanged at v${vscodeRelease.version}`);
    }
  } else if (vscodeResult.status === 'rejected') {
    console.warn(`Failed to sync VS Code source: ${vscodeResult.reason}`);
  }
}

async function maybePostDigest(
  state: BotState,
  digestDate: string,
  client?: ReturnType<typeof createTwitterClient>
): Promise<void> {
  if (!POST_DIGEST) {
    return;
  }

  if (state.digest.lastPostedDate === digestDate) {
    console.log(`Digest already posted for ${digestDate}, skipping`);
    return;
  }

  const entries = buildDigestEntries(state);
  if (entries.length === 0) {
    console.log(`No pending digest updates for ${digestDate}`);
    return;
  }

  const digestTweet = formatDigestTweet(entries);

  console.log(`\n--- Posting daily digest for ${digestDate} ---`);
  if (DRY_RUN) {
    console.log('\n=== DRY RUN MODE ===');
    console.log('Would post the following digest tweet:\n');
    console.log(digestTweet);
    console.log('\n=== END DRY RUN ===\n');
  } else {
    console.log('Posting digest to Twitter...');
    const twitterClient = client ?? createTwitterClient();
    const tweetIds = await postThread(twitterClient, [digestTweet]);
    console.log(`Posted digest tweet: ${tweetIds.join(', ')}`);
  }

  clearPendingDigest(state, 'desktop');
  clearPendingDigest(state, 'vscode');
  state.digest.lastPostedDate = digestDate;
  writeState(state, { dryRun: DRY_RUN });
  console.log(DRY_RUN ? `Dry run: skipped persisting digest state for ${digestDate}` : `Updated digest state for ${digestDate}`);
}

async function main(): Promise<void> {
  console.log('Checking for new Codex releases...');

  const state = readState();
  const lastPosted = state.cli.lastPostedVersion;
  const digestDate = getDigestDate();
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
      await postRelease(release, state, client);

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
    } else {
      console.log(`Latest stable release: v${release.version}`);

      if (lastPosted === release.version) {
        console.log(`Already posted v${release.version}, skipping`);
      } else {
        console.log(`New release detected: v${release.version}`);
        await postRelease(release, state);
      }
    }
  }

  await syncDigestSources(state, digestDate);
  writeState(state, { dryRun: DRY_RUN });
  if (DRY_RUN) {
    console.log('Dry run: skipped persisting synced source state');
  }

  if (POST_DIGEST) {
    await maybePostDigest(state, digestDate);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
