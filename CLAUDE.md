# Agent Guide

## Coding guardrails

- Favor type inference; avoid `any` and unnecessary casts.
- Disabling lint rules is usually a sign that you should reconsider your approach.
- Never use barrel files (`index.ts` re-exports); import directly from the source module. It's rarely correct to name a file `index.ts`.
- When you see unrelated unstaged/uncommitted files, ignore them. They likely belong to another active agent, so do not touch, stage, or revert them.
- You do not need to mention unrelated uncommitted files in your responses.

## Committing

- If I say "commit your changes" or "commit", commit only your session's changes and ignore everything else.
- Before committing, ensure no unrelated changes are staged (unstage anything you did not touch).
- If I tell you to commit and push, I mean: commit to local `main`, then push `main` to `origin/main`.
- If I tell you to "ship it", I mean: commit to local `main`, then push `main` to `origin/main`.

## Work checkpoints (run after a logical chunk)

- Run lint and typecheck (can run in parallel), then format.
- After any distinct unit of work, re-read AGENTS and nearby README files and patch them if the guidance or behavior changed.
- Update nearby README/AGENTS/docs when behavior or interfaces change.

## Working from specs

- When executing a spec, the moment you finish a step in that spec, mark it in the spec with a green check mark emoji (✅) and add any relevant implementation notes right beside the step.

## Beads usage

- Use beads for multi-session work, major features, or when decisions need to survive compaction.
- Prefer an epic with milestone tasks for sequential work; keep bead count low.
- Store full specs/plans in the repo under `docs/` and link the path in the epic's design field (and optionally in milestones).
- Update beads if scope, decisions, or acceptance criteria change.

## Landing the plane (session completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Output hygiene

- Stick to ASCII punctuation (use "-" and "'"); avoid curly quotes/dashes unless required in proper names.
- Only emit citation markers when using real `web.run` sources; otherwise omit them.
- Skim rendered output for stray replacement boxes before handing off.
