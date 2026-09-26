# CRITICAL RULES - MUST FOLLOW

## RESPONSES

- Keep responses concise and to the point unless the user asks otherwise.
- Report milestone result, important decisions, verification, blockers, and anything requiring user action.

## SOURCE OF TRUTH

- The repository is the implementation source of truth.
- Inspect relevant current files before planning or editing.
- Preserve existing working behavior unless the current milestone explicitly changes it.
- Do not broadly refactor during the deadline sprint.
- Work one milestone at a time.
- Never jump ahead to the next milestone because it appears obvious.

## PLANNING MODE

- Inspect the repository, current milestone, previous milestone output, existing architecture, tests, and relevant specifications before asking questions.
- Resolve uncertainty using repository truth, tests, documentation, scout-worker research, and architect analysis where possible.
- Ask the user only when a genuine unresolved product decision, credential requirement, live mutation, destructive action, or other human judgment is required.
- Never assume design, tech stack, interfaces, or features when they can be determined from the project.
- Use scout-worker for focused reconnaissance.
- Use architect for consequential changes involving provider orchestration, persistence, schema, payments, wallet flow, state transitions, reconciliation, or shared contracts.
- For substantial plans, define dependencies, parallelizable work, acceptance criteria, verification, and human approval gates before implementation.

## CHANGE / EDIT MODE

- For substantial implementation, delegate independent work to the appropriate specialist agents.
- Act primarily as coordinator/integrator when meaningful parallel work exists.
- Keep dependent or overlapping work sequential.
- Freeze shared interfaces and contracts before parallel implementation.
- Do not let sibling agents concurrently own the same implementation surface unless explicitly coordinated.
- Preserve unrelated work.
- Do not expand scope beyond the current milestone.

Use:
- scout-worker for reconnaissance
- architect for consequential architecture/contracts
- builder for ordinary bounded implementation
- ui-builder for frontend/UI work
- critical-builder for payments, wallet, persistence, idempotency, migrations, provider mutations, settlement, reconciliation, security-sensitive state
- verifier for independent final verification

Use the cheapest capable specialist for the task.
Use stronger reasoning models where reasoning has high leverage.
Do not use premium reasoning merely because a task contains code.

## SAFETY BOUNDARIES

Agents may autonomously:
- inspect
- research
- build
- mock
- test
- validate
- construct requests
- implement reconciliation
- reach the pre-mutation gate

Never:
- print or expose secrets
- print full sensitive bank details
- print credential-bearing URLs
- fake provider success
- blindly retry an unknown provider mutation
- invent refunds
- weaken validation to make tests pass

Persist state before irreversible multi-provider orchestration.

## DATABASE SCHEMA CHANGES

- Follow the repository's existing Drizzle/Supabase architecture.
- When a Drizzle-managed schema changes, use the project's established migration generation workflow.
- Inspect generated migrations.
- NEVER run drizzle push.
- Run migrations only against the intended approved development/test environment.
- Never perform destructive or production database mutation without explicit user approval.
- Preserve existing ownership, idempotency, uniqueness, and integrity constraints.

## TESTING

- Never assume changes work.
- Use the project's existing tests and validation tools.
- Run focused tests during implementation.
- Before closing a substantial milestone, run relevant regression tests plus appropriate typecheck, lint, build, and project-specific checks.
- Financial/provider state logic must test duplicate, retry, timeout, unknown-state, restart/reconciliation, and partial-failure behavior where relevant.
- If no dedicated testing framework exists, use the closest deterministic verification available and clearly report the gap.
- Do not interrupt the user merely to ask whether testing should be skipped unless the missing verification creates a genuine safety or correctness blocker.

## UI DESIGN

- Follow/reference the existing design system when creating or reviewing components or pages.
- Design System: @DESIGN.md
- Reuse existing components and patterns before introducing new primitives.
- Preserve mobile behavior.
- Do not redesign unrelated surfaces during milestone work.

## MILESTONE EXECUTION

For every milestone:

1. Inspect current repository state.
2. Read the current milestone requirements.
3. Inspect the completed previous milestone.
4. Scout relevant implementation surfaces where useful.
5. Establish shared contracts and invariants.
6. Split only genuinely independent work.
7. Execute parallel implementation where safe.
8. Integrate centrally.
9. Run milestone-specific verification.
10. Use verifier for independent review.
11. Repair concrete failures.
12. Stop at the milestone gate.

Do not automatically begin the next milestone.