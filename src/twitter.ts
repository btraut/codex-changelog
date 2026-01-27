import { TwitterApi } from 'twitter-api-v2';

export function createTwitterClient(): TwitterApi {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey) {
    throw new Error('Missing required environment variable: TWITTER_API_KEY');
  }
  if (!apiSecret) {
    throw new Error('Missing required environment variable: TWITTER_API_SECRET');
  }
  if (!accessToken) {
    throw new Error('Missing required environment variable: TWITTER_ACCESS_TOKEN');
  }
  if (!accessSecret) {
    throw new Error('Missing required environment variable: TWITTER_ACCESS_SECRET');
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret,
  });
}

export async function postThread(
  client: TwitterApi,
  tweets: string[]
): Promise<string[]> {
  if (tweets.length === 0) {
    return [];
  }

  const tweetIds: string[] = [];

  // Post first tweet
  const firstResponse = await client.v2.tweet({ text: tweets[0] });
  tweetIds.push(firstResponse.data.id);

  // Post subsequent tweets as replies
  let previousTweetId = firstResponse.data.id;
  for (let i = 1; i < tweets.length; i++) {
    const response = await client.v2.tweet({
      text: tweets[i],
      reply: { in_reply_to_tweet_id: previousTweetId },
    });
    tweetIds.push(response.data.id);
    previousTweetId = response.data.id;
  }

  return tweetIds;
}
