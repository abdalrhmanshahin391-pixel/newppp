---
name: focused-change
description: Implement a scoped fix or feature in this repository, from acceptance criteria through validation and diff review. Use for code changes, not read-only questions or deployment operations.
---

# Focused change

1. Establish the requested behavior, acceptance criteria and authorized scope. Follow `AGENTS.md`
   and current owner/global planning rules; the skill grants no extra permissions.
2. Start at relevant errors, symbols, routes, tests or known entry points. Read contracts, callers,
   failure paths and side effects. Expand investigation when evidence requires it, without a fixed
   file-count limit.
3. Implement the smallest complete solution using existing patterns and dependencies. Preserve
   unrelated behavior; avoid incidental refactors, formatting churn and speculative abstractions.
4. For a bug, establish a reproducible failure or equivalent verification target when feasible.
   Use [the repository validation map](../../../docs/agent-validation.md) for focused iteration
   and required completion checks. Broaden checks for shared or security-sensitive changes.
   Do not weaken tests, types, security or acceptance criteria to save time or tokens.
5. Review the resulting diff for scope, behavior, maintainability and unintended changes. Separate
   pre-existing failures from introduced failures and resolve findings within the authorized scope.
6. Report the behavior changed, checks actually run and their outcomes, unrun checks, limitations
   and remaining risks. Never infer full correctness from selected passing tests or invent metrics.
