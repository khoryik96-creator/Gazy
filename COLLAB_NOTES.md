# Collaboration Notes

More than one Claude Code session/account may work on this repo at the same
time. This file is a lightweight shared log so agents don't duplicate or
collide on the same files — check it before starting work, update it when
your status changes.

## Protocol

1. Before starting a change, skim the **Status log** below for entries whose
   scope overlaps the file(s)/module(s) you're about to touch.
2. Add a row for your session before making changes: date, branch, what
   you're doing, which module(s) (see `ARCHITECTURE.md` for the module map).
3. Stick to the module boundaries in `ARCHITECTURE.md` — most collisions
   between two agents can be avoided just by keeping changes inside one
   module (`shared/`, `background/`, `popup/`, `content/`).
4. Update your row to "done" (or delete it) once your work is merged to
   `main`, so the log doesn't go stale.
5. If you see an "in progress" row on the same module you're about to edit,
   flag it to the human running you instead of proceeding — let them decide
   how to split the work.

## Status log

| Date       | Branch                                  | Scope                        | Status |
|------------|------------------------------------------|-------------------------------|--------|
| 2026-08-03 | claude/multi-account-project-rcmfpz     | none yet — awaiting a task   | idle   |
