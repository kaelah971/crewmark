# AGENTS.md

# OPERATING MODE

Optimize for FAST, CORRECT SHIPPING.

Default to direct implementation by the primary agent.

Do not create process, research, planning, or sub-agent overhead unless it materially improves correctness or reduces total completion time.

The goal is not maximum orchestration.
The goal is the shortest reliable path from request → working verified implementation.

---

# CRITICAL RULES

- Keep the repository recoverable.
- Preserve existing working behavior unless the task explicitly changes it.
- Never overwrite or discard unrelated user changes.
- Never invent repository state; inspect before making assumptions.
- Add meaningful durable project rules to AGENTS.md only when they are likely to matter again.
- Clean temporary files, debug artifacts, and build clutter created by the task.
- Never expose or commit secrets, API keys, .env files, credentials, or private tokens.
- Do not deploy, publish, or make destructive remote changes unless explicitly requested.
- Prefer local commits for recoverability.
- Do not automatically push every checkpoint unless the user explicitly asks for auto-push.

---

# RESPONSE STYLE

- Keep responses concise and execution-focused.
- Do not narrate every internal step.
- Report:
  - what changed
  - important decisions
  - verification results
  - blockers or remaining risks
- Do not claim something works unless it was actually verified.

---

# DEFAULT WORKFLOW

For normal feature work and bug fixes:

1. Inspect only the relevant code.
2. Identify the smallest correct change.
3. Implement directly.
4. Run targeted verification.
5. Repair failures.
6. Run final required quality gates.
7. Commit the finished checkpoint when appropriate.
8. Report results.

Do not create a large plan for straightforward work.

Do not perform repeated repository-wide audits unless necessary.

---

# CLARIFYING QUESTIONS

Do NOT automatically ask clarifying questions.

If the user's intent is sufficiently clear:
- make reasonable repository-grounded assumptions
- implement
- report the assumptions only if they materially matter

Ask a question only when:
- two plausible interpretations would produce meaningfully different products
- required credentials/assets/information are missing
- an irreversible/destructive action requires confirmation
- proceeding would likely waste substantial work

Do not block implementation for minor ambiguity.

---

# PLANNING

Use lightweight planning proportional to the task.

Small fix:
- inspect
- fix
- verify

Medium feature:
- inspect dependencies
- define a short implementation approach
- implement

Large architectural change:
- inspect
- freeze important contracts/invariants
- break into a small number of implementation phases
- then build

Do not produce planning documents unless requested.

---

# SUB-AGENTS

Sub-agents are OPTIONAL, not the default.

The primary agent should implement work directly whenever practical.

Use a sub-agent only when it will likely REDUCE total completion time.

Good reasons:
- two or more genuinely independent tasks can run in parallel
- specialized research is required
- an unfamiliar subsystem needs focused reconnaissance
- an independent final review is valuable for a high-risk change
- a large task has clearly separated work with no overlapping files/contracts

Do NOT use sub-agents for:
- simple bug fixes
- ordinary UI changes
- one-file or few-file changes
- straightforward refactors
- routine tests
- documentation
- repository reconnaissance the primary agent can do quickly
- reviewing every plan
- reviewing every implementation

Maximum default parallel sub-agents: 2.

Use more only when the task clearly benefits.

Never delegate overlapping edits to multiple agents.

Do not wait for a sub-agent if the primary agent can safely continue independent work.

Do not use a sub-agent merely because one is available.

---

# IMPLEMENTATION

Prefer direct, minimal changes over broad rewrites.

Before changing code:
- locate the real source of truth
- inspect relevant callers/consumers
- understand existing contracts

Avoid:
- speculative abstraction
- unnecessary new dependencies
- duplicate state systems
- temporary compatibility layers with no need
- rewriting working modules to solve a localized problem

For bugs:
fix the root cause rather than hiding symptoms with CSS, timeouts, retries, or duplicated state.

