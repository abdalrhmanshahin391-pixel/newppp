# Repository agent workflow

Read this for tool-output handling, continuing/handoff work, or host compatibility.
`AGENTS.md` owns repository policy. This is a proposed quality-first, lower-waste workflow,
not a measured optimization. Correct, accepted delivery is the objective, not token reduction alone.

## Investigation and change review

Use the focused-change skill for its implementation steps. Search relevant errors/symbols/routes
first (`rg`/`rg --files`), then read enough surrounding code to understand contracts and side
effects. A small search is a starting point, not a correctness boundary. Reuse known findings only
after checking they still match the current files/commit. Do not rewrite the application during
workflow configuration, upgrade dependencies incidentally, or change runtime prompts to reduce
coding-agent context.

Keep routine planning brief when no stricter rule applies. The owner's global plan-first rule
still requires a plan and approval even for small edits while it remains in force. Do not alter
global settings to remove it. Existing visual work still follows `docs/design-workflow.md`.

## Tool output and diagnostics

- Prefer scoped queries and useful summaries; inspect raw output when the summary is insufficient.
- Preserve the command's exit status, failure count and meaningful warnings. Never return a
  filter's successful exit code as if it were the failed command's result. For pipelines, use the
  shell's failure propagation or explicitly capture and return the original command status.
- Disclose filtering/truncation. When recovery matters, retain a safe full diagnostic log and
  give its path. Rerun only when necessary and safe; do not repeat successful checks without cause.
- The ignored `output/agent-workflow-pilot/` directory is for sanitized local pilot artifacts.
  Being ignored does not make a log safe: never store secrets, private payloads or full transcripts
  there. Redact before writing. Do not put sensitive logs into Git or PR descriptions.
- A missing tool, skipped command or inaccessible service is an explicit limitation, not a pass.
  Required CI remains required. Do not use `[skip ci]` merely to make an optimization look faster.
  If the owner explicitly limits validation, report the limitation and do not claim it passed.

## Sessions, agents and handoffs

Use a new session for unrelated work. Continue related work with the context needed to preserve
decisions and contracts; do not copy a whole historic chat into every task. Before a substantial
handoff, record the goal, current commit/worktree, changed files, decisions, actual checks and
failures, and the next action. Verify a stale handoff against current files. Do not generate a
handoff document for every trivial edit.

Default to one implementation agent. Additional agents require a justified bounded independent
task and authorization under the current session's rules. Include their time/usage in evaluation;
avoid competing edits to the same files. Do not change model, reasoning or speed mode during the
initial trial. Model routing, premium speed modes, hooks, plugins and third-party installations
need separate approval; none are installed by this configuration.

## Host compatibility

File presence is not proof of automatic loading. Record host version, surface, working directory,
observed skill path and enabled state. Keep unverified claims explicitly unverified.

| Host | Repository entry | Verification needed |
|---|---|---|
| Codex | `AGENTS.md`; `.agents/skills/focused-change/SKILL.md` | Check guidance discovery in the actual surface; use its skill list/selector to confirm the canonical path. Supported app-server versions expose `skills/list` with `cwds` and `forceReload`. No model turn is needed to list skills. |
| Claude Code | `CLAUDE.md`; `.claude/skills/focused-change/SKILL.md` | Record the actual version/surface, check loaded instructions and the skill selector, and explicitly invoke `/focused-change` for an approved task. Confirm the adapter reads the shared file. |
| Claude cloud/IDE/desktop variants | Depends on surface/version | Do not assume the local repository or user-scope skills are available. Inspect that surface; a local check does not validate cloud support. |

`CLAUDE.md` currently tells Claude to read the canonical policy explicitly. It uses no `@import`
or symlink while the owner's Claude version is unavailable. If verified support later warrants an
import, replace the read instruction in a reviewed change; do not duplicate the policy. Do not
change user/global loading settings to force discovery. Start in the correct repository/worktree.

The two skill entry files use only shared `name`/`description` metadata. The Claude entry is a
thin relative-file adapter; no Codex invocation-policy fields are copied into it. Neither includes
scripts, dynamic commands, hooks, permissions or network dependencies. Existing design skills
remain available on demand; their presence does not prove discovery in another host.

Official references, checked 2026-11-09 (documentation support is not an installed-host test):
- [Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex app server](https://learn.chatgpt.com/docs/app-server)
- [Claude memory/instructions](https://code.claude.com/docs/en/memory)
- [Claude skills](https://code.claude.com/docs/en/skills)

## Completion and rollback

Routine reports should be concise but include changed behavior, checks and failures, unrun checks,
material assumptions and remaining risks. A workflow configuration report additionally lists
files/purposes, actual discovery per host, compatibility checks, measured results or **not yet
measured**, and rollback instructions. Do not attribute an old green run to a new commit.

Keep changes in reviewable commits/PRs. Revert the affected configuration commits through a new
reviewed commit/PR, newest first; do not force-push or rewrite Lovable history. Remove the skill
entry files to undo their addition and restore prior instruction contents. If results already
exist, retain safe measurement evidence outside Git for diagnosis. No global settings or
credentials should need restoring because this workflow does not change them.
