# Codex Changelog Bot

A Twitter (X) bot that posts Codex updates across the CLI, desktop app, and VS Code extension.

Follow [@CodexLog](https://x.com/CodexLog) to stay up to date.

## How it works

- The bot checks the Codex CLI changelog feed every 15 minutes. When a new CLI release appears, it posts a thread with release notes.
- The bot also watches the Codex desktop app appcast and the VS Code Marketplace listing for `openai.chatgpt`.
- Desktop app and VS Code changes are queued into a once-daily digest instead of posting immediately.
- If neither surface changed, the daily digest stays quiet.
- `DRY_RUN=true` is genuinely read-only now: it fetches live data and renders tweets, but it does not mutate bot state.

## License

MIT
