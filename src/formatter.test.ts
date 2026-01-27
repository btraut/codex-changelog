import { describe, it, expect } from "vitest";
import {
  formatTweets,
  MAX_TWEET_LENGTH,
  MAX_FEATURE_LENGTH,
} from "./formatter.js";

describe("formatTweets", () => {
  const version = "0.92.0";
  const releaseUrl = "https://github.com/openai/codex/releases/tag/v0.92.0";

  describe("basic structure", () => {
    it("should always have title card as first tweet", () => {
      const features = ["New CLI command", "Bug fixes"];
      const result = formatTweets(version, features, releaseUrl);

      expect(result.tweets[0]).toContain("Codex 0.92 is out.");
      expect(result.tweets[0]).toContain("2 features");
    });

    it("should always have CTA as last tweet", () => {
      const features = ["Feature 1"];
      const result = formatTweets(version, features, releaseUrl);

      const lastTweet = result.tweets[result.tweets.length - 1];
      expect(lastTweet).toContain("Full notes:");
      expect(lastTweet).toContain(releaseUrl);
    });

    it("should include all category counts in title", () => {
      const features = ["Feature A"];
      const items = {
        bugFixes: ["Fix 1", "Fix 2", "Fix 3"],
        docs: ["Doc 1"],
        chores: ["Chore 1", "Chore 2"],
      };
      const result = formatTweets(version, features, releaseUrl, items);

      expect(result.tweets[0]).toContain("1 feature");
      expect(result.tweets[0]).toContain("3 bug fixes");
      expect(result.tweets[0]).toContain("1 doc");
      expect(result.tweets[0]).toContain("2 chores");
    });
  });

  describe("features section", () => {
    it("should include Features: heading", () => {
      const features = ["Feature 1", "Feature 2"];
      const result = formatTweets(version, features, releaseUrl);

      const featuresTweet = result.tweets.find((t) => t.startsWith("Features:"));
      expect(featuresTweet).toBeDefined();
      expect(featuresTweet).toContain("• Feature 1");
      expect(featuresTweet).toContain("• Feature 2");
    });

    it("should never truncate features with 'X more...'", () => {
      const features = Array(10)
        .fill(null)
        .map((_, i) => `Feature ${i + 1}`);
      const result = formatTweets(version, features, releaseUrl);

      const allText = result.tweets.join(" ");
      expect(allText).not.toContain("more...");
      // All features should be present
      for (let i = 1; i <= 10; i++) {
        expect(allText).toContain(`Feature ${i}`);
      }
    });

    it("should split features across tweets if needed", () => {
      const features = Array(20)
        .fill(null)
        .map((_, i) => `This is feature number ${i + 1} with some extra description text`);
      const result = formatTweets(version, features, releaseUrl);

      const featureTweets = result.tweets.filter(
        (t) => t.startsWith("Features:") || t.startsWith("Features (cont.):")
      );
      expect(featureTweets.length).toBeGreaterThan(1);
    });
  });

  describe("other categories", () => {
    it("should truncate bug fixes after 4 items", () => {
      const features = ["Feature 1"];
      const items = {
        bugFixes: Array(10)
          .fill(null)
          .map((_, i) => `Bug fix ${i + 1}`),
        docs: [],
        chores: [],
      };
      const result = formatTweets(version, features, releaseUrl, items);

      const allText = result.tweets.join(" ");
      expect(allText).toContain("Bug Fixes:");
      expect(allText).toContain("6 more...");
    });

    it("should combine small categories into one tweet", () => {
      const features = ["Feature 1"];
      const items = {
        bugFixes: ["Fix 1"],
        docs: ["Doc 1"],
        chores: ["Chore 1"],
      };
      const result = formatTweets(version, features, releaseUrl, items);

      // Should have: title, features, combined categories, CTA = 4 tweets
      // Or potentially fewer if combined further
      const categoriesTweet = result.tweets.find(
        (t) => t.includes("Bug Fixes:") && t.includes("Docs:") && t.includes("Chores:")
      );
      expect(categoriesTweet).toBeDefined();
    });

    it("should separate categories if they exceed 800 chars combined", () => {
      const features = ["Feature 1"];
      const items = {
        bugFixes: Array(4)
          .fill(null)
          .map((_, i) => `This is a longer bug fix description number ${i + 1} that takes up more space`),
        docs: Array(4)
          .fill(null)
          .map((_, i) => `This is a longer doc description number ${i + 1} that takes up more space`),
        chores: [],
      };
      const result = formatTweets(version, features, releaseUrl, items);

      // Bug fixes and docs should be in separate tweets due to length
      const bugFixTweet = result.tweets.find((t) => t.includes("Bug Fixes:"));
      const docsTweet = result.tweets.find((t) => t.includes("Docs:"));
      expect(bugFixTweet).toBeDefined();
      expect(docsTweet).toBeDefined();
    });
  });

  describe("empty handling", () => {
    it("should handle empty features array", () => {
      const items = {
        bugFixes: ["Fix 1", "Fix 2"],
        docs: [],
        chores: ["Chore 1"],
      };
      const result = formatTweets(version, [], releaseUrl, items);

      expect(result.tweets[0]).toContain("Codex 0.92 is out.");
      expect(result.tweets[0]).toContain("2 bug fixes");
      expect(result.tweets[0]).not.toContain("feature");
    });

    it("should show minor updates when no content", () => {
      const result = formatTweets(version, [], releaseUrl);

      expect(result.tweets[0]).toContain("Minor updates.");
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

  describe("tweet length constraints", () => {
    it("should never exceed MAX_TWEET_LENGTH in any tweet", () => {
      const features = Array(30)
        .fill(null)
        .map((_, i) => `This is feature number ${i + 1} with extra text to make it longer`);
      const items = {
        bugFixes: Array(20)
          .fill(null)
          .map((_, i) => `Bug fix ${i + 1} with description`),
        docs: Array(10)
          .fill(null)
          .map((_, i) => `Doc ${i + 1}`),
        chores: Array(10)
          .fill(null)
          .map((_, i) => `Chore ${i + 1}`),
      };
      const result = formatTweets(version, features, releaseUrl, items);

      for (const tweet of result.tweets) {
        expect(tweet.length).toBeLessThanOrEqual(MAX_TWEET_LENGTH);
      }
    });
  });
});
