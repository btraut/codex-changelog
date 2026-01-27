export interface TweetThread {
  tweets: string[];
}

export const MAX_TWEET_LENGTH = 280;
export const MAX_FEATURE_LENGTH = 50;

function truncateFeature(feature: string): string {
  if (feature.length <= MAX_FEATURE_LENGTH) {
    return feature;
  }
  return feature.slice(0, MAX_FEATURE_LENGTH - 3) + "...";
}

function buildHeader(version: string): string {
  return `🚀 Codex v${version} released!`;
}

function buildFeatureList(features: string[]): string {
  if (features.length === 0) {
    return "";
  }
  return features.map((f) => `• ${truncateFeature(f)}`).join("\n");
}

function buildUrlLine(releaseUrl: string): string {
  return `Full release notes: ${releaseUrl}`;
}

function buildSingleTweet(
  version: string,
  features: string[],
  releaseUrl: string
): string {
  const header = buildHeader(version);
  const featureList = buildFeatureList(features);
  const urlLine = buildUrlLine(releaseUrl);

  if (features.length === 0) {
    return `${header}\n\n${urlLine}`;
  }

  return `${header}\n\nNew Features:\n${featureList}\n\n${urlLine}`;
}

export function formatTweets(
  version: string,
  features: string[],
  releaseUrl: string
): TweetThread {
  const truncatedFeatures = features.map(truncateFeature);

  // Try single tweet first
  const singleTweet = buildSingleTweet(version, truncatedFeatures, releaseUrl);
  if (singleTweet.length <= MAX_TWEET_LENGTH) {
    return { tweets: [singleTweet] };
  }

  // Need to create a thread
  const tweets: string[] = [];
  const header = buildHeader(version);
  const urlLine = buildUrlLine(releaseUrl);
  const continuation = "(cont...)";

  let remainingFeatures = [...truncatedFeatures];

  // First tweet: header + as many features as fit + "(cont...)"
  let firstTweetContent = `${header}\n\nNew Features:`;
  const firstTweetBase = `${firstTweetContent}\n\n${continuation}`;

  let featuresInFirst: string[] = [];
  for (const feature of remainingFeatures) {
    const featureLine = `• ${feature}`;
    const testContent = `${firstTweetContent}\n${featuresInFirst.map((f) => `• ${f}`).join("\n")}${featuresInFirst.length > 0 ? "\n" : ""}${featureLine}\n\n${continuation}`;

    if (testContent.length <= MAX_TWEET_LENGTH) {
      featuresInFirst.push(feature);
    } else {
      break;
    }
  }

  if (featuresInFirst.length > 0) {
    const featureLines = featuresInFirst.map((f) => `• ${f}`).join("\n");
    tweets.push(`${firstTweetContent}\n${featureLines}\n\n${continuation}`);
  } else {
    tweets.push(`${firstTweetContent}\n\n${continuation}`);
  }

  remainingFeatures = remainingFeatures.slice(featuresInFirst.length);

  // Middle tweets: just features
  while (remainingFeatures.length > 0) {
    // Check if remaining features + URL can fit in one tweet
    const remainingFeatureLines = remainingFeatures
      .map((f) => `• ${f}`)
      .join("\n");
    const lastTweetCandidate = `${remainingFeatureLines}\n\n${urlLine}`;

    if (lastTweetCandidate.length <= MAX_TWEET_LENGTH) {
      // This is the last tweet
      tweets.push(lastTweetCandidate);
      break;
    }

    // Need another middle tweet
    let featuresInMiddle: string[] = [];
    for (const feature of remainingFeatures) {
      const featureLine = `• ${feature}`;
      const currentLines =
        featuresInMiddle.length > 0
          ? featuresInMiddle.map((f) => `• ${f}`).join("\n") + "\n"
          : "";
      const testContent = `${currentLines}${featureLine}\n\n${continuation}`;

      if (testContent.length <= MAX_TWEET_LENGTH) {
        featuresInMiddle.push(feature);
      } else {
        break;
      }
    }

    if (featuresInMiddle.length > 0) {
      const featureLines = featuresInMiddle.map((f) => `• ${f}`).join("\n");
      tweets.push(`${featureLines}\n\n${continuation}`);
      remainingFeatures = remainingFeatures.slice(featuresInMiddle.length);
    } else {
      // Edge case: single feature is too long even alone (shouldn't happen with truncation)
      const featureLine = `• ${remainingFeatures[0]}`;
      tweets.push(`${featureLine}\n\n${continuation}`);
      remainingFeatures = remainingFeatures.slice(1);
    }
  }

  return { tweets };
}
