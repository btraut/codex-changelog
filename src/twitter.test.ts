import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TwitterApi } from 'twitter-api-v2';
import { createTwitterClient, postThread } from './twitter.js';

vi.mock('twitter-api-v2');

describe('createTwitterClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws on missing TWITTER_API_KEY', () => {
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    process.env.TWITTER_ACCESS_SECRET = 'access-secret';
    delete process.env.TWITTER_API_KEY;

    expect(() => createTwitterClient()).toThrow(
      'Missing required environment variable: TWITTER_API_KEY'
    );
  });

  it('throws on missing TWITTER_API_SECRET', () => {
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    process.env.TWITTER_ACCESS_SECRET = 'access-secret';
    delete process.env.TWITTER_API_SECRET;

    expect(() => createTwitterClient()).toThrow(
      'Missing required environment variable: TWITTER_API_SECRET'
    );
  });

  it('throws on missing TWITTER_ACCESS_TOKEN', () => {
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_SECRET = 'access-secret';
    delete process.env.TWITTER_ACCESS_TOKEN;

    expect(() => createTwitterClient()).toThrow(
      'Missing required environment variable: TWITTER_ACCESS_TOKEN'
    );
  });

  it('throws on missing TWITTER_ACCESS_SECRET', () => {
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    delete process.env.TWITTER_ACCESS_SECRET;

    expect(() => createTwitterClient()).toThrow(
      'Missing required environment variable: TWITTER_ACCESS_SECRET'
    );
  });

  it('creates client with valid env vars', () => {
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    process.env.TWITTER_ACCESS_SECRET = 'access-secret';

    const client = createTwitterClient();
    expect(client).toBeInstanceOf(TwitterApi);
    expect(TwitterApi).toHaveBeenCalledWith({
      appKey: 'key',
      appSecret: 'secret',
      accessToken: 'token',
      accessSecret: 'access-secret',
    });
  });
});

describe('postThread', () => {
  it('posts single tweet successfully', async () => {
    const mockTweet = vi.fn().mockResolvedValue({
      data: { id: 'tweet-123' },
    });

    const mockClient = {
      v2: { tweet: mockTweet },
    } as unknown as TwitterApi;

    const tweetIds = await postThread(mockClient, ['Hello world']);

    expect(tweetIds).toEqual(['tweet-123']);
    expect(mockTweet).toHaveBeenCalledTimes(1);
    expect(mockTweet).toHaveBeenCalledWith({ text: 'Hello world' });
  });

  it('posts thread with correct reply chaining', async () => {
    const mockTweet = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 'tweet-1' } })
      .mockResolvedValueOnce({ data: { id: 'tweet-2' } })
      .mockResolvedValueOnce({ data: { id: 'tweet-3' } });

    const mockClient = {
      v2: { tweet: mockTweet },
    } as unknown as TwitterApi;

    const tweetIds = await postThread(mockClient, [
      'First tweet',
      'Second tweet',
      'Third tweet',
    ]);

    expect(tweetIds).toEqual(['tweet-1', 'tweet-2', 'tweet-3']);
    expect(mockTweet).toHaveBeenCalledTimes(3);

    // First tweet has no reply
    expect(mockTweet).toHaveBeenNthCalledWith(1, { text: 'First tweet' });

    // Second tweet replies to first
    expect(mockTweet).toHaveBeenNthCalledWith(2, {
      text: 'Second tweet',
      reply: { in_reply_to_tweet_id: 'tweet-1' },
    });

    // Third tweet replies to second
    expect(mockTweet).toHaveBeenNthCalledWith(3, {
      text: 'Third tweet',
      reply: { in_reply_to_tweet_id: 'tweet-2' },
    });
  });

  it('returns all tweet IDs', async () => {
    const mockTweet = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 'id-a' } })
      .mockResolvedValueOnce({ data: { id: 'id-b' } });

    const mockClient = {
      v2: { tweet: mockTweet },
    } as unknown as TwitterApi;

    const tweetIds = await postThread(mockClient, ['Tweet A', 'Tweet B']);

    expect(tweetIds).toHaveLength(2);
    expect(tweetIds).toEqual(['id-a', 'id-b']);
  });

  it('returns empty array for empty tweets', async () => {
    const mockTweet = vi.fn();

    const mockClient = {
      v2: { tweet: mockTweet },
    } as unknown as TwitterApi;

    const tweetIds = await postThread(mockClient, []);

    expect(tweetIds).toEqual([]);
    expect(mockTweet).not.toHaveBeenCalled();
  });
});
