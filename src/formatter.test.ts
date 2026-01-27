import { describe, it, expect } from "vitest";
import {
  formatTweets,
  MAX_TWEET_LENGTH,
  MAX_FEATURE_LENGTH,
} from "./formatter.js";

describe("formatTweets", () => {
  const version = "0.92.0";
  const releaseUrl = "https://github.com/openai/codex/releases/tag/v0.92.0";

  describe("single tweet scenarios", () => {
    it("should create single tweet for small releases", () => {
      const features = ["New CLI command", "Bug fixes"];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0]).toContain("Codex 0.92 is out.");
      expect(result.tweets[0]).toContain("2 features");
      expect(result.tweets[0]).toContain(releaseUrl);
    });

    it("should include counts in single tweet", () => {
      const features = ["Feature A"];
      const counts = { bugFixes: 3, docs: 1, chores: 2 };
      const result = formatTweets(version, features, releaseUrl, counts);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0]).toContain("1 feature");
      expect(result.tweets[0]).toContain("3 bug fixes");
      expect(result.tweets[0]).toContain("1 doc");
      expect(result.tweets[0]).toContain("2 chores");
    });
  });

  describe("thread scenarios", () => {
    it("should create thread when many features", () => {
      const features = [
        "New interactive mode with enhanced UX",
        "Improved error messages for debugging",
        "Better performance optimizations",
        "New API endpoints for integrations",
        "Enhanced security features",
      ];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);
      // First tweet should be summary
      expect(result.tweets[0]).toContain("Codex 0.92 is out.");
      expect(result.tweets[0]).toContain("5 features");
      expect(result.tweets[0]).toContain("Details in thread");
    });

    it("should put features in subsequent tweets", () => {
      const features = Array(6).fill(null).map((_, i) => `Feature ${i + 1} description`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);
      // Features should be in tweets after the first
      const laterTweets = result.tweets.slice(1).join(" ");
      expect(laterTweets).toContain("• Feature 1");
    });
  });

  describe("tweet length constraints", () => {
    it("should never exceed 280 characters in any tweet", () => {
      const features = Array(15)
        .fill(null)
        .map((_, i) => `This is feature number ${i + 1} with some extra text`);
      const result = formatTweets(version, features, releaseUrl);

      for (const tweet of result.tweets) {
        expect(tweet.length).toBeLessThanOrEqual(MAX_TWEET_LENGTH);
      }
    });

    it("should handle very long feature list without exceeding limits", () => {
      const features = Array(20)
        .fill(null)
        .map((_, i) => `Feature ${i + 1}`);
      const result = formatTweets(version, features, releaseUrl);

      for (const tweet of result.tweets) {
        expect(tweet.length).toBeLessThanOrEqual(MAX_TWEET_LENGTH);
      }
    });
  });

  describe("feature truncation", () => {
    it("should truncate features longer than MAX_FEATURE_LENGTH with ellipsis", () => {
      const longFeature =
        "This is a very long feature description that exceeds the maximum allowed length and keeps going on and on to ensure it is over 100 characters";
      expect(longFeature.length).toBeGreaterThan(MAX_FEATURE_LENGTH);

      const features = [longFeature, "Short feature", "Another one"];
      const result = formatTweets(version, features, releaseUrl);

      // In thread, features appear in later tweets
      const allText = result.tweets.join(" ");
      expect(allText).not.toContain(longFeature);
      expect(allText).toContain("...");
    });

    it("should not truncate features under MAX_FEATURE_LENGTH", () => {
      const shortFeature = "Short feature under limit";
      expect(shortFeature.length).toBeLessThan(MAX_FEATURE_LENGTH);

      const features = [shortFeature, "Another", "Third"];
      const result = formatTweets(version, features, releaseUrl);

      const allText = result.tweets.join(" ");
      expect(allText).toContain(`• ${shortFeature}`);
    });
  });

  describe("empty features handling", () => {
    it("should handle empty features array gracefully", () => {
      const features: string[] = [];
      const counts = { bugFixes: 2, docs: 0, chores: 1 };
      const result = formatTweets(version, features, releaseUrl, counts);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0]).toContain("Codex 0.92 is out.");
      expect(result.tweets[0]).toContain("2 bug fixes");
      expect(result.tweets[0]).toContain(releaseUrl);
    });

    it("should show minor updates when no counts", () => {
      const result = formatTweets(version, [], releaseUrl);

      expect(result.tweets[0]).toContain("Minor updates.");
    });
  });

  describe("URL placement", () => {
    it("should include URL in single tweet", () => {
      const features = ["Feature 1"];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0]).toContain(releaseUrl);
    });

    it("should include URL in last tweet of thread", () => {
      const features = Array(8)
        .fill(null)
        .map((_, i) => `Feature ${i + 1} with a longer description that takes up more space`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);

      // URL should only be in the last tweet
      const lastTweet = result.tweets[result.tweets.length - 1];
      expect(lastTweet).toContain(releaseUrl);

      // URL should not be in earlier tweets (except summary doesn't have it)
      for (let i = 1; i < result.tweets.length - 1; i++) {
        expect(result.tweets[i]).not.toContain(releaseUrl);
      }
    });

    it("should always include URL regardless of thread length", () => {
      for (const count of [0, 1, 5, 10, 20]) {
        const features = Array(count)
          .fill(null)
          .map((_, i) => `Feature ${i + 1}`);
        const result = formatTweets(version, features, releaseUrl);

        const allText = result.tweets.join(" ");
        expect(allText).toContain(releaseUrl);
      }
    });
  });

  describe("thread structure", () => {
    it("should include numbering in thread tweets", () => {
      const features = Array(8)
        .fill(null)
        .map((_, i) => `Feature ${i + 1} with a longer description that takes up more space`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);

      // All tweets should have (X/Y) numbering
      const total = result.tweets.length;
      for (let i = 0; i < total; i++) {
        expect(result.tweets[i]).toContain(`(${i + 1}/${total})`);
      }
    });

    it("should start first tweet with summary", () => {
      const features = Array(10)
        .fill(null)
        .map((_, i) => `Feature ${i + 1}`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets[0]).toMatch(/^Codex [\d.]+ is out\./);
      expect(result.tweets[0]).toContain("Details in thread");
    });
  });

  describe("version formatting", () => {
    it("should format version 0.92.0 as 0.92", () => {
      const result = formatTweets("0.92.0", ["Feature"], releaseUrl);
      expect(result.tweets[0]).toContain("Codex 0.92 is out.");
    });

    it("should keep patch version if not .0", () => {
      const result = formatTweets("0.92.1", ["Feature"], releaseUrl);
      expect(result.tweets[0]).toContain("Codex 0.92.1 is out.");
    });
  });
});
