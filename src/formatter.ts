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

function buildHeader(version: string): string {
  return `🚀 Codex v${version} released!`;
}

function buildUrlLine(releaseUrl: string): string {
  return `Full release notes: ${releaseUrl}`;
}

function buildAlsoLine(counts: SectionCounts): string {
  const parts: string[] = [];
  if (counts.bugFixes > 0) parts.push(`${counts.bugFixes} bug fix${counts.bugFixes > 1 ? 'es' : ''}`);
  if (counts.docs > 0) parts.push(`${counts.docs} doc${counts.docs > 1 ? 's' : ''}`);
  if (counts.chores > 0) parts.push(`${counts.chores} chore${counts.chores > 1 ? 's' : ''}`);

  if (parts.length === 0) return '';
  return `Also: ${parts.join(', ')}`;
}

function buildSingleTweet(
  version: string,
  features: string[],
  releaseUrl: string,
  counts: SectionCounts
): string {
  const header = buildHeader(version);
  const urlLine = buildUrlLine(releaseUrl);
  const alsoLine = buildAlsoLine(counts);

  if (features.length === 0) {
    if (alsoLine) {
      return `${header}\n\n${alsoLine}\n\n${urlLine}`;
    }
    return `${header}\n\n${urlLine}`;
  }

  const featureList = features.map((f) => `• ${f}`).join("\n");
  if (alsoLine) {
    return `${header}\n\nNew Features:\n${featureList}\n\n${alsoLine}\n\n${urlLine}`;
  }
  return `${header}\n\nNew Features:\n${featureList}\n\n${urlLine}`;
}

export function formatTweets(
  version: string,
  features: string[],
  releaseUrl: string,
  counts: SectionCounts = { bugFixes: 0, docs: 0, chores: 0 }
): TweetThread {
  const truncatedFeatures = features.map(truncateFeature);

  // Try single tweet first
  const singleTweet = buildSingleTweet(version, truncatedFeatures, releaseUrl, counts);
  if (singleTweet.length <= MAX_TWEET_LENGTH) {
    return { tweets: [singleTweet] };
  }

  // Need to create a thread - first pass to determine structure
  const header = buildHeader(version);
  const urlLine = buildUrlLine(releaseUrl);
  const alsoLine = buildAlsoLine(counts);

  // Build the footer for the last tweet
  const lastTweetFooter = alsoLine ? `${alsoLine}\n\n${urlLine}` : urlLine;

  // Build tweet contents without numbering first
  const tweetContents: string[] = [];
  let remainingFeatures = [...truncatedFeatures];

  // First tweet: header + as many features as fit
  // Reserve space for " (1/N)" where N could be up to 2 digits = 7 chars
  const numberingSuffix = " (XX/XX)"; // 8 chars placeholder

  let firstTweetContent = `${header}\n\nNew Features:`;
  let featuresInFirst: string[] = [];

  for (const feature of remainingFeatures) {
    const featureLine = `• ${feature}`;
    const currentFeatures = featuresInFirst.length > 0
      ? featuresInFirst.map((f) => `• ${f}`).join("\n") + "\n"
      : "";
    const testContent = `${firstTweetContent}\n${currentFeatures}${featureLine}${numberingSuffix}`;

    if (testContent.length <= MAX_TWEET_LENGTH) {
      featuresInFirst.push(feature);
    } else {
      break;
    }
  }

  if (featuresInFirst.length > 0) {
    const featureLines = featuresInFirst.map((f) => `• ${f}`).join("\n");
    tweetContents.push(`${firstTweetContent}\n${featureLines}`);
  } else {
    tweetContents.push(firstTweetContent);
  }

  remainingFeatures = remainingFeatures.slice(featuresInFirst.length);

  // Middle and last tweets
  let footerAdded = false;
  while (remainingFeatures.length > 0) {
    // Check if remaining features + footer can fit in one tweet (this would be the last tweet)
    const remainingFeatureLines = remainingFeatures.map((f) => `• ${f}`).join("\n");
    const lastTweetCandidate = `${remainingFeatureLines}\n\n${lastTweetFooter}${numberingSuffix}`;

    if (lastTweetCandidate.length <= MAX_TWEET_LENGTH) {
      tweetContents.push(`${remainingFeatureLines}\n\n${lastTweetFooter}`);
      footerAdded = true;
      break;
    }

    // Need another middle tweet
    let featuresInMiddle: string[] = [];
    for (const feature of remainingFeatures) {
      const featureLine = `• ${feature}`;
      const currentLines = featuresInMiddle.length > 0
        ? featuresInMiddle.map((f) => `• ${f}`).join("\n") + "\n"
        : "";
      const testContent = `${currentLines}${featureLine}${numberingSuffix}`;

      if (testContent.length <= MAX_TWEET_LENGTH) {
        featuresInMiddle.push(feature);
      } else {
        break;
      }
    }

    if (featuresInMiddle.length > 0) {
      const featureLines = featuresInMiddle.map((f) => `• ${f}`).join("\n");
      tweetContents.push(featureLines);
      remainingFeatures = remainingFeatures.slice(featuresInMiddle.length);
    } else {
      // Edge case: single feature is too long even alone
      const featureLine = `• ${remainingFeatures[0]}`;
      tweetContents.push(featureLine);
      remainingFeatures = remainingFeatures.slice(1);
    }
  }

  // If we exited the loop without adding footer, add it as final tweet
  if (!footerAdded) {
    tweetContents.push(lastTweetFooter);
  }

  // Now add numbering to each tweet
  const totalTweets = tweetContents.length;
  const tweets = tweetContents.map((content, i) => {
    return `${content} (${i + 1}/${totalTweets})`;
  });

  return { tweets };
}
