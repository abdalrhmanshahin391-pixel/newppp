# Workflow pilot protocol

Read only when a workflow evaluation is explicitly approved. **Status: not started; savings,
cost, quality effect and accepted-completion time are not yet measured.** Approval to configure
instructions does not authorize paid runs, provider probes, new tools or model routing.

## Freeze the comparison

Before execution, agree on a small set of representative tasks, exact acceptance criteria and
spending/time bounds. Suggested categories are a bounded UI bug, a pure-logic regression and an
authorization/migration case in a disposable environment. Do not choose live production as the
test environment or invent tasks/results to fill the table. No pilot tasks are approved yet.

Record the same starting product commit, files, dependencies/lockfile, OS/runtime, validation
requirements, fixtures and reviewer rubric for each baseline/candidate pair. Use separate worktrees
and fresh sessions with equivalent necessary context; don't give the second run the first run's
solution. Do not copy historic chat logs into either. Retain failed attempts and human repairs.
Run sequentially with one implementation agent by default; count any approved extra agents too.

Hold the model, reasoning level and speed mode fixed within each host's comparison. Record their
actual values, or mark unknown; a nominally matched run with unverified settings cannot establish
a controlled effect. Do not silently use a cheaper model or enable premium speed. Codex/Claude
comparisons are separate: do not assume their tokens, caches, allowances or surfaces are equivalent.

## Change one major factor at a time

This PR packages the files for review; that is not itself an experiment.

1. Baseline: original repository instructions and no focused-change skill.
2. Candidate A: only the shared instruction/reference organization (AGENTS/CLAUDE/docs changes).
   Do not include the new skill entry files or their routing lines in AGENTS/CLAUDE in this trial
   checkout; leave no links to absent skill files. Record that exact instruction overlay.
3. Candidate B: add focused-change to the retained A configuration. Keep all other factors fixed.
4. Output-handling changes, optional tools and model routing are separate later trials, each needing
   its own scoped approval. Do not activate all factors and attribute an outcome to one of them.

Use the same product starting commit with only the candidate's explicit workflow overlay changed.
Alternate run order where practical and record order/cache conditions. Do not delete user/global
caches to manufacture a cold run; unknown cache state is a limitation. Predefine reviewer acceptance
and regression checks; conceal which workflow produced the patch when feasible. A small pilot
can reveal regressions, not establish universal quality equivalence.

## Record only observed metrics

Keep sanitized local records in ignored `output/agent-workflow-pilot/`. Suggested fields:

| Field | Definition |
|---|---|
| Identity | Task/run/attempt, baseline or candidate, product commit, exact workflow overlay, host/version/surface, run order |
| Environment | Runtime/dependencies, model/reasoning/speed, acceptance rubric, observed cache state; unknown values stay unknown |
| Outcome | Accepted/rejected/not reviewed, regression findings, actual checks/results, unrun gates, pre-existing failures |
| Usage | Provider-reported input/cached-input/output with source and definitions; unavailable stays null, never zero |
| Cost | Actually billed amount/currency and attribution source, or observed allowance change with its uncertainty; not an invented dollar conversion |
| Time | Observed start through accepted completion, including retries/waits/rework; report active agent time separately if available |
| Human work | Reviewer/repair time actually tracked, findings, number of revisions; otherwise unavailable |

Do not add cached tokens to input totals unless the provider defines them as disjoint. Do not
derive exact billing from an allowance bar or unexplained counters. Separate observed bills from
estimates; no billing or transcript scraping is part of this configuration. Logs must not contain
credentials, private request/response payloads or full session transcripts. Ignore rules are not
redaction. Retain access to safe full failure diagnostics and original exit statuses.

## Decide and roll back

Compare per-task accepted outcomes, total elapsed time, rework/reviewer effort and attributable
cost/usage, including failures. Record missing metrics rather than manufacturing an overall score.
If cost is unavailable, say cost effect is unknown; time improvements alone do not prove savings.

Retain only useful observed improvements with no detected acceptance/safety regression in the
tested tasks. Revert regressions and investigate inconclusive outcomes; do not weaken validation
after a failed trial. Account for discovery overhead, references loaded and extra-agent usage.
Small samples do not prove unchanged quality across the repository.

Revert configuration commits through a normal reviewed commit/PR, newest first, without rewriting
Lovable history. No global model, permissions, credentials or billing settings should need recovery.
Preserve sanitized observations for diagnosis; do not create a handoff artifact for every edit.

## Configuration acceptance (distinct from pilot acceptance)

- Canonical policy and shared skill resolve without contradictory copies; global approvals remain.
- Standard skill metadata validates; Codex discovery is checked in an available actual host.
- Claude version/loading/import support is checked in its actual environment or explicitly unverified.
- Application code, dependencies/lockfile, CI gates, runtime prompts and global settings are unchanged.
- Final report lists files, discovery/compatibility evidence, actual validation/limitations,
  **not yet measured** results when appropriate, and exact rollback commit(s).
