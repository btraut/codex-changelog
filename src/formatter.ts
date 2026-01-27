export interface TweetThread {
  tweets: string[];
}

export interface SectionItems {
  bugFixes: string[];
  docs: string[];
  chores: string[];
}

export const MAX_TWEET_LENGTH = 4000;  // X Premium limit
export const MAX_FEATURE_LENGTH = 500; // No practical truncation
const TARGET_TWEET_LENGTH = 800;       // Preferred max for combining/splitting
const MAX_PREVIEW_ITEMS = 4;           // Max items before truncating other categories

function truncateFeature(feature: string): string {
  if (feature.length <= MAX_FEATURE_LENGTH) {
    return feature;
  }
  return feature.slice(0, MAX_FEATURE_LENGTH - 3) + "...";
}

function formatVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length === 3 && parts[2] === '0') {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}

function buildTitleTweet(
  version: string,
  featureCount: number,
  items: SectionItems
): string {
  const parts: string[] = [];
  if (featureCount > 0) parts.push(`${featureCount} feature${featureCount > 1 ? 's' : ''}`);
  if (items.bugFixes.length > 0) parts.push(`${items.bugFixes.length} bug fix${items.bugFixes.length > 1 ? 'es' : ''}`);
  if (items.docs.length > 0) parts.push(`${items.docs.length} doc${items.docs.length > 1 ? 's' : ''}`);
  if (items.chores.length > 0) parts.push(`${items.chores.length} chore${items.chores.length > 1 ? 's' : ''}`);

  let countLine: string;
  if (parts.length === 0) {
    countLine = "Minor updates.";
  } else if (parts.length === 1) {
    countLine = `${parts[0]}.`;
  } else if (parts.length === 2) {
    countLine = `${parts[0]} and ${parts[1]}.`;
  } else {
    const last = parts.pop();
    countLine = `${parts.join(', ')}, and ${last}.`;
  }

  return `Codex ${formatVersion(version)} is out.\n\n${countLine}\n\nDetails in thread ↓`;
}

function buildCtaTweet(releaseUrl: string): string {
  return `Full notes: ${releaseUrl}`;
}

/**
 * Build feature tweets - never truncate items, split across tweets if needed
 */
function buildFeatureTweets(features: string[]): string[] {
  if (features.length === 0) return [];

  const tweets: string[] = [];
  let currentTweet = "Features:";

  for (const feature of features) {
    const line = `\n• ${feature}`;
    if ((currentTweet + line).length <= TARGET_TWEET_LENGTH) {
      currentTweet += line;
    } else if (currentTweet === "Features:") {
      // Single feature exceeds target, but we must include it
      currentTweet += line;
    } else {
      tweets.push(currentTweet);
      currentTweet = `Features (cont.):\n• ${feature}`;
    }
  }

  if (currentTweet !== "Features:") {
    tweets.push(currentTweet);
  }

  return tweets;
}

/**
 * Build a category section with optional truncation
 */
function buildCategorySection(title: string, items: string[], allowTruncation: boolean): string {
  if (items.length === 0) return "";

  const displayItems = allowTruncation ? items.slice(0, MAX_PREVIEW_ITEMS) : items;
  const remaining = items.length - displayItems.length;

  let section = `${title}:`;
  for (const item of displayItems) {
    section += `\n• ${item}`;
  }
  if (remaining > 0) {
    section += `\n• ${remaining} more...`;
  }

  return section;
}

/**
 * Split a category section across multiple tweets if it exceeds target length
 */
function splitCategoryIntoTweets(title: string, items: string[]): string[] {
  if (items.length === 0) return [];

  // First, try as a single section with truncation
  const singleSection = buildCategorySection(title, items, true);
  if (singleSection.length <= TARGET_TWEET_LENGTH) {
    return [singleSection];
  }

  // Need to split - show items across multiple tweets, truncating only the last
  const tweets: string[] = [];
  let currentTweet = `${title}:`;
  let itemsInCurrentTweet = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const line = `\n• ${item}`;
    const remaining = items.length - i - 1;

    if ((currentTweet + line).length <= TARGET_TWEET_LENGTH) {
      currentTweet += line;
      itemsInCurrentTweet++;
    } else if (itemsInCurrentTweet === 0) {
      // Single item exceeds target, include it anyway
      currentTweet += line;
      itemsInCurrentTweet++;
    } else {
      // Start a new tweet, but first check if we should truncate here
      if (remaining > 0 && tweets.length >= 1) {
        // We've already made multiple tweets for this category, truncate
        currentTweet += `\n• ${remaining + 1} more...`;
        tweets.push(currentTweet);
        return tweets;
      }
      tweets.push(currentTweet);
      currentTweet = `${title} (cont.):\n• ${item}`;
      itemsInCurrentTweet = 1;
    }
  }

  if (currentTweet !== `${title}:` && currentTweet !== `${title} (cont.):`) {
    tweets.push(currentTweet);
  }

  return tweets;
}

/**
 * Combine category sections, respecting target length
 */
function combineCategories(categories: Array<{ title: string; items: string[] }>): string[] {
  const tweets: string[] = [];
  let pendingContent = "";

  for (const category of categories) {
    if (category.items.length === 0) continue;

    // Build this category's content (with truncation allowed)
    const categoryContent = buildCategorySection(category.title, category.items, true);

    // Check if it fits with pending content
    const separator = pendingContent ? "\n\n" : "";
    const combined = pendingContent + separator + categoryContent;

    if (combined.length <= TARGET_TWEET_LENGTH) {
      // Combine with pending
      pendingContent = combined;
    } else if (categoryContent.length <= TARGET_TWEET_LENGTH) {
      // Push pending, start fresh with this category
      if (pendingContent) {
        tweets.push(pendingContent);
      }
      pendingContent = categoryContent;
    } else {
      // This category alone exceeds target - need to split it
      if (pendingContent) {
        tweets.push(pendingContent);
        pendingContent = "";
      }
      const splitTweets = splitCategoryIntoTweets(category.title, category.items);
      // Add all but the last to tweets, keep last as pending for potential combining
      if (splitTweets.length > 0) {
        tweets.push(...splitTweets.slice(0, -1));
        pendingContent = splitTweets[splitTweets.length - 1];
      }
    }
  }

  if (pendingContent) {
    tweets.push(pendingContent);
  }

  return tweets;
}

export function formatTweets(
  version: string,
  features: string[],
  releaseUrl: string,
  items: SectionItems = { bugFixes: [], docs: [], chores: [] }
): TweetThread {
  const truncatedFeatures = features.map(truncateFeature);
  const tweets: string[] = [];

  // Tweet 1: Title card (always separate)
  tweets.push(buildTitleTweet(version, truncatedFeatures.length, items));

  // Features: never truncate, split if needed
  tweets.push(...buildFeatureTweets(truncatedFeatures));

  // Other categories: combine adjacent if under 800 chars, truncate items if needed
  const otherCategories = [
    { title: "Bug Fixes", items: items.bugFixes },
    { title: "Docs", items: items.docs },
    { title: "Chores", items: items.chores },
  ];
  tweets.push(...combineCategories(otherCategories));

  // CTA: always separate
  tweets.push(buildCtaTweet(releaseUrl));

  return { tweets };
}
