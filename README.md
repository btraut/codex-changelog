# Codex Changelog Bot

Archived Twitter (X) bot that previously posted Codex updates across the CLI, desktop app, and VS Code extension.

This project no longer posts release updates automatically. Follow [@CodexReleases](https://x.com/CodexReleases) for Codex release updates.

## How it works

The workflow can still be run manually to preview detected CLI releases and the pending desktop/VS Code digest, but scheduled posting is disabled. Runtime posting and state updates are opt-in and require `POST_TO_X=true`; without that flag, runs do not call X or write bot state.

## License

MIT
