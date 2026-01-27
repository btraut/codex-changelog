import { describe, it, expect } from "vitest";
import { parseNewFeatures } from "./parser.js";

describe("parseNewFeatures", () => {
  it("extracts features from valid release body", () => {
    const releaseBody = `## New Features
- API v2 threads can now inject dynamic tools at startup. (#9539)
- Multi-agent collaboration is more capable. (#9817, #9818, #9918, #9899)

## Bug Fixes
- Fixed something`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual([
      "API v2 threads can now inject dynamic tools at startup.",
      "Multi-agent collaboration is more capable.",
    ]);
    expect(result.raw).toContain("## New Features");
    expect(result.raw).toContain("API v2 threads");
  });

  it("returns empty when no 'New Features' section", () => {
    const releaseBody = `## Bug Fixes
- Fixed a bug (#123)

## Other Changes
- Something else`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual([]);
    expect(result.raw).toBe("");
  });

  it("removes single PR reference (#1234)", () => {
    const releaseBody = `## New Features
- Added new feature (#1234)`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual(["Added new feature"]);
  });

  it("removes multiple PR references (#9817, #9818)", () => {
    const releaseBody = `## New Features
- Multi-agent collaboration is more capable. (#9817, #9818)`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual([
      "Multi-agent collaboration is more capable.",
    ]);
  });

  it("handles bullet points with * as well as -", () => {
    const releaseBody = `## New Features
* Feature with asterisk (#123)
- Feature with dash (#456)`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual([
      "Feature with asterisk",
      "Feature with dash",
    ]);
  });

  it("handles New Features section at end of document", () => {
    const releaseBody = `## Bug Fixes
- Fixed something

## New Features
- Last section feature (#789)`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual(["Last section feature"]);
  });

  it("handles empty New Features section", () => {
    const releaseBody = `## New Features

## Bug Fixes
- Fixed something`;

    const result = parseNewFeatures(releaseBody);

    expect(result.features).toEqual([]);
    expect(result.raw).toContain("## New Features");
  });
});
