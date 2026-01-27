export interface TweetThread {
  tweets: string[];
}

export interface SectionCounts {
  bugFixes: number;
  docs: number;
  chores: number;
}

export const MAX_TWEET_LENGTH = 280;
export const MAX_FEATURE_LENGTH = 100;

function truncateFeature(feature: string): string {
  if (feature.length <= MAX_FEATURE_LENGTH) {
    return feature;
  }
  return feature.slice(0, MAX_FEATURE_LENGTH - 3) + "...";
}

function formatVersion(version: string): string {
  // Convert "0.92.0" to "0.92" (drop patch if .0)
  const parts = version.split('.');
  if (parts.length === 3 && parts[2] === '0') {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}

function buildSummaryTweet(
  version: string,
  featureCount: number,
  counts: SectionCounts
): string {
  const parts: string[] = [];
  if (featureCount > 0) parts.push(`${featureCount} feature${featureCount > 1 ? 's' : ''}`);
  if (counts.bugFixes > 0) parts.push(`${counts.bugFixes} bug fix${counts.bugFixes > 1 ? 'es' : ''}`);
  if (counts.docs > 0) parts.push(`${counts.docs} doc${counts.docs > 1 ? 's' : ''}`);
  if (counts.chores > 0) parts.push(`${counts.chores} chore${counts.chores > 1 ? 's' : ''}`);

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

function buildUrlLine(releaseUrl: string): string {
  return `Full notes: ${releaseUrl}`;
}

function buildSingleTweet(
  version: string,
  features: string[],
  releaseUrl: string,
  counts: SectionCounts
): string {
  const parts: string[] = [];
  if (features.length > 0) parts.push(`${features.length} feature${features.length > 1 ? 's' : ''}`);
  if (counts.bugFixes > 0) parts.push(`${counts.bugFixes} bug fix${counts.bugFixes > 1 ? 'es' : ''}`);
  if (counts.docs > 0) parts.push(`${counts.docs} doc${counts.docs > 1 ? 's' : ''}`);
  if (counts.chores > 0) parts.push(`${counts.chores} chore${counts.chores > 1 ? 's' : ''}`);

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

  return `Codex ${formatVersion(version)} is out.\n\n${countLine}\n\n${buildUrlLine(releaseUrl)}`;
}

export function formatTweets(
  version: string,
  features: string[],
  releaseUrl: string,
  counts: SectionCounts = { bugFixes: 0, docs: 0, chores: 0 }
): TweetThread {
  const truncatedFeatures = features.map(truncateFeature);

  // Try single tweet first (no feature details, just summary)
  const singleTweet = buildSingleTweet(version, truncatedFeatures, releaseUrl, counts);
  if (singleTweet.length <= MAX_TWEET_LENGTH && truncatedFeatures.length <= 2) {
    return { tweets: [singleTweet] };
  }

  // Need to create a thread
  const urlLine = buildUrlLine(releaseUrl);

  const tweets: string[] = [];

  // First tweet: summary
  tweets.push(buildSummaryTweet(version, truncatedFeatures.length, counts));

  let remainingFeatures = [...truncatedFeatures];

  // Feature tweets
  let footerAdded = false;
  while (remainingFeatures.length > 0) {
    // Check if remaining features + URL can fit in one tweet (this would be the last tweet)
    const remainingFeatureLines = remainingFeatures.map((f) => `• ${f}`).join("\n");
    const lastTweetCandidate = `${remainingFeatureLines}\n\n${urlLine}`;

    if (lastTweetCandidate.length <= MAX_TWEET_LENGTH) {
      tweets.push(lastTweetCandidate);
      footerAdded = true;
      break;
    }

    // Need another feature tweet
    let featuresInTweet: string[] = [];
    for (const feature of remainingFeatures) {
      const featureLine = `• ${feature}`;
      const currentLines = featuresInTweet.length > 0
        ? featuresInTweet.map((f) => `• ${f}`).join("\n") + "\n"
        : "";
      const testContent = `${currentLines}${featureLine}`;

      if (testContent.length <= MAX_TWEET_LENGTH) {
        featuresInTweet.push(feature);
      } else {
        break;
      }
    }

    if (featuresInTweet.length > 0) {
      const featureLines = featuresInTweet.map((f) => `• ${f}`).join("\n");
      tweets.push(featureLines);
      remainingFeatures = remainingFeatures.slice(featuresInTweet.length);
    } else {
      // Edge case: single feature is too long even alone
      const featureLine = `• ${remainingFeatures[0]}`;
      tweets.push(featureLine);
      remainingFeatures = remainingFeatures.slice(1);
    }
  }

  // If we exited the loop without adding footer, add it as final tweet
  if (!footerAdded) {
    tweets.push(urlLine);
  }

  return { tweets };
}
