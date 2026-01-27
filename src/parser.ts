export interface ParsedFeatures {
  features: string[]; // Clean feature descriptions
  raw: string; // Original markdown section
}

/**
 * Parses the "New Features" section from a GitHub release body.
 * Returns clean feature descriptions with PR references removed.
 */
export function parseNewFeatures(releaseBody: string): ParsedFeatures {
  // Find the "## New Features" section
  // Use [^\S\n]* to match horizontal whitespace only (not newlines)
  // The lookahead stops at another ## heading or end of string
  const sectionMatch = releaseBody.match(
    /## New Features[^\S\n]*\n([\s\S]*?)(?=\n## |$)/
  );

  if (!sectionMatch) {
    return { features: [], raw: "" };
  }

  const raw = sectionMatch[0];
  const sectionContent = sectionMatch[1];

  // Parse lines starting with - or *
  const lines = sectionContent.split("\n");
  const features: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if line is a bullet point
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      // Remove leading bullet
      let feature = trimmed.slice(2);

      // Remove PR references like (#1234) or (#9817, #9818, #9899)
      feature = feature.replace(/\s*\(#\d+(?:,\s*#\d+)*\)\s*/g, "");

      // Trim whitespace
      feature = feature.trim();

      if (feature) {
        features.push(feature);
      }
    }
  }

  return { features, raw };
}