---

# REPOSITORY RECONNAISSANCE

Be efficient.

Prefer:
- targeted search
- exact symbol lookup
- relevant file inspection
- git diff/status

Avoid reading the entire repository before every task.

Only expand reconnaissance when findings require it.

---

# TESTING

Never assume changes work.

During implementation:
- run the smallest relevant tests first
- use targeted tests for fast iteration
- use browser/runtime verification for visual or interaction changes

Do NOT run the full test + lint + typecheck + production build after every tiny edit.

Run full project gates once the implementation is stable.

Final verification should normally include the repository's available equivalents of:

- targeted tests
- full tests
- typecheck
- lint
- production build

Only run commands that actually exist in the project.

If a project has no testing setup, verify through the best available runtime/manual mechanism instead of blocking automatically.

---

# VISUAL / FRONTEND WORK

For visual changes, code-level PASS is not enough.

Verify the actual rendered result.

Check:
- intended viewport
- responsive behavior when relevant
- overflow
- alignment
- interaction states
- visual regressions

Do not claim visual success based only on tests.

If supplied reference artwork controls the design, preserve its intended visual direction.

Do not replace missing realistic assets with obviously inferior CSS/SVG placeholders unless explicitly approved.

---

# BROWSER TESTING

For interaction-heavy features:
- verify the shortest real user flow that exercises the change
- avoid exhaustive E2E repetition when focused verification is sufficient

When fixing one bug, test:
1. the bug itself
2. the nearest regression risk
3. the final happy path

Do not repeatedly replay the entire product unless the change affects the entire product.

---

# QUALITY GATES

Use two levels.

## FAST ITERATION GATE

During development:
- relevant unit/component test
- relevant typecheck if needed
- browser/runtime check where applicable

## FINAL GATE

Before declaring the task complete:
- relevant/full tests
- typecheck
- lint
- production build
- git diff --check when available

Do not repeatedly run expensive final gates while still actively editing.

---

# GIT

Use git for recoverability without slowing every edit.

Before substantial work:
- inspect git status
- preserve unrelated changes

Commit when:
- a meaningful milestone is complete
- tests are passing
- the repository is in a coherent recoverable state

Do NOT create a commit for every tiny edit.

Do NOT automatically push every commit.

Push only when:
- the user explicitly requests it
- the task explicitly requires remote synchronization
- an existing project instruction explicitly requires it

Never force-push unless explicitly authorized.

---

# DATABASE SCHEMA CHANGES

When using Drizzle:

- run the project's Drizzle generate command after schema changes
- run migrations through the project's migration workflow
- NEVER use `drizzle push` unless explicitly instructed by the user

Preserve existing production data assumptions.

Do not perform hosted database writes without explicit authorization.

---

# STATE / PERSISTENCE CHANGES

When modifying persisted state:

- identify the authoritative source of truth
- avoid duplicate competing state
- preserve backward compatibility where required
- test refresh/reload behavior
- test migration behavior when persisted schemas change
- ensure partial failures cannot leave corrupted state

For slot/version/history systems:
historical records must not be mutated by newer active state.

---

# PERFORMANCE

Prefer the solution that produces the fastest reliable user-visible result.

Avoid:
- unnecessary sequential agent work
- repeated full builds
- repeated repository scans
- unnecessary dependency installation
- speculative optimizations

When two approaches are equally correct, choose the simpler/faster implementation.

---

# STOP CONDITIONS

Stop and ask the user only when:

- required information is unavailable
- an irreversible action needs approval
- a missing asset prevents the requested quality
- credentials/API access are required
- the request conflicts with an existing critical invariant and intent cannot be safely inferred

Otherwise continue to completion.

---

# COMPLETION REPORT

When finished, report concisely:

- implemented
- files/areas changed
- verification performed
- test/build status
- commit hash if committed
- any real remaining issue

Do not include long implementation diaries unless requested.
