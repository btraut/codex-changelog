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
    it("should create single tweet when 1-2 short features", () => {
      const features = ["New CLI command", "Bug fixes"];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0]).toContain("🚀 Codex v0.92.0 released!");
      expect(result.tweets[0]).toContain("New Features:");
      expect(result.tweets[0]).toContain("• New CLI command");
      expect(result.tweets[0]).toContain("• Bug fixes");
      expect(result.tweets[0]).toContain(releaseUrl);
    });

    it("should fit short feature lists in single tweet", () => {
      const features = ["Feature A", "Feature B", "Feature C"];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].length).toBeLessThanOrEqual(MAX_TWEET_LENGTH);
    });
  });

  describe("thread scenarios", () => {
    it("should create thread when content exceeds 280 characters", () => {
      const features = [
        "New interactive mode with enhanced UX",
        "Improved error messages for debugging",
        "Better performance optimizations",
        "New API endpoints for integrations",
        "Enhanced security features",
        "Documentation updates and fixes",
        "New plugin architecture support",
        "Improved logging capabilities",
      ];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);
    });

    it("should create thread for many long features", () => {
      const features = Array(10)
        .fill(null)
        .map((_, i) => `Feature number ${i + 1} with description`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);
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
    it("should truncate features longer than 50 characters with ellipsis", () => {
      const longFeature =
        "This is a very long feature description that exceeds the maximum allowed length";
      expect(longFeature.length).toBeGreaterThan(MAX_FEATURE_LENGTH);

      const features = [longFeature];
      const result = formatTweets(version, features, releaseUrl);

      const tweet = result.tweets[0];
      expect(tweet).not.toContain(longFeature);
      expect(tweet).toContain("...");

      // Verify the truncated feature is at most MAX_FEATURE_LENGTH chars
      const bulletMatch = tweet.match(/• (.+)/);
      expect(bulletMatch).not.toBeNull();
      if (bulletMatch) {
        const featureText = bulletMatch[1].split("\n")[0];
        expect(featureText.length).toBeLessThanOrEqual(MAX_FEATURE_LENGTH);
      }
    });

    it("should not truncate features under 50 characters", () => {
      const shortFeature = "Short feature";
      expect(shortFeature.length).toBeLessThan(MAX_FEATURE_LENGTH);

      const features = [shortFeature];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets[0]).toContain(`• ${shortFeature}`);
      expect(result.tweets[0]).not.toContain("...");
    });

    it("should truncate exactly at 50 characters including ellipsis", () => {
      const exactlyLongFeature = "A".repeat(60);
      const features = [exactlyLongFeature];
      const result = formatTweets(version, features, releaseUrl);

      const bulletMatch = result.tweets[0].match(/• (.+)/);
      expect(bulletMatch).not.toBeNull();
      if (bulletMatch) {
        const featureText = bulletMatch[1].split("\n")[0];
        expect(featureText.length).toBe(MAX_FEATURE_LENGTH);
        expect(featureText.endsWith("...")).toBe(true);
      }
    });
  });

  describe("empty features handling", () => {
    it("should handle empty features array gracefully", () => {
      const features: string[] = [];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0]).toContain("🚀 Codex v0.92.0 released!");
      expect(result.tweets[0]).toContain(releaseUrl);
      expect(result.tweets[0]).not.toContain("New Features:");
    });

    it("should include URL in single tweet with no features", () => {
      const result = formatTweets(version, [], releaseUrl);

      expect(result.tweets[0]).toContain("Full release notes:");
      expect(result.tweets[0]).toContain(releaseUrl);
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
      const features = Array(10)
        .fill(null)
        .map((_, i) => `Feature ${i + 1} with extra description text`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);

      // URL should only be in the last tweet
      const lastTweet = result.tweets[result.tweets.length - 1];
      expect(lastTweet).toContain(releaseUrl);

      // URL should not be in earlier tweets
      for (let i = 0; i < result.tweets.length - 1; i++) {
        expect(result.tweets[i]).not.toContain(releaseUrl);
      }
    });

    it("should always include URL regardless of thread length", () => {
      // Test with various lengths
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
    it("should include continuation marker in non-final tweets", () => {
      const features = Array(10)
        .fill(null)
        .map((_, i) => `Feature ${i + 1} with some description`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets.length).toBeGreaterThan(1);

      // All tweets except the last should have continuation marker
      for (let i = 0; i < result.tweets.length - 1; i++) {
        expect(result.tweets[i]).toContain("(cont...)");
      }

      // Last tweet should not have continuation marker
      const lastTweet = result.tweets[result.tweets.length - 1];
      expect(lastTweet).not.toContain("(cont...)");
    });

    it("should start first tweet with header", () => {
      const features = Array(10)
        .fill(null)
        .map((_, i) => `Feature ${i + 1}`);
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets[0]).toMatch(/^🚀 Codex v[\d.]+ released!/);
    });
  });
});
