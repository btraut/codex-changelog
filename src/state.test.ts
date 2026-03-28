import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearPendingDigest, createEmptyState, queueDigestUpdate, readState, writeState } from './state.js';

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe('queueDigestUpdate', () => {
  it('queues a new digest update when the version changes', () => {
    const state = createEmptyState();

    const changed = queueDigestUpdate(
      state,
      'desktop',
      '26.325.31654',
      'https://developers.openai.com/codex/changelog/',
      '2026-03-28'
    );

    expect(changed).toBe(true);
    expect(state.desktop.lastSeenVersion).toBe('26.325.31654');
    expect(state.desktop.pendingDigestVersion).toBe('26.325.31654');
  });

  it('does not queue duplicate versions', () => {
    const state = createEmptyState();
    queueDigestUpdate(
      state,
      'vscode',
      '26.5325.31654',
      'https://marketplace.visualstudio.com/items?itemName=openai.chatgpt',
      '2026-03-28'
    );

    const changed = queueDigestUpdate(
      state,
      'vscode',
      '26.5325.31654',
      'https://marketplace.visualstudio.com/items?itemName=openai.chatgpt',
      '2026-03-28'
    );

    expect(changed).toBe(false);
  });
});

describe('clearPendingDigest', () => {
  it('clears pending digest fields for a surface', () => {
    const state = createEmptyState();
    queueDigestUpdate(
      state,
      'desktop',
      '26.325.31654',
      'https://developers.openai.com/codex/changelog/',
      '2026-03-28'
    );

    clearPendingDigest(state, 'desktop');

    expect(state.desktop.pendingDigestVersion).toBeNull();
    expect(state.desktop.pendingDigestUrl).toBeNull();
    expect(state.desktop.pendingDigestDate).toBeNull();
  });
});

describe('state persistence', () => {
  it('writes and reads structured state from the current working directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-changelog-state-'));
    process.chdir(tempDir);

    const state = createEmptyState();
    state.cli.lastPostedVersion = '0.1.2';
    state.desktop.lastSeenVersion = '26.325.31654';

    writeState(state);

    const writtenState = readState();
    expect(writtenState.cli.lastPostedVersion).toBe('0.1.2');
    expect(writtenState.desktop.lastSeenVersion).toBe('26.325.31654');
    expect(fs.existsSync(path.join(tempDir, 'data', 'state.json'))).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, 'data', 'last-posted-version.txt'), 'utf-8')).toBe('0.1.2\n');
  });

  it('does not write any files in dry-run mode', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-changelog-state-'));
    process.chdir(tempDir);

    const state = createEmptyState();
    state.cli.lastPostedVersion = '9.9.9';

    writeState(state, { dryRun: true });

    expect(fs.existsSync(path.join(tempDir, 'data', 'state.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'data', 'last-posted-version.txt'))).toBe(false);
  });
});
