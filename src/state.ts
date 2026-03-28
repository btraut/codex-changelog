import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SurfaceState {
  lastSeenVersion: string | null;
  pendingDigestVersion: string | null;
  pendingDigestUrl: string | null;
  pendingDigestDate: string | null;
}

export interface BotState {
  cli: {
    lastPostedVersion: string | null;
  };
  desktop: SurfaceState;
  vscode: SurfaceState;
  digest: {
    lastPostedDate: string | null;
  };
}

function getStateFilePath(): string {
  return path.join(process.cwd(), 'data', 'state.json');
}

function getLegacyCliStateFilePath(): string {
  return path.join(process.cwd(), 'data', 'last-posted-version.txt');
}

function createEmptySurfaceState(): SurfaceState {
  return {
    lastSeenVersion: null,
    pendingDigestVersion: null,
    pendingDigestUrl: null,
    pendingDigestDate: null,
  };
}

export function createEmptyState(): BotState {
  return {
    cli: {
      lastPostedVersion: null,
    },
    desktop: createEmptySurfaceState(),
    vscode: createEmptySurfaceState(),
    digest: {
      lastPostedDate: null,
    },
  };
}

function readLegacyCliState(): string | null {
  const legacyStateFile = getLegacyCliStateFilePath();

  try {
    if (fs.existsSync(legacyStateFile)) {
      const version = fs.readFileSync(legacyStateFile, 'utf-8').trim();
      return version || null;
    }
  } catch {
    // Ignore legacy state read failures.
  }

  return null;
}

export function readState(): BotState {
  const emptyState = createEmptyState();
  const stateFile = getStateFilePath();

  try {
    if (!fs.existsSync(stateFile)) {
      emptyState.cli.lastPostedVersion = readLegacyCliState();
      return emptyState;
    }

    const rawState = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Partial<BotState>;

    return {
      cli: {
        lastPostedVersion: rawState.cli?.lastPostedVersion ?? readLegacyCliState(),
      },
      desktop: {
        ...createEmptySurfaceState(),
        ...rawState.desktop,
      },
      vscode: {
        ...createEmptySurfaceState(),
        ...rawState.vscode,
      },
      digest: {
        lastPostedDate: rawState.digest?.lastPostedDate ?? null,
      },
    };
  } catch {
    emptyState.cli.lastPostedVersion = readLegacyCliState();
    return emptyState;
  }
}

export function writeState(state: BotState, options?: { dryRun?: boolean }): void {
  if (options?.dryRun) {
    return;
  }

  const stateFile = getStateFilePath();
  const legacyStateFile = getLegacyCliStateFilePath();
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');

  if (state.cli.lastPostedVersion) {
    fs.writeFileSync(legacyStateFile, state.cli.lastPostedVersion + '\n');
  }
}

export function queueDigestUpdate(
  state: BotState,
  surface: 'desktop' | 'vscode',
  version: string,
  url: string,
  digestDate: string
): boolean {
  const surfaceState = state[surface];
  if (surfaceState.lastSeenVersion === version) {
    return false;
  }

  surfaceState.lastSeenVersion = version;
  surfaceState.pendingDigestVersion = version;
  surfaceState.pendingDigestUrl = url;
  surfaceState.pendingDigestDate = digestDate;
  return true;
}

export function clearPendingDigest(state: BotState, surface: 'desktop' | 'vscode'): void {
  state[surface].pendingDigestVersion = null;
  state[surface].pendingDigestUrl = null;
  state[surface].pendingDigestDate = null;
}
