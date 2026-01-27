export interface TweetThread {
  tweets: string[];
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
  featureCount: number
): string {
  const countLine = featureCount > 0
    ? `${featureCount} feature${featureCount > 1 ? 's' : ''}.`
    : "Minor updates.";

  return `Codex ${formatVersion(version)} is out.\n\n${countLine}\n\nDetails in thread ↓`;
}

function buildUrlLine(releaseUrl: string): string {
  return `Full notes: ${releaseUrl}`;
}

function buildSingleTweet(
  version: string,
  features: string[],
  releaseUrl: string
): string {
  const countLine = features.length > 0
    ? `${features.length} feature${features.length > 1 ? 's' : ''}.`
    : "Minor updates.";

  return `Codex ${formatVersion(version)} is out.\n\n${countLine}\n\n${buildUrlLine(releaseUrl)}`;
}

export function formatTweets(
  version: string,
  features: string[],
  releaseUrl: string
): TweetThread {
  const truncatedFeatures = features.map(truncateFeature);

  // Try single tweet first (no feature details, just summary)
  const singleTweet = buildSingleTweet(version, truncatedFeatures, releaseUrl);
  if (singleTweet.length <= MAX_TWEET_LENGTH && truncatedFeatures.length <= 2) {
    return { tweets: [singleTweet] };
  }

  // Need to create a thread
  const urlLine = buildUrlLine(releaseUrl);

  const tweets: string[] = [];

  // First tweet: summary
  tweets.push(buildSummaryTweet(version, truncatedFeatures.length));

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
